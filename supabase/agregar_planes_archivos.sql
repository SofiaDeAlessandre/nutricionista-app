-- ============================================================================
-- Planes de alimentación como archivos (PDF, Word o imagen)
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo.
-- ============================================================================

-- 1) Tabla: un registro por archivo, con la fecha del plan que elige la nutricionista.
create table if not exists public.planes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  fecha date not null,
  nombre_archivo text not null,
  ruta text not null,
  tipo text default '',
  tamano bigint default 0,
  created_at timestamptz not null default now()
);

create index if not exists planes_paciente_idx on public.planes (paciente_id);

alter table public.planes enable row level security;

drop policy if exists "staff accede a todos los planes" on public.planes;
create policy "staff accede a todos los planes" on public.planes
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "paciente ve sus propios planes" on public.planes;
create policy "paciente ve sus propios planes" on public.planes
  for select using (auth.uid() = paciente_id);

-- 2) Bucket privado para los archivos (máx. 15 MB; PDF, Word, JPG, PNG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planes', 'planes', false, 15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) Permisos sobre los archivos: la nutricionista sube, ve y borra todo;
--    cada paciente solo puede descargar lo que está en su propia carpeta.
drop policy if exists "staff gestiona archivos de planes" on storage.objects;
create policy "staff gestiona archivos de planes" on storage.objects
  for all using (bucket_id = 'planes' and public.is_staff())
  with check (bucket_id = 'planes' and public.is_staff());

drop policy if exists "paciente descarga sus planes" on storage.objects;
create policy "paciente descarga sus planes" on storage.objects
  for select using (
    bucket_id = 'planes' and (storage.foldername(name))[1] = auth.uid()::text
  );
