'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

/* ── Dimensions ─────────────────────────────────── */
const CW     = 560
const HALF_H = 520
const FULL_H = 970
const PR     = 20   // player radius

function getCanvasH(ct) { return ct === 'full' ? FULL_H : HALF_H }
function easeInOut(t)   { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

/* ── Rounded-rect helper ──────────────────────────── */
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.lineTo(x+w-r, y);  ctx.arcTo(x+w, y,     x+w, y+r,   r)
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r)
  ctx.lineTo(x+r, y+h);  ctx.arcTo(x,   y+h, x,   y+h-r,   r)
  ctx.lineTo(x, y+r);    ctx.arcTo(x,   y,   x+r,  y,       r)
  ctx.closePath()
}

/* ══════════════════════════════════════════════════
   drawHalfLines — basket at TOP, court extends down
   forFullCourt=true → skip boundary & mid-arc
══════════════════════════════════════════════════ */
function drawHalfLines(ctx, W, H, forFullCourt = false) {
  const mg = 22
  const sx = (W - 2*mg) / 15
  const sy = (H - 2*mg) / 14
  const s  = (sx + sy) / 2

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth   = 2.2
  ctx.lineCap     = 'butt'

  if (!forFullCourt) {
    rrect(ctx, mg, mg, W-2*mg, H-2*mg, 10); ctx.stroke()
  }

  const pW = 4.9*sx, pH = 5.8*sy
  const pX = (W-pW)/2, pY = mg
  ctx.strokeRect(pX, pY, pW, pH)

  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(W/2 - 0.915*sx, pY+3)
  ctx.lineTo(W/2 + 0.915*sx, pY+3)
  ctx.stroke(); ctx.lineWidth = 2.2

  const rimX = W/2
  const rimY = pY + 1.575*sy
  const rimR = Math.max(0.225*s, 13)
  ctx.beginPath(); ctx.arc(rimX, rimY, rimR, 0, Math.PI*2); ctx.stroke()

  const raR = 1.25*s
  ctx.beginPath(); ctx.arc(rimX, rimY, raR, 0, Math.PI); ctx.stroke()

  const ftY = pY + pH
  ctx.beginPath(); ctx.moveTo(pX, ftY); ctx.lineTo(pX+pW, ftY); ctx.stroke()

  const ftR = 1.8*s
  ctx.beginPath(); ctx.arc(rimX, ftY, ftR, Math.PI, 0); ctx.stroke()
  ctx.setLineDash([8,7])
  ctx.beginPath(); ctx.arc(rimX, ftY, ftR, 0, Math.PI); ctx.stroke()
  ctx.setLineDash([])

  const mk = 9
  ;[1.7, 2.9, 3.7, 4.6].forEach(d => {
    const my = pY + d*sy
    if (my > rimY+rimR+4 && my < ftY-2) {
      ctx.beginPath(); ctx.moveTo(pX, my);          ctx.lineTo(pX+mk, my);        ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pX+pW-mk, my);    ctx.lineTo(pX+pW, my);        ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pX-mk, my);        ctx.lineTo(pX, my);           ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pX+pW, my);        ctx.lineTo(pX+pW+mk, my);    ctx.stroke()
    }
  })

  const arc3R  = 6.75*sx
  const c3X    = mg + 0.9*sx
  const c3Xr   = W - c3X
  const hChord = rimX - c3X

  if (arc3R > hChord + 1) {
    const sideH     = Math.sqrt(arc3R*arc3R - hChord*hChord)
    const arcBottom = rimY + sideH
    ctx.beginPath(); ctx.moveTo(c3X,  pY); ctx.lineTo(c3X,  arcBottom); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(c3Xr, pY); ctx.lineTo(c3Xr, arcBottom); ctx.stroke()
    const a3 = Math.asin(hChord / arc3R)
    ctx.beginPath()
    ctx.arc(rimX, rimY, arc3R, Math.PI/2-a3, Math.PI/2+a3, false)
    ctx.stroke()
  }

  if (!forFullCourt) {
    const ccR = 1.8*s
    ctx.beginPath(); ctx.arc(W/2, H-mg, ccR, Math.PI, 0); ctx.stroke()
  }
}

/* ══════════════════════════════════════════════════
   drawCourt — entry point
══════════════════════════════════════════════════ */
function drawCourt(ctx, W, H, courtType) {
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0,   '#d4a958')
  grad.addColorStop(0.2, '#c89840')
  grad.addColorStop(0.5, '#d4a958')
  grad.addColorStop(0.8, '#c89840')
  grad.addColorStop(1,   '#d4a958')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

  for (let x = 0; x <= W; x += 11) {
    ctx.strokeStyle = x%22<11 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.025)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke()
  }
  for (let y = 50; y < H; y += 85) {
    ctx.strokeStyle = 'rgba(0,0,0,0.035)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke()
  }

  const mg = 22

  if (courtType === 'full') {
    const hH = Math.round(H/2)

    ctx.save()
    ctx.beginPath(); ctx.rect(0,0,W,hH); ctx.clip()
    drawHalfLines(ctx, W, hH, true)
    ctx.restore()

    ctx.save()
    ctx.translate(W,H); ctx.rotate(Math.PI)
    ctx.beginPath(); ctx.rect(0,0,W,hH); ctx.clip()
    drawHalfLines(ctx, W, hH, true)
    ctx.restore()

    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2
    rrect(ctx, mg, mg, W-2*mg, H-2*mg, 10); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mg,hH); ctx.lineTo(W-mg,hH); ctx.stroke()

    const ccR = 1.8 * ((W-2*mg)/15 + (hH-2*mg)/14) / 2
    ctx.beginPath(); ctx.arc(W/2, hH, ccR, 0, Math.PI*2); ctx.stroke()
    ctx.fillStyle='#fff'
    ctx.beginPath(); ctx.arc(W/2, hH, 4, 0, Math.PI*2); ctx.fill()

  } else {
    drawHalfLines(ctx, W, H, false)
  }
}

