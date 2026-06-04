'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

/* ── mirror constants from CourtEditor ─────────────────────── */
const CW = 560, HALF_H = 520, FULL_H = 970, PR = 20
const ARROW_TYPES      = ['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES     = ['offense','defense','xdefense']
const MOVE_ARROW_TYPES = ['dribble','cut','screen']
const STEP_MOVE_DUR = 1000, STEP_HOLD_DUR = 300
const STEP_DUR = STEP_MOVE_DUR + STEP_HOLD_DUR, PHASE_HOLD = 500
const S = 15 / CW   // metres per 2D pixel (~0.0268)

function getH(ct) { return ct === 'full' ? FULL_H : HALF_H }
function ease(t)  { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }
function lerp(a,b,t) { return a + (b-a)*t }

/* 2D pixel → 3D world (court on XZ plane, Y = up) */
function p3(px, py) { return { x:(px - CW/2)*S, z:py*S } }

/* ── duplicated logic (accumulateSteps + smart defense) ──────── */
function getNumSteps(elems) {
  let max = -1
  for (const e of elems) if (ARROW_TYPES.includes(e.type)) max = Math.max(max, e.step ?? 0)
  return Math.max(1, max + 1)
}

function computeSmartDefPos(attPos, ballPos, courtType, courtH) {
  const mg = 22, halfH = courtType === 'full' ? Math.round(courtH/2) : courtH
  const sy = (halfH - 2*mg)/14
  const rimY = mg + 1.575*sy, ftY = mg + 5.8*sy
  const useBot = courtType === 'full' && attPos.y > courtH/2
  const basketY = useBot ? courtH - rimY : rimY
  const paintY  = useBot ? courtH - (rimY+ftY)/2 : (rimY+ftY)/2
  const dxB = CW/2 - attPos.x, dyB = basketY - attPos.y
  const distB = Math.hypot(dxB,dyB)||1
  const OFFSET = Math.min(46, distB*0.32)
  const primX = attPos.x + (dxB/distB)*OFFSET
  const primY = attPos.y + (dyB/distB)*OFFSET
  if (!ballPos) return { x:primX, y:primY }
  const distBall = Math.hypot(ballPos.x - attPos.x, ballPos.y - attPos.y)
  if (distBall < 55) return { x:primX, y:primY }
  const sag = Math.min(0.60, (distBall-55)/305)
  return {
    x: primX + (attPos.x + (CW/2 - attPos.x)*0.35 - primX)*sag,
    y: primY + (attPos.y + (paintY - attPos.y)*0.48 - primY)*sag,
  }
}

function accumulateSteps(elems, throughStep, courtH = FULL_H, courtType = 'half') {
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v))
  const cx = v => clamp(v, PR+4, CW-PR-4)
  const cy = v => clamp(v, PR+4, courtH-PR-4)
  const pos = {}
  for (const e of elems) if (!ARROW_TYPES.includes(e.type)) pos[e.id]={x:e.x,y:e.y}
  let carrier = null
  for (const e of elems) if (PLAYER_TYPES.includes(e.type) && e.hasBall) { carrier=e.id; break }

  for (let s = 0; s < throughStep; s++) {
    const moves = {}
    // regular moves
    for (const e of elems) {
      if (!MOVE_ARROW_TYPES.includes(e.type)) continue
      if ((e.step??0) !== s) continue
      let pid = e.fromId && pos[e.fromId] ? e.fromId : null
      if (!pid) { let bd=PR*3,bi=null; for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}} pid=bi }
      if (!pid||!pos[pid]) continue
      const b=pos[pid]; moves[pid]={dx:e.x2-b.x,dy:e.y2-b.y}; pos[pid]={x:e.x2,y:e.y2}
    }
    // handoff swap
    for (const e of elems) {
      if (e.type!=='handoff'||(e.step??0)!==s) continue
      let p1=e.fromId&&pos[e.fromId]?e.fromId:null
      if (!p1){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}p1=bi}
      if (!p1) continue
      let p2=null,bd=PR*3
      for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x2,pp.y-e.y2);if(d<bd){bd=d;p2=p.id}}
      if (!p2) continue
      const a={...pos[p1]},b={...pos[p2]}
      moves[p1]={dx:b.x-a.x,dy:b.y-a.y}; moves[p2]={dx:a.x-b.x,dy:a.y-b.y}
      pos[p1]={x:b.x,y:b.y}; pos[p2]={x:a.x,y:a.y}
      if(carrier===p1) carrier=p2
    }
    // pass ball transfer
    if (carrier) {
      const arr=elems.find(e=>e.type==='pass'&&(e.step??0)===s&&e.fromId===carrier)
      if (arr){let bd=PR+30,bi=null;for(const e of elems){if(!PLAYER_TYPES.includes(e.type)||e.id===carrier)continue;const p=pos[e.id]||{x:e.x,y:e.y};const d=Math.hypot(p.x-arr.x2,p.y-arr.y2);if(d<bd){bd=d;bi=e.id}}if(bi)carrier=bi}
    }
    // smart defense
    const ballPos = carrier ? pos[carrier] : null
    for (const e of elems) {
      if (!['defense','xdefense'].includes(e.type)||!e.num) continue
      const manual=elems.some(x=>(MOVE_ARROW_TYPES.includes(x.type)||x.type==='handoff')&&(x.step??0)===s&&x.fromId===e.id)
      if (manual||!pos[e.id]) continue
      const att=elems.find(x=>x.type==='offense'&&x.num===e.num)
      if (!att||!pos[att.id]) continue
      const moved=!!moves[att.id]||!!moves[carrier]||elems.some(x=>x.type==='pass'&&(x.step??0)===s)
      if (!moved) continue
      const ideal=computeSmartDefPos(pos[att.id],ballPos,courtType,courtH)
      pos[e.id]={x:cx(ideal.x),y:cy(ideal.y)}
    }
  }
  return { playerPos:pos, carrierId:carrier }
}

