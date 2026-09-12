-- Contexto del tiro (2 y 3 puntos, anotados o fallados): si fue en
-- transición o a balón parado ("estático"). Los tiros libres no lo usan.
alter table game_events add column if not exists shot_context text
  check (shot_context is null or shot_context in ('transicion', 'estatico'));
