'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const coachItems = [
  { href: '/dashboard', label: 'Inicio', emoji: '🏠' },
  { href: '/dashboard/equipo', label: 'Mi Equipo', emoji: '👥' },
  { href: '/dashboard/asistencia', label: 'Asistencia', emoji: '✅' },
  { href: '/dashboard/estadisticas', label: 'Estadísticas', emoji: '📊' },
  { href: '/dashboard/tacticas', label: 'Tácticas', emoji: '🏀' },
  { href: '/dashboard/entrenamientos', label: 'Entrenamientos', emoji: '📝' },
  { href: '/dashboard/incidencias', label: 'Incidencias', emoji: '⚠️' },
]

const directorItems = [
  { href: '/dashboard', label: 'Inicio', emoji: '🏠' },
  { href: '/dashboard/equipo', label: 'Equipos', emoji: '👥' },
  { href: '/dashboard/asistencia', label: 'Asistencia', emoji: '✅' },
  { href: '/dashboard/entrenamientos', label: 'Entrenamientos', emoji: '📝' },
  { href: '/dashboard/incidencias', label: 'Incidencias', emoji: '⚠️' },
  { href: '/dashboard/director', label: 'Panel Director', emoji: '🛡️' },
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

  const sidebar = (
    <div style={{
      width: 248, height: '100%', backgroundColor: '#fff',
      borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50
    }}>
      {/* Header con logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, padding: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, #52B043, #1C5C2A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>C.D. Urdaneta</div>
            <div style={{ fontSize: 11, color: '#52B043', fontWeight: 600 }}>{profile?.role === 'director' ? 'Director' : 'Entrenadores'}</div>
          </div>
        </div>
      </div>

      {/* Selector de equipo activo — solo entrenadores con 2+ equipos */}
      {profile?.role === 'coach' && myTeams.length > 1 && (
        <div style={{ padding: '10px 10px 12px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>
            Equipo activo
          </div>
          {myTeams.map(t => {
            const isActive = activeTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => { setActiveTeam(t); setOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', borderRadius: 8, border: isActive ? '1px solid #d1f0d1' : '1px solid transparent',
                cursor: 'pointer', backgroundColor: isActive ? '#f0faf0' : 'transparent',
                color: isActive ? '#1C5C2A' : '#6b7280',
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                transition: 'all 0.15s', textAlign: 'left',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: isActive ? '#52B043' : '#d1d5db',
                  boxShadow: isActive ? '0 0 0 3px rgba(82,176,67,0.18)' : 'none',
                  transition: 'all 0.15s',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </span>
                {isActive && <span style={{ fontSize: 9, fontWeight: 800, color: '#52B043', backgroundColor: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>ACTIVO</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(({ href, label, emoji }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10,
              backgroundColor: active ? '#f0faf0' : 'transparent',
              color: active ? '#1C5C2A' : '#6b7280',
              fontSize: 13, fontWeight: active ? 700 : 500,
              border: `1px solid ${active ? '#d1f0d1' : 'transparent'}`,
              transition: 'all 0.15s', textDecoration: 'none'
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.color = '#374151' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280' } }}
            >
              <span style={{ fontSize: 15 }}>{emoji}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer usuario */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, backgroundColor: '#f9fafb', marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #52B043, #1C5C2A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 800
          }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Entrenador'}
            </div>
            <div style={{ fontSize: 11, color: '#52B043', fontWeight: 600 }}>
              {profile?.role === 'director' ? 'Director' : 'Entrenador'}
            </div>
          </div>
        </div>
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 10, textDecoration: 'none',
          color: '#9ca3af', fontSize: 13, fontWeight: 500, transition: 'all 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
          ⚙️ Editar perfil
        </Link>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 10, border: 'none',
          backgroundColor: 'transparent', color: '#9ca3af', fontSize: 13,
          cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Botón móvil */}
      <button onClick={() => setOpen(true)}
        style={{
          display: 'none', position: 'fixed', top: 14, left: 14, zIndex: 60,
          width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb',
          backgroundColor: '#fff', cursor: 'pointer', fontSize: 18,
          alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.08)'
        }}
        className="mobile-menu-btn">
        ☰
      </button>

      {/* Sidebar desktop */}
      <div className="sidebar-desktop">{sidebar}</div>

      {/* Sidebar móvil */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
          <div className="sidebar-mobile">{sidebar}</div>
        </>
      )}

      <style>{`
        .sidebar-desktop { display: none; }
        .sidebar-mobile { display: block; }
        .mobile-menu-btn { display: flex !important; }
        @media (min-width: 1024px) {
          .sidebar-desktop { display: block; }
          .sidebar-mobile { display: none; }
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}
