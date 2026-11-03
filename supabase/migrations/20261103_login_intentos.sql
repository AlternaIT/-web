-- Alterna — intentos fallidos de contraseña en el login (los registra zoho-login).
-- Sirve para limitar intentos y que Zoho no bloquee la cuenta por fallos repetidos.
-- Solo la usa el servidor (service role): RLS activo y sin políticas.
create table if not exists public.login_intentos (
  id          bigserial primary key,
  correo      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_intentos_correo_fecha on public.login_intentos (correo, created_at desc);
alter table public.login_intentos enable row level security;
revoke all on public.login_intentos from anon, authenticated;
