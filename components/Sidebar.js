'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, ClipboardList, AlertCircle,
  ChevronLeft, Menu, LogOut, Shield, BarChart2, BookOpen, Sword
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/dashboard/equipo', label: 'Mi Equipo', icon: Users },
  { href: '/dashboard/asistencia', label: 'Asistencia', icon: ClipboardList },
  { href: '/dashboard/estadisticas', label: 'Estadísticas', icon: BarChart2 },
  { href: '/dashboard/tacticas', label: 'Tácticas', icon: Sword },
  { href: '/dashboard/entrenamientos', label: 'Entrenamientos', icon: BookOpen },
  { href: '/dashboard/incidencias', label: 'Incidencias', icon: AlertCircle },
]

const directorItems = [
  { href: '/dashboard/director', label: 'Panel Director', icon: Shield },
]

export default function Sidebar({ profile }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const items = profile?.role === 'director'
    ? [...navItems, ...directorItems]
    : navItems

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl shadow-lg"
        style={{ backgroundColor: '#162016', border: '1px solid #2A3D2A' }}
      >
        <Menu size={20} style={{ color: '#52B043' }} />
      </button>

      {/* Overlay móvil */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: '#0A120A', borderRight: '1px solid #1E2E1E' }}
      >
        {/* Logo del club */}
        <div className="flex items-center gap-3 p-5" style={{ borderBottom: '1px solid #1E2E1E' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 p-1.5"
            style={{ background: 'linear-gradient(135deg, #52B043, #1C5C2A)' }}>
            <img src="/logo.png" alt="Urdaneta" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-black text-sm leading-tight">C.D. Urdaneta</p>
            <p className="text-xs truncate" style={{ color: '#52B043' }}>Portal Entrenadores</p>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden" style={{ color: '#4A6A48' }}>
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
                style={{
                  backgroundColor: active ? 'rgba(82,176,67,0.15)' : 'transparent',
                  color: active ? '#6FCF5F' : '#7A9A78',
                  border: active ? '1px solid rgba(82,176,67,0.2)' : '1px solid transparent'
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ backgroundColor: active ? 'rgba(82,176,67,0.2)' : 'rgba(42,61,42,0.5)' }}>
                  <Icon size={16} style={{ color: active ? '#6FCF5F' : '#4A6A48' }} />
                </div>
                {label}
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#52B043' }} />}
              </Link>
            )
          })}
        </nav>

        {/* Perfil y logout */}
        <div className="p-3" style={{ borderTop: '1px solid #1E2E1E' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ backgroundColor: '#162016' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #52B043, #1C5C2A)' }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-bold truncate">{profile?.full_name}</p>
              <p className="text-xs truncate capitalize" style={{ color: '#52B043' }}>
                {profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-all"
            style={{ color: '#4A6A48' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#162016'; e.currentTarget.style.color = '#EF4444' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#4A6A48' }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
