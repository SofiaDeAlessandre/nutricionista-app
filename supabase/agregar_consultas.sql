-- ============================================================================
-- Consultas realizadas (primera consulta o control) — base del reporte de ingresos
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo.
-- ============================================================================

-- Una fila por consulta realizada. Máximo una por paciente y por día.
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('primera', 'control')),
  created_at timestamptz not null default now(),
  unique (paciente_id, fecha)
);

create index if not exists consultas_paciente_idx on public.consultas (paciente_id);
create index if not exists consultas_fecha_idx on public.consultas (fecha);

alter table public.consultas enable row level security;

-- Solo la nutricionista (staff) ve y edita esto; los pacientes no tienen acceso.
drop policy if exists "staff accede a consultas" on public.consultas;
create policy "staff accede a consultas" on public.consultas
  for all using (public.is_staff()) with check (public.is_staff());
