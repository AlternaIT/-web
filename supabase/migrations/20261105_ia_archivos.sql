-- Alterna IA — almacenamiento de los archivos que crea la IA (PowerPoint, Word, Excel, PDF, CSV, texto).
-- Público como ia-imagenes: cada archivo vive en una ruta con UUID imposible de adivinar
-- (<usuario>/<uuid>/<nombre>). Solo la función alterna-ai (service role) escribe aquí.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ia-archivos', 'ia-archivos', true, 26214400, array[
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf', 'text/csv', 'text/plain', 'application/zip'
])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
