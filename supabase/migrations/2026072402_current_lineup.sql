-- ============================================
-- Guardar quien esta en pista ahora mismo (para que sobreviva a
-- recargar la pagina / cambiar de pestana), en vez de reconstruirlo
-- a partir de un "quinteto inicial" que game_players no puede
-- determinar de forma fiable (no tiene columna de fecha/orden).
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS current_lineup jsonb;
ALTER TABLE games ADD COLUMN IF NOT EXISTS rival_current_lineup jsonb;
