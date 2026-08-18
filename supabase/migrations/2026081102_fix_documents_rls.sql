-- ============================================
-- Arregla "new row violates row-level security policy" al subir
-- documentos: las politicas de documents / storage.objects hacian
-- un EXISTS directo contra teams/team_coaches, y las politicas propias
-- de esas tablas bloqueaban esa subconsulta anidada (mismo problema de
-- RLS en cascada que get_my_role() ya resuelve para el rol).
--
-- Solucion: una funcion SECURITY DEFINER que comprueba la pertenencia
-- al equipo sin pasar por RLS, igual que get_my_role().
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

create or replace function public.is_team_member(_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from teams t where t.id = _team_id and
      (t.coach_id = auth.uid() or exists (
        select 1 from team_coaches tc where tc.team_id = t.id and tc.coach_id = auth.uid()
      ))
  );
$$;

-- ── documents ──────────────────────────────────────────────────────
drop policy if exists "documents_select" on documents;
create policy "documents_select" on documents for select to authenticated
  using (shared = true or is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "documents_insert" on documents;
create policy "documents_insert" on documents for insert to authenticated
  with check (is_team_member(team_id) or get_my_role() = 'director');

-- ── storage.objects (bucket "documents") ──────────────────────────
drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents' and is_team_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents' and (
      exists (select 1 from documents d where d.file_path = name and d.shared = true)
      or is_team_member(((storage.foldername(name))[1])::uuid)
      or get_my_role() = 'director'
    )
  );
