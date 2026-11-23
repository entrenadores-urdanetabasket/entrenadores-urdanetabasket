'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'
import CommandPalette from '@/components/CommandPalette'
import Toaster from '@/components/Toaster'
import FX from '@/components/FX'
import { ComplianceGate } from '@/components/compliance/Compliance'
import BottomNav from '@/components/BottomNav'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login'
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #eef0f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, margin: '0 auto 14px',
            border: '3px solid #e2e8f0', borderTopColor: '#52B043',
            borderRadius: '50%', animation: 'spin 0.75s linear infinite'
          }} />
          <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}
          className="fade-in-safe dash-content">
          <ComplianceGate><div key={pathname} className="page-enter">{children}</div></ComplianceGate>
        </div>
      </main>
      <CommandPalette />
      <Toaster />
      <FX />
      <BottomNav />
      <style>{`
        @media (min-width: 1024px) { main { margin-left: 256px; } }
        .dash-content { padding-top: calc(74px + env(safe-area-inset-top)) !important; }
        @media (min-width: 1024px) { .dash-content { padding-top: 32px !important; } }
      `}</style>
    </div>
  )
}
