'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, profile, supabase, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const [team, setTeam]   = useState(null)
  const [stats, setStats] = useState({ players: 0, incidents: 0 })

  // Director stats
  const [dirStats, setDirStats] = useState({ teams: 0, coaches: 0, players: 0, incidents: 0 })

  useEffect(() => {
    if (!user || !profile) return
    if (isDirector) loadDirectorData()
    else if (activeTeam) loadCoachData(activeTeam)
  }, [user, profile, activeTeam])

  async function loadCoachData(t) {
    setTeam(t)
    const { count: playerCount } = await supabase
      .from('players').select('*', { count: 'exact', head: true })
      .eq('team_id', t.id).eq('active', true)
    const { count: inc } = await supabase
      .from('incidents').select('*', { count: 'exact', head: true })
      .eq('team_id', t.id).eq('resolved', false)
    setStats({ players: playerCount || 0, incidents: inc || 0 })
  }

  async function loadDirectorData() {
    const [{ data: teams }, { data: coaches }, { data: players }, { count: inc }] = await Promise.all([
      supabase.from('teams').select('id'),
      supabase.from('profiles').select('id').eq('role', 'coach'),
      supabase.from('players').select('id').eq('active', true),
      supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('resolved', false),
    ])
    setDirStats({
      teams:   (teams   || []).length,
      coaches: (coaches || []).length,
      players: (players || []).length,
      incidents: inc || 0,
    })
  }

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] || (isDirector ? 'Director' : 'Entrenador')
  const today     = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const coachModules = [
    { label: 'Mi Equipo',      desc: 'Jugadores y plantilla',  href: '/dashboard/equipo',         emoji: '👥', color: '#3b82f6' },
    { label: 'Asistencia',     desc: 'Control de presencia',   href: '/dashboard/asistencia',     emoji: '✅', color: '#52B043' },
    { label: 'Estadísticas',   desc: 'Análisis de partidos',   href: '/dashboard/estadisticas',   emoji: '📊', color: '#8b5cf6' },
    { label: 'Tácticas',       desc: 'Editor de jugadas',      href: '/dashboard/tacticas',       emoji: '🏀', color: '#f59e0b' },
    { label: 'Convocatorias',  desc: 'Lista de citados',       href: '/dashboard/convocatorias',  emoji: '📋', color: '#0ea5e9' },
    { label: 'Entrenamientos', desc: 'Planificar sesiones',    href: '/dashboard/entrenamientos', emoji: '📝', color: '#ec4899' },
    { label: 'Incidencias',    desc: 'Registro de eventos',    href: '/dashboard/incidencias',    emoji: '⚠️', color: stats.incidents > 0 ? '#ef4444' : '#6b7280' },
  ]

  const directorModules = [
    { label: 'Equipos',        desc: 'Ver plantillas del club', href: '/dashboard/equipo',         emoji: '👥', color: '#3b82f6' },
    { label: 'Asistencia',     desc: 'Control de todos los equipos', href: '/dashboard/asistencia', emoji: '✅', color: '#52B043' },
    { label: 'Entrenamientos', desc: 'Sesiones publicadas',    href: '/dashboard/entrenamientos', emoji: '📝', color: '#ec4899' },
    { label: 'Incidencias',    desc: 'Registro de eventos',    href: '/dashboard/incidencias',    emoji: '⚠️', color: dirStats.incidents > 0 ? '#ef4444' : '#6b7280' },
    { label: 'Panel Director', desc: 'Gestión del club',       href: '/dashboard/director',       emoji: '🛡️', color: '#1C5C2A' },
  ]

  const modules = isDirector ? directorModules : coachModules

  return (
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4, textTransform: 'capitalize' }}>{today}</p>
        <h1 style={{ color: '#111827', fontSize: 26, fontWeight: 800, margin: 0 }}>
          {greeting}, {firstName} 👋
        </h1>
      </div>

      {/* Banner perfil incompleto — solo coaches */}
      {!isDirector && profile && !profile.profile_completed && (
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: 12, marginBottom: 20,
          backgroundColor: '#fffbeb', border: '1px solid #fde68a', textDecoration: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👋</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Completa tu perfil</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>Añade tu teléfono y rol para que el director pueda contactarte</div>
            </div>
          </div>
          <span style={{ color: '#d97706', fontSize: 18 }}>→</span>
        </Link>
      )}

      {/* ── BANNER DIRECTOR ── */}
      {isDirector && (
        <div style={{
          borderRadius: 16, marginBottom: 28, overflow: 'hidden',
          background: 'linear-gradient(135deg, #1C5C2A 0%, #52B043 100%)',
          boxShadow: '0 4px 20px rgba(82,176,67,0.25)'
        }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Club Deportivo Urdaneta
              </p>
              <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>
                Vista general del club
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>
                Temporada 2025-2026
              </p>
            </div>
            <div style={{ fontSize: 52, opacity: 0.5 }}>🛡️</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {[
              { label: 'Equipos',      value: dirStats.teams },
              { label: 'Entrenadores', value: dirStats.coaches },
              { label: 'Jugadores',    value: dirStats.players },
              { label: 'Incidencias',  value: dirStats.incidents },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '14px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BANNER COACH ── */}
      {!isDirector && (
        <div style={{
          borderRadius: 16, marginBottom: 28, overflow: 'hidden',
          background: 'linear-gradient(135deg, #1C5C2A 0%, #52B043 100%)',
          boxShadow: '0 4px 20px rgba(82,176,67,0.25)'
        }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {team ? 'Tu equipo' : 'Sin equipo asignado'}
              </p>
              <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>
                {team ? team.name : 'Pendiente de asignación'}
              </h2>
              {team && (
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>
                  {team.category} · {team.season} · {stats.players} jugadores
                </p>
              )}
            </div>
            <div style={{ fontSize: 52, opacity: 0.5 }}>🏀</div>
          </div>

          {team && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              {[
                { label: 'Jugadores',   value: stats.players },
                { label: 'Incidencias', value: stats.incidents },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '14px 20px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>{value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Módulos */}
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ color: '#374151', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>¿Qué quieres hacer hoy?</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {modules.map(({ label, desc, href, emoji, color }) => (
            <Link key={label} href={href} style={{
              display: 'block', padding: '18px 16px', borderRadius: 14,
              backgroundColor: '#fff', border: '1px solid #f3f4f6',
              textDecoration: 'none', transition: 'all 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
