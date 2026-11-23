import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { evaluateAllCoaches, getSettings } from '@/lib/complianceRules'

// El director evalúa a todos los entrenadores (y se crean los bloqueos pendientes).
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'director') return NextResponse.json({ error: 'Solo el director' }, { status: 403 })

    const settings = await getSettings(admin)
    const states = await evaluateAllCoaches(admin, settings)
    return NextResponse.json({ settings, states })
  } catch (err) {
    console.error('compliance-sweep error:', err)
    return NextResponse.json({ error: 'No se pudo evaluar' }, { status: 500 })
  }
}
