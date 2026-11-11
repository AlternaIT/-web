-- Alterna — las sesiones vencen a la medianoche (00:00 = 12:00 a. m.) de la HORA LOCAL de la computadora
-- con la que se inició sesión, no siempre la de Guatemala.
--  • Al abrir una página con sesión, sesion.js manda la zona horaria del navegador (p. ej.
--    "America/Mexico_City", o "Etc/GMT+6" si el navegador no la conoce) a fijar_zona_sesion().
--    Se acepta UNA vez por sesión y la medianoche se cuenta desde el día en que se inició sesión:
--    no sirve para alargarla.
--  • El vencimiento se calcula con fechas en Postgres (fecha local + 1 día a las 00:00), nunca leyendo
--    horas en texto: no hay forma de confundir 12 a. m. con 12 p. m., y respeta el horario de verano.
--  • Zona desconocida o vacía → America/Guatemala, como antes.

-- Próxima medianoche (00:00) en la zona indicada
create or replace function public.medianoche_local(p_zona text) returns timestamptz
 language sql stable set search_path = public as $$
  with z as (
    select case when p_zona is not null and length(p_zona) <= 64
                 and exists (select 1 from pg_timezone_names where name = p_zona)
                then p_zona else 'America/Guatemala' end as tz
  )
  select (((now() at time zone z.tz)::date + 1)::timestamp) at time zone z.tz from z
$$;

-- Se conserva la versión sin parámetros (Guatemala) para lo que ya la usa
create or replace function public.proxima_medianoche() returns timestamptz
 language sql stable set search_path = public as $$
  select public.medianoche_local(null)
$$;

create or replace function public.sesion_expira_medianoche() returns trigger
 language plpgsql set search_path = public as $$
declare zona text;
begin
  select i.zona_horaria into zona from public.inicios_sesion i where i.id = new.inicio_id;
  new.expira := least(coalesce(new.expira, now() + interval '30 days'), public.medianoche_local(zona));
  return new;
end $$;

-- La página informa la zona horaria de la computadora (una sola vez por sesión, header x-app-token).
-- Devuelve el nuevo vencimiento, o null si la zona no es válida o la sesión ya no existe.
create or replace function public.fijar_zona_sesion(p_zona text) returns timestamptz
 language plpgsql security definer set search_path = public as $$
declare
  tok text := nullif(current_setting('request.headers', true), '')::json ->> 'x-app-token';
  s public.sesiones_app%rowtype;
  zona_guardada text;
  nueva timestamptz;
begin
  if p_zona is null or length(p_zona) > 64 or not exists (select 1 from pg_timezone_names where name = p_zona) then
    return null;
  end if;
  select * into s from public.sesiones_app where token::text = tok and expira > now();
  if not found then return null; end if;
  if s.inicio_id is null then return s.expira; end if;          -- sin registro de inicio: no se toca

  select i.zona_horaria into zona_guardada from public.inicios_sesion i where i.id = s.inicio_id;
  if zona_guardada is not null then return s.expira; end if;   -- ya se fijó: no se cambia

  -- 00:00 del día siguiente al inicio de sesión, en la hora local de esa computadora
  nueva := least(s.created_at + interval '30 days',
                 (((s.created_at at time zone p_zona)::date + 1)::timestamp) at time zone p_zona);
  update public.sesiones_app set expira = nueva where token = s.token;
  update public.inicios_sesion set zona_horaria = p_zona where id = s.inicio_id;
  return nueva;
end $$;

revoke all on function public.fijar_zona_sesion(text) from public;
grant execute on function public.fijar_zona_sesion(text) to anon, authenticated;
