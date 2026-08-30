-- ============================================
-- Mejoras al apartado de Entrenamientos:
--   1. Categoria por ejercicio (calentamiento, tecnica, tactica, fisico, tiro...)
--   2. Biblioteca de ejercicios reutilizable, comun a todo el club (como concepts)
--   3. Plantillas de sesion de entrenamiento, por equipo
--
-- Reutiliza is_team_member() (creada en 2026081102_fix_documents_rls.sql)
-- para evitar el problema de RLS en cascada que ya tuvimos con Documentos.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

-- ── 1. Categoria de ejercicio ─────────────────────────────────────
alter table training_exercises add column if not exists category text;

-- ── 2. Biblioteca de ejercicios (comun a todo el club) ────────────
create table if not exists exercise_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration_minutes integer default 10,
  description text,
  category text,
  play_data jsonb,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table exercise_library enable row level security;

create policy "exercise_library_select" on exercise_library for select to authenticated
  using (true);

create policy "exercise_library_insert" on exercise_library for insert to authenticated
  with check (created_by = auth.uid());

create policy "exercise_library_update" on exercise_library for update to authenticated
  using (created_by = auth.uid() or get_my_role() = 'director');

create policy "exercise_library_delete" on exercise_library for delete to authenticated
  using (created_by = auth.uid() or get_my_role() = 'director');

-- ── 3. Plantillas de sesion de entrenamiento (por equipo) ─────────
create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) not null,
  title text not null,
  objectives text,
  notes text,
  duration_minutes integer default 90,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table session_templates enable row level security;

create policy "session_templates_select" on session_templates for select to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

create policy "session_templates_insert" on session_templates for insert to authenticated
  with check (is_team_member(team_id) or get_my_role() = 'director');

create policy "session_templates_update" on session_templates for update to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

create policy "session_templates_delete" on session_templates for delete to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

create table if not exists session_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references session_templates(id) on delete cascade not null,
  title text not null,
  duration_minutes integer default 10,
  description text,
  category text,
  play_data jsonb,
  order_index integer default 0
);

alter table session_template_exercises enable row level security;

create policy "session_template_exercises_select" on session_template_exercises for select to authenticated
  using (exists (
    select 1 from session_templates st where st.id = template_id and
      (is_team_member(st.team_id) or get_my_role() = 'director')
  ));

create policy "session_template_exercises_insert" on session_template_exercises for insert to authenticated
  with check (exists (
    select 1 from session_templates st where st.id = template_id and
      (is_team_member(st.team_id) or get_my_role() = 'director')
  ));

create policy "session_template_exercises_update" on session_template_exercises for update to authenticated
  using (exists (
    select 1 from session_templates st where st.id = template_id and
      (is_team_member(st.team_id) or get_my_role() = 'director')
  ));

create policy "session_template_exercises_delete" on session_template_exercises for delete to authenticated
  using (exists (
    select 1 from session_templates st where st.id = template_id and
      (is_team_member(st.team_id) or get_my_role() = 'director')
  ));