/* ── court texture (painted on canvas, used as floor texture) ─ */
function makeCourttexture(courtType) {
  const TW=2048, TH=Math.round(2048 * getH(courtType) / CW)
  const c=document.createElement('canvas'); c.width=TW; c.height=TH
  const ctx=c.getContext('2d')
  // parquet base
  const g=ctx.createLinearGradient(0,0,TW,0)
  g.addColorStop(0,'#c8843a'); g.addColorStop(0.25,'#d4922e')
  g.addColorStop(0.5,'#c8843a'); g.addColorStop(0.75,'#bf7d2a'); g.addColorStop(1,'#c8843a')
  ctx.fillStyle=g; ctx.fillRect(0,0,TW,TH)
  // parquet strips
  ctx.globalAlpha=0.07
  for(let x=0;x<=TW;x+=TW/40){
    ctx.strokeStyle='#000'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,TH); ctx.stroke()
  }
  for(let y=0;y<=TH;y+=TH/28){
    ctx.strokeStyle='#fff'; ctx.lineWidth=0.5
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(TW,y); ctx.stroke()
  }
  ctx.globalAlpha=1
  // court lines: scale up version
  const sx=TW/CW, sy=TH/getH(courtType)
  ctx.save(); ctx.scale(sx,sy)
  drawCourtLines(ctx,CW,getH(courtType),courtType)
  ctx.restore()
  const tex=new THREE.CanvasTexture(c)
  tex.anisotropy=4
  return tex
}

