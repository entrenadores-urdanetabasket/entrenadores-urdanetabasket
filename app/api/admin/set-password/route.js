import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // Verificar token del director
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Cliente admin con service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verificar que el caller es director
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role !== 'director') {
      return NextResponse.json({ error: 'Solo el director puede cambiar contraseñas' }, { status: 403 })
    }

    // Leer body
    const { coachId, password } = await request.json()
    if (!coachId || !password) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 })

    // Cambiar contraseña con Admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(coachId, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('set-password error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
