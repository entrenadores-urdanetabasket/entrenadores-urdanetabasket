-- Sistema de cumplimiento con bloqueo de perfil.
--
-- Regla: si un entrenador acumula `max_missed` días (por defecto 2) sin completar el sistema
-- (sesión de entrenamiento + asistencia) dentro de los últimos `window_days` (30), su perfil se
-- bloquea. Para desbloquearlo crea un entrenamiento con al menos `min_exercises` ejercicios (5),
-- lo envía a revisión y el director lo acepta.
--
-- Los bloqueos los crea el servidor (service role) al evaluar el cumplimiento. Los entrenadores solo
-- pueden leer los suyos y enviar la recuperación mediante submit_recovery(); el director revisa con
-- review_block(). Ninguna política permite insertar/actualizar directamente desde el cliente.

-- Algunas instalaciones antiguas no tenían created_at en training_sessions; se necesita para saber
-- si el entrenamiento de recuperación se creó DESPUÉS del bloqueo.
alter table training_sessions add column if not exists created_at timestamptz not null default now();

-- ── Ajustes del sistema (una sola fila) ────────────────────────────────────────────────────────
create table if not exists compliance_settings (
  id            int primary key default 1 check (id = 1),
  enabled       boolean not null default true,
  start_date    date    not null default '2026-11-30',  -- los fallos anteriores a esta fecha no cuentan
  max_missed    int     not null default 2,
  window_days   int     not null default 30,
  min_exercises int     not null default 5
);
insert into compliance_settings (id) values (1) on conflict (id) do nothing;

alter table compliance_settings enable row level security;
drop policy if exists compliance_settings_read on compliance_settings;
create policy compliance_settings_read on compliance_settings for select using (auth.uid() is not null);
drop policy if exists compliance_settings_write on compliance_settings;
create policy compliance_settings_write on compliance_settings for all
  using (public.get_my_role() = 'director') with check (public.get_my_role() = 'director');

-- ── Bloqueos ────────────────────────────────────────────────────────────────────────────────────
create table if not exists coach_blocks (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id) on delete cascade,
  status              text not null default 'blocked' check (status in ('blocked', 'review', 'cleared')),
  missed_dates        jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  recovery_session_id uuid references training_sessions(id) on delete set null,
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  reviewed_by         uuid references profiles(id) on delete set null,
  review_note         text,
  rejected_count      int not null default 0
);
create index if not exists coach_blocks_coach_idx on coach_blocks (coach_id, status);

alter table coach_blocks enable row level security;
drop policy if exists coach_blocks_select on coach_blocks;
create policy coach_blocks_select on coach_blocks for select
  using (coach_id = auth.uid() or public.get_my_role() = 'director');

-- ── El entrenador envía su entrenamiento de recuperación ──────────────────────────────────────
create or replace function public.submit_recovery(p_block uuid, p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b      coach_blocks%rowtype;
  s      record;
  n      int;
  minex  int;
begin
  select * into b from coach_blocks where id = p_block;
  if b.id is null or b.coach_id <> auth.uid() then
    raise exception 'Bloqueo no encontrado';
  end if;
  if b.status <> 'blocked' then
    raise exception 'Este bloqueo no admite envíos ahora mismo';
  end if;

  select id, created_by, created_at into s from training_sessions where id = p_session;
  if s.id is null or s.created_by is distinct from auth.uid() then
    raise exception 'Solo puedes enviar entrenamientos creados por ti';
  end if;
  if s.created_at < b.created_at then
    raise exception 'El entrenamiento debe crearse después de que se bloqueara tu perfil';
  end if;

  select coalesce(min_exercises, 5) into minex from compliance_settings where id = 1;
  select count(*) into n from training_exercises where session_id = p_session;
  if n < minex then
    raise exception 'El entrenamiento necesita al menos % ejercicios (ahora tiene %)', minex, n;
  end if;

  update coach_blocks
     set status = 'review', recovery_session_id = p_session, submitted_at = now(), review_note = null
   where id = p_block;
end;
$$;
grant execute on function public.submit_recovery(uuid, uuid) to authenticated;

-- ── El director acepta o rechaza ────────────────────────────────────────────────────────────────
create or replace function public.review_block(p_block uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'director' then
    raise exception 'Solo el director puede revisar bloqueos';
  end if;

  if p_approve then
    update coach_blocks
       set status = 'cleared', reviewed_at = now(), reviewed_by = auth.uid(), review_note = p_note
     where id = p_block and status in ('blocked', 'review');
  else
    update coach_blocks
       set status = 'blocked', reviewed_at = now(), reviewed_by = auth.uid(),
           review_note = coalesce(nullif(p_note, ''), 'Entrenamiento rechazado'),
           recovery_session_id = null, rejected_count = rejected_count + 1
     where id = p_block and status = 'review';
  end if;
end;
$$;
grant execute on function public.review_block(uuid, boolean, text) to authenticated;
