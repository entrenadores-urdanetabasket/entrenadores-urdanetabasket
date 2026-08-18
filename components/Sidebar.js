'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const coachItems = [
  { href: '/dashboard',               label: 'Inicio',         emoji: '🏠' },
  { href: '/dashboard/equipo',        label: 'Mi Equipo',      emoji: '👥' },
  { href: '/dashboard/asistencia',    label: 'Asistencia',     emoji: '✅' },
  { href: '/dashboard/estadisticas',  label: 'Estadísticas',   emoji: '📊' },
  { href: '/dashboard/tacticas',      label: 'Tácticas',       emoji: '🏀' },
  { href: '/dashboard/convocatorias', label: 'Convocatorias',  emoji: '📋' },
  { href: '/dashboard/entrenamientos',label: 'Entrenamientos', emoji: '📝' },
  { href: '/dashboard/documentos',    label: 'Documentos',     emoji: '📁' },
  { href: '/dashboard/conceptos',     label: 'Conceptos',      emoji: '📖' },
  { href: '/dashboard/incidencias',   label: 'Incidencias',    emoji: '⚠️' },
]

const directorItems = [
  { href: '/dashboard',               label: 'Inicio',         emoji: '🏠' },
  { href: '/dashboard/equipo',        label: 'Equipos',        emoji: '👥' },
  { href: '/dashboard/asistencia',    label: 'Asistencia',     emoji: '✅' },
  { href: '/dashboard/estadisticas',  label: 'Estadísticas',   emoji: '📊' },
  { href: '/dashboard/tacticas',      label: 'Tácticas',       emoji: '🏀' },
  { href: '/dashboard/convocatorias', label: 'Convocatorias',  emoji: '📋' },
  { href: '/dashboard/entrenamientos',label: 'Entrenamientos', emoji: '📝' },
  { href: '/dashboard/documentos',    label: 'Documentos',     emoji: '📁' },
  { href: '/dashboard/conceptos',     label: 'Conceptos',      emoji: '📖' },
  { href: '/dashboard/incidencias',   label: 'Incidencias',    emoji: '⚠️' },
  { href: '/dashboard/director',      label: 'Panel Director', emoji: '🛡️' },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { profile, supabase, myTeams, activeTeam, setActiveTeam } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const items = profile?.role === 'director' ? directorItems : coachItems
  const isDirector = profile?.role === 'director'

  const sidebarPanel = (extraStyle = {}) => (
    <div style={{
      width: 256, height: '100%',
      background: 'linear-gradient(180deg, #0a1f0e 0%, #122818 60%, #1a3820 100%)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
      boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      ...extraStyle,
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, padding: 6, flexShrink: 0,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', letterSpacing: -0.2 }}>C.D. Urdaneta</div>
            <div style={{ fontSize: 11, color: '#52B043', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#52B043', display: 'inline-block', boxShadow: '0 0 6px #52B043' }} />
              {isDirector ? 'Director Deportivo' : 'Entrenadores'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector equipo activo ── */}
      {!isDirector && myTeams.length > 1 && (
        <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            Equipo activo
          </div>
          {myTeams.map(t => {
            const isActive = activeTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => { setActiveTeam(t); setOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '8px 10px', borderRadius: 10,
                border: 'none', cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(82,176,67,0.2)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                transition: 'all 0.15s', textAlign: 'left',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: isActive ? '#52B043' : 'rgba(255,255,255,0.25)',
                  boxShadow: isActive ? '0 0 8px rgba(82,176,67,0.8)' : 'none',
                  transition: 'all 0.15s',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                {isActive && <span style={{ fontSize: 9, fontWeight: 800, color: '#52B043', backgroundColor: 'rgba(82,176,67,0.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5 }}>ACTIVO</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(({ href, label, emoji }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', borderRadius: 11,
              backgroundColor: active ? '#52B043' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
              fontSize: 13.5, fontWeight: active ? 700 : 500,
              textDecoration: 'none', transition: 'all 0.15s',
              boxShadow: active ? '0 4px 14px rgba(82,176,67,0.4)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' } }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, width: 22, textAlign: 'center', flexShrink: 0 }}>{emoji}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginBottom: 4,
          backgroundColor: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #52B043, #1C5C2A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 800,
            boxShadow: '0 2px 8px rgba(82,176,67,0.4)',
          }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Usuario'}
            </div>
            <div style={{ fontSize: 11, color: '#52B043', fontWeight: 600, marginTop: 1 }}>
              {isDirector ? 'Director' : 'Entrenador'}
            </div>
          </div>
        </div>
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9, textDecoration: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
          ⚙️ Editar perfil
        </Link>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9, border: 'none',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)',
          fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display: 'none', position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))', left: 'calc(14px + env(safe-area-inset-left))', zIndex: 60,
        width: 42, height: 42, borderRadius: 11,
        border: 'none', background: 'linear-gradient(135deg, #1C5C2A, #52B043)',
        cursor: 'pointer', fontSize: 18, color: '#fff',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(28,92,42,0.4)',
      }} className="mobile-menu-btn">☰</button>

      <div className="sidebar-desktop">{sidebarPanel()}</div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(3px)' }} />
          <div className="sidebar-mobile">{sidebarPanel({ animation: 'slideInLeft 0.22s ease both' })}</div>
        </>
      )}
    </>
  )
}
