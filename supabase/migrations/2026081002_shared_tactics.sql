-- ============================================
-- Permite a un entrenador compartir una tactica con todo el club,
-- igual que ya se puede hacer con los entrenamientos.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE tactics ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;
