'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── helpers ────────────────────────────────────────────────────────────────
function computeScores(evs) {
  let us = 0, rival = 0
  evs.forEach(e => {
    if (e.event_type === '2pt_made') e.team === 'us' ? (us += 2)   : (rival += 2)
    if (e.event_type === '3pt_made') e.team === 'us' ? (us += 3)   : (rival += 3)
    if (e.event_type === 'ft_made')  e.team === 'us' ? (us += 1)   : (rival += 1)
  })
  return { us, rival }
}

function computeBoxScore(evs, gamePlayers, rivalJerseys) {
  const init = () => ({ pts:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0,
                         reb:0, ast:0, stl:0, blk:0, tov:0, fouls:0 })
  const our = {}; gamePlayers.forEach(p => { our[p.player_id] = init() })
  const riv = {}; rivalJerseys.forEach(n => { riv[n] = init() })
  evs.forEach(ev => {
    const s = ev.team === 'us' ? our[ev.player_id] : riv[ev.rival_jersey]
    if (!s) return
    switch (ev.event_type) {
      case '2pt_made':       s.pts+=2; s.fg2m++; s.fg2a++; break
      case '2pt_miss':       s.fg2a++; break
      case '3pt_made':       s.pts+=3; s.fg3m++; s.fg3a++; break
      case '3pt_miss':       s.fg3a++; break
      case 'ft_made':        s.pts+=1; s.ftm++; s.fta++; break
      case 'ft_miss':        s.fta++; break
      case 'rebound_off': case 'rebound_def': s.reb++; break
      case 'assist':         s.ast++; break
      case 'steal':          s.stl++; break
      case 'block':          s.blk++; break
      case 'turnover':       s.tov++; break
      case 'foul_personal': case 'foul_technical':
      case 'foul_unsporting': case 'foul_disqualifying': s.fouls++; break
    }
  })
  return { our, riv }
}

const Q_LABEL = q => ['P1','P2','P3','P4','PT'][(q||1)-1] || `P${q}`

const EV_LABEL = {
  '2pt_made':'2 Pts ✓','2pt_miss':'2 Pts ✗','3pt_made':'3 Pts ✓','3pt_miss':'3 Pts ✗',
  'ft_made':'TL ✓','ft_miss':'TL ✗','rebound_off':'Reb. of.','rebound_def':'Reb. def.',
  'assist':'Asistencia','steal':'Robo','block':'Tapón','turnover':'Pérdida',
  'foul_personal':'Falta','foul_technical':'Técnica','foul_unsporting':'Antidep.',
  'foul_disqualifying':'Descalif.','timeout':'T. Muerto','substitution':'Cambio',
}

