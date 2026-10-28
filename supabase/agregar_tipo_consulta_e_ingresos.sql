-- ============================================================================
-- Tipo de consulta + configuración de ingresos
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo: usa "if not exists" / "drop policy if exists".
-- ============================================================================

-- 1) Cada turno puede ser 'primera' (primera consulta), 'control' o null (sin clasificar).
alter table public.turnos
  add column if not exists tipo text check (tipo in ('primera', 'control'));

-- 2) Valores por mes: precio de primera consulta, precio de control y % que se
--    queda la nutricionista. "mes" es siempre el primer día del mes.
--    Un mes sin fila propia usa la fila más reciente anterior (lo resuelve la app).
create table if not exists public.config_ingresos (
  mes date primary key,
  valor_consulta numeric not null check (valor_consulta >= 0),
  valor_control numeric not null check (valor_control >= 0),
  porcentaje numeric not null check (porcentaje >= 0 and porcentaje <= 100),
  created_at timestamptz not null default now()
);

alter table public.config_ingresos enable row level security;

-- Solo staff ve y edita esto (los pacientes no tienen ninguna policy → no acceden).
drop policy if exists "staff accede a config_ingresos" on public.config_ingresos;
create policy "staff accede a config_ingresos" on public.config_ingresos
  for all using (public.is_staff()) with check (public.is_staff());
