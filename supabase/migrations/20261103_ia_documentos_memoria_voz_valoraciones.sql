-- Alterna IA: documentos adjuntos, memoria e instrucciones personales, voz y calificación de respuestas.
-- Todas las tablas se usan solo desde la Edge Function (service role): RLS activo y sin políticas.

/* ── Documentos adjuntos (el texto se extrae en el navegador y se guarda aquí) ── */
create table if not exists public.ia_documentos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      bigint not null references public.usuarios(id) on delete cascade,
  conversacion_id uuid references public.ia_conversaciones(id) on delete cascade,
  nombre          text not null,
  tipo            text not null,
  paginas         integer,
  caracteres      integer not null default 0,
  texto           text not null,
  created_at      timestamptz not null default now()
);
create index if not exists ia_documentos_conv on public.ia_documentos (conversacion_id);
create index if not exists ia_documentos_usuario on public.ia_documentos (usuario_id, created_at desc);

/* ── Perfil: lo que la IA debe saber de la persona y cómo quiere que responda ── */
create table if not exists public.ia_perfil (
  usuario_id     bigint primary key references public.usuarios(id) on delete cascade,
  sobre_mi       text not null default '',
  instrucciones  text not null default '',
  memoria_activa boolean not null default true,
  updated_at     timestamptz not null default now()
);

/* ── Memoria: datos que la persona pidió recordar (o que la IA guardó por ser útiles) ── */
create table if not exists public.ia_memorias (
  id         bigint generated always as identity primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists ia_memorias_usuario on public.ia_memorias (usuario_id, created_at);

/* ── Calificación de respuestas (👍 / 👎) ── */
alter table public.ia_mensajes add column if not exists modelo text;
alter table public.ia_mensajes add column if not exists nivel text;

create table if not exists public.ia_valoraciones (
  id              bigint generated always as identity primary key,
  usuario_id      bigint not null references public.usuarios(id) on delete cascade,
  conversacion_id uuid not null references public.ia_conversaciones(id) on delete cascade,
  mensaje_id      bigint not null unique references public.ia_mensajes(id) on delete cascade,
  valor           smallint not null check (valor in (-1, 1)),
  motivo          text,
  comentario      text,
  modelo          text,
  nivel           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ia_valoraciones_fecha on public.ia_valoraciones (created_at desc);
create index if not exists ia_valoraciones_conv on public.ia_valoraciones (conversacion_id);

/* ── Uso: dictado y lectura en voz alta también consumen la cuota ── */
alter table public.ia_uso drop constraint if exists ia_uso_tipo_check;
alter table public.ia_uso add constraint ia_uso_tipo_check check (tipo in ('mensaje', 'imagen', 'voz'));

alter table public.ia_documentos   enable row level security;
alter table public.ia_perfil       enable row level security;
alter table public.ia_memorias     enable row level security;
alter table public.ia_valoraciones enable row level security;
revoke all on public.ia_documentos, public.ia_perfil, public.ia_memorias, public.ia_valoraciones from anon, authenticated;
