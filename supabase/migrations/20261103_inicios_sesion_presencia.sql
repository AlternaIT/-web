-- Alterna — historial de inicios de sesión (IP, ubicación, dispositivo) y presencia en línea.
--  • inicios_sesion: una fila por cada inicio de sesión (la escribe zoho-login con service role).
--    No se borra al cerrar sesión, así el panel siempre sabe cuál fue el último.
--  • sesiones_app.ultima_actividad: la actualiza latido() mientras una página está abierta y visible.
--  • panel_usuarios() / historial_inicios(): solo admin; son la única vía de lectura.

create table if not exists public.inicios_sesion (
  id          bigserial primary key,
  usuario_id  bigint not null references public.usuarios(id) on delete cascade,
  created_at  timestamptz not null default now(),
  via         text,          -- password (contraseña de Zoho) | zoho (página de Zoho)
  ip          text,
  pais_codigo text,          -- ISO 3166 (el panel lo muestra en español)
  pais        text,
  region      text,          -- departamento / estado
  ciudad      text,
  dispositivo text,          -- PC | Celular | Tablet
  sistema     text,          -- Windows | macOS | iOS | Android | Linux | ChromeOS
  navegador   text,
  user_agent  text
);
create index if not exists inicios_sesion_usuario_fecha on public.inicios_sesion (usuario_id, created_at desc);
alter table public.inicios_sesion enable row level security;
revoke all on public.inicios_sesion from anon, authenticated;

alter table public.sesiones_app add column if not exists ultima_actividad timestamptz default now();
alter table public.sesiones_app add column if not exists inicio_id bigint references public.inicios_sesion(id) on delete set null;

-- Latido de las páginas abiertas: marca actividad y devuelve el usuario (null = sesión ya no vale)
create or replace function public.latido()
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare uid bigint := public.app_usuario_id();
begin
  if uid is not null then
    update public.sesiones_app set ultima_actividad = now()
     where token::text = (nullif(current_setting('request.headers', true), '')::json ->> 'x-app-token');
  end if;
  return uid;
end
$$;

-- Panel de usuarios (admin): último inicio de sesión y si está en línea (actividad < 2 min)
create or replace function public.panel_usuarios()
 returns table(usuario_id bigint, en_linea boolean, ultima_actividad timestamptz, sesiones integer,
               ultimo_inicio timestamptz, ip text, pais_codigo text, pais text, region text, ciudad text,
               dispositivo text, sistema text, navegador text)
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
           i.created_at, i.ip, i.pais_codigo, i.pais, i.region, i.ciudad, i.dispositivo, i.sistema, i.navegador
      from public.usuarios u
      left join lateral (select max(x.ultima_actividad) ult, count(*)::int n from public.sesiones_app x
                          where x.usuario_id = u.id and x.expira > now()) s on true
      left join lateral (select * from public.inicios_sesion y where y.usuario_id = u.id
                          order by y.created_at desc limit 1) i on true;
end
$$;

-- Últimos inicios de sesión de un usuario (admin)
create or replace function public.historial_inicios(p_usuario_id bigint, p_limite integer default 10)
 returns table(created_at timestamptz, via text, ip text, pais_codigo text, pais text, region text, ciudad text,
               dispositivo text, sistema text, navegador text, activa boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
begin
  if not public.app_es_admin() then raise exception 'Solo un administrador puede ver el historial'; end if;
  return query
    select i.created_at, i.via, i.ip, i.pais_codigo, i.pais, i.region, i.ciudad, i.dispositivo, i.sistema, i.navegador,
           exists (select 1 from public.sesiones_app s where s.inicio_id = i.id and s.expira > now())
      from public.inicios_sesion i
     where i.usuario_id = p_usuario_id
     order by i.created_at desc
     limit least(greatest(coalesce(p_limite, 10), 1), 50);
end
$$;

revoke all on function public.latido()                          from public;
revoke all on function public.panel_usuarios()                  from public;
revoke all on function public.historial_inicios(bigint, integer) from public;
grant execute on function public.latido()                          to anon, authenticated;
grant execute on function public.panel_usuarios()                  to anon, authenticated;
grant execute on function public.historial_inicios(bigint, integer) to anon, authenticated;