function drawCourtLines(ctx,W,H,courtType) {
  const mg=22, sx=(W-2*mg)/15, sy=(H-2*mg)/14, s=(sx+sy)/2
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5; ctx.lineCap='butt'
  // boundary
  ctx.strokeRect(mg,mg,W-2*mg,H-2*mg)
  // key
  const pW=4.9*sx,pH=5.8*sy,pX=(W-pW)/2,pY=mg
  ctx.strokeRect(pX,pY,pW,pH)
  // backboard line
  ctx.lineWidth=5; ctx.beginPath()
  ctx.moveTo(W/2-0.915*sx,pY+3); ctx.lineTo(W/2+0.915*sx,pY+3); ctx.stroke()
  ctx.lineWidth=2.5
  // rim circle
  const rimX=W/2,rimY=pY+1.575*sy,rimR=Math.max(0.225*s,13)
  ctx.beginPath(); ctx.arc(rimX,rimY,rimR,0,Math.PI*2); ctx.stroke()
  // restricted arc
  ctx.beginPath(); ctx.arc(rimX,rimY,1.25*s,0,Math.PI); ctx.stroke()
  // ft line + arc
  const ftY=pY+pH
  ctx.beginPath(); ctx.moveTo(pX,ftY); ctx.lineTo(pX+pW,ftY); ctx.stroke()
  const ftR=1.8*s
  ctx.beginPath(); ctx.arc(rimX,ftY,ftR,Math.PI,0); ctx.stroke()
  ctx.setLineDash([8,7]); ctx.beginPath(); ctx.arc(rimX,ftY,ftR,0,Math.PI); ctx.stroke(); ctx.setLineDash([])
  // ft lane marks
  ;[1.7,2.9,3.7,4.6].forEach(d=>{
    const my=pY+d*sy; if(my>rimY+rimR+4&&my<ftY-2){
      [[pX,pX+9],[pX+pW-9,pX+pW]].forEach(([a,b])=>{
        ctx.beginPath(); ctx.moveTo(a,my); ctx.lineTo(b,my); ctx.stroke()
      })
    }
  })
  // three-point line
  const arc3R=6.75*sx,c3X=mg+0.9*sx,c3Xr=W-c3X
  if(arc3R>rimX-c3X+1){
    const sH=Math.sqrt(arc3R*arc3R-(rimX-c3X)**2)
    const aB=rimY+sH
    ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,aB);ctx.stroke()
    ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,aB);ctx.stroke()
    const a3=Math.asin((rimX-c3X)/arc3R)
    ctx.beginPath();ctx.arc(rimX,rimY,arc3R,Math.PI/2-a3,Math.PI/2+a3,false);ctx.stroke()
  }
  if(courtType==='half'){
    ctx.beginPath();ctx.arc(W/2,H-mg,1.8*s,Math.PI,0);ctx.stroke()
  } else {
    // midcourt
    ctx.beginPath();ctx.moveTo(mg,H/2);ctx.lineTo(W-mg,H/2);ctx.stroke()
    ctx.beginPath();ctx.arc(W/2,H/2,1.8*s,0,Math.PI*2);ctx.stroke()
    ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(W/2,H/2,4,0,Math.PI*2);ctx.fill()
    // second basket
    ctx.save();ctx.translate(W,H);ctx.rotate(Math.PI)
    const pY2=mg
    ctx.strokeStyle='#fff';ctx.lineWidth=2.5
    ctx.strokeRect(pX,pY2,pW,pH)
    ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(W/2-0.915*sx,pY2+3);ctx.lineTo(W/2+0.915*sx,pY2+3);ctx.stroke()
    ctx.lineWidth=2.5
    ctx.beginPath();ctx.arc(rimX,rimY,rimR,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,rimY,1.25*s,0,Math.PI);ctx.stroke()
    ctx.beginPath();ctx.moveTo(pX,ftY);ctx.lineTo(pX+pW,ftY);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,ftY,ftR,Math.PI,0);ctx.stroke()
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
    if(arc3R>rimX-c3X+1){
      const sH=Math.sqrt(arc3R*arc3R-(rimX-c3X)**2),aB=rimY+sH
      ctx.beginPath();ctx.moveTo(c3X,pY2);ctx.lineTo(c3X,aB);ctx.stroke()
      ctx.beginPath();ctx.moveTo(c3Xr,pY2);ctx.lineTo(c3Xr,aB);ctx.stroke()
      const a3=Math.asin((rimX-c3X)/arc3R)
      ctx.beginPath();ctx.arc(rimX,rimY,arc3R,Math.PI/2-a3,Math.PI/2+a3,false);ctx.stroke()
    }
    ctx.restore()
  }
}

/* ── 3D helpers ──────────────────────────────────────────────── */
function buildCourtMesh(scene, courtType) {
  const H_px = getH(courtType)
  const W_m = CW * S, H_m = H_px * S

  // Floor
  const tex  = makeCourttexture(courtType)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W_m, H_m),
    new THREE.MeshLambertMaterial({ map: tex })
  )
  floor.rotation.x = -Math.PI/2
  floor.position.set(0, 0, H_m/2)
  floor.receiveShadow = true
  scene.add(floor)

  // Thin border strips (court boundary stands out)
  const borderMat = new THREE.MeshLambertMaterial({ color:0xffffff })
  const bH = 0.03
  ;[
    [W_m/2, bH, H_m, 0, bH/2, H_m/2],
    [-W_m/2, bH, H_m, 0, bH/2, H_m/2],
    [W_m, bH, bH, 0, bH/2, 0],
    [W_m, bH, bH, 0, bH/2, H_m],
  ].forEach(([w,h,d,x,y,z])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), borderMat)
    m.position.set(x,y,z); scene.add(m)
  })

  buildBasket(scene, courtType, H_m)
}

