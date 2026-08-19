'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ModalPortal from '@/components/ModalPortal'
const Court3DView = dynamic(() => import('./Court3DView'), { ssr: false, loading: () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#6b7280',fontSize:14}}>
    Cargando vista 3D…
  </div>
)})

class Court3DErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  render() {
    if (this.state.err) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,color:'#e5e7eb',background:'#0f172a'}}>
        <div style={{fontSize:40}}>⚠️</div>
        <p style={{fontSize:14,color:'#9ca3af',margin:0,textAlign:'center',maxWidth:320}}>
          Error al cargar la vista 3D. Tu jugada sigue intacta en la pizarra.
        </p>
        <p style={{fontSize:11,color:'#4b5563',margin:0}}>{this.state.err?.message}</p>
        <button onClick={()=>this.setState({err:null})} style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#3b82f6',color:'#fff',cursor:'pointer',fontWeight:600}}>
          Reintentar
        </button>
      </div>
    )
    return this.props.children
  }
}

/* ── Dimensions ─────────────────────────────────── */
const CW     = 560
const HALF_H = 520
const FULL_H = 970
const PR     = 20   // player radius

function getCanvasH(ct) { return ct === 'full' ? FULL_H : HALF_H }
function easeInOut(t)   { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

/* ── Quadratic bezier helpers ────────────────────── */
function bezierPt(t, x1, y1, cx, cy, x2, y2) {
  const mt = 1-t
  return { x: mt*mt*x1 + 2*mt*t*cx + t*t*x2, y: mt*mt*y1 + 2*mt*t*cy + t*t*y2 }
}
function bezierTan(t, x1, y1, cx, cy, x2, y2) {
  return { x: 2*((1-t)*(cx-x1) + t*(x2-cx)), y: 2*((1-t)*(cy-y1) + t*(y2-cy)) }
}
function bezierLen(x1, y1, cx, cy, x2, y2) {
  let len=0, px=x1, py=y1
  for (let i=1; i<=20; i++) {
    const p = bezierPt(i/20, x1, y1, cx, cy, x2, y2)
    len += Math.hypot(p.x-px, p.y-py); px=p.x; py=p.y
  }
  return len
}
/* Returns true if cx,cy meaningfully differs from the straight-line midpoint */
function isCurved(x1, y1, x2, y2, cx, cy) {
  return cx !== undefined && cy !== undefined &&
    Math.hypot(cx - (x1+x2)/2, cy - (y1+y2)/2) > 5
}

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

/* cx,cy = optional quadratic bezier control point */
function drawArrowLine(ctx, type, x1, y1, x2, y2, cx, cy) {
  const dx = x2-x1, dy = y2-y1
  const len = Math.hypot(dx,dy)
  if (len < 5) return
  ctx.save()
  ctx.strokeStyle = '#111827'; ctx.fillStyle = '#111827'; ctx.lineCap = 'round'

  const curved = isCurved(x1, y1, x2, y2, cx, cy)
  // Arrowhead direction: tangent at t=1 → from CP to endpoint
  const ahx1 = curved ? cx : x1
  const ahy1 = curved ? cy : y1

  // Helper: stroke a quadratic bezier or straight line
  function strokePath(dash) {
    if (dash) ctx.setLineDash(dash)
    ctx.beginPath(); ctx.moveTo(x1, y1)
    if (curved) ctx.quadraticCurveTo(cx, cy, x2, y2)
    else        ctx.lineTo(x2, y2)
    ctx.stroke()
    if (dash) ctx.setLineDash([])
  }

  if (type === 'dribble') {
    ctx.lineWidth = 2.5
    if (curved) {
      // Wavy line following the bezier curve
      const bLen  = bezierLen(x1, y1, cx, cy, x2, y2)
      const waves = Math.max(2, Math.round(bLen/28))
      const STEPS = waves * 16
      ctx.beginPath()
      for (let i=0; i<=STEPS; i++) {
        const t   = i/STEPS
        const pt  = bezierPt(t,  x1, y1, cx, cy, x2, y2)
        const tan = bezierTan(t, x1, y1, cx, cy, x2, y2)
        const tl  = Math.hypot(tan.x, tan.y) || 0.001
        const nx  = -tan.y/tl, ny = tan.x/tl
        const w   = Math.sin(t * waves * Math.PI * 2) * 11
        if (i===0) ctx.moveTo(pt.x + nx*w, pt.y + ny*w)
        else       ctx.lineTo(pt.x + nx*w, pt.y + ny*w)
      }
      ctx.stroke()
    } else {
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
      ctx.stroke()
    }
    arrowHead(ctx, ahx1, ahy1, x2, y2)
  }

  if (type === 'pass') {
    ctx.lineWidth = 2.5
    strokePath([12,7])
    arrowHead(ctx, ahx1, ahy1, x2, y2)
  }

  if (type === 'cut') {
    ctx.lineWidth = 2.5
    strokePath()
    arrowHead(ctx, ahx1, ahy1, x2, y2)
  }

  if (type === 'shot') {
    ctx.lineWidth = 2
    strokePath([9,6])
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(x2,y2,8,0,Math.PI*2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2-13,y2); ctx.lineTo(x2+13,y2)
    ctx.moveTo(x2,y2-13); ctx.lineTo(x2,y2+13)
    ctx.stroke()
  }

  if (type === 'handoff') {
    ctx.lineWidth = 2.5
    strokePath()
    const mid = curved
      ? bezierPt(0.5, x1, y1, cx, cy, x2, y2)
      : { x:(x1+x2)/2, y:(y1+y2)/2 }
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mid.x-8, mid.y); ctx.lineTo(mid.x+8, mid.y)
    ctx.moveTo(mid.x, mid.y-8); ctx.lineTo(mid.x, mid.y+8)
    ctx.stroke()
    arrowHead(ctx, ahx1, ahy1, x2, y2)
  }

  if (type === 'screen') {
    ctx.lineWidth = 2.5
    strokePath()
    arrowHead(ctx, ahx1, ahy1, x2, y2)
    const a  = curved ? Math.atan2(y2-cy, x2-cx) : Math.atan2(dy, dx)
    const pa = a + Math.PI/2
    const bL = 22
    ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x2 + bL*Math.cos(pa), y2 + bL*Math.sin(pa))
    ctx.lineTo(x2 - bL*Math.cos(pa), y2 - bL*Math.sin(pa))
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
    drawArrowLine(ctx, type, el.x1, el.y1, el.x2, el.y2, el.cx, el.cy)
  }

  ctx.restore()
}

