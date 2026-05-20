'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export default function LiveLayout({ children }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login'
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #1a2030', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          <p style={{ color: '#4b5563', fontSize: 13 }}>Cargando...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0a0c10',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {children}
    </div>
  )
}
