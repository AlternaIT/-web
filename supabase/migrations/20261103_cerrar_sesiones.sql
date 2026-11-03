-- Alterna — cerrar sesiones en todos los dispositivos y bloquear usuarios.
-- sesiones_app no tiene políticas (nadie la toca desde la web); estas funciones son la única vía
-- y cada una comprueba quién llama con app_usuario_id() / app_es_admin().
-- Bloquear = usuarios.activo = false: app_usuario_id() ya no lo reconoce y no ve ningún dato;
-- además se borran sus sesiones para que las páginas abiertas lo saquen.

-- Sesiones vigentes de un usuario (admin, o el propio usuario)
create or replace function public.sesiones_activas(p_usuario_id bigint)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select case when public.app_es_admin() or p_usuario_id = public.app_usuario_id()
    then (select count(*)::int from public.sesiones_app where usuario_id = p_usuario_id and expira > now())
    else null end
$$;

-- Admin: cierra todas las sesiones de un usuario. Devuelve cuántas cerró.
create or replace function public.cerrar_sesiones_usuario(p_usuario_id bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare n integer;
begin
  if not public.app_es_admin() then raise exception 'Solo un administrador puede cerrar sesiones de otros usuarios'; end if;
  delete from public.sesiones_app where usuario_id = p_usuario_id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- Admin: bloquea o desbloquea a un usuario; al bloquear también cierra sus sesiones.
create or replace function public.bloquear_usuario(p_usuario_id bigint, p_bloquear boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not public.app_es_admin() then raise exception 'Solo un administrador puede bloquear usuarios'; end if;
  if p_bloquear and p_usuario_id = public.app_usuario_id() then raise exception 'No puedes bloquear tu propio usuario'; end if;
  update public.usuarios set activo = not p_bloquear where id = p_usuario_id;
  if p_bloquear then delete from public.sesiones_app where usuario_id = p_usuario_id; end if;
end
$$;

-- Cualquier usuario: cierra sus sesiones en los demás dispositivos (conserva la actual).
create or replace function public.cerrar_otras_sesiones()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare n integer;
begin
  delete from public.sesiones_app
   where usuario_id = public.app_usuario_id()
     and token::text <> coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-app-token', '');
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.sesiones_activas(bigint)              from public;
revoke all on function public.cerrar_sesiones_usuario(bigint)       from public;
revoke all on function public.bloquear_usuario(bigint, boolean)     from public;
revoke all on function public.cerrar_otras_sesiones()               from public;
grant execute on function public.sesiones_activas(bigint)           to anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(bigint)    to anon, authenticated;
grant execute on function public.bloquear_usuario(bigint, boolean)  to anon, authenticated;
grant execute on function public.cerrar_otras_sesiones()            to anon, authenticated;
