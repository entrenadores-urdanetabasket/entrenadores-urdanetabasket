import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { evaluateCoach, getSettings } from '@/lib/complianceRules'

// El entrenador consulta (y, si toca, se le crea) su estado de cumplimiento.
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const settings = await getSettings(admin)
    const state = await evaluateCoach(admin, user.id, settings)
    return NextResponse.json({ state })
  } catch (err) {
    console.error('compliance error:', err)
    return NextResponse.json({ error: 'No se pudo comprobar el cumplimiento' }, { status: 500 })
  }
}
