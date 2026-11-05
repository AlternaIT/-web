-- Alterna — ubicación más fiable sin pedir permiso.
-- La IP falla con Starlink, VPN o datos móviles (sale por otro país). El país se toma de la zona
-- horaria del dispositivo; departamento y ciudad solo de la IP cuando coincide el país y la conexión
-- no es satelital. ubicacion_fuente: 'ip' | 'zona_horaria'.
alter table public.inicios_sesion add column if not exists zona_horaria     text;
alter table public.inicios_sesion add column if not exists proveedor        text;
alter table public.inicios_sesion add column if not exists ubicacion_fuente text;

drop function if exists public.panel_usuarios();
create function public.panel_usuarios()
 returns table(usuario_id bigint, en_linea boolean, ultima_actividad timestamptz, sesiones integer,
               ultimo_inicio timestamptz, ip text, pais_codigo text, pais text, region text, ciudad text,
               dispositivo text, sistema text, navegador text, proveedor text, ubicacion_fuente text, zona_horaria text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  if not public.app_es_admin() then raise exception 'Solo un administrador puede ver el panel de usuarios'; end if;
  return query
    select u.id,
           coalesce(s.ult > now() - interval '2 minutes', false),
           s.ult, coalesce(s.n, 0),
           i.created_at, i.ip, i.pais_codigo, i.pais, i.region, i.ciudad, i.dispositivo, i.sistema, i.navegador,
           i.proveedor, i.ubicacion_fuente, i.zona_horaria
      from public.usuarios u
      left join lateral (select max(x.ultima_actividad) ult, count(*)::int n from public.sesiones_app x
                          where x.usuario_id = u.id and x.expira > now()) s on true
      left join lateral (select * from public.inicios_sesion y where y.usuario_id = u.id
                          order by y.created_at desc limit 1) i on true;
end
$$;

drop function if exists public.historial_inicios(bigint, integer);
create function public.historial_inicios(p_usuario_id bigint, p_limite integer default 10)
 returns table(created_at timestamptz, via text, ip text, pais_codigo text, pais text, region text, ciudad text,
               dispositivo text, sistema text, navegador text, activa boolean,
               proveedor text, ubicacion_fuente text, zona_horaria text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  if not public.app_es_admin() then raise exception 'Solo un administrador puede ver el historial'; end if;
  return query
    select i.created_at, i.via, i.ip, i.pais_codigo, i.pais, i.region, i.ciudad, i.dispositivo, i.sistema, i.navegador,
           exists (select 1 from public.sesiones_app s where s.inicio_id = i.id and s.expira > now()),
           i.proveedor, i.ubicacion_fuente, i.zona_horaria
      from public.inicios_sesion i
     where i.usuario_id = p_usuario_id
     order by i.created_at desc
     limit least(greatest(coalesce(p_limite, 10), 1), 50);
end
$$;

revoke all on function public.panel_usuarios()                  from public;
revoke all on function public.historial_inicios(bigint, integer) from public;
grant execute on function public.panel_usuarios()                  to anon, authenticated;
grant execute on function public.historial_inicios(bigint, integer) to anon, authenticated;
