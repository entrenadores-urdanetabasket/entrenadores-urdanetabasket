-- Las valoraciones de entrenamiento se diseñaron como "solo quien creó la
-- sesión, o el director" — pero eso choca con el criterio ya aplicado al
-- resto de la web (entrenamientos, documentos...): cualquier entrenador
-- asignado a un equipo tiene la misma capacidad de gestionarlo, no hay
-- entrenador "jefe". Una entrenadora no podía valorar/editar la valoración
-- de una sesión creada por su compañera de equipo.
--
-- Se cambia owns_session() para comprobar pertenencia al equipo de la
-- sesión (is_team_member) en vez de quién la creó — sigue siendo privado
-- frente al resto del club (solo el equipo + director la ve), solo deja
-- de ser exclusivo de quien pulsó "Guardar" la primera vez.

create or replace function public.owns_session(_session_id uuid)
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
