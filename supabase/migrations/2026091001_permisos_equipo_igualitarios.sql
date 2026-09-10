-- Cualquier entrenador asignado a un equipo debe poder editar/gestionar
-- todo lo de ese equipo, no solo lo que él mismo creó — no hay entrenador
-- "jefe" con más permisos que otro dentro de un mismo equipo.
--
-- documents_update/documents_delete (y su equivalente en storage.objects)
-- se quedaron restringidos a "quien lo subió" desde que se creó la
-- funcionalidad, en vez de usar is_team_member() como el resto de tablas
-- del equipo (training_sessions, attendance, players...). Por eso un
-- entrenador no podía editar/borrar un documento subido por su compañero
-- de equipo.

drop policy if exists "documents_update" on documents;
create policy "documents_update" on documents for update to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "documents_delete" on documents;
create policy "documents_delete" on documents for delete to authenticated
  using (is_team_member(team_id) or get_my_role() = 'director');

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents' and (
      is_team_member(((storage.foldername(name))[1])::uuid) or get_my_role() = 'director'
    )
  );
