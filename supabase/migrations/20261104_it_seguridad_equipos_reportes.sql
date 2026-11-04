-- IT: contraseñas de licencias cifradas con registro de accesos, garantía e historial de equipos,
-- y reporte de IT en una sola consulta. Todo se valida con la sesión de la app (x-app-token).

/* ───────────── 1. Licencias Office: datos sensibles cifrados ───────────── */

create table if not exists public.licencias_office_secretos (
  licencia_id      bigint primary key references public.licencias_office(id) on delete cascade,
  password         bytea,
  pin              bytea,
  recuperacion     bytea,
  fecha_nacimiento bytea,
  updated_at       timestamptz not null default now(),
  updated_by       bigint references public.usuarios(id) on delete set null
);
alter table public.licencias_office_secretos enable row level security;
revoke all on public.licencias_office_secretos from anon, authenticated;

create table if not exists public.licencias_accesos (
  id             bigint generated always as identity primary key,
  licencia_id    bigint references public.licencias_office(id) on delete cascade,
  usuario_id     bigint references public.usuarios(id) on delete set null,
  usuario_nombre text,
  campo          text not null,
  accion         text not null check (accion in ('ver', 'copiar', 'editar')),
  created_at     timestamptz not null default now()
);
create index if not exists licencias_accesos_licencia_idx on public.licencias_accesos (licencia_id, created_at desc);
alter table public.licencias_accesos enable row level security;
revoke all on public.licencias_accesos from anon, authenticated;

-- Llave de cifrado: se genera una sola vez dentro de Vault; nunca sale de la base de datos.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'licencias_office_clave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'licencias_office_clave',
      'Llave de cifrado de contraseñas, PIN y datos de recuperación de licencias Office');
  end if;
end $$;

create or replace function public._lic_clave() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'licencias_office_clave' limit 1
$$;
revoke execute on function public._lic_clave() from public, anon, authenticated;

create or replace function public._lic_cifrar(p text) returns bytea
language sql stable security definer set search_path = '' as $$
  select case when nullif(p, '') is null then null else extensions.pgp_sym_encrypt(p, public._lic_clave()) end
$$;
revoke execute on function public._lic_cifrar(text) from public, anon, authenticated;

create or replace function public._lic_descifrar(p bytea) returns text
language sql stable security definer set search_path = '' as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, public._lic_clave()) end
$$;
revoke execute on function public._lic_descifrar(bytea) from public, anon, authenticated;

-- Copia los datos actuales cifrados, comprueba que se descifran igual y solo entonces borra el texto plano.
do $$
declare n_mal int;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'licencias_office' and column_name = 'password') then
    insert into public.licencias_office_secretos (licencia_id, password, pin, recuperacion, fecha_nacimiento)
    select id, public._lic_cifrar(password), public._lic_cifrar(pin), public._lic_cifrar(recuperacion_zoho), public._lic_cifrar(fecha_nacimiento)
    from public.licencias_office
    where coalesce(password, '') <> '' or coalesce(pin, '') <> '' or coalesce(recuperacion_zoho, '') <> '' or coalesce(fecha_nacimiento, '') <> ''
    on conflict (licencia_id) do nothing;

    select count(*) into n_mal
    from public.licencias_office l
    left join public.licencias_office_secretos s on s.licencia_id = l.id
    where coalesce(nullif(l.password, ''), '¤') <> coalesce(public._lic_descifrar(s.password), '¤')
       or coalesce(nullif(l.pin, ''), '¤') <> coalesce(public._lic_descifrar(s.pin), '¤')
       or coalesce(nullif(l.recuperacion_zoho, ''), '¤') <> coalesce(public._lic_descifrar(s.recuperacion), '¤')
       or coalesce(nullif(l.fecha_nacimiento, ''), '¤') <> coalesce(public._lic_descifrar(s.fecha_nacimiento), '¤');
    if n_mal > 0 then
      raise exception 'La verificación del cifrado falló en % licencias; no se borró nada.', n_mal;
    end if;

    alter table public.licencias_office
      drop column password, drop column pin, drop column recuperacion_zoho, drop column fecha_nacimiento;
  end if;
end $$;

-- Qué licencias tienen cada dato guardado (sin revelarlo)
create or replace function public.licencias_secretos_estado()
returns table (licencia_id bigint, password boolean, pin boolean, recuperacion boolean, fecha_nacimiento boolean)
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not public.app_tiene_acceso('it') then raise exception 'Sin acceso' using errcode = '42501'; end if;
  return query select s.licencia_id, s.password is not null, s.pin is not null, s.recuperacion is not null, s.fecha_nacimiento is not null
    from public.licencias_office_secretos s;
end $$;

