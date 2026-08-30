-- ============================================
-- Arregla el mismo problema de RLS en cascada que ya vimos en Documentos,
-- esta vez en Entrenamientos:
--
--   - training_sessions comprueba la pertenencia al equipo con un EXISTS
--     anidado a teams/team_coaches (en vez de usar is_team_member()).
--   - training_exercises simplemente comprueba "existe una fila en
--     training_sessions con este id", delegando por completo en el RLS
--     de training_sessions -- es decir, DOS niveles de cascada.
--
-- Segun como este vinculada una entrenadora a su equipo (coach_id directo
-- de la tabla teams, o via team_coaches), esa cascada puede bloquear
-- silenciosamente sus inserts/updates de sesiones y ejercicios.
--
-- Reutiliza is_team_member() (ya creada para Documentos) y anade dos
-- funciones SECURITY DEFINER mas para resolver el acceso a una sesion
-- concreta sin pasar por su propio RLS.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

create or replace function public.can_view_session(_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from training_sessions ts
    where ts.id = _session_id and (ts.shared = true or is_team_member(ts.team_id))
  );
$$;

create or replace function public.can_edit_session(_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from training_sessions ts
    where ts.id = _session_id and is_team_member(ts.team_id)
  );
$$;

-- ── training_sessions: pertenencia al equipo via is_team_member(),
-- sin el EXISTS anidado a teams/team_coaches ──
drop policy if exists "training_sessions_select" on training_sessions;
create policy "training_sessions_select" on training_sessions for select to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "training_sessions_insert" on training_sessions;
create policy "training_sessions_insert" on training_sessions for insert to authenticated
  with check (is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "training_sessions_update" on training_sessions;
create policy "training_sessions_update" on training_sessions for update to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "training_sessions_delete" on training_sessions;
create policy "training_sessions_delete" on training_sessions for delete to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

-- ── training_exercises: usa can_view_session()/can_edit_session()
-- directamente, sin depender del RLS de training_sessions ──
drop policy if exists "training_exercises_select" on training_exercises;
create policy "training_exercises_select" on training_exercises for select to authenticated
  using (can_view_session(session_id) or get_my_role() = 'director');

drop policy if exists "training_exercises_insert" on training_exercises;
create policy "training_exercises_insert" on training_exercises for insert to authenticated
  with check (can_edit_session(session_id) or get_my_role() = 'director');

drop policy if exists "training_exercises_update" on training_exercises;
create policy "training_exercises_update" on training_exercises for update to authenticated
  using (can_edit_session(session_id) or get_my_role() = 'director');

drop policy if exists "training_exercises_delete" on training_exercises;
create policy "training_exercises_delete" on training_exercises for delete to authenticated
  using (can_edit_session(session_id) or get_my_role() = 'director');
