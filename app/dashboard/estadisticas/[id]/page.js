'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const QUARTERS = ['P1','P2','P3','P4','PT']

const ACTIONS = [
  { key: '2pt',       label: '2 PUNTOS',     color: '#2563eb', border: '#1d4ed8' },
  { key: '3pt',       label: '3 PUNTOS',     color: '#7c3aed', border: '#6d28d9' },
  { key: 'ft',        label: 'TIROS LIBRES', color: '#374151', border: '#1f2937' },
  { key: 'foul',      label: 'FALTA',        color: '#dc2626', border: '#b91c1c' },
  { key: 'technical', label: 'TÉCNICA',      color: '#991b1b', border: '#7f1d1d' },
  { key: 'timeout',   label: 'T. MUERTO',    color: '#d97706', border: '#b45309' },
  { key: 'sub',       label: 'SUSTITUCIÓN',  color: '#059669', border: '#047857' },
]

const DETAILED_EVENTS = {
  '2pt_made':       { label: '2 pts ✓',      pts: 2,  team: true },
  '2pt_miss':       { label: '2 pts ✗',      pts: 0,  team: true },
  '3pt_made':       { label: '3 pts ✓',      pts: 3,  team: true },
  '3pt_miss':       { label: '3 pts ✗',      pts: 0,  team: true },
  'ft_made':        { label: 'TL anotado',   pts: 1,  team: true },
  'ft_miss':        { label: 'TL fallado',   pts: 0,  team: true },
  'rebound_off':    { label: 'Reb. of.',     pts: 0,  team: true },
  'rebound_def':    { label: 'Reb. def.',    pts: 0,  team: true },
  'assist':         { label: 'Asistencia',   pts: 0,  team: true },
  'steal':          { label: 'Robo',         pts: 0,  team: true },
  'block':          { label: 'Tapón',        pts: 0,  team: true },
  'turnover':       { label: 'Pérdida',      pts: 0,  team: true },
  'foul_personal':  { label: 'Falta pers.',  pts: 0,  team: true },
  'foul_technical': { label: 'Técnica',      pts: 0,  team: true },
  'timeout':        { label: 'T. muerto',    pts: 0,  team: true },
  'substitution':   { label: 'Cambio',       pts: 0,  team: true },
}

function computeScores(events) {
  let us = 0, rival = 0
  events.forEach(e => {
    if (e.event_type === '2pt_made')  { e.team === 'us' ? us += 2   : rival += 2 }
    if (e.event_type === '3pt_made')  { e.team === 'us' ? us += 3   : rival += 3 }
    if (e.event_type === 'ft_made')   { e.team === 'us' ? us += 1   : rival += 1 }
  })
  return { us, rival }
}

function computeBoxScore(events, gamePlayers, rivalJerseys) {
  const init = () => ({ pts:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0,reb:0,ast:0,stl:0,blk:0,tov:0,fouls:0 })
  const our = {}
  gamePlayers.forEach(p => { our[p.player_id] = { ...init() } })
  const riv = {}
  rivalJerseys.forEach(n => { riv[n] = { ...init() } })

  events.forEach(ev => {
    const s = ev.team === 'us' ? our[ev.player_id] : riv[ev.rival_jersey]
    if (!s) return
    switch(ev.event_type) {
      case '2pt_made':   s.pts+=2; s.fg2m++; s.fg2a++; break
      case '2pt_miss':   s.fg2a++; break
      case '3pt_made':   s.pts+=3; s.fg3m++; s.fg3a++; break
      case '3pt_miss':   s.fg3a++; break
      case 'ft_made':    s.pts+=1; s.ftm++; s.fta++; break
      case 'ft_miss':    s.fta++; break
      case 'rebound_off':case 'rebound_def': s.reb++; break
      case 'assist':     s.ast++; break
      case 'steal':      s.stl++; break
      case 'block':      s.blk++; break
      case 'turnover':   s.tov++; break
      case 'foul_personal':case 'foul_technical': s.fouls++; break
    }
  })
  return { our, riv }
}

