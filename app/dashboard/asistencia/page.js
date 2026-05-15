'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export default function AsistenciaPage() {
  const { user, profile, supabase } = useAuth()
  const isDirector = profile?.role === 'director'

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [tab, setTab] = useState('lista')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState({})
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user && profile) loadTeams()
  }, [user, profile])

  useEffect(() => {
    if (selectedTeam) {
      loadPlayers()
      if (tab === 'historial') loadHistory()
      if (tab === 'estadisticas') loadStats()
    }
  }, [selectedTeam, tab])

  useEffect(() => {
    if (selectedTeam && players.length > 0) loadAttendanceForDate()
  }, [date, players])

  async function loadTeams() {
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').order('name')
      setTeams(data || [])
      if (data?.length > 0) setSelectedTeam(data[0])
    } else {
      const { data } = await supabase.from('teams').select('*').eq('coach_id', user.id).single()
      if (data) { setTeams([data]); setSelectedTeam(data) }
      else setLoading(false)
    }
  }

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').eq('team_id', selectedTeam.id).eq('active', true).order('number')
    setPlayers(data || [])
    setLoading(false)
  }

  async function loadAttendanceForDate() {
    const { data } = await supabase.from('attendance').select('*').eq('team_id', selectedTeam.id).eq('date', date)
    const map = {}
    if (data?.length > 0) {
      data.forEach(r => { map[r.player_id] = r.present })
    } else {
      players.forEach(p => { map[p.id] = true })
    }
    setAttendance(map)
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('attendance')
      .select('date, present, player_id')
      .eq('team_id', selectedTeam.id)
      .order('date', { ascending: false })
    if (!data) return
    const byDate = {}
    data.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { total: 0, present: 0 }
      byDate[r.date].total++
      if (r.present) byDate[r.date].present++
    })
    setHistory(Object.entries(byDate).map(([date, v]) => ({ date, ...v })))
  }

  async function loadStats() {
    const { data } = await supabase
      .from('attendance')
      .select('player_id, present')
      .eq('team_id', selectedTeam.id)
    if (!data) return
    const byPlayer = {}
    data.forEach(r => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = { total: 0, present: 0 }
      byPlayer[r.player_id].total++
      if (r.present) byPlayer[r.player_id].present++
    })
    const result = players.map(p => ({
      ...p,
      total: byPlayer[p.id]?.total || 0,
      present: byPlayer[p.id]?.present || 0,
      pct: byPlayer[p.id] ? Math.round((byPlayer[p.id].present / byPlayer[p.id].total) * 100) : null
    })).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
    setStats(result)
  }

  async function handleSave() {
    setSaving(true)
    const rows = players.map(p => ({
      team_id: selectedTeam.id,
      player_id: p.id,
      date,
      present: attendance[p.id] ?? true
    }))
    await supabase.from('attendance').upsert(rows, { onConflict: 'player_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    if (tab === 'historial') loadHistory()
  }

  const toggle = (id) => setAttendance(a => ({ ...a, [id]: !a[id] }))

  const tabStyle = (t) => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
    backgroundColor: tab === t ? '#1C5C2A' : '#f3f4f6',
    color: tab === t ? '#fff' : '#374151'
  })

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  if (!selectedTeam) return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sin equipo asignado</h2>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  const presentCount = players.filter(p => attendance[p.id] !== false).length

  return (
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Asistencia</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{selectedTeam.name} · {selectedTeam.category}</p>
      </div>

      {/* Selector equipos (director) */}
      {isDirector && teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => { setSelectedTeam(t); setLoading(true) }} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam?.id === t.id ? '#fff' : '#374151'
            }}>{t.name}</button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('lista')} style={tabStyle('lista')}>📋 Pasar lista</button>
        <button onClick={() => setTab('historial')} style={tabStyle('historial')}>📅 Historial</button>
        <button onClick={() => setTab('estadisticas')} style={tabStyle('estadisticas')}>📊 Estadísticas</button>
      </div>

      {/* TAB: Pasar lista */}
      {tab === 'lista' && (
        <div>
          {/* Selector fecha + resumen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input type='date' value={date} onChange={e => setDate(e.target.value)} style={{
              padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb',
              fontSize: 14, color: '#111827', outline: 'none', backgroundColor: '#fff'
            }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ padding: '7px 14px', borderRadius: 10, backgroundColor: '#f0fdf4', color: '#16a34a', fontSize: 13, fontWeight: 700 }}>
                ✅ {presentCount} presentes
              </span>
              <span style={{ padding: '7px 14px', borderRadius: 10, backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 700 }}>
                ❌ {players.length - presentCount} ausentes
              </span>
            </div>
          </div>

          {/* Lista jugadores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {players.map(player => {
              const present = attendance[player.id] !== false
              return (
                <div key={player.id} onClick={() => toggle(player.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: present ? '#f0fdf4' : '#fff',
                  border: `1.5px solid ${present ? '#86efac' : '#e5e7eb'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                      background: present ? 'linear-gradient(135deg,#52B043,#1C5C2A)' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: present ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 900
                    }}>{player.number ?? '—'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{player.full_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{player.position || '—'}</div>
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: present ? '#52B043' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, transition: 'all 0.15s'
                  }}>
                    {present ? '✓' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botón guardar */}
          <button onClick={handleSave} disabled={saving || players.length === 0} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
            color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 2px 12px rgba(82,176,67,0.3)'
          }}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar asistencia'}
          </button>
        </div>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No hay registros todavía</div>
            </div>
          )}
          {history.map(({ date, total, present }) => {
            const pct = Math.round((present / total) * 100)
            return (
              <div key={date} style={{
                backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px',
                border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' }}>
                    {present}/{total} · {pct}%
                  </div>
                </div>
                <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: pct >= 75 ? '#52B043' : pct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB: Estadísticas */}
      {tab === 'estadisticas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stats.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No hay datos todavía</div>
            </div>
          )}
          {stats.map(p => (
            <div key={p.id} style={{
              backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px',
              border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: p.total > 0 ? 8 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 900
                  }}>{p.number ?? '—'}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{p.full_name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.total > 0 ? `${p.present} de ${p.total} sesiones` : 'Sin registros'}</div>
                  </div>
                </div>
                {p.pct !== null && (
                  <div style={{
                    fontSize: 16, fontWeight: 900,
                    color: p.pct >= 75 ? '#16a34a' : p.pct >= 50 ? '#d97706' : '#ef4444'
                  }}>{p.pct}%</div>
                )}
              </div>
              {p.total > 0 && (
                <div style={{ height: 5, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, borderRadius: 3, backgroundColor: p.pct >= 75 ? '#52B043' : p.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
