'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Icon from '@/components/Icons'

const FEATURES = [
  { icon: 'check', text: 'Asistencia al día' },
  { icon: 'chart', text: 'Estadísticas en directo' },
  { icon: 'ball', text: 'Pizarra táctica' },
  { icon: 'clipboard', text: 'Convocatorias' },
]
const TICKER = ['Asistencia', 'Estadísticas en directo', 'Pizarra táctica', 'Convocatorias', 'Entrenamientos', 'Mapa de tiros', 'Box score', 'Defensa en zona']

// Partículas de polvo en el aire de la pista (decorativo)
function Dust() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const N = 70
    const ps = Array.from({ length: N }, () => ({
      x: Math.random() * 1400, y: Math.random() * 900, r: Math.random() * 1.8 + 0.4,
      v: Math.random() * 0.22 + 0.05, dx: (Math.random() - 0.5) * 0.12,
      c: Math.random() < 0.25 ? '255,150,60' : '150,235,130', a: Math.random() * 0.4 + 0.12,
    }))
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        p.y -= p.v; p.x += p.dx
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w }
        if (p.x < -5) p.x = w + 5
        if (p.x > w + 5) p.x = -5
        ctx.beginPath(); ctx.fillStyle = `rgba(${p.c},${p.a})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="lg-dust" />
}

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

  return (
    <div className="lg-root">
      {/* ── Escena ── */}
      <div className="lg-glow" />
      <div className="lg-beam b1" /><div className="lg-beam b2" /><div className="lg-beam b3" />
      <div className="lg-floor">
        <div className="lg-court">
          <svg viewBox="0 0 940 500" preserveAspectRatio="none" className="lg-court-svg">
            <g fill="rgba(82,176,67,0.16)" stroke="none">
              <rect x="10" y="170" width="190" height="160" /><rect x="740" y="170" width="190" height="160" />
              <circle cx="470" cy="250" r="60" fill="rgba(255,122,26,0.10)" />
            </g>
            <g fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="3.2" strokeLinecap="round">
              <rect x="10" y="10" width="920" height="480" />
              <path d="M470 10V490" />
              <circle cx="470" cy="250" r="60" /><circle cx="470" cy="250" r="18" />
              <rect x="10" y="170" width="190" height="160" /><rect x="740" y="170" width="190" height="160" />
              <path d="M200 190A60 60 0 0 1 200 310" /><path d="M200 190A60 60 0 0 0 200 310" strokeDasharray="8 9" />
              <path d="M740 190A60 60 0 0 0 740 310" /><path d="M740 190A60 60 0 0 1 740 310" strokeDasharray="8 9" />
              <path d="M10 52H148A220 220 0 0 1 148 448H10" /><path d="M930 52H792A220 220 0 0 0 792 448H930" />
              <path d="M52 232V268" strokeWidth="5" /><path d="M888 232V268" strokeWidth="5" />
            </g>
            <g fill="none" stroke="#ff7a1a" strokeWidth="3.4"><circle cx="64" cy="250" r="10" /><circle cx="876" cy="250" r="10" /></g>
          </svg>
        </div>
      </div>
      <Dust />

      {/* Balón botando con su sombra */}
      <div className="lg-ball-wrap" aria-hidden="true">
        <div className="lg-ball">
          <svg viewBox="-60 -60 120 120" width="100%" height="100%">
            <defs>
              <radialGradient id="lgb" cx="35%" cy="30%" r="80%">
                <stop offset="0" stopColor="#ffbd7a" /><stop offset="0.5" stopColor="#ff7a1a" /><stop offset="1" stopColor="#b93d08" />
              </radialGradient>
            </defs>
            <g className="lg-spin">
              <circle r="56" fill="url(#lgb)" />
              <g fill="none" stroke="#5b2005" strokeOpacity="0.85" strokeWidth="2.6">
                <circle r="56" /><path d="M-56 0H56M0 -56V56" /><path d="M-40 -40Q0 0 -40 40M40 -40Q0 0 40 40" />
              </g>
            </g>
          </svg>
        </div>
        <div className="lg-ball-shadow" />
      </div>

      {/* ── Contenido ── */}
      <div className="lg-content">
        <header className="lg-top">
          <div className="lg-logo"><img src="/logo.png" alt="C.D. Urdaneta" /></div>
          <div>
            <div className="lg-club">C.D. Urdaneta</div>
            <div className="lg-sub">Portal de entrenadores</div>
          </div>
        </header>

        <div className="lg-main">
          <section className="lg-hero">
            <div className="lg-eyebrow"><span /> Temporada 2026-2027</div>
            <h1 className="lg-headline">Todo tu equipo,<br />en un solo sitio.</h1>
            <p className="lg-lead">Plantillas, asistencia, entrenamientos y partidos del club, con las herramientas de un equipo profesional.</p>
            <div className="lg-chips">
              {FEATURES.map(f => <span key={f.text} className="lg-chip"><Icon name={f.icon} size={14} /> {f.text}</span>)}
            </div>
          </section>

          <section className="lg-card">
            <h2>Bienvenido</h2>
            <p>Inicia sesión para acceder a tu panel.</p>
            <form onSubmit={handleLogin}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required autoComplete="email" />

              <label htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{ paddingRight: 76 }} />
                <button type="button" className="lg-eye" onClick={() => setShowPw(s => !s)}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
              </div>

              {error && <div className="lg-error">{error}</div>}

              <button type="submit" disabled={loading} className="lg-submit">
                {loading ? 'Entrando…' : 'Iniciar sesión'}
              </button>
            </form>
            <div className="lg-foot">¿Primera vez? <Link href="/register">Regístrate con tu código</Link></div>
          </section>
        </div>
      </div>

      {/* Cinta de marcador */}
      <div className="lg-ticker" aria-hidden="true">
        <div className="lg-ticker-track">
          {[0, 1].map(k => (
            <div key={k} className="lg-ticker-row">
              {TICKER.map(t => <span key={t + k}>{t}<i /></span>)}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .lg-root { position: relative; min-height: 100vh; overflow: hidden; color: #fff; background: #040d07; isolation: isolate; }
        .lg-glow { position: absolute; inset: 0; z-index: -5; background:
          radial-gradient(900px 520px at 18% 8%, rgba(82,176,67,0.30), transparent 65%),
          radial-gradient(700px 480px at 92% 30%, rgba(255,122,26,0.12), transparent 65%),
          linear-gradient(180deg, #06150a 0%, #0a2412 55%, #04100a 100%); }

        /* Focos de pabellón */
        .lg-beam { position: absolute; top: -8%; height: 78%; width: 30vw; z-index: -4; pointer-events: none; filter: blur(14px); opacity: .9;
          background: linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(190,255,180,0.06) 55%, transparent 90%);
          clip-path: polygon(46% 0, 54% 0, 100% 100%, 0 100%); transform-origin: 50% 0; animation: lgSway 10s ease-in-out infinite alternate; }
        .lg-beam.b1 { left: 4%; } .lg-beam.b2 { left: 36%; animation-delay: -3s; animation-duration: 12s; opacity: .7; } .lg-beam.b3 { right: 2%; animation-delay: -6s; }
        @keyframes lgSway { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }

        /* Pista en perspectiva */
        .lg-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 64%; z-index: -3; perspective: 760px; overflow: hidden; pointer-events: none;
          -webkit-mask-image: linear-gradient(to top, #000 30%, transparent 98%); mask-image: linear-gradient(to top, #000 30%, transparent 98%); }
        .lg-court { position: absolute; left: 50%; bottom: -14%; width: 1900px; height: 1020px; transform: translateX(-50%) rotateX(63deg); transform-origin: 50% 100%;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 56px),
            repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 160px),
            linear-gradient(180deg, #0f3a1c, #123f20 60%, #0c2f17);
          box-shadow: 0 0 120px rgba(82,176,67,0.35) inset; animation: lgFloor 14s ease-in-out infinite alternate; }
        @keyframes lgFloor { from { filter: brightness(0.9); } to { filter: brightness(1.15); } }
        .lg-court-svg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 0 7px rgba(150,235,130,0.75)); }

        .lg-dust { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -2; pointer-events: none; }

        /* Balón */
        .lg-ball-wrap { position: absolute; left: 46%; bottom: 12%; width: 104px; z-index: 0; pointer-events: none; }
        .lg-ball { width: 104px; height: 104px; animation: lgBounce 1.7s infinite; filter: drop-shadow(0 12px 18px rgba(0,0,0,0.45)); }
        .lg-spin { transform-origin: 0 0; animation: lgSpin 1.7s linear infinite; }
        .lg-ball-shadow { position: absolute; left: 50%; bottom: -14px; width: 104px; height: 20px; margin-left: -52px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(0,0,0,0.6), transparent); animation: lgShadow 1.7s infinite; }
        @keyframes lgBounce { 0% { transform: translateY(-165px); animation-timing-function: cubic-bezier(.55,0,1,.45); } 50% { transform: translateY(0) scale(1.06, 0.94); animation-timing-function: cubic-bezier(0,.55,.45,1); } 56% { transform: translateY(-2px); } 100% { transform: translateY(-165px); } }
        @keyframes lgShadow { 0%,100% { transform: scale(.45); opacity: .25; } 50% { transform: scale(1); opacity: .75; } }
        @keyframes lgSpin { to { transform: rotate(360deg); } }

        /* Contenido */
        .lg-content { position: relative; z-index: 2; min-height: 100vh; padding: 34px 56px 76px; display: flex; flex-direction: column; }
        .lg-top { display: flex; align-items: center; gap: 14px; }
        .lg-logo { width: 58px; height: 58px; border-radius: 17px; padding: 7px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 0 36px rgba(82,176,67,0.45); backdrop-filter: blur(8px); }
        .lg-logo img { width: 100%; height: 100%; object-fit: contain; }
        .lg-club { font-family: var(--font-display), sans-serif; font-size: 26px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; line-height: 1; }
        .lg-sub { color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
        .lg-main { flex: 1; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 48px; align-items: center; padding-top: 18px; }
        .lg-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-size: 11.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #ffb27a; margin-bottom: 16px; }
        .lg-eyebrow span { width: 28px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, #ff7a1a, #ffb066); box-shadow: 0 0 12px rgba(255,122,26,0.7); }
        .lg-headline { font-family: var(--font-display), sans-serif; text-transform: uppercase; font-weight: 800; font-size: clamp(54px, 7.2vw, 108px); line-height: 0.9; letter-spacing: 0.5px; margin: 0 0 22px;
          text-shadow: 0 6px 40px rgba(0,0,0,0.5); }
        .lg-lead { color: rgba(255,255,255,0.7); font-size: 16.5px; line-height: 1.55; max-width: 470px; margin: 0 0 24px; }
        .lg-chips { display: flex; flex-wrap: wrap; gap: 9px; max-width: 520px; }
        .lg-chip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: #d7ffd0;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(160,240,140,0.22); backdrop-filter: blur(8px); }

        .lg-card { width: 100%; max-width: 420px; justify-self: end; padding: 32px 30px 26px; border-radius: 26px; background: linear-gradient(160deg, rgba(14,40,23,0.78), rgba(6,20,11,0.82));
          border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(22px) saturate(1.3); box-shadow: 0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
          animation: lgRise .9s .1s cubic-bezier(.2,.8,.2,1) both; position: relative; }
        .lg-card::before { content: ''; position: absolute; left: 30px; right: 30px; top: -1px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, #ff7a1a, #ffb066, transparent); }
        @keyframes lgRise { from { opacity: 0; transform: translateY(28px) scale(.97); } to { opacity: 1; transform: none; } }
        .lg-card h2 { font-family: var(--font-display), sans-serif; text-transform: uppercase; font-size: 36px; font-weight: 800; letter-spacing: 0.6px; margin: 0 0 4px; line-height: 1; }
        .lg-card > p { color: rgba(255,255,255,0.55); font-size: 14px; margin: 0 0 22px; }
        .lg-card form { display: flex; flex-direction: column; }
        .lg-card label { font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0 0 7px; }
        .lg-card input { width: 100%; box-sizing: border-box; padding: 14px 16px; border-radius: 13px; font-size: 15px; color: #fff; outline: none; margin-bottom: 16px;
          background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.14); transition: all .2s; }
        .lg-card input::placeholder { color: rgba(255,255,255,0.32); }
        .lg-card input:focus { border-color: #52B043; background: rgba(255,255,255,0.11); box-shadow: 0 0 0 4px rgba(82,176,67,0.22); }
        .lg-eye { position: absolute; right: 8px; top: 8px; border: none; background: transparent; color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 8px; }
        .lg-eye:hover { color: #fff; }
        .lg-error { padding: 11px 14px; border-radius: 11px; background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.32); color: #fecaca; font-size: 13px; font-weight: 600; margin: -2px 0 14px; }
        .lg-submit { position: relative; overflow: hidden; width: 100%; padding: 15px; border: none; border-radius: 13px; cursor: pointer; font-size: 15.5px; font-weight: 800; letter-spacing: 0.3px; color: #fff;
          background: linear-gradient(135deg, #5cc24a, #2f8a3d); box-shadow: 0 10px 28px rgba(63,154,51,0.45), inset 0 1px 0 rgba(255,255,255,0.3); transition: transform .2s, box-shadow .2s; }
        .lg-submit::before { content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent); transform: skewX(-18deg); }
        .lg-submit:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(63,154,51,0.55), inset 0 1px 0 rgba(255,255,255,0.3); }
        .lg-submit:hover::before { animation: lgShine .8s ease; }
        .lg-submit:disabled { opacity: .65; cursor: not-allowed; transform: none; }
        @keyframes lgShine { to { left: 130%; } }
        .lg-foot { margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.09); text-align: center; color: rgba(255,255,255,0.5); font-size: 13.5px; }
        .lg-foot a { color: #86e374; font-weight: 700; }

        /* Cinta inferior */
        .lg-ticker { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; height: 46px; overflow: hidden; display: flex; align-items: center;
          background: rgba(4,14,8,0.72); border-top: 1px solid rgba(255,255,255,0.09); backdrop-filter: blur(10px); }
        .lg-ticker-track { display: flex; width: max-content; animation: lgTicker 38s linear infinite; }
        .lg-ticker-row { display: flex; }
        .lg-ticker-row span { display: inline-flex; align-items: center; font-family: var(--font-display), sans-serif; font-size: 17px; font-weight: 600; text-transform: uppercase; letter-spacing: 2.4px; color: rgba(255,255,255,0.7); padding: 0 26px; white-space: nowrap; }
        .lg-ticker-row i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 52px; background: radial-gradient(circle at 35% 30%, #ffb066, #ff7a1a 60%, #b93d08); }
        @keyframes lgTicker { to { transform: translateX(-50%); } }

        @media (max-width: 960px) {
          .lg-content { padding: 22px 20px 70px; }
          .lg-main { grid-template-columns: 1fr; gap: 26px; padding-top: 28px; }
          .lg-hero { text-align: left; }
          .lg-headline { font-size: clamp(46px, 14vw, 78px); }
          .lg-lead { font-size: 15px; }
          .lg-chips { display: none; }
          .lg-card { justify-self: center; padding: 26px 22px 22px; }
          .lg-ball-wrap { left: auto; right: 6%; bottom: 10%; width: 70px; opacity: .85; }
          .lg-ball { width: 70px; height: 70px; } .lg-ball-shadow { width: 70px; margin-left: -35px; }
          .lg-court { width: 1300px; }
        }
        @media (prefers-reduced-motion: reduce) { .lg-ball, .lg-spin, .lg-ball-shadow, .lg-beam, .lg-court, .lg-ticker-track { animation: none !important; } }
      `}</style>
    </div>
  )
}
