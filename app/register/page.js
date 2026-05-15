'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [inviteCode, setInviteCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  function handleCheckCode(e) {
    e.preventDefault()
    setError('')
    if (inviteCode.trim().toUpperCase() !== 'URDANETA2026') {
      setError('Código incorrecto. Pídelo al director deportivo.')
      return
    }
    setStep(2)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role: 'coach' } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else setSuccess(true)
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', outline: 'none', boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12,
    fontWeight: 600, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase'
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a1a0a,#1a3a1a,#0f2a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 10 }}>¡Ya eres del equipo!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Tu cuenta ha sido creada. El director deportivo te asignará un equipo en breve. Ya puedes iniciar sesión.
          </p>
          <Link href="/login" style={{
            display: 'block', padding: '14px', borderRadius: 12, textAlign: 'center',
            background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(82,176,67,0.35)'
          }}>
            Iniciar sesión →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a1a0a 0%,#1a3a1a 50%,#0f2a0f 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Decoración cancha */}
      {[600, 400, 180].map(size => (
        <div key={size} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: size, height: size, borderRadius: '50%',
          border: '1px solid rgba(82,176,67,0.06)', pointerEvents: 'none'
        }} />
      ))}
      <div style={{ position: 'absolute', top: 40, right: 60, fontSize: 80, opacity: 0.07, transform: 'rotate(15deg)', pointerEvents: 'none' }}>🏀</div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 80, height: 80, margin: '0 auto 16px',
          background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 10,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <img src="/logo.png" alt="Urdaneta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>Club Deportivo Urdaneta</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Crear cuenta</p>
      </div>

      {/* Indicador pasos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {[{ n: 1, label: 'Código' }, { n: 2, label: 'Datos' }].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              backgroundColor: step >= n ? '#52B043' : 'rgba(255,255,255,0.08)',
              color: step >= n ? '#fff' : 'rgba(255,255,255,0.3)',
              border: `1.5px solid ${step >= n ? '#52B043' : 'rgba(255,255,255,0.15)'}`
            }}>{n}</div>
            <span style={{ color: step >= n ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600 }}>{label}</span>
            {i < 1 && <div style={{ width: 24, height: 1, backgroundColor: step > n ? '#52B043' : 'rgba(255,255,255,0.15)' }} />}
          </div>
        ))}
      </div>

      {/* Tarjeta */}
      <div style={{
        width: '100%', maxWidth: 380,
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 32,
        backdropFilter: 'blur(20px)'
      }}>
        {step === 1 ? (
          <>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Código de invitación</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 24px' }}>Pídelo al director deportivo del club</p>
            <form onSubmit={handleCheckCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Código</label>
                <input
                  type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                  placeholder="XXXXXXXX0000" required
                  style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }}
                  onFocus={e => e.target.style.borderColor = '#52B043'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {error && <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
              <button type="submit" style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
                fontSize: 15, fontWeight: 700, boxShadow: '0 4px 20px rgba(82,176,67,0.35)'
              }}>
                Verificar código →
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Tus datos</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 24px' }}>Rellena tu información para registrarte</p>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre completo', type: 'text', value: fullName, setter: setFullName, placeholder: 'Ej: Jon Urrutia' },
                { label: 'Email', type: 'email', value: email, setter: setEmail, placeholder: 'tu@email.com' },
                { label: 'Contraseña', type: 'password', value: password, setter: setPassword, placeholder: '••••••••' },
                { label: 'Repite contraseña', type: 'password', value: password2, setter: setPassword2, placeholder: '••••••••' },
              ].map(({ label, type, value, setter, placeholder }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={value} onChange={e => setter(e.target.value)}
                    placeholder={placeholder} required style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#52B043'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              ))}
              {error && <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(82,176,67,0.3)' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
                color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 4,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(82,176,67,0.35)'
              }}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
              </button>
              <button type="button" onClick={() => { setStep(1); setError('') }} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                fontSize: 13, cursor: 'pointer', padding: '4px 0'
              }}>
                ← Volver
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" style={{ color: '#6FCF5F', fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
