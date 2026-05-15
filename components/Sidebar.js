'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, ClipboardList, AlertCircle,
  ChevronLeft, Menu, LogOut, Shield
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/dashboard/equipo', label: 'Mi Equipo', icon: Users },
  { href: '/dashboard/asistencia', label: 'Asistencia', icon: ClipboardList },
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
    router.push('/login')
    router.refresh()
  }

  const items = profile?.role === 'director'
    ? [...navItems, ...directorItems]
    : navItems

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-md bg-white"
        style={{ color: '#1C5C2A' }}
      >
        <Menu size={22} />
      </button>

      {/* Overlay móvil */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: '#1C5C2A' }}
      >
        {/* Header del sidebar */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 p-1">
            <img src="/logo.png" alt="Urdaneta" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">C.D. Urdaneta</p>
            <p className="text-green-300 text-xs truncate">{profile?.full_name || 'Entrenador'}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden ml-auto text-white/60 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-white text-green-800 shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Perfil y logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#52B043' }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name}</p>
              <p className="text-green-300 text-xs truncate capitalize">{profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
