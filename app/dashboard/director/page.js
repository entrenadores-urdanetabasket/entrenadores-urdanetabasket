'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Premini', 'Mini', 'Infantil', 'Cadete', 'Junior', 'Senior', 'Femenino Senior', 'Femenino Junior']
const SEASONS = ['2024-2025', '2025-2026', '2026-2027']

export default function DirectorPage() {
  const { profile, supabase } = useAuth()
  const router = useRouter()
  const [teams, setTeams] = useState([])
  const [coaches, setCoaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'Senior', season: '2025-2026', gender: 'masculino', coach_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (profile && profile.role !== 'director') router.replace('/dashboard')
    else if (profile) loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('teams').select('*, profiles(full_name)').order('name'),
      supabase.from('profiles').select('id, full_name, coach_role').eq('role', 'coach').order('full_name')
    ])
    setTeams(t || [])
    setCoaches(c || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', category: 'Senior', season: '2025-2026', coach_id: '' })
    setShowForm(true)
  }

  function openEdit(team) {
    setEditing(team.id)
    setForm({ name: team.name, category: team.category || 'Senior', season: team.season || '2025-2026', gender: team.gender || 'masculino', coach_id: team.coach_id || '' })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name, category: form.category, season: form.season, gender: form.gender, coach_id: form.coach_id || null }
    if (editing) {
      await supabase.from('teams').update(payload).eq('id', editing)
    } else {
      await supabase.from('teams').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este equipo? Se borrarán también todos sus jugadores.')) return
    setDeleting(id)
    await supabase.from('teams').delete().eq('id', id)
    setDeleting(null)
    loadData()
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Panel Director</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{teams.length} equipos · {coaches.length} entrenadores</p>
        </div>
        <button onClick={openNew} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
          fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(82,176,67,0.3)'
        }}>
          + Nuevo equipo
        </button>
      </div>

      {/* Lista equipos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {teams.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏀</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No hay equipos todavía</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Crea el primero con el botón de arriba</div>
          </div>
        )}
        {teams.map(team => (
          <div key={team.id} style={{
            backgroundColor: '#fff', borderRadius: 14, padding: '16px 20px',
            border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 18
              }}>🏀</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{team.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {team.category} · {team.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {team.season}
                </div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {team.profiles
                    ? <span style={{ color: '#52B043', fontWeight: 600 }}>👤 {team.profiles.full_name}</span>
                    : <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠️ Sin entrenador asignado</span>
                  }
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(team)} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                backgroundColor: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>Editar</button>
              <button onClick={() => handleDelete(team.id)} disabled={deleting === team.id} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #fecaca',
                backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600,
                cursor: deleting === team.id ? 'not-allowed' : 'pointer'
              }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>
              {editing ? 'Editar equipo' : 'Nuevo equipo'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[{ label: 'Nombre del equipo', key: 'name', type: 'text', placeholder: 'Ej: Cadete A' }].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#52B043'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Categoría</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Género</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  <option value='masculino'>Masculino</option>
                  <option value='femenino'>Femenino</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Temporada</label>
                <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Entrenador asignado</label>
                <select value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  <option value=''>— Sin asignar —</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb',
                  backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>Cancelar</button>
                <button type='submit' disabled={saving} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
                  color: saving ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
