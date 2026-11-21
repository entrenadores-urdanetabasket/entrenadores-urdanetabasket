-- Borrar equipos y entrenadores fallaba por claves foráneas: un equipo tiene
-- jugadores, partidos, sesiones, asistencia... y un entrenador deja creados
-- entrenamientos, tácticas, partidos, ejercicios, etc. Estas funciones (solo
-- ejecutables desde el servidor, con la service role) recorren las claves
-- foráneas reales de la base de datos, así que no hay que mantener a mano
-- una lista de tablas.

-- Borra filas de una tabla y, antes, todo lo que depende de ellas.
-- documents y exercise_library solo pierden la referencia al equipo
-- (team_id = null): el contenido se conserva.
create or replace function public._purge_rows(_tbl regclass, _cond text, _depth int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
  child_cond text;
begin
  if _depth > 10 then raise exception 'Borrado demasiado profundo (posible ciclo)'; end if;

  for fk in
    select c.conrelid::regclass::text as child, a.attname as child_col, pa.attname as parent_col
    from pg_constraint c
    join pg_attribute a  on a.attrelid  = c.conrelid  and a.attnum  = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f'
      and c.confrelid = _tbl
      and array_length(c.conkey, 1) = 1
      and c.conrelid <> c.confrelid
  loop
    child_cond := format('%I in (select %I from %s where %s)', fk.child_col, fk.parent_col, _tbl, _cond);
    if fk.child in ('documents', 'exercise_library') then
      execute format('update %s set %I = null where %s', fk.child, fk.child_col, child_cond);
    else
      perform public._purge_rows(fk.child::regclass, child_cond, _depth + 1);
    end if;
  end loop;

  execute format('delete from %s where %s', _tbl, _cond);
end;
$$;

create or replace function public.delete_team_cascade(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._purge_rows('public.teams'::regclass, format('id = %L', p_team));
end;
$$;

-- Antes de borrar un entrenador, todo lo que creó pasa al director que lo
-- elimina (tácticas, entrenamientos, ejercicios, partidos...), para no
-- perder contenido del club. Sus vínculos con equipos y su actividad sí se
-- borran.
create or replace function public.reassign_coach_records(p_coach uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass::text as child, a.attname as child_col, a.attnotnull as notnull
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_class cl    on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f'
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and array_length(c.conkey, 1) = 1
      and n.nspname = 'public'
      and c.conrelid <> 'public.profiles'::regclass
  loop
    if fk.child in ('team_coaches', 'activity_pings') then
      execute format('delete from %s where %I = %L', fk.child, fk.child_col, p_coach);
    elsif fk.child = 'teams' and not fk.notnull then
      execute format('update teams set %I = null where %I = %L', fk.child_col, fk.child_col, p_coach);
    else
      execute format('update %s set %I = %L where %I = %L', fk.child, fk.child_col, p_to, fk.child_col, p_coach);
    end if;
  end loop;
end;
$$;

revoke all on function public._purge_rows(regclass, text, int) from public, anon, authenticated;
revoke all on function public.delete_team_cascade(uuid) from public, anon, authenticated;
revoke all on function public.reassign_coach_records(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_team_cascade(uuid) to service_role;
grant execute on function public.reassign_coach_records(uuid, uuid) to service_role;
