'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a1a0a 0%, #1a3a1a 50%, #0f2a0f 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Decoración: círculo cancha fondo */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%',
        border: '1px solid rgba(82,176,67,0.08)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 400, height: 400, borderRadius: '50%',
        border: '1px solid rgba(82,176,67,0.06)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 180, height: 180, borderRadius: '50%',
        border: '1px solid rgba(82,176,67,0.1)',
        pointerEvents: 'none'
      }} />
      {/* Línea central */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 1,
        backgroundColor: 'rgba(82,176,67,0.06)', pointerEvents: 'none'
      }} />

      {/* Balón decorativo */}
      <div style={{
        position: 'absolute', top: 40, right: 60,
        fontSize: 80, opacity: 0.07, transform: 'rotate(15deg)',
        userSelect: 'none', pointerEvents: 'none'
      }}>🏀</div>
      <div style={{
        position: 'absolute', bottom: 60, left: 40,
        fontSize: 50, opacity: 0.05, transform: 'rotate(-10deg)',
        userSelect: 'none', pointerEvents: 'none'
      }}>🏀</div>

      {/* Logo y nombre — protagonistas */}
      <div style={{ textAlign: 'center', marginBottom: 38 }}>
        <div style={{
          width: 104, height: 104, margin: '0 auto 22px',
          background: 'rgba(82,176,67,0.10)',
          borderRadius: 26,
          padding: 13,
          border: '1px solid rgba(82,176,67,0.30)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 0 1px rgba(82,176,67,0.10), 0 0 40px rgba(82,176,67,0.35), 0 12px 32px rgba(0,0,0,0.4)'
        }}>
          <img src="/logo.png" alt="Urdaneta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <h1 style={{ color: '#ffffff', fontSize: 27, fontWeight: 900, margin: '0 0 7px', letterSpacing: -0.6 }}>
          Club Deportivo Urdaneta
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Portal de Entrenadores
        </p>
      </div>

      {/* Tarjeta login */}
      <div style={{
        width: '100%', maxWidth: 384,
        backgroundColor: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 22,
        padding: 30,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
      }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" required
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 14,
                backgroundColor: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.18)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Contraseña
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 14,
                backgroundColor: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.18)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(82,176,67,0.3)' : 'linear-gradient(135deg, #52B043, #3a8a2e)',
            color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 4,
            boxShadow: loading ? 'none' : '0 4px 20px rgba(82,176,67,0.35)',
            transition: 'all 0.2s'
          }}>
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
            ¿Primera vez?{' '}
            <Link href="/register" style={{ color: '#6FCF5F', fontWeight: 600, textDecoration: 'none' }}>
              Regístrate con tu código
            </Link>
          </p>
        </div>
      </div>

      {/* Pizarra táctica decorativa */}
      <div style={{ marginTop: 32, textAlign: 'center', opacity: 0.25 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          <span>🖊️</span>
          <span>Entrenamientos · Tácticas · Estadísticas</span>
          <span>🏀</span>
        </div>
      </div>
    </div>
  )
}
