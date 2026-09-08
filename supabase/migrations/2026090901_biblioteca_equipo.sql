-- Cada ejercicio de la biblioteca queda etiquetado con el equipo que lo
-- subió. La biblioteca del club sigue siendo "todos los ejercicios" (el
-- select ya era abierto a todo el mundo); la biblioteca del propio equipo
-- es simplemente ese mismo listado filtrado por team_id, así que un
-- ejercicio subido aparece automáticamente en las dos sin duplicar filas.
-- Los ejercicios ya existentes se quedan sin equipo (team_id null): siguen
-- viéndose en "Club", pero no aparecerán en ningún filtro de "Mi equipo".
alter table exercise_library add column if not exists team_id uuid references teams(id);
