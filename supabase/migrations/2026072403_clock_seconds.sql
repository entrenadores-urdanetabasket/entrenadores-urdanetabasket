-- ============================================
-- Guardar el tiempo restante del cronometro para que sobreviva a
-- salir de la pagina sin finalizar el partido.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_seconds int;