/* ══════════════════════════════════════════════════
   ARROW HELPERS
══════════════════════════════════════════════════ */
function arrowHead(ctx, x1, y1, x2, y2, sz=11) {
  const a = Math.atan2(y2-y1, x2-x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - sz*Math.cos(a-0.42), y2 - sz*Math.sin(a-0.42))
  ctx.lineTo(x2 - sz*Math.cos(a+0.42), y2 - sz*Math.sin(a+0.42))
  ctx.closePath(); ctx.fill()
}

function drawArrowLine(ctx, type, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1
  const len = Math.hypot(dx,dy)
  if (len < 5) return
  ctx.save()
  ctx.strokeStyle = '#111827'; ctx.fillStyle = '#111827'; ctx.lineCap = 'round'

  if (type === 'dribble') {
    ctx.lineWidth = 2.5
    const nx = -dy/len, ny = dx/len
    const waves = Math.max(2, Math.round(len/28))
    ctx.beginPath(); ctx.moveTo(x1,y1)
    for (let i=0; i<waves; i++) {
      const s = i%2===0 ? 1 : -1
      ctx.bezierCurveTo(
        x1+dx*(i+0.25)/waves + nx*13*s, y1+dy*(i+0.25)/waves + ny*13*s,
        x1+dx*(i+0.75)/waves - nx*13*s, y1+dy*(i+0.75)/waves - ny*13*s,
        x1+dx*(i+1)/waves, y1+dy*(i+1)/waves
      )
    }
    ctx.stroke(); arrowHead(ctx, x1,y1, x2,y2)
  }
  if (type === 'pass') {
    ctx.lineWidth=2.5; ctx.setLineDash([12,7])
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    ctx.setLineDash([]); arrowHead(ctx,x1,y1,x2,y2)
  }
  if (type === 'cut') {
    ctx.lineWidth=2.5
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    arrowHead(ctx,x1,y1,x2,y2)
  }
  if (type === 'shot') {
    ctx.lineWidth=2; ctx.setLineDash([9,6])
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    ctx.setLineDash([]); ctx.lineWidth=1.5
    ctx.beginPath(); ctx.arc(x2,y2,8,0,Math.PI*2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2-13,y2); ctx.lineTo(x2+13,y2)
    ctx.moveTo(x2,y2-13); ctx.lineTo(x2,y2+13)
    ctx.stroke()
  }
  if (type === 'handoff') {
    ctx.lineWidth=2.5
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    const mx=(x1+x2)/2, my=(y1+y2)/2
    ctx.lineWidth=2
    ctx.beginPath()
    ctx.moveTo(mx-8,my); ctx.lineTo(mx+8,my)
    ctx.moveTo(mx,my-8); ctx.lineTo(mx,my+8)
    ctx.stroke(); arrowHead(ctx,x1,y1,x2,y2)
  }
  if (type === 'screen') {
    ctx.lineWidth=2.5
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    arrowHead(ctx,x1,y1,x2,y2)
    const a = Math.atan2(y2-y1,x2-x1), pa = a+Math.PI/2, bL=22
    ctx.lineWidth=5; ctx.lineCap='round'
    ctx.beginPath()
    ctx.moveTo(x2+bL*Math.cos(pa), y2+bL*Math.sin(pa))
    ctx.lineTo(x2-bL*Math.cos(pa), y2-bL*Math.sin(pa))
    ctx.stroke()
  }
  ctx.restore()
}

/* ══════════════════════════════════════════════════
   ELEMENT DRAWING
══════════════════════════════════════════════════ */
function drawBallBadge(ctx, cx, cy) {
  // Mini basketball badge: small orange circle with seam lines
  const bx = cx + PR - 3, by = cy - PR + 3, br = 8
  ctx.fillStyle = '#f97316'
  ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill()
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1
  ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.stroke()
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.9
  ctx.beginPath(); ctx.moveTo(bx-br,by); ctx.lineTo(bx+br,by); ctx.stroke()
  ctx.beginPath(); ctx.arc(bx,by,br*0.6,0,Math.PI); ctx.stroke()
  ctx.beginPath(); ctx.arc(bx,by,br*0.6,Math.PI,Math.PI*2); ctx.stroke()
}

