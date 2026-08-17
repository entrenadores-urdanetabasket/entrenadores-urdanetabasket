-- ============================================
-- Arregla que los entrenadores no pudieran ver tacticas/entrenamientos
-- compartidos por otros entrenadores.
--
-- Causa: la funcion "Compartidas" primero busca todos los equipos
-- activos del club (para saber donde buscar contenido compartido),
-- pero la politica de teams_select solo deja ver el equipo propio,
-- asi que esa busqueda nunca encontraba a los demas equipos. Ademas,
-- a "tactics" nunca se le anadio el permiso de leer filas compartidas
-- que "training_sessions" ya tenia.
--
-- Estas politicas se SUMAN a las existentes (no las sustituyen): en
-- Postgres, varias politicas permisivas para el mismo comando se
-- combinan con OR, asi que esto solo amplia el acceso, no quita nada
-- de lo que ya funcionaba.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

-- Cualquier entrenador autenticado puede ver el listado basico de
-- equipos activos del club (nombre, categoria...), no solo el suyo.
CREATE POLICY "teams_select_active_browse"
ON teams FOR SELECT
TO authenticated
USING (active = true);

-- Las tacticas marcadas como compartidas se pueden leer aunque no
-- seas entrenador de ese equipo (igual que ya pasa con training_sessions).
CREATE POLICY "tactics_select_shared"
ON tactics FOR SELECT
TO authenticated
USING (shared = true);
