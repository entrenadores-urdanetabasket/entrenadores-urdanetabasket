'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT']

const EVENT_TYPES = {
  '2pt_made':   { label: '2 puntos ✓',  points: 2,  color: '#16a34a', bg: '#f0fdf4', needsShot: true  },
  '3pt_made':   { label: '3 puntos ✓',  points: 3,  color: '#16a34a', bg: '#f0fdf4', needsShot: true  },
  '2pt_miss':   { label: '2 puntos ✗',  points: 0,  color: '#ef4444', bg: '#fef2f2', needsShot: true  },
  '3pt_miss':   { label: '3 puntos ✗',  points: 0,  color: '#ef4444', bg: '#fef2f2', needsShot: true  },
  'ft_made':    { label: 'TL ✓',         points: 1,  color: '#16a34a', bg: '#f0fdf4', needsShot: false },
  'ft_miss':    { label: 'TL ✗',         points: 0,  color: '#ef4444', bg: '#fef2f2', needsShot: false },
  'rebound_off':{ label: 'Reb. ofensivo',points: 0,  color: '#7c3aed', bg: '#f5f3ff', needsShot: false },
  'rebound_def':{ label: 'Reb. defensivo',points: 0, color: '#6366f1', bg: '#eef2ff', needsShot: false },
  'assist':     { label: 'Asistencia',   points: 0,  color: '#0891b2', bg: '#ecfeff', needsShot: false },
  'turnover':   { label: 'Pérdida',      points: 0,  color: '#d97706', bg: '#fffbeb', needsShot: false },
  'steal':      { label: 'Robo',         points: 0,  color: '#059669', bg: '#ecfdf5', needsShot: false },
  'block':      { label: 'Tapón',        points: 0,  color: '#0284c7', bg: '#f0f9ff', needsShot: false },
  'foul_personal':  { label: 'Falta personal', points: 0, color: '#dc2626', bg: '#fef2f2', needsShot: false },
  'foul_technical': { label: 'Falta técnica',  points: 0, color: '#b91c1c', bg: '#fff1f2', needsShot: false },
  'foul_unsport':   { label: 'Falta antidep.', points: 0, color: '#7f1d1d', bg: '#fef2f2', needsShot: false },
}

