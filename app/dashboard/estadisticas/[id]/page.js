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

const EV_LABEL = {
  '2pt_made':'2 Pts ✓','2pt_miss':'2 Pts ✗','3pt_made':'3 Pts ✓','3pt_miss':'3 Pts ✗',
  'ft_made':'TL ✓','ft_miss':'TL ✗','rebound_off':'Reb. of.','rebound_def':'Reb. def.',
  'assist':'Asistencia','steal':'Robo','block':'Tapón','turnover':'Pérdida',
  'foul_personal':'Falta','foul_technical':'Técnica','foul_unsporting':'Antidep.',
  'foul_disqualifying':'Descalif.','timeout':'T. Muerto','substitution':'Cambio',
}

// ─── Media cancha SVG ───────────────────────────────────────────────────────
function CourtSVG({ onShot, shots = [] }) {
  const W = 300, H = 270
  // Proporciones reales FIBA: 15m × 14m → escalado
  const x = v => 12 + v * (W - 24)
  const y = v => 10 + v * (H - 20)
  // basket al 94% del alto (línea de fondo)
  const bx = x(0.5), by = y(0.94)
  // zona pintada: 4.9m ancho = 32.7% | 5.8m alto = 41.4%
  const pw = (W-24)*0.327, ph = (H-20)*0.414
  // línea TL a 5.8m del fondo
  const ftY = y(0.94 - 0.414)
  // radio arco triple FIBA: 6.75m = 45% de 15m
  const r3 = (W-24)*0.45
  // esquina triple: 0.9m desde banda = 6%
  const cx3 = x(0.06)
  // inicio arco triple en y (donde la línea recta se convierte en arco)
  const arcY = by - Math.sqrt(Math.max(0, r3*r3 - (bx-cx3)**2))

  function handleClick(e) {
    if (!onShot) return
    const r = e.currentTarget.getBoundingClientRect()
    onShot((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height)
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', borderRadius:10, cursor: onShot?'crosshair':'default', touchAction:'none', maxWidth:W }} onClick={handleClick}>
      {/* Fondo cancha */}
      <rect width={W} height={H} fill="#c8a455" rx={10}/>
      {/* Contorno media cancha */}
      <rect x={12} y={10} width={W-24} height={H-20} fill="none" stroke="#fff" strokeWidth={2}/>
      {/* Línea de medio campo (arriba) */}
      <line x1={12} y1={10} x2={W-12} y2={10} stroke="#fff" strokeWidth={2}/>
      {/* Zona pintada */}
      <rect x={bx-pw/2} y={ftY} width={pw} height={ph} fill="rgba(255,255,255,0.07)" stroke="#fff" strokeWidth={1.5}/>
      {/* Línea de tiros libres */}
      <line x1={bx-pw/2} y1={ftY} x2={bx+pw/2} y2={ftY} stroke="#fff" strokeWidth={2}/>
      {/* Semicírculo TL (hacia arriba - campo abierto) */}
      <path d={`M ${bx-pw/2} ${ftY} A ${pw/2} ${pw/2} 0 0 0 ${bx+pw/2} ${ftY}`} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="5 3"/>
      {/* Semicírculo TL (hacia abajo - zona cerrada) */}
      <path d={`M ${bx-pw/2} ${ftY} A ${pw/2} ${pw/2} 0 0 1 ${bx+pw/2} ${ftY}`} fill="none" stroke="#fff" strokeWidth={1.5}/>
      {/* Zona restringida (semicírculo bajo aro) */}
      <path d={`M ${bx-22} ${by-2} A 22 22 0 0 1 ${bx+22} ${by-2}`} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2"/>
      {/* Arco triple - rectas de esquina */}
      <line x1={cx3} y1={arcY} x2={cx3} y2={by} stroke="#fff" strokeWidth={1.5}/>
      <line x1={W-cx3} y1={arcY} x2={W-cx3} y2={by} stroke="#fff" strokeWidth={1.5}/>
      {/* Arco triple - semicírculo */}
      <path d={`M ${cx3} ${arcY} A ${r3} ${r3} 0 0 1 ${W-cx3} ${arcY}`} fill="none" stroke="#fff" strokeWidth={1.5}/>
      {/* Tablero */}
      <rect x={bx-22} y={by+6} width={44} height={4} fill="none" stroke="#fff" strokeWidth={2}/>
      {/* Poste aro */}
      <line x1={bx} y1={by+4} x2={bx} y2={by+6} stroke="#fff" strokeWidth={1.5}/>
      {/* Aro */}
      <circle cx={bx} cy={by} r={9} fill="none" stroke="#ff6b35" strokeWidth={2.5}/>

      {/* Shots */}
      {shots.map((s, i) => {
        const sx = 12 + s.x*(W-24), sy = 10 + s.y*(H-20)
        return s.made
          ? <circle key={i} cx={sx} cy={sy} r={6} fill="rgba(34,197,94,0.85)" stroke="#16a34a" strokeWidth={1.5}/>
          : <g key={i}>
              <circle cx={sx} cy={sy} r={6} fill="rgba(239,68,68,0.85)" stroke="#dc2626" strokeWidth={1.5}/>
              <line x1={sx-3.5} y1={sy-3.5} x2={sx+3.5} y2={sy+3.5} stroke="#fff" strokeWidth={1.2}/>
              <line x1={sx+3.5} y1={sy-3.5} x2={sx-3.5} y2={sy+3.5} stroke="#fff" strokeWidth={1.2}/>
            </g>
      })}
      {onShot && <text x={W/2} y={H*0.46} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.55)" fontWeight="600">Toca para marcar la posición</text>}
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
  const [onCourt, setOnCourt]   = useState([])      // array de player_id
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('live')

  // Cronómetro
  const [quarter, setQuarter]   = useState('P1')
  const [secs, setSecs]         = useState(600)
  const [running, setRunning]   = useState(false)
  const intervalRef             = useRef(null)

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
    if (g.quarter) setQuarter(g.quarter)

    const { data: rows } = await supabase
      .from('game_players').select('*, players(full_name, number)').eq('game_id', id)
    const ps = rows || []
    setGps(ps)
    setOnCourt(ps.slice(0,5).map(p=>p.player_id))

    const { data: evs } = await supabase
      .from('game_events').select('*').eq('game_id', id).order('created_at',{ascending:true})
    setEvents(evs||[])
    setLoading(false)
  }

  // ── Guardar evento ──────────────────────────────────────────────────────
  async function saveEv(type, team, playerRef, extra={}) {
    const isOur = team === 'us'
    const { data:ev, error } = await supabase.from('game_events').insert({
      game_id: id, team, event_type: type,
      player_id:    isOur ? playerRef : null,
      rival_jersey: isOur ? null : playerRef,
      quarter, minute: null,
      points: ['2pt_made'].includes(type)?2:['3pt_made'].includes(type)?3:type==='ft_made'?1:0,
      shot_x: extra.x ?? null, shot_y: extra.y ?? null,
      linked_event_id: extra.linked ?? null,
    }).select().single()
    if (!error && ev) {
      const next = [...events, ev]
      setEvents(next)
      const sc = computeScores(next)
      supabase.from('games').update({ our_score:sc.us, rival_score:sc.rival, status:'live', quarter }).eq('id',id)
      setGame(prev => prev ? {...prev, our_score:sc.us, rival_score:sc.rival, status:'live'} : prev)
      return ev
    }
    return null
  }

  // ── Tap sobre un jugador ─────────────────────────────────────────────────
  async function tapPlayer(team, ref) {
    if (!armed) return
    const a = armed

    // Asistencia follow-up
    if (a === '_assist') {
      const m = modal
      setModal(null); setArmed(null)
      await saveEv('assist', team, ref, { linked: m?.linked })
      return
    }

    // Rebote follow-up
    if (a === '_rebound') {
      const m = modal
      const isOff = team === m?.shooterTeam
      setModal(null); setArmed(null)
      await saveEv(isOff?'rebound_off':'rebound_def', team, ref, { linked: m?.linked })
      return
    }

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
    // Falta personal
    if (a === 'foul') {
      setArmed(null)
      await saveEv('foul_personal', team, ref)
      return
    }
    // Antideportiva
    if (a === 'unsporting') {
      setArmed(null)
      await saveEv('foul_unsporting', team, ref)
      return
    }
    // Técnica → si es jugador ya tenemos el ref
    if (a === 'technical_player') {
      setArmed(null)
      await saveEv('foul_technical', team, ref)
      return
    }
    // Descalificante → jugador
    if (a === 'disq_player') {
      setArmed(null)
      await saveEv('foul_disqualifying', team, ref)
      return
    }
    // Sustitución
    if (a === 'sub') {
      setModal({ type:'sub', outPlayer: ref })
      setArmed(null)
      return
    }
    // Robo / Tapón / Pérdida
    if (['steal','block','turnover'].includes(a)) {
      setArmed(null)
      await saveEv(a, team, ref)
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
    if (made) setModal({ type:'ask_assist', shooterTeam:m.team, linked:ev.id })
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
    const outPlayer = modal.outPlayer
    setModal(null)
    const newCourt = onCourt.map(p => p===outPlayer ? inPlayer : p)
    setOnCourt(newCourt)
    const inGp  = gps.find(g=>g.player_id===inPlayer)
    const outGp = gps.find(g=>g.player_id===outPlayer)
    await supabase.from('game_events').insert({
      game_id:id, team:'us', event_type:'substitution', quarter, minute:null, points:0,
      player_id: inPlayer, linked_event_id: outPlayer,
      shot_x:null, shot_y:null,
    })
    const subEv = { id: Date.now(), team:'us', event_type:'substitution', quarter,
      player_id:inPlayer, linked_event_id:outPlayer,
      _inNum: inGp?.players?.number??'?', _outNum: outGp?.players?.number??'?'
    }
    setEvents(prev=>[...prev, subEv])
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

  const ourFouls   = events.filter(e=>e.team==='us'&&e.event_type.startsWith('foul')).length
  const rivalFouls = events.filter(e=>e.team==='rival'&&e.event_type.startsWith('foul')).length
  const ourTOs     = events.filter(e=>e.team==='us'&&e.event_type==='timeout').length
  const rivalTOs   = events.filter(e=>e.team==='rival'&&e.event_type==='timeout').length

  const ourShots   = events.filter(e=>e.team==='us'&&e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))
  const rivalShots = events.filter(e=>e.team==='rival'&&e.shot_x!=null).map(e=>({x:e.shot_x,y:e.shot_y,made:e.event_type.endsWith('_made')}))
  const { our:ourBS, riv:rivBS } = computeBoxScore(events, gps, rivals)

  // Colores de jugador según estado armado
  const aColor    = (armed && armed!=='_assist'&&armed!=='_rebound') ? '#16a34a' : '#1a3020'
  const aActive   = !!armed
  const bColor    = (armed && armed!=='_assist'&&armed!=='_rebound') ? '#d97706' : '#2a1f00'
  const bActive   = !!armed

  // Detectar follow-up activo
  const showAssistBanner  = modal?.type==='ask_assist'
  const showReboundBanner = modal?.type==='ask_rebound'

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
            {['P1','P2','P3','P4','PT'].map(q=>(
              <button key={q} onClick={()=>{setQuarter(q);setSecs(600);setRunning(false)}} style={{
                padding:'2px 5px',borderRadius:4,border:'none',cursor:'pointer',
                fontSize:9,fontWeight:800,
                backgroundColor:quarter===q?'#f59e0b':'rgba(255,255,255,0.08)',
                color:quarter===q?'#000':'#6b7280',
              }}>{q}</button>
            ))}
          </div>
          {/* Cronómetro */}
          <div style={{fontSize:28,fontWeight:900,letterSpacing:2,fontFamily:'monospace',
            color:secs<=60?'#f87171':secs<=120?'#fbbf24':'#4ade80'}}>
            {mm}:{ss2}
          </div>
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

          {/* Banner asistencia */}
          {showAssistBanner && (
            <div style={{backgroundColor:'#172554',borderRadius:9,padding:'8px 14px',marginBottom:8}}>
              <div style={{color:'#fbbf24',fontSize:12,fontWeight:800,marginBottom:8}}>🏀 ¿Hubo asistencia?</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setArmed('_assist')}} style={{flex:1,padding:'8px',backgroundColor:'#16a34a',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  ✓ Sí — elige el asistente
                </button>
                <button onClick={()=>setModal(null)} style={{flex:1,padding:'8px',backgroundColor:'#374151',color:'#d1d5db',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  ✗ Sin asistencia
                </button>
              </div>
            </div>
          )}

          {/* Banner rebote */}
          {showReboundBanner && (
            <div style={{backgroundColor:'#172554',borderRadius:9,padding:'8px 14px',marginBottom:8}}>
              <div style={{color:'#fbbf24',fontSize:12,fontWeight:800,marginBottom:6}}>🏀 ¿Quién cogió el rebote? Selecciona el jugador</div>
              <button onClick={()=>{setArmed('_rebound')}} style={{width:'100%',padding:'8px',backgroundColor:'#6d28d9',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                ✦ Seleccionar reboteador
              </button>
              <button onClick={()=>setModal(null)} style={{marginTop:6,width:'100%',padding:'6px',backgroundColor:'#374151',color:'#9ca3af',border:'none',borderRadius:7,fontSize:11,cursor:'pointer'}}>Cancelar</button>
            </div>
          )}

          {/* GRID PRINCIPAL */}
          <div style={{display:'grid',gridTemplateColumns:'60px 60px 1fr',gap:8,alignItems:'start'}}>

            {/* ── Columna A ── */}
            <div>
              <div style={{background:'#16a34a',borderRadius:'8px 8px 0 0',padding:'5px 0',textAlign:'center',fontSize:12,fontWeight:900,color:'#fff',marginBottom:2}}>A</div>
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
              <div style={{background:'#d97706',borderRadius:'8px 8px 0 0',padding:'5px 0',textAlign:'center',fontSize:12,fontWeight:900,color:'#fff',marginBottom:2}}>B</div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {rivals.map(n=>(
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
                        <span style={{fontSize:9,color:'#374151',flexShrink:0}}>{ev.quarter}</span>
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
                      <span style={{fontSize:9,color:'#374151',flexShrink:0}}>{ev.quarter}</span>
                    </div>
                  )
                })}
              </div>

              {/* Botones de acción — grid 2 col */}
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
                <BTN label="+ ACCIONES" color="#4b5563" aKey="extras"/>
              </div>

              {/* Extras si está armado */}
              {armed==='extras' && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                  {[['steal','ROBO','#059669'],['block','TAPÓN','#0284c7'],['turnover','PÉRDIDA','#d97706']].map(([k,l,c])=>(
                    <BTN key={k} label={l} color={c} aKey={k}/>
                  ))}
                </div>
              )}

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
                      {ev.quarter}
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
              setModal(null); setArmed(null)
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              await saveEv(evType, modal.team, null, {})
            }} style={{...btnStyle('#374151',13), textAlign:'center'}}>🧑‍💼 Entrenador</button>
            <button onClick={async()=>{
              setModal(null); setArmed(null)
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              await saveEv(evType, modal.team, null, {})
            }} style={{...btnStyle('#374151',13), textAlign:'center'}}>🪑 Banquillo</button>
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
          <div style={{color:'#fff',fontSize:14,fontWeight:800,marginBottom:4}}>Sustitución</div>
          <div style={{color:'#9ca3af',fontSize:12,marginBottom:14}}>
            Sale #{gps.find(g=>g.player_id===modal.outPlayer)?.players?.number??'?'} — ¿Quién entra?
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {bench.map(gp=>(
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
            {bench.length===0 && <div style={{color:'#6b7280',textAlign:'center',padding:'12px 0',fontSize:13}}>Sin jugadores en banquillo</div>}
          </div>
        </Overlay>
      )}

      {/* Preguntas sin modal de overlay */}

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
