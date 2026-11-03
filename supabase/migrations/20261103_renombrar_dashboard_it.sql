-- Alterna — la app IT pasa de dashboard.html a it.html.
-- apps.html redirige según aplicaciones.url, así que basta con actualizar la fila.
update public.aplicaciones set url = 'it.html' where url = 'dashboard.html';
