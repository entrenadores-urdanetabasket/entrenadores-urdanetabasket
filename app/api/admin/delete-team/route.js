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
      return NextResponse.json({ error: 'Solo el director puede eliminar equipos' }, { status: 403 })
    }

    const { teamId } = await request.json()
    if (!teamId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    // Borra el equipo y todo lo que depende de él (jugadores, partidos,
    // sesiones, asistencia...). Los documentos y ejercicios de biblioteca
    // solo pierden el equipo asociado, no se borran.
    const { error } = await supabaseAdmin.rpc('delete_team_cascade', { p_team: teamId })
    if (error) {
      console.error('delete_team_cascade error:', error)
      return NextResponse.json({
        error: `No se pudo eliminar el equipo: ${error.message}. ¿Has ejecutado la migración 2026112101 en Supabase?`
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('delete-team error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
