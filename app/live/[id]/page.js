'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── LOGIC HELPERS ────────────────────────────────────────────────────────────
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
  const init = () => ({ pts:0, fg2m:0, fg2a:0, fg3m:0, fg3a:0, ftm:0, fta:0, reb:0, ast:0, stl:0, blk:0, tov:0, fouls:0 })
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

// ─── PLAYER FOUL STATUS ───────────────────────────────────────────────────────
function getPlayerFoulCounts(evs, pid) {
  const pe = evs.filter(e => e.team === 'us' && e.player_id === pid)
  return {
    personal:   pe.filter(e => e.event_type === 'foul_personal').length,
    technical:  pe.filter(e => e.event_type === 'foul_technical').length,
    unsporting: pe.filter(e => e.event_type === 'foul_unsporting').length,
    disq:       pe.filter(e => e.event_type === 'foul_disqualifying').length,
  }
}
function calcPlayerStatus(counts) {
  const disqualified = counts.disq >= 1
    || counts.unsporting >= 2
    || counts.technical >= 2
    || (counts.unsporting >= 1 && counts.technical >= 1)
  const eliminated = !disqualified && (counts.personal + counts.unsporting + counts.technical) >= 5
  return { disqualified, eliminated, out: disqualified || eliminated }
}
function playerStatusFromEvents(evs, pid) {
  return calcPlayerStatus(getPlayerFoulCounts(evs, pid))
}

const Q_LABEL = q => ['P1','P2','P3','P4','PT'][(q||1)-1] || `P${q}`

const EV_LABEL = {
  '2pt_made':'2 Pts ✓','2pt_miss':'2 Pts ✗','3pt_made':'3 Pts ✓','3pt_miss':'3 Pts ✗',
  'ft_made':'TL ✓','ft_miss':'TL ✗','rebound_off':'Reb. of.','rebound_def':'Reb. def.',
  'assist':'Asistencia','steal':'Robo','block':'Tapón','turnover':'Pérdida',
  'foul_personal':'Falta','foul_technical':'Técnica','foul_unsporting':'Antidep.',
  'foul_disqualifying':'Descalif.','timeout':'T. Muerto','substitution':'Cambio',
}

const TYPE_LABEL = { liga:'Liga', copa:'Copa', amistoso:'Amistoso', torneo:'Torneo', otro:'Otro' }

const ACTION_LABEL = {
  '2pt':'2 PUNTOS','3pt':'3 PUNTOS','ft':'TIRO LIBRE','foul':'FALTA PERSONAL',
  'unsporting':'ANTIDEPORTIVA','technical_player':'TÉCNICA','disq_player':'DESCALIFICANTE',
  'steal':'ROBO','block':'TAPÓN','turnover':'PÉRDIDA',
}

// ─── COURT SVG ────────────────────────────────────────────────────────────────
function CourtSVG({ onShot, shots = [] }) {
  const W = 320, H = 300, P = 12
  const CW = W - P*2
  const CH = H - P*2
  const sx = CW / 15
  const sy = CH / 14
  const fx = m => P + m * sx
  const fy = m => P + m * sy
  const bx   = fx(7.5)
  const by   = fy(1.575)
  const bbY  = fy(0.75)
  const bbW  = 1.83 * sx
  const pL   = fx((15 - 4.9) / 2)
  const pW   = 4.9 * sx
  const ftY  = fy(5.8)
  const ftR  = 1.8 * sx
  const r3   = 6.75 * sx
  const c3x  = fx(0.9)
  const c3xR = fx(14.1)
  const c3y  = by + Math.sqrt(Math.max(0, r3*r3 - (bx - c3x)**2))
  const rR   = 1.25 * sx
  const ccR  = 1.8 * sx
  const ccY  = P + CH

  function handleClick(e) {
    if (!onShot) return
    const r = e.currentTarget.getBoundingClientRect()
    onShot((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ display:'block', borderRadius:12, cursor:onShot?'crosshair':'default', touchAction:onShot?'none':'pan-y', userSelect:'none' }}
      onClick={handleClick}>
      <defs>
        <linearGradient id="wood2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#c89850"/>
          <stop offset="50%"  stopColor="#b8843a"/>
          <stop offset="100%" stopColor="#c89850"/>
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#wood2)" rx={12}/>
      {Array.from({length:22},(_,i)=>(
        <line key={i} x1={P+(i+0.5)*CW/22} y1={0} x2={P+(i+0.5)*CW/22} y2={H} stroke="rgba(0,0,0,0.055)" strokeWidth={0.9}/>
      ))}
      <rect x={P} y={P} width={CW} height={CH} fill="none" stroke="#fff" strokeWidth={2.5}/>
      <line x1={P} y1={ccY} x2={P+CW} y2={ccY} stroke="#fff" strokeWidth={2}/>
      <path d={`M ${fx(7.5)-ccR} ${ccY} A ${ccR} ${ccR} 0 0 0 ${fx(7.5)+ccR} ${ccY}`} fill="none" stroke="#fff" strokeWidth={1.5}/>
      <rect x={pL} y={P} width={pW} height={ftY-P} fill="rgba(130,70,10,0.28)" stroke="#fff" strokeWidth={1.8}/>
      <line x1={pL} y1={ftY} x2={pL+pW} y2={ftY} stroke="#fff" strokeWidth={2}/>
      {[1.75, 2.75, 3.75, 4.75].map(d => {
        const my = fy(d)
        return (<g key={d}>
          <line x1={pL-7} y1={my} x2={pL} y2={my} stroke="#fff" strokeWidth={1.3}/>
          <line x1={pL+pW} y1={my} x2={pL+pW+7} y2={my} stroke="#fff" strokeWidth={1.3}/>
        </g>)
      })}
      <path d={`M ${bx-ftR} ${ftY} A ${ftR} ${ftR} 0 0 0 ${bx+ftR} ${ftY}`} fill="none" stroke="#fff" strokeWidth={1.8}/>
      <path d={`M ${bx-ftR} ${ftY} A ${ftR} ${ftR} 0 0 1 ${bx+ftR} ${ftY}`} fill="none" stroke="#fff" strokeWidth={1.8}/>
      <path d={`M ${bx-rR} ${by} A ${rR} ${rR} 0 0 1 ${bx+rR} ${by}`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.3} strokeDasharray="4 3"/>
      {(() => {
        const a1 = Math.atan2(c3y - by, c3x  - bx)
        const a2 = Math.atan2(c3y - by, c3xR - bx)
        const N = 72
        const arcPts = Array.from({ length: N + 1 }, (_, i) => {
          const t = a1 + (a2 - a1) * i / N
          return `${(bx + r3 * Math.cos(t)).toFixed(2)},${(by + r3 * Math.sin(t)).toFixed(2)}`
        })
        const d = [
          `M ${c3x.toFixed(2)},${P}`, `L ${c3x.toFixed(2)},${c3y.toFixed(2)}`,
          ...arcPts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)),
          `L ${c3xR.toFixed(2)},${c3y.toFixed(2)}`, `L ${c3xR.toFixed(2)},${P}`,
        ].join(' ')
        return <path d={d} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"/>
      })()}
      <rect x={bx-bbW/2} y={bbY-2} width={bbW} height={4} fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth={2.5}/>
      <line x1={bx} y1={bbY+2} x2={bx} y2={by-7} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2}/>
      <circle cx={bx} cy={by} r={7} fill="none" stroke="#ff5722" strokeWidth={3}/>
      {shots.map((s, i) => {
        const px = P + s.x * CW, py = P + s.y * CH
        return s.made
          ? <circle key={i} cx={px} cy={py} r={6} fill="rgba(34,197,94,0.88)" stroke="#15803d" strokeWidth={1.5}/>
          : <g key={i}>
              <circle cx={px} cy={py} r={6} fill="rgba(239,68,68,0.85)" stroke="#b91c1c" strokeWidth={1.5}/>
              <line x1={px-3.5} y1={py-3.5} x2={px+3.5} y2={py+3.5} stroke="#fff" strokeWidth={1.5}/>
              <line x1={px+3.5} y1={py-3.5} x2={px-3.5} y2={py+3.5} stroke="#fff" strokeWidth={1.5}/>
            </g>
      })}
      {onShot && (
        <text x={W/2} y={H*0.6} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.5)" fontWeight="600">
          Toca para marcar la posición del tiro
        </text>
      )}
    </svg>
  )
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────

