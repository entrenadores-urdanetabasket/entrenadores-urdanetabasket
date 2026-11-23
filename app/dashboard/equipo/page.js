'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ModalPortal from '@/components/ModalPortal'
import Link from 'next/link'
import TeamGroupPicker from '@/components/TeamGroupPicker'
import { toast, toastError } from '@/lib/toast'

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
    setEditing(null) // si había un jugador en edición del equipo anterior, se cierra al cambiar de equipo
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
    const { error: saveErr } = editing
      ? await supabase.from('players').update(payload).eq('id', editing)
      : await supabase.from('players').insert(payload)
    setSaving(false)
    if (saveErr) { toastError('No se pudo guardar: ' + saveErr.message); return }
    toast(editing ? 'Jugador actualizado' : 'Jugador añadido')
    setShowForm(false)
    loadPlayers(selectedTeam.id, teams)
  }

  async function handleDelete(id) {
    if (!confirm('¿Dar de baja a este jugador?')) return
    setDeleting(id)
    const { error: delErr } = await supabase.from('players').update({ active: false }).eq('id', id)
    setDeleting(null)
    if (delErr) toastError('No se pudo dar de baja: ' + delErr.message); else toast('Jugador dado de baja')
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
      <div className="hero page-hero" style={{
        background: 'var(--banner-bg)',
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
      {selectedTeam && isDirector && (
        <div className="panel" style={{ marginBottom: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              {selectedTeam.category} · {selectedTeam.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {selectedTeam.season}
            </div>
            <div style={{ color: '#0f172a', fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>{selectedTeam.name}</div>
            <div style={{ color: '#64748b', fontSize: 12.5, marginTop: 4, fontWeight: 500 }}>
              {selectedTeam.coaches?.length > 0 ? selectedTeam.coaches.map(c => c.profiles?.full_name).filter(Boolean).join(', ') : 'Sin entrenador asignado'}
            </div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div className="num" style={{ color: '#1C5C2A', fontSize: 38, fontWeight: 800, lineHeight: 1, letterSpacing: -1.5 }}>{players.length}</div>
            <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Jugadores</div>
          </div>
        </div>
      )}

      {/* Lista jugadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {selectedTeam && players.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">No hay jugadores en este equipo</div>
            <div className="empty-state-text">Añade tu primer jugador con el botón “+ Jugador”</div>
          </div>
        )}
        {players.map(player => (
          <div key={player.id} className="panel tilt" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href={`/dashboard/equipo/jugador/${player.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, textDecoration: 'none' }}>
              <div className="num" style={{
                width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(145deg,#2f8a3d,#143d1d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, fontWeight: 800,
                boxShadow: '0 4px 12px rgba(28,92,42,0.28), inset 0 1px 0 rgba(255,255,255,0.2)'
              }}>{player.number ?? '—'}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.full_name}</div>
                <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: '#1C5C2A', background: '#e8f5e9' }}>
                  {player.position || 'Sin posición'}
                </span>
              </div>
            </Link>
            <div style={{ display: 'flex', gap: 7 }}>
              <Link href={`/dashboard/equipo/jugador/${player.id}`} style={{
                flex: 1, textAlign: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc', color: '#334155', fontSize: 12, fontWeight: 700, textDecoration: 'none'
              }}>Ver ficha</Link>
              <button onClick={() => openEdit(player)} style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>Editar</button>
              <button onClick={() => handleDelete(player.id)} disabled={deleting === player.id} style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid #fecaca',
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
