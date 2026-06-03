'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export default function PerfilPage() {
  const { user, profile, supabase, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [coachRole, setCoachRole] = useState('principal')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Cambiar contraseña
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [savedPwd, setSavedPwd] = useState(false)
  const [errorPwd, setErrorPwd] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setCoachRole(profile.coach_role || 'principal')
    }
  }, [profile])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, coach_role: coachRole, profile_completed: true })
      .eq('id', user.id)

    if (error) { setError('Error al guardar. Inténtalo de nuevo.'); setSaving(false) }
    else { await refreshProfile(); setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 3000) }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setErrorPwd('')
    setSavedPwd(false)
    if (newPassword.length < 6) { setErrorPwd('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPassword !== confirmPassword) { setErrorPwd('Las contraseñas no coinciden'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setErrorPwd('Error al cambiar la contraseña: ' + error.message); setSavingPwd(false) }
    else {
      setSavedPwd(true)
      setNewPassword('')
      setConfirmPassword('')
      setSavingPwd(false)
      setTimeout(() => setSavedPwd(false), 3000)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    backgroundColor: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s'
  }

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7 }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  return (
    <div className="fade-in">
      {/* Cabecera — banner verde */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)', maxWidth: 560,
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Mi Perfil</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>Actualiza tu información personal</p>
        </div>
        <div style={{ fontSize: 48, opacity: 0.35 }}>👤</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 560 }}>

        {/* Avatar y nombre */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #eef2f7' }}>
            <div style={{
              width: 68, height: 68, borderRadius: 18, flexShrink: 0,
              background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 27, fontWeight: 900,
              boxShadow: '0 4px 14px rgba(28,92,42,0.30)'
            }}>
              {fullName?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', letterSpacing: -0.3 }}>{fullName || 'Sin nombre'}</div>
              <div style={{ fontSize: 13, color: '#15803d', fontWeight: 700, marginTop: 3 }}>
                {profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nombre completo *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nombre y apellidos" required style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            <div>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Ej: 600 123 456" style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Visible para el director deportivo</p>
            </div>

            {profile?.role !== 'director' && (
              <div>
                <label style={labelStyle}>Rol en el equipo</label>
                <select value={coachRole} onChange={e => setCoachRole(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={inputFocus} onBlur={inputBlur}>
                  <option value="principal">Entrenador principal</option>
                  <option value="ayudante">Entrenador ayudante</option>
                  <option value="preparador">Preparador físico</option>
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={user?.email || ''} disabled
                style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>El email no se puede cambiar</p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontSize: 13 }}>{error}</div>
            )}

            {saved && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                ✓ Perfil guardado correctamente
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary" style={{
              padding: '13px', width: '100%',
              ...(saving ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {})
            }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <h3 className="section-title" style={{ fontSize: 14, margin: '0 0 16px' }}>🔒 Cambiar contraseña</h3>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div>
              <label style={labelStyle}>Confirmar nueva contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña" required style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            {errorPwd && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontSize: 13 }}>{errorPwd}</div>
            )}
            {savedPwd && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                ✓ Contraseña actualizada correctamente
              </div>
            )}
            <button type="submit" disabled={savingPwd} style={{
              padding: '13px', borderRadius: 10, border: 'none', cursor: savingPwd ? 'not-allowed' : 'pointer',
              background: savingPwd ? '#e2e8f0' : 'linear-gradient(135deg,#334155,#0f172a)',
              color: savingPwd ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
              boxShadow: savingPwd ? 'none' : '0 2px 8px rgba(15,23,42,0.20)'
            }}>
              {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>

        {/* Info de cuenta */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <h3 className="section-title" style={{ fontSize: 14, margin: '0 0 12px' }}>Información de cuenta</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Tipo de cuenta', value: profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador' },
              { label: 'Miembro desde', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : '-' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