function TeamBadge({ name = '', color = '#888', size = 38 }) {
  const init = name.split(' ').filter(w => w.length > 1).map(w => w[0].toUpperCase()).join('').slice(0, 3) || (name[0]?.toUpperCase() || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${color}28, ${color}10)`,
      border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 900, color,
      letterSpacing: -0.5, flexShrink: 0,
    }}>{init}</div>
  )
}

function PlayerTile({ number, name, fouls = 0, active, color = '#22c55e', onClick, status }) {
  const f = Math.min(fouls, 5)
  const foulColor = f >= 5 ? '#ef4444' : f >= 4 ? '#f59e0b' : '#ef4444'
  const isOut  = status === 'eliminated' || status === 'disqualified'
  const isDesc = status === 'disqualified'
  const cardBg = isOut ? '#1a0505' : (active ? color + '22' : '#131d2f')
  const cardBorder = isOut ? '#5a0a0a' : (active ? color + '99' : '#1e2d42')
  const numColor = isOut ? '#ef444499' : (active ? color : '#dde5f0')
  const accentColor = isOut ? '#ef4444' : color
  return (
    <button onClick={isOut ? undefined : onClick} className="tb" style={{
      background: 'none', border: 'none', cursor: isOut ? 'not-allowed' : (active ? 'pointer' : 'default'),
      padding: '3px 5px', width: '100%', opacity: isOut ? 0.6 : 1,
    }}>
      <div style={{
        width: '100%', borderRadius: 8, backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: active && !isOut ? `0 0 14px ${color}40` : 'none',
        padding: '8px 5px 6px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        transition: 'all 0.12s', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          backgroundColor: accentColor, borderRadius: '8px 0 0 8px',
          opacity: active && !isOut ? 1 : 0.5,
        }}/>
        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: numColor }}>
          {number}
        </div>
        {isOut ? (
          <div style={{ fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 4,
            backgroundColor: '#3a0c0c', color: '#ff6b6b', letterSpacing: 0.5 }}>
            {isDesc ? 'DESC' : 'ELIM'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: 2,
                backgroundColor: i <= f ? foulColor : '#253345',
              }}/>
            ))}
          </div>
        )}
        {name && (
          <span style={{
            fontSize: 7, fontWeight: 600,
            color: isOut ? '#5a3030' : (active ? '#a8b8cc' : '#4b5e78'),
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name.split(' ')[0]}</span>
        )}
      </div>
    </button>
  )
}

function ActionBtn({ label, color, aKey, armed, armAction, small }) {
  const isActive = armed === aKey
  return (
    <button onClick={() => armAction(aKey)} style={{
      width: '100%',
      padding: small ? '8px 6px' : '11px 10px',
      borderRadius: 6, cursor: 'pointer',
      backgroundColor: isActive ? color + '1a' : '#0e1826',
      color: isActive ? '#fff' : '#c8d5e8',
      fontSize: small ? 9 : 11, fontWeight: 800, lineHeight: 1.2, textAlign: 'center',
      border: 'none',
      borderBottom: `2.5px solid ${isActive ? color : color + '55'}`,
      boxShadow: isActive ? `inset 0 0 20px ${color}12` : 'none',
      transition: 'all 0.1s',
    }}>{label}</button>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.82)', zIndex:300,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => { if (e.target===e.currentTarget && onClose) onClose() }}>
      <div style={{ backgroundColor:'#161c28', border:'1px solid #1f2d42', borderRadius:18, padding:22, width:'100%', maxWidth:360 }}>
        {onClose && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:-6 }}>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#4b5563', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function btnStyle(bg, fs = 14) {
  return { width:'100%', padding:'12px', backgroundColor:bg, color:'#fff', border:'none', borderRadius:10, fontSize:fs, fontWeight:800, cursor:'pointer' }
}

function ShotInfo({ shots }) {
  const made = shots.filter(s => s.made).length, total = shots.length
  const pct = total ? Math.round(made/total*100) : null
  return (
    <div style={{ display:'flex', gap:16, marginTop:6, fontSize:12, color:'#6b7280' }}>
      <span>Intentos: <b style={{ color:'#9ca3af' }}>{total}</b></span>
      <span>Anotados: <b style={{ color:'#22c55e' }}>{made}</b></span>
      {pct !== null && <span>TC%: <b style={{ color:'#9ca3af' }}>{pct}%</b></span>}
    </div>
  )
}

function BSSection({ title, color, rows }) {
  const th = { fontSize:10, fontWeight:700, color:'#6b7280', padding:'5px 3px', textAlign:'center', borderBottom:'1px solid #1f2937' }
  const td = { fontSize:11, padding:'6px 3px', textAlign:'center', borderBottom:'1px solid #161c28', color:'#d1d5db' }
  const tot = rows.reduce((a,r) => {
    const s = r.s||{}
    return { pts:a.pts+(s.pts||0), fg2m:a.fg2m+(s.fg2m||0), fg2a:a.fg2a+(s.fg2a||0),
      fg3m:a.fg3m+(s.fg3m||0), fg3a:a.fg3a+(s.fg3a||0), ftm:a.ftm+(s.ftm||0), fta:a.fta+(s.fta||0),
      reb:a.reb+(s.reb||0), ast:a.ast+(s.ast||0), stl:a.stl+(s.stl||0), blk:a.blk+(s.blk||0), tov:a.tov+(s.tov||0), fouls:a.fouls+(s.fouls||0) }
  }, { pts:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0,reb:0,ast:0,stl:0,blk:0,tov:0,fouls:0 })
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:800, color, marginBottom:8 }}>{title}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', backgroundColor:'#111520', borderRadius:10, overflow:'hidden', border:'1px solid #1f2937' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign:'left', paddingLeft:8, minWidth:80 }}>Jugador</th>
              {['PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F'].map(c => <th key={c} style={{ ...th, minWidth:34 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.s||{}
              return (
                <tr key={i}>
                  <td style={{ ...td, textAlign:'left', paddingLeft:8, fontWeight:600 }}>
                    <span style={{ fontSize:10, color:'#4b5563', marginRight:4 }}>#{r.num}</span>{r.name.split(' ')[0]}
                  </td>
                  <td style={{ ...td, fontWeight:800, color:(s.pts||0)>0?'#f0f0f0':'#374151' }}>{s.pts||0}</td>
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
            {rows.length > 0 && (
              <tr style={{ backgroundColor:'#1a2030' }}>
                <td style={{ ...td, textAlign:'left', paddingLeft:8, fontWeight:800, color:'#9ca3af' }}>TOTAL</td>
                <td style={{ ...td, fontWeight:800, color:'#f0f0f0' }}>{tot.pts}</td>
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

function PrintBS({ rows }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
      <thead>
        <tr style={{ backgroundColor:'#f3f4f6' }}>
          {['#','Jugador','PTS','TC','3P','TL','REB','AST','ROB','TAP','PÉR','F'].map(h => (
            <th key={h} style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:h==='Jugador'?'left':'center' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const s = r.s||{}
          return (
            <tr key={i}>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{r.num}</td>
              <td style={{ padding:'3px 5px', border:'1px solid #e5e7eb' }}>{r.name}</td>
              {[s.pts||0,`${s.fg2m||0}/${s.fg2a||0}`,`${s.fg3m||0}/${s.fg3a||0}`,`${s.ftm||0}/${s.fta||0}`,s.reb||0,s.ast||0,s.stl||0,s.blk||0,s.tov||0,s.fouls||0].map((v,j) => (
                <td key={j} style={{ padding:'3px 5px', border:'1px solid #e5e7eb', textAlign:'center' }}>{v}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LivePage() {
  const { user, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [game, setGame]                 = useState(null)
  const [gps, setGps]                   = useState([])
  const [ourTeamName, setOurTeamName]   = useState('')
  const [onCourt, setOnCourt]           = useState([])
  const [rivalOnCourt, setRivalOnCourt] = useState([])
  const [events, setEvents]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState('live')

  const [quarter, setQuarter]   = useState(1)
  const [secs, setSecs]         = useState(600)
  const [running, setRunning]   = useState(false)
  const intervalRef             = useRef(null)

  const [editingClock, setEditingClock] = useState(false)
  const [clockInput, setClockInput]     = useState('')

  const [armed, setArmed] = useState(null)
  const [modal, setModal] = useState(null)

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { if (user) load() }, [user])

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => { if (s <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0 } return s-1 })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  useEffect(() => {
    if (!id || !user) return
    const sync = setInterval(async () => {
      const { data } = await supabase.from('game_events').select('*').eq('game_id', id).order('created_at', { ascending:true })
      if (data) setEvents(data)
    }, 10000)
    return () => clearInterval(sync)
  }, [id, user])

  // ── Load ─────────────────────────────────────────────────────────────────────
  async function load() {
    const { data: g } = await supabase.from('games').select('*').eq('id', id).single()
    if (!g) { router.replace('/dashboard/estadisticas'); return }
    setGame(g)
    if (g.quarter) setQuarter(Number(g.quarter) || 1)

    if (g.team_id) {
      const { data: t } = await supabase.from('teams').select('name').eq('id', g.team_id).single()
      if (t?.name) setOurTeamName(t.name)
    }

    const { data: rows } = await supabase.from('game_players').select('*, players(full_name, number)').eq('game_id', id)
    const ps = rows || []
    setGps(ps)
    setOnCourt(ps.slice(0,5).map(p => p.player_id))
    if (g.rival_roster?.length) setRivalOnCourt(g.rival_roster.slice(0,5))

    const { data: evs } = await supabase.from('game_events').select('*').eq('game_id', id).order('created_at', { ascending:true })
    setEvents(evs || [])
    setLoading(false)
  }

  // ── Clock ────────────────────────────────────────────────────────────────────
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

  // ── Save event ───────────────────────────────────────────────────────────────
  async function saveEv(type, team, playerRef, extra = {}) {
    const isOur = team === 'us'
    const pts = type==='2pt_made'?2 : type==='3pt_made'?3 : type==='ft_made'?1 : 0
    const payload = {
      game_id: id, team, event_type: type,
      player_id:    (isOur && playerRef) ? playerRef : null,
      rival_jersey: (!isOur && playerRef !== null && playerRef !== undefined) ? playerRef : null,
      quarter, points: pts,
      shot_x: extra.x ?? null, shot_y: extra.y ?? null, linked_event_id: extra.linked ?? null,
    }
    const { data:ev, error } = await supabase.from('game_events').insert(payload).select().single()
    if (error) {
      console.error('saveEv error:', error)
      alert('Error al guardar: ' + (error.message || JSON.stringify(error)))
      return null
    }
    if (ev) {
      let next = []
      setEvents(prev => { next = [...prev, ev]; return next })
      const sc = computeScores(next)
      await supabase.from('games').update({ our_score:sc.us, rival_score:sc.rival, status:'live', quarter }).eq('id', id)
      setGame(prev => prev ? { ...prev, our_score:sc.us, rival_score:sc.rival, status:'live' } : prev)
      return ev
    }
    return null
  }

  // ── Tap player ───────────────────────────────────────────────────────────────
  async function tapPlayer(team, ref) {
    if (!armed) return
    const a = armed

    if (a === '2pt' || a === '3pt') { setModal({ type:'shot', action:a, team, ref }); return }
    if (a === 'ft') { setModal({ type:'ft_count', team, ref }); return }

    if (a === 'foul') {
      setArmed(null)
      const qBefore = events.filter(e => e.team===team && e.event_type.startsWith('foul')
        && (team==='us'?e.player_id!=null:e.rival_jersey!=null) && Number(e.quarter)===quarter).length
      const newCount = qBefore + 1
      const isBonus = newCount >= 4
      const firstBonus = newCount === 4
      await saveEv('foul_personal', team, ref)
      const ftModal = { type:'ask_fouled_player', ftTeam:team==='us'?'rival':'us',
        defaultTL:isBonus?2:null, isBonus, bonusAlert:firstBonus, foulType:'foul_personal', foulTeam:team }
      if (team === 'us') {
        const c = getPlayerFoulCounts(events, ref); c.personal++
        const st = calcPlayerStatus(c)
        if (st.out) { const gp = gps.find(g=>g.player_id===ref); setModal({ type:'player_out', pid:ref, playerNum:gp?.players?.number, playerName:gp?.players?.full_name, status:st.disqualified?'disqualified':'eliminated', nextModal:ftModal }); return }
      }
      setModal(ftModal)
      return
    }
    if (a === 'unsporting') {
      setArmed(null)
      await saveEv('foul_unsporting', team, ref)
      const ftModal = { type:'ask_fouled_player', ftTeam:team==='us'?'rival':'us', defaultTL:2, foulType:'foul_unsporting', foulTeam:team }
      if (team === 'us') {
        const c = getPlayerFoulCounts(events, ref); c.unsporting++
        const st = calcPlayerStatus(c)
        if (st.out) { const gp = gps.find(g=>g.player_id===ref); setModal({ type:'player_out', pid:ref, playerNum:gp?.players?.number, playerName:gp?.players?.full_name, status:st.disqualified?'disqualified':'eliminated', nextModal:ftModal }); return }
      }
      setModal(ftModal)
      return
    }
    if (a === 'technical_player') {
      setArmed(null)
      await saveEv('foul_technical', team, ref)
      const ftModal = { type:'ask_fouled_player', ftTeam:team==='us'?'rival':'us', defaultTL:1, foulType:'foul_technical', foulTeam:team }
      if (team === 'us') {
        const c = getPlayerFoulCounts(events, ref); c.technical++
        const st = calcPlayerStatus(c)
        if (st.out) { const gp = gps.find(g=>g.player_id===ref); setModal({ type:'player_out', pid:ref, playerNum:gp?.players?.number, playerName:gp?.players?.full_name, status:st.disqualified?'disqualified':'eliminated', nextModal:ftModal }); return }
      }
      setModal(ftModal)
      return
    }
    if (a === 'disq_player') {
      setArmed(null)
      await saveEv('foul_disqualifying', team, ref)
      const ftModal = { type:'ask_fouled_player', ftTeam:team==='us'?'rival':'us', defaultTL:2, foulType:'foul_disqualifying', foulTeam:team }
      if (team === 'us') {
        const gp = gps.find(g=>g.player_id===ref)
        setModal({ type:'player_out', pid:ref, playerNum:gp?.players?.number, playerName:gp?.players?.full_name, status:'disqualified', nextModal:ftModal }); return
      }
      setModal(ftModal)
      return
    }
    if (a === 'sub' && team === 'rival') {
      setModal({ type:'sub', outPlayer:ref, team:'rival' }); setArmed(null); return
    }
    if (a === 'steal') {
      setArmed(null); await saveEv('steal', team, ref)
      setModal({ type:'ask_steal_chain', stealerTeam:team, otherTeam:team==='us'?'rival':'us' }); return
    }
    if (a === 'block') {
      setArmed(null); await saveEv('block', team, ref)
      setModal({ type:'ask_block_chain', blockerTeam:team, otherTeam:team==='us'?'rival':'us' }); return
    }
    if (a === 'turnover') {
      setArmed(null); await saveEv('turnover', team, ref)
      setModal({ type:'ask_turnover_chain', turnoverTeam:team, otherTeam:team==='us'?'rival':'us' }); return
    }
  }

  // ── Confirm shot ─────────────────────────────────────────────────────────────
  async function confirmShot(made, x, y) {
    const m = modal
    setModal(null); setArmed(null)
    const type = m.action==='2pt' ? (made?'2pt_made':'2pt_miss') : (made?'3pt_made':'3pt_miss')
    const ev = await saveEv(type, m.team, m.ref, { x, y })
    if (!ev) return
    if (made) setModal({ type:'ask_assist', shooterTeam:m.team, linked:ev.id, scorerRef:m.ref })
    else      setModal({ type:'ask_rebound', shooterTeam:m.team, linked:ev.id })
  }

  async function confirmFtSeq(made) {
    const m = modal
    await saveEv(made?'ft_made':'ft_miss', m.team, m.ref)
    const done = (m.done||0)+1
    if (done < m.total) setModal({ ...m, done })
    else setModal(null)
  }

  async function confirmSub(inPlayer) {
    const { outPlayer, team:subTeam, currentCourt } = modal
    if (subTeam === 'us') {
      const prevCourt = currentCourt || onCourt
      const newCourt = prevCourt.map(p => p===outPlayer ? inPlayer : p)
      setOnCourt(newCourt)
      await supabase.from('game_events').insert({
        game_id:id, team:'us', event_type:'substitution', quarter,
        points:0, player_id:inPlayer, linked_event_id:outPlayer, shot_x:null, shot_y:null,
      })
      setEvents(prev => [...prev, { id:'sub_'+Date.now(), team:'us', event_type:'substitution', quarter, player_id:inPlayer, linked_event_id:outPlayer }])
      setModal({ type:'sub', team:'us', currentCourt:newCourt })
    } else {
      const newCourt = rivalOnCourt.map(n => n===outPlayer ? inPlayer : n)
      setRivalOnCourt(newCourt)
      await supabase.from('game_events').insert({
        game_id:id, team:'rival', event_type:'substitution', quarter,
        points:0, rival_jersey:inPlayer, linked_event_id:null, shot_x:null, shot_y:null,
      })
      setEvents(prev => [...prev, { id:'sub_r_'+Date.now(), team:'rival', event_type:'substitution', quarter, rival_jersey:inPlayer }])
      setModal(null)
    }
  }

  async function handleUndo() {
    if (!events.length) return
    const last = events[events.length-1]
    if (last.id && typeof last.id === 'string' && last.id.length > 20) {
      await supabase.from('game_events').delete().eq('id', last.id)
    }
    let next = []
    setEvents(prev => { next = prev.slice(0,-1); return next })
    const sc = computeScores(next)
    supabase.from('games').update({ our_score:sc.us, rival_score:sc.rival }).eq('id', id)
    setGame(prev => prev ? { ...prev, our_score:sc.us, rival_score:sc.rival } : prev)
    setModal(null); setArmed(null)
  }

  async function deleteEvent(ev) {
    await supabase.from('game_events').delete().eq('id', ev.id)
    const { data } = await supabase.from('game_events').select('*').eq('game_id', id).order('created_at', { ascending:true })
    const updated = data || []
    setEvents(updated)
    const sc = computeScores(updated)
    await supabase.from('games').update({ our_score:sc.us, rival_score:sc.rival }).eq('id', id)
    setGame(prev => prev ? { ...prev, our_score:sc.us, rival_score:sc.rival } : prev)
    setModal(null)
  }

  async function changeEventPlayer(ev, newPlayerId) {
    await supabase.from('game_events').update({ player_id: newPlayerId }).eq('id', ev.id)
    const { data } = await supabase.from('game_events').select('*').eq('game_id', id).order('created_at', { ascending:true })
    if (data) setEvents(data)
    setModal(null)
  }

  async function handleFinish() {
    if (!window.confirm('¿Finalizar el partido?')) return
    const sc = computeScores(events)
    await supabase.from('games').update({ status:'finished', our_score:sc.us, rival_score:sc.rival }).eq('id', id)
    setGame(prev => prev ? { ...prev, status:'finished' } : prev)
    setRunning(false)
  }

  function armAction(key) {
    if (isFinished) return
    if (key === 'technical') { setModal({ type:'foul_target', foulType:'technical', team:'us' }); setArmed(null); return }
    if (key === 'disqualifying') { setModal({ type:'foul_target', foulType:'disqualifying', team:'us' }); setArmed(null); return }
    if (key === 'timeout') { setModal({ type:'timeout_team' }); setArmed(null); return }
    if (key === 'sub') { setModal({ type:'sub', team:'us', currentCourt:[...onCourt] }); setArmed(null); return }
    setArmed(prev => prev===key ? null : key)
    if (modal?.type==='ask_assist' || modal?.type==='ask_rebound') setModal(null)
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'#0a0c10' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #1a2030', borderTopColor:'#22c55e', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }}/>
        <p style={{ color:'#4b5563', fontSize:13 }}>Cargando...</p>
      </div>
    </div>
  )
  if (!game) return null

  // ── Computed ─────────────────────────────────────────────────────────────────
  const isFinished   = game.status === 'finished'
  const rivals       = game.rival_roster || []
  const scores       = computeScores(events)
  const mm           = String(Math.floor(secs/60)).padStart(2,'0')
  const ss2          = String(secs%60).padStart(2,'0')
  const courtGps     = onCourt.map(pid => gps.find(g => g.player_id===pid)).filter(Boolean)
  const rivalVisible = rivalOnCourt.length > 0 ? rivalOnCourt : rivals.slice(0,5)

  const ourFouls     = events.filter(e => e.team==='us'&&e.event_type.startsWith('foul')&&e.player_id!=null).length
  const rivalFouls   = events.filter(e => e.team==='rival'&&e.event_type.startsWith('foul')&&e.rival_jersey!=null).length
  const ourFoulsQ    = events.filter(e => e.team==='us'&&e.event_type.startsWith('foul')&&e.player_id!=null&&Number(e.quarter)===quarter).length
  const rivalFoulsQ  = events.filter(e => e.team==='rival'&&e.event_type.startsWith('foul')&&e.rival_jersey!=null&&Number(e.quarter)===quarter).length
  const ourBonus     = ourFoulsQ >= 4
  const rivalBonus   = rivalFoulsQ >= 4

  const _toQs        = quarter<=2 ? [1,2] : quarter<=4 ? [3,4] : [quarter]
  const _toMax       = quarter<=2 ? 2 : quarter<=4 ? 3 : 1
  const ourTOsUsed   = events.filter(e => e.team==='us'&&e.event_type==='timeout'&&_toQs.includes(Number(e.quarter))).length
  const rivalTOsUsed = events.filter(e => e.team==='rival'&&e.event_type==='timeout'&&_toQs.includes(Number(e.quarter))).length
  const ourTOsLeft   = Math.max(0, _toMax - ourTOsUsed)
  const rivalTOsLeft = Math.max(0, _toMax - rivalTOsUsed)
  const ourTOs       = events.filter(e => e.team==='us'&&e.event_type==='timeout').length
  const rivalTOs     = events.filter(e => e.team==='rival'&&e.event_type==='timeout').length

  const ourShots     = events.filter(e => e.team==='us'&&e.shot_x!=null).map(e => ({ x:e.shot_x, y:e.shot_y, made:e.event_type.endsWith('_made') }))
  const rivalShots   = events.filter(e => e.team==='rival'&&e.shot_x!=null).map(e => ({ x:e.shot_x, y:e.shot_y, made:e.event_type.endsWith('_made') }))
  const { our:ourBS, riv:rivBS } = computeBoxScore(events, gps, rivals)

  const aActive = !!armed
  const bActive = !!armed
  const ourName  = ourTeamName || 'Nosotros'
  const rivalName = game.rival_name || 'Rival'
  const dateStr = game.date
    ? new Date(game.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
    : ''

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height:'100dvh', overflow:'hidden', display:'flex', flexDirection:'column', backgroundColor:'#0a0c10' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .tb:active{transform:scale(0.88);filter:brightness(1.4)}
        @media print{.np{display:none!important}.po{display:block!important}}
        .po{display:none}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
      `}</style>

      {/* ══ TOP BAR ════════════════════════════════════════════════════════════ */}
      <div className="np" style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 12px', height:38, backgroundColor:'#0d1018', borderBottom:'1px solid #141a26', flexShrink:0 }}>
        <Link href="/dashboard/estadisticas" style={{ color:'#7a8da8', fontSize:11, fontWeight:700, textDecoration:'none' }}>
          ← Estadísticas
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {game.status==='live' && (
            <div style={{ width:6, height:6, borderRadius:3, backgroundColor:'#ef4444',
              boxShadow:'0 0 6px #ef4444', animation:'pulse 1.5s infinite' }}/>
          )}
          <span style={{ color:'#8899aa', fontSize:10, fontWeight:600 }}>
            {TYPE_LABEL[game.game_type]||''}{dateStr ? ` · ${dateStr}` : ''}
          </span>
        </div>
        {isFinished
          ? <span style={{ color:'#22c55e', fontSize:10, fontWeight:700 }}>✓ Final</span>
          : <button onClick={handleFinish} style={{ background:'none', border:'none', color:'#7a8da8', fontSize:10, fontWeight:700, cursor:'pointer' }}>🏁 Fin</button>
        }
      </div>

      {/* ══ SCOREBOARD ═════════════════════════════════════════════════════════ */}
      <div className="np" style={{ backgroundColor:'#0d1018', padding:'8px 12px 6px', borderBottom:'1px solid #141a26', flexShrink:0 }}>

        {/* Row: Team info + Score + Rival info */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          {/* Our team */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
            <TeamBadge name={ourName} color="#22c55e" size={34}/>
            <div style={{ minWidth:0 }}>
              <div style={{ color:'#22c55e', fontWeight:900, fontSize:11, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ourName}</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                <span style={{ fontSize:8, color:ourBonus?'#ef4444':'#7a8da8', fontWeight:700 }}>
                  F:{ourFoulsQ}{ourBonus&&' ⚡'}
                </span>
                <span style={{ fontSize:8, color:ourTOsLeft===0?'#ef4444':ourTOsLeft===1?'#f59e0b':'#7a8da8', fontWeight:700 }}>
                  TM:{ourTOsLeft}/{_toMax}
                </span>
              </div>
            </div>
          </div>

          {/* Score A */}
          <div style={{ fontSize:44, fontWeight:900, color:'#22c55e', fontFamily:'monospace', lineHeight:1, minWidth:50, textAlign:'center' }}>
            {scores.us}
          </div>

          {/* Period + Clock */}
          <div style={{ textAlign:'center', flexShrink:0, padding:'0 4px' }}>
            <div style={{ display:'flex', gap:2, justifyContent:'center', marginBottom:3 }}>
              {[1,2,3,4,5].map((q,i) => (
                <button key={q}
                  onClick={() => { setQuarter(q); setSecs(600); setRunning(false); supabase.from('games').update({quarter:q}).eq('id',id) }}
                  style={{ padding:'1px 4px', borderRadius:3, border:'none', cursor:'pointer', fontSize:7, fontWeight:800,
                    backgroundColor:quarter===q?'#f59e0b':'rgba(255,255,255,0.05)',
                    color:quarter===q?'#000':'#374151' }}>
                  {['P1','P2','P3','P4','PT'][i]}
                </button>
              ))}
            </div>
            {editingClock ? (
              <input autoFocus value={clockInput}
                onChange={e => setClockInput(e.target.value)}
                onBlur={applyClockInput}
                onKeyDown={e => { if(e.key==='Enter') applyClockInput(); if(e.key==='Escape') setEditingClock(false) }}
                style={{ fontSize:20, fontWeight:900, letterSpacing:2, fontFamily:'monospace', color:'#fbbf24',
                  background:'transparent', border:'none', borderBottom:'2px solid #fbbf24', outline:'none', width:60, textAlign:'center' }}/>
            ) : (
              <div onClick={() => { if(!running){ setClockInput(`${mm}:${ss2}`); setEditingClock(true) } }}
                style={{ fontSize:22, fontWeight:900, letterSpacing:2, fontFamily:'monospace',
                  color:secs<=60?'#ef4444':secs<=120?'#f59e0b':'#e5e7eb',
                  cursor:running?'default':'pointer', lineHeight:1 }}>
                {mm}:{ss2}
              </div>
            )}
            <button onClick={() => setRunning(r => !r)} style={{
              marginTop:3, padding:'2px 10px', borderRadius:10, border:'none', cursor:'pointer', fontSize:9, fontWeight:800,
              backgroundColor:running?'rgba(239,68,68,0.12)':'rgba(34,197,94,0.12)',
              color:running?'#ef4444':'#22c55e',
              outline:`1px solid ${running?'#ef444430':'#22c55e30'}`,
            }}>{running?'⏸':'▶'}</button>
          </div>

          {/* Score B */}
          <div style={{ fontSize:44, fontWeight:900, color:'#f97316', fontFamily:'monospace', lineHeight:1, minWidth:50, textAlign:'center' }}>
            {scores.rival}
          </div>

          {/* Rival */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0, justifyContent:'flex-end' }}>
            <div style={{ minWidth:0, textAlign:'right' }}>
              <div style={{ color:'#f97316', fontWeight:900, fontSize:11, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rivalName}</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2, justifyContent:'flex-end' }}>
                <span style={{ fontSize:8, color:rivalBonus?'#ef4444':'#7a8da8', fontWeight:700 }}>
                  F:{rivalFoulsQ}{rivalBonus&&' ⚡'}
                </span>
                <span style={{ fontSize:8, color:rivalTOsLeft===0?'#ef4444':rivalTOsLeft===1?'#f59e0b':'#7a8da8', fontWeight:700 }}>
                  TM:{rivalTOsLeft}/{_toMax}
                </span>
              </div>
            </div>
            <TeamBadge name={rivalName} color="#f97316" size={34}/>
          </div>
        </div>
      </div>

      {/* ══ ARMED BANNER ══════════════════════════════════════════════════════ */}
      {armed && (
        <div className="np" style={{ backgroundColor:'#0c1829', borderBottom:'1px solid #1e3a5f',
          padding:'5px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span style={{ color:'#60a5fa', fontSize:10, fontWeight:700 }}>✦ Toca el jugador</span>
          <span style={{ color:'#93c5fd', fontSize:10, fontWeight:900, backgroundColor:'#1e3a5f',
            padding:'2px 10px', borderRadius:10 }}>
            {ACTION_LABEL[armed] || armed.toUpperCase()}
          </span>
          <button onClick={() => setArmed(null)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
      )}

      {/* ══ TABS ══════════════════════════════════════════════════════════════ */}
      <div className="np" style={{ display:'flex', backgroundColor:'#0d1018', borderBottom:'1px solid #141a26', flexShrink:0 }}>
        {[{k:'live',l:'🎮 En Vivo'},{k:'boxscore',l:'📊 Box Score'},{k:'shotmap',l:'🎯 Tiro'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex:1, padding:'8px 4px', border:'none', cursor:'pointer', fontSize:10, fontWeight:700,
            backgroundColor:'transparent',
            color:tab===t.k?'#22c55e':'#7a8da8',
            borderBottom:tab===t.k?'2px solid #22c55e':'2px solid transparent',
            transition:'color 0.15s, border-color 0.15s',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ══ LIVE TAB ══════════════════════════════════════════════════════════ */}
      {tab==='live' && (
        <div className="np" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

          {/* SWISH layout: [our players] [rival players] [log] [actions] */}
          <div style={{ display:'grid', gridTemplateColumns:'108px 76px 1fr 148px', flex:1, overflow:'hidden' }}>

            {/* ── Col A: Our players ── */}
            <div style={{ overflowY:'auto', borderRight:'1px solid #1a2540', display:'flex', flexDirection:'column' }}>
              <button onClick={() => { setModal({ type:'sub', team:'us', currentCourt:[...onCourt] }); setArmed(null) }}
                style={{ flexShrink:0, width:'100%', padding:'8px 4px', cursor:'pointer', textAlign:'center',
                  background:'#0c1f15', border:'none', borderBottom:'2px solid #22c55e',
                  color:'#22c55e', fontSize:11, fontWeight:900, letterSpacing:1 }}>
                {ourName.split(' ').filter(w=>w.length>1).map(w=>w[0]).join('').slice(0,3).toUpperCase() || 'NOS'}
              </button>
              {courtGps.map(gp => {
                const st = playerStatusFromEvents(events, gp.player_id)
                return (
                  <PlayerTile key={gp.player_id}
                    number={gp.players?.number??'?'}
                    name={gp.players?.full_name??''}
                    fouls={ourBS[gp.player_id]?.fouls||0}
                    active={aActive && !st.out} color="#22c55e"
                    onClick={() => tapPlayer('us', gp.player_id)}
                    status={st.disqualified?'disqualified':st.eliminated?'eliminated':null}/>
                )
              })}
            </div>

            {/* ── Col B: Rival players ── */}
            <div style={{ overflowY:'auto', borderRight:'1px solid #1a2540', display:'flex', flexDirection:'column' }}>
              <button onClick={() => { setModal({ type:'rival_lineup' }); setArmed(null) }}
                style={{ flexShrink:0, width:'100%', padding:'8px 4px', cursor:'pointer', textAlign:'center',
                  background:'#1a0f00', border:'none', borderBottom:'2px solid #f97316',
                  color:'#f97316', fontSize:11, fontWeight:900, letterSpacing:1 }}>
                {rivalName.split(' ').filter(w=>w.length>1).map(w=>w[0]).join('').slice(0,3).toUpperCase() || 'RIV'}
              </button>
              {rivalVisible.map(n => (
                <PlayerTile key={n}
                  number={n}
                  fouls={rivBS[n]?.fouls||0}
                  active={bActive} color="#f97316"
                  onClick={() => tapPlayer('rival', n)}/>
              ))}
            </div>

            {/* ── Col C: Log compacto (tap = editar) ── */}
            <div style={{ overflowY:'auto', borderRight:'1px solid #1a2540', display:'flex', flexDirection:'column', backgroundColor:'#090d14' }}>
              <div style={{ padding:'4px 2px', borderBottom:'1px solid #141a26', flexShrink:0, textAlign:'center' }}>
                <span style={{ fontSize:6, fontWeight:700, color:'#2d4060', letterSpacing:0.8 }}>LOG</span>
              </div>
              {events.length === 0
                ? <div style={{ color:'#1e2d42', fontSize:9, textAlign:'center', padding:'12px 2px' }}>—</div>
                : [...events].reverse().map((ev, i) => {
                    const isOur = ev.team === 'us'
                    const gp = isOur ? gps.find(g => g.player_id === ev.player_id) : null
                    const pNum = isOur
                      ? (gp?.players?.number != null ? gp.players.number : '?')
                      : (ev.rival_jersey != null ? ev.rival_jersey : '?')
                    const teamColor = isOur ? '#22c55e' : '#f97316'
                    const label = EV_LABEL[ev.event_type] || ev.event_type
                    return (
                      <button key={ev.id||i}
                        onClick={() => setModal({ type:'edit_event', ev })}
                        style={{ background:'none', border:'none', cursor:'pointer', width:'100%',
                          padding:'5px 2px', borderBottom:`1px solid #0d1520`,
                          backgroundColor: i===0 ? '#101c2e' : 'transparent',
                          borderLeft: `2px solid ${teamColor}55`,
                          textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                        <span style={{ fontSize:12, fontWeight:900, color:teamColor, lineHeight:1 }}>
                          {ev.event_type==='substitution' ? '🔄' : `#${pNum}`}
                        </span>
                        <span style={{ fontSize:6.5, fontWeight:700, color:'#7a9ab8', lineHeight:1.2,
                          maxWidth:52, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {label}
                        </span>
                        <span style={{ fontSize:6, color:'#2d3e55', lineHeight:1 }}>{Q_LABEL(ev.quarter)}</span>
                      </button>
                    )
                  })}
            </div>

            {/* ── Col D: Action buttons ── */}
            <div style={{ overflowY:'auto', borderLeft:'1px solid #1a2540', display:'flex', flexDirection:'column', alignItems:'stretch', padding:'5px 6px', gap:4 }}>
              <ActionBtn label="TIROS LIBRES" color="#16a34a" aKey="ft"              armed={armed} armAction={armAction}/>
              <ActionBtn label="2 PUNTOS"     color="#2563eb" aKey="2pt"             armed={armed} armAction={armAction}/>
              <ActionBtn label="3 PUNTOS"     color="#7c3aed" aKey="3pt"             armed={armed} armAction={armAction}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                <ActionBtn label="FALTA"    color="#dc2626" aKey="foul"          armed={armed} armAction={armAction} small/>
                <ActionBtn label="TÉCNICA"  color="#b91c1c" aKey="technical"    armed={armed} armAction={armAction} small/>
                <ActionBtn label="ANTIDEP." color="#b45309" aKey="unsporting"   armed={armed} armAction={armAction} small/>
                <ActionBtn label="DESCAL."  color="#7f1d1d" aKey="disqualifying" armed={armed} armAction={armAction} small/>
              </div>
              <ActionBtn label="T. MUERTO"    color="#0369a1" aKey="timeout"     armed={armed} armAction={armAction}/>
              <ActionBtn label="SUSTITUCIÓN"  color="#059669" aKey="sub"         armed={armed} armAction={armAction}/>
              <div style={{ height:1, backgroundColor:'#1a2540', margin:'1px 0' }}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
                <ActionBtn label="ROB"  color="#059669" aKey="steal"    armed={armed} armAction={armAction} small/>
                <ActionBtn label="TAP"  color="#0284c7" aKey="block"    armed={armed} armAction={armAction} small/>
                <ActionBtn label="PÉR"  color="#d97706" aKey="turnover" armed={armed} armAction={armAction} small/>
              </div>
              <div style={{ height:1, backgroundColor:'#1a2540', margin:'1px 0' }}/>
              <button onClick={handleUndo}
                style={{ width:'100%', padding:'7px 4px', backgroundColor:'transparent',
                  border:'1px solid #1f2937', color:'#ef4444', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer' }}>
                ↩ Deshacer
              </button>
              {!isFinished && (
                <button onClick={handleFinish}
                  style={{ width:'100%', padding:'7px 4px', backgroundColor:'#1c0505',
                    border:'1px solid #3a0c0c', color:'#fca5a5', borderRadius:6, fontSize:9, fontWeight:800, cursor:'pointer' }}>
                  🏁 Finalizar
                </button>
              )}
            </div>
          </div>

          {isFinished && (
            <div style={{ textAlign:'center', padding:'10px', backgroundColor:'#052e16', borderTop:'1px solid #14532d', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#22c55e' }}>Partido finalizado · {scores.us}–{scores.rival}</div>
              <button onClick={() => window.print()}
                style={{ marginTop:6, padding:'6px 16px', background:'linear-gradient(135deg,#1C5C2A,#52B043)',
                  color:'#fff', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                📄 Exportar PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ BOX SCORE TAB ═════════════════════════════════════════════════════ */}
      {tab==='boxscore' && (
        <div className="np" style={{ flex:1, overflowY:'auto', padding:'12px 10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#e5e7eb', margin:0 }}>Box Score</h3>
            <button onClick={() => window.print()}
              style={{ padding:'5px 12px', backgroundColor:'#1a2030', border:'1px solid #1f2937',
                borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', color:'#9ca3af' }}>
              📄 PDF
            </button>
          </div>
          <BSSection title={`🟢 ${ourName} — ${scores.us} pts`} color="#22c55e"
            rows={gps.map(gp => ({ num:gp.players?.number??'?', name:gp.players?.full_name||'—', s:ourBS[gp.player_id]||{} }))}/>
          <div style={{ marginTop:16 }}>
            <BSSection title={`🟡 ${rivalName} — ${scores.rival} pts`} color="#f97316"
              rows={rivals.map(n => ({ num:n, name:`#${n}`, s:rivBS[n]||{} }))}/>
          </div>
          <div style={{ marginTop:18 }}>
            <h4 style={{ fontSize:12, fontWeight:800, color:'#4b5563', marginBottom:8 }}>
              Historial de acciones ({events.length})
            </h4>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {[...events].reverse().map((ev, i) => {
                const isOur = ev.team==='us'
                const gp = isOur ? gps.find(g => g.player_id===ev.player_id) : null
                const pl = isOur ? (gp?.players?.full_name||'—') : (ev.rival_jersey!=null?`#${ev.rival_jersey}`:'—')
                return (
                  <div key={ev.id||i} style={{ display:'flex', gap:8, alignItems:'center', padding:'5px 8px',
                    borderRadius:7, backgroundColor:'#111520', border:`1px solid ${isOur?'#0f2015':'#1a1000'}` }}>
                    <span style={{ fontSize:9, fontWeight:800, color:'#fff',
                      backgroundColor:isOur?'#166534':'#92400e', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>
                      {Q_LABEL(ev.quarter)}
                    </span>
                    <span style={{ fontSize:11, fontWeight:600, color:'#d1d5db', flex:1 }}>{EV_LABEL[ev.event_type]||ev.event_type}</span>
                    <span style={{ fontSize:10, color:'#4b5563' }}>{pl}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ SHOT MAP TAB ══════════════════════════════════════════════════════ */}
      {tab==='shotmap' && (
        <div className="np" style={{ flex:1, overflowY:'auto', padding:'12px 10px' }}>
          <h3 style={{ fontSize:14, fontWeight:800, color:'#e5e7eb', marginBottom:14 }}>Mapa de tiro</h3>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🟢 {ourName}</div>
            <CourtSVG shots={ourShots}/>
            <ShotInfo shots={ourShots}/>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>🟡 {rivalName}</div>
            <CourtSVG shots={rivalShots}/>
            <ShotInfo shots={rivalShots}/>
          </div>
        </div>
      )}

      {/* ══ MODALS ════════════════════════════════════════════════════════════ */}

      {/* Tiro */}
      {modal?.type==='shot' && (
        <Overlay onClose={() => { setModal(null); setArmed(null) }}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:14, textAlign:'center' }}>
            {modal.action==='2pt'?'Tiro de 2':'Tiro de 3'}
          </div>
          {modal.made===undefined ? (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal({...modal,made:true})}  style={btnStyle('#16a34a')}>✓ Anotado</button>
              <button onClick={() => setModal({...modal,made:false})} style={btnStyle('#dc2626')}>✗ Fallado</button>
            </div>
          ) : (
            <>
              <div style={{ color:'#6b7280', fontSize:12, textAlign:'center', marginBottom:10 }}>Toca la posición del tiro (o salta)</div>
              <CourtSVG onShot={(x,y) => confirmShot(modal.made, x, y)}/>
              <button onClick={() => confirmShot(modal.made, 0.5, 0.5)} style={{ marginTop:10, ...btnStyle('#374151',12) }}>
                Registrar sin posición
              </button>
            </>
          )}
        </Overlay>
      )}

      {/* TL: cuántos */}
      {modal?.type==='ft_count' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:6, textAlign:'center' }}>Tiros libres</div>
          <div style={{ color:'#6b7280', fontSize:12, textAlign:'center', marginBottom:14 }}>¿Cuántos tiros libres?</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setModal({...modal,type:'ft_seq',total:n,done:0})}
                style={{ padding:'20px 0', backgroundColor:'#1a2030', color:'#fff', border:'none', borderRadius:12, fontSize:26, fontWeight:900, cursor:'pointer' }}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', ...btnStyle('#0d1018',12) }}>SIN TIROS LIBRES</button>
        </Overlay>
      )}

      {/* TL: secuencia */}
      {modal?.type==='ft_seq' && (
        <Overlay>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:4, textAlign:'center' }}>Tiros libres</div>
          <div style={{ color:'#6b7280', fontSize:12, textAlign:'center', marginBottom:16 }}>
            Tiro {(modal.done||0)+1} de {modal.total}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => confirmFtSeq(true)}  style={{ flex:1, ...btnStyle('#16a34a',22) }}>✓</button>
            <button onClick={() => confirmFtSeq(false)} style={{ flex:1, ...btnStyle('#dc2626',22) }}>✗</button>
          </div>
        </Overlay>
      )}

      {/* Técnica / Descalificante: target */}
      {modal?.type==='foul_target' && (
        <Overlay onClose={() => { setModal(null); setArmed(null) }}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:14, textAlign:'center' }}>
            {modal.foulType==='technical'?'Falta técnica':'Falta descalificante'} — ¿A quién?
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => { setModal(null); setArmed(modal.foulType==='technical'?'technical_player':'disq_player') }}
              style={{ ...btnStyle('#1a2030',13), textAlign:'center' }}>👤 Jugador — selecciona en cancha</button>
            <button onClick={async () => {
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              const theTeam = modal.team; const tl = modal.foulType==='technical'?1:2; setArmed(null)
              await saveEv(evType, theTeam, null, {})
              setModal({ type:'ask_fouled_player', ftTeam:theTeam==='us'?'rival':'us', defaultTL:tl, foulType:evType, foulTeam:theTeam })
            }} style={{ ...btnStyle('#1a2030',13), textAlign:'center' }}>
              🧑‍💼 Entrenador {modal.foulType==='technical'?'(C1 — 1 TL)':'(C2 — 2 TL)'}
            </button>
            <button onClick={async () => {
              const evType = modal.foulType==='technical'?'foul_technical':'foul_disqualifying'
              const theTeam = modal.team; const tl = modal.foulType==='technical'?1:2; setArmed(null)
              await saveEv(evType, theTeam, null, {})
              setModal({ type:'ask_fouled_player', ftTeam:theTeam==='us'?'rival':'us', defaultTL:tl, foulType:evType, foulTeam:theTeam })
            }} style={{ ...btnStyle('#1a2030',13), textAlign:'center' }}>
              🪑 Banquillo {modal.foulType==='technical'?'(B1 — 1 TL)':'(B2 — 2 TL)'}
            </button>
          </div>
          <div style={{ marginTop:14 }}>
            <div style={{ color:'#6b7280', fontSize:11, textAlign:'center', marginBottom:8 }}>¿A qué equipo?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModal({...modal,team:'us'})}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer',
                  backgroundColor:modal.team==='us'?'#16a34a':'#1a2030', color:'#fff', fontSize:12, fontWeight:700 }}>A {ourName}</button>
              <button onClick={() => setModal({...modal,team:'rival'})}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer',
                  backgroundColor:modal.team==='rival'?'#d97706':'#1a2030', color:'#fff', fontSize:12, fontWeight:700 }}>B {rivalName}</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Tiempo muerto */}
      {modal?.type==='timeout_team' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:4, textAlign:'center' }}>¿Quién pide tiempo muerto?</div>
          <div style={{ color:'#6b7280', fontSize:10, textAlign:'center', marginBottom:14 }}>
            {quarter<=2?'1ª parte':quarter<=4?'2ª parte':'Prórroga'} — máx. {_toMax} TM
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {ourTOsLeft > 0 ? (
              <button onClick={async () => { setModal(null); setArmed(null); await saveEv('timeout','us',null) }}
                style={btnStyle('#16a34a')}>
                🟢 {ourName}<span style={{ display:'block', fontSize:11, fontWeight:600, marginTop:3 }}>{ourTOsLeft} restante{ourTOsLeft!==1?'s':''}</span>
              </button>
            ) : (
              <div style={{ flex:1, padding:'12px', backgroundColor:'#1a2030', borderRadius:10, textAlign:'center', border:'1px solid #1f2937' }}>
                <div style={{ color:'#ef4444', fontWeight:800, fontSize:13 }}>🚫 {ourName}</div>
                <div style={{ color:'#4b5563', fontSize:11, marginTop:3 }}>TM agotados</div>
              </div>
            )}
            {rivalTOsLeft > 0 ? (
              <button onClick={async () => { setModal(null); setArmed(null); await saveEv('timeout','rival',null) }}
                style={btnStyle('#d97706')}>
                🟡 {rivalName}<span style={{ display:'block', fontSize:11, fontWeight:600, marginTop:3 }}>{rivalTOsLeft} restante{rivalTOsLeft!==1?'s':''}</span>
              </button>
            ) : (
              <div style={{ flex:1, padding:'12px', backgroundColor:'#1a2030', borderRadius:10, textAlign:'center', border:'1px solid #1f2937' }}>
                <div style={{ color:'#ef4444', fontWeight:800, fontSize:13 }}>🚫 {rivalName}</div>
                <div style={{ color:'#4b5563', fontSize:11, marginTop:3 }}>TM agotados</div>
              </div>
            )}
          </div>
          {(ourTOsLeft===0||rivalTOsLeft===0) && (
            <div style={{ marginTop:10, color:'#4b5563', fontSize:10, textAlign:'center' }}>Los TM se renuevan al inicio de la siguiente parte</div>
          )}
        </Overlay>
      )}

      {/* Sustitución */}
      {modal?.type==='sub' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:800, marginBottom:10 }}>🔄 Sustituciones</div>
          {modal.team==='us' ? (() => {
            const curCourt = modal.currentCourt || onCourt
            const curBench = gps.filter(g => !curCourt.includes(g.player_id))
            if (!modal.outPlayer) {
              return (
                <>
                  <div style={{ color:'#6b7280', fontSize:12, marginBottom:10 }}>¿Quién sale? Toca el jugador en pista</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {curCourt.map(pid => {
                      const gp = gps.find(g => g.player_id===pid)
                      return (
                        <button key={pid} onClick={() => setModal({...modal,outPlayer:pid})}
                          style={{ padding:'9px 12px', backgroundColor:'#1a2030', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:9 }}>
                          <span style={{ width:30, height:30, borderRadius:8, backgroundColor:'#dc2626', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, flexShrink:0 }}>{gp?.players?.number??'?'}</span>
                          {gp?.players?.full_name||'—'}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setModal(modal.nextModal || null)} style={{ marginTop:12, width:'100%', padding:'10px', backgroundColor:'#22c55e', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:800, cursor:'pointer' }}>✓ Finalizar cambios</button>
                </>
              )
            } else {
              return (
                <>
                  <div style={{ color:'#6b7280', fontSize:12, marginBottom:10 }}>
                    Sale #{gps.find(g=>g.player_id===modal.outPlayer)?.players?.number??'?'} → ¿Quién entra?
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {curBench.map(gp => (
                      <button key={gp.player_id} onClick={() => confirmSub(gp.player_id)}
                        style={{ padding:'9px 12px', backgroundColor:'#1a2030', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:9 }}>
                        <span style={{ width:30, height:30, borderRadius:8, backgroundColor:'#16a34a', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, flexShrink:0 }}>{gp.players?.number??'?'}</span>
                        {gp.players?.full_name||'—'}
                      </button>
                    ))}
                    {curBench.length===0 && <div style={{ color:'#4b5563', textAlign:'center', padding:'10px 0', fontSize:12 }}>Sin jugadores en banquillo</div>}
                  </div>
                  <button onClick={() => setModal({...modal,outPlayer:null})} style={{ marginTop:9, width:'100%', padding:'8px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, cursor:'pointer' }}>← Volver</button>
                </>
              )
            }
          })() : (
            <>
              <div style={{ color:'#6b7280', fontSize:12, marginBottom:14 }}>Sale #{modal.outPlayer} — ¿Qué dorsal entra?</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {rivals.filter(n => !rivalVisible.includes(n)).map(n => (
                  <button key={n} onClick={() => confirmSub(n)}
                    style={{ width:50, height:50, borderRadius:9, backgroundColor:'#d97706', color:'#fff', border:'none', fontSize:17, fontWeight:900, cursor:'pointer' }}>#{n}</button>
                ))}
                {rivals.filter(n => !rivalVisible.includes(n)).length===0 &&
                  <div style={{ color:'#4b5563', fontSize:12 }}>No hay más dorsales registrados</div>}
              </div>
            </>
          )}
        </Overlay>
      )}

      {/* Rebote */}
      {modal?.type==='ask_rebound' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#fbbf24', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>🏀 ¿Quién cogió el rebote?</div>
          <div style={{ color:'#6b7280', fontSize:11, textAlign:'center', marginBottom:14 }}>
            {modal.shooterTeam==='us' ? 'Tiro fallado nuestro' : `Tiro fallado de ${rivalName}`}
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ color:'#22c55e', fontSize:11, fontWeight:800, marginBottom:6 }}>🟢 {ourName}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {courtGps.map(gp => (
                <button key={gp.player_id} onClick={async () => {
                  const isOff = modal.shooterTeam==='rival'; setModal(null)
                  await saveEv(isOff?'rebound_off':'rebound_def','us',gp.player_id,{linked:modal.linked})
                }} style={{ padding:'7px 9px', borderRadius:8, border:'none', cursor:'pointer', backgroundColor:'#16a34a', color:'#fff', fontSize:11, fontWeight:800 }}>
                  #{gp.players?.number} <span style={{ fontWeight:500, fontSize:10 }}>{gp.players?.full_name?.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#f97316', fontSize:11, fontWeight:800, marginBottom:6 }}>🟡 {rivalName}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {rivalVisible.map(n => (
                <button key={n} onClick={async () => {
                  const isOff = modal.shooterTeam==='us'; setModal(null)
                  await saveEv(isOff?'rebound_off':'rebound_def','rival',n,{linked:modal.linked})
                }} style={{ padding:'7px 11px', borderRadius:8, border:'none', cursor:'pointer', backgroundColor:'#d97706', color:'#fff', fontSize:12, fontWeight:900 }}>
                  #{n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Sin rebote / Fuera</button>
        </Overlay>
      )}

      {/* Asistencia */}
      {modal?.type==='ask_assist' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#22c55e', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>👋 ¿Hubo asistencia?</div>
          <div style={{ color:'#6b7280', fontSize:11, textAlign:'center', marginBottom:14 }}>
            {modal.shooterTeam==='us' ? 'Canasta nuestra' : `Canasta de ${rivalName}`}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {(modal.shooterTeam==='us'
              ? courtGps.filter(gp => gp.player_id!==modal.scorerRef)
              : rivalVisible.filter(n => n!==modal.scorerRef).map(n => ({ player_id:n, players:{ number:n, full_name:`#${n}` }, isRival:true }))
            ).map(gp => (
              <button key={gp.player_id} onClick={async () => {
                setModal(null)
                await saveEv('assist', modal.shooterTeam, gp.player_id, { linked:modal.linked })
              }} style={{ padding:'7px 9px', borderRadius:8, border:'none', cursor:'pointer',
                backgroundColor:modal.shooterTeam==='us'?'#16a34a':'#d97706', color:'#fff', fontSize:11, fontWeight:800 }}>
                #{gp.players?.number} <span style={{ fontWeight:500, fontSize:10 }}>{gp.players?.full_name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Sin asistencia</button>
        </Overlay>
      )}

      {/* ¿Quién recibió la falta? */}
      {modal?.type==='ask_fouled_player' && (
        <Overlay onClose={() => setModal(null)}>
          {modal.bonusAlert && (
            <div style={{ backgroundColor:'#3b0708', border:'1px solid #ef4444', borderRadius:10, padding:'9px 14px', marginBottom:12, textAlign:'center' }}>
              <div style={{ color:'#ef4444', fontWeight:900, fontSize:15, marginBottom:2 }}>⚡ ¡BONUS!</div>
              <div style={{ color:'#fca5a5', fontSize:11 }}>
                {modal.ftTeam==='us' ? `${ourName} tiramos TL en todas las siguientes faltas` : `${rivalName} tirará TL en todas las siguientes faltas`}
              </div>
            </div>
          )}
          {modal.isBonus && !modal.bonusAlert && (
            <div style={{ color:'#ef4444', fontSize:11, fontWeight:800, textAlign:'center', marginBottom:8 }}>⚡ En bonus — se aplicarán 2 TL</div>
          )}
          <div style={{ color:'#fff', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>🎯 ¿Quién recibió la falta?</div>
          <div style={{ color:modal.ftTeam==='us'?'#22c55e':'#f97316', fontSize:12, fontWeight:800, textAlign:'center', marginBottom:14 }}>
            {modal.ftTeam==='us'?`🟢 ${ourName}`:`🟡 ${rivalName}`}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {(modal.ftTeam==='us'
              ? courtGps.map(gp => ({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n => ({ k:n, label:`#${n}`, ref:n }))
            ).map(item => (
              <button key={item.k}
                onClick={() => setModal({ type:'ask_ft_after_foul', ftTeam:modal.ftTeam, defaultTL:modal.defaultTL, shooterRef:item.ref, foulType:modal.foulType, foulTeam:modal.foulTeam, isBonus:modal.isBonus })}
                style={{ padding:'7px 11px', borderRadius:8, border:'none', cursor:'pointer',
                  backgroundColor:modal.ftTeam==='us'?'#16a34a':'#d97706', color:'#fff', fontSize:11, fontWeight:800 }}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModal({ type:'ask_ft_after_foul', ftTeam:modal.ftTeam, defaultTL:modal.defaultTL, shooterRef:null, foulType:modal.foulType, foulTeam:modal.foulTeam, isBonus:modal.isBonus })}
            style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Sin jugador específico</button>
        </Overlay>
      )}

      {/* ¿Tiros libres? */}
      {modal?.type==='ask_ft_after_foul' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#fff', fontSize:15, fontWeight:900, marginBottom:2, textAlign:'center' }}>🎯 ¿Tiros libres?</div>
          {modal.isBonus && modal.foulType==='foul_personal' && (
            <div style={{ backgroundColor:'#3b0708', borderRadius:6, padding:'4px 8px', marginBottom:6, textAlign:'center' }}>
              <span style={{ color:'#ef4444', fontWeight:900, fontSize:11 }}>⚡ EN BONUS — 2 TL por defecto</span>
            </div>
          )}
          {modal.foulType && modal.foulType!=='foul_personal' && (
            <div style={{ color:'#6b7280', fontSize:10, textAlign:'center', marginBottom:6 }}>
              {modal.foulType==='foul_technical'?'Técnica · 1 TL':modal.foulType==='foul_unsporting'?'Antideportiva · 2 TL + posesión':'Descalificante · 2 TL + posesión'}
            </div>
          )}
          <div style={{ color:modal.ftTeam==='us'?'#22c55e':'#f97316', fontSize:12, fontWeight:800, textAlign:'center', marginBottom:12 }}>
            Para: {modal.ftTeam==='us'?`🟢 ${ourName}`:`🟡 ${rivalName}`}
            {modal.shooterRef && (
              <span style={{ fontWeight:500, color:'#9ca3af' }}>
                {' '}— #{modal.ftTeam==='us'
                  ? (gps.find(g=>g.player_id===modal.shooterRef)?.players?.number??modal.shooterRef)
                  : modal.shooterRef}
              </span>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
            <button onClick={() => setModal(null)} style={{ padding:'16px 0', borderRadius:10, border:'none', cursor:'pointer', backgroundColor:'#1a2030', color:'#6b7280', fontSize:13, fontWeight:800 }}>No</button>
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setModal({ type:'ft_seq', total:n, done:0, team:modal.ftTeam, ref:modal.shooterRef||null })}
                style={{ padding:'16px 0', borderRadius:10, cursor:'pointer',
                  border:`2px solid ${modal.defaultTL===n?'#fbbf24':'transparent'}`,
                  backgroundColor:modal.defaultTL===n?'#92400e':'#1d4ed8', color:'#fff', fontSize:16, fontWeight:900 }}>
                {n}
              </button>
            ))}
          </div>
          {modal.foulType && modal.foulType!=='foul_personal' && (
            <button onClick={async () => { await saveEv(modal.foulType, modal.ftTeam, null); setModal(null) }}
              style={{ width:'100%', padding:'10px', marginTop:4, backgroundColor:'#0f1215', border:'2px solid #374151', borderRadius:10, color:'#9ca3af', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              ⚖️ Compensar — ambas faltas se anulan (sin TL)
            </button>
          )}
        </Overlay>
      )}

      {/* Alineación rival */}
      {modal?.type==='rival_lineup' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#f97316', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>🔄 5 en pista — {rivalName}</div>
          <div style={{ color:'#6b7280', fontSize:11, textAlign:'center', marginBottom:14 }}>Toca para activar/desactivar · máx. 5</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:12 }}>
            {rivals.map(n => {
              const isOn = rivalOnCourt.includes(n)
              return (
                <button key={n} onClick={() => {
                  if (isOn) { if (rivalOnCourt.length>1) setRivalOnCourt(rivalOnCourt.filter(x=>x!==n)) }
                  else { if (rivalOnCourt.length<5) setRivalOnCourt([...rivalOnCourt,n]) }
                }}
                style={{ width:54, height:54, borderRadius:10, cursor:'pointer',
                  border:`2px solid ${isOn?'#f97316':'#374151'}`,
                  backgroundColor:isOn?'#d97706':'#1a2030',
                  color:isOn?'#fff':'#4b5563', fontSize:17, fontWeight:900 }}>
                  #{n}
                </button>
              )
            })}
          </div>
          <div style={{ color:rivalOnCourt.length===5?'#22c55e':'#f97316', fontSize:12, fontWeight:800, textAlign:'center', marginBottom:12 }}>
            {rivalOnCourt.length}/5 en pista
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', padding:'11px', backgroundColor:'#16a34a', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer' }}>✓ Confirmar</button>
        </Overlay>
      )}

      {/* Tapón — cadena */}
      {modal?.type==='ask_block_chain' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#0284c7', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>🛡 Tapón — ¿quién falló el tiro?</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button onClick={() => setModal({...modal,shotType:'2pt'})}
              style={{ flex:1, padding:'11px', borderRadius:8, cursor:'pointer',
                border:`2px solid ${modal.shotType==='2pt'?'#2563eb':'#1a2030'}`,
                backgroundColor:modal.shotType==='2pt'?'#1d4ed8':'#111520', color:'#fff', fontSize:12, fontWeight:800 }}>2 Puntos</button>
            <button onClick={() => setModal({...modal,shotType:'3pt'})}
              style={{ flex:1, padding:'11px', borderRadius:8, cursor:'pointer',
                border:`2px solid ${modal.shotType==='3pt'?'#7c3aed':'#1a2030'}`,
                backgroundColor:modal.shotType==='3pt'?'#6d28d9':'#111520', color:'#fff', fontSize:12, fontWeight:800 }}>3 Puntos</button>
          </div>
          {modal.shotType && (
            <>
              <div style={{ color:modal.otherTeam==='us'?'#22c55e':'#f97316', fontSize:11, fontWeight:800, marginBottom:8 }}>
                {modal.otherTeam==='us'?`🟢 ${ourName}`:`🟡 ${rivalName}`}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {(modal.otherTeam==='us'
                  ? courtGps.map(gp => ({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
                  : rivalVisible.map(n => ({ k:n, label:`#${n}`, ref:n }))
                ).map(item => (
                  <button key={item.k} onClick={() => {
                    setModal({ type:'shot', action:modal.shotType, team:modal.otherTeam, ref:item.ref, made:false })
                  }} style={{ padding:'7px 9px', borderRadius:8, border:'none', cursor:'pointer',
                    backgroundColor:modal.otherTeam==='us'?'#16a34a':'#d97706', color:'#fff', fontSize:11, fontWeight:800 }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={async () => {
            if (modal.shotType) { const ev = await saveEv(modal.shotType==='2pt'?'2pt_miss':'3pt_miss', modal.otherTeam, null); setModal({ type:'ask_rebound', shooterTeam:modal.otherTeam, linked:ev?.id||null }) }
            else setModal(null)
          }} style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
            {modal.shotType ? '→ Pedir rebote sin jugador' : 'Saltar'}
          </button>
        </Overlay>
      )}

      {/* Robo — cadena */}
      {modal?.type==='ask_steal_chain' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#059669', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>🤿 Robo — ¿quién perdió el balón?</div>
          <div style={{ color:modal.otherTeam==='us'?'#22c55e':'#f97316', fontSize:11, fontWeight:800, marginBottom:8 }}>
            {modal.otherTeam==='us'?`🟢 ${ourName}`:`🟡 ${rivalName}`}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {(modal.otherTeam==='us'
              ? courtGps.map(gp => ({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n => ({ k:n, label:`#${n}`, ref:n }))
            ).map(item => (
              <button key={item.k} onClick={async () => { setModal(null); await saveEv('turnover', modal.otherTeam, item.ref) }}
                style={{ padding:'7px 9px', borderRadius:8, border:'none', cursor:'pointer',
                  backgroundColor:modal.otherTeam==='us'?'#16a34a':'#d97706', color:'#fff', fontSize:11, fontWeight:800 }}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Sin jugador específico</button>
        </Overlay>
      )}

      {/* Pérdida — cadena */}
      {modal?.type==='ask_turnover_chain' && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ color:'#d97706', fontSize:15, fontWeight:900, marginBottom:4, textAlign:'center' }}>💸 Pérdida — ¿quién robó el balón?</div>
          <div style={{ color:modal.otherTeam==='us'?'#22c55e':'#f97316', fontSize:11, fontWeight:800, marginBottom:8 }}>
            {modal.otherTeam==='us'?`🟢 ${ourName}`:`🟡 ${rivalName}`}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {(modal.otherTeam==='us'
              ? courtGps.map(gp => ({ k:gp.player_id, label:`#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}`, ref:gp.player_id }))
              : rivalVisible.map(n => ({ k:n, label:`#${n}`, ref:n }))
            ).map(item => (
              <button key={item.k} onClick={async () => { setModal(null); await saveEv('steal', modal.otherTeam, item.ref) }}
                style={{ padding:'7px 9px', borderRadius:8, border:'none', cursor:'pointer',
                  backgroundColor:modal.otherTeam==='us'?'#16a34a':'#d97706', color:'#fff', fontSize:11, fontWeight:800 }}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModal(null)} style={{ width:'100%', padding:'9px', backgroundColor:'#1a2030', color:'#6b7280', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Sin jugador específico</button>
        </Overlay>
      )}

      {/* Jugador eliminado / descalificado */}
      {modal?.type==='player_out' && (
        <Overlay>
          <div style={{ textAlign:'center', marginBottom:16 }}>
            <div style={{ fontSize:36, lineHeight:1, marginBottom:8 }}>
              {modal.status==='disqualified' ? '🔴' : '⛔'}
            </div>
            <div style={{ fontSize:16, fontWeight:900, color:'#ef4444', marginBottom:4 }}>
              {modal.status==='disqualified' ? 'JUGADOR DESCALIFICADO' : 'JUGADOR ELIMINADO'}
            </div>
            <div style={{ fontSize:13, color:'#9ca3af' }}>
              #{modal.playerNum} {modal.playerName?.split(' ')[0]}
            </div>
          </div>
          <div style={{ padding:'10px 14px', backgroundColor:'#1a0808', borderRadius:10, marginBottom:16,
            border:'1px solid #3a1010', fontSize:11, color:'#d1d5db', lineHeight:1.6 }}>
            {modal.status==='disqualified'
              ? '🚫 Debe abandonar la pista inmediatamente y no puede volver a jugar en este partido.'
              : '⛔ Ha acumulado 5 faltas. Debe abandonar la pista y debe ser sustituido (salvo que el equipo tenga ≤4 jugadores disponibles).'}
          </div>
          <button onClick={() => {
            setModal({ type:'sub', team:'us', currentCourt:[...onCourt], nextModal:modal.nextModal })
          }} style={{ ...btnStyle('#dc2626', 13), marginBottom:8 }}>
            🔄 Hacer sustitución ahora
          </button>
          <button onClick={() => setModal(modal.nextModal)}
            style={btnStyle('#1f2937', 12)}>
            Continuar sin sustituir
          </button>
        </Overlay>
      )}

      {/* Editar / eliminar acción del log */}
      {modal?.type==='edit_event' && (() => {
        const ev = modal.ev
        const isOur = ev.team === 'us'
        const teamColor = isOur ? '#22c55e' : '#f97316'
        const teamName  = isOur ? ourName : rivalName
        const gp = isOur ? gps.find(g => g.player_id === ev.player_id) : null
        const pLabel = isOur
          ? (gp ? `#${gp.players?.number} ${gp.players?.full_name?.split(' ')[0]||''}` : '—')
          : (ev.rival_jersey != null ? `#${ev.rival_jersey}` : '—')
        return (
          <Overlay onClose={() => setModal(null)}>
            <div style={{ fontSize:13, fontWeight:900, color:'#e5e7eb', marginBottom:12, textAlign:'center' }}>
              ✏️ Editar acción
            </div>
            {/* Resumen de la acción */}
            <div style={{ padding:'10px 12px', backgroundColor:'#0d1018', borderRadius:10, marginBottom:16, textAlign:'center',
              borderLeft:`3px solid ${teamColor}` }}>
              <div style={{ fontSize:10, color:teamColor, fontWeight:700, marginBottom:4 }}>{teamName} · {Q_LABEL(ev.quarter)}</div>
              <div style={{ fontSize:14, fontWeight:900, color:'#f0f0f0', marginBottom:2 }}>
                {EV_LABEL[ev.event_type] || ev.event_type}
              </div>
              <div style={{ fontSize:11, color:'#6b7280' }}>{pLabel}</div>
            </div>

            {/* Cambiar jugador (solo nuestro equipo, si tiene player_id) */}
            {isOur && ev.player_id && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:'#6b7280', fontWeight:700, marginBottom:8 }}>Cambiar jugador:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {courtGps.map(cgp => (
                    <button key={cgp.player_id}
                      onClick={() => changeEventPlayer(ev, cgp.player_id)}
                      style={{ padding:'7px 10px', borderRadius:7,
                        border:`2px solid ${cgp.player_id===ev.player_id?'#22c55e':'#2d3748'}`,
                        backgroundColor: cgp.player_id===ev.player_id ? '#22c55e22' : '#1a2438',
                        color: cgp.player_id===ev.player_id ? '#22c55e' : '#c9d1d9',
                        fontSize:12, fontWeight:900, cursor:'pointer' }}>
                      #{cgp.players?.number??'?'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Eliminar */}
            <button onClick={() => deleteEvent(ev)}
              style={{ ...btnStyle('#dc2626', 13), marginBottom:8 }}>
              🗑 Eliminar esta acción
            </button>
            <button onClick={() => setModal(null)} style={btnStyle('#1f2937', 12)}>
              Cancelar
            </button>
          </Overlay>
        )
      })()}

      {/* ══ PRINTABLE ═════════════════════════════════════════════════════════ */}
      <div className="po">
        <h1 style={{ textAlign:'center', fontSize:18, margin:'0 0 4px' }}>vs {rivalName}</h1>
        <p style={{ textAlign:'center', fontSize:12, color:'#666', margin:'0 0 16px' }}>{game.date} · {scores.us}–{scores.rival}</p>
        <h2 style={{ fontSize:14, marginBottom:8 }}>{ourName}</h2>
        <PrintBS rows={gps.map(gp => ({ num:gp.players?.number??'?', name:gp.players?.full_name||'—', s:ourBS[gp.player_id]||{} }))}/>
        <h2 style={{ fontSize:14, marginTop:20, marginBottom:8 }}>{rivalName}</h2>
        <PrintBS rows={rivals.map(n => ({ num:n, name:`#${n}`, s:rivBS[n]||{} }))}/>
      </div>
    </div>
  )
}
