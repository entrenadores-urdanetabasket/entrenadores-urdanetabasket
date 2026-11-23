'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'
import { useTheme } from '@/lib/theme'

// Menú agrupado por bloques, con iconos de trazo
const coachGroups = [
  { label: null, items: [
    { href: '/dashboard',               label: 'Inicio',         icon: 'home' },
  ]},
  { label: 'Mi equipo', items: [
    { href: '/dashboard/equipo',        label: 'Mi Equipo',      icon: 'users' },
    { href: '/dashboard/asistencia',    label: 'Asistencia',     icon: 'check' },
    { href: '/dashboard/incidencias',   label: 'Incidencias',    icon: 'alert' },
  ]},
  { label: 'Competición', items: [
    { href: '/dashboard/estadisticas',  label: 'Estadísticas',   icon: 'chart' },
    { href: '/dashboard/convocatorias', label: 'Convocatorias',  icon: 'clipboard' },
    { href: '/dashboard/tacticas',      label: 'Tácticas',       icon: 'ball' },
  ]},
  { label: 'Entrenamiento', items: [
    { href: '/dashboard/entrenamientos',label: 'Entrenamientos', icon: 'file' },
    { href: '/dashboard/conceptos',     label: 'Conceptos',      icon: 'book' },
    { href: '/dashboard/documentos',    label: 'Documentos',     icon: 'folder' },
  ]},
]

const directorGroups = [
  coachGroups[0],
  { label: 'Club', items: [
    { href: '/dashboard/equipo',        label: 'Equipos',        icon: 'users' },
    { href: '/dashboard/asistencia',    label: 'Asistencia',     icon: 'check' },
    { href: '/dashboard/incidencias',   label: 'Incidencias',    icon: 'alert' },
  ]},
  coachGroups[2],
  coachGroups[3],
  { label: 'Gestión', items: [
    { href: '/dashboard/director',      label: 'Panel Director', icon: 'shield' },
  ]},
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { profile, supabase, myTeams, activeTeam, setActiveTeam } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('urdaneta-open-menu', onOpen)
    return () => window.removeEventListener('urdaneta-open-menu', onOpen)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isDirector = profile?.role === 'director'
  const groups = isDirector ? directorGroups : coachGroups

  const sidebarPanel = (extraStyle = {}) => (
    <div className="app-sidebar" style={{
      width: 256, height: '100%',
      background: 'radial-gradient(420px 260px at 0% 0%, rgba(82,176,67,0.20), transparent 70%), linear-gradient(180deg, #07170b 0%, #0d2414 60%, #12301b 100%)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
      boxShadow: '4px 0 28px rgba(0,0,0,0.28)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      ...extraStyle,
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, padding: 6, flexShrink: 0,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#ffffff', letterSpacing: -0.2 }}>C.D. Urdaneta</div>
            <div style={{ fontSize: 11, color: '#7bd96a', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#52B043', display: 'inline-block', boxShadow: '0 0 8px #52B043' }} />
              {isDirector ? 'Director Deportivo' : 'Entrenadores'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector equipo activo ── */}
      {!isDirector && myTeams.length > 1 && (
        <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
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
                {isActive && <span style={{ fontSize: 9, fontWeight: 800, color: '#7bd96a', backgroundColor: 'rgba(82,176,67,0.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5 }}>ACTIVO</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '6px 10px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="nav-group-label">{g.label}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: g.label ? 0 : 8 }}>
              {g.items.map(({ href, label, icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-item${active ? ' active' : ''}`}>
                    <span className="nav-icon"><Icon name={icon} size={18} /></span>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginBottom: 4,
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
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
            <div style={{ fontSize: 11, color: '#7bd96a', fontWeight: 600, marginTop: 1 }}>
              {isDirector ? 'Director' : 'Entrenador'}
            </div>
          </div>
        </div>
        <Link href="/dashboard/perfil" style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9, textDecoration: 'none',
          color: 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
          <Icon name="user" size={15} /> Editar perfil
        </Link>
        <button onClick={toggleTheme} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9, border: 'none',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)',
          fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
          <Icon name={dark ? 'sun' : 'moon'} size={15} /> {dark ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9, border: 'none',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)',
          fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}>
          <Icon name="logout" size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display: 'none', position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))', left: 'calc(14px + env(safe-area-inset-left))', zIndex: 60,
        width: 42, height: 42, borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(135deg, #0f3a1c, #1c5c2a)',
        cursor: 'pointer', color: '#fff',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(7,23,11,0.35)',
      }} className="mobile-menu-btn" aria-label="Abrir menú"><Icon name="menu" size={20} /></button>

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