-- Revela un dato y deja registro (ver o copiar)
create or replace function public.licencia_secreto(p_licencia bigint, p_campo text, p_accion text default 'ver')
returns text
language plpgsql volatile security definer set search_path = 'public' as $$
declare uid bigint := public.app_usuario_id(); valor text;
begin
  if uid is null or not public.app_tiene_acceso('it') then raise exception 'Sin acceso' using errcode = '42501'; end if;
  if p_campo not in ('password', 'pin', 'recuperacion', 'fecha_nacimiento') then raise exception 'Campo no válido'; end if;
  if p_accion not in ('ver', 'copiar') then p_accion := 'ver'; end if;
  select public._lic_descifrar(case p_campo when 'password' then s.password when 'pin' then s.pin
           when 'recuperacion' then s.recuperacion else s.fecha_nacimiento end)
    into valor from public.licencias_office_secretos s where s.licencia_id = p_licencia;
  insert into public.licencias_accesos (licencia_id, usuario_id, usuario_nombre, campo, accion)
  values (p_licencia, uid, (select nombre from public.usuarios where id = uid), p_campo, p_accion);
  return valor;
end $$;

-- Guarda los datos sensibles: null = no cambiar, '' = borrar
create or replace function public.licencia_secretos_guardar(p_licencia bigint, p_password text default null, p_pin text default null,
  p_recuperacion text default null, p_fecha_nacimiento text default null)
returns void
language plpgsql volatile security definer set search_path = 'public' as $$
declare uid bigint := public.app_usuario_id(); nom text; cambios text[] := '{}';
begin
  if uid is null or not public.app_tiene_acceso('it') then raise exception 'Sin acceso' using errcode = '42501'; end if;
  if not exists (select 1 from public.licencias_office where id = p_licencia) then raise exception 'Licencia no encontrada'; end if;
  insert into public.licencias_office_secretos (licencia_id) values (p_licencia) on conflict (licencia_id) do nothing;
  if p_password is not null then
    update public.licencias_office_secretos set password = public._lic_cifrar(left(p_password, 300)) where licencia_id = p_licencia; cambios := array_append(cambios, 'password'); end if;
  if p_pin is not null then
    update public.licencias_office_secretos set pin = public._lic_cifrar(left(p_pin, 50)) where licencia_id = p_licencia; cambios := array_append(cambios, 'pin'); end if;
  if p_recuperacion is not null then
    update public.licencias_office_secretos set recuperacion = public._lic_cifrar(left(p_recuperacion, 2000)) where licencia_id = p_licencia; cambios := array_append(cambios, 'recuperacion'); end if;
  if p_fecha_nacimiento is not null then
    update public.licencias_office_secretos set fecha_nacimiento = public._lic_cifrar(left(p_fecha_nacimiento, 30)) where licencia_id = p_licencia; cambios := array_append(cambios, 'fecha_nacimiento'); end if;
  if array_length(cambios, 1) > 0 then
    update public.licencias_office_secretos set updated_at = now(), updated_by = uid where licencia_id = p_licencia;
    select nombre into nom from public.usuarios where id = uid;
    insert into public.licencias_accesos (licencia_id, usuario_id, usuario_nombre, campo, accion)
    select p_licencia, uid, nom, c, 'editar' from unnest(cambios) c;
  end if;
end $$;

-- Quién vio, copió o cambió los datos de una licencia (solo administradores)
create or replace function public.licencia_accesos(p_licencia bigint)
returns table (usuario text, campo text, accion text, fecha timestamptz)
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not public.app_es_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return query select coalesce(a.usuario_nombre, 'Usuario eliminado'), a.campo, a.accion, a.created_at
    from public.licencias_accesos a where a.licencia_id = p_licencia order by a.created_at desc limit 40;
end $$;

