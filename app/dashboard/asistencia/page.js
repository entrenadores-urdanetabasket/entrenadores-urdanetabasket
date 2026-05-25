'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

const STATUS = {
  present:   { label: 'Presente',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  absent:    { label: 'Ausente',     color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  late:      { label: 'Tarde',       color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  justified: { label: 'Justificado', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEK_DAYS = ['L','M','X','J','V','S','D']

/* ── Mini calendario con días marcados ─────────────────────── */
function MiniCalendar({ selectedDate, markedDays, onSelectDate, onMonthChange }) {
  const [viewYear,  setViewYear]  = useState(() => parseInt(selectedDate.split('-')[0]))
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedDate.split('-')[1]) - 1)

  function goMonth(delta) {
    let m = viewMonth + delta, y = viewYear
    if (m < 0)  { m = 11; y-- }
    if (m > 11) { m = 0;  y++ }
    setViewMonth(m); setViewYear(y)
    onMonthChange(y, m + 1)   // 1-indexed month
  }

  const firstDow    = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7   // 0=Lun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today       = new Date().toISOString().split('T')[0]

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ backgroundColor:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'14px 16px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Navegación mes */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <button onClick={() => goMonth(-1)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#374151', padding:'0 6px', lineHeight:1 }}>‹</button>
        <span style={{ fontWeight:800, fontSize:14, color:'#111827' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={() => goMonth(1)}  style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#374151', padding:'0 6px', lineHeight:1 }}>›</button>
      </div>

      {/* Cabeceras días */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'#9ca3af' }}>{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ds = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSel   = ds === selectedDate
          const isToday = ds === today
          const type    = markedDays[ds]   // 'training' | 'match' | undefined
          return (
            <div key={i} onClick={() => onSelectDate(ds)} style={{
              textAlign:'center', borderRadius:7, cursor:'pointer', padding:'5px 0',
              fontSize:12,
              fontWeight: isSel ? 700 : type ? 600 : 400,
              backgroundColor: isSel        ? '#1C5C2A'
                             : type === 'training' ? '#dcfce7'
                             : type === 'match'    ? '#dbeafe'
                             : 'transparent',
              color: isSel ? '#fff' : '#111827',
              border: isToday && !isSel ? '1.5px solid #1C5C2A' : '1.5px solid transparent',
              transition: 'background 0.1s',
            }}>
              {day}
              {type && !isSel && (
                <div style={{ width:4, height:4, borderRadius:'50%', margin:'1px auto 0',
                  backgroundColor: type === 'training' ? '#16a34a' : '#2563eb' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display:'flex', gap:16, marginTop:12, justifyContent:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:'#16a34a' }} />
          <span style={{ fontSize:10, color:'#6b7280', fontWeight:600 }}>Entrenamiento</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:'#2563eb' }} />
          <span style={{ fontSize:10, color:'#6b7280', fontWeight:600 }}>Partido</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function AsistenciaPage() {
  const { user, profile, supabase, myTeams, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const [teams,        setTeams]        = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [players,      setPlayers]      = useState([])
  const [tab,          setTab]          = useState('lista')
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0])
  const [attendance,   setAttendance]   = useState({})
  const [sessionType,  setSessionType]  = useState('training')   // 'training' | 'match'
  const [markedDays,   setMarkedDays]   = useState({})           // { 'YYYY-MM-DD': 'training'|'match' }
  const [history,      setHistory]      = useState([])
  const [histFilter,   setHistFilter]   = useState('all')        // 'all' | 'training' | 'match'
  const [stats,        setStats]        = useState([])
  const [expanded,     setExpanded]     = useState(null)
  const [expandedData, setExpandedData] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [deletingDay,  setDeletingDay]  = useState(null)

  // Director lands on Historial (they can't mark attendance, only observe)
  useEffect(() => { if (isDirector) setTab('historial') }, [isDirector])

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
      if (data?.length > 0) await loadTeamData(data[0], 'historial')
      else setLoading(false)
    } else {
      if (!activeTeam) { setLoading(false); return }
      setTeams(myTeams)
      await loadTeamData(activeTeam, 'lista')
    }
  }

  async function loadTeamData(team, currentTab) {
    setSelectedTeam(team)
    const { data: p } = await supabase.from('players').select('*').eq('team_id', team.id).eq('active', true).order('number')
    const playerList = p || []
    setPlayers(playerList)
    const today = new Date()
    await Promise.all([
      loadAttendanceForDate(team, playerList, date),
      loadMarkedDays(team, today.getFullYear(), today.getMonth() + 1),
    ])
    if (currentTab === 'historial')    await loadHistory(team)
    if (currentTab === 'estadisticas') await loadStats(team, playerList)
    setLoading(false)
  }

  /* Carga asistencia de un día concreto (y el tipo de sesión guardado) */
  async function loadAttendanceForDate(team, playerList, d) {
    const { data } = await supabase.from('attendance').select('*').eq('team_id', team.id).eq('date', d)
    const map = {}
    if (data?.length > 0) {
      data.forEach(r => { map[r.player_id] = r.status })
      setSessionType(data[0].type || 'training')
    } else {
      playerList.forEach(p => { map[p.id] = 'present' })
      // mantener el tipo actual como defecto
    }
    setAttendance(map)
  }

  /* Carga días marcados del mes visible en el calendario */
  async function loadMarkedDays(team, year, month) {
    const t = team || selectedTeam
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end   = `${year}-${String(month).padStart(2,'0')}-31`
    const { data } = await supabase.from('attendance').select('date, type')
      .eq('team_id', t.id).gte('date', start).lte('date', end)
    const map = {}
    data?.forEach(r => { map[r.date] = r.type || 'training' })
    setMarkedDays(prev => ({ ...prev, ...map }))
  }

  async function loadHistory(team) {
    const t = team || selectedTeam
    const { data } = await supabase.from('attendance')
      .select('date, status, player_id, type')
      .eq('team_id', t.id).order('date', { ascending: false })
    if (!data) return
    const byDate = {}
    data.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { total:0, attended:0, absent:0, late:0, justified:0, type: r.type||'training', seen: new Set() }
      if (byDate[r.date].seen.has(r.player_id)) return
      byDate[r.date].seen.add(r.player_id)
      byDate[r.date].total++
      if (r.status === 'present' || r.status === 'late') byDate[r.date].attended++
      byDate[r.date][r.status] = (byDate[r.date][r.status] || 0) + 1
    })
    setHistory(Object.entries(byDate).map(([date, v]) => ({ date, ...v, seen: undefined })))
  }

  async function loadStats(team, playerList) {
    const t  = team || selectedTeam
    const pl = playerList || players
    const { data } = await supabase.from('attendance')
      .select('player_id, status, type').eq('team_id', t.id)
    if (!data) return
    const byPlayer = {}
    data.forEach(r => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = {
        total:0, attended:0, absent:0, late:0, justified:0,
        trainings:0, trainingsAttended:0,
        matches:0,   matchesAttended:0,
      }
      const bp  = byPlayer[r.player_id]
      const isMatch = r.type === 'match'
      const att     = r.status === 'present' || r.status === 'late'
      bp.total++
      if (att)              bp.attended++
      if (r.status==='absent')    bp.absent++
      if (r.status==='late')      bp.late++
      if (r.status==='justified') bp.justified++
      if (isMatch) { bp.matches++;   if (att) bp.matchesAttended++ }
      else         { bp.trainings++; if (att) bp.trainingsAttended++ }
    })
    const result = pl.map(p => ({
      ...p,
      ...byPlayer[p.id] || { total:0, attended:0, absent:0, late:0, justified:0, trainings:0, trainingsAttended:0, matches:0, matchesAttended:0 },
      pct:           byPlayer[p.id]?.total > 0    ? Math.round((byPlayer[p.id].attended / byPlayer[p.id].total) * 100) : null,
      pctTraining:   byPlayer[p.id]?.trainings > 0 ? Math.round((byPlayer[p.id].trainingsAttended / byPlayer[p.id].trainings) * 100) : null,
      pctMatch:      byPlayer[p.id]?.matches > 0   ? Math.round((byPlayer[p.id].matchesAttended   / byPlayer[p.id].matches)   * 100) : null,
    })).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
    setStats(result)
  }

  async function loadDayDetail(date) {
    if (expanded === date) { setExpanded(null); return }
    const { data } = await supabase.from('attendance').select('player_id, status').eq('team_id', selectedTeam.id).eq('date', date)
    const map = {}
    data?.forEach(r => { map[r.player_id] = r.status })
    setExpandedData(d => ({ ...d, [date]: map }))
    setExpanded(date)
  }

  async function handleTabChange(t) {
    setTab(t)
    if (t === 'historial')    await loadHistory()
    if (t === 'estadisticas') await loadStats()
  }

  async function handleSave() {
    setSaving(true)
    const rows = players.map(p => ({
      team_id:   selectedTeam.id,
      player_id: p.id,
      date,
      status:    attendance[p.id] ?? 'present',
      type:      sessionType,
      present:   (attendance[p.id] ?? 'present') !== 'absent',
    }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'player_id,date' })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setMarkedDays(prev => ({ ...prev, [date]: sessionType }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function deleteAttendanceDay(dayDate, e) {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar el registro de asistencia del ${new Date(dayDate+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}? Esta acción no se puede deshacer.`)) return
    setDeletingDay(dayDate)
    await supabase.from('attendance').delete().eq('team_id', selectedTeam.id).eq('date', dayDate)
    setHistory(prev => prev.filter(h => h.date !== dayDate))
    setMarkedDays(prev => { const next = { ...prev }; delete next[dayDate]; return next })
    setDeletingDay(null)
  }

  const cycleStatus = (id) => {
    const order = ['present', 'absent', 'late', 'justified']
    const current = attendance[id] ?? 'present'
    setAttendance(a => ({ ...a, [id]: order[(order.indexOf(current) + 1) % order.length] }))
  }

  const tabStyle = (t) => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
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

  const filteredHistory = histFilter === 'all' ? history : history.filter(h => h.type === histFilter)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Asistencia</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{selectedTeam.name} · {selectedTeam.category}</p>
      </div>

      {isDirector && teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => { setLoading(true); loadTeamData(t, tab) }} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam?.id === t.id ? '#fff' : '#374151'
            }}>{t.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {!isDirector && <button onClick={() => handleTabChange('lista')}        style={tabStyle('lista')}>📋 Pasar lista</button>}
        <button onClick={() => handleTabChange('historial')}    style={tabStyle('historial')}>📅 Historial</button>
        <button onClick={() => handleTabChange('estadisticas')} style={tabStyle('estadisticas')}>📊 Estadísticas</button>
      </div>

      {/* ── PASAR LISTA — solo entrenadores ──────────────── */}
      {tab === 'lista' && !isDirector && (
        <div>
          {/* Calendario */}
          <MiniCalendar
            selectedDate={date}
            markedDays={markedDays}
            onSelectDate={d => {
              setDate(d)
              loadAttendanceForDate(selectedTeam, players, d)
            }}
            onMonthChange={(y, m) => loadMarkedDays(selectedTeam, y, m)}
          />

          {/* Toggle entrenamiento / partido */}
          <div style={{ display:'flex', borderRadius:12, overflow:'hidden', border:'1.5px solid #e5e7eb', marginBottom:16 }}>
            <button onClick={() => setSessionType('training')} style={{
              flex:1, padding:'11px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
              background: sessionType === 'training' ? 'linear-gradient(135deg,#52B043,#1C5C2A)' : '#fff',
              color: sessionType === 'training' ? '#fff' : '#6b7280',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              🏋️ Entrenamiento
            </button>
            <button onClick={() => setSessionType('match')} style={{
              flex:1, padding:'11px', border:'none', borderLeft:'1.5px solid #e5e7eb', cursor:'pointer', fontWeight:700, fontSize:13,
              background: sessionType === 'match' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#fff',
              color: sessionType === 'match' ? '#fff' : '#6b7280',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              🏆 Partido
            </button>
          </div>

          {/* Resumen contadores */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {Object.entries(STATUS).map(([key, { label, color, bg }]) => counts[key] ? (
              <span key={key} style={{ padding:'6px 12px', borderRadius:10, backgroundColor:bg, color, fontSize:12, fontWeight:700 }}>
                {label}: {counts[key]}
              </span>
            ) : null)}
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Toca para cambiar: Presente → Ausente → Tarde → Justificado</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {players.map(player => {
              const status = attendance[player.id] ?? 'present'
              const { label, color, bg, border } = STATUS[status]
              return (
                <div key={player.id} onClick={() => cycleStatus(player.id)} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 18px', borderRadius:14, cursor:'pointer',
                  backgroundColor:bg, border:`1.5px solid ${border}`,
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{
                      width:38, height:38, borderRadius:9, flexShrink:0,
                      background: status==='present' ? 'linear-gradient(135deg,#52B043,#1C5C2A)' : '#e5e7eb',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color: status==='present' ? '#fff' : '#9ca3af', fontSize:14, fontWeight:900
                    }}>{player.number ?? '—'}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{player.full_name}</div>
                      <div style={{ fontSize:12, color:'#9ca3af' }}>{player.position || '—'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color, padding:'4px 10px', borderRadius:8, backgroundColor:'#fff' }}>{label}</span>
                </div>
              )
            })}
          </div>

          <button onClick={handleSave} disabled={saving || players.length === 0} style={{
            width:'100%', padding:'14px', borderRadius:12, border:'none',
            background: saving ? '#e5e7eb' : sessionType === 'match'
              ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
              : 'linear-gradient(135deg,#52B043,#3a8a2e)',
            color: saving ? '#9ca3af' : '#fff', fontSize:15, fontWeight:700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 2px 12px rgba(0,0,0,0.15)'
          }}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : `Guardar asistencia · ${sessionType === 'match' ? '🏆 Partido' : '🏋️ Entrenamiento'}`}
          </button>
        </div>
      )}

      {/* ── HISTORIAL ───────────────────────────────────── */}
      {tab === 'historial' && (
        <div>
          {/* Filtro tipo */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {[['all','Todos'],['training','Entrenamientos'],['match','Partidos']].map(([val, label]) => (
              <button key={val} onClick={() => setHistFilter(val)} style={{
                padding:'6px 14px', borderRadius:16, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                backgroundColor: histFilter===val ? (val==='match'?'#2563eb':val==='training'?'#16a34a':'#1C5C2A') : '#f3f4f6',
                color: histFilter===val ? '#fff' : '#374151',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filteredHistory.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📅</div>
                <div style={{ fontSize:14, fontWeight:600 }}>No hay registros todavía</div>
              </div>
            )}
            {filteredHistory.map(({ date, total, attended, absent, late, justified, type }) => {
              const pct    = total > 0 ? Math.round((attended / total) * 100) : 0
              const isOpen = expanded === date
              const detail = expandedData[date] || {}
              const isMatch = type === 'match'
              return (
                <div key={date} style={{ backgroundColor:'#fff', borderRadius:14, border:`1px solid ${isMatch?'#bfdbfe':'#f3f4f6'}`, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' }}>
                  <div onClick={() => loadDayDetail(date)} style={{ padding:'14px 18px', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {/* Badge tipo */}
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5,
                          backgroundColor: isMatch ? '#dbeafe' : '#dcfce7',
                          color: isMatch ? '#1d4ed8' : '#15803d',
                        }}>{isMatch ? '🏆 Partido' : '🏋️ Entrenamiento'}</span>
                        <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>
                          {new Date(date+'T12:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, fontWeight:700, color: pct>=75?'#16a34a':pct>=50?'#d97706':'#ef4444' }}>
                          {attended}/{total} · {pct}%
                        </span>
                        <span style={{ color:'#9ca3af', fontSize:12 }}>{isOpen ? '▲' : '▼'}</span>
                        <button
                          onClick={(e) => deleteAttendanceDay(date, e)}
                          disabled={deletingDay === date}
                          style={{
                            width: 28, height: 28, borderRadius: 7, border: '1px solid #fee2e2',
                            backgroundColor: deletingDay === date ? '#f3f4f6' : '#fff',
                            color: deletingDay === date ? '#d1d5db' : '#ef4444',
                            cursor: deletingDay === date ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, flexShrink: 0,
                          }}
                          title="Eliminar este registro"
                        >
                          {deletingDay === date ? '…' : '🗑'}
                        </button>
                      </div>
                    </div>
                    <div style={{ height:6, backgroundColor:'#f3f4f6', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, backgroundColor: isMatch?(pct>=75?'#2563eb':'#93c5fd'):(pct>=75?'#52B043':pct>=50?'#f59e0b':'#ef4444') }} />
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {[['absent',absent],['late',late],['justified',justified]].map(([key, val]) =>
                        val > 0 ? (
                          <span key={key} style={{ fontSize:11, fontWeight:600, color:STATUS[key].color, backgroundColor:STATUS[key].bg, padding:'3px 8px', borderRadius:6 }}>
                            {STATUS[key].label}: {val}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 18px', display:'flex', flexDirection:'column', gap:6 }}>
                      {players.map(p => {
                        const s = detail[p.id] || 'present'
                        const { label, color, bg } = STATUS[s]
                        return (
                          <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ width:22, height:22, borderRadius:5, background:'linear-gradient(135deg,#52B043,#1C5C2A)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:900, flexShrink:0 }}>{p.number??'—'}</span>
                              <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{p.full_name}</span>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color, backgroundColor:bg, padding:'3px 8px', borderRadius:6 }}>{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ESTADÍSTICAS ────────────────────────────────── */}
      {tab === 'estadisticas' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {stats.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
              <div style={{ fontSize:14, fontWeight:600 }}>No hay datos todavía</div>
            </div>
          )}
          {stats.map(p => (
            <Link key={p.id} href={`/dashboard/equipo/jugador/${p.id}`} style={{ textDecoration:'none' }}>
              <div style={{ backgroundColor:'#fff', borderRadius:14, padding:'14px 18px', border:'1px solid #f3f4f6', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', cursor:'pointer' }}>
                {/* Cabecera jugador */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:34, height:34, borderRadius:8, flexShrink:0,
                      background:'linear-gradient(135deg,#52B043,#1C5C2A)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontSize:13, fontWeight:900
                    }}>{p.number ?? '—'}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{p.full_name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{p.position || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {p.pct !== null && (
                      <div style={{ fontSize:18, fontWeight:900, color: p.pct>=75?'#16a34a':p.pct>=50?'#d97706':'#ef4444' }}>
                        {p.pct}%
                      </div>
                    )}
                    <span style={{ color:'#9ca3af', fontSize:14 }}>→</span>
                  </div>
                </div>

                {/* Barra total */}
                {p.total > 0 && (
                  <div style={{ height:5, backgroundColor:'#f3f4f6', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
                    <div style={{ height:'100%', width:`${p.pct}%`, borderRadius:3, backgroundColor: p.pct>=75?'#52B043':p.pct>=50?'#f59e0b':'#ef4444' }} />
                  </div>
                )}

                {/* Desglose entrenamientos / partidos */}
                {p.total > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {/* Entrenamientos */}
                    <div style={{ backgroundColor:'#f0fdf4', borderRadius:9, padding:'8px 10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#15803d' }}>🏋️ Entrenos</span>
                        <span style={{ fontSize:12, fontWeight:800, color:'#15803d' }}>
                          {p.pctTraining !== null ? `${p.pctTraining}%` : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>
                        {p.trainingsAttended}/{p.trainings} sesiones
                      </div>
                      {p.trainings > 0 && (
                        <div style={{ height:4, backgroundColor:'#bbf7d0', borderRadius:2, overflow:'hidden', marginTop:5 }}>
                          <div style={{ height:'100%', width:`${p.pctTraining}%`, borderRadius:2, backgroundColor:'#16a34a' }} />
                        </div>
                      )}
                    </div>
                    {/* Partidos */}
                    <div style={{ backgroundColor:'#eff6ff', borderRadius:9, padding:'8px 10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8' }}>🏆 Partidos</span>
                        <span style={{ fontSize:12, fontWeight:800, color:'#1d4ed8' }}>
                          {p.pctMatch !== null ? `${p.pctMatch}%` : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>
                        {p.matchesAttended}/{p.matches} partidos
                      </div>
                      {p.matches > 0 && (
                        <div style={{ height:4, backgroundColor:'#bfdbfe', borderRadius:2, overflow:'hidden', marginTop:5 }}>
                          <div style={{ height:'100%', width:`${p.pctMatch}%`, borderRadius:2, backgroundColor:'#2563eb' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {p.total === 0 && (
                  <div style={{ fontSize:12, color:'#9ca3af' }}>Sin registros</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
