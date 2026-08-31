'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ModalPortal from '@/components/ModalPortal'
import TeamGroupPicker from '@/components/TeamGroupPicker'

const TYPES = {
  lesion:    { label: 'Lesión',    emoji: '🤕', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  sancion:   { label: 'Sanción',   emoji: '🟨', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  expulsion: { label: 'Expulsión', emoji: '🟥', color: '#dc2626', bg: '#fff1f1', border: '#fca5a5' },
  conflicto: { label: 'Conflicto', emoji: '⚡', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  otro:      { label: 'Otros',     emoji: '📋', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

export default function IncidenciasPage() {
  const { user, profile, supabase, myTeams, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tab, setTab] = useState('activas')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showResolve, setShowResolve] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [form, setForm] = useState({ type: 'lesion', player_id: '', date: new Date().toISOString().split('T')[0], description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) return
    loadTeams()
  }, [user, profile, activeTeam])

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').order('name')
      setTeams(data || [])
      if (data?.length > 0) await loadTeamData(data[0])
      else setLoading(false)
    } else {
      if (!activeTeam) { setLoading(false); return }
      setTeams(myTeams)
      await loadTeamData(activeTeam)
    }
  }

  async function loadTeamData(team) {
    setSelectedTeam(team)
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('players').select('id, full_name, number').eq('team_id', team.id).eq('active', true).order('full_name'),
      supabase.from('incidents').select('*, players(full_name, number)').eq('team_id', team.id).order('date', { ascending: false })
    ])
    setPlayers(p || [])
    setIncidents(i || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('incidents').insert({
      team_id: selectedTeam.id,
      player_id: form.player_id || null,
      type: form.type,
      description: form.description,
      date: form.date,
      reported_by: user.id,
      resolved: false
    })
    setSaving(false)
    if (error) { alert('Error: ' + error.message + ' (' + error.code + ')'); return }
    setShowForm(false)
    setForm({ type: 'lesion', player_id: '', date: new Date().toISOString().split('T')[0], description: '' })
    await loadTeamData(selectedTeam)
  }

  async function handleResolve(incident) {
    await supabase.from('incidents').update({
      resolved: true,
      resolved_note: resolveNote || null,
      resolved_at: new Date().toISOString().split('T')[0]
    }).eq('id', incident.id)
    setShowResolve(null)
    setResolveNote('')
    await loadTeamData(selectedTeam)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta incidencia?')) return
    await supabase.from('incidents').delete().eq('id', id)
    await loadTeamData(selectedTeam)
  }

  const filtered = incidents.filter(i => tab === 'activas' ? !i.resolved : i.resolved)

  const tabStyle = (t) => ({
    padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
    background: tab === t ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
    color: tab === t ? '#fff' : '#475569',
    border: tab === t ? 'none' : '1.5px solid #e2e8f0',
    boxShadow: tab === t ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
  })

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7 }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  if (!selectedTeam) return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 56 }}>⚠️</div>
      <h2 className="empty-state-title" style={{ fontSize: 20, fontWeight: 800 }}>Sin equipo asignado</h2>
      <p className="empty-state-text" style={{ fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  const activeCount = incidents.filter(i => !i.resolved).length

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
            {selectedTeam.name} · Registro de eventos
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Incidencias</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? 'activa' : 'activas'}` : 'Sin incidencias activas'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ flexShrink: 0 }}>+ Nueva</button>
      </div>

      {/* Selector equipos (director) */}
      {isDirector && teams.length > 1 && (
        <TeamGroupPicker teams={teams} selectedTeamId={selectedTeam?.id} onSelect={t => { setLoading(true); loadTeamData(t) }} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('activas')} style={tabStyle('activas')}>
          🔴 Activas {activeCount > 0 && `(${activeCount})`}
        </button>
        <button onClick={() => setTab('resueltas')} style={tabStyle('resueltas')}>
          ✅ Resueltas
        </button>
      </div>

      {/* Lista incidencias */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">{tab === 'activas' ? '✅' : '📋'}</div>
            <div className="empty-state-title">
              {tab === 'activas' ? '¡Sin incidencias activas!' : 'No hay incidencias resueltas'}
            </div>
          </div>
        )}

        {filtered.map(inc => {
          const t = TYPES[inc.type] || TYPES.otro
          return (
            <div key={inc.id} style={{
              backgroundColor: '#fff', borderRadius: 16, border: `1.5px solid ${t.border}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden',
              borderLeft: `4px solid ${t.color}`, transition: 'all 0.2s'
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {/* Header tipo */}
              <div style={{ backgroundColor: t.bg, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{t.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label}</span>
                  {!inc.resolved && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '2px 7px', borderRadius: 6 }}>ACTIVA</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  {new Date(inc.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Contenido */}
              <div style={{ padding: '14px 18px' }}>
                {inc.players && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 900, flexShrink: 0
                    }}>{inc.players.number ?? '—'}</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{inc.players.full_name}</span>
                  </div>
                )}
                <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', lineHeight: 1.5 }}>{inc.description}</p>

                {inc.resolved && inc.resolved_note && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #d1fae5', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 3 }}>✓ NOTA DE RESOLUCIÓN</div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{inc.resolved_note}</div>
                    {inc.resolved_at && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Resuelta el {new Date(inc.resolved_at + 'T12:00:00').toLocaleDateString('es-ES')}</div>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {!inc.resolved && (
                    <button onClick={() => { setShowResolve(inc); setResolveNote('') }} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontSize: 12, fontWeight: 700
                    }}>✓ Marcar resuelta</button>
                  )}
                  <button onClick={() => handleDelete(inc.id)} style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>Eliminar</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal nueva incidencia */}
      {showForm && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>Nueva incidencia</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Tipo */}
              <div>
                <label style={labelStyle}>Tipo de incidencia</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {Object.entries(TYPES).map(([key, { label, emoji, color, bg, border }]) => (
                    <button key={key} type='button' onClick={() => setForm(f => ({ ...f, type: key }))} style={{
                      padding: '10px 6px', borderRadius: 10, border: `2px solid ${form.type === key ? color : '#e5e7eb'}`,
                      backgroundColor: form.type === key ? bg : '#fff',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                    }}>
                      <span style={{ fontSize: 18 }}>{emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: form.type === key ? color : '#6b7280' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Jugador */}
              <div>
                <label style={labelStyle}>Jugador afectado (opcional)</label>
                <select value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value=''>— Incidencia de equipo —</option>
                  {players.map(p => <option key={p.id} value={p.id}>#{p.number} {p.full_name}</option>)}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type='date' value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              {/* Descripción */}
              <div>
                <label style={labelStyle}>Descripción *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder='Describe la incidencia con detalle...' required rows={4}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>Cancelar</button>
                <button type='submit' disabled={saving} className="btn-primary" style={{
                  flex: 1, padding: '12px', ...(saving ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {})
                }}>{saving ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal resolver incidencia */}
      {showResolve && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: -0.3 }}>Marcar como resuelta</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>{showResolve.description}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nota de resolución (opcional)</label>
              <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                placeholder='¿Cómo se resolvió? Alta médica, cumplida sanción...' rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowResolve(null)} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}>Cancelar</button>
              <button onClick={() => handleResolve(showResolve)} className="btn-primary" style={{
                flex: 1, padding: '12px'
              }}>✓ Confirmar</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
