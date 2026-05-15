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
      setError('Código de invitación incorrecto. Contacta con el director deportivo.')
      return
    }
    setStep(2)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'coach' } }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0D150D' }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl"
            style={{ background: 'linear-gradient(135deg, #52B043, #1C5C2A)', boxShadow: '0 4px 20px rgba(82,176,67,0.4)' }}>
            ✓
          </div>
          <h2 className="text-2xl font-black text-white mb-3">¡Registro completado!</h2>
          <p className="text-sm mb-8" style={{ color: '#7A9A78' }}>
            Tu cuenta ha sido creada. El director deportivo te asignará un equipo en breve.
          </p>
          <Link href="/login"
            className="block w-full py-3 rounded-xl font-bold text-white text-sm text-center"
            style={{ background: 'linear-gradient(135deg, #52B043, #1C5C2A)', boxShadow: '0 4px 20px rgba(82,176,67,0.3)' }}>
            Ir al login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0D150D' }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="Urdaneta" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Club Deportivo Urdaneta</p>
            <p className="text-xs" style={{ color: '#7A9A78' }}>Portal de Entrenadores</p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  backgroundColor: step >= s ? '#52B043' : '#162016',
                  color: step >= s ? 'white' : '#4A6A48',
                  border: `1.5px solid ${step >= s ? '#52B043' : '#2A3D2A'}`
                }}>
                {s}
              </div>
              <span className="text-xs font-medium" style={{ color: step >= s ? '#F0F7EE' : '#4A6A48' }}>
                {s === 1 ? 'Código' : 'Datos'}
              </span>
              {s < 2 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: step > s ? '#52B043' : '#2A3D2A', width: '40px' }} />}
            </div>
          ))}
        </div>

        {/* Paso 1: código de invitación */}
        {step === 1 && (
          <>
            <h2 className="text-3xl font-black text-white mb-2">Únete al equipo</h2>
            <p className="mb-8 text-sm" style={{ color: '#7A9A78' }}>
              Introduce el código que te ha dado el director deportivo
            </p>
            <form onSubmit={handleCheckCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A9A78' }}>
                  Código de invitación
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="XXXXXXXX0000"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all uppercase tracking-widest font-bold"
                  style={{ backgroundColor: '#162016', border: '1.5px solid #2A3D2A' }}
                  onFocus={e => e.target.style.borderColor = '#52B043'}
                  onBlur={e => e.target.style.borderColor = '#2A3D2A'}
                />
              </div>
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <button type="submit"
                className="w-full py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #52B043, #1C5C2A)', boxShadow: '0 4px 20px rgba(82,176,67,0.3)' }}>
                Verificar código →
              </button>
            </form>
          </>
        )}

        {/* Paso 2: datos de la cuenta */}
        {step === 2 && (
          <>
            <h2 className="text-3xl font-black text-white mb-2">Crea tu cuenta</h2>
            <p className="mb-8 text-sm" style={{ color: '#7A9A78' }}>Rellena tus datos para registrarte</p>
            <form onSubmit={handleRegister} className="space-y-4">
              {[
                { label: 'Nombre completo', type: 'text', value: fullName, setter: setFullName, placeholder: 'Ej: Jon Urrutia' },
                { label: 'Email', type: 'email', value: email, setter: setEmail, placeholder: 'tu@email.com' },
                { label: 'Contraseña', type: 'password', value: password, setter: setPassword, placeholder: '••••••••' },
                { label: 'Repite contraseña', type: 'password', value: password2, setter: setPassword2, placeholder: '••••••••' },
              ].map(({ label, type, value, setter, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A9A78' }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                    style={{ backgroundColor: '#162016', border: '1.5px solid #2A3D2A' }}
                    onFocus={e => e.target.style.borderColor = '#52B043'}
                    onBlur={e => e.target.style.borderColor = '#2A3D2A'}
                  />
                </div>
              ))}
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: loading ? '#2A3D2A' : 'linear-gradient(135deg, #52B043, #1C5C2A)', boxShadow: loading ? 'none' : '0 4px 20px rgba(82,176,67,0.3)' }}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
              </button>
              <button type="button" onClick={() => { setStep(1); setError('') }}
                className="w-full py-2 text-sm font-medium transition-colors"
                style={{ color: '#7A9A78' }}>
                ← Volver
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid #2A3D2A' }}>
          <p className="text-sm" style={{ color: '#7A9A78' }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#52B043' }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
