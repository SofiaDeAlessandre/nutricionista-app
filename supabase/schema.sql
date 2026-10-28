-- ============================================================================
-- Florencia Meccico - Nutrición · esquema de base de datos
-- Pegar esto entero en Supabase → SQL Editor → New query → Run
-- ============================================================================

-- ---------- STAFF (nutricionistas) ----------
-- Por ahora solo Florencia, pero queda como tabla por si mañana se suma alguien más.
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'Florencia'
);

-- ---------- PACIENTES ----------
create table if not exists public.pacientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  iniciales text not null,
  genero text not null check (genero in ('M', 'F')),
  email text not null,
  acceso text not null default 'invitado' check (acceso in ('invitado', 'activo', 'inactivo')),
  plan jsonb not null default '{"desayuno":"","colacion":"","almuerzo":"","merienda":"","cena":""}',
  log jsonb not null default '{"desayuno":null,"colacion":null,"almuerzo":null,"merienda":null,"cena":null}',
  history jsonb not null default '{}',
  medidas jsonb not null default '[]',
  historia_clinica text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- TURNOS ----------
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  fecha date not null,
  hora time not null,
  motivo text default '',
  avisar boolean not null default true,
  tipo text check (tipo in ('primera', 'control')),
  created_at timestamptz not null default now()
);

create index if not exists turnos_paciente_idx on public.turnos (paciente_id);
create index if not exists turnos_fecha_idx on public.turnos (fecha);

-- ============================================================================
-- Helper: ¿el usuario logueado es staff (Florencia)?
-- security definer para poder consultar la tabla staff sin depender de RLS.
-- ============================================================================
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff where id = auth.uid());
$$;

-- ============================================================================
-- Trigger: cuando se crea un usuario en Supabase Auth con metadata role='paciente',
-- le creamos automáticamente su fila en "pacientes". Si es role='staff', le
-- creamos su fila en "staff". La metadata la manda la Edge Function de invitación.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'role' = 'staff' then
    insert into public.staff (id, nombre)
    values (new.id, coalesce(new.raw_user_meta_data->>'nombre', 'Florencia'))
    on conflict (id) do nothing;
  else
    insert into public.pacientes (id, nombre, iniciales, genero, email, acceso)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nombre', new.email),
      coalesce(new.raw_user_meta_data->>'iniciales', upper(left(new.email, 2))),
      coalesce(new.raw_user_meta_data->>'genero', 'F'),
      new.email,
      'invitado'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Cuando el paciente confirma su cuenta (pone su propia contraseña / hace login
-- por primera vez), pasa de "invitado" a "activo".
create or replace function public.marcar_paciente_activo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update public.pacientes set acceso = 'activo' where id = new.id and acceso = 'invitado';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_first_login on auth.users;
create trigger on_auth_user_first_login
  after update on auth.users
  for each row execute procedure public.marcar_paciente_activo();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.staff enable row level security;
alter table public.pacientes enable row level security;
alter table public.turnos enable row level security;

-- staff: cada staff puede ver la lista de staff (uso interno, no crítico)
create policy "staff ve staff" on public.staff
  for select using (public.is_staff());

-- pacientes: Florencia ve y edita todo
create policy "staff accede a todos los pacientes" on public.pacientes
  for all using (public.is_staff()) with check (public.is_staff());

-- pacientes: cada paciente ve su propia ficha
create policy "paciente ve su propia ficha" on public.pacientes
  for select using (auth.uid() = id);

-- pacientes: cada paciente puede actualizar su propio registro del día (log)
-- Nota: por simplicidad esta policy permite actualizar la fila propia en general;
-- si más adelante querés bloquear que el paciente toque su "plan" o su
-- "historia_clinica" directamente, avisame y lo pasamos a una función RPC
-- que solo permita tocar la columna "log".
create policy "paciente actualiza su propio registro" on public.pacientes
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- turnos: Florencia ve y administra todos los turnos
create policy "staff accede a todos los turnos" on public.turnos
  for all using (public.is_staff()) with check (public.is_staff());