/* ══════════════════════════════════════════════════
   Render frame helper (editor + animation loop)

   EDIT mode  (isEditing=true):
     animStepIdx / stepT  are unused
     activeDrawStep       – the step currently being drawn
     Players shown at positions after steps 0…activeDrawStep-1
     Arrows for other steps dimmed; step badges drawn

   ANIM mode  (isEditing=false):
     animStepIdx          – which step is currently playing
     stepT = 0..1         – progress within that step
     Base positions come from accumulateSteps(elems, animStepIdx)
══════════════════════════════════════════════════ */
function renderPhaseFrame(ctx, W, H, courtType, elems, animStepIdx, stepT,
                          isEditing = false, selId = null, activeDrawStep = 0) {
  ctx.clearRect(0, 0, W, H)
  drawCourt(ctx, W, H, courtType)

  /* ─────────── EDIT MODE ─────────── */
  if (isEditing) {
    const { playerPos, carrierId: baseCarrierId } = accumulateSteps(elems, activeDrawStep, H, courtType)

    // Draw arrows — current step at full opacity, others dimmed
    for (const el of elems) {
      if (!ARROW_TYPES.includes(el.type)) continue
      const elStep = el.step ?? 0
      const alpha  = elStep === activeDrawStep ? 1 : 0.28
      ctx.save(); ctx.globalAlpha = alpha
      drawEl(ctx, el, el.id === selId)
      ctx.restore()

      // Step badge (colored numbered dot) for every step except step-0 arrows,
      // OR whenever there are multiple steps so the user can see which is which
      if (elStep > 0) {
        const bx  = el.cx ?? (el.x1 + el.x2) / 2
        const by  = el.cy ?? (el.y1 + el.y2) / 2
        const col = STEP_COLORS[elStep % STEP_COLORS.length]
        ctx.save()
        ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(elStep + 1, bx, by + 0.5)
        ctx.restore()
      }
    }

    // Draw players at accumulated positions
    for (const el of elems) {
      if (ARROW_TYPES.includes(el.type)) continue
      const p   = playerPos[el.id]
      let drawData = p ? { ...el, x: p.x, y: p.y } : el
      if (PLAYER_TYPES.includes(el.type))
        drawData = { ...drawData, hasBall: el.id === baseCarrierId }
      drawEl(ctx, drawData, el.id === selId)
    }

    // CP handles (all arrows, so any can be curved at any time)
    for (const el of elems) {
      if (!ARROW_TYPES.includes(el.type)) continue
      const mx  = (el.x1 + el.x2) / 2, my  = (el.y1 + el.y2) / 2
      const cpx = el.cx ?? mx,           cpy = el.cy ?? my
      const moved = isCurved(el.x1, el.y1, el.x2, el.y2, el.cx, el.cy)
      if (moved) {
        ctx.save()
        ctx.strokeStyle = 'rgba(14,165,233,0.45)'; ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(cpx, cpy); ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }
      ctx.save()
      ctx.fillStyle   = moved ? '#f97316' : '#0ea5e9'
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cpx, cpy, 7, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cpx - 3.5, cpy); ctx.lineTo(cpx + 3.5, cpy)
      ctx.moveTo(cpx, cpy - 3.5); ctx.lineTo(cpx, cpy + 3.5)
      ctx.stroke()
      ctx.restore()
    }
    return
  }

  /* ─────────── ANIMATION MODE ─────────── */
  const { playerPos: basePos, carrierId: baseCarrierId } = accumulateSteps(elems, animStepIdx, H, courtType)

  // Targets for this step (only MOVE_ARROW_TYPES). Un mismo jugador puede
  // tener VARIAS flechas encadenadas en la misma acción (p.ej. el receptor
  // mete a su defensor en el bloqueo y luego sale a otro sitio, o el
  // bloqueador hace roll justo después de poner el bloqueo). En ese caso
  // targets[pid] guarda la cadena completa de tramos en orden, para que la
  // animación recorra cada flecha en vez de saltar directamente al destino
  // de la última.
  const targets = {}
  const chainTip = {} // pid → punto actual del extremo de su cadena mientras se construye
  for (const el of elems) {
    if (!MOVE_ARROW_TYPES.includes(el.type)) continue
    if ((el.step ?? 0) !== animStepIdx) continue
    let pid = el.fromId && basePos[el.fromId] ? el.fromId : null
    if (!pid) {
      let bestD = PR * 3, bestId = null
      for (const pe of elems) {
        if (!PLAYER_TYPES.includes(pe.type)) continue
        const bp = chainTip[pe.id] || basePos[pe.id]; if (!bp) continue
        const d = Math.hypot(bp.x - el.x1, bp.y - el.y1)
        if (d < bestD) { bestD = d; bestId = pe.id }
      }
      pid = bestId
    }
    if (pid) {
      const tip    = chainTip[pid] || basePos[pid]
      const startX = tip?.x ?? el.x1
      const startY = tip?.y ?? el.y1
      const seg = isCurved(startX, startY, el.x2, el.y2, el.cx, el.cy)
        ? { x: el.x2, y: el.y2, x1: startX, y1: startY, cx: el.cx, cy: el.cy }
        : { x: el.x2, y: el.y2, x1: startX, y1: startY }
      if (!targets[pid]) targets[pid] = []
      targets[pid].push(seg)
      chainTip[pid] = { x: el.x2, y: el.y2 }
    }
  }

  // Posición final de la cadena de un jugador (o su target simple), usada
  // por lógica que solo necesita saber dónde ACABA el movimiento
  function finalTargetPos(pid) {
    const tgt = targets[pid]
    if (!tgt) return basePos[pid]
    if (Array.isArray(tgt)) { const last = tgt[tgt.length - 1]; return { x: last.x, y: last.y } }
    return { x: tgt.x, y: tgt.y }
  }

  // Handoff targets: both players swap positions
  for (const el of elems) {
    if (el.type !== 'handoff') continue
    if ((el.step ?? 0) !== animStepIdx) continue
    let p1id = el.fromId && basePos[el.fromId] ? el.fromId : null
    if (!p1id) {
      let bestD = PR * 3, bestId = null
      for (const pe of elems) {
        if (!PLAYER_TYPES.includes(pe.type)) continue
        const bp = basePos[pe.id]; if (!bp) continue
        const d = Math.hypot(bp.x - el.x1, bp.y - el.y1)
        if (d < bestD) { bestD = d; bestId = pe.id }
      }
      p1id = bestId
    }
    if (!p1id) continue
    let p2id = null, bestD2 = PR * 3
    for (const pe of elems) {
      if (!PLAYER_TYPES.includes(pe.type) || pe.id === p1id) continue
      const bp = basePos[pe.id]; if (!bp) continue
      const d = Math.hypot(bp.x - el.x2, bp.y - el.y2)
      if (d < bestD2) { bestD2 = d; p2id = pe.id }
    }
    if (!p2id) continue
    // p1 (el que entrega el balón) sigue el trazo real de la flecha, no una linea recta al hueco del compañero
    const p1StartX = basePos[p1id].x, p1StartY = basePos[p1id].y
    const p2Base = basePos[p2id]
    targets[p1id] = isCurved(p1StartX, p1StartY, p2Base.x, p2Base.y, el.cx, el.cy)
      ? { x: p2Base.x, y: p2Base.y, x1: p1StartX, y1: p1StartY, cx: el.cx, cy: el.cy }
      : { x: p2Base.x, y: p2Base.y }
    targets[p2id] = { x: basePos[p1id].x, y: basePos[p1id].y }
  }

  // Smart defensive repositioning (basketball principles: protect basket, help side, denial)
  const clampX = v => Math.max(PR + 4, Math.min(W - PR - 4, v))
  const clampY = v => Math.max(PR + 4, Math.min(H - PR - 4, v))
  const hasBallTransfer = elems.some(e =>
    (e.type === 'pass' || e.type === 'handoff') && (e.step ?? 0) === animStepIdx
  )
  for (const el of elems) {
    if (!['defense','xdefense'].includes(el.type) || !el.num || targets[el.id]) continue
    const base = basePos[el.id]; if (!base) continue
    const att  = elems.find(e => e.type === 'offense' && e.num === el.num)
    if (!att || !basePos[att.id]) continue
    const attMoved = !!targets[att.id]
    if (!attMoved && !hasBallTransfer) continue   // nothing relevant happened
    const attEndPos  = finalTargetPos(att.id)
    const ballEndPos = baseCarrierId ? finalTargetPos(baseCarrierId) : null
    const ideal = computeSmartDefPos(attEndPos, ballEndPos, courtType, H)
    targets[el.id] = { x: clampX(ideal.x), y: clampY(ideal.y) }
  }

  const et = easeInOut(stepT)

  // Posición interpolada de un elemento en el instante t, respetando la
  // curva de su flecha si la tiene (en vez de una línea recta al target).
  // Si el target es una CADENA de flechas (varios tramos del mismo jugador
  // en la misma acción), reparte t entre los tramos según su longitud, para
  // que el jugador recorra cada flecha en orden en vez de saltar al final.
  function posAt(id, t) {
    const base = basePos[id]
    if (!base) return null
    const tgt = targets[id]
    if (!tgt || t <= 0) return { x: base.x, y: base.y }

    if (Array.isArray(tgt)) {
      const lens = tgt.map(seg => seg.cx !== undefined
        ? bezierLen(seg.x1, seg.y1, seg.cx, seg.cy, seg.x, seg.y)
        : Math.hypot(seg.x - seg.x1, seg.y - seg.y1))
      const totalLen = lens.reduce((a, b) => a + b, 0) || 1
      let acc = 0
      for (let i = 0; i < tgt.length; i++) {
        const segFrac = lens[i] / totalLen
        if (t <= acc + segFrac || i === tgt.length - 1) {
          const localT = segFrac > 0 ? Math.min(1, (t - acc) / segFrac) : 1
          const seg = tgt[i]
          if (seg.cx !== undefined) return bezierPt(localT, seg.x1, seg.y1, seg.cx, seg.cy, seg.x, seg.y)
          return { x: seg.x1 + (seg.x - seg.x1) * localT, y: seg.y1 + (seg.y - seg.y1) * localT }
        }
        acc += segFrac
      }
    }

    if (tgt.cx !== undefined) return bezierPt(t, tgt.x1, tgt.y1, tgt.cx, tgt.cy, tgt.x, tgt.y)
    return { x: base.x + (tgt.x - base.x) * t, y: base.y + (tgt.y - base.y) * t }
  }

  // Ball animation for this step (pass / handoff swap / shot arc)
  let ballAnimX = null, ballAnimY = null, ballReceiverId = null, ballAnimR = 8, isShotAnim = false
  const flyingCarrierId = baseCarrierId

  if (stepT > 0 && baseCarrierId) {
    const cBase = basePos[baseCarrierId]

    // ── HANDOFF: ball follows p1 → midpoint, then p2 → final ──
    const handoffEl = elems.find(el =>
      el.type === 'handoff' && (el.step ?? 0) === animStepIdx &&
      (targets[el.fromId] || /* p1 resolved via targets */ Object.keys(targets).some(k =>
        basePos[k] && Math.hypot(basePos[k].x - el.x1, basePos[k].y - el.y1) < PR * 3
      ))
    )
    const handoffP1 = handoffEl
      ? (el => el)(elems.find(pe =>
          PLAYER_TYPES.includes(pe.type) && targets[pe.id] &&
          basePos[pe.id] && Math.hypot(basePos[pe.id].x - handoffEl.x1, basePos[pe.id].y - handoffEl.y1) < PR * 3
        ))
      : null
    const handoffP2 = handoffEl && handoffP1
      ? elems.find(pe =>
          PLAYER_TYPES.includes(pe.type) && pe.id !== handoffP1.id &&
          targets[pe.id] && basePos[pe.id] &&
          Math.hypot(basePos[pe.id].x - handoffEl.x2, basePos[pe.id].y - handoffEl.y2) < PR * 3
        )
      : null

    if (handoffEl && handoffP1 && handoffP2) {
      // El balón viaja pegado al jugador que lo lleva en cada instante:
      // con p1 (siguiendo su flecha) hasta el cruce, luego con p2 — nunca
      // se separa en una línea recta inventada que va y vuelve sobre sí misma.
      const carrying = et < 0.5 ? posAt(handoffP1.id, et) : posAt(handoffP2.id, et)
      ballAnimX = carrying.x
      ballAnimY = carrying.y
      ballReceiverId = handoffP2.id

    // ── SHOT: ball flies in parabolic arc, shrinks into basket ──
    } else {
      const shotEl = elems.find(el =>
        el.type === 'shot' && (el.step ?? 0) === animStepIdx &&
        (el.fromId === baseCarrierId || !el.fromId)
      )
      if (shotEl && cBase) {
        const dist = Math.hypot(shotEl.x2 - cBase.x, shotEl.y2 - cBase.y)
        const arcH  = dist * 0.4
        ballAnimX = cBase.x + (shotEl.x2 - cBase.x) * et
        ballAnimY = cBase.y + (shotEl.y2 - cBase.y) * et - arcH * Math.sin(et * Math.PI)
        ballAnimR = et > 0.75 ? Math.max(0, 8 * (1 - (et - 0.75) / 0.25)) : 8
        isShotAnim = true
        ballReceiverId = null

      // ── PASS: ball flies straight from carrier to endpoint ──
      } else {
        const passEl = elems.find(el =>
          el.type === 'pass' && (el.step ?? 0) === animStepIdx && el.fromId === baseCarrierId
        )
        if (passEl && cBase) {
          const carrierNow = targets[baseCarrierId] ? posAt(baseCarrierId, et) : cBase
          ballAnimX = carrierNow.x + (passEl.x2 - carrierNow.x) * et
          ballAnimY = carrierNow.y + (passEl.y2 - carrierNow.y) * et
          let bestDist = PR + 30, bestId = null
          for (const el of elems) {
            if (!PLAYER_TYPES.includes(el.type) || el.id === baseCarrierId) continue
            const { x: fx, y: fy } = finalTargetPos(el.id)
            const d = Math.hypot(fx - passEl.x2, fy - passEl.y2)
            if (d < bestDist) { bestDist = d; bestId = el.id }
          }
          ballReceiverId = bestId
        }
      }
    }
  }

  // Draw arrows for current step (fading out as players move)
  for (const el of elems) {
    if (!ARROW_TYPES.includes(el.type)) continue
    if ((el.step ?? 0) !== animStepIdx) continue
    const alpha = Math.max(0, 1 - et * 1.5)
    if (alpha > 0) {
      ctx.save(); ctx.globalAlpha = alpha
      drawEl(ctx, el, false)
      ctx.restore()
    }
  }

  // Draw players/objects with interpolation from base positions
  for (const el of elems) {
    if (ARROW_TYPES.includes(el.type)) continue
    const base = basePos[el.id]
    let drawData = base ? { ...el, x: base.x, y: base.y } : el
    if (base && targets[el.id] && stepT > 0) {
      const p = posAt(el.id, et)
      drawData = { ...drawData, x: p.x, y: p.y }
    }
    if (PLAYER_TYPES.includes(el.type)) {
      if (ballAnimX !== null) {
        if      (el.id === flyingCarrierId) drawData = { ...drawData, hasBall: false }
        else if (el.id === ballReceiverId)  drawData = { ...drawData, hasBall: stepT >= 0.85 }
        else                                drawData = { ...drawData, hasBall: false }
      } else {
        drawData = { ...drawData, hasBall: el.id === baseCarrierId }
      }
    }
    drawEl(ctx, drawData, false)
  }

  // Shot ring (expands + fades at basket)
  if (isShotAnim && et > 0.65) {
    const shotEl = elems.find(el => el.type === 'shot' && (el.step ?? 0) === animStepIdx)
    if (shotEl) {
      const rp = (et - 0.65) / 0.35
      ctx.save()
      ctx.globalAlpha = Math.sin(rp * Math.PI) * 0.9
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(shotEl.x2, shotEl.y2, 10 + rp * 18, 0, Math.PI * 2); ctx.stroke()
      if (rp > 0.4) {
        ctx.globalAlpha = (1 - rp) * 0.6
        ctx.beginPath(); ctx.arc(shotEl.x2, shotEl.y2, 5 + rp * 8, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.restore()
    }
  }

  // Flying ball (variable radius for shot)
  if (ballAnimX !== null && ballAnimR > 0) {
    const bR = ballAnimR
    ctx.save()
    ctx.fillStyle = '#f97316'
    ctx.beginPath(); ctx.arc(ballAnimX, ballAnimY, bR, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(ballAnimX, ballAnimY, bR, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.9
    ctx.beginPath(); ctx.moveTo(ballAnimX - bR, ballAnimY); ctx.lineTo(ballAnimX + bR, ballAnimY); ctx.stroke()
    ctx.beginPath(); ctx.arc(ballAnimX, ballAnimY, bR * 0.6, 0, Math.PI); ctx.stroke()
    ctx.restore()
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
    renderPhaseFrame(ctx, CW, CH, courtType, elements, 0, 0, true, null, 0)
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

/* ── Type constants (module-level so renderPhaseFrame can use them) ── */
const ARROW_TYPES        = ['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES       = ['offense','defense','xdefense']
const BALL_TRANSFER_TYPES = ['pass']             // handoff is a swap — handled separately
// Only these arrow types physically move the player to the endpoint
const MOVE_ARROW_TYPES   = ['dribble','cut','screen']

/* ── Sequential-step constants ───────────────────── */
const STEP_COLORS   = ['#3b82f6','#a855f7','#ec4899','#f59e0b','#10b981','#ef4444']
const STEP_MOVE_DUR = 1000   // ms: players move within one step
const STEP_HOLD_DUR = 300    // ms: hold after players reach target
const STEP_DUR      = STEP_MOVE_DUR + STEP_HOLD_DUR
const PHASE_HOLD    = 500    // ms: pause between phases

/* Returns how many action-steps exist in the element array (≥1) */
function getNumSteps(elems) {
  let max = -1
  for (const el of elems) {
    if (ARROW_TYPES.includes(el.type)) {
      const s = el.step ?? 0
      if (s > max) max = s
    }
  }
  return Math.max(1, max + 1)
}

/*
 * computeSmartDefPos — basketball-aware defensive positioning
 *
 * Returns the ideal position for a defender matched to `attPos`:
 *   • Ball carrier  → tight on-ball: 1 step between attacker and basket
 *   • 1 pass away   → denial: slightly toward ball and basket
 *   • Weak side     → help: float toward paint proportional to ball distance
 */
function computeSmartDefPos(attPos, ballPos, courtType, courtH) {
  const mg    = 22
  const halfH = courtType === 'full' ? Math.round(courtH / 2) : courtH
  const sy    = (halfH - 2 * mg) / 14
  const rimY  = mg + 1.575 * sy
  const ftY   = mg + 5.8   * sy

  // Pick basket: full court → use attacker's half; half court → always top
  const useBottom = courtType === 'full' && attPos.y > courtH / 2
  const basketX = CW / 2
  const basketY = useBottom ? courtH - rimY : rimY
  const paintY  = useBottom ? courtH - (rimY + ftY) / 2 : (rimY + ftY) / 2

  // Direction attacker → basket
  const dxB = basketX - attPos.x, dyB = basketY - attPos.y
  const distB = Math.hypot(dxB, dyB) || 1
  // Stay 1 defensive step toward basket (shrinks near basket to avoid going behind it)
  const OFFSET = Math.min(46, distB * 0.32)
  const primX = attPos.x + (dxB / distB) * OFFSET
  const primY = attPos.y + (dyB / distB) * OFFSET

  if (!ballPos) return { x: primX, y: primY }

  const distBall = Math.hypot(ballPos.x - attPos.x, ballPos.y - attPos.y)

  // On-ball (≤ 55 px) → tight defense, no sag
  if (distBall < 55) return { x: primX, y: primY }

  // Off-ball sag: drift toward paint, proportional to distance from ball
  // max sag of 60% at ~305 px away
  const sag = Math.min(0.60, (distBall - 55) / 305)

  // Help target: maintain goal-side while drifting toward paint center
  const helpX = attPos.x + (basketX - attPos.x) * 0.35
  const helpY = attPos.y + (paintY   - attPos.y) * 0.48

  return {
    x: primX + (helpX - primX) * sag,
    y: primY + (helpY - primY) * sag,
  }
}

/*
 * accumulateSteps(elems, throughStep)
 * Returns { playerPos: {id→{x,y}}, carrierId }
 * representing the state of the court AFTER steps 0 … throughStep-1 have played out.
 */
function accumulateSteps(elems, throughStep, courtH = FULL_H, courtType = 'half') {
  const clampX = v => Math.max(PR + 4, Math.min(CW - PR - 4, v))
  const clampY = v => Math.max(PR + 4, Math.min(courtH - PR - 4, v))

  // Initialise positions from element data
  const playerPos = {}
  for (const el of elems) {
    if (!ARROW_TYPES.includes(el.type)) playerPos[el.id] = { x: el.x, y: el.y }
  }
  // Find initial ball carrier
  let carrierId = null
  for (const el of elems) {
    if (PLAYER_TYPES.includes(el.type) && el.hasBall) { carrierId = el.id; break }
  }

  for (let s = 0; s < throughStep; s++) {
    // Displacement map for movement arrows in this step
    const stepMoves = {}
    for (const el of elems) {
      if (!MOVE_ARROW_TYPES.includes(el.type)) continue
      if ((el.step ?? 0) !== s) continue
      // Resolve player: prefer fromId, fallback to nearest by arrow start position
      let pid = el.fromId && playerPos[el.fromId] ? el.fromId : null
      if (!pid) {
        let bestD = PR * 3, bestId = null
        for (const pe of elems) {
          if (!PLAYER_TYPES.includes(pe.type)) continue
          const pp = playerPos[pe.id]; if (!pp) continue
          const d = Math.hypot(pp.x - el.x1, pp.y - el.y1)
          if (d < bestD) { bestD = d; bestId = pe.id }
        }
        pid = bestId
      }
      if (!pid || !playerPos[pid]) continue
      const base = playerPos[pid]
      stepMoves[pid] = { dx: el.x2 - base.x, dy: el.y2 - base.y }
      playerPos[pid] = { x: el.x2, y: el.y2 }
    }

    // Handoff: swap positions of p1 ↔ p2 + add to stepMoves so defenders follow
    for (const el of elems) {
      if (el.type !== 'handoff') continue
      if ((el.step ?? 0) !== s) continue
      let p1id = el.fromId && playerPos[el.fromId] ? el.fromId : null
      if (!p1id) {
        let bestD = PR * 3, bestId = null
        for (const pe of elems) {
          if (!PLAYER_TYPES.includes(pe.type)) continue
          const pp = playerPos[pe.id]; if (!pp) continue
          const d = Math.hypot(pp.x - el.x1, pp.y - el.y1)
          if (d < bestD) { bestD = d; bestId = pe.id }
        }
        p1id = bestId
      }
      if (!p1id) continue
      let p2id = null, bestD2 = PR * 3
      for (const pe of elems) {
        if (!PLAYER_TYPES.includes(pe.type) || pe.id === p1id) continue
        const pp = playerPos[pe.id]; if (!pp) continue
        const d = Math.hypot(pp.x - el.x2, pp.y - el.y2)
        if (d < bestD2) { bestD2 = d; p2id = pe.id }
      }
      if (!p2id) continue
      const pos1 = { ...playerPos[p1id] }, pos2 = { ...playerPos[p2id] }
      stepMoves[p1id] = { dx: pos2.x - pos1.x, dy: pos2.y - pos1.y }
      stepMoves[p2id] = { dx: pos1.x - pos2.x, dy: pos1.y - pos2.y }
      playerPos[p1id] = { x: pos2.x, y: pos2.y }
      playerPos[p2id] = { x: pos1.x, y: pos1.y }
      if (carrierId === p1id) carrierId = p2id
    }

    // Ball transfer (pass only — handoff handled above)
    // Resolve BEFORE smart defense so defenders know who has the ball
    if (carrierId) {
      const arr = elems.find(e =>
        e.type === 'pass' && (e.step ?? 0) === s && e.fromId === carrierId
      )
      if (arr) {
        let bestDist = PR + 30, bestId = null
        for (const el of elems) {
          if (!PLAYER_TYPES.includes(el.type) || el.id === carrierId) continue
          const p = playerPos[el.id] || { x: el.x, y: el.y }
          const d = Math.hypot(p.x - arr.x2, p.y - arr.y2)
          if (d < bestDist) { bestDist = d; bestId = el.id }
        }
        if (bestId) carrierId = bestId
      }
    }

    // Smart auto-follow: position defenders using basketball principles
    const ballPos = carrierId ? playerPos[carrierId] : null
    for (const el of elems) {
      if (!['defense','xdefense'].includes(el.type) || !el.num) continue
      const hasManual = elems.some(e =>
        (MOVE_ARROW_TYPES.includes(e.type) || e.type === 'handoff') && (e.step ?? 0) === s && e.fromId === el.id
      )
      if (hasManual || !playerPos[el.id]) continue
      const att = elems.find(e => e.type === 'offense' && e.num === el.num)
      if (!att || !playerPos[att.id]) continue
      // Only reposition if something moved this step (attacker or ball)
      const attMoved = !!stepMoves[att.id]
      const ballMoved = carrierId && !!stepMoves[carrierId]
      const ballPassed = elems.some(e => e.type === 'pass' && (e.step ?? 0) === s)
      if (!attMoved && !ballMoved && !ballPassed) continue
      const ideal = computeSmartDefPos(playerPos[att.id], ballPos, courtType, courtH)
      playerPos[el.id] = { x: clampX(ideal.x), y: clampY(ideal.y) }
    }
  }

  return { playerPos, carrierId }
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */

export default function CourtEditor({ initialData, onSave, onClose, readOnly = false, onDuplicate = null, duplicating = false, readOnlyLabel = null, notesPanel = false }) {
  const canvasRef   = useRef(null)
  // Animation loop refs (never trigger re-render)
  const animLoopRef    = useRef(null)
  const animRunningRef = useRef(false)
  const elapsedRef      = useRef(0)   // ms transcurridos en la animación actual
  const pausedElapsedRef = useRef(0)  // punto (ms) desde el que reanudar al pulsar play
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
  const [paused,     setPaused]      = useState(false)  // animación parada a mitad, lista para continuar
  const [animPh,     setAnimPh]      = useState(0)      // display-only indicator
  const [recording,  setRecording]   = useState(false)
  const [offNum,     setOffNum]      = useState(1)
  const [defNum,     setDefNum]      = useState(1)
  const [textModal,  setTextModal]   = useState(null)
  const [textVal,    setTextVal]     = useState('')
  const [courtType,  setCourtType]   = useState(initialData?.courtType||'half')
  const [draggingCP, setDraggingCP]  = useState(null)  // { id, ox, oy }
  const [hoverCP,    setHoverCP]     = useState(false)
  const [draggingEP, setDraggingEP]  = useState(null)  // { id, which:'start'|'end' }
  const [hoverEP,    setHoverEP]     = useState(false)
  const [drawStep,   setDrawStep]    = useState(0)     // which action-step new arrows go to
  const drawStepRef  = useRef(0)

  const CH = getCanvasH(courtType)
  const els = phases[cur]?.elements || []
  const isArrowTool = ARROW_TYPES.includes(tool)

  // Keep refs in sync with state
  useEffect(() => { phasesRef.current    = phases     }, [phases])
  useEffect(() => { courtTypeRef.current = courtType  }, [courtType])
  useEffect(() => { selIdRef.current     = selId      }, [selId])
  useEffect(() => { drawStepRef.current  = drawStep   }, [drawStep])
  // Reset to step 0 when user switches to a different phase
  useEffect(() => { setDrawStep(0) }, [cur])

  /* ── Editor render ─────────────────────────────────── */
  const render = useCallback(() => {
    if (animRunningRef.current) return      // animation loop owns the canvas
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const elems = phasesRef.current?.[cur]?.elements || []
    renderPhaseFrame(ctx, CW, CH, courtTypeRef.current, elems, 0, 0, true, selIdRef.current, drawStepRef.current)
    // Arrow preview
    if (aSt && aCur && isArrowTool) {
      ctx.save(); ctx.globalAlpha=0.55
      drawArrowLine(ctx, tool, aSt.x, aSt.y, aCur.x, aCur.y)
      ctx.restore()
    }
    // Arrow endpoint handles (start = green square, end = red square)
    for (const el of elems) {
      if (!ARROW_TYPES.includes(el.type)) continue
      ;[[el.x1, el.y1, 'start'], [el.x2, el.y2, 'end']].forEach(([x, y, which]) => {
        const active = draggingEP?.id === el.id && draggingEP?.which === which
        const sz = 5
        ctx.save()
        ctx.fillStyle   = active ? '#3b82f6' : which === 'start' ? '#10b981' : '#ef4444'
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
        ctx.fillRect(x - sz, y - sz, sz*2, sz*2)
        ctx.strokeRect(x - sz, y - sz, sz*2, sz*2)
        ctx.restore()
      })
    }
  }, [phases, cur, selId, aSt, aCur, tool, isArrowTool, courtType, CH, drawStep, draggingEP])

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
    const accPos = accumulateSteps(phases[cur]?.elements || [], drawStepRef.current, CH, courtType).playerPos
    const r = [...(phases[cur]?.elements||[])].reverse()
    for (const el of r) {
      if (ARROW_TYPES.includes(el.type)) continue
      const p = accPos[el.id] || el
      if (Math.hypot(x-p.x, y-p.y) < PR+6) return { ...el, x: p.x, y: p.y }
    }
    return null
  }
  function findArrowCPHit(x, y) {
    for (const el of [...(phases[cur]?.elements||[])].reverse()) {
      if (!ARROW_TYPES.includes(el.type)) continue
      const cpx = el.cx ?? (el.x1+el.x2)/2
      const cpy = el.cy ?? (el.y1+el.y2)/2
      if (Math.hypot(x-cpx, y-cpy) < 13) return { id:el.id, cpx, cpy }
    }
    return null
  }
  function findArrowEPHit(x, y) {
    const HIT = 9
    for (const el of [...(phases[cur]?.elements||[])].reverse()) {
      if (!ARROW_TYPES.includes(el.type)) continue
      if (Math.hypot(x-el.x1, y-el.y1) < HIT) return { id:el.id, which:'start' }
      if (Math.hypot(x-el.x2, y-el.y2) < HIT) return { id:el.id, which:'end'   }
    }
    return null
  }
  function undoLastArrow() {
    setPhases(prev => prev.map((ph, i) => {
      if (i !== cur) return ph
      const els = ph.elements
      for (let j = els.length - 1; j >= 0; j--) {
        if (ARROW_TYPES.includes(els[j].type))
          return { ...ph, elements: els.filter((_, k) => k !== j) }
      }
      return ph
    }))
    setSelId(null)
  }
  function nearestPlayer(x, y) {
    const accPos = accumulateSteps(phases[cur]?.elements || [], drawStepRef.current, CH, courtType).playerPos
    for (const el of [...(phases[cur]?.elements||[])].reverse()) {
      if (!PLAYER_TYPES.includes(el.type)) continue
      const p = accPos[el.id] || el
      if (Math.hypot(x-p.x, y-p.y) < PR+10) return { ...el, x: p.x, y: p.y }
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

    // ── EP and CP handles always take priority ──
    const epHit = findArrowEPHit(p.x, p.y)
    if (epHit) { setDraggingEP(epHit); setSelId(null); return }

    const cpHit = findArrowCPHit(p.x, p.y)
    if (cpHit) {
      setDraggingCP({ id:cpHit.id, ox:p.x-cpHit.cpx, oy:p.y-cpHit.cpy })
      setSelId(null)
      return
    }

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
    if (tool === 'giveball') {
      // Transfer ball to clicked player, remove from all others
      const hit = hitTest(p.x, p.y)
      if (hit && PLAYER_TYPES.includes(hit.type)) {
        setPhases(prev => prev.map((ph,i) => i!==cur ? ph : {
          ...ph,
          elements: ph.elements.map(e =>
            PLAYER_TYPES.includes(e.type) ? {...e, hasBall: e.id===hit.id} : e
          )
        }))
      }
      return
    }
    if (tool === 'offense')  { addEl({type:'offense',  x:p.x,y:p.y,num:offNum});setOffNum(n=>n>=5?1:n+1); return }
    if (tool === 'defense')  { addEl({type:'defense',  x:p.x,y:p.y,num:defNum}); setDefNum(n=>n>=5?1:n+1); return }
    if (tool === 'xdefense') { addEl({type:'xdefense', x:p.x,y:p.y,num:defNum}); setDefNum(n=>n>=5?1:n+1); return }
    if (tool === 'ball')  { addEl({type:'ball',  x:p.x,y:p.y}); return }
    if (tool === 'cone')  { addEl({type:'cone',  x:p.x,y:p.y}); return }
    if (tool === 'text')  { setTextModal(p); setTextVal(''); return }
  }
  function onMove(e) {
    if (animating) return
    const p = pos(e)
    if (draggingEP) {
      if (draggingEP.which === 'start') updEl(draggingEP.id, { x1:p.x, y1:p.y })
      else                              updEl(draggingEP.id, { x2:p.x, y2:p.y })
      return
    }
    if (draggingCP) { updEl(draggingCP.id, { cx:p.x-draggingCP.ox, cy:p.y-draggingCP.oy }); return }
    if (dragging)   { updEl(dragging.id, {x:p.x-dragging.ox, y:p.y-dragging.oy}); return }
    if (aSt) { setACur(p); return }
    // Update hover indicators
    const hasEP = !!findArrowEPHit(p.x, p.y)
    setHoverEP(hasEP)
    if (!hasEP) setHoverCP(!!findArrowCPHit(p.x, p.y))
    else setHoverCP(false)
  }
  function onUp(e) {
    if (animating) return
    if (draggingEP) {
      if (draggingEP.which === 'start') {
        const p = pos(e)
        const near = nearestPlayer(p.x, p.y)
        if (near) updEl(draggingEP.id, { x1:near.x, y1:near.y, fromId:near.id })
        else      updEl(draggingEP.id, { fromId:null })
      }
      setDraggingEP(null); return
    }
    if (draggingCP) { setDraggingCP(null); return }
    if (dragging)   { setDragging(null); return }
    if (aSt) {
      const p = pos(e)
      if (Math.hypot(p.x-aSt.x, p.y-aSt.y) > 20) {
        addEl({
          type:tool, x1:aSt.x,y1:aSt.y, x2:p.x,y2:p.y,
          x:(aSt.x+p.x)/2, y:(aSt.y+p.y)/2,
          fromId: aSt.fromId || null,
          step: drawStep,
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

  // "→ Avanzar fase" → run ALL steps in sequence, move players to their
  //                    final positions, strip all arrows, transfer ball correctly
  function advancePhase() {
    const currentElems = phases[cur].elements
    const numSteps = getNumSteps(currentElems)
    const { playerPos, carrierId: newCarrierId } = accumulateSteps(currentElems, numSteps, getCanvasH(courtType), courtType)

    const newElems = currentElems
      .filter(el => !ARROW_TYPES.includes(el.type))
      .map(el => {
        const pos = playerPos[el.id]
        const moved = pos ? { ...el, x: pos.x, y: pos.y } : { ...el }
        if (PLAYER_TYPES.includes(el.type)) return { ...moved, hasBall: el.id === newCarrierId }
        return moved
      })

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
  // stopAnimate: parada COMPLETA — resetea el progreso (fin natural de la secuencia)
  function stopAnimate() {
    if (animLoopRef.current) { cancelAnimationFrame(animLoopRef.current); clearTimeout(animLoopRef.current) }
    animRunningRef.current = false
    setAnimating(false)
    setPaused(false)
    elapsedRef.current = 0
    pausedElapsedRef.current = 0
    // Re-render editor view
    setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d')
      const elems = phasesRef.current?.[cur]?.elements || []
      renderPhaseFrame(ctx, CW, getCanvasH(courtTypeRef.current), courtTypeRef.current, elems, 0, 0, true, selIdRef.current, drawStepRef.current)
    }, 0)
  }

  // pauseAnimate: para el bucle pero deja el fotograma actual congelado en pantalla,
  // guardando el punto exacto (ms) para que el siguiente play continúe desde ahí
  function pauseAnimate() {
    if (animLoopRef.current) cancelAnimationFrame(animLoopRef.current)
    animRunningRef.current = false
    setAnimating(false)
    setPaused(true)
    pausedElapsedRef.current = elapsedRef.current
  }

  function startAnimate() {
    if (animRunningRef.current) { pauseAnimate(); return }

    animRunningRef.current = true
    setAnimating(true)
    setPaused(false)

    const phases   = phasesRef.current
    const nPhases  = phases.length

    // Pre-compute per-phase step counts + cumulative start times
    const phaseMeta = phases.map(ph => {
      const numSteps = getNumSteps(ph.elements)
      return { numSteps, phaseDur: numSteps * STEP_DUR + PHASE_HOLD }
    })
    const phaseStarts = [0]
    for (let i = 0; i < nPhases; i++) phaseStarts.push(phaseStarts[i] + phaseMeta[i].phaseDur)
    const totalDur = phaseStarts[nPhases]

    // Reanuda desde donde se pausó (0 si es un play desde el principio)
    const startTs = performance.now() - pausedElapsedRef.current

    function frame(ts) {
      if (!animRunningRef.current) return
      const elapsed = ts - startTs
      elapsedRef.current = elapsed

      if (elapsed >= totalDur) {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          const W = CW, H = getCanvasH(courtTypeRef.current)
          const lastPh   = phasesRef.current[nPhases - 1]
          const lastStep = phaseMeta[nPhases - 1].numSteps - 1
          renderPhaseFrame(ctx, W, H, courtTypeRef.current, lastPh.elements, lastStep, 1, false, null, 0)
        }
        animLoopRef.current = setTimeout(() => stopAnimate(), 800)
        return
      }

      // Locate current phase
      let phaseIdx = nPhases - 1
      for (let i = 0; i < nPhases; i++) {
        if (elapsed < phaseStarts[i + 1]) { phaseIdx = i; break }
      }

      const phaseElapsed = elapsed - phaseStarts[phaseIdx]
      const { numSteps } = phaseMeta[phaseIdx]
      const stepIdx    = Math.min(Math.floor(phaseElapsed / STEP_DUR), numSteps - 1)
      const stepT      = Math.min((phaseElapsed - stepIdx * STEP_DUR) / STEP_MOVE_DUR, 1)

      setAnimPh(phaseIdx)

      const canvas = canvasRef.current
      if (!canvas) { stopAnimate(); return }
      const ctx = canvas.getContext('2d')
      const W = CW, H = getCanvasH(courtTypeRef.current)
      const elems = phasesRef.current[phaseIdx]?.elements || []
      renderPhaseFrame(ctx, W, H, courtTypeRef.current, elems, stepIdx, stepT, false, null, 0)

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
    // Run full animation once while recording (same timing as startAnimate)
    const phases   = phasesRef.current
    const nPhases  = phases.length
    const phaseMeta = phases.map(ph => {
      const numSteps = getNumSteps(ph.elements)
      return { numSteps, phaseDur: numSteps * STEP_DUR + PHASE_HOLD }
    })
    const phaseStarts = [0]
    for (let i = 0; i < nPhases; i++) phaseStarts.push(phaseStarts[i] + phaseMeta[i].phaseDur)
    const totalDur = phaseStarts[nPhases] + 800

    await new Promise(resolve => {
      const startTs = performance.now()
      function frame(ts) {
        const elapsed = ts - startTs
        if (elapsed >= totalDur) { resolve(); return }
        let phaseIdx = nPhases - 1
        for (let i = 0; i < nPhases; i++) {
          if (elapsed < phaseStarts[i + 1]) { phaseIdx = i; break }
        }
        const phaseElapsed = elapsed - phaseStarts[phaseIdx]
        const { numSteps } = phaseMeta[phaseIdx]
        const stepIdx = Math.min(Math.floor(phaseElapsed / STEP_DUR), numSteps - 1)
        const stepT   = Math.min((phaseElapsed - stepIdx * STEP_DUR) / STEP_MOVE_DUR, 1)
        const ctx = canvas.getContext('2d')
        const W = CW, H = getCanvasH(courtTypeRef.current)
        const elems = phasesRef.current[phaseIdx]?.elements || []
        renderPhaseFrame(ctx, W, H, courtTypeRef.current, elems, stepIdx, stepT, false, null, 0)
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
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undoLastArrow() }
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
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#111827',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden',
      paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)',
      paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)'}}>

      <style>{`
        @keyframes ceRotateHint{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-90deg)}}
        .ce-rotate-overlay{display:none}
        @media (orientation:portrait) and (pointer:coarse){
          .ce-rotate-overlay{display:flex!important}
        }
        @media print{
          .ce-rotate-overlay{display:none!important}
        }
      `}</style>

      {/* ── BLOQUEO DE ORIENTACIÓN (móvil/tablet en vertical) ── */}
      <div className="ce-rotate-overlay" style={{
        position:'fixed', inset:0, zIndex:9999, backgroundColor:'#111827',
        flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, padding:24, textAlign:'center',
      }}>
        <div style={{ animation:'ceRotateHint 1.6s ease-in-out infinite' }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.6">
            <rect x="7" y="2" width="10" height="16" rx="2"/>
            <line x1="10" y1="15.6" x2="14" y2="15.6" strokeWidth="1.2"/>
          </svg>
        </div>
        <div style={{ fontSize:16, fontWeight:900, color:'#e5e7eb' }}>Gira tu dispositivo</div>
        <div style={{ fontSize:12, color:'#9ca3af', maxWidth:260, lineHeight:1.5 }}>
          El editor de tácticas está diseñado para usarse en horizontal. Gira el móvil o la tablet para continuar.
        </div>
      </div>

      {/* ── TOP BAR ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:'#1f2937',borderBottom:'1px solid #374151',flexShrink:0,overflowX:'auto'}}>
        {onClose && (
          <button onClick={onClose} style={{background:'#374151',border:'none',borderRadius:8,color:'#e5e7eb',padding:'7px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            ✕ Cerrar
          </button>
        )}
        <div style={{display:'flex',background:'#111827',borderRadius:8,padding:3,gap:1}}>
          {tabBtn('draw',    '✏️ Dibujar')}
          {tabBtn('animate', '▶ Animar')}
          {tabBtn('3d',      '🎬 3D')}
          {!notesPanel && tabBtn('notes', '📝 Notas')}
          {tabBtn('output',  '📤 Exportar')}
        </div>
        {readOnly && readOnlyLabel && (
          <span style={{background:'#3b1f6b',color:'#c4b5fd',padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
            {readOnlyLabel}
          </span>
        )}
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Sin título..." readOnly={readOnly}
          style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:15,fontWeight:700,textAlign:'center'}} />
        <div style={{display:'flex',background:'#111827',borderRadius:8,padding:3,gap:1}}>
          {[['half','½ Pista'],['full','Pista Completa']].map(([ct,label])=>(
            <button key={ct} onClick={()=>setCourtType(ct)} style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:courtType===ct?'#fff':'transparent',color:courtType===ct?'#111827':'#9ca3af',transition:'all 0.15s'}}>{label}</button>
          ))}
        </div>
        {!readOnly && (
          <button onClick={handleSave} style={{background:'#16a34a',border:'none',borderRadius:8,color:'#fff',padding:'8px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            💾 Guardar
          </button>
        )}
        {readOnly && onDuplicate && (
          <button onClick={onDuplicate} disabled={duplicating} style={{background:'#7c3aed',border:'none',borderRadius:8,color:'#fff',padding:'8px 20px',fontSize:13,fontWeight:700,cursor:'pointer',opacity:duplicating?0.6:1}}>
            {duplicating ? '⏳ Duplicando...' : '📋 Duplicar a mi equipo'}
          </button>
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── LEFT: PHASES ── */}
        <div style={{width:158,background:'#1f2937',borderRight:'1px solid #374151',display:tab==='3d'?'none':'flex',flexDirection:'column',padding:'10px 8px',gap:6,overflowY:'auto',flexShrink:0}}>
          <div style={{color:'#6b7280',fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',paddingLeft:2}}>Fases</div>

          {phases.map((ph,i) => (
            <PhaseThumb key={ph.id} index={i} elements={ph.elements} active={i===cur} courtType={courtType}
              onClick={()=>{ if(!animating){setCur(i);setSelId(null)} }} />
          ))}

          {/* Phase action buttons */}
          {!readOnly && (<>
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
          </>)}
        </div>

        {/* ── CENTER: CANVAS ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:tab==='3d'?'stretch':'center',justifyContent:tab==='3d'?'flex-start':'center',background:'#0f172a',padding:tab==='3d'?0:12,gap:10,overflowY:tab==='3d'?'hidden':'auto',overflowX:'hidden',minHeight:0}}>

          {/* 3D VIEW */}
          {tab==='3d' && (
            <div style={{flex:1,width:'100%',position:'relative',minHeight:0}}>
              <Court3DErrorBoundary>
                <Court3DView phases={phases} courtType={courtType} />
              </Court3DErrorBoundary>
            </div>
          )}

          {/* Phase indicator + action-step controls (draw mode) */}
          {tab==='draw' && !animating && (
            <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap',justifyContent:'center'}}>
              {/* Phase navigation */}
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>cur>0&&setCur(cur-1)} disabled={cur===0}
                  style={{padding:'4px 10px',borderRadius:6,border:'1px solid #374151',background:cur===0?'transparent':'#1f2937',color:cur===0?'#374151':'#9ca3af',cursor:cur===0?'default':'pointer',fontSize:12}}>‹</button>
                <span style={{color:'#6b7280',fontSize:12,fontWeight:600,minWidth:80,textAlign:'center'}}>
                  Fase {cur+1} / {phases.length}
                </span>
                <button onClick={()=>cur<phases.length-1&&setCur(cur+1)} disabled={cur===phases.length-1}
                  style={{padding:'4px 10px',borderRadius:6,border:'1px solid #374151',background:cur===phases.length-1?'transparent':'#1f2937',color:cur===phases.length-1?'#374151':'#9ca3af',cursor:cur===phases.length-1?'default':'pointer',fontSize:12}}>›</button>
              </div>

              {!readOnly && (<>
              {/* Separator */}
              <div style={{width:1,height:22,background:'#374151'}} />

              {/* Action-step controls */}
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {drawStep > 0 && (
                  <button onClick={()=>setDrawStep(s=>s-1)}
                    style={{padding:'4px 9px',borderRadius:6,border:'1px solid #374151',background:'#1f2937',color:'#9ca3af',cursor:'pointer',fontSize:12}}>
                    ← Acción anterior
                  </button>
                )}
                <span style={{
                  padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:700,
                  background: STEP_COLORS[drawStep % STEP_COLORS.length] + '22',
                  border:`1px solid ${STEP_COLORS[drawStep % STEP_COLORS.length]}`,
                  color: STEP_COLORS[drawStep % STEP_COLORS.length],
                  minWidth:76,textAlign:'center',
                }}>
                  Acción {drawStep+1}
                </span>
                <button onClick={()=>setDrawStep(s=>s+1)}
                  style={{
                    padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                    background: STEP_COLORS[(drawStep+1) % STEP_COLORS.length],
                    color:'#fff',
                  }}>
                  + Acción {drawStep+2}
                </button>
              </div>

              {/* Separator */}
              <div style={{width:1,height:22,background:'#374151'}} />

              {/* Undo last arrow */}
              <button onClick={undoLastArrow} title="Deshacer última flecha (Ctrl+Z)"
                style={{padding:'4px 10px',borderRadius:6,border:'1px solid #374151',background:'#1f2937',color:'#9ca3af',cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                ↩ Deshacer
              </button>
              </>)}
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={CW} height={CH}
            style={{
              maxWidth:'100%', maxHeight:'calc(100vh - 200px)',
              objectFit:'contain', borderRadius:12,
              boxShadow:'0 8px 40px rgba(0,0,0,0.5)',
              cursor: (hoverEP||draggingEP) ? 'move'
                : (hoverCP||draggingCP) ? 'grab'
                : tool==='select'  ? 'default'
                : tool==='erase'   ? 'cell'
                : tool==='giveball'? 'copy'
                : 'crosshair',
              touchAction:'none',
              display:(tab==='notes'||tab==='output'||tab==='3d')?'none':'block',
              pointerEvents:(readOnly||tab==='animate')?'none':'auto',
            }}
            onDoubleClick={e => {
              if (tool!=='select') return
              const p = pos(e)
              const cpHit = findArrowCPHit(p.x, p.y)
              if (cpHit) updEl(cpHit.id, { cx: undefined, cy: undefined })
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
                  {animating ? '⏸ Pausar' : paused ? '▶ Continuar' : '▶ Animar jugada completa'}
                </button>
              </div>
              {animating
                ? <span style={{color:'#9ca3af',fontSize:13}}>Fase {animPh+1} / {phases.length} — Los jugadores se están moviendo…</span>
                : paused
                ? <span style={{color:'#f59e0b',fontSize:13}}>⏸ Pausado en fase {animPh+1} / {phases.length}</span>
                : <span style={{color:'#6b7280',fontSize:12}}>
                    {phases.length} fase{phases.length!==1?'s':''} ·{' '}
                    {phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements),0)} acción{phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements),0)!==1?'es':''} ·{' '}
                    ~{(phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements)*STEP_DUR+PHASE_HOLD,0)/1000).toFixed(1)}s
                  </span>
              }
              {!animating && (
                <div style={{color:'#4b5563',fontSize:11,textAlign:'center',maxWidth:380}}>
                  💡 Dibuja acciones en orden. Usa <strong style={{color:'#6b7280'}}>+ Acción</strong> sobre el canvas para añadir pasos dentro de una misma fase. Usa <strong style={{color:'#6b7280'}}>➡ Avanzar fase</strong> para crear la siguiente fase.
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab==='notes' && (
            <div style={{width:'100%',maxWidth:580}}>
              <div style={{color:'#9ca3af',fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>Notas de la jugada</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={14} readOnly={readOnly}
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
                {phases.length} fase{phases.length!==1?'s':''} · duración estimada ~{(phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements)*STEP_DUR+PHASE_HOLD,0)/1000).toFixed(1)}s
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

        {/* ── RIGHT: TOOLS (solo en tab draw, oculto en solo lectura) ── */}
        {tab==='draw' && !readOnly && (
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

              {/* ASSIGN BALL — always visible, prominent */}
              <button onClick={()=>setTool('giveball')} style={{
                width:'100%', padding:'9px 8px', marginBottom:10, borderRadius:9,
                border:`2px solid ${tool==='giveball'?'#f97316':'#374151'}`,
                background: tool==='giveball'
                  ? 'linear-gradient(135deg,rgba(249,115,22,0.25),rgba(249,115,22,0.12))'
                  : '#111827',
                color: tool==='giveball'?'#fb923c':'#9ca3af',
                fontWeight:700, fontSize:12, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                transition:'all 0.15s',
              }}>
                <span style={{fontSize:15}}>🏀</span>
                {tool==='giveball'
                  ? <span>Clic en el jugador con balón</span>
                  : <span>Asignar balón a jugador</span>
                }
              </button>

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
                {selIsPlayer && selEl.hasBall && (
                  <div style={{padding:'6px 8px',borderRadius:7,background:'rgba(249,115,22,0.15)',color:'#fb923c',fontSize:11,fontWeight:700,textAlign:'center'}}>
                    🏀 Este jugador tiene el balón
                  </div>
                )}
                <button onClick={()=>{delEl(selId);setSelId(null)}} style={{padding:'7px',borderRadius:8,border:'1px solid #7f1d1d',background:'transparent',color:'#ef4444',fontWeight:600,fontSize:12,cursor:'pointer'}}>
                  🗑 Eliminar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RIGHT: NOTAS PERSISTENTES (solo cuando notesPanel, visible en Dibujar y Animar) ── */}
        {notesPanel && (tab==='draw' || tab==='animate') && (
          <div style={{width:250,background:'#1f2937',borderLeft:'1px solid #374151',padding:'14px 12px',overflowY:'auto',flexShrink:0,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{color:'#9ca3af',fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>📝 Explicación del concepto</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} readOnly={readOnly}
              placeholder="Describe el concepto: cuándo usarlo, claves, variantes..."
              style={{flex:1,minHeight:300,width:'100%',background:'#111827',border:'1px solid #374151',borderRadius:10,color:'#e5e7eb',fontSize:13,padding:'12px',resize:'vertical',outline:'none',fontFamily:'inherit',lineHeight:1.6,boxSizing:'border-box'}}
            />
          </div>
        )}
      </div>

      {/* ── TEXT MODAL ── */}
      {textModal && (
        <ModalPortal>
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
        </ModalPortal>
      )}
    </div>
  )
}
