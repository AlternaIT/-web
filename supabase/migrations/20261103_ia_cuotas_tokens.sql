-- Alterna IA — cuotas de consumo por usuario.
-- • ia_planes: planes reutilizables (tokens por periodo, imágenes por periodo, mensajes por hora, ilimitado).
--   El periodo se restablece a una hora local fija: cada día, cada semana (día de la semana) o cada mes (día del mes).
-- • ia_cuotas: asignación por usuario con ajustes propios (límite personalizado, ilimitado, bloqueo,
--   tokens extra con vencimiento y reinicio manual del consumo).
-- • ia_cuotas_historial: auditoría de cada cambio hecho por un administrador.
-- Solo el backend (service role) lee y escribe estas tablas; el navegador pasa siempre por la Edge Function.

create table if not exists public.ia_planes (
  id              bigint generated always as identity primary key,
  nombre          text not null unique,
  descripcion     text,
  ilimitado       boolean not null default false,
  tokens_limite   bigint check (tokens_limite is null or tokens_limite >= 0),
  imagenes_limite integer check (imagenes_limite is null or imagenes_limite >= 0),
  mensajes_hora   integer check (mensajes_hora is null or mensajes_hora > 0),
  periodo         text not null default 'dia' check (periodo in ('dia', 'semana', 'mes')),
  hora_reinicio   smallint not null default 0 check (hora_reinicio between 0 and 23),
  dia_reinicio    smallint not null default 1 check (dia_reinicio between 1 and 28),  -- semana: 1 = lunes … 7 = domingo
  zona_horaria    text not null default 'America/Guatemala',
  predeterminado  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists ia_planes_un_predeterminado on public.ia_planes (predeterminado) where predeterminado;

create table if not exists public.ia_cuotas (
  usuario_id      bigint primary key references public.usuarios(id) on delete cascade,
  plan_id         bigint references public.ia_planes(id) on delete set null,
  ilimitado       boolean not null default false,
  bloqueado       boolean not null default false,
  motivo_bloqueo  text,
  tokens_limite   bigint check (tokens_limite is null or tokens_limite >= 0),   -- reemplaza el del plan
  tokens_extra    bigint not null default 0 check (tokens_extra >= 0),          -- se suma al límite del periodo
  extra_hasta     timestamptz,                                                  -- null = sin vencimiento
  reiniciado_en   timestamptz,                                                  -- reinicio manual del consumo
  notas           text,
  actualizado_por bigint references public.usuarios(id) on delete set null,
  updated_at      timestamptz not null default now()
);

create table if not exists public.ia_cuotas_historial (
  id          bigint generated always as identity primary key,
  usuario_id  bigint references public.usuarios(id) on delete cascade,
  admin_id    bigint references public.usuarios(id) on delete set null,
  accion      text not null,
  detalle     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ia_cuotas_historial_usuario on public.ia_cuotas_historial (usuario_id, created_at desc);
create index if not exists ia_uso_usuario_fecha on public.ia_uso (usuario_id, created_at desc);

alter table public.ia_planes           enable row level security;
alter table public.ia_cuotas           enable row level security;
alter table public.ia_cuotas_historial enable row level security;

-- Inicio y fin del periodo vigente, calculados en la hora local del plan.
create or replace function public.ia_periodo(p_periodo text, p_hora integer, p_dia integer, p_tz text, p_ahora timestamptz default now())
 returns table(inicio timestamptz, fin timestamptz)
 language plpgsql
 stable
 set search_path to 'public'
as $$
declare
  tz    text := coalesce(nullif(p_tz, ''), 'America/Guatemala');
  loc   timestamp;
  base  timestamp;
  paso  interval;
begin
  begin loc := p_ahora at time zone tz; exception when others then tz := 'UTC'; loc := p_ahora at time zone tz; end;
  if p_periodo = 'semana' then
    base := date_trunc('week', loc) + make_interval(days => greatest(least(coalesce(p_dia, 1), 7), 1) - 1, hours => coalesce(p_hora, 0));
    paso := interval '7 days';
  elsif p_periodo = 'mes' then
    base := date_trunc('month', loc) + make_interval(days => greatest(least(coalesce(p_dia, 1), 28), 1) - 1, hours => coalesce(p_hora, 0));
    paso := interval '1 month';
  else
    base := date_trunc('day', loc) + make_interval(hours => coalesce(p_hora, 0));
    paso := interval '1 day';
  end if;
  if base > loc then base := base - paso; end if;
  return query select base at time zone tz, (base + paso) at time zone tz;
end
$$;

-- Estado de la cuota de un usuario (o de todos si p_usuario es null). Sin plan asignado se usa el predeterminado.
create or replace function public.ia_cuota_estado(p_usuario bigint default null)
 returns table(usuario_id bigint, plan_id bigint, plan_nombre text, ilimitado boolean, bloqueado boolean, motivo_bloqueo text,
               tokens_limite bigint, tokens_extra bigint, tokens_usados bigint, tokens_restantes bigint,
               imagenes_limite integer, imagenes_usadas integer, mensajes_hora integer,
               periodo text, hora_reinicio smallint, dia_reinicio smallint, zona_horaria text,
               inicio timestamptz, reinicia_en timestamptz, personalizado boolean, extra_hasta timestamptz, notas text)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  with base as (
    select u.id uid, c.*, coalesce(p.id, d.id) pid, coalesce(p.nombre, d.nombre) pnombre,
           coalesce(p.ilimitado, d.ilimitado, false) p_ilim, coalesce(p.tokens_limite, d.tokens_limite) p_tok,
           case when p.id is not null then p.imagenes_limite else d.imagenes_limite end p_img,
           case when p.id is not null then p.mensajes_hora else d.mensajes_hora end p_mh,
           coalesce(p.periodo, d.periodo, 'dia') per, coalesce(p.hora_reinicio, d.hora_reinicio, 0::smallint) hr,
           coalesce(p.dia_reinicio, d.dia_reinicio, 1::smallint) dr, coalesce(p.zona_horaria, d.zona_horaria, 'America/Guatemala') tz
      from public.usuarios u
      left join public.ia_cuotas c on c.usuario_id = u.id
      left join public.ia_planes p on p.id = c.plan_id
      left join public.ia_planes d on d.predeterminado
     where p_usuario is null or u.id = p_usuario
  ), calc as (
    select b.*, per_.inicio pin, per_.fin pfin,
           greatest(per_.inicio, coalesce(b.reiniciado_en, '-infinity'::timestamptz)) desde,
           case when b.extra_hasta is null or b.extra_hasta > now() then coalesce(b.tokens_extra, 0) else 0 end extra,
           coalesce(b.ilimitado, false) or b.p_ilim ilim,
           coalesce(b.tokens_limite, b.p_tok) lim
      from base b, lateral public.ia_periodo(b.per, b.hr, b.dr, b.tz) per_
  )
  select c.uid, c.pid, c.pnombre, c.ilim, coalesce(c.bloqueado, false), c.motivo_bloqueo,
         case when c.ilim then null else c.lim end, c.extra::bigint,
         coalesce(x.tok, 0)::bigint,
         case when c.ilim or c.lim is null then null else greatest(c.lim + c.extra - coalesce(x.tok, 0), 0) end::bigint,
         case when c.ilim then null else c.p_img end, coalesce(x.img, 0)::int,
         case when c.ilim then null else c.p_mh end,
         c.per, c.hr, c.dr, c.tz, c.desde, c.pfin,
         (c.ilimitado or c.tokens_limite is not null or c.tokens_extra > 0 or c.bloqueado) is true, c.extra_hasta, c.notas
    from calc c
    left join lateral (
      select sum(coalesce(i.tokens_entrada, 0) + coalesce(i.tokens_salida, 0)) tok,
             count(*) filter (where i.tipo = 'imagen') img
        from public.ia_uso i
       where i.usuario_id = c.uid and i.created_at >= c.desde
    ) x on true
$$;

revoke all on function public.ia_cuota_estado(bigint) from public, anon, authenticated;
revoke all on function public.ia_periodo(text, integer, integer, text, timestamptz) from public, anon, authenticated;

-- Planes iniciales (se pueden editar o borrar desde el panel de administración de la IA).
insert into public.ia_planes (nombre, descripcion, ilimitado, tokens_limite, imagenes_limite, mensajes_hora, periodo, hora_reinicio, predeterminado) values
  ('Básico',    'Uso ocasional: consultas y redacción breve.',            false,   50000,  5, 30, 'dia', 0, false),
  ('Estándar',  'Uso diario normal de la mayoría de colaboradores.',      false,  200000, 20, 60, 'dia', 0, true),
  ('Avanzado',  'Uso intensivo: reportes largos, análisis e imágenes.',   false, 2000000, 60, 120, 'semana', 0, false),
  ('Ilimitado', 'Sin límite de tokens ni imágenes.',                      true,     null, null, null, 'dia', 0, false)
on conflict (nombre) do nothing;

-- Los administradores actuales quedan en el plan Ilimitado para que nunca se bloqueen a sí mismos.
insert into public.ia_cuotas (usuario_id, plan_id)
select u.id, p.id from public.usuarios u join public.ia_planes p on p.nombre = 'Ilimitado'
 where u.rol = 'admin'
on conflict (usuario_id) do nothing;