// ─── MAPA DE TIRO SVG ─────────────────────────────────────────────────────────
// Half-court: width=1, height=~0.94 (ratio NBA half court ~28m x 15m → 1 x 0.536, but we use 1:0.94 visual)
function CourtSVG({ onShot, shots = [] }) {
  const W = 340, H = 320
  function handleClick(e) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onShot && onShot(x, y)
  }
  function sx(x) { return x * W }
  function sy(y) { return y * H }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, cursor: onShot ? 'crosshair' : 'default', borderRadius: 12, touchAction: 'none' }}
      onClick={handleClick}>
      {/* Cancha */}
      <rect x={0} y={0} width={W} height={H} fill="#fef9f0" rx={12} />
      {/* Línea de fondo */}
      <line x1={10} y1={H - 10} x2={W - 10} y2={H - 10} stroke="#d97706" strokeWidth={2} />
      {/* Líneas laterales */}
      <line x1={10} y1={10} x2={10} y2={H - 10} stroke="#d97706" strokeWidth={2} />
      <line x1={W - 10} y1={10} x2={W - 10} y2={H - 10} stroke="#d97706" strokeWidth={2} />
      {/* Zona pintada */}
      <rect x={sx(0.35)} y={sy(0.55)} width={sx(0.30)} height={sy(0.42)} fill="none" stroke="#d97706" strokeWidth={1.5} />
      {/* Semicírculo zona */}
      <path d={`M ${sx(0.35)} ${sy(0.76)} A ${sx(0.15)} ${sy(0.15)} 0 0 1 ${sx(0.65)} ${sy(0.76)}`} fill="none" stroke="#d97706" strokeWidth={1.5} />
      {/* Aro */}
      <circle cx={sx(0.5)} cy={sy(0.92)} r={10} fill="none" stroke="#ef4444" strokeWidth={2.5} />
      {/* Tablero */}
      <rect x={sx(0.37)} y={sy(0.97)} width={sx(0.26)} height={5} fill="none" stroke="#374151" strokeWidth={2} />
      {/* Línea triple (semicírculo + rectas) */}
      <path d={`M ${sx(0.06)} ${sy(0.72)} A ${sx(0.44)} ${sy(0.44)} 0 0 1 ${sx(0.94)} ${sy(0.72)}`} fill="none" stroke="#1d4ed8" strokeWidth={1.5} strokeDasharray="4 2" />
      <line x1={sx(0.06)} y1={sy(0.18)} x2={sx(0.06)} y2={sy(0.72)} stroke="#1d4ed8" strokeWidth={1.5} strokeDasharray="4 2" />
      <line x1={sx(0.94)} y1={sy(0.18)} x2={sx(0.94)} y2={sy(0.72)} stroke="#1d4ed8" strokeWidth={1.5} strokeDasharray="4 2" />
      {/* Línea media */}
      <line x1={10} y1={10} x2={W - 10} y2={10} stroke="#d97706" strokeWidth={1.5} strokeDasharray="6 3" />

      {/* Tiros registrados */}
      {shots.map((s, i) => (
        <g key={i}>
          <circle cx={sx(s.x)} cy={sy(s.y)} r={7}
            fill={s.made ? 'rgba(22,163,74,0.8)' : 'rgba(239,68,68,0.8)'}
            stroke={s.made ? '#15803d' : '#dc2626'} strokeWidth={1.5} />
          {!s.made && (
            <>
              <line x1={sx(s.x) - 4} y1={sy(s.y) - 4} x2={sx(s.x) + 4} y2={sy(s.y) + 4} stroke="#dc2626" strokeWidth={1.5} />
              <line x1={sx(s.x) + 4} y1={sy(s.y) - 4} x2={sx(s.x) - 4} y2={sy(s.y) + 4} stroke="#dc2626" strokeWidth={1.5} />
            </>
          )}
        </g>
      ))}

      {/* Label */}
      <text x={W / 2} y={sy(0.5)} textAnchor="middle" fontSize={11} fill="#d97706" fontWeight="600" opacity={0.5}>
        {onShot ? 'Toca donde fue el tiro' : ''}
      </text>
    </svg>
  )
}

