'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const TYPES = {
  lesion:    { label: 'Lesión',    emoji: '🤕', color: '#ef4444', bg: '#fef2f2' },
  sancion:   { label: 'Sanción',   emoji: '🟨', color: '#d97706', bg: '#fffbeb' },
  expulsion: { label: 'Expulsión', emoji: '🟥', color: '#dc2626', bg: '#fff1f1' },
  conflicto: { label: 'Conflicto', emoji: '⚡', color: '#7c3aed', bg: '#f5f3ff' },
  otro:      { label: 'Otros',     emoji: '📋', color: '#6b7280', bg: '#f9fafb' },
}

const STATUS = {
  present:   { label: 'Presente',    color: '#16a34a', bg: '#f0fdf4' },
  absent:    { label: 'Ausente',     color: '#ef4444', bg: '#fef2f2' },
  late:      { label: 'Tarde',       color: '#d97706', bg: '#fffbeb' },
  justified: { label: 'Justificado', color: '#6366f1', bg: '#eef2ff' },
}

function emptyLine() {
  return { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
}

function addEventToLine(line, ev) {
  switch (ev.event_type) {
    case '2pt_made': line.pts += 2; line.fgm++; line.fga++; break
    case '2pt_miss': line.fga++; break
    case '3pt_made': line.pts += 3; line.fgm++; line.fga++; line.tpm++; line.tpa++; break
    case '3pt_miss': line.fga++; line.tpa++; break
    case 'ft_made':  line.pts += 1; line.ftm++; line.fta++; break
    case 'ft_miss':  line.fta++; break
    case 'rebound_off': case 'rebound_def': line.reb++; break
    case 'assist':  line.ast++; break
    case 'steal':   line.stl++; break
    case 'block':   line.blk++; break
    case 'turnover':line.tov++; break
    case 'foul_personal': case 'foul_technical': case 'foul_unsporting': case 'foul_disqualifying': line.pf++; break
  }
}

function shootPct(made, att) { return att > 0 ? Math.round((made / att) * 100) : null }
function avg(total, games) { return games > 0 ? (total / games).toFixed(1) : '—' }

function monthKey(dateStr) { return (dateStr || '').slice(0, 7) }
function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
}
function lastNMonthKeys(n) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

// Gráfico de barras minimalista para ver progresión mes a mes / partido a
// partido, sin depender de ninguna librería externa
function TrendChart({ data, valueSuffix = '', color = '#52B043', height = 100, emptyText = 'Sin datos suficientes todavía' }) {
  const hasData = data.some(d => d.value > 0)
  if (!hasData) {
    return <div style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>{emptyText}</div>
  }
  const max = Math.max(...data.map(d => d.value), 1)
  const barArea = height - 36
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, padding: '0 2px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{d.value > 0 ? `${d.value}${valueSuffix}` : ''}</div>
          <div style={{ width: '100%', maxWidth: 28, height: Math.max(3, (d.value / max) * barArea), backgroundColor: d.value > 0 ? color : '#eef2f7', borderRadius: 4 }} />
          <div style={{ fontSize: 9.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function Stars({ value, size = 14 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= (value || 0) ? '#f59e0b' : '#e2e8f0' }}>★</span>
      ))}
    </span>
  )
}

