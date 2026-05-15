import { createClient } from '@/lib/supabase/server'
import { Users, ClipboardList, AlertCircle, Calendar } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: team } = await supabase
    .from('teams')
    .select('*, players(count)')
    .eq('coach_id', user.id)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  let attendanceCount = 0
  let incidentCount = 0

  if (team) {
    const { count: att } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .gte('date', firstOfMonth)

    const { count: inc } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('resolved', false)

    attendanceCount = att || 0
    incidentCount = inc || 0
  }

  const playerCount = team?.players?.[0]?.count || 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const stats = [
    {
      label: 'Jugadores',
      value: playerCount,
      icon: Users,
      color: '#52B043',
      bg: '#E8F5E4',
      href: '/dashboard/equipo',
      desc: team ? `Equipo: ${team.name}` : 'Sin equipo asignado'
    },
    {
      label: 'Registros este mes',
      value: attendanceCount,
      icon: ClipboardList,
      color: '#1C5C2A',
      bg: '#D4EED4',
      href: '/dashboard/asistencia',
      desc: 'Asistencia registrada'
    },
    {
      label: 'Incidencias abiertas',
      value: incidentCount,
      icon: AlertCircle,
      color: incidentCount > 0 ? '#D97706' : '#52B043',
      bg: incidentCount > 0 ? '#FEF3C7' : '#E8F5E4',
      href: '/dashboard/incidencias',
      desc: incidentCount > 0 ? 'Pendientes de resolver' : 'Todo en orden'
    },
  ]

  return (
    <div>
      {/* Saludo */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A2A1A' }}>
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'Entrenador'}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#5A7A5A' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Equipo actual */}
      {team && (
        <div className="rounded-2xl p-5 mb-6 text-white" style={{ background: 'linear-gradient(135deg, #1C5C2A, #52B043)' }}>
          <p className="text-green-200 text-xs font-medium uppercase tracking-wide mb-1">Tu equipo</p>
          <h2 className="text-xl font-bold">{team.name}</h2>
          <p className="text-green-200 text-sm mt-1">{team.category} · Temporada {team.season}</p>
        </div>
      )}

      {!team && (
        <div className="rounded-2xl p-5 mb-6 bg-white border" style={{ borderColor: '#D8E8D8' }}>
          <p className="text-sm" style={{ color: '#5A7A5A' }}>No tienes ningún equipo asignado todavía. Contacta con el director deportivo.</p>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href, desc }) => (
          <a key={label} href={href} className="block rounded-2xl p-5 bg-white border hover:shadow-md transition-shadow" style={{ borderColor: '#D8E8D8' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                <Icon size={20} style={{ color }} />
              </div>
              <span className="text-2xl font-bold" style={{ color }}>{value}</span>
            </div>
            <p className="font-semibold text-sm" style={{ color: '#1A2A1A' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#5A7A5A' }}>{desc}</p>
          </a>
        ))}
      </div>

      {/* Accesos rápidos */}
      <h3 className="font-bold mb-4" style={{ color: '#1A2A1A' }}>Accesos rápidos</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Pasar lista hoy', href: '/dashboard/asistencia/nueva', emoji: '✅' },
          { label: 'Ver mi equipo', href: '/dashboard/equipo', emoji: '👥' },
          { label: 'Nueva incidencia', href: '/dashboard/incidencias/nueva', emoji: '📋' },
          { label: 'Ver asistencia', href: '/dashboard/asistencia', emoji: '📅' },
        ].map(({ label, href, emoji }) => (
          <a
            key={label}
            href={href}
            className="flex items-center gap-3 p-4 rounded-xl bg-white border font-medium text-sm hover:shadow-md transition-shadow"
            style={{ borderColor: '#D8E8D8', color: '#1A2A1A' }}
          >
            <span className="text-xl">{emoji}</span>
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
