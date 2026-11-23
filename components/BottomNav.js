'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'

// Barra de navegación inferior para móvil (en escritorio queda oculta por CSS)
export default function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const isDirector = profile?.role === 'director'

  const items = isDirector
    ? [
        { href: '/dashboard', label: 'Inicio', icon: 'home' },
        { href: '/dashboard/equipo', label: 'Equipos', icon: 'users' },
        { href: '/dashboard/asistencia', label: 'Asistencia', icon: 'check' },
        { href: '/dashboard/director', label: 'Director', icon: 'shield' },
      ]
    : [
        { href: '/dashboard', label: 'Inicio', icon: 'home' },
        { href: '/dashboard/equipo', label: 'Equipo', icon: 'users' },
        { href: '/dashboard/asistencia', label: 'Asistencia', icon: 'check' },
        { href: '/dashboard/estadisticas', label: 'Partidos', icon: 'chart' },
      ]

  const isActive = href => href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map(it => (
        <Link key={it.href} href={it.href} className={`bn-item${isActive(it.href) ? ' active' : ''}`}>
          <Icon name={it.icon} size={22} className="bn-ico" />
          <span>{it.label}</span>
        </Link>
      ))}
      <button className="bn-item" onClick={() => window.dispatchEvent(new Event('urdaneta-open-menu'))} aria-label="Más opciones">
        <Icon name="menu" size={22} className="bn-ico" />
        <span>Más</span>
      </button>
    </nav>
  )
}
