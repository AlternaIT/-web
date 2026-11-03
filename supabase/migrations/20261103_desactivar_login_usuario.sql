-- Alterna — el login ya es con la cuenta de Zoho (función zoho-login).
-- La contraseña propia de la app deja de servir: nadie puede llamar a login_usuario.
-- (Se deja la función por si hay que volver atrás: basta con volver a dar el permiso.)
revoke execute on function public.login_usuario(text, text) from anon, authenticated, public;
