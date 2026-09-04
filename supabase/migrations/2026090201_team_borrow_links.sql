-- "Vinculación" entre equipos: qué equipo puede convocar/entrenar jugadores
-- de qué otro equipo (ej: Junior A puede subir jugadores de Cadete X; el
-- Junior B, de división más baja, puede subir al Junior A, pero no al
-- revés). Se configura manualmente por el director, equipo a equipo — no
-- se infiere de la categoría, porque no todos los equipos de una categoría
-- alimentan a los mismos equipos de la categoría superior, ni deben
-- mezclarse géneros por error.

create table if not exists team_borrow_links (
  id uuid primary key default gen_random_uuid(),
  from_team_id uuid references teams(id) on delete cascade not null, -- puede convocar jugadores de...
  to_team_id uuid references teams(id) on delete cascade not null,   -- ...este equipo
  created_at timestamptz not null default now(),
  unique(from_team_id, to_team_id),
  check (from_team_id <> to_team_id)
);

alter table team_borrow_links enable row level security;

drop policy if exists "team_borrow_links_select" on team_borrow_links;
drop policy if exists "team_borrow_links_insert" on team_borrow_links;
drop policy if exists "team_borrow_links_update" on team_borrow_links;
drop policy if exists "team_borrow_links_delete" on team_borrow_links;

create policy "team_borrow_links_select" on team_borrow_links for select to authenticated
  using (get_my_role() = 'director' or is_team_member(from_team_id));
create policy "team_borrow_links_insert" on team_borrow_links for insert to authenticated
  with check (get_my_role() = 'director');
create policy "team_borrow_links_update" on team_borrow_links for update to authenticated
  using (get_my_role() = 'director');
create policy "team_borrow_links_delete" on team_borrow_links for delete to authenticated
  using (get_my_role() = 'director');

-- ¿Puede este entrenador ver/convocar jugadores de _team_id porque entrena
-- un equipo que tiene un vínculo activo hacia él (es "cantera" suya)?
create or replace function public.can_borrow_from(_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_borrow_links tbl
    where tbl.to_team_id = _team_id and is_team_member(tbl.from_team_id)
  );
$$;

-- Jugadores: además de los de tu propio equipo, ves los de equipos que te
-- han vinculado como cantera (para poder convocarlos/entrenarlos). De paso
-- se actualiza a is_team_member() — el check anterior (teams.coach_id)
-- no contemplaba entrenadores asignados vía team_coaches.
drop policy if exists "players_select" on players;
drop policy if exists "players_all" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;
drop policy if exists "players_delete" on players;

create policy "players_select" on players for select to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director' or can_borrow_from(team_id));
create policy "players_insert" on players for insert to authenticated
  with check (is_team_member(team_id) or get_my_role() = 'director');
create policy "players_update" on players for update to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');
create policy "players_delete" on players for delete to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

-- Asistencia: se sigue comprobando solo el equipo de la fila (quién pasa
-- lista), no el equipo "de origen" del jugador — así un entrenador puede
-- registrar la asistencia de un jugador invitado bajo SU equipo sin
-- necesitar más permisos. Se actualiza a is_team_member() de paso.
drop policy if exists "attendance_all" on attendance;
drop policy if exists "attendance_select" on attendance;
drop policy if exists "attendance_insert" on attendance;
drop policy if exists "attendance_update" on attendance;
drop policy if exists "attendance_delete" on attendance;

create policy "attendance_select" on attendance for select to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');
create policy "attendance_insert" on attendance for insert to authenticated
  with check (is_team_member(team_id) or get_my_role() = 'director');
create policy "attendance_update" on attendance for update to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');
create policy "attendance_delete" on attendance for delete to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

-- La clave de la asistencia era (jugador, fecha) sin diferenciar equipo: si
-- un jugador es convocado por otro equipo el mismo día que entrena con el
-- suyo, un registro pisaba al otro. Se añade el equipo (y el tipo) a la
-- clave para que cada equipo tenga su propio registro de ese día.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'attendance'::regclass and contype = 'u'
  loop
    execute format('alter table attendance drop constraint %I', c.conname);
  end loop;
end $$;

alter table attendance add constraint attendance_player_date_type_team_key unique (player_id, date, type, team_id);