// ─── HALF-COURT SVG ───────────────────────────────────────────────────────────
function CourtSVG({ onShot, shots = [] }) {
  const W = 300, H = 280
  // Basketball half-court proportions: 15m wide × 14m deep
  // Paint: 4.9m wide, 5.8m tall. 3pt arc: 6.75m radius. Corner 3: 0.9m from sideline
  const sc = (x, y) => [10 + x*(W-20), 10 + y*(H-20)]
  // Normalized coords: x=0 left sideline, x=1 right sideline, y=0 half-court line, y=1 baseline
  const [bx, by] = sc(0.5, 0.93) // basket center
  const pr = (H-20)*0.41          // paint height in px (5.8/14)
  const pw = (W-20)*0.326         // paint width in px (4.9/15)
  const arc3r = (W-20)*0.45       // 3pt arc radius (6.75/15)
  const corner3 = 10 + (W-20)*0.06 // corner 3 x from sideline (0.9/15)
  const corner3y = 10 + (H-20)*0.645 // corner 3 top (from half-court)
  const ftR = (W-20)*0.12         // free throw circle radius (1.8/15)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, cursor: onShot?'crosshair':'default', display:'block', touchAction:'none', borderRadius:10 }}
      onClick={e => {
        if (!onShot) return
        const r = e.currentTarget.getBoundingClientRect()
        onShot((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height)
      }}>
      {/* Cancha fondo */}
      <rect x={0} y={0} width={W} height={H} fill="#c8a96e" rx={10}/>
      {/* Líneas principales */}
      <rect x={10} y={10} width={W-20} height={H-20} fill="none" stroke="#fff" strokeWidth={2}/>
      {/* Línea de medio campo */}
      <line x1={10} y1={10} x2={W-10} y2={10} stroke="#fff" strokeWidth={1.5}/>
      {/* Zona pintada */}
      <rect x={bx-pw/2} y={10+(H-20)*0.59} width={pw} height={pr} fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth={1.5}/>
      {/* Línea tiros libres */}
      <line x1={bx-pw/2} y1={10+(H-20)*0.59} x2={bx+pw/2} y2={10+(H-20)*0.59} stroke="#fff" strokeWidth={1.5}/>
      {/* Semicírculo TL */}
      <path d={`M ${bx-pw/2} ${10+(H-20)*0.59} A ${ftR} ${ftR} 0 0 1 ${bx+pw/2} ${10+(H-20)*0.59}`} fill="none" stroke="#fff" strokeWidth={1.5}/>
      {/* Semicírculo TL arriba (completo) */}
      <path d={`M ${bx-pw/2} ${10+(H-20)*0.59} A ${ftR} ${ftR} 0 0 0 ${bx+pw/2} ${10+(H-20)*0.59}`} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3"/>
      {/* Aro */}
      <circle cx={bx} cy={by} r={8} fill="none" stroke="#ff6b35" strokeWidth={2.5}/>
      {/* Tablero */}
      <rect x={bx-20} y={by+10} width={40} height={4} fill="none" stroke="#fff" strokeWidth={2}/>
      {/* Línea tablero al aro */}
      <line x1={bx} y1={by+8} x2={bx} y2={by+10} stroke="#fff" strokeWidth={1.5}/>
      {/* Arco triple: esquinas + semicírculo */}
      <line x1={corner3} y1={corner3y} x2={corner3} y2={H-10} stroke="#fff" strokeWidth={1.5}/>
      <line x1={W-corner3} y1={corner3y} x2={W-corner3} y2={H-10} stroke="#fff" strokeWidth={1.5}/>
      <path d={`M ${corner3} ${corner3y} A ${arc3r} ${arc3r} 0 0 1 ${W-corner3} ${corner3y}`} fill="none" stroke="#fff" strokeWidth={1.5}/>
      {/* Restricción zona (semicírculo pequeño bajo aro) */}
      <path d={`M ${bx-20} ${by} A 20 20 0 0 1 ${bx+20} ${by}`} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2"/>
      {/* Círculo central (medio campo) */}
      <circle cx={W/2} cy={10} r={30} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2"/>

      {/* Tiros */}
      {shots.map((s, i) => {
        const [cx, cy] = [10 + s.x*(W-20), 10 + s.y*(H-20)]
        return s.made
          ? <circle key={i} cx={cx} cy={cy} r={6} fill="rgba(34,197,94,0.85)" stroke="#16a34a" strokeWidth={1.5}/>
          : <g key={i}>
              <circle cx={cx} cy={cy} r={6} fill="rgba(239,68,68,0.85)" stroke="#dc2626" strokeWidth={1.5}/>
              <line x1={cx-3.5} y1={cy-3.5} x2={cx+3.5} y2={cy+3.5} stroke="#fff" strokeWidth={1.2}/>
              <line x1={cx+3.5} y1={cy-3.5} x2={cx-3.5} y2={cy+3.5} stroke="#fff" strokeWidth={1.2}/>
            </g>
      })}

      {onShot && <text x={W/2} y={H/2} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.6)" fontWeight="600">Toca para marcar el tiro</text>}
    </svg>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function GamePage() {
  const { user, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [game, setGame]             = useState(null)
  const [gamePlayers, setGamePlayers] = useState([]) // jugadores convocados
  const [onCourt, setOnCourt]       = useState([])   // 5 IDs jugadores en pista
  const [events, setEvents]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('live')

  // Cronómetro
  const [quarter, setQuarter]       = useState('P1')
  const [timerSecs, setTimerSecs]   = useState(600) // 10:00
  const [running, setRunning]       = useState(false)
  const timerRef                    = useRef(null)

  // Acción pendiente
  const [pendingAction, setPendingAction] = useState(null) // key de ACTIONS
  // Follow-up cadenas inteligentes
  const [followUp, setFollowUp]     = useState(null)
  // { type: 'ask_assist'|'ask_rebound'|'ft_sequence', team, shooterRef, eventId, ftTotal, ftDone, ftMade }

  // Modales
  const [shotModal, setShotModal]   = useState(null)   // { team, playerRef, eventType }
  const [subModal, setSubModal]     = useState(null)   // { team: 'us'|'rival' }
  const [ftModal, setFtModal]       = useState(null)   // { team, playerRef, total }
  const [saving, setSaving]         = useState(false)

  useEffect(() => { if (user) loadGame() }, [user])

  // Cronómetro
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (s <= 1) { clearInterval(timerRef.current); setRunning(false); return 0 }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  async function loadGame() {
    const { data: g } = await supabase.from('games').select('*').eq('id', id).single()
    if (!g) { router.replace('/dashboard/estadisticas'); return }
    setGame(g)
    if (g.quarter) setQuarter(g.quarter)

    const { data: gp } = await supabase
      .from('game_players')
      .select('*, players(full_name, number)')
      .eq('game_id', id)
    const ps = gp || []
    setGamePlayers(ps)
    // Primeros 5 como quinteto inicial
    setOnCourt(ps.slice(0, 5).map(p => p.player_id))

    const { data: ev } = await supabase
      .from('game_events')
      .select('*')
      .eq('game_id', id)
      .order('created_at', { ascending: true })
    setEvents(ev || [])
    setLoading(false)
  }

  const scores = computeScores(events)
  const isFinished = game?.status === 'finished'

  const timerStr = `${String(Math.floor(timerSecs/60)).padStart(2,'0')}:${String(timerSecs%60).padStart(2,'0')}`

  // ── Guardar evento ────────────────────────────────────────────────────────
  async function saveEv(eventType, team, playerRef, extra = {}) {
    // playerRef: player_id (us) o jersey number (rival)
    const isOur = team === 'us'
    const payload = {
      game_id: id,
      team,
      event_type: eventType,
      player_id:    isOur ? playerRef : null,
      rival_jersey: isOur ? null : playerRef,
      quarter,
      minute: null,
      points: DETAILED_EVENTS[eventType]?.pts || 0,
      shot_x: extra.shotX ?? null,
      shot_y: extra.shotY ?? null,
      linked_event_id: extra.linkedId ?? null,
    }
    const { data: ev } = await supabase.from('game_events').insert(payload).select().single()
    if (ev) {
      const newEvents = [...events, ev]
      setEvents(newEvents)
      const sc = computeScores(newEvents)
      await supabase.from('games').update({ our_score: sc.us, rival_score: sc.rival, status: 'live', quarter }).eq('id', id)
      setGame(prev => prev ? { ...prev, our_score: sc.us, rival_score: sc.rival, status: 'live' } : prev)
    }
    return ev
  }

  // ── Clic en jugador ───────────────────────────────────────────────────────
  async function handlePlayerTap(team, playerRef) {
    if (saving) return
    if (!pendingAction) return // sin acción seleccionada

    setSaving(true)
    const action = pendingAction
    setPendingAction(null)

    if (action === 'sub') {
      // Abrir modal sustitución para ese equipo
      setSubModal({ team, outPlayer: playerRef })
      setSaving(false)
      return
    }
    if (action === 'timeout') {
      await saveEv('timeout', team, playerRef)
      setSaving(false)
      return
    }
    if (action === 'foul') {
      const ev = await saveEv('foul_personal', team, playerRef)
      // Si foul contra nosotros → preguntar tiros libres
      setSaving(false)
      return
    }
    if (action === 'technical') {
      await saveEv('foul_technical', team, playerRef)
      setSaving(false)
      return
    }
    if (action === 'ft') {
      setFtModal({ team, playerRef })
      setSaving(false)
      return
    }
    if (action === '2pt' || action === '3pt') {
      setShotModal({ team, playerRef, action })
      setSaving(false)
      return
    }
    setSaving(false)
  }

  // ── Shot confirmed from map ───────────────────────────────────────────────
  async function handleShotConfirm(x, y) {
    if (!shotModal) return
    const { team, playerRef, action } = shotModal
    setShotModal(null)
    setSaving(true)
    const made = pendingMadeRef.current
    const evType = action === '2pt' ? (made ? '2pt_made' : '2pt_miss') : (made ? '3pt_made' : '3pt_miss')
    const ev = await saveEv(evType, team, playerRef, { shotX: x, shotY: y })
    if (ev) {
      if (made) {
        setFollowUp({ type: 'ask_assist', team, playerRef, eventId: ev.id })
      } else {
        setFollowUp({ type: 'ask_rebound', team, playerRef, eventId: ev.id })
      }
    }
    setSaving(false)
    pendingMadeRef.current = null
  }

  const pendingMadeRef = useRef(null)

  function openShotMade(made) {
    pendingMadeRef.current = made
    // shotModal already set
  }

  // ── Free throws sequence ───────────────────────────────────────────────────
  async function handleFtResult(made) {
    if (!ftModal) return
    const { team, playerRef, total, done = 0, madeCount = 0 } = ftModal
    const newDone = done + 1
    const newMade = madeCount + (made ? 1 : 0)
    const evType = made ? 'ft_made' : 'ft_miss'
    await saveEv(evType, team, playerRef)
    if (newDone < total) {
      setFtModal({ team, playerRef, total, done: newDone, madeCount: newMade })
    } else {
      setFtModal(null)
    }
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  async function handleAssist(withAssist) {
    if (!followUp) return
    if (withAssist) {
      if (!pendingAction) {
        // need to select player — re-arm assist follow-up
        setPendingAction('_assist_followup')
        return
      }
    }
    setFollowUp(null)
    setPendingAction(null)
  }

  async function handleAssistPlayer(team, playerRef) {
    if (!followUp || pendingAction !== '_assist_followup') return
    await saveEv('assist', team, playerRef, { linkedId: followUp.eventId })
    setFollowUp(null)
    setPendingAction(null)
  }

  async function handleRebound(rebTeam, playerRef) {
    if (!followUp) return
    const isOff = rebTeam === followUp.team
    await saveEv(isOff ? 'rebound_off' : 'rebound_def', rebTeam, playerRef, { linkedId: followUp.eventId })
    setFollowUp(null)
    setPendingAction(null)
  }

  // ── Deshacer último evento ────────────────────────────────────────────────
  async function handleUndo() {
    if (events.length === 0) return
    const last = events[events.length - 1]
    await supabase.from('game_events').delete().eq('id', last.id)
    const newEvents = events.slice(0, -1)
    setEvents(newEvents)
    const sc = computeScores(newEvents)
    await supabase.from('games').update({ our_score: sc.us, rival_score: sc.rival }).eq('id', id)
    setGame(prev => prev ? { ...prev, our_score: sc.us, rival_score: sc.rival } : prev)
    setFollowUp(null)
    setPendingAction(null)
  }

  // ── Sustitución ───────────────────────────────────────────────────────────
  async function handleSub(inPlayer) {
    if (!subModal) return
    const { team, outPlayer } = subModal
    if (team === 'us') {
      const newOnCourt = onCourt.map(p => p === outPlayer ? inPlayer : p)
      setOnCourt(newOnCourt)
      // Guardar evento sustitución (outPlayer sale, inPlayer entra)
      const outGP = gamePlayers.find(gp => gp.player_id === outPlayer)
      const inGP  = gamePlayers.find(gp => gp.player_id === inPlayer)
      const outNum = outGP?.players?.number ?? outGP?.jersey_number ?? '?'
      const inNum  = inGP?.players?.number  ?? inGP?.jersey_number  ?? '?'
      await supabase.from('game_events').insert({
        game_id: id, team: 'us', event_type: 'substitution', quarter,
        player_id: inPlayer,
        points: 0, shot_x: null, shot_y: null,
        linked_event_id: outPlayer, // guardamos quién sale en linked_event_id (reuse)
      })
    }
    setSubModal(null)
  }

  async function handleFinish() {
    if (!window.confirm('¿Finalizar el partido?')) return
    await supabase.from('games').update({ status: 'finished', our_score: scores.us, rival_score: scores.rival }).eq('id', id)
    setGame(prev => prev ? { ...prev, status: 'finished' } : prev)
    setRunning(false)
  }

  if (loading) return <div style={{ padding:20, color:'#9ca3af' }}>Cargando...</div>
  if (!game) return null

  const rivalJerseys = game.rival_roster || []
  const bench = gamePlayers.filter(gp => !onCourt.includes(gp.player_id))
  const onCourtPlayers = onCourt.map(pid => gamePlayers.find(gp => gp.player_id === pid)).filter(Boolean)

  // Fouls por equipo
  const ourFouls   = events.filter(e => e.team === 'us'    && (e.event_type==='foul_personal'||e.event_type==='foul_technical')).length
  const rivalFouls = events.filter(e => e.team === 'rival' && (e.event_type==='foul_personal'||e.event_type==='foul_technical')).length
  const ourTOs     = events.filter(e => e.team === 'us'    && e.event_type==='timeout').length
  const rivalTOs   = events.filter(e => e.team === 'rival' && e.event_type==='timeout').length

  const ourShots   = events.filter(e => e.team==='us'    && e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))
  const rivalShots = events.filter(e => e.team==='rival' && e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))

  const { our: ourBS, riv: rivBS } = computeBoxScore(events, gamePlayers, rivalJerseys)

  // Determinar si hay follow-up activo
  const isAssistFollowup  = followUp?.type === 'ask_assist'
  const isReboundFollowup = followUp?.type === 'ask_rebound'
  const isAssistArmed     = pendingAction === '_assist_followup'

  // Color del jugador en pista según si está pendiente de acción
  function playerBg(team) {
    if (!pendingAction && !isAssistArmed && !isReboundFollowup) return team === 'us' ? '#16a34a' : '#ca8a04'
    return team === 'us' ? '#15803d' : '#a16207'
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none!important }
          .print-only { display:block!important }
        }
        .print-only { display:none }
        .player-btn:active { filter:brightness(1.3); transform:scale(0.95) }
        .action-btn:active { filter:brightness(1.2); transform:scale(0.97) }
      `}</style>

      {/* ─── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor:'#111827', borderRadius:14, padding:'10px 14px',
        marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:8, position:'sticky', top:0, zIndex:10
      }}>
        {/* Equipo A (nosotros) */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700 }}>NOSOTROS</div>
          <div style={{ fontSize:11, color:'#fff', fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {game.rival_name ? 'Urdaneta' : '—'}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            F:{ourFouls} TM:{ourTOs}
          </div>
        </div>
        {/* Score izq */}
        <div style={{ fontSize:36, fontWeight:900, color:'#22c55e', minWidth:42, textAlign:'center', lineHeight:1 }}>
          {scores.us}
        </div>
        {/* Centro: cuarto + cronómetro */}
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ display:'flex', gap:4, justifyContent:'center', marginBottom:4 }}>
            {QUARTERS.map(q => (
              <button key={q} onClick={() => { setQuarter(q); setTimerSecs(600); setRunning(false) }} style={{
                padding:'2px 6px', borderRadius:5, border:'none', cursor:'pointer', fontSize:10, fontWeight:800,
                backgroundColor: quarter===q ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                color: quarter===q ? '#000' : '#9ca3af',
              }}>{q}</button>
            ))}
          </div>
          <div onClick={() => setRunning(r => !r)} style={{
            fontSize:26, fontWeight:900, letterSpacing:2, cursor:'pointer',
            color: timerSecs <= 60 ? '#ef4444' : timerSecs <= 120 ? '#f59e0b' : '#22c55e',
            fontFamily:'monospace'
          }}>{timerStr}</div>
          <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>
            {running ? '⏸ pausar' : '▶ iniciar'}
          </div>
        </div>
        {/* Score dcha */}
        <div style={{ fontSize:36, fontWeight:900, color:'#f87171', minWidth:42, textAlign:'center', lineHeight:1 }}>
          {scores.rival}
        </div>
        {/* Rival */}
        <div style={{ flex:1, minWidth:0, textAlign:'right' }}>
          <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700 }}>RIVAL</div>
          <div style={{ fontSize:11, color:'#fff', fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {game.rival_name}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            F:{rivalFouls} TM:{rivalTOs}
          </div>
        </div>
      </div>

      {/* ─── TABS ─────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ display:'flex', gap:6, marginBottom:10 }}>
        {[{k:'live',l:'🎮 En Vivo'},{k:'boxscore',l:'📊 Box Score'},{k:'shotmap',l:'🎯 Mapa Tiro'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{
            flex:1, padding:'8px 4px', borderRadius:9, border:'none', cursor:'pointer',
            fontSize:11, fontWeight:700,
            backgroundColor: tab===t.k ? '#1C5C2A' : '#f3f4f6',
            color: tab===t.k ? '#fff' : '#6b7280',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ─── TAB EN VIVO ──────────────────────────────────────────────────── */}
      {tab==='live' && (
        <div className="no-print">
          {/* Banner acción seleccionada */}
          {pendingAction && pendingAction !== '_assist_followup' && (
            <div style={{
              backgroundColor:'#1e3a5f', borderRadius:10, padding:'8px 14px',
              marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center'
            }}>
              <span style={{ color:'#93c5fd', fontSize:13, fontWeight:800 }}>
                ✦ {ACTIONS.find(a=>a.key===pendingAction)?.label} — Selecciona el jugador
              </span>
              <button onClick={()=>setPendingAction(null)} style={{
                background:'none', border:'none', color:'#6b7280', fontSize:18, cursor:'pointer', lineHeight:1
              }}>×</button>
            </div>
          )}

          {/* Follow-up: asistencia */}
          {isAssistFollowup && !isAssistArmed && (
            <div style={{ backgroundColor:'#1c2937', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
              <div style={{ color:'#fbbf24', fontSize:12, fontWeight:800, marginBottom:8 }}>
                🏀 ¿Hubo asistencia?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{ setFollowUp(prev=>({...prev})); setPendingAction('_assist_followup') }} style={{
                  flex:1, padding:'8px', backgroundColor:'#16a34a', color:'#fff',
                  border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer'
                }}>✓ Con asistencia — elige jugador</button>
                <button onClick={()=>setFollowUp(null)} style={{
                  flex:1, padding:'8px', backgroundColor:'#374151', color:'#d1d5db',
                  border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer'
                }}>✗ Sin asistencia</button>
              </div>
            </div>
          )}
          {isAssistArmed && (
            <div style={{ backgroundColor:'#1c2937', borderRadius:10, padding:'8px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'#34d399', fontSize:12, fontWeight:800 }}>
                ✦ Asistencia — Selecciona el asistente
              </span>
              <button onClick={()=>{setFollowUp(null);setPendingAction(null)}} style={{
                background:'none', border:'none', color:'#6b7280', fontSize:18, cursor:'pointer'
              }}>×</button>
            </div>
          )}

          {/* Follow-up: rebote */}
          {isReboundFollowup && (
            <div style={{ backgroundColor:'#1c2937', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
              <div style={{ color:'#fbbf24', fontSize:12, fontWeight:800, marginBottom:8 }}>
                🏀 ¿Quién cogió el rebote? Selecciona el jugador
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setFollowUp(null)} style={{
                  padding:'6px 12px', backgroundColor:'#374151', color:'#9ca3af',
                  border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer'
                }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* ÁREA PRINCIPAL: jugadores + acciones */}
          <div style={{ display:'grid', gridTemplateColumns:'72px 72px 1fr', gap:8 }}>
            {/* Columna A — Nosotros (verde) */}
            <div>
              <div style={{ backgroundColor:'#16a34a', borderRadius:'8px 8px 0 0', padding:'5px 4px', textAlign:'center', fontSize:11, fontWeight:800, color:'#fff', marginBottom:2 }}>A</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {onCourtPlayers.map(gp => {
                  const num = gp.players?.number ?? gp.jersey_number ?? '?'
                  const isArmed = pendingAction || isAssistArmed || isReboundFollowup
                  return (
                    <button key={gp.player_id} className="player-btn"
                      onClick={() => {
                        if (isAssistArmed) { handleAssistPlayer('us', gp.player_id); return }
                        if (isReboundFollowup) { handleRebound('us', gp.player_id); return }
                        handlePlayerTap('us', gp.player_id)
                      }}
                      style={{
                        width:'100%', aspectRatio:'1', borderRadius:10, border:'none', cursor: isArmed ? 'pointer' : 'default',
                        backgroundColor: isArmed ? '#16a34a' : '#1a2e1a',
                        color: isArmed ? '#fff' : '#4b7a4b',
                        fontSize:18, fontWeight:900, transition:'all 0.1s',
                        boxShadow: isArmed ? '0 0 0 2px #22c55e' : 'none',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1
                      }}>
                      <span>{num}</span>
                      <span style={{ fontSize:8, fontWeight:600, opacity:0.7, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {gp.players?.full_name?.split(' ')[0] || ''}
                      </span>
                    </button>
                  )
                })}
                {/* Banquillo */}
                {bench.filter(gp => gp.player_id).length > 0 && (
                  <div style={{ marginTop:4 }}>
                    <div style={{ fontSize:9, color:'#4b7a4b', fontWeight:700, textAlign:'center', marginBottom:2 }}>BAN</div>
                    {bench.map(gp => {
                      const num = gp.players?.number ?? gp.jersey_number ?? '?'
                      const isArmed = pendingAction || isAssistArmed || isReboundFollowup
                      return (
                        <button key={gp.player_id} className="player-btn"
                          onClick={() => {
                            if (isAssistArmed) { handleAssistPlayer('us', gp.player_id); return }
                            if (isReboundFollowup) { handleRebound('us', gp.player_id); return }
                            handlePlayerTap('us', gp.player_id)
                          }}
                          style={{
                            width:'100%', aspectRatio:'1', borderRadius:8, border:'1px solid #1f3a1f',
                            cursor: isArmed ? 'pointer' : 'default',
                            backgroundColor:'#111', color:'#4b7a4b',
                            fontSize:14, fontWeight:700, marginBottom:3,
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1
                          }}>
                          <span>{num}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Columna B — Rival (amarillo) */}
            <div>
              <div style={{ backgroundColor:'#ca8a04', borderRadius:'8px 8px 0 0', padding:'5px 4px', textAlign:'center', fontSize:11, fontWeight:800, color:'#fff', marginBottom:2 }}>B</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {rivalJerseys.map(n => {
                  const isArmed = pendingAction || isAssistArmed || isReboundFollowup
                  return (
                    <button key={n} className="player-btn"
                      onClick={() => {
                        if (isAssistArmed) { handleAssistPlayer('rival', n); return }
                        if (isReboundFollowup) { handleRebound('rival', n); return }
                        handlePlayerTap('rival', n)
                      }}
                      style={{
                        width:'100%', aspectRatio:'1', borderRadius:10, border:'none', cursor: isArmed ? 'pointer' : 'default',
                        backgroundColor: isArmed ? '#ca8a04' : '#1e1a0a',
                        color: isArmed ? '#fff' : '#7a6a1a',
                        fontSize:18, fontWeight:900, transition:'all 0.1s',
                        boxShadow: isArmed ? '0 0 0 2px #fbbf24' : 'none',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'
                      }}>
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Log acciones + botones */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {/* Log */}
              <div style={{ backgroundColor:'#111827', borderRadius:10, flex:1, minHeight:200, maxHeight:300, overflowY:'auto', padding:'6px' }}>
                {events.length === 0 && (
                  <div style={{ color:'#374151', fontSize:11, textAlign:'center', padding:'20px 0' }}>Sin acciones</div>
                )}
                {events.slice().reverse().slice(0, 20).map((ev, i) => {
                  const meta = DETAILED_EVENTS[ev.event_type] || { label: ev.event_type, pts: 0 }
                  const isOur = ev.team === 'us'
                  const gp = isOur ? gamePlayers.find(g => g.player_id === ev.player_id) : null
                  const playerLabel = isOur
                    ? (gp?.players?.number ?? '?')
                    : (ev.rival_jersey != null ? `#${ev.rival_jersey}` : '—')
                  const sc = computeScores(events.slice(0, events.length - i))
                  return (
                    <div key={ev.id} style={{
                      display:'flex', gap:5, alignItems:'center',
                      padding:'3px 5px', borderRadius:5, marginBottom:2,
                      backgroundColor: i===0 ? 'rgba(255,255,255,0.05)' : 'transparent'
                    }}>
                      <span style={{
                        fontSize:10, fontWeight:800, color:'#fff',
                        backgroundColor: isOur ? '#16a34a' : '#ca8a04',
                        borderRadius:4, padding:'1px 5px', flexShrink:0
                      }}>{isOur ? 'A' : 'B'}</span>
                      <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0, minWidth:28 }}>
                        {sc.us}-{sc.rival}
                      </span>
                      <span style={{ fontSize:10, color:'#d1d5db', fontWeight:700, flexShrink:0 }}>
                        {playerLabel}
                      </span>
                      <span style={{ fontSize:10, color:'#6b7280', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize:9, color:'#374151', flexShrink:0 }}>{ev.quarter}</span>
                    </div>
                  )
                })}
              </div>

              {/* Botones de acción */}
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {ACTIONS.map(a => (
                  <button key={a.key} className="action-btn"
                    onClick={() => {
                      if (isFinished) return
                      if (a.key === 'sub') { setPendingAction('sub'); return }
                      setPendingAction(pendingAction === a.key ? null : a.key)
                      setFollowUp(null)
                    }}
                    style={{
                      width:'100%', padding:'9px 6px', borderRadius:9, border:'none', cursor: isFinished ? 'not-allowed' : 'pointer',
                      backgroundColor: pendingAction === a.key ? a.color : '#1f2937',
                      color: pendingAction === a.key ? '#fff' : '#9ca3af',
                      fontSize:11, fontWeight:800, transition:'all 0.12s',
                      boxShadow: pendingAction === a.key ? `0 0 12px ${a.color}88` : 'none',
                      borderLeft: pendingAction === a.key ? `3px solid ${a.border}` : '3px solid transparent',
                    }}>
                    {a.label}
                  </button>
                ))}
                {/* Deshacer + Finalizar */}
                <button onClick={handleUndo} style={{
                  width:'100%', padding:'7px', backgroundColor:'transparent', border:'1px solid #374151',
                  color:'#ef4444', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', marginTop:2
                }}>↩ Deshacer</button>
                {!isFinished && (
                  <button onClick={handleFinish} style={{
                    width:'100%', padding:'8px', backgroundColor:'#7f1d1d', border:'none',
                    color:'#fca5a5', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer'
                  }}>🏁 Finalizar</button>
                )}
              </div>
            </div>
          </div>

          {isFinished && (
            <div style={{ textAlign:'center', marginTop:14, padding:'14px', backgroundColor:'#f0fdf4', borderRadius:12, border:'1px solid #bbf7d0' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#15803d' }}>Partido finalizado · {scores.us}–{scores.rival}</div>
              <button onClick={()=>window.print()} style={{ marginTop:10, padding:'8px 20px', background:'linear-gradient(135deg,#1C5C2A,#52B043)', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer' }}>📄 Exportar PDF</button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB BOX SCORE ────────────────────────────────────────────────── */}
      {tab==='boxscore' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:'#111827', margin:0 }}>Box Score</h3>
            <button onClick={()=>window.print()} style={{ padding:'6px 14px', backgroundColor:'#f3f4f6', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer' }}>📄 PDF</button>
          </div>
          <BoxScoreSection title={`🟢 Nosotros — ${scores.us} pts`} titleColor="#16a34a"
            rows={gamePlayers.map(gp => ({ name: gp.players?.full_name || '—', num: gp.players?.number ?? '?', stats: ourBS[gp.player_id] || {} }))} />
          <div style={{ marginTop:16 }}>
            <BoxScoreSection title={`🟡 ${game.rival_name} — ${scores.rival} pts`} titleColor="#d97706"
              rows={rivalJerseys.map(n => ({ name: `#${n}`, num: n, stats: rivBS[n] || {} }))} />
          </div>
        </div>
      )}

      {/* ─── TAB MAPA DE TIRO ─────────────────────────────────────────────── */}
      {tab==='shotmap' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#111827', marginBottom:14 }}>Mapa de tiro</h3>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#16a34a', marginBottom:6 }}>🟢 Nuestro equipo</div>
            <CourtSVG shots={ourShots} />
            <ShotSummary shots={ourShots} />
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#d97706', marginBottom:6 }}>🟡 {game.rival_name}</div>
            <CourtSVG shots={rivalShots} />
            <ShotSummary shots={rivalShots} />
          </div>
        </div>
      )}

      {/* ─── MODAL MAPA DE TIRO ───────────────────────────────────────────── */}
      {shotModal && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setShotModal(null)}>
          <div style={{ backgroundColor:'#1f2937', borderRadius:18, padding:20, width:'100%', maxWidth:380 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ color:'#fff', fontSize:15, fontWeight:800 }}>
                {shotModal.action==='2pt'?'Tiro de 2 puntos':'Tiro de 3 puntos'}
              </span>
              <button onClick={()=>setShotModal(null)} style={{ background:'none', border:'none', color:'#6b7280', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            {/* ¿Anotado o fallado? */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={() => { openShotMade(true); }} style={{
                flex:1, padding:'10px', backgroundColor:'#16a34a', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer'
              }}>✓ Anotado</button>
              <button onClick={() => { openShotMade(false); }} style={{
                flex:1, padding:'10px', backgroundColor:'#dc2626', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer'
              }}>✗ Fallado</button>
            </div>
            {pendingMadeRef.current !== null && (
              <>
                <div style={{ color:'#9ca3af', fontSize:12, marginBottom:10, textAlign:'center' }}>
                  Toca en la cancha para marcar la posición
                </div>
                <CourtSVG onShot={handleShotConfirm} shots={[]} />
                <button onClick={() => handleShotConfirm(0.5, 0.5)} style={{
                  marginTop:10, width:'100%', padding:'9px', backgroundColor:'#374151', color:'#9ca3af',
                  border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer'
                }}>Registrar sin posición exacta</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL TIROS LIBRES ───────────────────────────────────────────── */}
      {ftModal && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ backgroundColor:'#1f2937', borderRadius:18, padding:24, width:'100%', maxWidth:340 }}>
            <div style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6, textAlign:'center' }}>
              Tiros libres
            </div>
            {!ftModal.total ? (
              <>
                <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', marginBottom:16 }}>¿Cuántos tiros libres?</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => setFtModal(prev => ({ ...prev, total:n, done:0, madeCount:0 }))}
                      style={{ padding:'20px 0', backgroundColor:'#374151', color:'#fff', border:'none', borderRadius:12, fontSize:24, fontWeight:900, cursor:'pointer' }}>
                      {n}
                    </button>
                  ))}
                </div>
                <button onClick={() => setFtModal(null)} style={{
                  marginTop:12, width:'100%', padding:'10px', backgroundColor:'#111827', color:'#6b7280',
                  border:'1px solid #374151', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer'
                }}>SIN TIROS LIBRES</button>
              </>
            ) : (
              <>
                <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', marginBottom:16 }}>
                  Tiro {(ftModal.done||0)+1} de {ftModal.total}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => handleFtResult(true)} style={{
                    flex:1, padding:'18px', backgroundColor:'#16a34a', color:'#fff', border:'none', borderRadius:12, fontSize:20, fontWeight:900, cursor:'pointer'
                  }}>✓</button>
                  <button onClick={() => handleFtResult(false)} style={{
                    flex:1, padding:'18px', backgroundColor:'#dc2626', color:'#fff', border:'none', borderRadius:12, fontSize:20, fontWeight:900, cursor:'pointer'
                  }}>✗</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL SUSTITUCIÓN ────────────────────────────────────────────── */}
      {subModal && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setSubModal(null)}>
          <div style={{ backgroundColor:'#1f2937', borderRadius:18, padding:20, width:'100%', maxWidth:360 }}>
            <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:4 }}>
              Sustitución — ¿Quién entra?
            </div>
            <div style={{ color:'#9ca3af', fontSize:12, marginBottom:14 }}>
              Sale el #{gamePlayers.find(gp=>gp.player_id===subModal.outPlayer)?.players?.number ?? '?'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {bench.map(gp => (
                <button key={gp.player_id} onClick={() => handleSub(gp.player_id)} style={{
                  padding:'11px 14px', backgroundColor:'#374151', color:'#fff', border:'none', borderRadius:10,
                  fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'left',
                  display:'flex', alignItems:'center', gap:10
                }}>
                  <span style={{ width:32, height:32, borderRadius:8, backgroundColor:'#16a34a', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, flexShrink:0 }}>
                    {gp.players?.number ?? '?'}
                  </span>
                  {gp.players?.full_name || '—'}
                </button>
              ))}
              {bench.length === 0 && <div style={{ color:'#6b7280', fontSize:13, textAlign:'center', padding:'12px 0' }}>Sin jugadores en banquillo</div>}
            </div>
            <button onClick={() => setSubModal(null)} style={{
              marginTop:12, width:'100%', padding:'9px', backgroundColor:'#111827', color:'#6b7280',
              border:'1px solid #374151', borderRadius:9, fontSize:13, cursor:'pointer', fontWeight:700
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ─── SECCIÓN IMPRIMIBLE ───────────────────────────────────────────── */}
      <div className="print-only">
        <h1 style={{ textAlign:'center', fontSize:18, margin:'0 0 4px' }}>vs {game.rival_name}</h1>
        <p style={{ textAlign:'center', fontSize:12, color:'#666', margin:'0 0 16px' }}>{game.date} · {scores.us}–{scores.rival}</p>
        <h2 style={{ fontSize:14, marginBottom:8 }}>Nuestro equipo</h2>
        <PrintTable rows={gamePlayers.map(gp=>({ name: gp.players?.full_name||'—', num: gp.players?.number??'?', s: ourBS[gp.player_id]||{} }))} />
        <h2 style={{ fontSize:14, marginTop:20, marginBottom:8 }}>{game.rival_name}</h2>
        <PrintTable rows={rivalJerseys.map(n=>({ name:`#${n}`, num:n, s: rivBS[n]||{} }))} />
      </div>
    </>
  )
}

