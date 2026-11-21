'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'
import { cap } from '@/lib/homeUtils'
import { useTheme } from '@/lib/theme'

const TITLES = {
  '/dashboard': 'Inicio',
  '/dashboard/equipo': 'Equipo',
  '/dashboard/asistencia': 'Asistencia',
  '/dashboard/estadisticas': 'Estadísticas',
  '/dashboard/tacticas': 'Tácticas',
  '/dashboard/convocatorias': 'Convocatorias',
  '/dashboard/entrenamientos': 'Entrenamientos',
  '/dashboard/documentos': 'Documentos',
  '/dashboard/conceptos': 'Conceptos',
  '/dashboard/incidencias': 'Incidencias',
  '/dashboard/director': 'Panel Director',
  '/dashboard/perfil': 'Mi perfil',
}

export default function Topbar() {
  const pathname = usePathname()
  const { profile, activeTeam } = useAuth()
  const { dark, toggle } = useTheme()
  const isDirector = profile?.role === 'director'
  const key = Object.keys(TITLES).filter(k => pathname === k || pathname.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0]
  const title = TITLES[key] || 'Panel'
  const today = cap(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
        <span>C.D. Urdaneta</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: '#0f172a', fontWeight: 800, letterSpacing: -0.2 }}>{title}</span>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={() => window.dispatchEvent(new Event('urdaneta-open-search'))} title="Buscar (Ctrl+K)" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 12px', borderRadius: 999, background: '#fff', border: '1px solid #e4e8ef', color: '#94a3b8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <Icon name="search" size={14} /> Buscar
        <span style={{ fontSize: 10.5, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 6, padding: '1px 6px', color: '#94a3b8' }}>Ctrl K</span>
      </button>
      <button onClick={toggle} title={dark ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema" style={{ width: 34, height: 34, borderRadius: 11, background: '#fff', border: '1px solid #e4e8ef', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name={dark ? 'sun' : 'moon'} size={16} />
      </button>
      <div style={{ color: '#94a3b8', fontSize: 12.5, fontWeight: 600 }}>{today}</div>
      {!isDirector && activeTeam && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: '#fff', border: '1px solid #e4e8ef', fontSize: 12.5, fontWeight: 700, color: '#14401f', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <Icon name="users" size={14} /> {activeTeam.name}
        </div>
      )}
      <div style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(28,92,42,0.3)' }}>
        {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
      </div>
    </div>
  )
}
