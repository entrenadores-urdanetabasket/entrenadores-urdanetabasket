-- La tabla games nunca tuvo columna "quarter": el marcador en directo
-- (app/live/[id]/page.js) llevaba desde siempre intentando guardar en qué
-- período va el partido con updates a esa columna inexistente, que
-- fallaban en silencio. Por eso, al recargar la página o volver a la app,
-- el período siempre se restauraba al 1 por defecto (el estado inicial de
-- React), sin importar en qué período estuviera realmente el partido.

alter table games add column if not exists quarter integer not null default 1;