// ─── COMPONENTES ─────────────────────────────────────────────────────────────
function ShotSummary({ shots }) {
  const made = shots.filter(s=>s.made).length
  const pct = shots.length ? Math.round(made/shots.length*100) : null
  return (
    <div style={{ display:'flex', gap:16, marginTop:6, fontSize:12, color:'#9ca3af' }}>
      <span>Intentos: <b style={{ color:'#111827' }}>{shots.length}</b></span>
      <span>Anotados: <b style={{ color:'#16a34a' }}>{made}</b></span>
      {pct!==null && <span>%TC: <b style={{ color:'#111827' }}>{pct}%</b></span>}
    </div>
  )
}

function BoxScoreSection({ title, titleColor, rows }) {
  const th = { fontSize:10, fontWeight:700, color:'#9ca3af', padding:'5px 3px', textAlign:'center', borderBottom:'1px solid #f3f4f6' }
  const td = { fontSize:11, padding:'6px 3px', textAlign:'center', borderBottom:'1px solid #f9fafb' }
  const cols = ['PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F']
  const tot = rows.reduce((a,r) => {
    const s = r.stats
    return { pts:a.pts+(s.pts||0), fg2m:a.fg2m+(s.fg2m||0), fg2a:a.fg2a+(s.fg2a||0),
      fg3m:a.fg3m+(s.fg3m||0), fg3a:a.fg3a+(s.fg3a||0), ftm:a.ftm+(s.ftm||0), fta:a.fta+(s.fta||0),
      reb:a.reb+(s.reb||0), ast:a.ast+(s.ast||0), stl:a.stl+(s.stl||0),
      blk:a.blk+(s.blk||0), tov:a.tov+(s.tov||0), fouls:a.fouls+(s.fouls||0) }
  }, {pts:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0,reb:0,ast:0,stl:0,blk:0,tov:0,fouls:0})
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:800, color:titleColor, marginBottom:8 }}>{title}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', backgroundColor:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #f3f4f6', fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign:'left', paddingLeft:8, minWidth:90 }}>Jugador</th>
              {cols.map(c=><th key={c} style={{ ...th, minWidth:36 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => {
              const s = r.stats
              return (
                <tr key={i}>
                  <td style={{ ...td, textAlign:'left', paddingLeft:8, fontWeight:600 }}>
                    <span style={{ fontSize:10, color:'#9ca3af', marginRight:5 }}>#{r.num}</span>{r.name}
                  </td>
                  <td style={{ ...td, fontWeight:800, color:(s.pts||0)>0?'#111827':'#d1d5db' }}>{s.pts||0}</td>
                  <td style={td}>{s.fg2m||0}/{s.fg2a||0}</td>
                  <td style={td}>{s.fg3m||0}/{s.fg3a||0}</td>
                  <td style={td}>{s.ftm||0}/{s.fta||0}</td>
                  <td style={td}>{s.reb||0}</td>
                  <td style={td}>{s.ast||0}</td>
                  <td style={td}>{s.stl||0}</td>
                  <td style={td}>{s.blk||0}</td>
                  <td style={td}>{s.tov||0}</td>
                  <td style={{ ...td, color:(s.fouls||0)>=5?'#ef4444':'inherit', fontWeight:(s.fouls||0)>=5?800:400 }}>{s.fouls||0}</td>
                </tr>
              )
            })}
            {rows.length>0 && (
              <tr style={{ backgroundColor:'#f9fafb' }}>
                <td style={{ ...td, textAlign:'left', paddingLeft:8, fontWeight:800 }}>TOTAL</td>
                <td style={{ ...td, fontWeight:800 }}>{tot.pts}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.fg2m}/{tot.fg2a}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.fg3m}/{tot.fg3a}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.ftm}/{tot.fta}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.reb}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.ast}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.stl}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.blk}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.tov}</td>
                <td style={{ ...td, fontWeight:700 }}>{tot.fouls}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PrintTable({ rows }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
      <thead>
        <tr style={{ backgroundColor:'#f3f4f6' }}>
          {['#','Jugador','PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F'].map(h=>(
            <th key={h} style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign: h==='Jugador'?'left':'center' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i)=>{
          const s = r.s
          return (
            <tr key={i}>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{r.num}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb' }}>{r.name}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center', fontWeight:700 }}>{s.pts||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.fg2m||0}/{s.fg2a||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.fg3m||0}/{s.fg3a||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.ftm||0}/{s.fta||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.reb||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.ast||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.stl||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.blk||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.tov||0}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{s.fouls||0}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
