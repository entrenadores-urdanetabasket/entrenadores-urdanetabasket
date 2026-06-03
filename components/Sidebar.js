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
  { href: '/dashboard/incidencias',   label: 'Incidencias',    emoji: '⚠️' },
]

const directorItems = [
  { href: '/dashboard',               label: 'Inicio',         emoji: '🏠' },
  { href: '/dashboard/equipo',        label: 'Equipos',        emoji: '👥' },
  { href: '/dashboard/asistencia',    label: 'Asistencia',     emoji: '✅' },
  { href: '/dashboard/entrenamientos',label: 'Entrenamientos', emoji: '📝' },
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

  const sidebar = (
    <div style={{
      width: 252, height: '100%',
      background: '#ffffff',
      borderRight: '1px solid #e8eaee',
      boxShadow: '2px 0 16px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
    }}>

      {/* ── Franja verde superior ── */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #1C5C2A 0%, #52B043 60%, #a3e090 100%)',
        flexShrink: 0,
      }} />

      {/* ── Header ── */}
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #f0f1f5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11, padding: 5, flexShrink: 0,
            background: 'linear-gradient(135deg, #1C5C2A, #52B043)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(28,92,42,0.25)',
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', letterSpacing: -0.2 }}>C.D. Urdaneta</div>
            <div style={{
              fontSize: 11, fontWeight: 600, marginTop: 1,
              color: isDirector ? '#1C5C2A' : '#52B043',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: isDirector ? '#1C5C2A' : '#52B043',
                display: 'inline-block',
                boxShadow: `0 0 0 2px ${isDirector ? 'rgba(28,92,42,0.15)' : 'rgba(82,176,67,0.2)'}`,
              }} />
              {isDirector ? 'Director Deportivo' : 'Entrenadores'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector equipo activo (coaches con 2+ equipos) ── */}
      {!isDirector && myTeams.length > 1 && (
        <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid #f0f1f5', flexShrink: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#94a3b8',
            letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2
          }}>Equipo activo</div>
          {myTeams.map(t => {
            const isActive = activeTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => { setActiveTeam(t); setOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '7px 10px', borderRadius: 9,
                border: isActive ? '1px solid #d1f0d1' : '1px solid transparent',
                cursor: 'pointer',
                backgroundColor: isActive ? '#f0faf0' : 'transparent',
                color: isActive ? '#1C5C2A' : '#64748b',
                fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: isActive ? '#52B043' : '#cbd5e1',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? '0 0 0 3px rgba(82,176,67,0.2)' : 'none',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </span>
                {isActive && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: '#52B043',
                    backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4,
                    letterSpacing: 0.4,
                  }}>ACTIVO</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Navegación ── */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(({ href, label, emoji }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10,
              backgroundColor: active ? '#f0faf0' : 'transparent',
              color: active ? '#1C5C2A' : '#64748b',
              fontSize: 13, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? '#d1f0d1' : 'transparent'}`,
              transition: 'all 0.15s ease',
              textDecoration: 'none',
              position: 'relative',
            }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.color = '#0f172a'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#64748b'
                }
              }}
            >
              {/* Indicador activo lateral */}
              {active && (
                <span style={{
                  position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 20, borderRadius: '0 3px 3px 0',
                  backgroundColor: '#52B043',
                }} />
              )}
              <span style={{ fontSize: 15, lineHeight: 1, width: 20, textAlign: 'center', flexShrink: 0 }}>
                {emoji}
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer usuario ── */}
      <div style={{ padding: '10px 10px 12px', borderTop: '1px solid #f0f1f5', flexShrink: 0 }}>
        {/* Card usuario */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 11px', borderRadius: 11,
          backgroundColor: '#f8fafc', marginBottom: 4,
          border: '1px solid #f0f1f5',
        }}>
          <div style={{
            width: 33, height: 33, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #52B043, #1C5C2A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 800,
            boxShadow: '0 1px 4px rgba(28,92,42,0.2)',
          }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: '#0f172a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {profile?.full_name || 'Usuario'}
            </div>
            <div style={{ fontSize: 11, color: '#52B043', fontWeight: 600, marginTop: 1 }}>
              {isDirector ? 'Director' : 'Entrenador'}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 12px', borderRadius: 9, textDecoration: 'none',
          color: '#94a3b8', fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
          ⚙️ Editar perfil
        </Link>

        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 12px', borderRadius: 9, border: 'none',
          backgroundColor: 'transparent', color: '#94a3b8',
          fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Botón móvil */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'none', position: 'fixed', top: 14, left: 14, zIndex: 60,
          width: 42, height: 42, borderRadius: 11,
          border: '1px solid #e2e8f0', backgroundColor: '#fff',
          cursor: 'pointer', fontSize: 18,
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
        className="mobile-menu-btn">
        ☰
      </button>

      {/* Sidebar desktop */}
      <div className="sidebar-desktop">{sidebar}</div>

      {/* Sidebar móvil */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }}
          />
          <div className="sidebar-mobile" style={{ animation: 'slideInLeft 0.22s ease both' }}>
            {sidebar}
          </div>
        </>
      )}
    </>
  )
}
