'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NuevoPartidoPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()

  const [step, setStep]           = useState(1) // 1 = info + rival, 2 = convocatoria
  const [saving, setSaving]       = useState(false)
  const [team, setTeam]           = useState(null)
  const [players, setPlayers]     = useState([]) // team players
  const [selected, setSelected]   = useState(new Set()) // selected player ids

  // Paso 1 — datos del partido
  const [rivalName, setRivalName]   = useState('')
  const [date, setDate]             = useState('')
  const [time, setTime]             = useState('')
  const [gameType, setGameType]     = useState('liga')
  const [location, setLocation]     = useState('')
  const [rivalJerseyInput, setRivalJerseyInput] = useState('')
  const [rivalJerseys, setRivalJerseys]         = useState([]) // array of numbers

  useEffect(() => { if (user) loadTeam() }, [user])

  async function loadTeam() {
    // Los entrenadores se asignan via tabla team_coaches (igual que en equipo/page.js)
    const { data: tc } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', user.id)

    const teamIds = (tc || []).map(r => r.team_id)
    if (teamIds.length === 0) return

    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, category')
      .in('id', teamIds)
      .eq('active', true)

    if (!teams || teams.length === 0) return
    setTeam(teams[0])

    const { data: pl } = await supabase
      .from('players')
      .select('id, full_name, number, position')
      .eq('team_id', teams[0].id)
      .eq('active', true)
      .order('number', { ascending: true })

    // Jugadores de equipos vinculados (doble ficha federada) que este
    // equipo puede convocar además de su propia plantilla — no se marcan
    // seleccionados por defecto, el entrenador los añade si han jugado
    const { data: links } = await supabase.from('team_borrow_links').select('to_team_id, teams:to_team_id(name)').eq('from_team_id', teams[0].id)
    const linkedTeamIds = (links || []).map(l => l.to_team_id)
    const teamNameById = Object.fromEntries((links || []).map(l => [l.to_team_id, l.teams?.name]))
    let borrowedList = []
    if (linkedTeamIds.length > 0) {
      const { data: bp } = await supabase.from('players').select('id, full_name, number, position').in('team_id', linkedTeamIds).eq('active', true).order('number')
      borrowedList = (bp || []).map(p => ({ ...p, _fromTeamName: teamNameById[p.team_id] || 'Otro equipo' }))
    }

    const ps = pl || []
    setPlayers([...ps, ...borrowedList])
    setSelected(new Set(ps.map(p => p.id))) // la plantilla propia, seleccionada por defecto
  }

  function addRivalJersey() {
    const num = parseInt(rivalJerseyInput.trim(), 10)
    if (!isNaN(num) && num >= 0 && num <= 99 && !rivalJerseys.includes(num)) {
      setRivalJerseys(prev => [...prev, num].sort((a, b) => a - b))
    }
    setRivalJerseyInput('')
  }

  function removeJersey(n) {
    setRivalJerseys(prev => prev.filter(x => x !== n))
  }

  function togglePlayer(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goToStep2() {
    if (!rivalName.trim()) { alert('Indica el nombre del rival'); return }
    if (!date) { alert('Indica la fecha del partido'); return }
    setStep(2)
  }

  async function handleCreate() {
    if (selected.size === 0) { alert('Selecciona al menos un jugador'); return }
    setSaving(true)
    try {
      const { data: game, error } = await supabase
        .from('games')
        .insert({
          team_id: team.id,
          created_by: user.id,
          date,
          time: time || null,
          rival_name: rivalName.trim(),
          game_type: gameType,
          location: location.trim() || null,
          our_score: 0,
          rival_score: 0,
          status: 'pending',
          rival_roster: rivalJerseys,
        })
        .select()
        .single()

      if (error) throw error

      // Insertar game_players
      const gamePlayers = players
        .filter(p => selected.has(p.id))
        .map(p => ({
          game_id: game.id,
          player_id: p.id,
          jersey_number: p.number,
          starter: false,
        }))

      if (gamePlayers.length > 0) {
        const { error: gpErr } = await supabase.from('game_players').insert(gamePlayers)
        if (gpErr) throw gpErr
      }

      router.replace(`/live/${game.id}`)
    } catch (e) {
      console.error(e)
      alert('Error al crear el partido: ' + e.message)
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
    border: '1.5px solid #e5e7eb', outline: 'none', backgroundColor: '#fff',
    boxSizing: 'border-box', color: '#111827', fontFamily: 'inherit',
  }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }

  return (
    <div>
      <Link href="/dashboard/estadisticas" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: '#6b7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20
      }}>← Volver</Link>

      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 6 }}>Nuevo partido</h1>

      {/* Pasos */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 13, fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: step >= n ? '#1C5C2A' : '#e5e7eb',
              color: step >= n ? '#fff' : '#9ca3af',
            }}>{n}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: step >= n ? '#1C5C2A' : '#9ca3af' }}>
              {n === 1 ? 'Info del partido' : 'Convocatoria'}
            </span>
            {n < 2 && <span style={{ color: '#d1d5db', marginLeft: 2 }}>›</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 16 }}>Datos del partido</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Rival *</label>
                <input style={inputStyle} placeholder="Nombre del equipo rival" value={rivalName} onChange={e => setRivalName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Fecha *</label>
                  <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Hora</label>
                  <input style={inputStyle} type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select style={inputStyle} value={gameType} onChange={e => setGameType(e.target.value)}>
                    <option value="liga">Liga</option>
                    <option value="copa">Copa</option>
                    <option value="amistoso">Amistoso</option>
                    <option value="torneo">Torneo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Lugar</label>
                  <input style={inputStyle} placeholder="Pabellón / Ciudad" value={location} onChange={e => setLocation(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Dorsales rival */}
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Dorsales del rival</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Añade los dorsales para poder registrar sus estadísticas</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                style={{ ...inputStyle, width: 'auto', flex: 1, maxWidth: 100 }}
                type="number" min={0} max={99} placeholder="Nº"
                value={rivalJerseyInput}
                onChange={e => setRivalJerseyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRivalJersey()}
              />
              <button onClick={addRivalJersey} style={{
                padding: '10px 16px', backgroundColor: '#f3f4f6', border: 'none',
                borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer'
              }}>Añadir</button>
            </div>
            {rivalJerseys.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rivalJerseys.map(n => (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 8, padding: '5px 10px'
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8' }}>#{n}</span>
                    <button onClick={() => removeJersey(n)} style={{
                      background: 'none', border: 'none', color: '#93c5fd',
                      cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0
                    }}>×</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>Sin dorsales añadidos todavía</div>
            )}
          </div>

          <button onClick={goToStep2} style={{
            width: '100%', padding: '13px', background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
            color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 3px 10px rgba(82,176,67,0.35)'
          }}>
            Siguiente: Convocatoria →
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>
                Convocatoria <span style={{ color: '#52B043' }}>({selected.size})</span>
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelected(new Set(players.map(p => p.id)))} style={{
                  fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'none',
                  border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer'
                }}>Todos</button>
                <button onClick={() => setSelected(new Set())} style={{
                  fontSize: 11, fontWeight: 700, color: '#9ca3af', background: 'none',
                  border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', cursor: 'pointer'
                }}>Ninguno</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {players.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                  No hay jugadores en el equipo
                </div>
              )}
              {players.map(p => {
                const on = selected.has(p.id)
                return (
                  <div key={p.id} onClick={() => togglePlayer(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px ${p._fromTeamName ? 'dashed' : 'solid'} ${on ? '#bbf7d0' : p._fromTeamName ? '#ddd6fe' : '#f3f4f6'}`,
                    backgroundColor: on ? '#f0fdf4' : '#fafafa',
                    transition: 'all 0.12s',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      backgroundColor: on ? '#1C5C2A' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: on ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 900,
                    }}>{p.number ?? '?'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: on ? '#111827' : '#6b7280' }}>{p.full_name}</div>
                      {p._fromTeamName ? (
                        <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>🔗 {p._fromTeamName}</div>
                      ) : p.position && <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.position}</div>}
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `2px solid ${on ? '#16a34a' : '#d1d5db'}`,
                      backgroundColor: on ? '#16a34a' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: '#fff', fontWeight: 900, flexShrink: 0
                    }}>{on ? '✓' : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{
              flex: 1, padding: '13px', backgroundColor: '#f3f4f6',
              color: '#374151', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}>← Volver</button>
            <button onClick={handleCreate} disabled={saving} style={{
              flex: 2, padding: '13px', background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              boxShadow: '0 3px 10px rgba(82,176,67,0.35)'
            }}>
              {saving ? 'Creando...' : '🏀 Iniciar partido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
