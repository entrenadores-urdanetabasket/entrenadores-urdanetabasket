-- Valoración de entrenamientos al marcarlos como completados: nota general
-- de la sesión y nota por jugador presente (según la asistencia de ese día).
-- Es privada: solo la ve el entrenador que creó la sesión, o el director.

create or replace function public.owns_session(_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from training_sessions ts
    where ts.id = _session_id and ts.created_by = auth.uid()
  );
$$;

create table if not exists training_session_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references training_sessions(id) on delete cascade not null unique,
  rating smallint not null check (rating between 1 and 5),
  notes text,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table training_session_ratings enable row level security;

drop policy if exists "training_session_ratings_select" on training_session_ratings;
drop policy if exists "training_session_ratings_insert" on training_session_ratings;
drop policy if exists "training_session_ratings_update" on training_session_ratings;
drop policy if exists "training_session_ratings_delete" on training_session_ratings;

create policy "training_session_ratings_select" on training_session_ratings for select to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');
create policy "training_session_ratings_insert" on training_session_ratings for insert to authenticated
  with check (owns_session(session_id) or get_my_role() = 'director');
create policy "training_session_ratings_update" on training_session_ratings for update to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');
create policy "training_session_ratings_delete" on training_session_ratings for delete to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');

create table if not exists training_player_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references training_sessions(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, player_id)
);

alter table training_player_ratings enable row level security;

drop policy if exists "training_player_ratings_select" on training_player_ratings;
drop policy if exists "training_player_ratings_insert" on training_player_ratings;
drop policy if exists "training_player_ratings_update" on training_player_ratings;
drop policy if exists "training_player_ratings_delete" on training_player_ratings;

create policy "training_player_ratings_select" on training_player_ratings for select to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');
create policy "training_player_ratings_insert" on training_player_ratings for insert to authenticated
  with check (owns_session(session_id) or get_my_role() = 'director');
create policy "training_player_ratings_update" on training_player_ratings for update to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');
create policy "training_player_ratings_delete" on training_player_ratings for delete to authenticated
  using (owns_session(session_id) or get_my_role() = 'director');
