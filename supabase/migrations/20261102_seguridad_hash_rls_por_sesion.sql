-- Alterna — seguridad de base de datos (PENDIENTE DE APROBACIÓN, no aplicada).
-- Qué hace:
--  1) Contraseñas de `usuarios` con bcrypt (trigger: el dashboard sigue enviando texto y la BD lo hashea).
--  2) login_usuario compara contra el hash.
--  3) Toda tabla exige una sesión válida (header x-app-token) en lugar de estar abierta a la clave pública.
--  4) El hash de contraseña nunca sale por la API (solo columnas no sensibles son legibles).
--  5) RPC para cambiar contraseña propia y para cerrar sesión.
-- IMPORTANTE: el hasheo es irreversible. Antes de aplicar, sube dashboard.js (ya preparado)
-- y avisa al equipo: tendrán que iniciar sesión de nuevo.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.hash_contrasena() returns trigger
 language plpgsql set search_path = public, extensions as $$
begin
  if new."contraseña" is not null and new."contraseña" not like '$2_$%' then
    new."contraseña" := crypt(new."contraseña", gen_salt('bf', 10));
  end if;
  return new;
end $$;

drop trigger if exists trg_hash_contrasena on public.usuarios;
create trigger trg_hash_contrasena before insert or update of "contraseña" on public.usuarios
  for each row execute function public.hash_contrasena();

update public.usuarios set "contraseña" = "contraseña" where "contraseña" not like '$2_$%';

create or replace function public.login_usuario(p_correo text, "p_contraseña" text)
 returns table(id bigint, correo text, nombre text, rol text, activo boolean, token text)
 language sql security definer set search_path to 'public'
as $$
  with u as (
    select u.id, u.correo, u.nombre, u.rol, u.activo
    from public.usuarios u
    where lower(u.correo) = lower(p_correo)
      and u."contraseña" = extensions.crypt(p_contraseña, u."contraseña")
      and u.activo = true
    limit 1
  ), s as (
    insert into public.sesiones_app (usuario_id) select u.id from u returning token
  )
  select u.id, u.correo, u.nombre, u.rol, u.activo, s.token::text from u, s;
$$;

create or replace function public.app_usuario_id() returns bigint
 language sql stable security definer set search_path = public as $$
  select s.usuario_id from public.sesiones_app s join public.usuarios u on u.id = s.usuario_id
  where u.activo is true and s.expira > now()
    and s.token::text = (nullif(current_setting('request.headers', true), '')::json ->> 'x-app-token')
  limit 1
$$;

create or replace function public.app_es_admin() returns boolean
 language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where id = public.app_usuario_id() and rol = 'admin')
$$;

create or replace function public.cambiar_contrasena(p_actual text, p_nueva text) returns boolean
 language plpgsql security definer set search_path = public, extensions as $$
declare uid bigint := public.app_usuario_id();
begin
  if uid is null or length(coalesce(p_nueva, '')) < 8 then return false; end if;
  update public.usuarios set "contraseña" = p_nueva
   where id = uid and "contraseña" = crypt(p_actual, "contraseña");
  return found;
end $$;

create or replace function public.cerrar_sesion() returns void
 language sql security definer set search_path = public as $$
  delete from public.sesiones_app
   where token::text = (nullif(current_setting('request.headers', true), '')::json ->> 'x-app-token')
$$;

grant execute on function public.login_usuario(text, text), public.app_usuario_id(), public.app_es_admin(),
  public.cambiar_contrasena(text, text), public.cerrar_sesion() to anon, authenticated;

do $$
declare t text; pol record;
begin
  foreach t in array array['actividades','historial_actividades','licencias_office','computadoras','mantenimientos','usuarios'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select polname from pg_policy where polrelid = ('public.' || t)::regclass loop
      execute format('drop policy %I on public.%I', pol.polname, t);
    end loop;
    if t = 'usuarios' then
      execute 'create policy usuarios_select on public.usuarios for select to anon, authenticated using ((select public.app_usuario_id()) is not null)';
      execute 'create policy usuarios_insert on public.usuarios for insert to anon, authenticated with check ((select public.app_es_admin()))';
      execute 'create policy usuarios_update on public.usuarios for update to anon, authenticated using ((select public.app_es_admin())) with check ((select public.app_es_admin()))';
      execute 'create policy usuarios_delete on public.usuarios for delete to anon, authenticated using ((select public.app_es_admin()))';
    else
      execute format('create policy sesion_app on public.%I for all to anon, authenticated using ((select public.app_usuario_id()) is not null) with check ((select public.app_usuario_id()) is not null)', t);
    end if;
  end loop;
end $$;

revoke select on public.usuarios from anon, authenticated;
grant select (id, correo, nombre, rol, activo, created_at) on public.usuarios to anon, authenticated;
