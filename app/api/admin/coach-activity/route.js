import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
    ] = await Promise.all([
      supabaseAdmin.from('training_sessions').select('id, title, date, team_id, teams(name)').eq('created_by', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('tactics').select('id, title, team_id, created_at, teams(name)').eq('created_by', coachId).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('incidents').select('id, type, description, date, resolved, team_id, teams(name)').eq('reported_by', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('convocatorias').select('id, rival, date, team_id, teams(name)').eq('coach_id', coachId).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('games').select('id, rival_name, date, our_score, rival_score, status, team_id, teams(name)').eq('created_by', coachId).order('date', { ascending: false }).limit(100),
      teamIds.length > 0
        ? supabaseAdmin.from('attendance').select('team_id, status, date').in('team_id', teamIds)
        : Promise.resolve({ data: [] }),
    ])

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

    return NextResponse.json({
      profile: coachProfile,
      lastSignInAt: authUser?.user?.last_sign_in_at || null,
      accountCreatedAt: authUser?.user?.created_at || coachProfile.created_at,
      teams,
      trainings: trainings || [],
      tactics: tactics || [],
      incidents: incidents || [],
      convocatorias: convocatorias || [],
      games: games || [],
      attendanceSummary,
    })
  } catch (err) {
    console.error('coach-activity error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