-- turnos: cada paciente ve solo sus propios turnos (no los puede crear/borrar,
-- eso lo hace Florencia desde la ficha)
create policy "paciente ve sus propios turnos" on public.turnos
  for select using (auth.uid() = paciente_id);

-- ============================================================================
-- Alta de Florencia como staff
-- ============================================================================
-- 1) Andá a Authentication → Users → Add user (o Invite) y creá el usuario de
--    Florencia con su email real.
-- 2) Copiá el UUID que le asignó Supabase (columna "id" de ese usuario) y
--    reemplazalo acá abajo, después ejecutá esta línea sola:
--
-- insert into public.staff (id, nombre) values ('PEGAR-UUID-DE-FLORENCIA-ACA', 'Florencia');

-- ============================================================================
-- Ingresos: valores por mes (primera consulta, control y % de la nutricionista)
-- ============================================================================
create table if not exists public.config_ingresos (
  mes date primary key,
  valor_consulta numeric not null check (valor_consulta >= 0),
  valor_control numeric not null check (valor_control >= 0),
  porcentaje numeric not null check (porcentaje >= 0 and porcentaje <= 100),
  created_at timestamptz not null default now()
);
alter table public.config_ingresos enable row level security;
create policy "staff accede a config_ingresos" on public.config_ingresos
  for all using (public.is_staff()) with check (public.is_staff());

-- ============================================================================
-- Planes de alimentación como archivos (ver agregar_planes_archivos.sql)
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

-- ============================================================================
-- Reportes de mediciones compartidos con el paciente (ver agregar_reportes_mediciones.sql)
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

-- ============================================================================
-- Consultas realizadas (primera consulta o control) — base del reporte de ingresos
-- (ver agregar_consultas.sql)
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

-- ============================================================================
-- Mediciones compartidas con el paciente (ver agregar_mediciones_compartidas.sql)
-- ============================================================================
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

-- ============================================================================
-- Confidencialidad: datos clínicos solo para la nutricionista (ver proteger_datos_clinicos.sql)
-- ============================================================================
create table if not exists public.datos_clinicos (
  paciente_id uuid primary key references public.pacientes(id) on delete cascade,
  medidas jsonb not null default '[]'::jsonb,
  historia_clinica text not null default ''
);

alter table public.datos_clinicos enable row level security;

drop policy if exists "staff accede a datos clinicos" on public.datos_clinicos;
create policy "staff accede a datos clinicos" on public.datos_clinicos
  for all using (public.is_staff()) with check (public.is_staff());
-- (sin política para pacientes: no pueden ver ni una fila)

-- Migración: copiar lo existente y vaciar las columnas legibles por el paciente.
insert into public.datos_clinicos (paciente_id, medidas, historia_clinica)
select id, coalesce(medidas, '[]'::jsonb), coalesce(historia_clinica, '')
from public.pacientes
on conflict (paciente_id) do nothing;

update public.pacientes p
set medidas = '[]'::jsonb, historia_clinica = ''
where exists (select 1 from public.datos_clinicos d where d.paciente_id = p.id)
  and (p.medidas <> '[]'::jsonb or p.historia_clinica <> '');

-- Un paciente solo puede cambiar "log" e "history" de su propia fila.
create or replace function public.proteger_ficha_paciente()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_staff() then
    if (new.id, new.nombre, new.iniciales, new.genero, new.email, new.acceso, new.plan, new.medidas, new.historia_clinica, new.created_at)
       is distinct from
       (old.id, old.nombre, old.iniciales, old.genero, old.email, old.acceso, old.plan, old.medidas, old.historia_clinica, old.created_at) then
      raise exception 'Un paciente solo puede modificar su registro diario';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_ficha_paciente on public.pacientes;
create trigger proteger_ficha_paciente
  before update on public.pacientes
  for each row execute procedure public.proteger_ficha_paciente();
