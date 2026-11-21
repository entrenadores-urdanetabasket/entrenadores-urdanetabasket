'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/Icons'

const FEATURES = [
  { icon: 'check', title: 'Asistencia al día', text: 'Pasa lista en segundos y consulta la evolución de cada jugador.' },
  { icon: 'chart', title: 'Estadísticas en directo', text: 'Marcador, mapa de tiros y box score durante el partido.' },
  { icon: 'ball', title: 'Pizarra táctica', text: 'Diseña jugadas y defensas en zona y compártelas con tu equipo.' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
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

  const fieldStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 14.5,
    backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0',
    color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
  }
  const focus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.16)'; e.target.style.backgroundColor = '#fff' }
  const blur = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#f8fafc' }
  const labelStyle = { display: 'block', color: '#475569', fontSize: 12, fontWeight: 700, marginBottom: 7, letterSpacing: 0.2 }

  return (
    <div className="login-shell">
      {/* Panel de marca */}
      <aside className="login-brand">
        <div className="login-court" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 62, height: 62, borderRadius: 18, padding: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 0 36px rgba(82,176,67,0.35)' }}>
              <img src="/logo.png" alt="C.D. Urdaneta" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>C.D. Urdaneta</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', marginTop: 2 }}>Portal de entrenadores</div>
            </div>
          </div>

          <h1 className="login-headline">Todo tu equipo,<br />en un solo sitio.</h1>
          <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 15, lineHeight: 1.55, maxWidth: 420, margin: '0 0 34px' }}>
            Gestiona plantillas, asistencia, entrenamientos y partidos del club con las herramientas que usan los equipos profesionales.
          </p>

          <div style={{ display: 'grid', gap: 16, maxWidth: 440 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7bd96a', background: 'rgba(123,217,106,0.12)', border: '1px solid rgba(123,217,106,0.22)' }}>
                  <Icon name={f.icon} size={18} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14.5 }}>{f.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2, lineHeight: 1.45 }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.32)', fontSize: 12, fontWeight: 500 }}>
          © {new Date().getFullYear()} Club Deportivo Urdaneta
        </div>
      </aside>

      {/* Formulario */}
      <main className="login-form-side">
        <div style={{ width: '100%', maxWidth: 396 }}>
          <img src="/logo.png" alt="" className="login-mobile-logo" />
          <h2 style={{ fontSize: 27, fontWeight: 800, color: '#0f172a', letterSpacing: -0.8, margin: '0 0 6px' }}>Bienvenido de nuevo</h2>
          <p style={{ color: '#64748b', fontSize: 14.5, margin: '0 0 28px' }}>Inicia sesión para acceder a tu panel.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle} htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required autoComplete="email"
                style={fieldStyle} onFocus={focus} onBlur={blur} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"
                  style={{ ...fieldStyle, paddingRight: 64 }} onFocus={focus} onBlur={blur} />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 8px' }}>
                  {showPw ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '11px 14px', borderRadius: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 4, ...(loading ? { opacity: 0.65, cursor: 'not-allowed' } : {}) }}>
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid #eef2f7', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: 13.5, margin: 0 }}>
              ¿Primera vez?{' '}
              <Link href="/register" style={{ color: '#2d7a3a', fontWeight: 700 }}>Regístrate con tu código</Link>
            </p>
          </div>
        </div>
      </main>

      <style>{`
        .login-shell { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); background: #fff; }
        .login-brand {
          position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px 56px; background:
            radial-gradient(520px 340px at 0% 0%, rgba(82,176,67,0.32), transparent 70%),
            radial-gradient(420px 320px at 100% 100%, rgba(82,176,67,0.14), transparent 70%),
            linear-gradient(160deg, #07170b 0%, #0d2414 55%, #12301b 100%);
        }
        .login-court {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.9;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800' fill='none' stroke='%237bd96a' stroke-opacity='0.09' stroke-width='2'><circle cx='300' cy='400' r='120'/><circle cx='300' cy='400' r='250'/><line x1='0' y1='400' x2='600' y2='400'/><rect x='170' y='0' width='260' height='190'/><rect x='170' y='610' width='260' height='190'/></svg>");
          background-size: cover; background-position: center;
        }
        .login-headline { color: #fff; font-size: 44px; font-weight: 800; letter-spacing: -1.6px; line-height: 1.05; margin: 64px 0 18px; }
        .login-form-side { display: flex; align-items: center; justify-content: center; padding: 40px 28px; background: radial-gradient(600px 300px at 80% -40px, rgba(82,176,67,0.07), transparent 70%), #fff; }
        .login-mobile-logo { display: none; width: 64px; height: 64px; object-fit: contain; margin-bottom: 18px; }
        @media (max-width: 900px) {
          .login-shell { grid-template-columns: 1fr; }
          .login-brand { display: none; }
          .login-form-side { min-height: 100vh; align-items: flex-start; padding-top: calc(56px + env(safe-area-inset-top)); }
          .login-mobile-logo { display: block; }
        }
      `}</style>
    </div>
  )
}
