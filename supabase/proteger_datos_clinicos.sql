-- ============================================================================
-- Confidencialidad: datos clínicos solo para la nutricionista
-- Pegar entero en Supabase → SQL Editor → New query → Run (una sola vez).
-- Es seguro correrlo de nuevo.
--
-- Qué hace:
--  1) Crea la tabla "datos_clinicos" (mediciones + historia clínica) que SOLO
--     puede leer/escribir la nutricionista. El paciente no tiene ninguna
--     política de acceso: la base de datos se lo impide.
--  2) Copia ahí lo que ya estaba cargado y vacía esas columnas en "pacientes"
--     (donde el paciente podía leerlas).
--  3) Impide que un paciente modifique su propia ficha, salvo su registro
--     diario ("log" e "history").
--
-- ORDEN: correr este SQL y recién después subir/deployar la versión nueva de la app.
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
