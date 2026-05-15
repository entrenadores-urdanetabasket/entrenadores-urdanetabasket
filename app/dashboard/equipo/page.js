'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

const POSITIONS = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot']

export default function EquipoPage() {
  const { user, supabase } = useAuth()
  const [team, setTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ full_name: '', number: '', position: 'Base', birth_date: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    const { data: t } = await supabase.from('teams').select('*').eq('coach_id', user.id).single()
    if (!t) { setLoading(false); return }
    setTeam(t)
    const { data: p } = await supabase.from('players').select('*').eq('team_id', t.id).eq('active', true).order('number')
    setPlayers(p || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ full_name: '', number: '', position: 'Base', birth_date: '' })
    setShowForm(true)
  }

  function openEdit(player) {
    setEditing(player.id)
    setForm({
      full_name: player.full_name,
      number: player.number ?? '',
      position: player.position || 'Base',
      birth_date: player.birth_date || ''
    })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name: form.full_name,
      number: form.number !== '' ? parseInt(form.number) : null,
      position: form.position,
      birth_date: form.birth_date || null,
      team_id: team.id
    }
    if (editing) {
      await supabase.from('players').update(payload).eq('id', editing)
    } else {
      await supabase.from('players').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este jugador?')) return
    setDeleting(id)
    await supabase.from('players').update({ active: false }).eq('id', id)
    setDeleting(null)
    loadData()
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  if (!team) return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏀</div>
      <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sin equipo asignado</h2>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>{team.name}</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{team.category} · {team.season} · {players.length} jugadores</p>
        </div>
        <button onClick={openNew} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
          fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(82,176,67,0.3)'
        }}>+ Jugador</button>
      </div>

      {/* Lista jugadores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No hay jugadores todavía</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Añade el primero con el botón de arriba</div>
          </div>
        )}
        {players.map(player => (
          <div key={player.id} style={{
            backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px',
            border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 900
              }}>
                {player.number ?? '—'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{player.full_name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {player.position || '—'}
                  {player.birth_date && ` · ${new Date(player.birth_date).getFullYear()}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(player)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>Editar</button>
              <button onClick={() => handleDelete(player.id)} disabled={deleting === player.id} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca',
                backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600,
                cursor: deleting === player.id ? 'not-allowed' : 'pointer'
              }}>Baja</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>
              {editing ? 'Editar jugador' : 'Nuevo jugador'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input type='text' value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder='Nombre y apellidos' required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#52B043'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Dorsal</label>
                  <input type='number' value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder='Ej: 7' min={0} max={99} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#52B043'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div>
                  <label style={labelStyle}>Posición</label>
                  <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Fecha de nacimiento</label>
                <input type='date' value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#52B043'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb',
                  backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>Cancelar</button>
                <button type='submit' disabled={saving} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
                  color: saving ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
