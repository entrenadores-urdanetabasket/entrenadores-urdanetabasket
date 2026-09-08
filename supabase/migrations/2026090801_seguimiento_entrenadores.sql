-- Seguimiento de cumplimiento de entrenadores (Panel Director):
-- horario de entrenamientos configurable por equipo + días suspendidos.

-- Días de la semana en que cada equipo entrena, usando el mismo criterio
-- que Date.getDay() en JS: 0=domingo, 1=lunes, 2=martes ... 6=sábado.
-- Por defecto martes/jueves/viernes (todos los equipos salvo excepciones
-- que el director configure, p. ej. Junior Femenino 1 = martes/viernes).
alter table teams add column if not exists training_weekdays smallint[] not null default '{2,4,5}';

-- Días concretos en los que un equipo NO entrena por una razón puntual
-- (festivo, pabellón cerrado, etc.), para que ese día no cuente como
-- incumplimiento en el seguimiento. Gestionado solo por el director.
create table if not exists team_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  date date not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(team_id, date)
);

alter table team_schedule_exceptions enable row level security;

create policy "team_schedule_exceptions_select" on team_schedule_exceptions for select to authenticated
  using (get_my_role() = 'director' or is_team_member(team_id));

create policy "team_schedule_exceptions_insert" on team_schedule_exceptions for insert to authenticated
  with check (get_my_role() = 'director');

create policy "team_schedule_exceptions_update" on team_schedule_exceptions for update to authenticated
  using (get_my_role() = 'director');

create policy "team_schedule_exceptions_delete" on team_schedule_exceptions for delete to authenticated
  using (get_my_role() = 'director');
