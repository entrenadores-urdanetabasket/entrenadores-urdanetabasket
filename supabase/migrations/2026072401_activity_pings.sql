-- ============================================
-- Seguimiento de tiempo de uso (heartbeats)
-- Ejecutar una vez en el SQL Editor de Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS activity_pings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  section TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_pings_coach_created ON activity_pings(coach_id, created_at);

ALTER TABLE activity_pings ENABLE ROW LEVEL SECURITY;

-- Cada entrenador solo puede insertar sus propios pings
CREATE POLICY "activity_pings_insert" ON activity_pings FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

-- Cada entrenador ve solo los suyos, el director los ve todos
CREATE POLICY "activity_pings_select" ON activity_pings FOR SELECT
  USING (auth.uid() = coach_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
  ));