// Resumen automático (sin IA generativa: solo compara los datos ya
// calculados mes a mes / partido a partido y redacta frases a partir de
// esos números — coste cero, no depende de ningún servicio externo)
function buildInsights({ records, playerRatings, gameLines, activeIncidents }) {
  const insights = []

  // Asistencia: últimos dos meses con datos
  const attByMonth = {}
  records.forEach(r => {
    const mk = monthKey(r.date)
    if (!attByMonth[mk]) attByMonth[mk] = { total: 0, attended: 0 }
    attByMonth[mk].total++
    if (r.status === 'present' || r.status === 'late') attByMonth[mk].attended++
  })
  const attMonths = Object.keys(attByMonth).sort()
  if (attMonths.length >= 2) {
    const curr = attMonths[attMonths.length - 1]
    const prev = attMonths[attMonths.length - 2]
    const currPct = Math.round((attByMonth[curr].attended / attByMonth[curr].total) * 100)
    const prevPct = Math.round((attByMonth[prev].attended / attByMonth[prev].total) * 100)
    const diff = currPct - prevPct
    if (diff >= 10) insights.push({ icon: '📈', tone: 'good', text: `La asistencia ha mejorado: del ${prevPct}% al ${currPct}% respecto al mes anterior.` })
    else if (diff <= -10) insights.push({ icon: '📉', tone: 'bad', text: `La asistencia ha bajado: del ${prevPct}% al ${currPct}% respecto al mes anterior.` })
    else insights.push({ icon: '➖', tone: 'neutral', text: `La asistencia se mantiene estable, en torno al ${currPct}%.` })
  } else if (attMonths.length === 1) {
    const only = attMonths[0]
    const p = Math.round((attByMonth[only].attended / attByMonth[only].total) * 100)
    insights.push({ icon: 'ℹ️', tone: 'info', text: `Todavía es pronto para ver una tendencia de asistencia (de momento, ${p}%).` })
  }

  // Valoración en entrenamientos: últimos dos meses con valoraciones
  const ratByMonth = {}
  playerRatings.forEach(r => {
    if (!r.rating) return
    const mk = monthKey(r.training_sessions?.date)
    if (!mk) return
    if (!ratByMonth[mk]) ratByMonth[mk] = { sum: 0, count: 0 }
    ratByMonth[mk].sum += r.rating
    ratByMonth[mk].count++
  })
  const ratMonths = Object.keys(ratByMonth).sort()
  if (ratMonths.length >= 2) {
    const curr = ratMonths[ratMonths.length - 1]
    const prev = ratMonths[ratMonths.length - 2]
    const currAvg = (ratByMonth[curr].sum / ratByMonth[curr].count) * 2
    const prevAvg = (ratByMonth[prev].sum / ratByMonth[prev].count) * 2
    const diff = currAvg - prevAvg
    if (diff >= 0.8) insights.push({ icon: '📈', tone: 'good', text: `La valoración en los entrenamientos sube: de ${prevAvg.toFixed(1)} a ${currAvg.toFixed(1)} respecto al mes anterior.` })
    else if (diff <= -0.8) insights.push({ icon: '📉', tone: 'bad', text: `La valoración en los entrenamientos baja: de ${prevAvg.toFixed(1)} a ${currAvg.toFixed(1)} respecto al mes anterior.` })
    else insights.push({ icon: '➖', tone: 'neutral', text: `La valoración en los entrenamientos se mantiene estable, en torno a ${currAvg.toFixed(1)}.` })
  } else if (ratMonths.length === 1) {
    const only = ratMonths[0]
    const a = (ratByMonth[only].sum / ratByMonth[only].count) * 2
    insights.push({ icon: 'ℹ️', tone: 'info', text: `Todavía hay pocas valoraciones para ver una tendencia (de momento, ${a.toFixed(1)}).` })
  }

  // Estadísticas de partido: últimos 3 partidos vs el resto de la temporada
  const finished = [...gameLines].filter(g => g.status === 'finished').sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  if (finished.length >= 4) {
    const last3 = finished.slice(-3)
    const rest = finished.slice(0, -3)
    const avgLast3 = last3.reduce((a, g) => a + g.line.pts, 0) / last3.length
    const avgRest = rest.reduce((a, g) => a + g.line.pts, 0) / rest.length
    const diff = avgLast3 - avgRest
    if (diff >= 2) insights.push({ icon: '📈', tone: 'good', text: `Sube en anotación: promedia ${avgLast3.toFixed(1)} puntos en los últimos 3 partidos, frente a ${avgRest.toFixed(1)} en el resto de la temporada.` })
    else if (diff <= -2) insights.push({ icon: '📉', tone: 'bad', text: `Baja en anotación: promedia ${avgLast3.toFixed(1)} puntos en los últimos 3 partidos, frente a ${avgRest.toFixed(1)} en el resto de la temporada.` })
    else insights.push({ icon: '➖', tone: 'neutral', text: `Mantiene un promedio anotador estable, en torno a ${avgLast3.toFixed(1)} puntos por partido.` })
  } else if (finished.length > 0) {
    const avgAll = finished.reduce((a, g) => a + g.line.pts, 0) / finished.length
    insights.push({ icon: 'ℹ️', tone: 'info', text: `Todavía pocos partidos para ver tendencia (de momento, ${avgAll.toFixed(1)} puntos de media).` })
  }

  // Incidencias activas
  if (activeIncidents > 0) {
    insights.push({ icon: '⚠️', tone: 'bad', text: `Tiene ${activeIncidents} ${activeIncidents === 1 ? 'incidencia activa' : 'incidencias activas'} sin resolver.` })
  }

  return insights
}

