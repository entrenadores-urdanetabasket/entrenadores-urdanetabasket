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

    await supabaseAdmin.from('team_coaches').delete().eq('coach_id', coachId)

    // Borrar el usuario de Auth arrastra el perfil (ON DELETE CASCADE).
    // Si el entrenador tiene incidencias u otros registros que lo referencian,
    // esto puede fallar por restricción de clave foránea.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(coachId)
    if (error) {
      const isForeignKey = /foreign key|violat/i.test(error.message || '')
      return NextResponse.json({
        error: isForeignKey
          ? 'No se puede eliminar: este entrenador tiene incidencias u otros registros asociados en el sistema.'
          : error.message
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('delete-coach error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + (err?.message || String(err)) }, { status: 500 })
  }
}
