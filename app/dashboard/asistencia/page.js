'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

const STATUS_LABELS = {
  present: { label: 'Presente', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  absent: { label: 'Ausente', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  late: { label: 'Tarde', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  justified: { label: 'Justificado', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
}

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

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').order('name')
      setTeams(data || [])
      if (data?.length > 0) await loadTeamData(data[0], tab)
      else setLoading(false)
    } else {
      const { data } = await supabase.from('teams').select('*').eq('coach_id', user.id).single()
      if (data) { setTeams([data]); await loadTeamData(data, tab) }
      else setLoading(false)
    }
  }

  async function loadTeamData(team, currentTab) {
    setSelectedTeam(team)
    const { data: p } = await supabase.from('players').select('*').eq('team_id', team.id).eq('active', true).order('number')
    const playerList = p || []
    setPlayers(playerList)
    await loadAttendanceForDate(team, playerList, date)
    if (currentTab === 'historial') await loadHistory(team)
    if (currentTab === 'estadisticas') await loadStats(team, playerList)
    setLoading(false)
  }

  async function loadAttendanceForDate(team, playerList, d) {
    const { data } = await supabase.from('attendance').select('*').eq('team_id', team.id).eq('date', d)
    const map = {}
    if (data?.length > 0) {
      data.forEach(r => { map[r.player_id] = r.status })
    } else {
      playerList.forEach(p => { map[p.id] = 'present' })
    }
    setAttendance(map)
  }

  async function loadHistory(team) {
    const t = team || selectedTeam
    const { data } = await supabase.from('attendance').select('date, status, player_id').eq('team_id', t.id).order('date', { ascending: false })
    if (!data) return
    const byDate = {}
    data.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { total: 0, present: 0, absent: 0, late: 0, justified: 0 }
      byDate[r.date].total++
      byDate[r.date][r.status] = (byDate[r.date][r.status] || 0) + 1
      if (r.status === 'present') byDate[r.date].present++
    })
    setHistory(Object.entries(byDate).map(([date, v]) => ({ date, ...v })))
  }

  async function loadStats(team, playerList) {
    const t = team || selectedTeam
    const pl = playerList || players
    const { data } = await supabase.from('attendance').select('player_id, status').eq('team_id', t.id)
    if (!data) return
    const byPlayer = {}
    data.forEach(r => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = { total: 0, present: 0 }
      byPlayer[r.player_id].total++
      if (r.status === 'present') byPlayer[r.player_id].present++
    })
    const result = pl.map(p => ({
      ...p,
      total: byPlayer[p.id]?.total || 0,
      present: byPlayer[p.id]?.present || 0,
      pct: byPlayer[p.id] ? Math.round((byPlayer[p.id].present / byPlayer[p.id].total) * 100) : null
    })).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
    setStats(result)
  }

  async function handleTabChange(t) {
    setTab(t)
    if (t === 'historial') await loadHistory()
    if (t === 'estadisticas') await loadStats()
  }

  async function handleTeamChange(team) {
    setLoading(true)
    await loadTeamData(team, tab)
  }

  async function handleDateChange(d) {
    setDate(d)
    await loadAttendanceForDate(selectedTeam, players, d)
  }

  async function handleSave() {
    setSaving(true)
    const rows = players.map(p => ({
      team_id: selectedTeam.id,
      player_id: p.id,
      date,
      status: attendance[p.id] ?? 'present',
      type: 'training',
      present: attendance[p.id] !== 'absent' && attendance[p.id] !== undefined
    }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'player_id,date' })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const cycleStatus = (id) => {
    const order = ['present', 'absent', 'late', 'justified']
    const current = attendance[id] ?? 'present'
    const next = order[(order.indexOf(current) + 1) % order.length]
    setAttendance(a => ({ ...a, [id]: next }))
  }

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

  const counts = players.reduce((acc, p) => {
    const s = attendance[p.id] ?? 'present'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Asistencia</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{selectedTeam.name} · {selectedTeam.category}</p>
      </div>

      {isDirector && teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => handleTeamChange(t)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam?.id === t.id ? '#fff' : '#374151'
            }}>{t.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => handleTabChange('lista')} style={tabStyle('lista')}>📋 Pasar lista</button>
        <button onClick={() => handleTabChange('historial')} style={tabStyle('historial')}>📅 Historial</button>
        <button onClick={() => handleTabChange('estadisticas')} style={tabStyle('estadisticas')}>📊 Estadísticas</button>
      </div>

      {tab === 'lista' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input type='date' value={date} onChange={e => handleDateChange(e.target.value)} style={{
              padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb',
              fontSize: 14, color: '#111827', outline: 'none', backgroundColor: '#fff'
            }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_LABELS).map(([key, { label, color, bg }]) => counts[key] ? (
                <span key={key} style={{ padding: '6px 12px', borderRadius: 10, backgroundColor: bg, color, fontSize: 12, fontWeight: 700 }}>
                  {label}: {counts[key]}
                </span>
              ) : null)}
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Toca para cambiar: Presente → Ausente → Tarde → Justificado</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {players.map(player => {
              const status = attendance[player.id] ?? 'present'
              const { label, color, bg, border } = STATUS_LABELS[status]
              return (
                <div key={player.id} onClick={() => cycleStatus(player.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: bg, border: `1.5px solid ${border}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                      background: status === 'present' ? 'linear-gradient(135deg,#52B043,#1C5C2A)' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: status === 'present' ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 900
                    }}>{player.number ?? '—'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{player.full_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{player.position || '—'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, padding: '4px 10px', borderRadius: 8, backgroundColor: '#fff' }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

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

      {tab === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No hay registros todavía</div>
            </div>
          )}
          {history.map(({ date, total, present, absent, late, justified }) => {
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
                <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: pct >= 75 ? '#52B043' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['absent', absent], ['late', late], ['justified', justified]].map(([key, val]) =>
                    val > 0 ? (
                      <span key={key} style={{ fontSize: 11, fontWeight: 600, color: STATUS_LABELS[key].color, backgroundColor: STATUS_LABELS[key].bg, padding: '3px 8px', borderRadius: 6 }}>
                        {STATUS_LABELS[key].label}: {val}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
                  <div style={{ fontSize: 16, fontWeight: 900, color: p.pct >= 75 ? '#16a34a' : p.pct >= 50 ? '#d97706' : '#ef4444' }}>
                    {p.pct}%
                  </div>
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