function drawEl(ctx, el, selected) {
  ctx.save()
  if (selected) { ctx.shadowColor='#3b82f6'; ctx.shadowBlur=16 }
  const { type } = el

  if (type === 'offense') {
    ctx.fillStyle = '#111827'
    ctx.beginPath(); ctx.arc(el.x, el.y, PR, 0, Math.PI*2); ctx.fill()
    if (selected) { ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2.5; ctx.stroke() }
    ctx.fillStyle='#fff'
    ctx.font='bold 14px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(el.num??'?', el.x, el.y+1)
    if (el.hasBall) drawBallBadge(ctx, el.x, el.y)
  }

  if (type === 'defense') {
    ctx.fillStyle='#fff'; ctx.strokeStyle='#111827'; ctx.lineWidth=2.5
    ctx.beginPath(); ctx.arc(el.x,el.y,PR,0,Math.PI*2); ctx.fill(); ctx.stroke()
    ctx.fillStyle='#111827'
    ctx.font='bold 14px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(el.num??'?', el.x, el.y+1)
    if (selected) { ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2.5; ctx.stroke() }
    if (el.hasBall) drawBallBadge(ctx, el.x, el.y)
  }

  if (type === 'xdefense') {
    const r = PR-4
    ctx.strokeStyle='#111827'; ctx.lineWidth=3; ctx.lineCap='round'
    ctx.beginPath()
    ctx.moveTo(el.x-r,el.y-r); ctx.lineTo(el.x+r,el.y+r)
    ctx.moveTo(el.x+r,el.y-r); ctx.lineTo(el.x-r,el.y+r)
    ctx.stroke()
    if (selected) {
      ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5
      ctx.beginPath(); ctx.arc(el.x,el.y,PR,0,Math.PI*2); ctx.stroke()
    }
    if (el.num) {
      ctx.fillStyle='#111827'; ctx.font='bold 10px sans-serif'
      ctx.textAlign='center'; ctx.textBaseline='top'
      ctx.fillText('X'+el.num, el.x, el.y+r+3)
    }
    if (el.hasBall) drawBallBadge(ctx, el.x, el.y)
  }

  if (type === 'ball') {
    ctx.fillStyle='#e07320'
    ctx.beginPath(); ctx.arc(el.x,el.y,12,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.arc(el.x,el.y,12,0,Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(el.x-12,el.y); ctx.lineTo(el.x+12,el.y); ctx.stroke()
    ctx.beginPath(); ctx.arc(el.x,el.y,7,0,Math.PI*2); ctx.stroke()
  }

  if (type === 'cone') {
    ctx.fillStyle='#f97316'
    ctx.beginPath()
    ctx.moveTo(el.x,el.y-16); ctx.lineTo(el.x-12,el.y+11); ctx.lineTo(el.x+12,el.y+11)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle='#fff8'; ctx.fillRect(el.x-13,el.y+10,26,5)
  }

  if (type === 'text') {
    ctx.font='600 14px -apple-system,sans-serif'
    const tw = ctx.measureText(el.content||'').width
    ctx.fillStyle='rgba(255,255,255,0.88)'
    ctx.fillRect(el.x-3,el.y-11,tw+8,22)
    ctx.fillStyle='#111827'; ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText(el.content||'', el.x, el.y)
  }

  if (['dribble','pass','cut','shot','handoff','screen'].includes(type)) {
    drawArrowLine(ctx, type, el.x1, el.y1, el.x2, el.y2)
  }

  ctx.restore()
}

/* ══════════════════════════════════════════════════
   Render frame helper (used by both editor and animation loop)
   t=0..1 → 0=start positions, 1=end positions (arrow targets)
   arrowAlpha=1..0 → arrows fade as players move
══════════════════════════════════════════════════ */
function renderPhaseFrame(ctx, W, H, courtType, elems, t, isEditing = false, selId = null) {
  ctx.clearRect(0, 0, W, H)
  drawCourt(ctx, W, H, courtType)

  // Build target map: playerId → {x,y}
  const targets = {}
  for (const el of elems) {
    if (el.fromId) targets[el.fromId] = { x: el.x2, y: el.y2 }
  }

  const et = easeInOut(t)

  // Draw arrows first (behind players), fading as animation progresses
  for (const el of elems) {
    if (!['dribble','pass','cut','shot','handoff','screen'].includes(el.type)) continue
    if (isEditing) {
      drawEl(ctx, el, el.id === selId)
    } else {
      const alpha = Math.max(0, 1 - et * 1.5)
      if (alpha > 0) {
        ctx.save(); ctx.globalAlpha = alpha
        drawEl(ctx, el, false)
        ctx.restore()
      }
    }
  }

  // Draw players/objects (with interpolation if animating)
  for (const el of elems) {
    if (['dribble','pass','cut','shot','handoff','screen'].includes(el.type)) continue
    if (isEditing || !targets[el.id] || t <= 0) {
      drawEl(ctx, el, isEditing ? el.id === selId : false)
    } else {
      const ix = el.x + (targets[el.id].x - el.x) * et
      const iy = el.y + (targets[el.id].y - el.y) * et
      drawEl(ctx, { ...el, x: ix, y: iy }, false)
    }
  }
}

/* ══════════════════════════════════════════════════
   PHASE THUMBNAIL
══════════════════════════════════════════════════ */
function PhaseThumb({ elements, active, index, onClick, courtType }) {
  const ref = useRef(null)
  const CH = getCanvasH(courtType)
  const TW = 132, TH = Math.round(132 * CH / CW)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    const s = TW / CW
    ctx.clearRect(0,0,TW,TH)
    ctx.save(); ctx.scale(s,s)
    renderPhaseFrame(ctx, CW, CH, courtType, elements, 0, true, null)
    ctx.restore()
  }, [elements, TW, TH, courtType, CH])

  return (
    <div onClick={onClick} style={{ cursor:'pointer', borderRadius:8, overflow:'hidden', border:`2px solid ${active?'#3b82f6':'#374151'}`, position:'relative', flexShrink:0, transition:'border-color 0.15s' }}>
      <canvas ref={ref} width={TW} height={TH} style={{ display:'block' }} />
      <div style={{ position:'absolute', top:4, left:4, background: active?'#3b82f6':'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4 }}>
        {index+1}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
const ARROW_TYPES = ['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES = ['offense','defense','xdefense']
const OBJECT_TYPES = [...PLAYER_TYPES, 'ball','cone','text']

export default function CourtEditor({ initialData, onSave, onClose }) {
  const canvasRef   = useRef(null)
  // Animation loop refs (never trigger re-render)
  const animLoopRef    = useRef(null)
  const animRunningRef = useRef(false)
  const phasesRef      = useRef(null)
  const courtTypeRef   = useRef('half')
  const selIdRef       = useRef(null)

  const mkPhase = () => ({ id: Math.random().toString(36).slice(2), elements: [] })

  const [phases,      setPhases]     = useState(() =>
    initialData?.steps?.length
      ? initialData.steps.map(s => ({ id: Math.random().toString(36).slice(2), elements: s.elements||[] }))
      : [mkPhase()]
  )
  const [cur,        setCur]         = useState(0)
  const [tab,        setTab]         = useState('draw')
  const [tool,       setTool]        = useState('select')
  const [selId,      setSelId]       = useState(null)
  const [dragging,   setDragging]    = useState(null)
  const [aSt,        setASt]         = useState(null)   // arrow start point + optional fromId
  const [aCur,       setACur]        = useState(null)
  const [title,      setTitle]       = useState(initialData?.title||'')
  const [notes,      setNotes]       = useState(initialData?.description||'')
  const [animating,  setAnimating]   = useState(false)
  const [animPh,     setAnimPh]      = useState(0)      // display-only indicator
  const [recording,  setRecording]   = useState(false)
  const [offNum,     setOffNum]      = useState(1)
  const [defNum,     setDefNum]      = useState(1)
  const [textModal,  setTextModal]   = useState(null)
  const [textVal,    setTextVal]     = useState('')
  const [courtType,  setCourtType]   = useState(initialData?.courtType||'half')

  const CH = getCanvasH(courtType)
  const els = phases[cur]?.elements || []
  const isArrowTool = ARROW_TYPES.includes(tool)

  // Keep refs in sync with state
  useEffect(() => { phasesRef.current  = phases     }, [phases])
  useEffect(() => { courtTypeRef.current = courtType }, [courtType])
  useEffect(() => { selIdRef.current   = selId      }, [selId])

  /* ── Editor render ─────────────────────────────────── */
  const render = useCallback(() => {
    if (animRunningRef.current) return      // animation loop owns the canvas
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const elems = phasesRef.current?.[cur]?.elements || []
    renderPhaseFrame(ctx, CW, CH, courtTypeRef.current, elems, 0, true, selIdRef.current)
    // Arrow preview
    if (aSt && aCur && isArrowTool) {
      ctx.save(); ctx.globalAlpha=0.55
      drawArrowLine(ctx, tool, aSt.x, aSt.y, aCur.x, aCur.y)
      ctx.restore()
    }
  }, [phases, cur, selId, aSt, aCur, tool, isArrowTool, courtType, CH])

  useEffect(() => { render() }, [render])

  /* ── Helpers ─────────────────────────────────────── */
  function addEl(el) {
    const id = Math.random().toString(36).slice(2)
    setPhases(p => p.map((ph,i) => i!==cur ? ph : { ...ph, elements:[...ph.elements, {...el,id}] }))
  }
  function updEl(id, patch) {
    setPhases(p => p.map((ph,i) => i!==cur ? ph : { ...ph, elements: ph.elements.map(e => e.id===id ? {...e,...patch} : e) }))
  }
  function delEl(id) {
    setPhases(p => p.map((ph,i) => i!==cur ? ph : { ...ph, elements: ph.elements.filter(e => e.id!==id) }))
  }
  function hitTest(x, y) {
    const r = [...(phases[cur]?.elements||[])].reverse()
    for (const el of r) {
      if (ARROW_TYPES.includes(el.type)) continue
      if (Math.hypot(x-el.x, y-el.y) < PR+6) return el
    }
    return null
  }
  function nearestPlayer(x, y) {
    for (const el of [...(phases[cur]?.elements||[])].reverse()) {
      if (!PLAYER_TYPES.includes(el.type)) continue
      if (Math.hypot(x-el.x, y-el.y) < PR+10) return el
    }
    return null
  }
  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x:(e.clientX-r.left)*(CW/r.width), y:(e.clientY-r.top)*(CH/r.height) }
  }
  function toMouse(te) { const t=te.touches[0]||te.changedTouches[0]; return {clientX:t.clientX,clientY:t.clientY} }

  /* ── Pointer events ──────────────────────────────── */
  function onDown(e) {
    if (animating || tab!=='draw') return
    const p = pos(e)

    if (isArrowTool) {
      // Snap start to nearest player if close enough
      const near = nearestPlayer(p.x, p.y)
      if (near) setASt({ x:near.x, y:near.y, fromId:near.id })
      else       setASt({ x:p.x, y:p.y })
      setACur(p)
      return
    }
    if (tool === 'select') {
      const hit = hitTest(p.x, p.y)
      if (hit) { setSelId(hit.id); setDragging({id:hit.id, ox:p.x-hit.x, oy:p.y-hit.y}) }
      else setSelId(null)
      return
    }
    if (tool === 'erase') { const hit=hitTest(p.x,p.y); if(hit){delEl(hit.id);setSelId(null)}; return }
    if (tool === 'offense')  { addEl({type:'offense',  x:p.x,y:p.y,num:offNum});setOffNum(n=>n>=5?1:n+1); return }
    if (tool === 'defense')  { addEl({type:'defense',  x:p.x,y:p.y,num:defNum}); return }
    if (tool === 'xdefense') { addEl({type:'xdefense', x:p.x,y:p.y,num:defNum}); return }
    if (tool === 'ball')  { addEl({type:'ball',  x:p.x,y:p.y}); return }
    if (tool === 'cone')  { addEl({type:'cone',  x:p.x,y:p.y}); return }
    if (tool === 'text')  { setTextModal(p); setTextVal(''); return }
  }
  function onMove(e) {
    if (animating) return
    const p = pos(e)
    if (dragging) { updEl(dragging.id,{x:p.x-dragging.ox,y:p.y-dragging.oy}); return }
    if (aSt) setACur(p)
  }
  function onUp(e) {
    if (animating) return
    if (dragging) { setDragging(null); return }
    if (aSt) {
      const p = pos(e)
      if (Math.hypot(p.x-aSt.x, p.y-aSt.y) > 20) {
        addEl({
          type:tool, x1:aSt.x,y1:aSt.y, x2:p.x,y2:p.y,
          x:(aSt.x+p.x)/2, y:(aSt.y+p.y)/2,
          fromId: aSt.fromId || null,
        })
      }
      setASt(null); setACur(null)
    }
  }

  /* ── Phase management ────────────────────────────── */

  // "+ Nueva" → copy player/object positions from current phase (no arrows)
  function addPhase() {
    const prevElems = phases[cur].elements
      .filter(el => !ARROW_TYPES.includes(el.type))
      .map(el => ({...el}))                          // same IDs, same positions
    const newPh = { id: Math.random().toString(36).slice(2), elements: prevElems }
    setPhases(p => [...p, newPh])
    setCur(phases.length)
  }

  // "→ Avanzar fase" → move players to arrow endpoints, strip arrows
  function advancePhase() {
    const currentElems = phases[cur].elements
    const targets = {}
    for (const el of currentElems) {
      if (el.fromId) targets[el.fromId] = { x:el.x2, y:el.y2 }
    }
    const newElems = currentElems
      .filter(el => !ARROW_TYPES.includes(el.type))
      .map(el => targets[el.id] ? {...el, x:targets[el.id].x, y:targets[el.id].y} : {...el})
    const newPh = { id: Math.random().toString(36).slice(2), elements: newElems }
    setPhases(p => [...p, newPh])
    setCur(phases.length)
  }

  function clonePhase() {
    const c = JSON.parse(JSON.stringify(phases[cur])); c.id=Math.random().toString(36).slice(2)
    setPhases(p=>[...p,c]); setCur(phases.length)
  }
  function delPhase() {
    if (phases.length===1) return
    setPhases(p=>p.filter((_,i)=>i!==cur)); setCur(Math.max(0,cur-1))
  }
  function clearPhase() { setPhases(p=>p.map((ph,i)=>i!==cur?ph:{...ph,elements:[]})); setSelId(null) }

  /* ── Animation ───────────────────────────────────── */
  const MOVE_DUR = 1400   // ms: players move
  const HOLD_DUR = 500    // ms: hold at final positions before next phase
  const PHASE_DUR = MOVE_DUR + HOLD_DUR

  function stopAnimate() {
    if (animLoopRef.current) cancelAnimationFrame(animLoopRef.current)
    animRunningRef.current = false
    setAnimating(false)
    // Re-render editor view
    setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d')
      const elems = phasesRef.current?.[cur]?.elements || []
      renderPhaseFrame(ctx, CW, getCanvasH(courtTypeRef.current), courtTypeRef.current, elems, 0, true, selIdRef.current)
    }, 0)
  }

  function startAnimate() {
    if (animRunningRef.current) { stopAnimate(); return }

    animRunningRef.current = true
    setAnimating(true)
    setAnimPh(0)

    const startTs = performance.now()
    const totalPhases = phasesRef.current.length

    function frame(ts) {
      if (!animRunningRef.current) return

      const elapsed = ts - startTs
      const totalDur = totalPhases * PHASE_DUR

      if (elapsed >= totalDur) {
        // Show last phase at final positions for a moment then stop
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          const W = CW, H = getCanvasH(courtTypeRef.current)
          const lastElems = phasesRef.current[totalPhases-1]?.elements || []
          renderPhaseFrame(ctx, W, H, courtTypeRef.current, lastElems, 1, false, null)
        }
        animLoopRef.current = setTimeout(() => stopAnimate(), 800)
        return
      }

      const phaseIdx = Math.min(Math.floor(elapsed / PHASE_DUR), totalPhases-1)
      const phaseElapsed = elapsed - phaseIdx * PHASE_DUR
      const t = Math.min(phaseElapsed / MOVE_DUR, 1)

      setAnimPh(phaseIdx)

      const canvas = canvasRef.current
      if (!canvas) { stopAnimate(); return }
      const ctx = canvas.getContext('2d')
      const W = CW, H = getCanvasH(courtTypeRef.current)
      const elems = phasesRef.current[phaseIdx]?.elements || []
      renderPhaseFrame(ctx, W, H, courtTypeRef.current, elems, t, false, null)

      animLoopRef.current = requestAnimationFrame(frame)
    }

    animLoopRef.current = requestAnimationFrame(frame)
  }

  useEffect(() => () => {
    cancelAnimationFrame(animLoopRef.current)
    clearTimeout(animLoopRef.current)
  }, [])

  /* ── Video export ─────────────────────────────────── */
  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder==='undefined') { alert('Tu navegador no soporta grabación de vídeo'); return }
    const stream = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType })
    const chunks = []
    rec.ondataavailable = e => chunks.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunks, {type:'video/webm'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=(title||'jugada')+'.webm'; a.click()
      URL.revokeObjectURL(url); setRecording(false)
    }
    setRecording(true); rec.start()
    // Run full animation once while recording
    const totalPhases = phasesRef.current.length
    const startTs = performance.now()
    const totalDur = totalPhases * PHASE_DUR + 800

    await new Promise(resolve => {
      function frame(ts) {
        const elapsed = ts - startTs
        if (elapsed >= totalDur) { resolve(); return }
        const phaseIdx = Math.min(Math.floor(elapsed/PHASE_DUR), totalPhases-1)
        const phaseElapsed = elapsed - phaseIdx*PHASE_DUR
        const t = Math.min(phaseElapsed/MOVE_DUR, 1)
        const ctx = canvas.getContext('2d')
        const W = CW, H = getCanvasH(courtTypeRef.current)
        const elems = phasesRef.current[phaseIdx]?.elements || []
        renderPhaseFrame(ctx,W,H,courtTypeRef.current,elems,t,false,null)
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    rec.stop()
  }

  /* ── Save ─────────────────────────────────────────── */
  function handleSave() {
    onSave?.({ title, description:notes, courtType, steps: phases.map(p=>({elements:p.elements})) })
  }

  /* ── Keyboard ─────────────────────────────────────── */
  useEffect(() => {
    function onKey(e) {
      if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return
      if ((e.key==='Delete'||e.key==='Backspace') && selId) { delEl(selId); setSelId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selId, cur])

  /* ── Selected element ─────────────────────────────── */
  const selEl = els.find(e => e.id === selId)
  const selIsPlayer = selEl && PLAYER_TYPES.includes(selEl.type)

  /* ══════════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════════ */
  const tabBtn = (t, label) => (
    <button key={t} onClick={()=>setTab(t)} style={{
      padding:'7px 14px', borderRadius:7, border:'none', cursor:'pointer',
      fontWeight:600, fontSize:13,
      background: tab===t?'#fff':'transparent',
      color: tab===t?'#111827':'#9ca3af',
      transition:'all 0.15s',
    }}>{label}</button>
  )

  const actionBtn = (id, label, icon) => (
    <button key={id} onClick={()=>setTool(id)} style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:3,
      padding:'8px 6px', borderRadius:8, border:`1.5px solid ${tool===id?'#3b82f6':'#374151'}`,
      background: tool===id?'#1d4ed8':'#1f2937', cursor:'pointer',
      flex:'1 1 calc(50% - 4px)', minWidth:72,
    }}>
      <span style={{fontSize:13,color:'#9ca3af',fontFamily:'monospace'}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:700,color:tool===id?'#fff':'#d1d5db'}}>{label}</span>
    </button>
  )

  const playerBtn = (id, numVal, label) => {
    const active = tool===id && (id==='offense'?offNum===numVal:defNum===numVal)
    return (
      <button key={id+numVal} onClick={()=>{setTool(id);id==='offense'?setOffNum(numVal):setDefNum(numVal)}} style={{
        width:33,height:33,borderRadius:id==='xdefense'?6:'50%',
        border:`2px solid ${active?'#3b82f6':id==='defense'?'#4b5563':'#374151'}`,
        background:active?'#1d4ed8':id==='offense'?'#111827':'transparent',
        color:active?'#fff':id==='offense'?'#fff':'#9ca3af',
        fontSize:id==='xdefense'?9:12,fontWeight:700,cursor:'pointer',
      }}>
        {id==='xdefense'?'X'+numVal:numVal}
      </button>
    )
  }

  const miscBtn = (id, icon, label) => (
    <button key={id} onClick={()=>setTool(id)} style={{
      display:'flex',flexDirection:'column',alignItems:'center',gap:2,
      padding:'7px 4px',borderRadius:8,border:`1.5px solid ${tool===id?'#3b82f6':'#374151'}`,
      background:tool===id?'#1d4ed8':'#1f2937',cursor:'pointer',
      flex:'1 1 calc(33% - 4px)',
    }}>
      <span style={{fontSize:15}}>{icon}</span>
      <span style={{fontSize:10,fontWeight:600,color:tool===id?'#fff':'#9ca3af'}}>{label}</span>
    </button>
  )

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#111827',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden'}}>

      {/* ── TOP BAR ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:'#1f2937',borderBottom:'1px solid #374151',flexShrink:0}}>
        {onClose && (
          <button onClick={onClose} style={{background:'#374151',border:'none',borderRadius:8,color:'#e5e7eb',padding:'7px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            ✕ Cerrar
          </button>
        )}
        <div style={{display:'flex',background:'#111827',borderRadius:8,padding:3,gap:1}}>
          {tabBtn('draw',    '✏️ Dibujar')}
          {tabBtn('animate', '▶ Animar')}
          {tabBtn('notes',   '📝 Notas')}
          {tabBtn('output',  '📤 Exportar')}
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Sin título..."
          style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:15,fontWeight:700,textAlign:'center'}} />
        <div style={{display:'flex',background:'#111827',borderRadius:8,padding:3,gap:1}}>
          {[['half','½ Pista'],['full','Pista Completa']].map(([ct,label])=>(
            <button key={ct} onClick={()=>setCourtType(ct)} style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:courtType===ct?'#fff':'transparent',color:courtType===ct?'#111827':'#9ca3af',transition:'all 0.15s'}}>{label}</button>
          ))}
        </div>
        <button onClick={handleSave} style={{background:'#16a34a',border:'none',borderRadius:8,color:'#fff',padding:'8px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
          💾 Guardar
        </button>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── LEFT: PHASES ── */}
        <div style={{width:158,background:'#1f2937',borderRight:'1px solid #374151',display:'flex',flexDirection:'column',padding:'10px 8px',gap:6,overflowY:'auto',flexShrink:0}}>
          <div style={{color:'#6b7280',fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',paddingLeft:2}}>Fases</div>

          {phases.map((ph,i) => (
            <PhaseThumb key={ph.id} index={i} elements={ph.elements} active={i===cur} courtType={courtType}
              onClick={()=>{ if(!animating){setCur(i);setSelId(null)} }} />
          ))}

          {/* Phase action buttons */}
          <div style={{display:'flex',gap:4,marginTop:2}}>
            <button onClick={addPhase} title="Nueva fase (copia jugadores)" style={{flex:1,padding:'6px 2px',borderRadius:6,border:'1px dashed #374151',background:'transparent',color:'#6b7280',cursor:'pointer',fontSize:11,fontWeight:600}}>+ Nueva</button>
            <button onClick={clonePhase} title="Clonar fase exacta" style={{flex:1,padding:'5px 2px',borderRadius:6,border:'1px solid #374151',background:'#111827',color:'#9ca3af',cursor:'pointer',fontSize:10,fontWeight:600}}>Clonar</button>
          </div>

          {/* ADVANCE PHASE — the key button */}
          <button onClick={advancePhase} title="Crea siguiente fase con jugadores en posiciones finales de las flechas"
            style={{padding:'8px 6px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            ➡ Avanzar fase
          </button>
          <div style={{fontSize:9,color:'#4b5563',textAlign:'center',marginTop:-4}}>
            Jugadores → posición final
          </div>

          <button onClick={clearPhase} style={{padding:'5px',borderRadius:6,border:'1px solid #374151',background:'transparent',color:'#9ca3af',cursor:'pointer',fontSize:10,fontWeight:600}}>🧹 Limpiar fase</button>
          {phases.length>1 && (
            <button onClick={delPhase} style={{padding:'5px',borderRadius:6,border:'1px solid #7f1d1d',background:'transparent',color:'#ef4444',cursor:'pointer',fontSize:10,fontWeight:600}}>— Eliminar fase</button>
          )}
        </div>

        {/* ── CENTER: CANVAS ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0f172a',padding:12,gap:10,overflow:'hidden'}}>

          {/* Phase indicator (draw mode) */}
          {tab==='draw' && !animating && (
            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <button onClick={()=>cur>0&&setCur(cur-1)} disabled={cur===0}
                style={{padding:'4px 10px',borderRadius:6,border:'1px solid #374151',background:cur===0?'transparent':'#1f2937',color:cur===0?'#374151':'#9ca3af',cursor:cur===0?'default':'pointer',fontSize:12}}>‹</button>
              <span style={{color:'#6b7280',fontSize:12,fontWeight:600,minWidth:80,textAlign:'center'}}>
                Fase {cur+1} / {phases.length}
              </span>
              <button onClick={()=>cur<phases.length-1&&setCur(cur+1)} disabled={cur===phases.length-1}
                style={{padding:'4px 10px',borderRadius:6,border:'1px solid #374151',background:cur===phases.length-1?'transparent':'#1f2937',color:cur===phases.length-1?'#374151':'#9ca3af',cursor:cur===phases.length-1?'default':'pointer',fontSize:12}}>›</button>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={CW} height={CH}
            style={{
              maxWidth:'100%', maxHeight:'calc(100vh - 200px)',
              objectFit:'contain', borderRadius:12,
              boxShadow:'0 8px 40px rgba(0,0,0,0.5)',
              cursor: tool==='select'?'default':tool==='erase'?'cell':'crosshair',
              touchAction:'none',
              display:(tab==='notes'||tab==='output')?'none':'block',
              pointerEvents:tab==='animate'?'none':'auto',
            }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onTouchStart={e=>{e.preventDefault();onDown(toMouse(e))}}
            onTouchMove={e=>{e.preventDefault();onMove(toMouse(e))}}
            onTouchEnd={e=>{e.preventDefault();onUp(toMouse(e))}}
          />

          {/* Animate controls */}
          {tab==='animate' && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <button onClick={startAnimate} style={{
                  background:animating?'#f59e0b':'#3b82f6',border:'none',borderRadius:10,
                  color:'#fff',padding:'12px 32px',fontSize:15,fontWeight:700,cursor:'pointer',
                  boxShadow:animating?'none':'0 4px 20px rgba(59,130,246,0.4)',
                }}>
                  {animating ? '⏹ Parar' : '▶ Animar jugada completa'}
                </button>
              </div>
              {animating
                ? <span style={{color:'#9ca3af',fontSize:13}}>Fase {animPh+1} / {phases.length} — Los jugadores se están moviendo…</span>
                : <span style={{color:'#6b7280',fontSize:12}}>{phases.length} fase{phases.length!==1?'s':''} · Duración: ~{(phases.length * PHASE_DUR / 1000).toFixed(1)}s</span>
              }
              {!animating && (
                <div style={{color:'#4b5563',fontSize:11,textAlign:'center',maxWidth:340}}>
                  💡 Las flechas dibujadas desde un jugador animarán su movimiento. Usa <strong style={{color:'#6b7280'}}>➡ Avanzar fase</strong> en el panel izquierdo para encadenar fases.
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab==='notes' && (
            <div style={{width:'100%',maxWidth:580}}>
              <div style={{color:'#9ca3af',fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>Notas de la jugada</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={14}
                placeholder="Describe la jugada: objetivos, instrucciones, variantes, puntos clave..."
                style={{width:'100%',background:'#1f2937',border:'1px solid #374151',borderRadius:10,color:'#e5e7eb',fontSize:14,padding:'14px',resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.6}}
              />
            </div>
          )}

          {/* Output tab */}
          {tab==='output' && (
            <div style={{textAlign:'center',color:'#e5e7eb',maxWidth:400}}>
              <div style={{fontSize:52,marginBottom:14}}>🎬</div>
              <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>Exportar jugada</div>
              <div style={{color:'#9ca3af',fontSize:14,marginBottom:28}}>
                {phases.length} fase{phases.length!==1?'s':''} · duración estimada ~{(phases.length*PHASE_DUR/1000).toFixed(1)}s
              </div>
              <button onClick={exportVideo} disabled={recording} style={{
                background:recording?'#374151':'#7c3aed',border:'none',borderRadius:10,
                color:'#fff',padding:'13px 32px',fontSize:15,fontWeight:700,cursor:'pointer',
                boxShadow:recording?'none':'0 4px 20px rgba(124,58,237,0.4)',
              }}>
                {recording?'⏺ Grabando...':'🎬 Exportar vídeo (.webm)'}
              </button>
              <div style={{color:'#4b5563',fontSize:12,marginTop:12}}>Formato WebM · compatible con Chrome, Firefox, Edge</div>
            </div>
          )}
        </div>

        {/* ── RIGHT: TOOLS (solo en tab draw) ── */}
        {tab==='draw' && (
          <div style={{width:196,background:'#1f2937',borderLeft:'1px solid #374151',padding:'10px 8px',overflowY:'auto',flexShrink:0,display:'flex',flexDirection:'column',gap:14}}>

            {/* ACCIONES */}
            <div>
              <div style={{color:'#6b7280',fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',marginBottom:6}}>Acciones</div>
              <div style={{color:'#4b5563',fontSize:10,marginBottom:6,lineHeight:1.4}}>
                Dibuja desde un jugador para vincularlo al movimiento
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {actionBtn('dribble','Dribble', '〰→')}
                {actionBtn('pass',   'Pase',    '- -→')}
                {actionBtn('cut',    'Corte',   '——→')}
                {actionBtn('screen', 'Bloqueo', '—⊣')}
                {actionBtn('shot',   'Tiro',    '⊹—→')}
                {actionBtn('handoff','Handoff', '⊕→')}
              </div>
            </div>

            {/* JUGADORES */}
            <div>
              <div style={{color:'#6b7280',fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',marginBottom:8}}>Jugadores</div>
              <div style={{fontSize:10,color:'#4b5563',fontWeight:600,marginBottom:5}}>⬤ Ataque (relleno)</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                {[1,2,3,4,5,'?'].map(n=>playerBtn('offense',n,n))}
              </div>
              <div style={{fontSize:10,color:'#4b5563',fontWeight:600,marginBottom:5}}>○ Defensa (hueco)</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                {[1,2,3,4,5,'?'].map(n=>playerBtn('defense',n,n))}
              </div>
              <div style={{fontSize:10,color:'#4b5563',fontWeight:600,marginBottom:5}}>✕ Defensa X</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {[1,2,3,4,5,'?'].map(n=>playerBtn('xdefense',n,n))}
              </div>
            </div>

            {/* OBJETOS */}
            <div>
              <div style={{color:'#6b7280',fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',marginBottom:8}}>Objetos</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {miscBtn('ball',   '🏀', 'Balón')}
                {miscBtn('cone',   '🔶', 'Cono')}
                {miscBtn('text',   'T',  'Texto')}
                {miscBtn('select', '↖',  'Mover')}
                {miscBtn('erase',  '🗑',  'Borrar')}
              </div>
            </div>

            {/* Selected element actions */}
            {selEl && (
              <div style={{borderTop:'1px solid #374151',paddingTop:10,display:'flex',flexDirection:'column',gap:6}}>
                <div style={{color:'#9ca3af',fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>Seleccionado</div>

                {/* Jugador con balón toggle */}
                {selIsPlayer && (
                  <button onClick={()=>updEl(selId,{hasBall:!selEl.hasBall})} style={{
                    padding:'8px',borderRadius:8,border:`1.5px solid ${selEl.hasBall?'#f97316':'#374151'}`,
                    background:selEl.hasBall?'rgba(249,115,22,0.15)':'transparent',
                    color:selEl.hasBall?'#f97316':'#9ca3af',
                    fontWeight:700,fontSize:12,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                  }}>
                    🏀 {selEl.hasBall?'Con balón ✓':'Sin balón'}
                  </button>
                )}

                <button onClick={()=>{delEl(selId);setSelId(null)}} style={{padding:'7px',borderRadius:8,border:'1px solid #7f1d1d',background:'transparent',color:'#ef4444',fontWeight:600,fontSize:12,cursor:'pointer'}}>
                  🗑 Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TEXT MODAL ── */}
      {textModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#1f2937',borderRadius:14,padding:24,width:320,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
            <div style={{color:'#fff',fontWeight:700,fontSize:15,marginBottom:14}}>Añadir texto</div>
            <input
              autoFocus value={textVal} onChange={e=>setTextVal(e.target.value)}
              placeholder="Escribe el texto..."
              onKeyDown={e=>{
                if(e.key==='Enter'){if(textVal.trim())addEl({type:'text',x:textModal.x,y:textModal.y,content:textVal.trim()});setTextModal(null)}
                if(e.key==='Escape')setTextModal(null)
              }}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #374151',background:'#111827',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:14}}
            />
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setTextModal(null)} style={{flex:1,padding:9,borderRadius:8,border:'none',background:'#374151',color:'#9ca3af',cursor:'pointer',fontWeight:600}}>Cancelar</button>
              <button onClick={()=>{if(textVal.trim())addEl({type:'text',x:textModal.x,y:textModal.y,content:textVal.trim()});setTextModal(null)}}
                style={{flex:1,padding:9,borderRadius:8,border:'none',background:'#3b82f6',color:'#fff',cursor:'pointer',fontWeight:700}}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
