-- Documentos pasa a ser un apartado de solo lectura para los entrenadores:
-- solo el director sube, comparte o borra documentos. Los entrenadores
-- siguen pudiendo ver y descargar los de su equipo y los compartidos con
-- el club (documents_select no cambia).
--
-- De paso, esto corrige el error "new row violates row-level security
-- policy" al subir: la política de Storage (documents_storage_insert)
-- solo comprobaba is_team_member() y nunca dejaba subir a un director que
-- no fuera personalmente entrenador de ese equipo — el director SIEMPRE
-- debe poder subir, sea o no entrenador de ese equipo en concreto.

drop policy if exists "documents_insert" on documents;
create policy "documents_insert" on documents for insert to authenticated
  with check (get_my_role() = 'director');

drop policy if exists "documents_update" on documents;
create policy "documents_update" on documents for update to authenticated
  using (get_my_role() = 'director');

drop policy if exists "documents_delete" on documents;
create policy "documents_delete" on documents for delete to authenticated
  using (get_my_role() = 'director');

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and get_my_role() = 'director');

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and get_my_role() = 'director');

-- Quita cualquier restricción de tipo de archivo del bucket, para que se
-- puedan subir PDF, Word, Excel, PowerPoint, imágenes, etc. sin límite.
update storage.buckets set allowed_mime_types = null where id = 'documents';
