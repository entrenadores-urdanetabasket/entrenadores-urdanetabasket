import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PING_INTERVAL_SECONDS } from '@/lib/activityConfig'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()

    if (callerProfile?.role !== 'director') {
      return NextResponse.json({ error: 'Solo el director puede ver la actividad de entrenadores' }, { status: 403 })
    }

    const { coachId } = await request.json()
    if (!coachId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const { data: coachProfile } = await supabaseAdmin
      .from('profiles').select('id, full_name, email, phone, coach_role, created_at').eq('id', coachId).single()
    if (!coachProfile) return NextResponse.json({ error: 'Entrenador no encontrado' }, { status: 404 })

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(coachId)

    const { data: teamLinks } = await supabaseAdmin
      .from('team_coaches').select('teams(id, name, category, season)').eq('coach_id', coachId)
    const teams = (teamLinks || []).map(t => t.teams).filter(Boolean)
    const teamIds = teams.map(t => t.id)

    const [
      { data: trainings },
      { data: tactics },
      { data: incidents },
      { data: convocatorias },
      { data: games },
      { data: attendanceRows },
      { data: pings },
    ] = await Promise.all([
      supabaseAdmin.from('training_sessions').select('id, title, date, start_time, duration_minutes, objectives, notes, team_id, teams(name)').eq('created_by', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('tactics').select('id, title, description, team_id, created_at, teams(name)').eq('created_by', coachId).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('incidents').select('id, type, description, date, resolved, team_id, teams(name)').eq('reported_by', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('convocatorias').select('id, rival, date, team_id, teams(name)').eq('coach_id', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('games').select('id, rival_name, date, our_score, rival_score, status, team_id, teams(name)').eq('created_by', coachId).order('date', { ascending: false }).limit(100),
      teamIds.length > 0
        ? supabaseAdmin.from('attendance').select('team_id, status, date, type').in('team_id', teamIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin.from('activity_pings').select('path, section, created_at').eq('coach_id', coachId).order('created_at', { ascending: true }),
    ])

    // Ejercicios de cada entrenamiento (para el detalle)
    const trainingIds = (trainings || []).map(t => t.id)
    const { data: exerciseRows } = trainingIds.length > 0
      ? await supabaseAdmin.from('training_exercises').select('id, session_id, title, duration_minutes, description').in('session_id', trainingIds).order('order_index')
      : { data: [] }
    const exercisesBySession = {}
    ;(exerciseRows || []).forEach(ex => {
      if (!exercisesBySession[ex.session_id]) exercisesBySession[ex.session_id] = []
      exercisesBySession[ex.session_id].push(ex)
    })
    const trainingsWithExercises = (trainings || []).map(t => ({ ...t, exercises: exercisesBySession[t.id] || [] }))

    // Asistencia: agregada por equipo (varios entrenadores pueden compartir equipo, no es atribuible a uno solo)
    const attendanceByTeam = {}
    ;(attendanceRows || []).forEach(r => {
      if (!attendanceByTeam[r.team_id]) attendanceByTeam[r.team_id] = { total: 0, attended: 0, dates: new Set() }
      attendanceByTeam[r.team_id].total++
      if (r.status === 'present' || r.status === 'late') attendanceByTeam[r.team_id].attended++
      attendanceByTeam[r.team_id].dates.add(r.date)
    })
    const attendanceSummary = teams.map(t => {
      const a = attendanceByTeam[t.id]
      return {
        team_id: t.id,
        team_name: t.name,
        sessionsCount: a ? a.dates.size : 0,
        attendancePct: a && a.total > 0 ? Math.round((a.attended / a.total) * 100) : null,
      }
    })

    // Lista de sesiones de asistencia individuales (fecha + tipo), por equipo
    const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]))
    const sessionMap = {}
    ;(attendanceRows || []).forEach(r => {
      const key = `${r.team_id}|${r.date}|${r.type || 'training'}`
      if (!sessionMap[key]) sessionMap[key] = { team_id: r.team_id, team_name: teamNameById[r.team_id] || '—', date: r.date, type: r.type || 'training', total: 0, present: 0 }
      sessionMap[key].total++
      if (r.status === 'present' || r.status === 'late') sessionMap[key].present++
    })
    const attendanceSessions = Object.values(sessionMap).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100)

    // Tiempo de uso: cada ping representa PING_INTERVAL_SECONDS de uso activo
    // (solo se registran mientras la pestaña está visible, ver ActivityTracker)
    const SECTION_LABELS = {
      inicio: 'Inicio', equipo: 'Mi Equipo', asistencia: 'Asistencia', estadisticas: 'Estadísticas',
      tacticas: 'Tácticas', convocatorias: 'Convocatorias', entrenamientos: 'Entrenamientos',
      incidencias: 'Incidencias', director: 'Panel Director', perfil: 'Perfil',
      live: 'Partido en directo', otro: 'Otro',
    }
    const pingList = pings || []
    const minutesPerPing = PING_INTERVAL_SECONDS / 60

    const sectionCounts = {}
    const dayCounts = {}
    pingList.forEach(p => {
      sectionCounts[p.section] = (sectionCounts[p.section] || 0) + 1
      const day = p.created_at.slice(0, 10)
      dayCounts[day] = (dayCounts[day] || 0) + 1
    })

    const bySection = Object.entries(sectionCounts)
      .map(([section, count]) => ({ section, label: SECTION_LABELS[section] || section, minutes: Math.round(count * minutesPerPing) }))
      .sort((a, b) => b.minutes - a.minutes)

    const last30 = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      last30.push({ date: key, minutes: Math.round((dayCounts[key] || 0) * minutesPerPing) })
    }

    const totalMinutes = Math.round(pingList.length * minutesPerPing)
    const daysActiveLast30 = last30.filter(d => d.minutes > 0).length
    const lastActivityAt = pingList.length > 0 ? pingList[pingList.length - 1].created_at : null

    return NextResponse.json({
      profile: coachProfile,
      lastSignInAt: authUser?.user?.last_sign_in_at || null,
      accountCreatedAt: authUser?.user?.created_at || coachProfile.created_at,
      teams,
      trainings: trainingsWithExercises,
      tactics: tactics || [],
      incidents: incidents || [],
      convocatorias: convocatorias || [],
      games: games || [],
      attendanceSessions,
      attendanceSummary,
      usage: {
        totalMinutes,
        bySection,
        last30Days: last30,
        daysActiveLast30,
        lastActivityAt,
      },
    })
  } catch (err) {
    console.error('coach-activity error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