function buildBasket(scene, courtType, H_m) {
  const mg=22, sy=(getH(courtType)-2*mg)/14
  const rimY_px = mg+1.575*sy
  const rimZ = rimY_px * S
  addHoop(scene, rimZ, false)
  if (courtType === 'full') addHoop(scene, H_m - rimZ, true)
}

function addHoop(scene, rimZ, flipped) {
  const y = 3.05  // NBA rim height
  const RIM_R = 0.23

  // Backboard (transparent glass)
  const bbGeo  = new THREE.BoxGeometry(1.83, 1.07, 0.05)
  const bbMat  = new THREE.MeshPhongMaterial({ color:0xffffff, transparent:true, opacity:0.35, shininess:90 })
  const bb = new THREE.Mesh(bbGeo, bbMat)
  bb.position.set(0, y + 0.53, rimZ + (flipped ? 0.3 : -0.3))
  scene.add(bb)
  // backboard frame
  const fMat = new THREE.MeshLambertMaterial({color:0x333333})
  const fGeo = new THREE.BoxGeometry(1.88, 1.12, 0.04)
  const fr = new THREE.Mesh(fGeo, fMat); fr.position.copy(bb.position); fr.position.z += flipped ? -0.03 : 0.03
  scene.add(fr)
  // inner box on backboard
  const ib = new THREE.Mesh(new THREE.BoxGeometry(0.59,0.45,0.06), new THREE.MeshLambertMaterial({color:0xff6600,transparent:true,opacity:0.5}))
  ib.position.copy(bb.position); scene.add(ib)

  // Rim (torus)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_R, 0.02, 8, 32),
    new THREE.MeshPhongMaterial({ color:0xff5500, shininess:60 })
  )
  rim.rotation.x = Math.PI/2
  rim.position.set(0, y, rimZ)
  rim.castShadow = true
  scene.add(rim)

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05,0.05,3.5,8),
    new THREE.MeshLambertMaterial({color:0x888888})
  )
  pole.position.set(flipped ? 1.1 : -1.1, 1.75, rimZ + (flipped?0.8:-0.8))
  scene.add(pole)

  // Net (simple translucent cone)
  const net = new THREE.Mesh(
    new THREE.ConeGeometry(RIM_R, 0.4, 16, 1, true),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.25, side:THREE.DoubleSide, wireframe:true})
  )
  net.position.set(0, y - 0.2, rimZ)
  scene.add(net)
}

function createPlayerMesh(color, num, isDefense) {
  const group = new THREE.Group()
  const jerseyMat = new THREE.MeshLambertMaterial({ color })
  const skinMat   = new THREE.MeshLambertMaterial({ color: isDefense ? 0xf5c5a3 : 0x8b6050 })
  const shortsMat = new THREE.MeshLambertMaterial({ color: isDefense ? 0xdddddd : 0x222222 })

  // legs
  ;[[-0.11, 0], [0.11, 0]].forEach(([ox]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.085,0.88,7), shortsMat)
    leg.position.set(ox, 0.44, 0); group.add(leg)
    // shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.1,0.26), new THREE.MeshLambertMaterial({color:isDefense?0x222222:0x333333}))
    shoe.position.set(ox, 0.05, 0.03); group.add(shoe)
  })

  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.22,0.72,8), jerseyMat)
  torso.position.set(0, 1.24, 0); torso.castShadow=true; group.add(torso)

  // arms
  ;[[-0.38,1.2,0],[0.38,1.2,0]].forEach(([x,y,z])=>{
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.35,4,6), jerseyMat)
    arm.rotation.z = x<0 ? 0.5 : -0.5
    arm.position.set(x,y,z); group.add(arm)
  })

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), skinMat)
  head.position.set(0, 1.85, 0); head.castShadow=true; group.add(head)

  // jersey number (canvas texture on plane)
  const nc=document.createElement('canvas'); nc.width=128; nc.height=96
  const nctx=nc.getContext('2d')
  nctx.fillStyle=isDefense?'#111827':'#ffffff'
  nctx.fillRect(0,0,128,96)
  nctx.fillStyle=isDefense?'#ffffff':'#111827'
  nctx.font='bold 64px sans-serif'
  nctx.textAlign='center'; nctx.textBaseline='middle'
  nctx.fillText(String(num), 64, 48)
  const ntex = new THREE.CanvasTexture(nc)
  const numPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.27),
    new THREE.MeshBasicMaterial({ map:ntex, transparent:true })
  )
  numPlane.position.set(0, 1.24, 0.27); group.add(numPlane)

  return group
}

