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
      return NextResponse.json({ error: 'Solo el director puede eliminar entrenadores' }, { status: 403 })
    }

    const { coachId } = await request.json()
    if (!coachId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    if (coachId === user.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })

    // Lo que creó el entrenador (tácticas, entrenamientos, ejercicios,
    // partidos, incidencias...) pasa al director; sus vínculos con equipos y
    // su actividad se borran. Sin esto, la clave foránea impedía borrarlo.
    const { error: reassignErr } = await supabaseAdmin.rpc('reassign_coach_records', { p_coach: coachId, p_to: user.id })
    if (reassignErr) {
      console.error('reassign_coach_records error:', reassignErr)
      return NextResponse.json({
        error: `No se pudieron traspasar los registros del entrenador: ${reassignErr.message}. ¿Has ejecutado la migración 2026112101 en Supabase?`
      }, { status: 500 })
    }

    // Borrar el usuario de Auth arrastra el perfil (ON DELETE CASCADE).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(coachId)
    if (error) {
      return NextResponse.json({ error: `No se pudo eliminar: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('delete-coach error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
