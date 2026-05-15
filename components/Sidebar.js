'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const navItems = [
  { href: '/dashboard', label: 'Inicio', emoji: '🏠' },
  { href: '/dashboard/equipo', label: 'Mi Equipo', emoji: '👥' },
  { href: '/dashboard/asistencia', label: 'Asistencia', emoji: '✅' },
  { href: '/dashboard/estadisticas', label: 'Estadísticas', emoji: '📊' },
  { href: '/dashboard/tacticas', label: 'Tácticas', emoji: '🏀' },
  { href: '/dashboard/entrenamientos', label: 'Entrenamientos', emoji: '📝' },
  { href: '/dashboard/incidencias', label: 'Incidencias', emoji: '⚠️' },
]

const S = {
  sidebar: { position: 'fixed', top: 0, left: 0, height: '100%', width: 256, backgroundColor: '#0A120A', borderRight: '1px solid #1E2E1E', display: 'flex', flexDirection: 'column', zIndex: 50 },
  header: { padding: '20px 16px', borderBottom: '1px solid #1E2E1E', display: 'flex', alignItems: 'center', gap: 12 },
  logoBox: { width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 6 },
  clubName: { color: '#fff', fontWeight: 900, fontSize: 13, lineHeight: 1.2 },
  clubSub: { color: '#52B043', fontSize: 11, marginTop: 2 },
  nav: { flex: 1, padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 },
  footer: { padding: '12px 8px', borderTop: '1px solid #1E2E1E' },
  profileBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10, backgroundColor: '#162016', marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 8px', borderRadius: 10, border: 'none', backgroundColor: 'transparent', color: '#4A6A48', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' },
  mobileBtn: { position: 'fixed', top: 12, left: 12, zIndex: 60, width: 40, height: 40, borderRadius: 10, backgroundColor: '#162016', border: '1px solid #2A3D2A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 40 },
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { profile, supabase } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const items = profile?.role === 'director'
    ? [...navItems, { href: '/dashboard/director', label: 'Panel Director', emoji: '🛡️' }]
    : navItems

  const sidebarContent = (
    <div style={S.sidebar}>
      <div style={S.header}>
        <div style={S.logoBox}>
          <img src="/logo.png" alt="Urdaneta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div>
          <div style={S.clubName}>C.D. Urdaneta</div>
          <div style={S.clubSub}>Portal Entrenadores</div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden" style={{ marginLeft: 'auto', color: '#4A6A48', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      <nav style={S.nav}>
        {items.map(({ href, label, emoji }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                backgroundColor: active ? 'rgba(82,176,67,0.15)' : 'transparent',
                border: `1px solid ${active ? 'rgba(82,176,67,0.25)' : 'transparent'}`,
                color: active ? '#6FCF5F' : '#7A9A78',
                fontSize: 13, fontWeight: active ? 700 : 500, textDecoration: 'none', transition: 'all 0.15s'
              }}>
              <span style={{ fontSize: 16 }}>{emoji}</span>
              {label}
              {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#52B043' }} />}
            </Link>
          )
        })}
      </nav>

      <div style={S.footer}>
        <div style={S.profileBox}>
          <div style={S.avatar}>{profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Entrenador'}</div>
            <div style={{ color: '#52B043', fontSize: 11 }}>{profile?.role === 'director' ? 'Director' : 'Entrenador'}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={S.logoutBtn}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1E2E1E'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#4A6A48' }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile button */}
      <button onClick={() => setOpen(true)} className="lg:hidden" style={S.mobileBtn}>
        <span style={{ color: '#52B043', fontSize: 18 }}>☰</span>
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile sidebar */}
      {open && (
        <>
          <div style={S.overlay} onClick={() => setOpen(false)} />
          <div className="block lg:hidden">{sidebarContent}</div>
        </>
      )}
    </>
  )
}
