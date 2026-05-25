-- ============================================
-- ESQUEMA BASE DE DATOS - ENTRENADORES URDANETA
-- ============================================

-- Perfiles de usuario (entrenadores y director)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'coach' CHECK (role IN ('coach', 'director')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipos
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2025-2026',
  coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  logo_url TEXT,                        -- URL del escudo del equipo (Supabase Storage o CDN)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Si la tabla ya existe, añadir la columna logo_url si no está:
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Jugadores
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  birth_year INT,
  jersey_number INT,
  position TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asistencia
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('training', 'game')),
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'justified')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, date, type)
);

-- Incidencias
CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('disciplinary', 'medical', 'administrative', 'other')),
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEGURIDAD (Row Level Security)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve solo su perfil, el director ve todos
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
  ));

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Teams: entrenador ve solo su equipo, director ve todos
CREATE POLICY "teams_select" ON teams FOR SELECT
  USING (coach_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
  ));

CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
  ));

CREATE POLICY "teams_update" ON teams FOR UPDATE
  USING (coach_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
  ));

-- Players: mismo criterio que teams
CREATE POLICY "players_select" ON players FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = players.team_id
    AND (teams.coach_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
    ))
  ));

CREATE POLICY "players_all" ON players FOR ALL
  USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = players.team_id
    AND (teams.coach_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
    ))
  ));

-- Attendance
CREATE POLICY "attendance_all" ON attendance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = attendance.team_id
    AND (teams.coach_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
    ))
  ));

-- Incidents
CREATE POLICY "incidents_all" ON incidents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = incidents.team_id
    AND (teams.coach_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'
    ))
  ));

-- ============================================
-- FUNCIÓN: crear perfil automáticamente al registrarse
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'coach')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
