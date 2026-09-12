'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NuevoPartidoPage() {
  const { user, supabase, activeTeam } = useAuth()
  const router = useRouter()

  const [step, setStep]           = useState(1) // 1 = info + rival, 2 = convocatoria
  const [saving, setSaving]       = useState(false)
  const [team, setTeam]           = useState(null)
  const [players, setPlayers]     = useState([]) // team players
  const [selected, setSelected]   = useState(new Set()) // selected player ids
  // Dorsal para ESTE partido en concreto, editable — por defecto el dorsal
  // habitual del jugador, pero se puede cambiar (p.ej. un jugador convocado
  // de un equipo vinculado cuyo número coincide con uno ya usado en este
  // equipo, o si se juega con equipación alternativa). No toca la ficha del
  // jugador, solo el partido.
  const [jerseyOverrides, setJerseyOverrides] = useState({}) // { [playerId]: number }

  // Paso 1 — datos del partido
  const [rivalName, setRivalName]   = useState('')
  const [date, setDate]             = useState('')
  const [time, setTime]             = useState('')
  const [gameType, setGameType]     = useState('liga')
  const [location, setLocation]     = useState('')
  const [rivalJerseyInput, setRivalJerseyInput] = useState('')
  const [rivalJerseys, setRivalJerseys]         = useState([]) // array of numbers
  const [h2h, setH2h] = useState(null) // historial contra este rival: { count, w, d, l }

  // El equipo es el que esté activo en el selector del menú lateral — antes
  // esta página hacía su propia búsqueda (sin ordenar) y para un entrenador
  // con más de un equipo podía coger cualquiera de ellos, no el que tenías
  // seleccionado.
  useEffect(() => { if (user && activeTeam) loadTeam() }, [user, activeTeam])

  // Historial contra este rival — para saber de un vistazo cómo os han ido
  // los enfrentamientos anteriores al escribir el nombre
  useEffect(() => {
    if (!team || rivalName.trim().length < 2) { setH2h(null); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('games').select('our_score, rival_score')
        .eq('team_id', team.id).eq('status', 'finished').ilike('rival_name', rivalName.trim())
      if (!data || data.length === 0) { setH2h({ count: 0 }); return }
      let w = 0, d = 0, l = 0
      data.forEach(g => {
        if ((g.our_score || 0) > (g.rival_score || 0)) w++
        else if ((g.our_score || 0) < (g.rival_score || 0)) l++
        else d++
      })
      setH2h({ count: data.length, w, d, l })
    }, 500)
    return () => clearTimeout(t)
  }, [rivalName, team])

  async function loadTeam() {
    setTeam(activeTeam)

    const { data: pl } = await supabase
      .from('players')
      .select('id, full_name, number, position')
      .eq('team_id', activeTeam.id)
      .eq('active', true)
      .order('number', { ascending: true })

    // Jugadores de equipos vinculados (doble ficha federada) que este
    // equipo puede convocar además de su propia plantilla — no se marcan
    // seleccionados por defecto, el entrenador los añade si han jugado
    const { data: links } = await supabase.from('team_borrow_links').select('to_team_id, teams:to_team_id(name)').eq('from_team_id', activeTeam.id)
    const linkedTeamIds = (links || []).map(l => l.to_team_id)
    const teamNameById = Object.fromEntries((links || []).map(l => [l.to_team_id, l.teams?.name]))
    let borrowedList = []
    if (linkedTeamIds.length > 0) {
      const { data: bp } = await supabase.from('players').select('id, full_name, number, position').in('team_id', linkedTeamIds).eq('active', true).order('number')
      borrowedList = (bp || []).map(p => ({ ...p, _fromTeamName: teamNameById[p.team_id] || 'Otro equipo' }))
    }

    const ps = pl || []
    const allPlayers = [...ps, ...borrowedList]
    setPlayers(allPlayers)
    setSelected(new Set(ps.map(p => p.id))) // la plantilla propia, seleccionada por defecto
    setJerseyOverrides(Object.fromEntries(allPlayers.map(p => [p.id, p.number])))
  }

  function setJerseyOverride(playerId, value) {
    const n = value === '' ? '' : parseInt(value, 10)
    setJerseyOverrides(prev => ({ ...prev, [playerId]: Number.isNaN(n) ? '' : n }))
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
    if (duplicateJerseys.size > 0) {
      alert(`Hay dorsales repetidos en la convocatoria: ${[...duplicateJerseys].join(', ')}. Cambia el dorsal de alguno de esos jugadores antes de iniciar el partido.`)
      return
    }
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
          jersey_number: jerseyOverrides[p.id] === '' || jerseyOverrides[p.id] == null ? p.number : jerseyOverrides[p.id],
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

  // Dorsales repetidos entre los CONVOCADOS (con el dorsal ya editado para
  // este partido) — típico al convocar a alguien de un equipo vinculado
  // cuyo número coincide con el de un jugador propio.
  const duplicateJerseys = (() => {
    const counts = {}
    players.filter(p => selected.has(p.id)).forEach(p => {
      const n = jerseyOverrides[p.id]
      if (n === '' || n == null) return
      counts[n] = (counts[n] || 0) + 1
    })
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n))
  })()

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
                {h2h && h2h.count > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '6px 10px' }}>
                    🆚 Contra este rival: {h2h.w}V - {h2h.d}E - {h2h.l}D ({h2h.count} {h2h.count === 1 ? 'partido' : 'partidos'})
                  </div>
                )}
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
            <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '-8px 0 12px' }}>
              Toca el dorsal para cambiarlo solo en este partido (no afecta a la ficha del jugador) — útil si convocas a alguien de un equipo vinculado con el mismo número que uno tuyo, o si jugáis con otra equipación.
            </p>
            {duplicateJerseys.size > 0 && (
              <div style={{ padding: '9px 12px', borderRadius: 9, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                ⚠️ Dorsal repetido entre convocados: {[...duplicateJerseys].join(', ')}. Cámbialo antes de iniciar el partido.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {players.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                  No hay jugadores en el equipo
                </div>
              )}
              {players.map(p => {
                const on = selected.has(p.id)
                const jersey = jerseyOverrides[p.id]
                const isDup = on && jersey !== '' && jersey != null && duplicateJerseys.has(String(jersey))
                return (
                  <div key={p.id} onClick={() => togglePlayer(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px ${p._fromTeamName ? 'dashed' : 'solid'} ${isDup ? '#fca5a5' : on ? '#bbf7d0' : p._fromTeamName ? '#ddd6fe' : '#f3f4f6'}`,
                    backgroundColor: isDup ? '#fef2f2' : on ? '#f0fdf4' : '#fafafa',
                    transition: 'all 0.12s',
                  }}>
                    <input type='number' value={jersey ?? ''} onClick={e => e.stopPropagation()}
                      onChange={e => setJerseyOverride(p.id, e.target.value)} style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0, textAlign: 'center', padding: 0,
                      backgroundColor: isDup ? '#dc2626' : on ? '#1C5C2A' : '#e5e7eb',
                      border: 'none', outline: 'none',
                      color: (isDup || on) ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 900,
                    }} />
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
            <button onClick={handleCreate} disabled={saving || duplicateJerseys.size > 0} style={{
              flex: 2, padding: '13px', background: duplicateJerseys.size > 0 ? '#d1d5db' : 'linear-gradient(135deg,#1C5C2A,#52B043)',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
              cursor: (saving || duplicateJerseys.size > 0) ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              boxShadow: duplicateJerseys.size > 0 ? 'none' : '0 3px 10px rgba(82,176,67,0.35)'
            }}>
              {saving ? 'Creando...' : duplicateJerseys.size > 0 ? 'Resuelve los dorsales repetidos' : '🏀 Iniciar partido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
