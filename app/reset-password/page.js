'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking]   = useState(true)

  useEffect(() => {
    // Supabase procesa automáticamente el token del hash de la URL
    // y establece una sesión de tipo "recovery"
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidSession(true)
      }
      setChecking(false)
    })

    // También comprobamos si ya hay sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setValidSession(true); setChecking(false) }
      else setChecking(false)
    })
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Error al cambiar la contraseña: ' + err.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 2500)
    }
  }

  const inputStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 15,
    border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f3f8' }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Verificando enlace...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            boxShadow: '0 8px 24px rgba(28,92,42,0.30)'
          }}>🏀</div>
          <h1 style={{ fontSize: 23, fontWeight: 900, color: '#0f172a', margin: '0 0 5px', letterSpacing: -0.4 }}>Nueva contraseña</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>C.D. Urdaneta · Entrenadores</p>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid #e8edf3' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Contraseña actualizada
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Redirigiendo al dashboard...
              </div>
            </div>
          ) : !validSession ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Enlace no válido o caducado
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                Pide al director que envíe un nuevo email de recuperación.
              </div>
              <button onClick={() => router.replace('/login')} className="btn-primary">Ir al login</button>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px', fontWeight: 500 }}>
                Elige una contraseña nueva para tu cuenta.
              </p>

              <div>
                <label className="label-field">
                  Nueva contraseña
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div>
                <label className="label-field">
                  Confirmar contraseña
                </label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña" required style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                padding: '14px', borderRadius: 12, border: 'none',
                background: loading ? '#e2e8f0' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
                color: loading ? '#94a3b8' : '#fff',
                fontSize: 15, fontWeight: 800, letterSpacing: -0.2,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(82,176,67,0.35)',
                marginTop: 4, transition: 'all 0.2s',
              }}>
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
