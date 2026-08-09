-- ============================================
-- Cerrar temporada: el director archiva todos los equipos activos
-- de golpe y crea los equipos de la temporada siguiente (mismo
-- nombre/categoria/genero, sin jugadores), copiando las asignaciones
-- de entrenador para que cada uno siga viendo *su* equipo.
--
-- Nada se borra: el equipo antiguo se marca active=false pero
-- conserva su id, asi que todo su historial (jugadores, partidos,
-- convocatorias, entrenamientos, tacticas, incidencias, asistencia)
-- sigue intacto y consultable, solo que "colgado" de un equipo
-- ahora archivado.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.close_season()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_team RECORD;
  v_new_team_id uuid;
  v_next_season text;
  v_count int := 0;
BEGIN
  IF public.get_my_role() <> 'director' THEN
    RAISE EXCEPTION 'Solo el director puede cerrar la temporada';
  END IF;

  FOR v_team IN SELECT * FROM public.teams WHERE active = true LOOP
    v_next_season := (split_part(v_team.season, '-', 1)::int + 1) || '-' || (split_part(v_team.season, '-', 2)::int + 1);

    INSERT INTO public.teams (name, category, gender, season, active)
    VALUES (v_team.name, v_team.category, v_team.gender, v_next_season, true)
    RETURNING id INTO v_new_team_id;

    INSERT INTO public.team_coaches (team_id, coach_id)
    SELECT v_new_team_id, coach_id FROM public.team_coaches WHERE team_id = v_team.id;

    UPDATE public.teams SET active = false WHERE id = v_team.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('teams_closed', v_count);
END;
$$;
