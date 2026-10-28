-- ============================================================================
-- Mediciones compartidas con el paciente
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo.
-- ============================================================================

-- Una fila por paciente: la "foto" de sus mediciones que la nutricionista autorizó
-- mostrarle. Si no hay fila, el paciente no ve ninguna medición.
create table if not exists public.mediciones_compartidas (
  paciente_id uuid primary key references public.pacientes(id) on delete cascade,
  datos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mediciones_compartidas enable row level security;

-- La nutricionista crea, actualiza, ve y borra todo.
drop policy if exists "staff accede a mediciones compartidas" on public.mediciones_compartidas;
create policy "staff accede a mediciones compartidas" on public.mediciones_compartidas
  for all using (public.is_staff()) with check (public.is_staff());

-- El paciente solo puede VER lo suyo (no crear ni modificar).
drop policy if exists "paciente ve sus mediciones compartidas" on public.mediciones_compartidas;
create policy "paciente ve sus mediciones compartidas" on public.mediciones_compartidas
  for select using (auth.uid() = paciente_id);