// ─── FUNCIÓN BOX SCORE ────────────────────────────────────────────────────────
function computeBoxScore(events, ourPlayers, rivalJerseys) {
  const initStats = () => ({
    pts: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
    reb: 0, reb_off: 0, reb_def: 0, ast: 0, stl: 0, blk: 0, tov: 0,
    fouls: 0,
  })

  const ourStats = {}
  ourPlayers.forEach(p => { ourStats[p.player_id] = { ...initStats(), player: p } })

  const rivalStats = {}
  rivalJerseys.forEach(n => { rivalStats[n] = { ...initStats(), jersey: n } })

  let ourScore = 0, rivalScore = 0

  events.forEach(ev => {
    const isOur = ev.team === 'us'
    const stats = isOur
      ? ourStats[ev.player_id]
      : rivalStats[ev.rival_jersey]

    if (!stats) return

    switch (ev.event_type) {
      case '2pt_made':   stats.pts += 2; stats.fg2m++; stats.fg2a++; if (isOur) ourScore += 2; else rivalScore += 2; break
      case '2pt_miss':   stats.fg2a++; break
      case '3pt_made':   stats.pts += 3; stats.fg3m++; stats.fg3a++; if (isOur) ourScore += 3; else rivalScore += 3; break
      case '3pt_miss':   stats.fg3a++; break
      case 'ft_made':    stats.pts += 1; stats.ftm++; stats.fta++;   if (isOur) ourScore += 1; else rivalScore += 1; break
      case 'ft_miss':    stats.fta++; break
      case 'rebound_off':stats.reb++; stats.reb_off++; break
      case 'rebound_def':stats.reb++; stats.reb_def++; break
      case 'assist':     stats.ast++; break
      case 'steal':      stats.stl++; break
      case 'block':      stats.blk++; break
      case 'turnover':   stats.tov++; break
      case 'foul_personal':
      case 'foul_technical':
      case 'foul_unsport': stats.fouls++; break
    }
  })

  return { ourStats: Object.values(ourStats), rivalStats: Object.values(rivalStats), ourScore, rivalScore }
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function GamePage() {
  const { user, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [game, setGame]           = useState(null)
  const [gamePlayers, setGamePlayers] = useState([]) // { id, player_id, jersey_number, starter, full_name, number }
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('live') // 'live' | 'boxscore' | 'shotmap'

  // Live state
  const [quarter, setQuarter]     = useState('Q1')
  const [selectedTeam, setSelectedTeam] = useState('us') // 'us' | 'rival'
  const [selectedPlayer, setSelectedPlayer] = useState(null) // player_id or rival jersey number
  const [pendingFollowUp, setPendingFollowUp] = useState(null)
  // { type: 'ask_assist'|'ask_rebound', shooterTeam, shooterPlayer, eventId, points }

  // Shot map modal
  const [shotModal, setShotModal] = useState(null)
  // { eventType, team, player, points }

  const [saving, setSaving]       = useState(false)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => { if (user) loadGame() }, [user])

  async function loadGame() {
    const { data: g } = await supabase.from('games').select('*').eq('id', id).single()
    if (!g) { router.replace('/dashboard/estadisticas'); return }
    setGame(g)
    if (g.quarter) setQuarter(g.quarter)

    const { data: gp } = await supabase
      .from('game_players')
      .select('*, players(full_name, number)')
      .eq('game_id', id)

    setGamePlayers(gp || [])

    const { data: ev } = await supabase
      .from('game_events')
      .select('*')
      .eq('game_id', id)
      .order('created_at', { ascending: true })

    setEvents(ev || [])
    setLoading(false)
  }

  // ── Scores derivados ──────────────────────────────────────────────────────
  const { ourScore, rivalScore } = computeBoxScore(events, gamePlayers, game?.rival_roster || [])

  // ── Guardar evento ────────────────────────────────────────────────────────
  async function saveEvent({ eventType, team, playerId, rivalJersey, shotX, shotY, linkedEventId }) {
    if (saving) return
    setSaving(true)
    const meta = EVENT_TYPES[eventType] || {}
    const { data: ev, error } = await supabase
      .from('game_events')
      .insert({
        game_id: id,
        team,
        event_type: eventType,
        player_id: playerId || null,
        rival_jersey: rivalJersey ?? null,
        quarter,
        minute: null,
        points: meta.points || 0,
        shot_x: shotX ?? null,
        shot_y: shotY ?? null,
        linked_event_id: linkedEventId || null,
      })
      .select()
      .single()

    if (!error && ev) {
      setEvents(prev => [...prev, ev])
      // Update score on game
      const newOur   = ourScore   + (team === 'us'    ? (meta.points || 0) : 0)
      const newRival = rivalScore + (team === 'rival' ? (meta.points || 0) : 0)
      await supabase.from('games').update({ our_score: newOur, rival_score: newRival, status: 'live', quarter }).eq('id', id)
      setGame(prev => prev ? { ...prev, our_score: newOur, rival_score: newRival, status: 'live' } : prev)
      setSaving(false)
      return ev
    }
    setSaving(false)
    return null
  }

  // ── Lógica de acción ──────────────────────────────────────────────────────
  async function handleAction(eventType) {
    if (!selectedPlayer && selectedPlayer !== 0) {
      alert('Selecciona primero un jugador'); return
    }
    const isOur = selectedTeam === 'us'
    const playerId     = isOur ? selectedPlayer : null
    const rivalJersey  = isOur ? null : selectedPlayer
    const meta = EVENT_TYPES[eventType]

    // Si necesita shot map, abrir modal
    if (meta?.needsShot) {
      setShotModal({ eventType, team: selectedTeam, playerId, rivalJersey, points: meta.points })
      return
    }

    // Resolver follow-up si estamos respondiendo
    if (pendingFollowUp) {
      // No aplica aquí (los follow-ups se manejan con botones propios)
    }

    const ev = await saveEvent({ eventType, team: selectedTeam, playerId, rivalJersey })
    if (!ev) return

    // Cadena inteligente
    chainFollowUp(eventType, selectedTeam, playerId, rivalJersey, ev.id)
  }

  async function handleShotConfirm(x, y) {
    if (!shotModal) return
    const { eventType, team, playerId, rivalJersey } = shotModal
    setShotModal(null)
    const ev = await saveEvent({ eventType, team, playerId, rivalJersey, shotX: x, shotY: y })
    if (!ev) return
    chainFollowUp(eventType, team, playerId, rivalJersey, ev.id)
  }

  function chainFollowUp(eventType, team, playerId, rivalJersey, eventId) {
    if (eventType === '2pt_made' || eventType === '3pt_made' || eventType === 'ft_made') {
      setPendingFollowUp({ type: 'ask_assist', shooterTeam: team, shooterPlayer: playerId ?? rivalJersey, eventId })
    } else if (eventType === '2pt_miss' || eventType === '3pt_miss' || eventType === 'ft_miss') {
      setPendingFollowUp({ type: 'ask_rebound', shooterTeam: team, shooterPlayer: playerId ?? rivalJersey, eventId })
    } else {
      setPendingFollowUp(null)
    }
  }

  async function handleFollowUpAssist(withAssist) {
    if (!pendingFollowUp) return
    if (withAssist) {
      if (!selectedPlayer && selectedPlayer !== 0) {
        alert('Selecciona el asistente'); return
      }
      const isOur = pendingFollowUp.shooterTeam === 'us'
      const playerId    = isOur ? selectedPlayer : null
      const rivalJersey = isOur ? null : selectedPlayer
      await saveEvent({ eventType: 'assist', team: pendingFollowUp.shooterTeam, playerId, rivalJersey, linkedEventId: pendingFollowUp.eventId })
    }
    setPendingFollowUp(null)
  }

  async function handleFollowUpRebound(reboundTeam) {
    if (!pendingFollowUp) return
    if (!selectedPlayer && selectedPlayer !== 0) {
      alert('Selecciona el reboteador'); return
    }
    const isOur = reboundTeam === 'us'
    const playerId    = isOur ? selectedPlayer : null
    const rivalJersey = isOur ? null : selectedPlayer
    const isOffensive = reboundTeam === pendingFollowUp.shooterTeam
    await saveEvent({
      eventType: isOffensive ? 'rebound_off' : 'rebound_def',
      team: reboundTeam, playerId, rivalJersey,
      linkedEventId: pendingFollowUp.eventId
    })
    setPendingFollowUp(null)
  }

  async function handleFinishGame() {
    if (!window.confirm('¿Finalizar el partido? No podrás añadir más eventos.')) return
    setFinishing(true)
    await supabase.from('games').update({ status: 'finished', our_score: ourScore, rival_score: rivalScore }).eq('id', id)
    setGame(prev => prev ? { ...prev, status: 'finished' } : prev)
    setFinishing(false)
  }

  async function handleDeleteLastEvent() {
    if (events.length === 0) return
    if (!window.confirm('¿Eliminar el último evento registrado?')) return
    const last = events[events.length - 1]
    await supabase.from('game_events').delete().eq('id', last.id)
    setEvents(prev => prev.slice(0, -1))
    setPendingFollowUp(null)
  }

  // ── PDF / Print ────────────────────────────────────────────────────────────
  function handlePrint() { window.print() }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14, padding: 20 }}>Cargando...</div>
  if (!game)   return null

  const isFinished = game.status === 'finished'
  const rivalJerseys = game.rival_roster || []
  const { ourStats, rivalStats } = computeBoxScore(events, gamePlayers, rivalJerseys)

  // Shots para mapa
  const ourShots = events.filter(e => e.team === 'us' && e.shot_x != null).map(e => ({
    x: e.shot_x, y: e.shot_y,
    made: e.event_type.endsWith('_made')
  }))
  const rivalShots = events.filter(e => e.team === 'rival' && e.shot_x != null).map(e => ({
    x: e.shot_x, y: e.shot_y,
    made: e.event_type.endsWith('_made')
  }))

  const TIROS_TYPES   = ['2pt_made','2pt_miss','3pt_made','3pt_miss','ft_made','ft_miss']
  const ACCIONES_TYPES= ['rebound_off','rebound_def','assist','turnover','steal','block']
  const FALTAS_TYPES  = ['foul_personal','foul_technical','foul_unsport']

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .print-section { page-break-before: always; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print">
        <Link href="/dashboard/estadisticas" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#6b7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 16
        }}>← Volver</Link>
      </div>

      {/* ─── SCOREBOARD ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg,#1C5C2A 0%,#2d7a3f 50%,#1C5C2A 100%)',
        borderRadius: 18, padding: '16px 20px', marginBottom: 16,
        boxShadow: '0 4px 20px rgba(28,92,42,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Nosotros */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 4 }}>NOSOTROS</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{ourScore}</div>
          </div>
          {/* Centro */}
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            {game.status === 'live' && (
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fca5a5', backgroundColor: 'rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 6, marginBottom: 6 }}>🔴 EN VIVO</div>
            )}
            {isFinished && (
              <div style={{ fontSize: 10, fontWeight: 800, color: '#86efac', backgroundColor: 'rgba(22,163,74,0.2)', padding: '2px 8px', borderRadius: 6, marginBottom: 6 }}>FINAL</div>
            )}
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>–</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>vs {game.rival_name}</div>
          </div>
          {/* Rival */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 4 }}>RIVAL</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{rivalScore}</div>
          </div>
        </div>

        {/* Quarter selector */}
        {!isFinished && (
          <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
            {QUARTERS.map(q => (
              <button key={q} onClick={() => setQuarter(q)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 800,
                backgroundColor: quarter === q ? '#fff' : 'rgba(255,255,255,0.15)',
                color: quarter === q ? '#1C5C2A' : 'rgba(255,255,255,0.7)',
              }}>{q}</button>
            ))}
          </div>
        )}
      </div>

      {/* ─── TABS ────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'live',     label: '🎮 En vivo' },
          { key: 'boxscore', label: '📊 Box Score' },
          { key: 'shotmap',  label: '🎯 Mapa tiro' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: tab === t.key ? '#1C5C2A' : '#f3f4f6',
            color: tab === t.key ? '#fff' : '#6b7280',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── TAB: EN VIVO ────────────────────────────────────────────────── */}
      {tab === 'live' && !isFinished && (
        <div className="no-print">
          {/* Follow-up inteligente */}
          {pendingFollowUp && (
            <div style={{
              backgroundColor: '#fffbeb', border: '2px solid #fbbf24',
              borderRadius: 14, padding: '14px 16px', marginBottom: 14,
              boxShadow: '0 2px 10px rgba(251,191,36,0.2)'
            }}>
              {pendingFollowUp.type === 'ask_assist' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
                    🏀 ¿Hubo asistencia en esta canasta?
                  </div>
                  <p style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                    Selecciona el jugador que asistió y pulsa "Con asistencia", o pulsa "Sin asistencia"
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleFollowUpAssist(true)} style={{
                      flex: 1, padding: '9px', backgroundColor: '#16a34a', color: '#fff',
                      border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>✓ Con asistencia</button>
                    <button onClick={() => handleFollowUpAssist(false)} style={{
                      flex: 1, padding: '9px', backgroundColor: '#e5e7eb', color: '#374151',
                      border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>✗ Sin asistencia</button>
                  </div>
                </>
              )}
              {pendingFollowUp.type === 'ask_rebound' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
                    🏀 ¿Quién recogió el rebote?
                  </div>
                  <p style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                    Selecciona el jugador que recogió el rebote y elige el equipo
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleFollowUpRebound('us')} style={{
                      flex: 1, padding: '9px', backgroundColor: '#1C5C2A', color: '#fff',
                      border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>🟢 Nuestro reb.</button>
                    <button onClick={() => handleFollowUpRebound('rival')} style={{
                      flex: 1, padding: '9px', backgroundColor: '#dc2626', color: '#fff',
                      border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>🔴 Rebote rival</button>
                    <button onClick={() => setPendingFollowUp(null)} style={{
                      padding: '9px 12px', backgroundColor: '#e5e7eb', color: '#374151',
                      border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>–</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Selector equipo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'us',    label: '🟢 Nosotros' },
              { key: 'rival', label: '🔴 Rival' },
            ].map(t => (
              <button key={t.key} onClick={() => { setSelectedTeam(t.key); setSelectedPlayer(null) }} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                backgroundColor: selectedTeam === t.key ? (t.key === 'us' ? '#1C5C2A' : '#dc2626') : '#f3f4f6',
                color: selectedTeam === t.key ? '#fff' : '#6b7280',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Selector jugadores */}
          <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', padding: '12px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 8 }}>
              {selectedTeam === 'us' ? 'Jugador' : 'Dorsal rival'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {selectedTeam === 'us'
                ? gamePlayers.map(gp => {
                    const on = selectedPlayer === gp.player_id
                    return (
                      <button key={gp.player_id} onClick={() => setSelectedPlayer(gp.player_id)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        minWidth: 50,
                        backgroundColor: on ? '#1C5C2A' : '#f3f4f6',
                        color: on ? '#fff' : '#374151',
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 900 }}>{gp.players?.number ?? gp.jersey_number ?? '?'}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, marginTop: 2, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {gp.players?.full_name?.split(' ')[0] || '—'}
                        </span>
                      </button>
                    )
                  })
                : rivalJerseys.map(n => {
                    const on = selectedPlayer === n
                    return (
                      <button key={n} onClick={() => setSelectedPlayer(n)} style={{
                        width: 46, height: 46, borderRadius: 10, border: 'none', cursor: 'pointer',
                        fontSize: 15, fontWeight: 900,
                        backgroundColor: on ? '#dc2626' : '#f3f4f6',
                        color: on ? '#fff' : '#374151',
                      }}>#{n}</button>
                    )
                  })
              }
              {selectedTeam === 'rival' && rivalJerseys.length === 0 && (
                <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>Sin dorsales registrados para el rival</div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          {[
            { title: '🏀 Tiros', types: TIROS_TYPES },
            { title: '⚡ Acciones', types: ACCIONES_TYPES },
            { title: '⛔ Faltas', types: FALTAS_TYPES },
          ].map(group => (
            <div key={group.title} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 7 }}>{group.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                {group.types.map(et => {
                  const meta = EVENT_TYPES[et]
                  return (
                    <button key={et} onClick={() => handleAction(et)} disabled={saving} style={{
                      padding: '9px 6px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: 11, fontWeight: 700, lineHeight: 1.3, textAlign: 'center',
                      backgroundColor: meta.bg, color: meta.color,
                      border: `1.5px solid ${meta.color}22`,
                      opacity: saving ? 0.6 : 1, transition: 'opacity 0.12s'
                    }}>{meta.label}</button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Botones gestión */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleDeleteLastEvent} style={{
              flex: 1, padding: '10px', backgroundColor: '#fef2f2', color: '#ef4444',
              border: '1px solid #fca5a5', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}>↩ Deshacer último</button>
            <button onClick={handleFinishGame} disabled={finishing} style={{
              flex: 2, padding: '10px', background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
              cursor: finishing ? 'not-allowed' : 'pointer', opacity: finishing ? 0.7 : 1
            }}>{finishing ? 'Finalizando...' : '🏁 Finalizar partido'}</button>
          </div>
        </div>
      )}

      {/* Partido finalizado — banner */}
      {isFinished && tab === 'live' && (
        <div className="no-print" style={{
          textAlign: 'center', padding: '24px', backgroundColor: '#f0fdf4',
          borderRadius: 16, border: '1px solid #bbf7d0', marginBottom: 16
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>Partido finalizado</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Resultado final: {ourScore} – {rivalScore}
          </div>
          <button onClick={handlePrint} style={{
            marginTop: 14, padding: '10px 22px', background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>📄 Exportar PDF</button>
        </div>
      )}

      {/* ─── TAB: BOX SCORE ──────────────────────────────────────────────── */}
      {tab === 'boxscore' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>Box Score</h3>
            <button onClick={handlePrint} className="no-print" style={{
              padding: '7px 14px', backgroundColor: '#f3f4f6', border: 'none',
              borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer'
            }}>📄 PDF</button>
          </div>

          {/* Nosotros */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a', display: 'inline-block' }} />
              Nuestro equipo — {ourScore} pts
            </div>
            <BoxScoreTable rows={ourStats} isOur={true} />
          </div>

          {/* Rival */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626', display: 'inline-block' }} />
              Rival ({game.rival_name}) — {rivalScore} pts
            </div>
            <BoxScoreTable rows={rivalStats} isOur={false} />
          </div>

          {/* Historial eventos */}
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: '#374151', marginBottom: 10 }}>
              Historial de acciones ({events.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
              {events.slice().reverse().map(ev => {
                const meta = EVENT_TYPES[ev.event_type] || {}
                const isOur = ev.team === 'us'
                const playerName = isOur
                  ? gamePlayers.find(gp => gp.player_id === ev.player_id)?.players?.full_name || '—'
                  : `#${ev.rival_jersey}`
                return (
                  <div key={ev.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 12px', borderRadius: 9, backgroundColor: '#fff',
                    border: `1px solid ${isOur ? '#f0fdf4' : '#fef2f2'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        backgroundColor: isOur ? '#dcfce7' : '#fee2e2',
                        color: isOur ? '#15803d' : '#dc2626'
                      }}>{ev.quarter}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{meta.label || ev.event_type}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{playerName}</span>
                    </div>
                    {meta.points > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: isOur ? '#16a34a' : '#dc2626' }}>
                        +{meta.points}
                      </span>
                    )}
                  </div>
                )
              })}
              {events.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: 13 }}>Sin acciones registradas</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: MAPA DE TIRO ───────────────────────────────────────────── */}
      {tab === 'shotmap' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 14 }}>Mapa de tiro</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>🟢 Nosotros</div>
              <ShotStats shots={ourShots} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>🔴 Rival</div>
              <ShotStats shots={rivalShots} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Mapa — Nuestro equipo</div>
            <CourtSVG shots={ourShots} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Mapa — Rival</div>
            <CourtSVG shots={rivalShots} />
          </div>
          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(22,163,74,0.8)', border: '1.5px solid #15803d' }} />
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Anotado</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.8)', border: '1.5px solid #dc2626' }} />
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Fallado</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL MAPA DE TIRO ───────────────────────────────────────────── */}
      {shotModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={e => e.target === e.currentTarget && setShotModal(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                📍 ¿Dónde fue el tiro?
              </div>
              <button onClick={() => setShotModal(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1
              }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
              Toca en la cancha para marcar la posición del tiro
            </p>
            <CourtSVG onShot={handleShotConfirm} />
            <button onClick={() => setShotModal(null)} style={{
              marginTop: 14, width: '100%', padding: '10px', backgroundColor: '#f3f4f6',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#6b7280', cursor: 'pointer'
            }}>Registrar sin posición</button>
          </div>
        </div>
      )}

      {/* ─── SECCIÓN IMPRIMIBLE ───────────────────────────────────────────── */}
      <div className="print-only" style={{ fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center', fontSize: 18, marginBottom: 4 }}>
          {game.rival_name ? `vs ${game.rival_name}` : 'Partido'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginBottom: 16 }}>
          {game.date} · {ourScore} – {rivalScore}
        </p>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Nuestro equipo</h2>
        <BoxScoreTablePrint rows={ourStats} isOur={true} />
        <h2 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Rival</h2>
        <BoxScoreTablePrint rows={rivalStats} isOur={false} />
      </div>
    </>
  )
}

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function ShotStats({ shots }) {
  const made = shots.filter(s => s.made).length
  const total = shots.length
  const pct = total > 0 ? Math.round(made / total * 100) : null
  return (
    <div style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#111827' }}>
        {pct !== null ? `${pct}% (${made}/${total})` : '—'}
      </div>
      <div style={{ color: '#9ca3af', marginTop: 2 }}>Tiros de campo</div>
    </div>
  )
}

function BoxScoreTable({ rows, isOur }) {
  const cols = [
    { key: 'name',   label: isOur ? 'Jugador' : '#', w: isOur ? 90 : 40 },
    { key: 'pts',    label: 'PTS', w: 36 },
    { key: 'fg',     label: 'TC',  w: 46 },
    { key: 'fg3',    label: '3P',  w: 46 },
    { key: 'ft',     label: 'TL',  w: 46 },
    { key: 'reb',    label: 'REB', w: 36 },
    { key: 'ast',    label: 'AST', w: 36 },
    { key: 'stl',    label: 'ROB', w: 36 },
    { key: 'blk',    label: 'TAP', w: 36 },
    { key: 'tov',    label: 'PÉR', w: 36 },
    { key: 'fouls',  label: 'FAL', w: 36 },
  ]
  const thStyle = { fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }
  const tdStyle = { fontSize: 12, padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f9fafb' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #f3f4f6' }}>
        <thead>
          <tr>{cols.map(c => <th key={c.key} style={{ ...thStyle, minWidth: c.w }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = isOur ? (r.player?.players?.full_name || r.player?.player_id || '—') : `#${r.jersey}`
            return (
              <tr key={i}>
                <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: 10, fontWeight: 600, fontSize: 11, color: '#374151' }}>{name}</td>
                <td style={{ ...tdStyle, fontWeight: 800, color: r.pts > 0 ? '#111827' : '#d1d5db' }}>{r.pts}</td>
                <td style={{ ...tdStyle, color: '#374151' }}>{r.fg2m}/{r.fg2a}</td>
                <td style={{ ...tdStyle, color: '#374151' }}>{r.fg3m}/{r.fg3a}</td>
                <td style={{ ...tdStyle, color: '#374151' }}>{r.ftm}/{r.fta}</td>
                <td style={tdStyle}>{r.reb}</td>
                <td style={tdStyle}>{r.ast}</td>
                <td style={tdStyle}>{r.stl}</td>
                <td style={tdStyle}>{r.blk}</td>
                <td style={tdStyle}>{r.tov}</td>
                <td style={{ ...tdStyle, color: r.fouls >= 5 ? '#ef4444' : '#374151', fontWeight: r.fouls >= 5 ? 800 : 400 }}>{r.fouls}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ ...tdStyle, color: '#d1d5db', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Sin datos</td></tr>
          )}
          {/* Totales */}
          {rows.length > 0 && (() => {
            const tot = rows.reduce((acc, r) => ({
              pts: acc.pts + r.pts, fg2m: acc.fg2m + r.fg2m, fg2a: acc.fg2a + r.fg2a,
              fg3m: acc.fg3m + r.fg3m, fg3a: acc.fg3a + r.fg3a, ftm: acc.ftm + r.ftm, fta: acc.fta + r.fta,
              reb: acc.reb + r.reb, ast: acc.ast + r.ast, stl: acc.stl + r.stl,
              blk: acc.blk + r.blk, tov: acc.tov + r.tov, fouls: acc.fouls + r.fouls
            }), { pts:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0,reb:0,ast:0,stl:0,blk:0,tov:0,fouls:0 })
            return (
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: 10, fontWeight: 800, fontSize: 11, color: '#374151' }}>TOTAL</td>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{tot.pts}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.fg2m}/{tot.fg2a}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.fg3m}/{tot.fg3a}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.ftm}/{tot.fta}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.reb}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.ast}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.stl}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.blk}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.tov}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{tot.fouls}</td>
              </tr>
            )
          })()}
        </tbody>
      </table>
    </div>
  )
}

function BoxScoreTablePrint({ rows, isOur }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ backgroundColor: '#f3f4f6' }}>
          <th style={{ textAlign: 'left', padding: '4px 6px', border: '1px solid #e5e7eb' }}>{isOur ? 'Jugador' : '#'}</th>
          {['PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','FAL'].map(h => (
            <th key={h} style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const name = isOur ? (r.player?.players?.full_name || '—') : `#${r.jersey}`
          return (
            <tr key={i}>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb' }}>{name}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 700 }}>{r.pts}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.fg2m}/{r.fg2a}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.fg3m}/{r.fg3a}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.ftm}/{r.fta}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.reb}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.ast}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.stl}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.blk}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.tov}</td>
              <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.fouls}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
