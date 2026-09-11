-- Documentos deja de estar ligado a un equipo: es un archivador único del
-- club, gestionado solo por el director (ver migración anterior), visible
-- para todos los entrenadores. Se quita la obligación de elegir equipo al
-- subir y las pestañas "Mis documentos"/"Compartidos" en la web.

alter table documents alter column team_id drop not null;

drop policy if exists "documents_select" on documents;
create policy "documents_select" on documents for select to authenticated
  using (true);

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents');
