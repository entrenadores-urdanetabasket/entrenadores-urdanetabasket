'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

const INCIDENT_TYPE = {
  disciplinary: 'Sanción',
  medical:      'Lesión',
  administrative:'Admin.',
  other:        'Incidencia',
}

export default function NuevaConvocatoriaPage() {
  const { user, profile, supabase, activeTeam } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({ rival: '', date: '', time: '', location: '', notes: '' })
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !activeTeam) return
    loadPlayersWithData()
  }, [user, activeTeam])

  async function loadPlayersWithData() {
    setLoading(true)
    try {
      const teamId = activeTeam.id

      // Jugadores activos
      const { data: playerList } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('active', true)
        .order('number')

      if (!playerList || playerList.length === 0) {
        setPlayers([])
        setLoading(false)
        return
      }

      // Asistencia últimos 21 días (solo entrenamientos)
      const from = new Date()
      from.setDate(from.getDate() - 21)
      const fromStr = from.toISOString().slice(0, 10)

      const { data: attData } = await supabase
        .from('attendance')
        .select('player_id, date, status')
        .eq('team_id', teamId)
        .eq('type', 'training')
        .gte('date', fromStr)
        .order('date', { ascending: false })

      // Incidencias activas del equipo
      const { data: incData } = await supabase
        .from('incidents')
        .select('player_id, type, description')
        .eq('team_id', teamId)
        .eq('resolved', false)

      // Últimas 5 fechas de entrenamiento del equipo (para comparar jugadores entre sí)
      const teamDates = [...new Set((attData || []).map(a => a.date))]
        .sort().reverse().slice(0, 5)

      // Mapas por jugador
      const attByPlayer = {}
      ;(attData || []).forEach(a => {
        if (!attByPlayer[a.player_id]) attByPlayer[a.player_id] = {}
        attByPlayer[a.player_id][a.date] = a.status
      })

      const incByPlayer = {}
      ;(incData || []).forEach(i => {
        if (i.player_id) {
          if (!incByPlayer[i.player_id]) incByPlayer[i.player_id] = []
          incByPlayer[i.player_id].push(i)
        }
      })

      const enriched = playerList.map(p => ({
        ...p,
        trainingDates: teamDates,
        attendance: attByPlayer[p.id] || {},
        incidents: incByPlayer[p.id] || [],
      }))

      setPlayers(enriched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function togglePlayer(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(players.map(p => p.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleSave() {
    if (!form.rival.trim() || !form.date) {
      alert('Rellena el rival y la fecha')
      return
    }
    setSaving(true)
    try {
      const { data: conv, error } = await supabase
        .from('convocatorias')
        .insert({
          team_id: activeTeam.id,
          coach_id: user.id,
          rival: form.rival.trim(),
          date: form.date,
          time: form.time || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      if (selected.size > 0) {
        const rows = [...selected].map(pid => ({
          convocatoria_id: conv.id,
          player_id: pid,
        }))
        await supabase.from('convocatoria_players').insert(rows)
      }

      router.push(`/dashboard/convocatorias/${conv.id}`)
    } catch (err) {
      console.error(err)
      alert('Error al guardar la convocatoria')
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7
  }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  const canSave = form.rival.trim() && form.date

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14, padding: 20 }}>Cargando plantilla...</div>

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Back + título */}
      <button onClick={() => router.back()} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#64748b', fontSize: 13, fontWeight: 700, padding: 0, marginBottom: 12
      }}>← Volver</button>
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {activeTeam?.name || 'Nueva convocatoria'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Nueva convocatoria</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>Selecciona rival, fecha y jugadores</p>
        </div>
        <div style={{ fontSize: 48, opacity: 0.35 }}>📋</div>
      </div>

      {/* ── Datos del partido ── */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 20,
        border: '1px solid #e8edf3', marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: '#334155',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16
        }}>📅 Datos del partido</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Rival *</label>
            <input type="text" value={form.rival}
              onChange={e => setForm(f => ({ ...f, rival: e.target.value }))}
              placeholder="Nombre del equipo rival" required style={inputStyle}
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={inputStyle}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lugar</label>
            <input type="text" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Pabellón / campo" style={inputStyle}
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Instrucciones, hora de concentración previa..."
              rows={2} style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>
        </div>
      </div>

      {/* ── Selección de jugadores ── */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 20,
        border: '1px solid #e8edf3', marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'
      }}>
        {/* Cabecera sección */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: '#334155',
            textTransform: 'uppercase', letterSpacing: 0.8
          }}>👥 Seleccionar jugadores</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 11px', borderRadius: 20 }}>
            {selected.size} seleccionados
          </div>
        </div>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={selectAll} style={{
            padding: '6px 14px', borderRadius: 9, border: '1.5px solid #bbf7d0',
            backgroundColor: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer'
          }}>Todos</button>
          <button onClick={clearAll} style={{
            padding: '6px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0',
            backgroundColor: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer'
          }}>Ninguno</button>
        </div>

        {/* Leyenda */}
        <div style={{
          display: 'flex', gap: 14, marginBottom: 14, fontSize: 11, color: '#64748b', fontWeight: 600,
          padding: '9px 12px', backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #eef2f7', flexWrap: 'wrap'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#52B043', display: 'inline-block' }} />
            Asistió
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            Faltó
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            Justificó
          </span>
          <span>⚠️ Incidencia</span>
        </div>

        {players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            No hay jugadores activos en este equipo
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map(p => {
              const isSelected = selected.has(p.id)
              const hasIncidents = p.incidents.length > 0
              const totalDots = p.trainingDates.length
              const presentCount = p.trainingDates.filter(d => {
                const s = p.attendance[d]
                return s === 'present' || s === 'late'
              }).length

              // Color de la barra de asistencia
              const pct = totalDots > 0 ? presentCount / totalDots : null
              const attColor = pct === null ? '#e5e7eb'
                : pct >= 0.8 ? '#52B043'
                : pct >= 0.5 ? '#f59e0b'
                : '#ef4444'

              return (
                <div
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
                    border: `2px solid ${isSelected ? '#52B043' : hasIncidents ? '#fde68a' : '#eef2f7'}`,
                    backgroundColor: isSelected ? '#f0fdf4' : hasIncidents ? '#fffbeb' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Dorsal */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                      background: isSelected
                        ? 'linear-gradient(135deg,#52B043,#1C5C2A)'
                        : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? '#fff' : '#64748b',
                      fontSize: 14, fontWeight: 900,
                      transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 2px 8px rgba(28,92,42,0.20)' : 'none'
                    }}>{p.number ?? '—'}</div>

                    {/* Info jugador */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', letterSpacing: -0.2 }}>
                          {p.full_name}
                        </span>
                        {hasIncidents && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 7,
                            backgroundColor: '#dc2626', color: '#fff', letterSpacing: 0.2,
                            boxShadow: '0 1px 4px rgba(220,38,38,0.30)'
                          }}>
                            ⚠️ {INCIDENT_TYPE[p.incidents[0].type] || 'Incidencia'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>
                        {p.position || '—'}
                      </div>

                      {/* Puntos de asistencia */}
                      {totalDots > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
                          {p.trainingDates.map(d => {
                            const status = p.attendance[d]
                            const dotColor = status === 'present' || status === 'late' ? '#52B043'
                              : status === 'absent' ? '#ef4444'
                              : status === 'justified' ? '#f59e0b'
                              : '#e5e7eb'
                            return (
                              <div key={d} title={d} style={{
                                width: 9, height: 9, borderRadius: '50%',
                                backgroundColor: dotColor, flexShrink: 0,
                              }} />
                            )
                          })}
                          <span style={{ fontSize: 10, color: attColor, fontWeight: 700, marginLeft: 5 }}>
                            {presentCount}/{totalDots} entrenos
                          </span>
                        </div>
                      )}
                      {totalDots === 0 && (
                        <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 5 }}>
                          Sin registros de asistencia
                        </div>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      border: `2px solid ${isSelected ? '#52B043' : '#cbd5e1'}`,
                      background: isSelected ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, fontWeight: 900,
                      transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 2px 6px rgba(82,176,67,0.30)' : 'none'
                    }}>{isSelected ? '✓' : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Botón guardar */}
      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        style={{
          width: '100%', padding: '15px', borderRadius: 12, border: 'none',
          background: (saving || !canSave)
            ? '#e2e8f0'
            : 'linear-gradient(135deg,#52B043,#3a8a2e)',
          color: (saving || !canSave) ? '#94a3b8' : '#fff',
          fontSize: 15, fontWeight: 800, letterSpacing: -0.2,
          cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
          boxShadow: canSave ? '0 4px 16px rgba(82,176,67,0.35)' : 'none',
          marginBottom: 40, transition: 'all 0.2s',
        }}
      >
        {saving ? 'Guardando...' : `Guardar convocatoria · ${selected.size} jugadores`}
      </button>
    </div>
  )
}
