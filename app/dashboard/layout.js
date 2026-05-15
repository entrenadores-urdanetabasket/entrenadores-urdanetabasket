'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login'
    }
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0D150D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #2A3D2A', borderTopColor: '#52B043', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#7A9A78', fontSize: 14 }}>Cargando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0D150D' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 0, paddingTop: 64 }} className="lg-main">
        <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
          {children}
        </div>
      </main>
      <style>{`
        @media (min-width: 1024px) {
          .lg-main { margin-left: 256px !important; padding-top: 0 !important; }
        }
      `}</style>
    </div>
  )
}
