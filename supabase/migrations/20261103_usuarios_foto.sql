-- Alterna — foto de perfil del usuario (la trae zoho-login al iniciar sesión con Zoho).
-- Se guarda como data URL (imagen pequeña en base64) para no depender de la sesión de Zoho al mostrarla.
alter table public.usuarios add column if not exists foto text;
-- usuarios usa permisos de lectura por columna (la contraseña queda oculta): la foto sí se puede leer
grant select (foto) on public.usuarios to anon, authenticated;