const INSIGHT_TONES = {
  good:    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  bad:     { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  neutral: { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  info:    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
}

const TABS = [
  { key: 'resumen',       label: 'Resumen',       emoji: '🧭' },
  { key: 'asistencia',    label: 'Asistencia',    emoji: '📅' },
  { key: 'estadisticas',  label: 'Estadísticas',  emoji: '📊' },
  { key: 'incidencias',   label: 'Incidencias',   emoji: '⚠️' },
  { key: 'entrenamientos',label: 'Entrenamientos',emoji: '⭐' },
]

export default function JugadorPage() {
  const { user, profile, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [player, setPlayer] = useState(null)
  const [records, setRecords] = useState([])
  const [incidents, setIncidents] = useState([])
  const [gameLines, setGameLines] = useState([])
  const [season, setSeason] = useState(null)
  const [otherSeason, setOtherSeason] = useState(null)
  const [stats, setStats] = useState({ total: 0, attended: 0, absent: 0, late: 0, justified: 0, trainings: 0, trainingsAttended: 0, matches: 0, matchesAttended: 0 })
  const [otherStats, setOtherStats] = useState({ total: 0, attended: 0, byTeam: {} })
  const [playerRatings, setPlayerRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: p } = await supabase.from('players').select('*, teams(name, category, season)').eq('id', id).single()
    if (!p) { router.replace('/dashboard/equipo'); return }
    setPlayer(p)

    const [{ data: att }, { data: inc }, { data: gp }, { data: ratings }] = await Promise.all([
      supabase.from('attendance').select('date, status, type, team_id, teams(name)').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('incidents').select('*').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('game_players').select('game_id, jersey_number, starter, games(id, date, rival_name, our_score, rival_score, status, game_type, team_id, teams(name))').eq('player_id', id),
      supabase.from('training_player_ratings').select('*, training_sessions(date, title, team_id, teams(name))').eq('player_id', id).order('created_at', { ascending: false }),
    ])

    setRecords(att || [])
    setIncidents(inc || [])
    // La RLS ya filtra esto a "solo lo que puede ver este entrenador" (sus
    // propias valoraciones, o todas si es director) — es privado por diseño
    setPlayerRatings((ratings || []).filter(r => r.training_sessions))

    // Partidos: separados entre los de su propio equipo y los jugados con
    // otro equipo (doble ficha federada), para valorarlos aparte
    try {
      const gameRows = (gp || []).filter(r => r.games && !Array.isArray(r.games))
      const gameIds = gameRows.map(r => r.game_id)
      const { data: evs } = gameIds.length > 0
        ? await supabase.from('game_events').select('game_id, event_type').eq('player_id', id).in('game_id', gameIds)
        : { data: [] }

      const lineByGame = {}
      ;(evs || []).forEach(ev => {
        if (!lineByGame[ev.game_id]) lineByGame[ev.game_id] = emptyLine()
        addEventToLine(lineByGame[ev.game_id], ev)
      })

      const lines = gameRows
        .map(r => ({ ...r.games, jersey_number: r.jersey_number, starter: r.starter, line: lineByGame[r.game_id] || emptyLine() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const ownLines = lines.filter(g => g.team_id === p.team_id)
      const otherLines = lines.filter(g => g.team_id !== p.team_id)
      setGameLines(ownLines)

      const totals = emptyLine()
      ownLines.forEach(g => { Object.keys(totals).forEach(k => { totals[k] += g.line[k] }) })
      setSeason({ ...totals, gamesPlayed: ownLines.length })

      const otherTotals = emptyLine()
      otherLines.forEach(g => { Object.keys(otherTotals).forEach(k => { otherTotals[k] += g.line[k] }) })
      setOtherSeason({ ...otherTotals, gamesPlayed: otherLines.length, games: otherLines })
    } catch (err) {
      console.error('Error cargando estadísticas de partidos:', err)
      setGameLines([])
      setSeason({ ...emptyLine(), gamesPlayed: 0 })
      setOtherSeason({ ...emptyLine(), gamesPlayed: 0, games: [] })
    }

    // Asistencia: separada entre su propio equipo y otros equipos
    const s = { total: 0, attended: 0, absent: 0, late: 0, justified: 0, trainings: 0, trainingsAttended: 0, matches: 0, matchesAttended: 0 }
    const os = { total: 0, attended: 0, byTeam: {} }
    att?.forEach(r => {
      const attd = r.status === 'present' || r.status === 'late'
      if (r.team_id !== p.team_id) {
        os.total++
        if (attd) os.attended++
        const teamName = r.teams?.name || 'Otro equipo'
        if (!os.byTeam[teamName]) os.byTeam[teamName] = { total: 0, attended: 0 }
        os.byTeam[teamName].total++
        if (attd) os.byTeam[teamName].attended++
        return
      }
      const isMt = r.type === 'match'
      s.total++
      if (attd)                     s.attended++
      if (r.status === 'absent')    s.absent++
      if (r.status === 'late')      s.late++
      if (r.status === 'justified') s.justified++
      if (isMt) { s.matches++;   if (attd) s.matchesAttended++ }
      else      { s.trainings++; if (attd) s.trainingsAttended++ }
    })
    setStats(s)
    setOtherStats(os)
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
  if (!player) return null

  const pct         = stats.total     > 0 ? Math.round((stats.attended          / stats.total)     * 100) : null
  const pctTraining = stats.trainings > 0 ? Math.round((stats.trainingsAttended / stats.trainings) * 100) : null
  const pctMatch    = stats.matches   > 0 ? Math.round((stats.matchesAttended   / stats.matches)   * 100) : null

  const activeIncidents = incidents.filter(i => !i.resolved).length

  // Con su equipo vs. con otros equipos (doble ficha federada) — se
  // valoran por separado en todo el perfil
  const ownRecords = records.filter(r => r.team_id === player.team_id)
  const otherRecords = records.filter(r => r.team_id !== player.team_id)
  const ownRatings = playerRatings.filter(r => r.training_sessions?.team_id === player.team_id)
  const otherRatings = playerRatings.filter(r => r.training_sessions?.team_id !== player.team_id)

  // Las estrellas son de 1 a 5, pero para que la media "se lea" como una
  // nota (y no como un suspenso: 4 estrellas es un notable, no un 4/10) se
  // muestra reescalada sobre 10
  const ratedRatings = ownRatings.filter(r => r.rating)
  const ratingAvg = ratedRatings.length > 0 ? ((ratedRatings.reduce((a, r) => a + r.rating, 0) / ratedRatings.length) * 2).toFixed(1) : null
  const otherRatedRatings = otherRatings.filter(r => r.rating)
  const otherRatingAvg = otherRatedRatings.length > 0 ? ((otherRatedRatings.reduce((a, r) => a + r.rating, 0) / otherRatedRatings.length) * 2).toFixed(1) : null

  // ── Progresión mes a mes / partido a partido (siempre de su propio equipo) ──
  const monthKeys = lastNMonthKeys(6)

  const attendanceTrend = (() => {
    const byMonth = {}
    monthKeys.forEach(m => { byMonth[m] = { total: 0, attended: 0 } })
    ownRecords.forEach(r => {
      const mk = monthKey(r.date)
      if (!byMonth[mk]) return
      byMonth[mk].total++
      if (r.status === 'present' || r.status === 'late') byMonth[mk].attended++
    })
    return monthKeys.map(m => ({ label: monthLabel(m), value: byMonth[m].total > 0 ? Math.round((byMonth[m].attended / byMonth[m].total) * 100) : 0 }))
  })()

  const ratingTrend = (() => {
    const byMonth = {}
    monthKeys.forEach(m => { byMonth[m] = { sum: 0, count: 0 } })
    ownRatings.forEach(r => {
      const mk = monthKey(r.training_sessions?.date)
      if (!byMonth[mk] || !r.rating) return
      byMonth[mk].sum += r.rating
      byMonth[mk].count++
    })
    return monthKeys.map(m => ({ label: monthLabel(m), value: byMonth[m].count > 0 ? Number(((byMonth[m].sum / byMonth[m].count) * 2).toFixed(1)) : 0 }))
  })()

  const pointsTrend = [...gameLines]
    .filter(g => g.status === 'finished')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(-8)
    .map(g => ({
      label: g.date ? new Date(g.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—',
      value: g.line.pts,
    }))

  const insights = buildInsights({ records: ownRecords, playerRatings: ownRatings, gameLines, activeIncidents })

  const cardStyle = { backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', padding: '16px 18px', marginBottom: 16 }
  const cardTitleStyle = { fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }

  return (
    <div className="fade-in">
      <Link href='/dashboard/equipo' style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 20 }}>
        ← Volver al equipo
      </Link>

      {/* Cabecera jugador */}
      <div style={{
        borderRadius: 20, marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
        padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {player.teams?.name} · {player.teams?.season}
          </p>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>{player.full_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
            {player.position || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Dorsal</div>
          <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, lineHeight: 0.9, letterSpacing: -3 }}>{player.number ?? '—'}</div>
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.key
          const badge = t.key === 'incidencias' && activeIncidents > 0 ? activeIncidents : null
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: active ? 'linear-gradient(135deg,#1C5C2A,#52B043)' : '#f3f4f6',
              color: active ? '#fff' : '#374151',
              boxShadow: active ? '0 2px 8px rgba(28,92,42,0.30)' : 'none',
            }}>
              {t.emoji} {t.label}
              {badge && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '1px 6px', borderRadius: 6 }}>{badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ───────────────────────── RESUMEN ───────────────────────── */}
      {tab === 'resumen' && (
        <div>
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg,#fefce8,#fff)', border: '1px solid #fde68a' }}>
            <div style={{ ...cardTitleStyle, display: 'flex', alignItems: 'center', gap: 6 }}>🧠 Resumen automático de progresión</div>
            {insights.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#9ca3af' }}>Todavía no hay datos suficientes para generar un resumen.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {insights.map((ins, i) => {
                  const t = INSIGHT_TONES[ins.tone]
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '9px 12px' }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
                      <span style={{ fontSize: 13, color: t.color, fontWeight: 600, lineHeight: 1.4 }}>{ins.text}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Asistencia', value: pct !== null ? `${pct}%` : '—', color: pct !== null ? (pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444') : '#94a3b8' },
              { label: 'Puntos/partido', value: season && season.gamesPlayed > 0 ? avg(season.pts, season.gamesPlayed) : '—', color: '#2563eb' },
              { label: 'Valoración media', value: ratingAvg ?? '—', color: '#f59e0b' },
              { label: 'Incidencias', value: activeIncidents, color: activeIncidents > 0 ? '#ef4444' : '#16a34a' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px solid #e8edf3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>{value}</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>📅 Progresión de asistencia (% mensual)</div>
            <TrendChart data={attendanceTrend} valueSuffix="%" color="#16a34a" />
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>⭐ Progresión de valoración en entrenamientos</div>
            <TrendChart data={ratingTrend} color="#f59e0b" emptyText="Todavía no hay valoraciones de entrenamientos para este jugador" />
          </div>

          {season && season.gamesPlayed > 0 && (
            <div style={cardStyle}>
              <div style={cardTitleStyle}>📊 Puntos en los últimos partidos</div>
              <TrendChart data={pointsTrend} color="#2563eb" />
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────── ASISTENCIA ───────────────────────── */}
      {tab === 'asistencia' && (
        <div>
          {pct !== null && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Tasa de asistencia con su equipo</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' }}>{pct}%</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#eef2f7', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: pct >= 75 ? 'linear-gradient(90deg,#52B043,#3a8a2e)' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>
          )}

          {stats.total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ backgroundColor: '#f0fdf4', borderRadius: 14, padding: '14px 16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🏋️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Entrenamientos</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#15803d', marginBottom: 2 }}>
                  {pctTraining !== null ? `${pctTraining}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {stats.trainingsAttended}/{stats.trainings} sesiones
                </div>
                {stats.trainings > 0 && (
                  <div style={{ height: 6, backgroundColor: '#bbf7d0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctTraining}%`, borderRadius: 3, backgroundColor: '#16a34a' }} />
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#eff6ff', borderRadius: 14, padding: '14px 16px', border: '1px solid #bfdbfe', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🏆</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Partidos</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#1d4ed8', marginBottom: 2 }}>
                  {pctMatch !== null ? `${pctMatch}%` : '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {stats.matchesAttended}/{stats.matches} partidos
                </div>
                {stats.matches > 0 && (
                  <div style={{ height: 6, backgroundColor: '#bfdbfe', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctMatch}%`, borderRadius: 3, backgroundColor: '#2563eb' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Progresión de asistencia (% mensual)</div>
            <TrendChart data={attendanceTrend} valueSuffix="%" color="#16a34a" />
          </div>

          <h3 className="section-title" style={{ marginBottom: 12 }}>Historial de asistencia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: otherRecords.length > 0 ? 28 : 0 }}>
            {ownRecords.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">Sin registros todavía</div>
              </div>
            )}
            {ownRecords.map(r => {
              const { label, color, bg } = STATUS[r.status] || STATUS.present
              const isMatch = r.type === 'match'
              return (
                <div key={r.date + r.type} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: '#fff', borderRadius: 12, padding: '12px 16px',
                  border: `1px solid ${isMatch ? '#bfdbfe' : '#f3f4f6'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, flexShrink: 0,
                      backgroundColor: isMatch ? '#dbeafe' : '#dcfce7',
                      color: isMatch ? '#1d4ed8' : '#15803d',
                    }}>{isMatch ? '🏆' : '🏋️'}</span>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, backgroundColor: bg, padding: '4px 10px', borderRadius: 8 }}>{label}</span>
                </div>
              )
            })}
          </div>

          {/* Actividad con otros equipos (doble ficha federada) */}
          {otherRecords.length > 0 && (
            <>
              <h3 className="section-title" style={{ marginBottom: 12, color: '#7c3aed' }}>🔗 Actividad con otros equipos</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {Object.entries(otherStats.byTeam).map(([teamName, v]) => (
                  <span key={teamName} style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '5px 12px', borderRadius: 10 }}>
                    {teamName}: {v.attended}/{v.total} sesiones
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {otherRecords.map(r => {
                  const { label, color, bg } = STATUS[r.status] || STATUS.present
                  const isMatch = r.type === 'match'
                  return (
                    <div key={r.date + r.type + r.team_id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: '#fff', borderRadius: 12, padding: '12px 16px',
                      border: '1px dashed #ddd6fe',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, flexShrink: 0,
                          backgroundColor: isMatch ? '#dbeafe' : '#dcfce7',
                          color: isMatch ? '#1d4ed8' : '#15803d',
                        }}>{isMatch ? '🏆' : '🏋️'}</span>
                        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                          {new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>{r.teams?.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color, backgroundColor: bg, padding: '4px 10px', borderRadius: 8 }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────── ESTADÍSTICAS ───────────────────────── */}
      {tab === 'estadisticas' && (
        <div>
          {!season || season.gamesPlayed === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏀</div>
              <div className="empty-state-title">Sin estadísticas de partidos todavía</div>
            </div>
          ) : (
            <>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                  Media de la temporada · {season.gamesPlayed} {season.gamesPlayed === 1 ? 'partido' : 'partidos'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, backgroundColor: '#eef2f7' }}>
                  {[
                    { label: 'Puntos', value: avg(season.pts, season.gamesPlayed) },
                    { label: 'Rebotes', value: avg(season.reb, season.gamesPlayed) },
                    { label: 'Asistencias', value: avg(season.ast, season.gamesPlayed) },
                    { label: 'Robos', value: avg(season.stl, season.gamesPlayed) },
                    { label: 'Tapones', value: avg(season.blk, season.gamesPlayed) },
                    { label: 'Pérdidas', value: avg(season.tov, season.gamesPlayed) },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: '#fff', padding: '14px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 18px' }}>
                  {[
                    { label: 'Tiro de campo', made: season.fgm, att: season.fga },
                    { label: 'Triples', made: season.tpm, att: season.tpa },
                    { label: 'Tiros libres', made: season.ftm, att: season.fta },
                  ].map(s => {
                    const p = shootPct(s.made, s.att)
                    return (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: p !== null ? '#2563eb' : '#94a3b8' }}>{p !== null ? `${p}%` : '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.made}/{s.att}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={cardTitleStyle}>Puntos en los últimos partidos</div>
                <TrendChart data={pointsTrend} color="#2563eb" />
              </div>

              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Por partido</div>
                {gameLines.map(g => (
                  <Link key={g.id} href={`/live/${g.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
                    borderBottom: '1px solid #f9fafb', textDecoration: 'none', color: 'inherit'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>vs {g.rival_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {g.date ? new Date(g.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                        {g.status === 'finished' ? ` · ${g.our_score}-${g.rival_score}` : g.status === 'live' ? ' · En directo' : ' · Pendiente'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                      {[['PTS', g.line.pts], ['REB', g.line.reb], ['AST', g.line.ast]].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center', minWidth: 30 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{val}</div>
                          <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Estadísticas con otros equipos (doble ficha federada) */}
          {otherSeason && otherSeason.gamesPlayed > 0 && (
            <>
              <h3 className="section-title" style={{ marginTop: 24, marginBottom: 12, color: '#7c3aed' }}>🔗 Estadísticas con otros equipos</h3>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: '1px dashed #ddd6fe' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f5f3ff', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                  {otherSeason.gamesPlayed} {otherSeason.gamesPlayed === 1 ? 'partido' : 'partidos'} fuera de su equipo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, backgroundColor: '#f5f3ff' }}>
                  {[
                    { label: 'Puntos', value: avg(otherSeason.pts, otherSeason.gamesPlayed) },
                    { label: 'Rebotes', value: avg(otherSeason.reb, otherSeason.gamesPlayed) },
                    { label: 'Asistencias', value: avg(otherSeason.ast, otherSeason.gamesPlayed) },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: '#fff', padding: '14px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {otherSeason.games.map(g => (
                  <Link key={g.id} href={`/live/${g.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
                    borderTop: '1px solid #f9fafb', textDecoration: 'none', color: 'inherit'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>vs {g.rival_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {g.date ? new Date(g.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                        {g.status === 'finished' ? ` · ${g.our_score}-${g.rival_score}` : g.status === 'live' ? ' · En directo' : ' · Pendiente'}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>{g.teams?.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                      {[['PTS', g.line.pts], ['REB', g.line.reb], ['AST', g.line.ast]].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center', minWidth: 30 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{val}</div>
                          <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────── INCIDENCIAS ───────────────────────── */}
      {tab === 'incidencias' && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            Incidencias {activeIncidents > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '2px 9px', borderRadius: 7, marginLeft: 8 }}>
                {activeIncidents} activas
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 14, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.6 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Sin incidencias registradas</div>
              </div>
            ) : incidents.map(inc => {
              const t = TYPES[inc.type] || TYPES.otro
              return (
                <div key={inc.id} style={{
                  backgroundColor: '#fff', borderRadius: 12, border: `1px solid ${t.bg}`,
                  overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ backgroundColor: t.bg, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{t.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</span>
                      {!inc.resolved && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '1px 6px', borderRadius: 4 }}>ACTIVA</span>}
                      {inc.resolved && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '1px 6px', borderRadius: 4 }}>RESUELTA</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {new Date(inc.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{inc.description}</p>
                    {inc.resolved && inc.resolved_note && (
                      <p style={{ fontSize: 12, color: '#16a34a', margin: '6px 0 0', fontStyle: 'italic' }}>↳ {inc.resolved_note}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────── ENTRENAMIENTOS (valoraciones) ───────────────────────── */}
      {tab === 'entrenamientos' && (
        <div>
          <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 16px' }}>
            Solo se muestran las valoraciones que tú has hecho como entrenador (o todas, si eres director) — son privadas.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px solid #e8edf3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{ratingAvg ?? '—'}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valoración media</div>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px solid #e8edf3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{ratedRatings.length}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entrenamientos valorados</div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Progresión de valoración (media mensual)</div>
            <TrendChart data={ratingTrend} color="#f59e0b" emptyText="Todavía no hay valoraciones de entrenamientos para este jugador" />
          </div>

          <h3 className="section-title" style={{ marginBottom: 12 }}>Historial de valoraciones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: otherRatings.length > 0 ? 28 : 0 }}>
            {ownRatings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⭐</div>
                <div className="empty-state-title">Sin valoraciones todavía</div>
              </div>
            ) : ownRatings.map(r => (
              <div key={r.id} style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #fde68a', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: r.notes ? 6 : 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.training_sessions.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {new Date(r.training_sessions.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <Stars value={r.rating} />
                </div>
                {r.notes && <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{r.notes}</p>}
              </div>
            ))}
          </div>

          {/* Valoraciones con otros equipos (doble ficha federada) */}
          {otherRatings.length > 0 && (
            <>
              <h3 className="section-title" style={{ marginBottom: 12, color: '#7c3aed' }}>🔗 Valoraciones con otros equipos</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px dashed #ddd6fe', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{otherRatingAvg ?? '—'}</div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valoración media</div>
                </div>
                <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px dashed #ddd6fe', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{otherRatedRatings.length}</div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entrenamientos valorados</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {otherRatings.map(r => (
                  <div key={r.id} style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px dashed #ddd6fe', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: r.notes ? 6 : 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.training_sessions.title}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {new Date(r.training_sessions.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · <span style={{ color: '#7c3aed', fontWeight: 700 }}>{r.training_sessions.teams?.name}</span>
                        </div>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    {r.notes && <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{r.notes}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
