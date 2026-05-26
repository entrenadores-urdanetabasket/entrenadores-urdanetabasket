'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

const POSITIONS = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot']

export default function EquipoPage() {
  const { user, profile, supabase, myTeams, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ full_name: '', number: '', position: 'Base', birth_date: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) return
    loadData()
  }, [user, profile, activeTeam])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      if (isDirector) {
        const { data: t, error: tErr } = await supabase.from('teams').select('*').order('name')
        if (tErr) { console.error('teams query error:', tErr); setError(tErr.message); return }
        const teamList = t || []
        // Cargar entrenadores vía team_coaches
        if (teamList.length > 0) {
          const { data: tc } = await supabase.from('team_coaches').select('team_id, coach_id, profiles(full_name)')
          teamList.forEach(team => { team.coaches = (tc || []).filter(r => r.team_id === team.id) })
        }
        setTeams(teamList)
        if (teamList.length > 0) {
          await loadPlayers(selectedTeam?.id || teamList[0].id, teamList)
        } else {
          setLoading(false)
        }
      } else {
        if (!activeTeam) { setLoading(false); return }
        setTeams(myTeams)
        setSelectedTeam(activeTeam)
        await loadPlayers(activeTeam.id, myTeams)
      }
    } catch (err) {
      console.error('loadData error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function loadPlayers(teamId, teamList) {
    try {
      const team = teamList.find(t => t.id === teamId)
      setSelectedTeam(team)
      const { data: p, error: pErr } = await supabase.from('players').select('*').eq('team_id', teamId).eq('active', true).order('number')
      if (pErr) console.error('players query error:', pErr)
      setPlayers(p || [])
    } catch (err) {
      console.error('loadPlayers error:', err)
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ full_name: '', number: '', position: 'Base', birth_date: '' })
    setShowForm(true)
  }

  function openEdit(player) {
    setEditing(player.id)
    setForm({ full_name: player.full_name, number: player.number ?? '', position: player.position || 'Base', birth_date: player.birth_date || '' })
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
      team_id: selectedTeam.id
    }
    if (editing) await supabase.from('players').update(payload).eq('id', editing)
    else await supabase.from('players').insert(payload)
    setSaving(false)
    setShowForm(false)
    loadPlayers(selectedTeam.id, teams)
  }

  async function handleDelete(id) {
    if (!confirm('¿Dar de baja a este jugador?')) return
    setDeleting(id)
    await supabase.from('players').update({ active: false }).eq('id', id)
    setDeleting(null)
    loadPlayers(selectedTeam.id, teams)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  if (error) return (
    <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#ef4444', fontSize: 13 }}>
      Error al cargar equipos: {error}
    </div>
  )

  if (!isDirector && teams.length === 0) return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏀</div>
      <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sin equipo asignado</h2>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>
            {isDirector ? 'Equipos' : selectedTeam?.name}
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            {isDirector ? `${teams.length} equipos en total` : `${selectedTeam?.category} · ${selectedTeam?.season} · ${players.length} jugadores`}
          </p>
        </div>
        {selectedTeam && (
          <button onClick={openNew} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
            fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(82,176,67,0.3)'
          }}>+ Jugador</button>
        )}
      </div>

      {/* Estado vacío para director */}
      {isDirector && teams.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏀</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No hay equipos creados</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Ve al Panel Director para crear equipos</div>
        </div>
      )}

      {/* Selector de equipos */}
      {isDirector && teams.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => loadPlayers(t.id, teams)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam?.id === t.id ? '#fff' : '#374151',
              transition: 'all 0.15s'
            }}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Info equipo seleccionado */}
      {selectedTeam && (
        <div style={{
          borderRadius: 14, marginBottom: 20, overflow: 'hidden',
          background: 'linear-gradient(135deg,#1C5C2A 0%,#52B043 100%)',
          boxShadow: '0 4px 20px rgba(82,176,67,0.2)', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              {selectedTeam.category} · {selectedTeam.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {selectedTeam.season}
            </div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>{selectedTeam.name}</div>
            {isDirector && selectedTeam.coaches?.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>
                👤 {selectedTeam.coaches.map(c => c.profiles?.full_name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, opacity: 0.8 }}>{players.length}</div>
        </div>
      )}

      {/* Lista jugadores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {selectedTeam && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No hay jugadores en este equipo</div>
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
              }}>{player.number ?? '—'}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{player.full_name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {player.position || '—'}{player.birth_date && ` · ${new Date(player.birth_date).getFullYear()}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link href={`/dashboard/equipo/jugador/${player.id}`} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none'
              }}>Ver</Link>
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

      {/* Modal */}
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
