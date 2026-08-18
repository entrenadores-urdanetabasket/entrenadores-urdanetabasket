-- ============================================
-- Documentos: cada entrenador sube archivos a su equipo y puede
-- compartirlos con el resto del club (mismo patron que tacticas/
-- entrenamientos). Usa un bucket de Storage privado, servido por RLS.
--
-- Conceptos: biblioteca comun del club (ofensivos/defensivos), sin
-- equipo asociado, visible para todos los entrenadores y el director.
-- Reutiliza el mismo play_data (steps) que ya usan tactics/
-- training_exercises para dibujar en CourtEditor.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

-- ── Storage: bucket privado para documentos ──────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ── Tabla documents ───────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) not null,
  uploaded_by uuid references profiles(id) not null,
  title text not null,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  file_type text,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;

create policy "documents_select" on documents for select to authenticated
  using (
    shared = true
    or exists (
      select 1 from teams t where t.id = documents.team_id and
        (t.coach_id = auth.uid() or exists (
          select 1 from team_coaches tc where tc.team_id = t.id and tc.coach_id = auth.uid()
        ))
    )
    or get_my_role() = 'director'
  );

create policy "documents_insert" on documents for insert to authenticated
  with check (
    exists (
      select 1 from teams t where t.id = documents.team_id and
        (t.coach_id = auth.uid() or exists (
          select 1 from team_coaches tc where tc.team_id = t.id and tc.coach_id = auth.uid()
        ))
    )
    or get_my_role() = 'director'
  );

create policy "documents_update" on documents for update to authenticated
  using (uploaded_by = auth.uid() or get_my_role() = 'director');

create policy "documents_delete" on documents for delete to authenticated
  using (uploaded_by = auth.uid() or get_my_role() = 'director');

-- ── Politicas de storage.objects para el bucket "documents" ───────
-- La ruta de cada archivo empieza por "{team_id}/...", asi que
-- storage.foldername(name)[1] nos da el team_id sin tener que unir
-- con la tabla documents para el insert.
create policy "documents_storage_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents' and exists (
      select 1 from teams t where t.id::text = (storage.foldername(name))[1] and
        (t.coach_id = auth.uid() or exists (
          select 1 from team_coaches tc where tc.team_id = t.id and tc.coach_id = auth.uid()
        ))
    )
  );

create policy "documents_storage_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents' and (
      exists (select 1 from documents d where d.file_path = name and d.shared = true)
      or exists (
        select 1 from teams t where t.id::text = (storage.foldername(name))[1] and
          (t.coach_id = auth.uid() or exists (
            select 1 from team_coaches tc where tc.team_id = t.id and tc.coach_id = auth.uid()
          ))
      )
      or get_my_role() = 'director'
    )
  );

create policy "documents_storage_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents' and (owner = auth.uid() or get_my_role() = 'director')
  );

-- ── Tabla concepts ─────────────────────────────────────────────────
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ofensivo','defensivo')),
  title text not null,
  description text,
  play_data jsonb,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table concepts enable row level security;

create policy "concepts_select" on concepts for select to authenticated
  using (true);

create policy "concepts_insert" on concepts for insert to authenticated
  with check (created_by = auth.uid());

create policy "concepts_update" on concepts for update to authenticated
  using (created_by = auth.uid() or get_my_role() = 'director');

create policy "concepts_delete" on concepts for delete to authenticated
  using (created_by = auth.uid() or get_my_role() = 'director');