revoke execute on function public.licencias_secretos_estado() from public;
revoke execute on function public.licencia_secreto(bigint, text, text) from public;
revoke execute on function public.licencia_secretos_guardar(bigint, text, text, text, text) from public;
revoke execute on function public.licencia_accesos(bigint) from public;
grant execute on function public.licencias_secretos_estado() to anon, authenticated;
grant execute on function public.licencia_secreto(bigint, text, text) to anon, authenticated;
grant execute on function public.licencia_secretos_guardar(bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.licencia_accesos(bigint) to anon, authenticated;


/* ───────────── 2. Equipos: garantía e historial ───────────── */

alter table public.inventario_equipos add column if not exists garantia_hasta date;
alter table public.inventario_equipos add column if not exists updated_at timestamptz default now();

create table if not exists public.equipos_historial (
  id             bigint generated always as identity primary key,
  equipo_id      bigint not null references public.inventario_equipos(id) on delete cascade,
  accion         text not null,
  campo          text,
  valor_anterior text,
  valor_nuevo    text,
  usuario_nombre text,
  created_at     timestamptz not null default now()
);
create index if not exists equipos_historial_equipo_idx on public.equipos_historial (equipo_id, created_at desc);
alter table public.equipos_historial enable row level security;
revoke all on public.equipos_historial from anon, authenticated;
grant select, insert on public.equipos_historial to anon, authenticated;
drop policy if exists equipos_historial_leer on public.equipos_historial;
create policy equipos_historial_leer on public.equipos_historial for select to anon, authenticated
  using ((select public.app_tiene_acceso('it')));
-- Desde la app solo se registran actas (lo demás lo escribe el disparador)
drop policy if exists equipos_historial_actas on public.equipos_historial;
create policy equipos_historial_actas on public.equipos_historial for insert to anon, authenticated
  with check ((select public.app_tiene_acceso('it')) and accion in ('Acta de entrega', 'Acta de devolución', 'Etiqueta impresa'));

create or replace function public.registrar_historial_equipo() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare quien text := (select nombre from public.usuarios where id = public.app_usuario_id());
  campos text[] := array['asignado_a', 'estado', 'tipo', 'marca', 'modelo', 'numero_serie', 'procesador', 'ram',
                         'almacenamiento', 'sistema_operativo', 'fecha_compra', 'garantia_hasta', 'notas'];
  c text; antes text; despues text;
begin
  if tg_op = 'INSERT' then
    insert into public.equipos_historial (equipo_id, accion, valor_nuevo, usuario_nombre)
    values (new.id, 'Registrado', concat_ws(' ', new.tipo, new.marca, new.modelo), quien);
    if coalesce(new.asignado_a, '') <> '' then
      insert into public.equipos_historial (equipo_id, accion, campo, valor_nuevo, usuario_nombre)
      values (new.id, 'Asignación', 'asignado_a', new.asignado_a, quien);
    end if;
    return new;
  end if;
  foreach c in array campos loop
    execute format('select ($1).%1$I::text, ($2).%1$I::text', c) into antes, despues using old, new;
    if antes is distinct from despues and coalesce(antes, '') <> coalesce(despues, '') then
      insert into public.equipos_historial (equipo_id, accion, campo, valor_anterior, valor_nuevo, usuario_nombre)
      values (new.id,
              case c when 'asignado_a' then case when coalesce(despues, '') = '' then 'Devolución' else 'Asignación' end
                     when 'estado' then 'Cambio de estado' else 'Edición' end,
              c, antes, despues, quien);
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_historial_equipo_ins on public.inventario_equipos;
drop trigger if exists trg_historial_equipo_upd on public.inventario_equipos;
create trigger trg_historial_equipo_ins after insert on public.inventario_equipos
  for each row execute function public.registrar_historial_equipo();
create trigger trg_historial_equipo_upd before update on public.inventario_equipos
  for each row execute function public.registrar_historial_equipo();

-- Equipos que ya existían: su registro inicial
insert into public.equipos_historial (equipo_id, accion, valor_nuevo, created_at)
select e.id, 'Registrado', concat_ws(' ', e.tipo, e.marca, e.modelo), coalesce(e.created_at, now())
from public.inventario_equipos e
where not exists (select 1 from public.equipos_historial h where h.equipo_id = e.id);


/* ───────────── 3. Reporte de IT ───────────── */

create or replace function public._fecha_texto(p text) returns date
language plpgsql immutable as $$
begin
  if p ~ '^\d{4}-\d{2}-\d{2}' then return left(p, 10)::date; end if;
  if p ~ '^\d{1,2}/\d{1,2}/\d{2}$' then return to_date(p, 'DD/MM/YY'); end if;
  if p ~ '^\d{1,2}/\d{1,2}/\d{4}$' then return to_date(p, 'DD/MM/YYYY'); end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.reporte_it(p_dias int default 90)
returns jsonb
language plpgsql stable security definer set search_path = 'public' as $$
declare hoy date := current_date; desde date; r jsonb;
begin
  if not public.app_tiene_acceso('it') then raise exception 'Sin acceso' using errcode = '42501'; end if;
  desde := case when coalesce(p_dias, 0) > 0 then hoy - p_dias else date '1900-01-01' end;

  with eq as (select * from public.inventario_equipos),
  mt as (select * from public.mantenimientos where coalesce(fecha_programada, created_at::date) >= desde),
  resol as (
    select m.id, m.tecnico, extract(epoch from (c.fecha - coalesce(i.fecha, m.created_at))) / 3600.0 as horas
    from public.mantenimientos m
    join lateral (select min(fecha) fecha from public.mantenimientos_estados where mantenimiento_id = m.id and estado = 'Completado') c on c.fecha is not null
    left join lateral (select min(fecha) fecha from public.mantenimientos_estados where mantenimiento_id = m.id) i on true
    where c.fecha::date >= desde
  ),
  lic as (select id, nombre, correo, tipo, public._fecha_texto(fecha_expiracion) vence from public.licencias_office)
  select jsonb_build_object(
    'generado', now(), 'dias', coalesce(p_dias, 0),
    'equipos', jsonb_build_object(
      'total', (select count(*) from eq),
      'por_estado', coalesce((select jsonb_object_agg(k, n) from (select coalesce(estado, 'Sin estado') k, count(*) n from eq group by 1) x), '{}'),
      'por_tipo', coalesce((select jsonb_agg(jsonb_build_object('tipo', k, 'n', n) order by n desc) from (select coalesce(nullif(tipo, ''), 'Sin tipo') k, count(*) n from eq group by 1) x), '[]'),
      'antiguedad', jsonb_build_object(
        'menos_1', (select count(*) from eq where fecha_compra > hoy - interval '1 year'),
        'de_1_a_2', (select count(*) from eq where fecha_compra <= hoy - interval '1 year' and fecha_compra > hoy - interval '2 years'),
        'de_2_a_3', (select count(*) from eq where fecha_compra <= hoy - interval '2 years' and fecha_compra > hoy - interval '3 years'),
        'de_3_a_4', (select count(*) from eq where fecha_compra <= hoy - interval '3 years' and fecha_compra > hoy - interval '4 years'),
        'mas_4', (select count(*) from eq where fecha_compra <= hoy - interval '4 years'),
        'sin_dato', (select count(*) from eq where fecha_compra is null)),
      'garantia', jsonb_build_object(
        'vigente', (select count(*) from eq where garantia_hasta > hoy + 90),
        'por_vencer_90', (select count(*) from eq where garantia_hasta between hoy and hoy + 90),
        'vencida', (select count(*) from eq where garantia_hasta < hoy),
        'sin_dato', (select count(*) from eq where garantia_hasta is null)),
      'garantias_proximas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'equipo', concat_ws(' ', tipo, marca, modelo), 'serie', numero_serie, 'asignado', asignado_a, 'vence', garantia_hasta) order by garantia_hasta)
        from eq where garantia_hasta between hoy and hoy + 90), '[]')),
    'mantenimientos', jsonb_build_object(
      'total', (select count(*) from mt),
      'por_estado', coalesce((select jsonb_object_agg(k, n) from (select coalesce(estado, 'Programado') k, count(*) n from mt group by 1) x), '{}'),
      'por_tipo', coalesce((select jsonb_object_agg(k, n) from (select coalesce(tipo, 'Sin tipo') k, count(*) n from mt group by 1) x), '{}'),
      'por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'tipo', tipo, 'n', n) order by mes) from (
         select to_char(coalesce(fecha_programada, created_at::date), 'YYYY-MM') mes, coalesce(tipo, 'Sin tipo') tipo, count(*) n from mt group by 1, 2) x), '[]'),
      'por_tecnico', coalesce((select jsonb_agg(jsonb_build_object('tecnico', k, 'total', n, 'completados', c) order by n desc) from (
         select coalesce(nullif(tecnico, ''), 'Sin asignar') k, count(*) n, count(*) filter (where estado = 'Completado') c from mt group by 1) x), '[]'),
      'resolucion_horas', (select round(avg(horas)::numeric, 1) from resol),
      'resolucion_por_tecnico', coalesce((select jsonb_agg(jsonb_build_object('tecnico', k, 'horas', h, 'n', n) order by h) from (
         select coalesce(nullif(tecnico, ''), 'Sin asignar') k, round(avg(horas)::numeric, 1) h, count(*) n from resol group by 1) x), '[]'),
      'vencidos', (select count(*) from public.mantenimientos where estado in ('Programado', 'En proceso') and fecha_programada < hoy)),
    'licencias', jsonb_build_object(
      'total', (select count(*) from lic),
      'sin_fecha', (select count(*) from lic where vence is null),
      'vencidas', (select count(*) from lic where vence < hoy),
      'vencen_30', (select count(*) from lic where vence between hoy and hoy + 30),
      'vencen_60', (select count(*) from lic where vence between hoy + 31 and hoy + 60),
      'vencen_90', (select count(*) from lic where vence between hoy + 61 and hoy + 90),
      'proximas', coalesce((select jsonb_agg(jsonb_build_object('nombre', nombre, 'correo', correo, 'tipo', tipo, 'vence', vence) order by vence)
        from lic where vence between hoy - 30 and hoy + 90), '[]'))
  ) into r;
  return r;
end $$;
revoke execute on function public.reporte_it(int) from public;
grant execute on function public.reporte_it(int) to anon, authenticated;
