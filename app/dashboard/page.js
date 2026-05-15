import { createClient } from '@/lib/supabase/server'
import { Users, ClipboardList, AlertCircle, BarChart2, ArrowRight, Calendar } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: team } = await supabase
    .from('teams').select('*, players(count)').eq('coach_id', user.id).single()

  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  let attendanceCount = 0, incidentCount = 0, playerCount = 0

  if (team) {
    playerCount = team.players?.[0]?.count || 0
    const { count: att } = await supabase.from('attendance').select('*', { count: 'exact', head: true })
      .eq('team_id', team.id).gte('date', firstOfMonth)
    const { count: inc } = await supabase.from('incidents').select('*', { count: 'exact', head: true })
      .eq('team_id', team.id).eq('resolved', false)
    attendanceCount = att || 0
    incidentCount = inc || 0
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] || 'Entrenador'
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const stats = [
    { label: 'Jugadores', value: playerCount, icon: Users, href: '/dashboard/equipo', trend: 'Plantilla activa' },
    { label: 'Asistencias este mes', value: attendanceCount, icon: ClipboardList, href: '/dashboard/asistencia', trend: 'Registros del mes' },
    { label: 'Incidencias abiertas', value: incidentCount, icon: AlertCircle, href: '/dashboard/incidencias', trend: incidentCount > 0 ? 'Requieren atención' : 'Sin pendientes', alert: incidentCount > 0 },
  ]

  const quickActions = [
    { label: 'Pasar lista', desc: 'Registra asistencia de hoy', href: '/dashboard/asistencia/nueva', icon: '✅' },
    { label: 'Ver plantilla', desc: 'Gestiona tus jugadores', href: '/dashboard/equipo', icon: '👥' },
    { label: 'Nueva incidencia', desc: 'Registra un evento', href: '/dashboard/incidencias/nueva', icon: '📋' },
    { label: 'Estadísticas', desc: 'Análisis del equipo', href: '/dashboard/estadisticas', icon: '📊' },
    { label: 'Tácticas', desc: 'Editor de jugadas', href: '/dashboard/tacticas', icon: '🏀' },
    { label: 'Entrenamientos', desc: 'Planifica sesiones', href: '/dashboard/entrenamientos', icon: '📝' },
  ]

  return (
    <div className="max-w-4xl mx-auto">

      {/* Saludo */}
      <div className="mb-8">
        <p className="text-sm font-medium capitalize mb-1" style={{ color: '#52B043' }}>{today}</p>
        <h1 className="text-3xl font-black text-white">{greeting}, {firstName}</h1>
      </div>

      {/* Banner del equipo */}
      {team ? (
        <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F2A0F 0%, #1C5C2A 50%, #2A7A2A 100%)', border: '1px solid rgba(82,176,67,0.3)' }}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #52B043, transparent)', transform: 'translate(30%, -30%)' }} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#6FCF5F' }}>Tu equipo</p>
              <h2 className="text-2xl font-black text-white">{team.name}</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {team.category} · {team.season} · {playerCount} jugadores
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(82,176,67,0.2)', border: '1px solid rgba(82,176,67,0.3)' }}>
              <span className="text-2xl">🏀</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#162016', border: '1px solid #2A3D2A' }}>
          <p className="text-sm" style={{ color: '#7A9A78' }}>
            No tienes equipo asignado todavía. El director deportivo te asignará uno en breve.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {stats.map(({ label, value, icon: Icon, href, trend, alert }) => (
          <a key={label} href={href}
            className="rounded-2xl p-4 transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: alert ? 'rgba(245,158,11,0.08)' : '#162016',
              border: `1px solid ${alert ? 'rgba(245,158,11,0.3)' : '#2A3D2A'}`
            }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: alert ? 'rgba(245,158,11,0.15)' : 'rgba(82,176,67,0.1)' }}>
                <Icon size={18} style={{ color: alert ? '#F59E0B' : '#52B043' }} />
              </div>
              <ArrowRight size={14} style={{ color: '#4A6A48' }} />
            </div>
            <p className="text-2xl font-black text-white mb-0.5">{value}</p>
            <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
            <p className="text-xs" style={{ color: alert ? '#F59E0B' : '#4A6A48' }}>{trend}</p>
          </a>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="mb-2">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#4A6A48' }}>
          Accesos rápidos
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map(({ label, desc, href, icon }) => (
            <a key={label} href={href}
              className="rounded-2xl p-4 transition-all hover:scale-[1.02] group"
              style={{ backgroundColor: '#162016', border: '1px solid #2A3D2A' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(82,176,67,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2A3D2A'}
            >
              <span className="text-2xl block mb-3">{icon}</span>
              <p className="text-white font-bold text-sm">{label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#4A6A48' }}>{desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
