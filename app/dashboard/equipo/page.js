'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ModalPortal from '@/components/ModalPortal'
import Link from 'next/link'
import TeamGroupPicker from '@/components/TeamGroupPicker'

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
  const [form, setForm] = useState({ full_name: '', number: '', position: 'Base' })
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
        const { data: t, error: tErr } = await supabase.from('teams').select('*').eq('active', true).order('name')
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
    setForm({ full_name: '', number: '', position: 'Base' })
    setShowForm(true)
  }

  function openEdit(player) {
    setEditing(player.id)
    setForm({ full_name: player.full_name, number: player.number ?? '', position: player.position || 'Base' })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name: form.full_name,
      number: form.number !== '' ? parseInt(form.number) : null,
      position: form.position,

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
    border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7 }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  if (error) return (
    <div style={{ padding: 24, background: '#fef2f2', borderRadius: 14, color: '#dc2626', fontSize: 13, border: '1px solid #fecaca' }}>
      Error al cargar equipos: {error}
    </div>
  )

  if (!isDirector && teams.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 56 }}>🏀</div>
      <h2 className="empty-state-title" style={{ fontSize: 20, fontWeight: 800 }}>Sin equipo asignado</h2>
      <p className="empty-state-text" style={{ fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Cabecera — banner verde */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {isDirector ? 'Plantillas del club' : 'Mi equipo'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>
            {isDirector ? 'Equipos' : selectedTeam?.name}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {isDirector ? `${teams.length} equipos en total` : `${selectedTeam?.category} · ${selectedTeam?.season} · ${players.length} jugadores`}
          </p>
        </div>
        {selectedTeam
          ? <button onClick={openNew} className="btn-primary" style={{ flexShrink: 0 }}>+ Jugador</button>
          : <div style={{ fontSize: 48, opacity: 0.35 }}>👥</div>}
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
        <TeamGroupPicker teams={teams} selectedTeamId={selectedTeam?.id} onSelect={t => loadPlayers(t.id, teams)} />
      )}

      {/* Info equipo seleccionado */}
      {selectedTeam && (
        <div style={{
          borderRadius: 16, marginBottom: 20, overflow: 'hidden',
          background: 'linear-gradient(135deg, #1C5C2A 0%, #2d7a3a 50%, #52B043 100%)',
          boxShadow: '0 4px 20px rgba(28,92,42,0.25)', padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
              {selectedTeam.category} · {selectedTeam.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {selectedTeam.season}
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: -0.3 }}>{selectedTeam.name}</div>
            {isDirector && selectedTeam.coaches?.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 5, fontWeight: 500 }}>
                👤 {selectedTeam.coaches.map(c => c.profiles?.full_name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 44, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{players.length}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Jugadores</div>
          </div>
        </div>
      )}

      {/* Lista jugadores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {selectedTeam && players.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">No hay jugadores en este equipo</div>
            <div className="empty-state-text">Añade tu primer jugador con el botón “+ Jugador”</div>
          </div>
        )}
        {players.map(player => (
          <div key={player.id} style={{
            backgroundColor: '#fff', borderRadius: 16, padding: '14px 16px',
            border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            transition: 'all 0.2s'
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 17, fontWeight: 900,
                boxShadow: '0 2px 8px rgba(28,92,42,0.25)'
              }}>{player.number ?? '—'}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.full_name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>
                  {player.position || '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
              <Link href={`/dashboard/equipo/jugador/${player.id}`} style={{
                padding: '7px 13px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                backgroundColor: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, textDecoration: 'none'
              }}>Ver</Link>
              <button onClick={() => openEdit(player)} style={{
                padding: '7px 13px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                backgroundColor: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>Editar</button>
              <button onClick={() => handleDelete(player.id)} disabled={deleting === player.id} style={{
                padding: '7px 13px', borderRadius: 9, border: '1.5px solid #fecaca',
                backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700,
                cursor: deleting === player.id ? 'not-allowed' : 'pointer'
              }}>Baja</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>
              {editing ? 'Editar jugador' : 'Nuevo jugador'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input type='text' value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder='Nombre y apellidos' required style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Dorsal</label>
                  <input type='number' value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder='Ej: 7' min={0} max={99} style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div>
                  <label style={labelStyle}>Posición</label>
                  <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }} onFocus={inputFocus} onBlur={inputBlur}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>Cancelar</button>
                <button type='submit' disabled={saving} className="btn-primary" style={{
                  flex: 1, padding: '12px',
                  ...(saving ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {})
                }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
