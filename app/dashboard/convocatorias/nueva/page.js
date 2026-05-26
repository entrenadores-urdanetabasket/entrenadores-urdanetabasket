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
    border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none',
    boxSizing: 'border-box', backgroundColor: '#fff',
  }
  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6
  }

  const canSave = form.rival.trim() && form.date

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14, padding: 20 }}>Cargando plantilla...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Back + título */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: 13, padding: 0, marginBottom: 8
        }}>← Volver</button>
        <h1 style={{ color: '#111827', fontSize: 22, fontWeight: 800, margin: 0 }}>Nueva convocatoria</h1>
        <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>{activeTeam?.name}</p>
      </div>

      {/* ── Datos del partido ── */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 20,
        border: '1px solid #f3f4f6', marginBottom: 16
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16
        }}>📅 Datos del partido</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Rival *</label>
            <input type="text" value={form.rival}
              onChange={e => setForm(f => ({ ...f, rival: e.target.value }))}
              placeholder="Nombre del equipo rival" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#52B043'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#52B043'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lugar</label>
            <input type="text" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Pabellón / campo" style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#52B043'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Instrucciones, hora de concentración previa..."
              rows={2} style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = '#52B043'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>
        </div>
      </div>

      {/* ── Selección de jugadores ── */}
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 20,
        border: '1px solid #f3f4f6', marginBottom: 20
      }}>
        {/* Cabecera sección */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: 0.8
          }}>👥 Seleccionar jugadores</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#52B043' }}>
            {selected.size} seleccionados
          </div>
        </div>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={selectAll} style={{
            padding: '5px 12px', borderRadius: 8, border: '1px solid #d1f0d1',
            backgroundColor: '#f0faf0', color: '#1C5C2A', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>Todos</button>
          <button onClick={clearAll} style={{
            padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>Ninguno</button>
        </div>

        {/* Leyenda */}
        <div style={{
          display: 'flex', gap: 14, marginBottom: 14, fontSize: 11, color: '#9ca3af',
          padding: '8px 10px', backgroundColor: '#f9fafb', borderRadius: 8
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
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${isSelected ? '#52B043' : hasIncidents ? '#fde68a' : '#f3f4f6'}`,
                    backgroundColor: isSelected ? '#f0faf0' : hasIncidents ? '#fffbeb' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Dorsal */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                      background: isSelected
                        ? 'linear-gradient(135deg,#52B043,#1C5C2A)'
                        : 'linear-gradient(135deg,#f3f4f6,#e5e7eb)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? '#fff' : '#6b7280',
                      fontSize: 13, fontWeight: 900,
                      transition: 'all 0.15s',
                    }}>{p.number ?? '—'}</div>

                    {/* Info jugador */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                          {p.full_name}
                        </span>
                        {hasIncidents && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                            backgroundColor: '#fef2f2', color: '#ef4444'
                          }}>
                            ⚠️ {INCIDENT_TYPE[p.incidents[0].type] || 'Incidencia'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
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
                      width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                      border: `2px solid ${isSelected ? '#52B043' : '#d1d5db'}`,
                      backgroundColor: isSelected ? '#52B043' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, fontWeight: 900,
                      transition: 'all 0.15s',
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
            ? '#e5e7eb'
            : 'linear-gradient(135deg,#52B043,#3a8a2e)',
          color: (saving || !canSave) ? '#9ca3af' : '#fff',
          fontSize: 15, fontWeight: 700,
          cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
          boxShadow: canSave ? '0 4px 16px rgba(82,176,67,0.3)' : 'none',
          marginBottom: 40, transition: 'all 0.2s',
        }}
      >
        {saving ? 'Guardando...' : `Guardar convocatoria · ${selected.size} jugadores`}
      </button>
    </div>
  )
}
