-- ============================================================================
-- Reportes de mediciones compartidos con el paciente
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo.
-- ============================================================================

-- Cada fila es una comparación entre dos mediciones que la nutricionista decidió
-- compartir. Se guarda una "foto" de las dos mediciones (datos), así el paciente
-- ve exactamente lo que ella autorizó aunque después edite esas mediciones.
create table if not exists public.reportes_mediciones (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  fecha_a date not null,
  fecha_b date not null,
  datos jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reportes_mediciones_paciente_idx on public.reportes_mediciones (paciente_id);

alter table public.reportes_mediciones enable row level security;

-- La nutricionista crea, ve y borra todo.
drop policy if exists "staff accede a todos los reportes" on public.reportes_mediciones;
create policy "staff accede a todos los reportes" on public.reportes_mediciones
  for all using (public.is_staff()) with check (public.is_staff());

-- El paciente solo puede VER los suyos (no puede crearlos ni modificarlos).
drop policy if exists "paciente ve sus propios reportes" on public.reportes_mediciones;
create policy "paciente ve sus propios reportes" on public.reportes_mediciones
  for select using (auth.uid() = paciente_id);
