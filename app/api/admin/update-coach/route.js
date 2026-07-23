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
      return NextResponse.json({ error: 'Solo el director puede editar entrenadores' }, { status: 403 })
    }

    const { coachId, full_name, email, phone, coach_role } = await request.json()
    if (!coachId || !full_name || !email) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('email').eq('id', coachId).single()

    if (targetProfile && targetProfile.email !== email) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(coachId, { email, email_confirm: true })
      if (emailError) return NextResponse.json({ error: 'Error al cambiar el email: ' + emailError.message }, { status: 500 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, email, phone: phone || null, coach_role: coach_role || null })
      .eq('id', coachId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('update-coach error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + (err?.message || String(err)) }, { status: 500 })
  }
}
