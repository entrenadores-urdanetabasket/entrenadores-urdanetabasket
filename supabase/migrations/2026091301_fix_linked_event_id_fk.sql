-- game_events.linked_event_id tiene doble uso, ya intencional desde antes:
--   - en tiro/rebote/asistencia: id de OTRO evento (game_events.id).
--   - en una sustitución DE NUESTRO EQUIPO: id del JUGADOR que sale de
--     pista (no un evento) — así lo reconstruye computePlusMinusUs() en
--     app/live/[id]/page.js para saber quién estaba en pista en cada
--     momento y calcular el +/-.
--
-- Con una clave foránea que obliga a que linked_event_id sea siempre el id
-- de otro game_events, cualquier sustitución de nuestro equipo falla con
-- "violates foreign key constraint game_events_linked_event_id_fkey" en
-- cuanto se intenta guardar ahí un id de jugador (que nunca va a coincidir
-- con el id de un evento). Se quita la restricción: la columna sigue
-- existiendo, solo deja de forzar que apunte siempre a un evento.

alter table game_events drop constraint if exists game_events_linked_event_id_fkey;