function createBallMesh() {
  const geo = new THREE.SphereGeometry(0.12, 16, 16)
  const mat = new THREE.MeshPhongMaterial({ color:0xf97316, shininess:40 })
  const ball = new THREE.Mesh(geo, mat)
  ball.castShadow = true
  // seam lines
  const seamMat = new THREE.LineBasicMaterial({color:0x000000, linewidth:1})
  const circle1 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*0.122,0,Math.sin(i/64*Math.PI*2)*0.122))
    ), seamMat
  )
  ball.add(circle1)
  const circle2 = circle1.clone(); circle2.rotation.z = Math.PI/2; ball.add(circle2)
  return ball
}

/* ── main component ──────────────────────────────────────────── */
export default function Court3DView({ phases, courtType, onClose }) {
  const canvasRef  = useRef(null)
  const stateRef   = useRef(null)
  const animRef    = useRef(null)
  const [playing,   setPlaying]  = useState(false)
  const [recording, setRecording] = useState(false)
  const [camMode,   setCamMode]  = useState('overview')   // 'overview' | 'follow' | 'cinematic'

  const H_px = getH(courtType)
  const H_m  = H_px * S
  const W_m  = CW   * S

  /* ── scene setup ─────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.clientWidth || 800, H = canvas.clientHeight || 520

    // renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false })
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    // scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080c14)
    scene.fog = new THREE.Fog(0x080c14, 30, 55)

    // lighting: arena feel
    scene.add(new THREE.AmbientLight(0xfff5dd, 0.55))
    ;[[0, 14, H_m*0.2],[-W_m*0.4, 12, H_m*0.5],[W_m*0.4, 12, H_m*0.5],[0, 14, H_m*0.8]].forEach(([x,y,z])=>{
      const d = new THREE.DirectionalLight(0xfff8e7, 0.7)
      d.position.set(x,y,z); d.castShadow=true
      d.shadow.mapSize.set(512,512)
      scene.add(d)
    })
    // subtle cool fill from below/sides
    scene.add(Object.assign(new THREE.PointLight(0x335588,0.3,30), {position:new THREE.Vector3(-W_m,2,H_m/2)}))
    scene.add(Object.assign(new THREE.PointLight(0x335588,0.3,30), {position:new THREE.Vector3( W_m,2,H_m/2)}))

    // court
    buildCourtMesh(scene, courtType)

    // camera
    const camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 100)
    setCameraPos(camera, 'overview', H_m, W_m)

    // players + ball from phase 0
    const playerMeshes = {}
    const elements = phases[0]?.elements || []
    for (const el of elements) {
      if (!PLAYER_TYPES.includes(el.type)) continue
      const isOff = el.type === 'offense'
      const color = isOff ? 0x111827 : 0xf0f0f0
      const mesh = createPlayerMesh(color, el.num ?? '?', !isOff)
      const {x,z} = p3(el.x, el.y)
      mesh.position.set(x, 0, z)
      mesh.castShadow = true
      scene.add(mesh)
      playerMeshes[el.id] = mesh
    }

    const ball = createBallMesh()
    // find initial carrier
    const carrier = elements.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if (carrier) { const {x,z}=p3(carrier.x,carrier.y); ball.position.set(x,0.9,z) }
    else { const {x,z}=p3(CW/2, H_px*0.4); ball.position.set(x,0.9,z) }
    scene.add(ball)

    stateRef.current = { renderer, scene, camera, playerMeshes, ball }
    renderer.render(scene, camera)

    // resize handler
    function onResize() {
      const w=canvas.clientWidth, h=canvas.clientHeight
      renderer.setSize(w,h,false)
      camera.aspect=w/h; camera.updateProjectionMatrix()
      renderer.render(scene,camera)
    }
    const ro = new ResizeObserver(onResize); ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      renderer.dispose()
      stateRef.current = null
    }
  }, [phases, courtType]) // eslint-disable-line

  function setCameraPos(camera, mode, H_m, W_m) {
    if (mode === 'overview') {
      camera.position.set(0, H_m*0.85, H_m*0.5 - 2)
      camera.lookAt(0, 0, H_m/2)
    } else if (mode === 'follow') {
      camera.position.set(W_m*0.55, 5, H_m*0.35)
      camera.lookAt(0, 1, H_m*0.4)
    } else {
      // cinematic: side TV angle
      camera.position.set(W_m*0.65, 7, H_m*0.5)
      camera.lookAt(0, 1, H_m/2)
    }
  }

  /* ── animation ───────────────────────────────────────────── */
  function stopAnim() {
    cancelAnimationFrame(animRef.current)
    setPlaying(false)
    // reset players to phase 0 initial positions
    const s = stateRef.current; if (!s) return
    const elements = phases[0]?.elements || []
    for (const el of elements) {
      if (!PLAYER_TYPES.includes(el.type)) continue
      const mesh = s.playerMeshes[el.id]; if (!mesh) continue
      const {x,z}=p3(el.x,el.y); mesh.position.set(x,0,z)
    }
    s.renderer.render(s.scene, s.camera)
  }

  function startAnim() {
    const s = stateRef.current; if (!s) return
    if (playing) { stopAnim(); return }
    setPlaying(true)

    const { renderer, scene, camera, playerMeshes, ball } = s
    const nPhases = phases.length

    const phaseMeta = phases.map(ph=>({
      numSteps: getNumSteps(ph.elements||[]),
      get phaseDur() { return this.numSteps*STEP_DUR+PHASE_HOLD }
    }))
    const phaseStarts = [0]
    for (let i=0;i<nPhases;i++) phaseStarts.push(phaseStarts[i]+phaseMeta[i].phaseDur)
    const totalDur = phaseStarts[nPhases]
    const startTs = performance.now()

    function frame(ts) {
      const elapsed = ts - startTs

      if (elapsed >= totalDur) {
        renderer.render(scene, camera)
        setTimeout(()=>{ setPlaying(false); stopAnim() }, 800)
        return
      }

      // locate phase/step
      let phIdx = nPhases-1
      for (let i=0;i<nPhases;i++) if (elapsed < phaseStarts[i+1]) { phIdx=i; break }
      const phElapsed = elapsed - phaseStarts[phIdx]
      const { numSteps } = phaseMeta[phIdx]
      const stepIdx = Math.min(Math.floor(phElapsed/STEP_DUR), numSteps-1)
      const stepT   = Math.min((phElapsed - stepIdx*STEP_DUR)/STEP_MOVE_DUR, 1)
      const et      = ease(stepT)

      const elems = phases[phIdx]?.elements || []
      const { playerPos: basePos, carrierId: baseCarrier } = accumulateSteps(elems, stepIdx, H_px, courtType)

      // build 3D targets (same logic as renderPhaseFrame animation)
      const targets = {}
      for (const el of elems) {
        if (!MOVE_ARROW_TYPES.includes(el.type)) continue
        if ((el.step??0) !== stepIdx) continue
        let pid = el.fromId && basePos[el.fromId] ? el.fromId : null
        if (!pid) { let bd=PR*3,bi=null; for(const pe of elems){if(!PLAYER_TYPES.includes(pe.type))continue;const bp=basePos[pe.id];if(!bp)continue;const d=Math.hypot(bp.x-el.x1,bp.y-el.y1);if(d<bd){bd=d;bi=pe.id}} pid=bi }
        if (pid) targets[pid]={x:el.x2,y:el.y2}
      }
      // handoff targets
      for (const el of elems) {
        if (el.type!=='handoff'||(el.step??0)!==stepIdx) continue
        let p1=el.fromId&&basePos[el.fromId]?el.fromId:null
        if(!p1){let bd=PR*3,bi=null;for(const pe of elems){if(!PLAYER_TYPES.includes(pe.type))continue;const bp=basePos[pe.id];if(!bp)continue;const d=Math.hypot(bp.x-el.x1,bp.y-el.y1);if(d<bd){bd=d;bi=pe.id}}p1=bi}
        if(!p1)continue
        let p2=null,bd=PR*3
        for(const pe of elems){if(!PLAYER_TYPES.includes(pe.type)||pe.id===p1)continue;const bp=basePos[pe.id];if(!bp)continue;const d=Math.hypot(bp.x-el.x2,bp.y-el.y2);if(d<bd){bd=d;p2=pe.id}}
        if(!p2)continue
        targets[p1]={x:basePos[p2].x,y:basePos[p2].y}
        targets[p2]={x:basePos[p1].x,y:basePos[p1].y}
      }
      // smart defense targets
      const hasBallXfer = elems.some(e=>(e.type==='pass'||e.type==='handoff')&&(e.step??0)===stepIdx)
      for (const el of elems) {
        if(!['defense','xdefense'].includes(el.type)||!el.num||targets[el.id])continue
        const att=elems.find(e=>e.type==='offense'&&e.num===el.num)
        if(!att||!basePos[att.id])continue
        if(!targets[att.id]&&!hasBallXfer)continue
        const attEnd=targets[att.id]||basePos[att.id]
        const ballEnd=baseCarrier?(targets[baseCarrier]||basePos[baseCarrier]):null
        const ideal=computeSmartDefPos(attEnd,ballEnd,courtType,H_px)
        targets[el.id]={x:Math.max(PR+4,Math.min(CW-PR-4,ideal.x)),y:Math.max(PR+4,Math.min(H_px-PR-4,ideal.y))}
      }

      // update player meshes
      for (const el of elems) {
        if (!PLAYER_TYPES.includes(el.type)) continue
        const mesh = playerMeshes[el.id]; if (!mesh) continue
        const base = basePos[el.id]; if (!base) continue
        const tgt  = targets[el.id] || base
        const bx=p3(base.x,base.y), tx=p3(tgt.x,tgt.y)
        mesh.position.x = lerp(bx.x, tx.x, et)
        mesh.position.z = lerp(bx.z, tx.z, et)
        // face direction of movement
        if (targets[el.id]) {
          const dx=tx.x-bx.x, dz=tx.z-bx.z
          if (Math.hypot(dx,dz)>0.01) mesh.rotation.y = Math.atan2(dx,dz)
        }
      }

      // ball animation
      let bx3=null, bz3=null, by3=null
      if (stepT>0 && baseCarrier) {
        const cBase = basePos[baseCarrier]
        // handoff
        const hoEl = elems.find(e=>e.type==='handoff'&&(e.step??0)===stepIdx&&targets[e.fromId||''])
        if (hoEl && cBase && targets[hoEl.fromId]) {
          const p1b=p3(basePos[hoEl.fromId]?.x||cBase.x, basePos[hoEl.fromId]?.y||cBase.y)
          const p2id=Object.keys(targets).find(k=>k!==hoEl.fromId&&Math.hypot((basePos[k]?.x||0)-hoEl.x2,(basePos[k]?.y||0)-hoEl.y2)<PR*3)
          if (p2id) {
            const p2b=p3(basePos[p2id].x, basePos[p2id].y)
            if (et<0.5){bx3=lerp(p1b.x,p2b.x,et);bz3=lerp(p1b.z,p2b.z,et)}
            else{bx3=lerp(p2b.x,p1b.x,et);bz3=lerp(p2b.z,p1b.z,et)}
            by3=0.9
          }
        }
        // shot arc
        if (bx3===null) {
          const shotEl = elems.find(e=>e.type==='shot'&&(e.step??0)===stepIdx&&(e.fromId===baseCarrier||!e.fromId))
          if (shotEl && cBase) {
            const s3=p3(cBase.x,cBase.y), e3=p3(shotEl.x2,shotEl.y2)
            const dist=Math.hypot(e3.x-s3.x,e3.z-s3.z)
            const arcH=dist*0.55
            bx3=lerp(s3.x,e3.x,et); bz3=lerp(s3.z,e3.z,et)
            by3=0.9+arcH*Math.sin(et*Math.PI)
            const bR=et>0.8?0.12*(1-(et-0.8)/0.2):0.12
            ball.scale.setScalar(bR/0.12)
          }
        }
        // pass
        if (bx3===null) {
          const passEl = elems.find(e=>e.type==='pass'&&(e.step??0)===stepIdx&&e.fromId===baseCarrier)
          if (passEl && cBase) {
            const cTgt=targets[baseCarrier]
            const cx2d=cTgt?lerp(cBase.x,cTgt.x,et):cBase.x
            const cy2d=cTgt?lerp(cBase.y,cTgt.y,et):cBase.y
            const cp=p3(cx2d,cy2d), ep=p3(passEl.x2,passEl.y2)
            bx3=lerp(cp.x,ep.x,et); bz3=lerp(cp.z,ep.z,et); by3=0.9
          }
        }
        // carrier moving (dribble)
        if (bx3===null && targets[baseCarrier]) {
          const bp=p3(cBase.x,cBase.y), tp=p3(targets[baseCarrier].x,targets[baseCarrier].y)
          bx3=lerp(bp.x,tp.x,et); bz3=lerp(bp.z,tp.z,et)
          by3=0.9+Math.abs(Math.sin(et*Math.PI*4))*0.18  // dribble bounce
        }
        // carrier standing still
        if (bx3===null) {
          const cp=p3(cBase.x,cBase.y); bx3=cp.x; bz3=cp.z; by3=0.9
        }
      }
      if (bx3!==null){ball.position.set(bx3,by3,bz3)}
      else{ball.scale.setScalar(1)}

      // follow-ball camera
      if (camMode === 'follow' && bx3!==null) {
        s.camera.position.set(bx3, 7, bz3-4)
        s.camera.lookAt(bx3, 1, bz3+2)
      }

      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
  }

  /* ── camera mode toggle ──────────────────────────────────── */
  function toggleCam(mode) {
    setCamMode(mode)
    const s = stateRef.current; if (!s) return
    setCameraPos(s.camera, mode, H_m, W_m)
    if (!playing) s.renderer.render(s.scene, s.camera)
  }

  /* ── video export ─────────────────────────────────────────── */
  async function exportVideo() {
    const s = stateRef.current; if (!s) return
    if (recording || typeof MediaRecorder === 'undefined') return
    const stream = s.renderer.domElement.captureStream(30)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    const chunks = []
    rec.ondataavailable = e => chunks.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunks, {type:'video/webm'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download='jugada-3d.webm'; a.click()
      URL.revokeObjectURL(url); setRecording(false)
    }
    setRecording(true); rec.start()
    // run full anim then stop recording
    const nP=phases.length
    const totalMs=phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements||[])*STEP_DUR+PHASE_HOLD,0)+1000
    startAnim()
    setTimeout(()=>{ stopAnim(); rec.stop() }, totalMs)
  }

  /* ── render ──────────────────────────────────────────────── */
  const btnStyle = (active) => ({
    padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer',
    fontWeight:600, fontSize:12,
    background: active ? '#3b82f6' : '#1f2937',
    color: active ? '#fff' : '#9ca3af',
    transition:'all 0.15s',
  })

  return (
    <div style={{position:'relative',width:'100%',height:'100%',background:'#080c14',display:'flex',flexDirection:'column'}}>
      {/* canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex:1, width:'100%', display:'block', cursor:'default' }}
      />

      {/* controls overlay */}
      <div style={{
        position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
        display:'flex', alignItems:'center', gap:10,
        background:'rgba(0,0,0,0.75)', backdropFilter:'blur(12px)',
        padding:'10px 18px', borderRadius:16,
        border:'1px solid rgba(255,255,255,0.08)',
      }}>
        {/* play/stop */}
        <button onClick={playing ? stopAnim : startAnim} style={{
          padding:'9px 24px', borderRadius:10, border:'none', cursor:'pointer',
          background: playing ? '#f59e0b' : '#3b82f6', color:'#fff',
          fontWeight:700, fontSize:13,
          boxShadow: playing ? 'none' : '0 4px 16px rgba(59,130,246,0.4)',
        }}>
          {playing ? '⏹ Parar' : '▶ Reproducir en 3D'}
        </button>

        {/* separator */}
        <div style={{width:1,height:24,background:'rgba(255,255,255,0.15)'}}/>

        {/* camera modes */}
        <span style={{color:'rgba(255,255,255,0.35)',fontSize:11,fontWeight:600}}>CÁMARA</span>
        {[['overview','Vista táctica'],['follow','Seguir balón'],['cinematic','TV lateral']].map(([mode,label])=>(
          <button key={mode} onClick={()=>toggleCam(mode)} style={btnStyle(camMode===mode)}>{label}</button>
        ))}

        {/* separator */}
        <div style={{width:1,height:24,background:'rgba(255,255,255,0.15)'}}/>

        {/* export */}
        <button onClick={exportVideo} disabled={recording} style={{
          padding:'7px 16px', borderRadius:8, border:'none', cursor:recording?'not-allowed':'pointer',
          background: recording?'#374151':'#7c3aed', color:'#fff',
          fontWeight:700, fontSize:12,
        }}>
          {recording ? '⏺ Grabando...' : '🎬 Exportar vídeo'}
        </button>
      </div>

      {/* info badge */}
      <div style={{
        position:'absolute', top:14, left:14,
        background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
        padding:'6px 12px', borderRadius:8, color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:600,
        border:'1px solid rgba(255,255,255,0.08)',
      }}>
        {phases.length} fase{phases.length!==1?'s':''} · {courtType === 'full' ? 'Pista completa' : 'Media pista'}
      </div>
    </div>
  )
}
