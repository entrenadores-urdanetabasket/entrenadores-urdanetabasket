'use client'

import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import Icon from '@/components/Icons'
import CoachHome from '@/components/home/CoachHome'
import DirectorHome from '@/components/home/DirectorHome'
import ResultsTicker from '@/components/home/ResultsTicker'
import { PendingGuide } from '@/components/compliance/Compliance'

const coachModules = [
  { label: 'Mi Equipo',      desc: 'Jugadores y plantilla',  href: '/dashboard/equipo',         icon: 'users',     color: '#3b82f6' },
  { label: 'Asistencia',     desc: 'Control de presencia',   href: '/dashboard/asistencia',     icon: 'check',     color: '#52B043' },
  { label: 'Estadísticas',   desc: 'Análisis de partidos',   href: '/dashboard/estadisticas',   icon: 'chart',     color: '#8b5cf6' },
  { label: 'Tácticas',       desc: 'Editor de jugadas',      href: '/dashboard/tacticas',       icon: 'ball',      color: '#f59e0b' },
  { label: 'Convocatorias',  desc: 'Lista de citados',       href: '/dashboard/convocatorias',  icon: 'clipboard', color: '#0ea5e9' },
  { label: 'Entrenamientos', desc: 'Planificar sesiones',    href: '/dashboard/entrenamientos', icon: 'file',      color: '#ec4899' },
]

const directorModules = [
  { label: 'Equipos',        desc: 'Ver plantillas del club',      href: '/dashboard/equipo',         icon: 'users',  color: '#3b82f6' },
  { label: 'Asistencia',     desc: 'Control de todos los equipos', href: '/dashboard/asistencia',     icon: 'check',  color: '#52B043' },
  { label: 'Estadísticas',   desc: 'Análisis de partidos',         href: '/dashboard/estadisticas',   icon: 'chart',  color: '#8b5cf6' },
  { label: 'Entrenamientos', desc: 'Sesiones publicadas',          href: '/dashboard/entrenamientos', icon: 'file',   color: '#ec4899' },
  { label: 'Documentos',     desc: 'Archivador del club',          href: '/dashboard/documentos',     icon: 'folder', color: '#14b8a6' },
  { label: 'Panel Director', desc: 'Gestión del club',             href: '/dashboard/director',       icon: 'shield', color: '#1C5C2A' },
]

export default function DashboardPage() {
  const { profile, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] || (isDirector ? 'Director' : 'Entrenador')
  const modules   = isDirector ? directorModules : coachModules

  return (
    <div className="fade-in">
      {/* Cinta de resultados */}
      <ResultsTicker />

      {/* Saludo */}
      <div style={{ marginBottom: 22 }}>
        <h1 className="display" style={{ color: '#fff', fontSize: 38, fontWeight: 800, margin: 0, lineHeight: 1, textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}>
          {greeting}, {firstName}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: '4px 0 0', fontWeight: 500 }}>
          {isDirector ? 'Esto es lo que está pasando en el club.' : 'Resumen de tu equipo y de lo que viene.'}
        </p>
      </div>

      {/* Banner perfil incompleto — solo coaches */}
      {!isDirector && profile && !profile.profile_completed && (
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: 16, marginBottom: 18,
          backgroundColor: '#fffbeb', border: '1px solid #fde68a', textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(217,119,6,0.10)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👋</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Completa tu perfil</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>Añade tu teléfono y rol para que el director pueda contactarte</div>
            </div>
          </div>
          <Icon name="arrow" size={18} style={{ color: '#d97706' }} />
        </Link>
      )}

      {/* Guía de seguimiento (solo entrenadores) */}
      {!isDirector && <PendingGuide />}

      {/* Resumen */}
      {isDirector ? <DirectorHome /> : activeTeam ? <CoachHome team={activeTeam} /> : (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Sin equipo asignado</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>El director te asignará un equipo en breve.</div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div style={{ marginTop: 28 }}>
        <h3 className="display" style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Accesos rápidos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {modules.map(({ label, desc, href, icon, color }) => (
            <Link key={label} href={href} className="module-card" style={{ '--accent': color }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13, marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, background: `linear-gradient(135deg, ${color}26, ${color}0d)`, border: `1px solid ${color}33`
              }}><Icon name={icon} size={20} /></div>
              <span className="module-arrow"><Icon name="arrow" size={17} /></span>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 3, letterSpacing: -0.3 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 500 }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
