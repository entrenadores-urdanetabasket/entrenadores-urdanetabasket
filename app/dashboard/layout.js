'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login'
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#52B043', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Sidebar />
      {/* Desktop: offset por sidebar. Móvil: sin offset */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}
          className="fade-in dash-content">
          {children}
        </div>
      </main>
      <style>{`
        @media (min-width: 1024px) {
          main { margin-left: 248px; }
        }
        .dash-content { padding-top: 72px !important; }
        @media (min-width: 1024px) {
          .dash-content { padding-top: 32px !important; }
        }
      `}</style>
    </div>
  )
}
