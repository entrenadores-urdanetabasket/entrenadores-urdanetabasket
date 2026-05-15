'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message || 'Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1C5C2A 0%, #52B043 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo y nombre del club */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-lg mb-4 p-2">
            <img src="/logo.png" alt="Club Deportivo Urdaneta" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-white text-2xl font-bold">Club Deportivo Urdaneta</h1>
          <p className="text-green-100 text-sm mt-1">Portal de Entrenadores</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1C5C2A' }}>Iniciar sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#5A7A5A' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#D8E8D8', color: '#1A2A1A' }}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#D8E8D8'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#5A7A5A' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#D8E8D8', color: '#1A2A1A' }}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#D8E8D8'}
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-all mt-2"
              style={{ backgroundColor: loading ? '#8FCC85' : '#52B043' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-green-200 text-xs mt-6">
          ¿Problemas para acceder? Contacta con el director deportivo.
        </p>
      </div>
    </div>
  )
}
