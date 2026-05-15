'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, profile, supabase } = useAuth()
  const [team, setTeam] = useState(null)
  const [stats, setStats] = useState({ players: 0, attendance: 0, incidents: 0 })

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    const { data: t } = await supabase
      .from('teams').select('*, players(count)').eq('coach_id', user.id).single()
    if (!t) return
    setTeam(t)

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const { count: att } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('team_id', t.id).gte('date', firstOfMonth)
    const { count: inc } = await supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('team_id', t.id).eq('resolved', false)
    setStats({ players: t.players?.[0]?.count || 0, attendance: att || 0, incidents: inc || 0 })
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] || 'Entrenador'
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const quickActions = [
    { label: 'Pasar lista', desc: 'Asistencia de hoy', href: '/dashboard/asistencia/nueva', emoji: '✅' },
    { label: 'Mi equipo', desc: 'Ver plantilla', href: '/dashboard/equipo', emoji: '👥' },
    { label: 'Estadísticas', desc: 'Análisis de partidos', href: '/dashboard/estadisticas', emoji: '📊' },
    { label: 'Tácticas', desc: 'Editor de jugadas', href: '/dashboard/tacticas', emoji: '🏀' },
    { label: 'Entrenamientos', desc: 'Planificar sesiones', href: '/dashboard/entrenamientos', emoji: '📝' },
    { label: 'Incidencias', desc: 'Registrar eventos', href: '/dashboard/incidencias', emoji: '⚠️' },
  ]

  return (
    <div>
      {/* Saludo */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#52B043', fontSize: 13, fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{today}</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, margin: 0 }}>{greeting}, {firstName} 👋</h1>
      </div>

      {/* Banner equipo */}
      {team ? (
        <div style={{ borderRadius: 16, padding: '20px 24px', marginBottom: 24, background: 'linear-gradient(135deg,#0F2A0F,#1C5C2A,#2A7A2A)', border: '1px solid rgba(82,176,67,0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(82,176,67,0.2),transparent)' }} />
          <p style={{ color: '#6FCF5F', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Tu equipo</p>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>{team.name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: 0 }}>{team.category} · {team.season} · {stats.players} jugadores</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, padding: '16px 20px', marginBottom: 24, backgroundColor: '#162016', border: '1px solid #2A3D2A' }}>
          <p style={{ color: '#7A9A78', fontSize: 13, margin: 0 }}>Sin equipo asignado. El director te asignará uno pronto.</p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Jugadores', value: stats.players, emoji: '👥', href: '/dashboard/equipo' },
          { label: 'Asistencias/mes', value: stats.attendance, emoji: '✅', href: '/dashboard/asistencia' },
          { label: 'Incidencias', value: stats.incidents, emoji: '⚠️', href: '/dashboard/incidencias', alert: stats.incidents > 0 },
        ].map(({ label, value, emoji, href, alert }) => (
          <Link key={label} href={href} style={{
            borderRadius: 16, padding: '16px 12px', backgroundColor: alert ? 'rgba(245,158,11,0.08)' : '#162016',
            border: `1px solid ${alert ? 'rgba(245,158,11,0.3)' : '#2A3D2A'}`, textDecoration: 'none', display: 'block', transition: 'transform 0.15s'
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{emoji}</div>
            <div style={{ color: alert ? '#F59E0B' : '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{value}</div>
            <div style={{ color: '#7A9A78', fontSize: 11, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </Link>
        ))}
      </div>

      {/* Accesos rápidos */}
      <p style={{ color: '#4A6A48', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Accesos rápidos</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {quickActions.map(({ label, desc, href, emoji }) => (
          <Link key={label} href={href} style={{
            borderRadius: 14, padding: '16px', backgroundColor: '#162016', border: '1px solid #2A3D2A',
            textDecoration: 'none', display: 'block', transition: 'all 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(82,176,67,0.3)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A3D2A'; e.currentTarget.style.transform = 'scale(1)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{label}</div>
            <div style={{ color: '#4A6A48', fontSize: 11, marginTop: 2 }}>{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
