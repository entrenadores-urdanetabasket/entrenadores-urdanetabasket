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
    <div className="min-h-screen flex" style={{ backgroundColor: '#0D150D' }}>

      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A120A 0%, #1C5C2A 60%, #52B043 100%)' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #52B043 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Urdaneta" className="w-12 h-12 object-contain" />
            <div>
              <p className="text-white font-bold text-lg leading-tight">Club Deportivo</p>
              <p className="font-black text-2xl leading-tight" style={{ color: '#6FCF5F' }}>Urdaneta</p>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Tu equipo,<br />
            <span style={{ color: '#6FCF5F' }}>tu herramienta.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }} className="text-lg">
            Gestiona tu plantilla, asistencia, tácticas y estadísticas en un solo lugar.
          </p>
        </div>
        <div className="relative z-10 flex gap-6">
          {['23 equipos', '28 entrenadores', 'Todo en uno'].map(t => (
            <div key={t}>
              <p className="text-white font-bold text-sm">{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Logo móvil */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img src="/logo.png" alt="Urdaneta" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Club Deportivo Urdaneta</p>
              <p className="text-xs" style={{ color: '#7A9A78' }}>Portal de Entrenadores</p>
            </div>
          </div>

          <h2 className="text-3xl font-black text-white mb-2">Bienvenido</h2>
          <p className="mb-8 text-sm" style={{ color: '#7A9A78' }}>Inicia sesión para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A9A78' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{ backgroundColor: '#162016', border: '1.5px solid #2A3D2A' }}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#2A3D2A'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A9A78' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{ backgroundColor: '#162016', border: '1.5px solid #2A3D2A' }}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#2A3D2A'}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all mt-2"
              style={{ background: loading ? '#2A3D2A' : 'linear-gradient(135deg, #52B043, #1C5C2A)', boxShadow: loading ? 'none' : '0 4px 20px rgba(82,176,67,0.3)' }}
            >
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>

          <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid #2A3D2A' }}>
            <p className="text-sm" style={{ color: '#7A9A78' }}>
              ¿Primera vez?{' '}
              <Link href="/register" className="font-semibold transition-colors" style={{ color: '#52B043' }}>
                Regístrate con tu código
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
