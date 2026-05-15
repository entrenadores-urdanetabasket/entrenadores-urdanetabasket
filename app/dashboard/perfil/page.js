'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export default function PerfilPage() {
  const { user, profile, supabase } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [coachRole, setCoachRole] = useState('principal')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
    else { setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 3000) }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    backgroundColor: '#fff', border: '1.5px solid #e5e7eb', color: '#111827',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s'
  }

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  return (
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Mi Perfil</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Actualiza tu información personal</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 560 }}>

        {/* Avatar y nombre */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 26, fontWeight: 900
            }}>
              {fullName?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{fullName || 'Sin nombre'}</div>
              <div style={{ fontSize: 13, color: '#52B043', fontWeight: 600, marginTop: 2 }}>
                {profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nombre completo *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nombre y apellidos" required style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            </div>

            <div>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Ej: 600 123 456" style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Visible para el director deportivo</p>
            </div>

            {profile?.role !== 'director' && (
              <div>
                <label style={labelStyle}>Rol en el equipo</label>
                <select value={coachRole} onChange={e => setCoachRole(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => e.target.style.borderColor = '#52B043'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                  <option value="principal">Entrenador principal</option>
                  <option value="ayudante">Entrenador ayudante</option>
                  <option value="preparador">Preparador físico</option>
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={user?.email || ''} disabled
                style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>El email no se puede cambiar</p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontSize: 13 }}>{error}</div>
            )}

            {saved && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                ✓ Perfil guardado correctamente
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              padding: '12px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
              color: saving ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700,
              boxShadow: saving ? 'none' : '0 2px 12px rgba(82,176,67,0.3)',
              transition: 'all 0.2s'
            }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Info de cuenta */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Información de cuenta</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Tipo de cuenta', value: profile?.role === 'director' ? 'Director Deportivo' : 'Entrenador' },
              { label: 'Miembro desde', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : '-' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