// ─── Media cancha SVG — FIBA exacto ──────────────────────────────────────────
// Baseline ARRIBA · Medidas reales: 15 m ancho × 14 m profundidad
// Escalado: 296 px = 15 m  |  276 px = 14 m
function CourtSVG({ onShot, shots = [] }) {
  const W = 320, H = 300, P = 12          // canvas y padding
  const CW = W - P*2                       // 296 px → 15 m
  const CH = H - P*2                       // 276 px → 14 m
  const sx = CW / 15                       // 19.733 px/m
  const sy = CH / 14                       // 19.714 px/m

  // baseline en y=P (arriba), midcourt en y=P+CH (abajo)
  const fx = m => P + m * sx
  const fy = m => P + m * sy

  // ── medidas FIBA ──────────────────────────────────────────────────────────
  const bx   = fx(7.5)                     // aro X = centro
  const by   = fy(1.575)                   // aro Y (1.575 m de baseline)

  // tablero: cara interior a 1.2 m de baseline, 1.83 m de ancho
  // Lo colocamos visualmente a 0.75 m para que quede sobre el aro
  const bbY  = fy(0.75)                    // tablero Y (visual)
  const bbW  = 1.83 * sx                   // 36 px

  // zona pintada (key): 4.9 m ancho × 5.8 m prof
  const pL   = fx((15 - 4.9) / 2)         // borde izq pintura
  const pW   = 4.9 * sx                    // ancho pintura
  const ftY  = fy(5.8)                     // línea TL
  const ftR  = 1.8 * sx                    // r círculo TL

  // arco triple: r = 6.75 m, rectas a 0.9 m de banda
  const r3   = 6.75 * sx
  const c3x  = fx(0.9)
  const c3xR = fx(14.1)
  // punto donde el arco conecta con las rectas de esquina
  const c3y  = by + Math.sqrt(Math.max(0, r3*r3 - (bx - c3x)**2))

  // zona restringida (no-carga): r = 1.25 m
  const rR   = 1.25 * sx

  // semicírculo central: r = 1.8 m  (mitad visible en media cancha)
  const ccR  = 1.8 * sx
  const ccY  = P + CH                      // línea de medio campo

  function handleClick(e) {
    if (!onShot) return
    const r = e.currentTarget.getBoundingClientRect()
    onShot((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ display:'block', borderRadius:12, cursor:onShot?'crosshair':'default',
               touchAction:'none', userSelect:'none' }}
      onClick={handleClick}>

      {/* ── Parqué ─────────────────────────────────────────────────────── */}
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#c89850"/>
          <stop offset="50%"  stopColor="#b8843a"/>
          <stop offset="100%" stopColor="#c89850"/>
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#wood)" rx={12}/>
      {/* vetas verticales */}
      {Array.from({length:22},(_,i)=>(
        <line key={i} x1={P+(i+0.5)*CW/22} y1={0} x2={P+(i+0.5)*CW/22} y2={H}
          stroke="rgba(0,0,0,0.055)" strokeWidth={0.9}/>
      ))}

      {/* ── Contorno y línea de medio campo ────────────────────────────── */}
      <rect x={P} y={P} width={CW} height={CH} fill="none" stroke="#fff" strokeWidth={2.5}/>
      <line x1={P} y1={ccY} x2={P+CW} y2={ccY} stroke="#fff" strokeWidth={2}/>

      {/* ── Semicírculo central (mitad visible, arco hacia ARRIBA = interior) */}
      {/* sweep=0 → CCW en SVG → de izq a dcha pasando por arriba ✓ */}
      <path d={`M ${fx(7.5)-ccR} ${ccY} A ${ccR} ${ccR} 0 0 0 ${fx(7.5)+ccR} ${ccY}`}
        fill="none" stroke="#fff" strokeWidth={1.5}/>

      {/* ── Zona pintada ────────────────────────────────────────────────── */}
      <rect x={pL} y={P} width={pW} height={ftY-P}
        fill="rgba(130,70,10,0.28)" stroke="#fff" strokeWidth={1.8}/>

      {/* ── Línea de TL ─────────────────────────────────────────────────── */}
      <line x1={pL} y1={ftY} x2={pL+pW} y2={ftY} stroke="#fff" strokeWidth={2}/>

      {/* ── Marcas laterales de la zona (4 pares) ──────────────────────── */}
      {[1.75, 2.75, 3.75, 4.75].map(d => {
        const my = fy(d)
        return (
          <g key={d}>
            <line x1={pL-7}     y1={my} x2={pL}       y2={my} stroke="#fff" strokeWidth={1.3}/>
            <line x1={pL+pW}    y1={my} x2={pL+pW+7}  y2={my} stroke="#fff" strokeWidth={1.3}/>
          </g>
        )
      })}

      {/* ── Círculo TL — sólido hacia aro (sweep=0 = arco superior) ────── */}
      <path d={`M ${bx-ftR} ${ftY} A ${ftR} ${ftR} 0 0 0 ${bx+ftR} ${ftY}`}
        fill="none" stroke="#fff" strokeWidth={1.8}/>
      {/* ── Círculo TL — sólido hacia cancha (sweep=1 = arco inferior) */}
      <path d={`M ${bx-ftR} ${ftY} A ${ftR} ${ftR} 0 0 1 ${bx+ftR} ${ftY}`}
        fill="none" stroke="#fff" strokeWidth={1.8}/>

      {/* ── Zona restringida (semicírculo hacia cancha = sweep=1) ────────── */}
      <path d={`M ${bx-rR} ${by} A ${rR} ${rR} 0 0 1 ${bx+rR} ${by}`}
        fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.3} strokeDasharray="4 3"/>

      {/* ── Línea de 3 puntos: rectas de esquina + arco paramétrico ─────── */}
      {(() => {
        // Ángulo desde el aro hasta cada esquina (en coordenadas de pantalla: y↓)
        // atan2(dy, dx) donde dy = c3y-by ≈ +28 (hacia abajo), dx = c3x-bx ≈ -130 (izq)
        const a1 = Math.atan2(c3y - by, c3x  - bx)  // ≈ 2.93 rad  (esquina izq)
        const a2 = Math.atan2(c3y - by, c3xR - bx)  // ≈ 0.21 rad  (esquina dcha)
        // Interpolando de a1 a a2 DECRECIENDO pasa por π/2 (fondo = hacia cancha) ✓
        // En el punto medio t=π/2 → (bx, by+r3) = fondo del arco ✓
        const N = 72
        const arcPts = Array.from({ length: N + 1 }, (_, i) => {
          const t = a1 + (a2 - a1) * i / N
          return `${(bx + r3 * Math.cos(t)).toFixed(2)},${(by + r3 * Math.sin(t)).toFixed(2)}`
        })
        // Dibujar todo como un único path: recta izq → arco → recta dcha
        const d = [
          `M ${c3x.toFixed(2)},${P}`,          // inicio recta izq (baseline)
          `L ${c3x.toFixed(2)},${c3y.toFixed(2)}`,  // fin recta izq / inicio arco
          ...arcPts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)),
          `L ${c3xR.toFixed(2)},${c3y.toFixed(2)}`, // fin arco / inicio recta dcha
          `L ${c3xR.toFixed(2)},${P}`,              // fin recta dcha (baseline)
        ].join(' ')
        return <path d={d} fill="none" stroke="#fff" strokeWidth={2.2}
                  strokeLinejoin="round" strokeLinecap="round"/>
      })()}

      {/* ── Tablero ──────────────────────────────────────────────────────── */}
      <rect x={bx-bbW/2} y={bbY-2} width={bbW} height={4}
        fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth={2.5}/>

      {/* ── Línea soporte tablero → aro ──────────────────────────────────── */}
      <line x1={bx} y1={bbY+2} x2={bx} y2={by-7} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2}/>

      {/* ── Aro (naranja) ────────────────────────────────────────────────── */}
      <circle cx={bx} cy={by} r={7} fill="none" stroke="#ff5722" strokeWidth={3}/>

      {/* ── Tiros ────────────────────────────────────────────────────────── */}
      {shots.map((s, i) => {
        const px = P + s.x * CW
        const py = P + s.y * CH
        return s.made
          ? <circle key={i} cx={px} cy={py} r={6}
              fill="rgba(34,197,94,0.88)" stroke="#15803d" strokeWidth={1.5}/>
          : <g key={i}>
              <circle cx={px} cy={py} r={6}
                fill="rgba(239,68,68,0.85)" stroke="#b91c1c" strokeWidth={1.5}/>
              <line x1={px-3.5} y1={py-3.5} x2={px+3.5} y2={py+3.5} stroke="#fff" strokeWidth={1.5}/>
              <line x1={px+3.5} y1={py-3.5} x2={px-3.5} y2={py+3.5} stroke="#fff" strokeWidth={1.5}/>
            </g>
      })}

      {onShot && (
        <text x={W/2} y={H*0.6} textAnchor="middle" fontSize={11}
          fill="rgba(255,255,255,0.5)" fontWeight="600">
          Toca para marcar la posición del tiro
        </text>
      )}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function GamePage() {
  const { user, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [game, setGame]         = useState(null)
  const [gps, setGps]           = useState([])      // game_players con jugador
  const [onCourt, setOnCourt]       = useState([])   // array de player_id (nuestros)
  const [rivalOnCourt, setRivalOnCourt] = useState([]) // array de jersey numbers (rival)
  const [events, setEvents]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('live')

  // Cronómetro  (quarter es INTEGER 1-5 en BD)
  const [quarter, setQuarter]   = useState(1)
  const [secs, setSecs]         = useState(600)
  const [running, setRunning]   = useState(false)
  const intervalRef             = useRef(null)

  // Reloj editable
  const [editingClock, setEditingClock] = useState(false)
  const [clockInput, setClockInput]     = useState('')

  function applyClockInput() {
    const parts = clockInput.replace(/[^0-9:]/g,'').split(':')
    if (parts.length === 2) {
      const m = parseInt(parts[0],10), s = parseInt(parts[1],10)
      if (!isNaN(m) && !isNaN(s)) setSecs(Math.max(0, m*60+s))
    } else if (parts.length === 1 && parts[0]) {
      const v = parseInt(parts[0],10)
      if (!isNaN(v)) setSecs(Math.max(0, v))
    }
    setEditingClock(false)
  }

  // Estado acción seleccionada
  const [armed, setArmed]       = useState(null)  // key de acción

  // Modales
  const [modal, setModal]       = useState(null)
  // tipos: 'shot' | 'ft_count' | 'ft_seq' | 'foul_target' | 'sub' | 'rebound' | 'assist' | 'timeout_team'

  useEffect(() => { if (user) load() }, [user])

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => { if (s <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0 } return s-1 })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  async function load() {
    const { data: g } = await supabase.from('games').select('*').eq('id', id).single()
    if (!g) { router.replace('/dashboard/estadisticas'); return }
    setGame(g)
    if (g.quarter) setQuarter(Number(g.quarter) || 1)

    const { data: rows } = await supabase
      .from('game_players').select('*, players(full_name, number)').eq('game_id', id)
    const ps = rows || []
    setGps(ps)
    setOnCourt(ps.slice(0,5).map(p=>p.player_id))
    // Inicializar rival on-court con primeros 5 dorsales
    if (g.rival_roster && g.rival_roster.length > 0) {
      setRivalOnCourt(g.rival_roster.slice(0,5))
    }

    const { data: evs } = await supabase
      .from('game_events').select('*').eq('game_id', id).order('created_at',{ascending:true})
    setEvents(evs||[])
    setLoading(false)
  }

  // ── Guardar evento ──────────────────────────────────────────────────────
  async function saveEv(type, team, playerRef, extra={}) {
    const isOur = team === 'us'
    const pts = type==='2pt_made'?2 : type==='3pt_made'?3 : type==='ft_made'?1 : 0
    const payload = {
      game_id: id,
      team,
      event_type: type,
      player_id:    (isOur && playerRef) ? playerRef : null,
      rival_jersey: (!isOur && playerRef !== null && playerRef !== undefined) ? playerRef : null,
      quarter,
      points: pts,
      shot_x: extra.x ?? null,
      shot_y: extra.y ?? null,
      linked_event_id: extra.linked ?? null,
    }
    const { data:ev, error } = await supabase
      .from('game_events')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('saveEv error:', error)
      alert('Error al guardar: ' + (error.message || JSON.stringify(error)))
      return null
    }
    if (ev) {
      const next = [...events, ev]
      setEvents(next)
      const sc = computeScores(next)
      await supabase.from('games')
        .update({ our_score: sc.us, rival_score: sc.rival, status: 'live', quarter })
        .eq('id', id)
      setGame(prev => prev ? {...prev, our_score:sc.us, rival_score:sc.rival, status:'live'} : prev)
      return ev
    }
    return null
  }

  // ── Tap sobre un jugador ─────────────────────────────────────────────────
  async function tapPlayer(team, ref) {
    if (!armed) return
    const a = armed

    // (los follow-ups de asistencia y rebote ahora van por overlay centrado)

    // Tiros
    if (a === '2pt' || a === '3pt') {
      setModal({ type:'shot', action:a, team, ref })
      return
    }
    // TL
    if (a === 'ft') {
      setModal({ type:'ft_count', team, ref })
      return
    }
    // Falta personal → pregunta quién recibió → TL
    if (a === 'foul') {
      setArmed(null)
      await saveEv('foul_personal', team, ref)
      setModal({ type:'ask_fouled_player', ftTeam: team==='us'?'rival':'us', defaultTL: null, foulType:'foul_personal', foulTeam:team })
      return
    }
    // Antideportiva → FIBA = 2 TL + posesión
    if (a === 'unsporting') {
      setArmed(null)
      await saveEv('foul_unsporting', team, ref)
      setModal({ type:'ask_fouled_player', ftTeam: team==='us'?'rival':'us', defaultTL: 2, foulType:'foul_unsporting', foulTeam:team })
      return
    }
    // Técnica jugador → 1 TL FIBA
    if (a === 'technical_player') {
      setArmed(null)
      await saveEv('foul_technical', team, ref)
      setModal({ type:'ask_fouled_player', ftTeam: team==='us'?'rival':'us', defaultTL: 1, foulType:'foul_technical', foulTeam:team })
      return
    }
    // Descalificante jugador → 2 TL FIBA
    if (a === 'disq_player') {
      setArmed(null)
      await saveEv('foul_disqualifying', team, ref)
      setModal({ type:'ask_fouled_player', ftTeam: team==='us'?'rival':'us', defaultTL: 2, foulType:'foul_disqualifying', foulTeam:team })
      return
    }
    // Sustitución rival (la nuestra se abre directamente desde armAction)
    if (a === 'sub' && team === 'rival') {
      setModal({ type:'sub', outPlayer: ref, team: 'rival' })
      setArmed(null)
      return
    }
    // Robo → preguntar quién perdió el balón (equipo contrario)
    if (a === 'steal') {
      setArmed(null)
      await saveEv('steal', team, ref)
      setModal({ type:'ask_steal_chain', stealerTeam: team, otherTeam: team==='us'?'rival':'us' })
      return
    }
    // Tapón → preguntar tiro fallado + rebote
    if (a === 'block') {
      setArmed(null)
      await saveEv('block', team, ref)
      setModal({ type:'ask_block_chain', blockerTeam: team, otherTeam: team==='us'?'rival':'us' })
      return
    }
    // Pérdida → preguntar quién robó (equipo contrario)
    if (a === 'turnover') {
      setArmed(null)
      await saveEv('turnover', team, ref)
      setModal({ type:'ask_turnover_chain', turnoverTeam: team, otherTeam: team==='us'?'rival':'us' })
      return
    }
  }

  // ── Confirmar tiro desde mapa ───────────────────────────────────────────
  async function confirmShot(made, x, y) {
    const m = modal
    setModal(null); setArmed(null)
    const type = m.action==='2pt' ? (made?'2pt_made':'2pt_miss') : (made?'3pt_made':'3pt_miss')
    const ev = await saveEv(type, m.team, m.ref, { x, y })
    if (!ev) return
    if (made) setModal({ type:'ask_assist',  shooterTeam:m.team, linked:ev.id, scorerRef:m.ref })
    else      setModal({ type:'ask_rebound', shooterTeam:m.team, linked:ev.id })
  }

  async function confirmFtSeq(made) {
    const m = modal
    await saveEv(made?'ft_made':'ft_miss', m.team, m.ref)
    const done = (m.done||0)+1
    if (done < m.total) setModal({...m, done})
    else setModal(null)
  }

  async function confirmSub(inPlayer) {
    const { outPlayer, team: subTeam, currentCourt } = modal
    if (subTeam === 'us') {
      const prevCourt = currentCourt || onCourt
      const newCourt = prevCourt.map(p => p===outPlayer ? inPlayer : p)
      setOnCourt(newCourt)
      await supabase.from('game_events').insert({
        game_id:id, team:'us', event_type:'substitution', quarter,
        points:0, player_id:inPlayer, linked_event_id:outPlayer,
        shot_x:null, shot_y:null,
      })
      setEvents(prev=>[...prev,{id:'sub_'+Date.now(),team:'us',event_type:'substitution',quarter,player_id:inPlayer,linked_event_id:outPlayer}])
      // Mantener modal abierto — volver a selección de salida
      setModal({ type:'sub', team:'us', currentCourt: newCourt })
    } else {
      const newCourt = rivalOnCourt.map(n => n===outPlayer ? inPlayer : n)
      setRivalOnCourt(newCourt)
      await supabase.from('game_events').insert({
        game_id:id, team:'rival', event_type:'substitution', quarter,
        points:0, rival_jersey:inPlayer, linked_event_id:null,
        shot_x:null, shot_y:null,
      })
      setEvents(prev=>[...prev,{id:'sub_r_'+Date.now(),team:'rival',event_type:'substitution',quarter,rival_jersey:inPlayer}])
      setModal(null)
    }
  }

  async function handleUndo() {
    if (!events.length) return
    const last = events[events.length-1]
    if (last.id && typeof last.id === 'string' && last.id.length > 20) {
      await supabase.from('game_events').delete().eq('id', last.id)
    }
    const next = events.slice(0,-1)
    setEvents(next)
    const sc = computeScores(next)
    supabase.from('games').update({ our_score:sc.us, rival_score:sc.rival }).eq('id',id)
    setGame(prev=>prev?{...prev,our_score:sc.us,rival_score:sc.rival}:prev)
    setModal(null); setArmed(null)
  }

  async function handleFinish() {
    if (!window.confirm('¿Finalizar el partido?')) return
    const sc = computeScores(events)
    await supabase.from('games').update({ status:'finished', our_score:sc.us, rival_score:sc.rival }).eq('id',id)
    setGame(prev=>prev?{...prev,status:'finished'}:prev)
    setRunning(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <div style={{padding:20,color:'#9ca3af'}}>Cargando...</div>
  if (!game) return null

  const isFinished = game.status === 'finished'
  const rivals = game.rival_roster || []
  const scores = computeScores(events)
  const mm = String(Math.floor(secs/60)).padStart(2,'0')
  const ss2 = String(secs%60).padStart(2,'0')
  const bench = gps.filter(g=>!onCourt.includes(g.player_id))
  const courtGps = onCourt.map(pid=>gps.find(g=>g.player_id===pid)).filter(Boolean)

  // Si no hay rivalOnCourt inicializado, usar primeros 5 de rivals
  const rivalVisible = rivalOnCourt.length > 0 ? rivalOnCourt : rivals.slice(0,5)

  // Faltas de equipo: solo se cuentan las que tienen jugador asignado
  // (técnicas/descalificantes a entrenador o banquillo no cuentan)
  const ourFouls   = events.filter(e=>e.team==='us'&&e.event_type.startsWith('foul')&&e.player_id!=null).length
  const rivalFouls = events.filter(e=>e.team==='rival'&&e.event_type.startsWith('foul')&&e.rival_jersey!=null).length
  const ourTOs     = events.filter(e=>e.team==='us'&&e.event_type==='timeout').length
  const rivalTOs   = events.filter(e=>e.team==='rival'&&e.event_type==='timeout').length

  const ourShots   = events.filter(e=>e.team==='us'&&e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))
  const rivalShots = events.filter(e=>e.team==='rival'&&e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))
  const { our:ourBS, riv:rivBS } = computeBoxScore(events, gps, rivals)

  // Colores de jugador según estado armado
  const aActive = !!armed
  const bActive = !!armed

  function armAction(key) {
    if (isFinished) return
    // Acciones que abren modal directamente (sin tap de jugador primero)
    if (key === 'technical') {
      setModal({ type:'foul_target', foulType:'technical', team:'us' })
      setArmed(null); return
    }
    if (key === 'disqualifying') {
      setModal({ type:'foul_target', foulType:'disqualifying', team:'us' })
      setArmed(null); return
    }
    if (key === 'timeout') {
      setModal({ type:'timeout_team' })
      setArmed(null); return
    }
    if (key === 'sub') {
      setModal({ type:'sub', team:'us', currentCourt: [...onCourt] })
      setArmed(null); return
    }
    setArmed(prev => prev===key ? null : key)
    if (modal?.type==='ask_assist'||modal?.type==='ask_rebound') setModal(null)
  }

  const BTN = ({ label, color, border, aKey, wide }) => (
    <button onClick={()=>armAction(aKey)} style={{
      padding: wide?'9px 6px':'9px 4px',
      gridColumn: wide?'span 2':undefined,
      borderRadius:8, border:'none', cursor:isFinished?'not-allowed':'pointer',
      backgroundColor: armed===aKey ? color : '#1f2937',
      color: armed===aKey ? '#fff' : '#9ca3af',
      fontSize:10, fontWeight:800, lineHeight:1.2,
      boxShadow: armed===aKey ? `0 0 10px ${color}66`:'none',
      borderLeft: armed===aKey ? `3px solid ${border||color}`:'3px solid transparent',
      transition:'all 0.12s',
    }}>{label}</button>
  )

  return (
    <>
      <style>{`
        @media print { .no-print{display:none!important} .print-only{display:block!important} }
        .print-only{display:none}
        .tap-btn:active{filter:brightness(1.35);transform:scale(0.93)}
      `}</style>

      {/* ── BACK ── */}
      <div className="no-print" style={{marginBottom:8}}>
        <Link href="/dashboard/estadisticas" style={{color:'#6b7280',fontSize:12,fontWeight:600,textDecoration:'none'}}>← Volver</Link>
      </div>

      {/* ══ TOPBAR ════════════════════════════════════════════════════════ */}
      <div style={{backgroundColor:'#111827',borderRadius:14,padding:'10px 12px',marginBottom:10,
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>

        {/* Team A */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#9ca3af',fontWeight:700}}>NOSOTROS</div>
          <div style={{fontSize:11,color:'#4ade80',fontWeight:800}}>F:{ourFouls} TM:{ourTOs}</div>
        </div>

        {/* Score A */}
        <div style={{fontSize:38,fontWeight:900,color:'#4ade80',minWidth:44,textAlign:'center',lineHeight:1,fontFamily:'monospace'}}>
          {scores.us}
        </div>

        {/* Centro: periodo + crono */}
        <div style={{textAlign:'center',flexShrink:0}}>
          {/* Periodos */}
          <div style={{display:'flex',gap:3,justifyContent:'center',marginBottom:4}}>
            {[1,2,3,4,5].map((q,i)=>{
              const lbl=['P1','P2','P3','P4','PT'][i]
              return (
                <button key={q} onClick={()=>{setQuarter(q);setSecs(600);setRunning(false)}} style={{
                  padding:'2px 5px',borderRadius:4,border:'none',cursor:'pointer',
                  fontSize:9,fontWeight:800,
                  backgroundColor:quarter===q?'#f59e0b':'rgba(255,255,255,0.08)',
                  color:quarter===q?'#000':'#6b7280',
                }}>{lbl}</button>
              )
            })}
          </div>
          {/* Cronómetro (toca para editar) */}
          {editingClock ? (
            <input autoFocus value={clockInput}
              onChange={e=>setClockInput(e.target.value)}
              onBlur={applyClockInput}
              onKeyDown={e=>{ if(e.key==='Enter') applyClockInput(); if(e.key==='Escape') setEditingClock(false) }}
              style={{fontSize:24,fontWeight:900,letterSpacing:2,fontFamily:'monospace',
                color:'#fbbf24',background:'transparent',border:'none',borderBottom:'2px solid #fbbf24',
                outline:'none',width:80,textAlign:'center'}}/>
          ) : (
            <div onClick={()=>{ if(!running){ setClockInput(`${mm}:${ss2}`); setEditingClock(true) } }}
              title="Toca para editar (solo en pausa)"
              style={{fontSize:28,fontWeight:900,letterSpacing:2,fontFamily:'monospace',
                color:secs<=60?'#f87171':secs<=120?'#fbbf24':'#4ade80',
                cursor:running?'default':'pointer'}}>
              {mm}:{ss2}
            </div>
          )}
          {/* Botón ▶/⏸ */}
          <button onClick={()=>setRunning(r=>!r)} style={{
            marginTop:3,padding:'3px 14px',borderRadius:6,border:'none',cursor:'pointer',
            backgroundColor:running?'#374151':'#16a34a',
            color:'#fff',fontSize:11,fontWeight:800,
          }}>{running?'⏸ Pausar':'▶ Iniciar'}</button>
        </div>

        {/* Score B */}
        <div style={{fontSize:38,fontWeight:900,color:'#fbbf24',minWidth:44,textAlign:'center',lineHeight:1,fontFamily:'monospace'}}>
          {scores.rival}
        </div>

        {/* Team B */}
        <div style={{flex:1,minWidth:0,textAlign:'right'}}>
          <div style={{fontSize:10,color:'#9ca3af',fontWeight:700}}>{game.rival_name}</div>
          <div style={{fontSize:11,color:'#fbbf24',fontWeight:800}}>F:{rivalFouls} TM:{rivalTOs}</div>
        </div>
      </div>

      {/* ══ TABS ══════════════════════════════════════════════════════════ */}
      <div className="no-print" style={{display:'flex',gap:6,marginBottom:10}}>
        {[{k:'live',l:'🎮 En Vivo'},{k:'boxscore',l:'📊 Box Score'},{k:'shotmap',l:'🎯 Mapa Tiro'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{
            flex:1,padding:'8px 4px',borderRadius:9,border:'none',cursor:'pointer',
            fontSize:11,fontWeight:700,
            backgroundColor:tab===t.k?'#1C5C2A':'#f3f4f6',
            color:tab===t.k?'#fff':'#6b7280',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ══ TAB EN VIVO ═══════════════════════════════════════════════════ */}
      {tab==='live' && (
        <div className="no-print">
          {/* Banner acción armada */}
          {armed && armed!=='_assist' && armed!=='_rebound' && (
            <div style={{backgroundColor:'#172554',borderRadius:9,padding:'7px 14px',marginBottom:8,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:'#93c5fd',fontSize:12,fontWeight:800}}>
                ✦ Selecciona el jugador
              </span>
              <button onClick={()=>setArmed(null)} style={{background:'none',border:'none',color:'#6b7280',fontSize:20,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
          )}


          {/* GRID PRINCIPAL */}
          <div style={{display:'grid',gridTemplateColumns:'60px 60px 1fr',gap:8,alignItems:'start'}}>

            {/* ── Columna A ── */}
            <div>
              <button onClick={()=>{ setModal({ type:'sub', team:'us', currentCourt: [...onCourt] }); setArmed(null) }}
                style={{background:'#16a34a',borderRadius:'8px 8px 0 0',padding:'5px 0',textAlign:'center',fontSize:11,fontWeight:900,color:'#fff',marginBottom:2,width:'100%',border:'none',cursor:'pointer',letterSpacing:0}}>A 🔄</button>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {courtGps.map(gp=>{
                  const num = gp.players?.number ?? gp.jersey_number ?? '?'
                  const name = gp.players?.full_name?.split(' ')[0] ?? ''
                  return (
                    <button key={gp.player_id} className="tap-btn"
                      onClick={()=>tapPlayer('us',gp.player_id)}
                      style={{width:'100%',paddingTop:'100%',borderRadius:10,border:'none',
                        cursor:aActive?'pointer':'default',position:'relative',
                        backgroundColor:aActive?'#16a34a':'#1a3020',
                        boxShadow:aActive?'0 0 0 2px #4ade80':'none',
                        transition:'all 0.1s'}}>
                      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                        alignItems:'center',justifyContent:'center',gap:1}}>
                        <span style={{fontSize:20,fontWeight:900,color:aActive?'#fff':'#2d5c2d',lineHeight:1}}>{num}</span>
                        <span style={{fontSize:8,fontWeight:600,color:aActive?'rgba(255,255,255,0.7)':'#2d5c2d',
                          maxWidth:52,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Columna B ── */}
            <div>
              <button onClick={()=>{ setModal({ type:'rival_lineup' }); setArmed(null) }}
                style={{background:'#d97706',borderRadius:'8px 8px 0 0',padding:'5px 0',textAlign:'center',fontSize:11,fontWeight:900,color:'#fff',marginBottom:2,width:'100%',border:'none',cursor:'pointer',letterSpacing:0}}>B 🔄</button>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {rivalVisible.map(n=>(
                  <button key={n} className="tap-btn"
                    onClick={()=>tapPlayer('rival',n)}
                    style={{width:'100%',paddingTop:'100%',borderRadius:10,border:'none',
                      cursor:bActive?'pointer':'default',position:'relative',
                      backgroundColor:bActive?'#d97706':'#2a1f00',
                      boxShadow:bActive?'0 0 0 2px #fbbf24':'none',
                      transition:'all 0.1s'}}>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:20,fontWeight:900,color:bActive?'#fff':'#6b4a00',lineHeight:1}}>{n}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Log + acciones ── */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>

              {/* Log */}
              <div style={{backgroundColor:'#111827',borderRadius:10,minHeight:180,maxHeight:260,overflowY:'auto',padding:'5px'}}>
                {events.length===0 && <div style={{color:'#374151',fontSize:11,textAlign:'center',padding:'20px 0'}}>Sin acciones</div>}
                {[...events].reverse().slice(0,25).map((ev,i)=>{
                  const isOur = ev.team==='us'
                  const gp = isOur ? gps.find(g=>g.player_id===ev.player_id) : null
                  const pLabel = isOur ? (gp?.players?.number??'?') : (ev.rival_jersey!=null?`#${ev.rival_jersey}`:'—')
                  // Sub especial
                  if (ev.event_type==='substitution') {
                    const inGp  = gps.find(g=>g.player_id===ev.player_id)
                    const outGp = gps.find(g=>g.player_id===ev.linked_event_id)
                    return (
                      <div key={ev.id||i} style={{display:'flex',gap:5,alignItems:'center',padding:'3px 4px',marginBottom:2}}>
                        <span style={{fontSize:10,fontWeight:800,color:'#fff',backgroundColor:'#059669',borderRadius:4,padding:'1px 5px',flexShrink:0}}>A</span>
                        <span style={{fontSize:10,color:'#6b7280',flex:1}}>
                          ↑{inGp?.players?.number??'?'} ↓{outGp?.players?.number??'?'} Cambio
                        </span>
                        <span style={{fontSize:9,color:'#374151',flexShrink:0}}>{Q_LABEL(ev.quarter)}</span>
                      </div>
                    )
                  }
                  const cumEvs = events.slice(0, events.length-i)
                  const sc = computeScores(cumEvs)
                  return (
                    <div key={ev.id||i} style={{display:'flex',gap:5,alignItems:'center',padding:'3px 4px',marginBottom:2,
                      backgroundColor:i===0?'rgba(255,255,255,0.04)':'transparent',borderRadius:4}}>
                      <span style={{fontSize:10,fontWeight:800,color:'#fff',
                        backgroundColor:isOur?'#16a34a':'#d97706',borderRadius:4,padding:'1px 5px',flexShrink:0}}>
                        {isOur?'A':'B'}
                      </span>
                      <span style={{fontSize:10,color:'#6b7280',flexShrink:0,minWidth:26}}>{sc.us}-{sc.rival}</span>
                      <span style={{fontSize:10,color:'#d1d5db',fontWeight:700,flexShrink:0,minWidth:20}}>{pLabel}</span>
                      <span style={{fontSize:10,color:'#9ca3af',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {EV_LABEL[ev.event_type]||ev.event_type}
                      </span>
                      <span style={{fontSize:9,color:'#374151',flexShrink:0}}>{Q_LABEL(ev.quarter)}</span>
                    </div>
                  )
                })}
              </div>

              {/* Botones de acción — 2 columnas principales */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                <BTN label="TIROS LIBRES" color="#374151" aKey="ft" wide/>
                <BTN label="2 PUNTOS"  color="#2563eb" aKey="2pt"/>
                <BTN label="3 PUNTOS"  color="#7c3aed" aKey="3pt"/>
                <BTN label="FALTA"     color="#dc2626" aKey="foul"/>
                <BTN label="TÉCNICA"   color="#991b1b" aKey="technical"/>
                <BTN label="ANTIDEP."  color="#b45309" aKey="unsporting"/>
                <BTN label="DESCALIF." color="#4c0519" aKey="disqualifying"/>
                <BTN label="T. MUERTO" color="#0369a1" aKey="timeout"/>
                <BTN label="SUSTITUC." color="#059669" aKey="sub"/>
              </div>
              {/* Acciones de defensa — siempre visibles */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginTop:3}}>
                <BTN label="ROBO"    color="#059669" aKey="steal"/>
                <BTN label="TAPÓN"   color="#0284c7" aKey="block"/>
                <BTN label="PÉRDIDA" color="#d97706" aKey="turnover"/>
              </div>

              {/* Deshacer + Finalizar */}
              <div style={{display:'flex',gap:6}}>
                <button onClick={handleUndo} style={{flex:1,padding:'8px',backgroundColor:'transparent',
                  border:'1px solid #374151',color:'#ef4444',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  ↩ Deshacer
                </button>
                {!isFinished && (
                  <button onClick={handleFinish} style={{flex:1,padding:'8px',backgroundColor:'#450a0a',
                    border:'none',color:'#fca5a5',borderRadius:8,fontSize:11,fontWeight:800,cursor:'pointer'}}>
                    🏁 Finalizar
                  </button>
                )}
              </div>
            </div>
          </div>

          {isFinished && (
            <div style={{textAlign:'center',marginTop:14,padding:'14px',backgroundColor:'#f0fdf4',borderRadius:12,border:'1px solid #bbf7d0'}}>
              <div style={{fontSize:14,fontWeight:800,color:'#15803d'}}>Partido finalizado · {scores.us}–{scores.rival}</div>
              <button onClick={()=>window.print()} style={{marginTop:10,padding:'8px 20px',
                background:'linear-gradient(135deg,#1C5C2A,#52B043)',color:'#fff',border:'none',
                borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer'}}>📄 Exportar PDF</button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB BOX SCORE ════════════════════════════════════════════════ */}
      {tab==='boxscore' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{fontSize:15,fontWeight:800,color:'#111827',margin:0}}>Box Score</h3>
            <button onClick={()=>window.print()} style={{padding:'6px 14px',backgroundColor:'#f3f4f6',border:'none',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>📄 PDF</button>
          </div>
          <BSSection title={`🟢 Nosotros — ${scores.us} pts`} color="#16a34a"
            rows={gps.map(gp=>({ num:gp.players?.number??'?', name:gp.players?.full_name||'—', s:ourBS[gp.player_id]||{} }))}/>
          <div style={{marginTop:16}}>
            <BSSection title={`🟡 ${game.rival_name} — ${scores.rival} pts`} color="#d97706"
              rows={rivals.map(n=>({ num:n, name:`#${n}`, s:rivBS[n]||{} }))}/>
          </div>
          {/* Historial */}
          <div style={{marginTop:20}}>
            <h4 style={{fontSize:13,fontWeight:800,color:'#374151',marginBottom:8}}>Historial ({events.length})</h4>
            <div style={{maxHeight:300,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {[...events].reverse().map((ev,i)=>{
                const isOur=ev.team==='us'
                const gp=isOur?gps.find(g=>g.player_id===ev.player_id):null
                const pl=isOur?(gp?.players?.full_name||'—'):(ev.rival_jersey!=null?`#${ev.rival_jersey}`:'—')
                return (
                  <div key={ev.id||i} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 10px',
                    borderRadius:8,backgroundColor:'#fff',border:`1px solid ${isOur?'#f0fdf4':'#fef9f0'}`}}>
                    <span style={{fontSize:10,fontWeight:800,color:'#fff',
                      backgroundColor:isOur?'#16a34a':'#d97706',borderRadius:4,padding:'1px 6px',flexShrink:0}}>
                      {Q_LABEL(ev.quarter)}
                    </span>
                    <span style={{fontSize:12,fontWeight:600,color:'#374151',flex:1}}>{EV_LABEL[ev.event_type]||ev.event_type}</span>
                    <span style={{fontSize:11,color:'#9ca3af'}}>{pl}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB MAPA TIRO ════════════════════════════════════════════════ */}
      {tab==='shotmap' && (
        <div>
          <h3 style={{fontSize:15,fontWeight:800,color:'#111827',marginBottom:14}}>Mapa de tiro</h3>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:'#16a34a',marginBottom:6}}>🟢 Nuestro equipo</div>
            <CourtSVG shots={ourShots}/>
            <ShotInfo shots={ourShots}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'#d97706',marginBottom:6}}>🟡 {game.rival_name}</div>
            <CourtSVG shots={rivalShots}/>
            <ShotInfo shots={rivalShots}/>
          </div>
        </div>
      )}

      {/* ══ MODALES ═══════════════════════════════════════════════════════ */}

      {/* Tiro: Anotado/Fallado + mapa */}
      {modal?.type==='shot' && (
        <Overlay onClose={()=>{setModal(null);setArmed(null)}}>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:14,textAlign:'center'}}>
            {modal.action==='2pt'?'Tiro de 2':'Tiro de 3'}
          </div>
          {modal.made===undefined ? (
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setModal({...modal,made:true})} style={btnStyle('#16a34a')}>✓ Anotado</button>
              <button onClick={()=>setModal({...modal,made:false})} style={btnStyle('#dc2626')}>✗ Fallado</button>
            </div>
          ) : (
            <>
              <div style={{color:'#9ca3af',fontSize:12,textAlign:'center',marginBottom:10}}>
                Toca la posición del tiro (o salta)
              </div>
              <CourtSVG onShot={(x,y)=>confirmShot(modal.made,x,y)}/>
              <button onClick={()=>confirmShot(modal.made,0.5,0.5)} style={{marginTop:10,...btnStyle('#374151',12)}}>
                Registrar sin posición
              </button>
            </>
          )}
        </Overlay>
      )}

      {/* TL: cuántos */}
      {modal?.type==='ft_count' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:6,textAlign:'center'}}>Tiros libres</div>
          <div style={{color:'#9ca3af',fontSize:12,textAlign:'center',marginBottom:14}}>¿Cuántos tiros libres?</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
            {[1,2,3].map(n=>(
              <button key={n} onClick={()=>setModal({...modal,type:'ft_seq',total:n,done:0})}
                style={{padding:'20px 0',backgroundColor:'#374151',color:'#fff',border:'none',borderRadius:12,fontSize:26,fontWeight:900,cursor:'pointer'}}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={()=>setModal(null)} style={{width:'100%',...btnStyle('#1f2937',12)}}>SIN TIROS LIBRES</button>
        </Overlay>
      )}

      {/* TL: secuencia */}
      {modal?.type==='ft_seq' && (
        <Overlay>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:4,textAlign:'center'}}>Tiros libres</div>
          <div style={{color:'#9ca3af',fontSize:12,textAlign:'center',marginBottom:16}}>
            Tiro {(modal.done||0)+1} de {modal.total}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>confirmFtSeq(true)}  style={{flex:1,...btnStyle('#16a34a',22)}}>✓</button>
            <button onClick={()=>confirmFtSeq(false)} style={{flex:1,...btnStyle('#dc2626',22)}}>✗</button>
          </div>
        </Overlay>
      )}

      {/* Técnica / Descalificante: target */}
      {modal?.type==='foul_target' && (
        <Overlay onClose={()=>{setModal(null);setArmed(null)}}>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:14,textAlign:'center'}}>
            {modal.foulType==='technical'?'Falta técnica':'Falta descalificante'} — ¿A quién?
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={()=>{
              setModal(null)
              setArmed(modal.foulType==='technical'?'technical_player':'disq_player')
            }} style={{...btnStyle('#374151',13), textAlign:'center'}}>
              👤 Jugador — selecciona en cancha
            </button>
            <button onClick={async()=>{
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              const theTeam = modal.team
              const tl = modal.foulType==='technical'?1:2
              setArmed(null)
              await saveEv(evType, theTeam, null, {})
              setModal({ type:'ask_fouled_player', ftTeam: theTeam==='us'?'rival':'us', defaultTL: tl, foulType: evType, foulTeam: theTeam })
            }} style={{...btnStyle('#374151',13), textAlign:'center'}}>
              🧑‍💼 Entrenador {modal.foulType==='technical'?'(C1 — 1 TL)':'(C2 — 2 TL)'}
            </button>
            <button onClick={async()=>{
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              const theTeam = modal.team
              const tl = modal.foulType==='technical'?1:2
              setArmed(null)
              await saveEv(evType, theTeam, null, {})
              setModal({ type:'ask_fouled_player', ftTeam: theTeam==='us'?'rival':'us', defaultTL: tl, foulType: evType, foulTeam: theTeam })
            }} style={{...btnStyle('#374151',13), textAlign:'center'}}>
              🪑 Banquillo {modal.foulType==='technical'?'(B1 — 1 TL)':'(B2 — 2 TL)'}
            </button>
          </div>
          {/* ¿Qué equipo? */}
          <div style={{marginTop:14}}>
            <div style={{color:'#9ca3af',fontSize:11,textAlign:'center',marginBottom:8}}>¿A qué equipo?</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setModal({...modal,team:'us'})} style={{
                flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',
                backgroundColor:modal.team==='us'?'#16a34a':'#1f2937',color:'#fff',fontSize:12,fontWeight:700
              }}>A Nosotros</button>
              <button onClick={()=>setModal({...modal,team:'rival'})} style={{
                flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',
                backgroundColor:modal.team==='rival'?'#d97706':'#1f2937',color:'#fff',fontSize:12,fontWeight:700
              }}>B Rival</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* T.M. equipo */}
      {modal?.type==='timeout_team' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:14,textAlign:'center'}}>
            ¿Quién pide tiempo muerto?
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={async()=>{setModal(null);setArmed(null);await saveEv('timeout','us',null)}} style={btnStyle('#16a34a')}>🟢 Nosotros</button>
            <button onClick={async()=>{setModal(null);setArmed(null);await saveEv('timeout','rival',null)}} style={btnStyle('#d97706')}>🟡 Rival</button>
          </div>
        </Overlay>
      )}

      {/* Sustitución */}
      {modal?.type==='sub' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:10}}>
            🔄 Sustituciones
          </div>
          {modal.team === 'us' ? (() => {
            const curCourt = modal.currentCourt || onCourt
            const curBench = gps.filter(g => !curCourt.includes(g.player_id))
            if (!modal.outPlayer) {
              // Paso 1: elegir quién sale
              return (
                <>
                  <div style={{color:'#9ca3af',fontSize:12,marginBottom:10}}>¿Quién sale? Toca el jugador en pista</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {curCourt.map(pid => {
                      const gp = gps.find(g=>g.player_id===pid)
                      return (
                        <button key={pid} onClick={()=>setModal({...modal, outPlayer:pid})}
                          style={{padding:'10px 14px',backgroundColor:'#374151',color:'#fff',border:'none',
                            borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',textAlign:'left',
                            display:'flex',alignItems:'center',gap:10}}>
                          <span style={{width:32,height:32,borderRadius:8,backgroundColor:'#dc2626',
                            display:'inline-flex',alignItems:'center',justifyContent:'center',
                            fontSize:14,fontWeight:900,flexShrink:0}}>
                            {gp?.players?.number??'?'}
                          </span>
                          {gp?.players?.full_name||'—'}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={()=>setModal(null)}
                    style={{marginTop:14,width:'100%',padding:'11px',backgroundColor:'#16a34a',
                      color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:800,cursor:'pointer'}}>
                    ✓ Finalizar cambios
                  </button>
                </>
              )
            } else {
              // Paso 2: elegir quién entra
              return (
                <>
                  <div style={{color:'#9ca3af',fontSize:12,marginBottom:10}}>
                    Sale #{gps.find(g=>g.player_id===modal.outPlayer)?.players?.number??'?'} → ¿Quién entra?
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {curBench.map(gp=>(
                      <button key={gp.player_id} onClick={()=>confirmSub(gp.player_id)}
                        style={{padding:'10px 14px',backgroundColor:'#374151',color:'#fff',border:'none',
                          borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',textAlign:'left',
                          display:'flex',alignItems:'center',gap:10}}>
                        <span style={{width:32,height:32,borderRadius:8,backgroundColor:'#16a34a',
                          display:'inline-flex',alignItems:'center',justifyContent:'center',
                          fontSize:14,fontWeight:900,flexShrink:0}}>
                          {gp.players?.number??'?'}
                        </span>
                        {gp.players?.full_name||'—'}
                      </button>
                    ))}
                    {curBench.length===0 && (
                      <div style={{color:'#6b7280',textAlign:'center',padding:'12px 0',fontSize:13}}>Sin jugadores en banquillo</div>
                    )}
                  </div>
                  <button onClick={()=>setModal({...modal, outPlayer:null})}
                    style={{marginTop:10,width:'100%',padding:'9px',backgroundColor:'#374151',
                      color:'#9ca3af',border:'none',borderRadius:9,fontSize:12,cursor:'pointer'}}>
                    ← Volver
                  </button>
                </>
              )
            }
          })() : (
            <>
              <div style={{color:'#9ca3af',fontSize:12,marginBottom:14}}>
                Sale #{modal.outPlayer} — ¿Qué dorsal entra?
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {rivals.filter(n=>!rivalVisible.includes(n)).map(n=>(
                  <button key={n} onClick={()=>confirmSub(n)}
                    style={{width:52,height:52,borderRadius:10,backgroundColor:'#d97706',color:'#fff',
                      border:'none',fontSize:18,fontWeight:900,cursor:'pointer'}}>
                    #{n}
                  </button>
                ))}
                {rivals.filter(n=>!rivalVisible.includes(n)).length===0 &&
                  <div style={{color:'#6b7280',fontSize:13}}>No hay más dorsales registrados</div>}
              </div>
            </>
          )}
        </Overlay>
      )}

      {/* ── OVERLAY: ¿Quién reboteó? ─────────────────────────────────── */}
      {modal?.type==='ask_rebound' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fbbf24',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            🏀 ¿Quién cogió el rebote?
          </div>
          <div style={{color:'#9ca3af',fontSize:11,textAlign:'center',marginBottom:14}}>
            {modal.shooterTeam==='us' ? 'Tiro fallado nuestro' : `Tiro fallado de ${game.rival_name}`}
          </div>
          {/* Nuestro equipo */}
          <div style={{marginBottom:12}}>
            <div style={{color:'#4ade80',fontSize:11,fontWeight:800,marginBottom:6}}>🟢 Nuestro equipo</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {courtGps.map(gp=>(
                <button key={gp.player_id} onClick={async()=>{
                  const isOff = modal.shooterTeam==='rival'
                  setModal(null)
                  await saveEv(isOff?'rebound_off':'rebound_def','us',gp.player_id,{linked:modal.linked})
                }} style={{padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',
                  backgroundColor:'#16a34a',color:'#fff',fontSize:12,fontWeight:800}}>
                  #{gp.players?.number} <span style={{fontWeight:500,fontSize:11}}>{gp.players?.full_name?.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Rival */}
          <div style={{marginBottom:14}}>
            <div style={{color:'#fbbf24',fontSize:11,fontWeight:800,marginBottom:6}}>🟡 {game.rival_name}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {rivalVisible.map(n=>(
                <button key={n} onClick={async()=>{
                  const isOff = modal.shooterTeam==='us'
                  setModal(null)
                  await saveEv(isOff?'rebound_off':'rebound_def','rival',n,{linked:modal.linked})
                }} style={{padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',
                  backgroundColor:'#d97706',color:'#fff',fontSize:13,fontWeight:900}}>
                  #{n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={()=>setModal(null)}
            style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
              border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Sin rebote / Fuera
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: ¿Asistencia? ────────────────────────────────────── */}
      {modal?.type==='ask_assist' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#4ade80',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            👋 ¿Hubo asistencia?
          </div>
          <div style={{color:'#9ca3af',fontSize:11,textAlign:'center',marginBottom:14}}>
            {modal.shooterTeam==='us' ? 'Canasta nuestra' : `Canasta de ${game.rival_name}`}
          </div>
          {/* Jugadores del equipo anotador (sin el propio anotador) */}
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {(modal.shooterTeam==='us'
              ? courtGps.filter(gp=>gp.player_id!==modal.scorerRef)
              : rivalVisible.filter(n=>n!==modal.scorerRef).map(n=>({player_id:n,players:{number:n,full_name:`#${n}`},isRival:true}))
            ).map(gp=>(
              <button key={gp.player_id} onClick={async()=>{
                const ref = gp.isRival ? gp.player_id : gp.player_id
                const team = modal.shooterTeam
                setModal(null)
                await saveEv('assist',team,ref,{linked:modal.linked})
              }} style={{padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',
                backgroundColor: modal.shooterTeam==='us'?'#16a34a':'#d97706',
                color:'#fff',fontSize:12,fontWeight:800}}>
                #{gp.players?.number} <span style={{fontWeight:500,fontSize:11}}>{gp.players?.full_name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <button onClick={()=>setModal(null)}
            style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
              border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Sin asistencia
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: Tiros libres tras falta ─────────────────────────── */}
      {modal?.type==='ask_ft_after_foul' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fff',fontSize:15,fontWeight:900,marginBottom:2,textAlign:'center'}}>
            🎯 ¿Tiros libres?
          </div>
          {/* Nombre FIBA de la sanción */}
          {modal.foulType && modal.foulType !== 'foul_personal' && (
            <div style={{color:'#9ca3af',fontSize:10,textAlign:'center',marginBottom:6}}>
              {modal.foulType==='foul_technical' ? 'Técnica · 1 TL'
                : modal.foulType==='foul_unsporting' ? 'Antideportiva · 2 TL + posesión'
                : modal.foulType==='foul_disqualifying' ? 'Descalificante · 2 TL + posesión'
                : ''}
            </div>
          )}
          <div style={{color: modal.ftTeam==='us'?'#4ade80':'#fbbf24',
            fontSize:12,fontWeight:800,textAlign:'center',marginBottom:12}}>
            Para: {modal.ftTeam==='us'?'🟢 Nosotros':`🟡 ${game.rival_name}`}
            {modal.shooterRef && (
              <span style={{fontWeight:500,color:'#d1d5db'}}>
                {' '}— #{modal.ftTeam==='us'
                  ? (gps.find(g=>g.player_id===modal.shooterRef)?.players?.number ?? modal.shooterRef)
                  : modal.shooterRef}
              </span>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
            <button onClick={()=>setModal(null)}
              style={{padding:'18px 0',borderRadius:10,border:'none',cursor:'pointer',
                backgroundColor:'#374151',color:'#9ca3af',fontSize:13,fontWeight:800}}>
              No
            </button>
            {[1,2,3].map(n=>(
              <button key={n}
                onClick={()=>setModal({type:'ft_seq',total:n,done:0,team:modal.ftTeam,ref:modal.shooterRef||null})}
                style={{padding:'18px 0',borderRadius:10,border:`2px solid ${modal.defaultTL===n?'#fbbf24':'transparent'}`,
                  cursor:'pointer',backgroundColor: modal.defaultTL===n?'#92400e':'#1d4ed8',
                  color:'#fff',fontSize:16,fontWeight:900}}>
                {n}
              </button>
            ))}
          </div>
          {/* Compensación: solo para técnica / antideportiva / descalificante */}
          {modal.foulType && modal.foulType !== 'foul_personal' && (
            <button onClick={async()=>{
              // El otro equipo cometió la misma infracción simultáneamente → se anulan los TL
              await saveEv(modal.foulType, modal.ftTeam, null)
              setModal(null)
            }}
            style={{width:'100%',padding:'11px',marginTop:4,
              backgroundColor:'#1c1917',border:'2px solid #57534e',
              borderRadius:10,color:'#d6d3d1',fontSize:12,fontWeight:800,cursor:'pointer'}}>
              ⚖️ Compensar — ambas faltas se anulan (sin TL)
            </button>
          )}
        </Overlay>
      )}

      {/* ── OVERLAY: ¿Quién recibió la falta? ──────────────────────────── */}
      {modal?.type==='ask_fouled_player' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fff',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            🎯 ¿Quién recibió la falta?
          </div>
          <div style={{color: modal.ftTeam==='us'?'#4ade80':'#fbbf24',
            fontSize:12,fontWeight:800,textAlign:'center',marginBottom:14}}>
            {modal.ftTeam==='us'?'🟢 Nosotros':`🟡 ${game.rival_name}`}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {(modal.ftTeam==='us'
              ? courtGps.map(gp=>({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n=>({ k:n, label:`#${n}`, ref:n }))
            ).map(item=>(
              <button key={item.k}
                onClick={()=>setModal({ type:'ask_ft_after_foul', ftTeam:modal.ftTeam, defaultTL:modal.defaultTL, shooterRef:item.ref, foulType:modal.foulType, foulTeam:modal.foulTeam })}
                style={{padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',
                  backgroundColor: modal.ftTeam==='us'?'#16a34a':'#d97706',
                  color:'#fff',fontSize:12,fontWeight:800}}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setModal({ type:'ask_ft_after_foul', ftTeam:modal.ftTeam, defaultTL:modal.defaultTL, shooterRef:null, foulType:modal.foulType, foulTeam:modal.foulTeam })}
            style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
              border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Sin jugador específico
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: Alineación rival ─────────────────────────────────── */}
      {modal?.type==='rival_lineup' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#fbbf24',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            🔄 5 en pista — {game.rival_name}
          </div>
          <div style={{color:'#9ca3af',fontSize:11,textAlign:'center',marginBottom:14}}>
            Toca para activar/desactivar · máx. 5 en pista
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:12}}>
            {rivals.map(n=>{
              const isOn = rivalOnCourt.includes(n)
              return (
                <button key={n} onClick={()=>{
                  if (isOn) {
                    if (rivalOnCourt.length > 1) setRivalOnCourt(rivalOnCourt.filter(x=>x!==n))
                  } else {
                    if (rivalOnCourt.length < 5) setRivalOnCourt([...rivalOnCourt, n])
                  }
                }}
                style={{width:56,height:56,borderRadius:10,border:`2px solid ${isOn?'#fbbf24':'#374151'}`,
                  cursor:'pointer',
                  backgroundColor: isOn?'#d97706':'#1f2937',
                  color: isOn?'#fff':'#6b7280',
                  fontSize:18,fontWeight:900}}>
                  #{n}
                </button>
              )
            })}
          </div>
          <div style={{color: rivalOnCourt.length===5?'#4ade80':'#fbbf24',
            fontSize:12,fontWeight:800,textAlign:'center',marginBottom:12}}>
            {rivalOnCourt.length}/5 en pista
          </div>
          <button onClick={()=>setModal(null)}
            style={{width:'100%',padding:'12px',backgroundColor:'#16a34a',color:'#fff',
              border:'none',borderRadius:10,fontSize:13,fontWeight:800,cursor:'pointer'}}>
            ✓ Confirmar
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: Tapón — cadena ───────────────────────────────────── */}
      {modal?.type==='ask_block_chain' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#0284c7',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            🛡 Tapón — ¿quién falló el tiro?
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <button onClick={()=>setModal({...modal, shotType:'2pt'})}
              style={{flex:1,padding:'12px',borderRadius:8,
                border:`2px solid ${modal.shotType==='2pt'?'#2563eb':'#374151'}`,
                backgroundColor:modal.shotType==='2pt'?'#1d4ed8':'#1f2937',
                color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
              2 Puntos
            </button>
            <button onClick={()=>setModal({...modal, shotType:'3pt'})}
              style={{flex:1,padding:'12px',borderRadius:8,
                border:`2px solid ${modal.shotType==='3pt'?'#7c3aed':'#374151'}`,
                backgroundColor:modal.shotType==='3pt'?'#6d28d9':'#1f2937',
                color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
              3 Puntos
            </button>
          </div>
          {modal.shotType && (
            <>
              <div style={{color: modal.otherTeam==='us'?'#4ade80':'#fbbf24',
                fontSize:11,fontWeight:800,marginBottom:8}}>
                {modal.otherTeam==='us'?'🟢 Nuestro equipo':`🟡 ${game.rival_name}`}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                {(modal.otherTeam==='us'
                  ? courtGps.map(gp=>({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
                  : rivalVisible.map(n=>({ k:n, label:`#${n}`, ref:n }))
                ).map(item=>(
                  <button key={item.k} onClick={async()=>{
                    const missType = modal.shotType==='2pt'?'2pt_miss':'3pt_miss'
                    const ev = await saveEv(missType, modal.otherTeam, item.ref)
                    setModal({ type:'ask_rebound', shooterTeam:modal.otherTeam, linked:ev?.id||null })
                  }}
                  style={{padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',
                    backgroundColor: modal.otherTeam==='us'?'#16a34a':'#d97706',
                    color:'#fff',fontSize:12,fontWeight:800}}>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={async()=>{
            if (modal.shotType) {
              const missType = modal.shotType==='2pt'?'2pt_miss':'3pt_miss'
              const ev = await saveEv(missType, modal.otherTeam, null)
              setModal({ type:'ask_rebound', shooterTeam:modal.otherTeam, linked:ev?.id||null })
            } else {
              setModal(null)
            }
          }}
          style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
            border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            {modal.shotType ? '→ Pedir rebote sin jugador' : 'Saltar'}
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: Robo — cadena ────────────────────────────────────── */}
      {modal?.type==='ask_steal_chain' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#059669',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            🤿 Robo — ¿quién perdió el balón?
          </div>
          <div style={{color: modal.otherTeam==='us'?'#4ade80':'#fbbf24',
            fontSize:11,fontWeight:800,marginBottom:8}}>
            {modal.otherTeam==='us'?'🟢 Nuestro equipo':`🟡 ${game.rival_name}`}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
            {(modal.otherTeam==='us'
              ? courtGps.map(gp=>({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n=>({ k:n, label:`#${n}`, ref:n }))
            ).map(item=>(
              <button key={item.k} onClick={async()=>{
                setModal(null)
                await saveEv('turnover', modal.otherTeam, item.ref)
              }}
              style={{padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',
                backgroundColor: modal.otherTeam==='us'?'#16a34a':'#d97706',
                color:'#fff',fontSize:12,fontWeight:800}}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setModal(null)}
            style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
              border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Sin jugador específico
          </button>
        </Overlay>
      )}

      {/* ── OVERLAY: Pérdida — cadena ─────────────────────────────────── */}
      {modal?.type==='ask_turnover_chain' && (
        <Overlay onClose={()=>setModal(null)}>
          <div style={{color:'#d97706',fontSize:15,fontWeight:900,marginBottom:4,textAlign:'center'}}>
            💸 Pérdida — ¿quién robó el balón?
          </div>
          <div style={{color: modal.otherTeam==='us'?'#4ade80':'#fbbf24',
            fontSize:11,fontWeight:800,marginBottom:8}}>
            {modal.otherTeam==='us'?'🟢 Nuestro equipo':`🟡 ${game.rival_name}`}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
            {(modal.otherTeam==='us'
              ? courtGps.map(gp=>({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n=>({ k:n, label:`#${n}`, ref:n }))
            ).map(item=>(
              <button key={item.k} onClick={async()=>{
                setModal(null)
                await saveEv('steal', modal.otherTeam, item.ref)
              }}
              style={{padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',
                backgroundColor: modal.otherTeam==='us'?'#16a34a':'#d97706',
                color:'#fff',fontSize:12,fontWeight:800}}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setModal(null)}
            style={{width:'100%',padding:'10px',backgroundColor:'#374151',color:'#9ca3af',
              border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Sin jugador específico
          </button>
        </Overlay>
      )}

      {/* ── Imprimible ── */}
      <div className="print-only">
        <h1 style={{textAlign:'center',fontSize:18,margin:'0 0 4px'}}>vs {game.rival_name}</h1>
        <p style={{textAlign:'center',fontSize:12,color:'#666',margin:'0 0 16px'}}>{game.date} · {scores.us}–{scores.rival}</p>
        <h2 style={{fontSize:14,marginBottom:8}}>Nuestro equipo</h2>
        <PrintBS rows={gps.map(gp=>({num:gp.players?.number??'?',name:gp.players?.full_name||'—',s:ourBS[gp.player_id]||{}}))}/>
        <h2 style={{fontSize:14,marginTop:20,marginBottom:8}}>{game.rival_name}</h2>
        <PrintBS rows={rivals.map(n=>({num:n,name:`#${n}`,s:rivBS[n]||{}}))}/>
      </div>
    </>
  )
}

// Pequeña lógica especial: cuando armed='technical' o 'disqualifying', abrir modal de target
// en vez de esperar tap de jugador → usamos useEffect
// No, mejor lo hacemos inline en el BTN click:

// Override del BTN para técnica y descalificante
// (Los necesitamos inline porque necesitan abrir modal)
// → Los declaramos como funciones en el componente padre pero necesitamos pasar setModal
// Solución: el BTN componente acepta onPress opcionalmente
// Pero como es un comp separado, lo hacemos directamente en el render con botones normales

// ─── HELPERS DE UI ──────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.75)',zIndex:300,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e => { if (e.target===e.currentTarget && onClose) onClose() }}>
      <div style={{backgroundColor:'#1f2937',borderRadius:18,padding:24,width:'100%',maxWidth:360}}>
        {onClose && (
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:-8}}>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#6b7280',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function btnStyle(bg, fs=14) {
  return { width:'100%', padding:'12px', backgroundColor:bg, color:'#fff', border:'none', borderRadius:10, fontSize:fs, fontWeight:800, cursor:'pointer' }
}

function ShotInfo({ shots }) {
  const made=shots.filter(s=>s.made).length, total=shots.length
  const pct=total?Math.round(made/total*100):null
  return (
    <div style={{display:'flex',gap:16,marginTop:6,fontSize:12,color:'#9ca3af'}}>
      <span>Intentos: <b style={{color:'#111827'}}>{total}</b></span>
      <span>Anotados: <b style={{color:'#16a34a'}}>{made}</b></span>
      {pct!==null&&<span>TC%: <b style={{color:'#111827'}}>{pct}%</b></span>}
    </div>
  )
}

function BSSection({ title, color, rows }) {
  const th={fontSize:10,fontWeight:700,color:'#9ca3af',padding:'5px 3px',textAlign:'center',borderBottom:'1px solid #f3f4f6'}
  const td={fontSize:11,padding:'6px 3px',textAlign:'center',borderBottom:'1px solid #f9fafb'}
  const tot=rows.reduce((a,r)=>{
    const s=r.s||{}
    return {pts:a.pts+(s.pts||0),fg2m:a.fg2m+(s.fg2m||0),fg2a:a.fg2a+(s.fg2a||0),
      fg3m:a.fg3m+(s.fg3m||0),fg3a:a.fg3a+(s.fg3a||0),ftm:a.ftm+(s.ftm||0),fta:a.fta+(s.fta||0),
      reb:a.reb+(s.reb||0),ast:a.ast+(s.ast||0),stl:a.stl+(s.stl||0),blk:a.blk+(s.blk||0),tov:a.tov+(s.tov||0),fouls:a.fouls+(s.fouls||0)}
  },{pts:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0,reb:0,ast:0,stl:0,blk:0,tov:0,fouls:0})
  return (
    <div>
      <div style={{fontSize:12,fontWeight:800,color,marginBottom:8}}>{title}</div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',backgroundColor:'#fff',borderRadius:10,overflow:'hidden',border:'1px solid #f3f4f6'}}>
          <thead>
            <tr>
              <th style={{...th,textAlign:'left',paddingLeft:8,minWidth:80}}>Jugador</th>
              {['PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F'].map(c=><th key={c} style={{...th,minWidth:34}}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>{
              const s=r.s||{}
              return (
                <tr key={i}>
                  <td style={{...td,textAlign:'left',paddingLeft:8,fontWeight:600,fontSize:11}}>
                    <span style={{fontSize:10,color:'#9ca3af',marginRight:4}}>#{r.num}</span>{r.name.split(' ')[0]}
                  </td>
                  <td style={{...td,fontWeight:800,color:(s.pts||0)>0?'#111827':'#d1d5db'}}>{s.pts||0}</td>
                  <td style={td}>{s.fg2m||0}/{s.fg2a||0}</td>
                  <td style={td}>{s.fg3m||0}/{s.fg3a||0}</td>
                  <td style={td}>{s.ftm||0}/{s.fta||0}</td>
                  <td style={td}>{s.reb||0}</td>
                  <td style={td}>{s.ast||0}</td>
                  <td style={td}>{s.stl||0}</td>
                  <td style={td}>{s.blk||0}</td>
                  <td style={td}>{s.tov||0}</td>
                  <td style={{...td,color:(s.fouls||0)>=5?'#ef4444':'inherit',fontWeight:(s.fouls||0)>=5?800:400}}>{s.fouls||0}</td>
                </tr>
              )
            })}
            {rows.length>0&&(
              <tr style={{backgroundColor:'#f9fafb'}}>
                <td style={{...td,textAlign:'left',paddingLeft:8,fontWeight:800,fontSize:11}}>TOTAL</td>
                <td style={{...td,fontWeight:800}}>{tot.pts}</td>
                <td style={{...td,fontWeight:700}}>{tot.fg2m}/{tot.fg2a}</td>
                <td style={{...td,fontWeight:700}}>{tot.fg3m}/{tot.fg3a}</td>
                <td style={{...td,fontWeight:700}}>{tot.ftm}/{tot.fta}</td>
                <td style={{...td,fontWeight:700}}>{tot.reb}</td>
                <td style={{...td,fontWeight:700}}>{tot.ast}</td>
                <td style={{...td,fontWeight:700}}>{tot.stl}</td>
                <td style={{...td,fontWeight:700}}>{tot.blk}</td>
                <td style={{...td,fontWeight:700}}>{tot.tov}</td>
                <td style={{...td,fontWeight:700}}>{tot.fouls}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PrintBS({ rows }) {
  return (
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
      <thead>
        <tr style={{backgroundColor:'#f3f4f6'}}>
          {['#','Jugador','PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F'].map(h=>(
            <th key={h} style={{padding:'3px 5px',border:'1px solid #e5e7eb',textAlign:h==='Jugador'?'left':'center'}}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i)=>{
          const s=r.s||{}
          return (
            <tr key={i}>
              <td style={{padding:'3px 5px',border:'1px solid #e5e7eb',textAlign:'center'}}>{r.num}</td>
              <td style={{padding:'3px 5px',border:'1px solid #e5e7eb'}}>{r.name}</td>
              {[s.pts||0,`${s.fg2m||0}/${s.fg2a||0}`,`${s.fg3m||0}/${s.fg3a||0}`,`${s.ftm||0}/${s.fta||0}`,s.reb||0,s.ast||0,s.stl||0,s.blk||0,s.tov||0,s.fouls||0].map((v,j)=>(
                <td key={j} style={{padding:'3px 5px',border:'1px solid #e5e7eb',textAlign:'center'}}>{v}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
