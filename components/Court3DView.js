'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

/* ── constants (mirror CourtEditor) ─────────────────────────── */
const CW = 560, HALF_H = 520, FULL_H = 970, PR = 20
const ARROW_TYPES      = ['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES     = ['offense','defense','xdefense']
const MOVE_ARROW_TYPES = ['dribble','cut','screen']
const STEP_MOVE_DUR = 1000, STEP_HOLD_DUR = 300
const STEP_DUR = STEP_MOVE_DUR + STEP_HOLD_DUR, PHASE_HOLD = 500
const S = 15 / CW   // metres per pixel

function getH(ct)    { return ct === 'full' ? FULL_H : HALF_H }
function ease(t)     { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }
function lerp(a,b,t) { return a + (b-a)*t }
function p3(px, py)  { return { x:(px - CW/2)*S, z:py*S } }

/* ── duplicated helpers ──────────────────────────────────────── */
function getNumSteps(elems) {
  let max = -1
  for (const e of elems) if (ARROW_TYPES.includes(e.type)) max = Math.max(max, e.step ?? 0)
  return Math.max(1, max + 1)
}

function computeSmartDefPos(attPos, ballPos, courtType, courtH) {
  const mg = 22, halfH = courtType === 'full' ? Math.round(courtH/2) : courtH
  const sy = (halfH - 2*mg)/14, rimY = mg + 1.575*sy, ftY = mg + 5.8*sy
  const useBot = courtType === 'full' && attPos.y > courtH/2
  const basketY = useBot ? courtH - rimY : rimY
  const paintY  = useBot ? courtH - (rimY+ftY)/2 : (rimY+ftY)/2
  const dxB = CW/2 - attPos.x, dyB = basketY - attPos.y
  const distB = Math.hypot(dxB,dyB)||1
  const OFFSET = Math.min(46, distB*0.32)
  const primX = attPos.x + (dxB/distB)*OFFSET, primY = attPos.y + (dyB/distB)*OFFSET
  if (!ballPos) return {x:primX,y:primY}
  const distBall = Math.hypot(ballPos.x-attPos.x, ballPos.y-attPos.y)
  if (distBall < 55) return {x:primX,y:primY}
  const sag = Math.min(0.60,(distBall-55)/305)
  return {
    x: primX + (attPos.x+(CW/2-attPos.x)*0.35-primX)*sag,
    y: primY + (attPos.y+(paintY-attPos.y)*0.48-primY)*sag,
  }
}

function accumulateSteps(elems, throughStep, courtH = FULL_H, courtType = 'half') {
  const cl = (v,lo,hi) => Math.max(lo,Math.min(hi,v))
  const cx = v => cl(v,PR+4,CW-PR-4), cy = v => cl(v,PR+4,courtH-PR-4)
  const pos = {}
  for (const e of elems) if (!ARROW_TYPES.includes(e.type)) pos[e.id]={x:e.x,y:e.y}
  let carrier = null
  for (const e of elems) if (PLAYER_TYPES.includes(e.type)&&e.hasBall){carrier=e.id;break}

  for (let s=0; s<throughStep; s++) {
    const moves = {}
    for (const e of elems) {
      if (!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==s) continue
      let pid=e.fromId&&pos[e.fromId]?e.fromId:null
      if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
      if(!pid||!pos[pid])continue
      const b=pos[pid];moves[pid]={dx:e.x2-b.x,dy:e.y2-b.y};pos[pid]={x:e.x2,y:e.y2}
    }
    for (const e of elems) {
      if(e.type!=='handoff'||(e.step??0)!==s)continue
      let p1=e.fromId&&pos[e.fromId]?e.fromId:null
      if(!p1){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}p1=bi}
      if(!p1)continue
      let p2=null,bd=PR*3
      for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x2,pp.y-e.y2);if(d<bd){bd=d;p2=p.id}}
      if(!p2)continue
      const a={...pos[p1]},b={...pos[p2]}
      moves[p1]={dx:b.x-a.x,dy:b.y-a.y};moves[p2]={dx:a.x-b.x,dy:a.y-b.y}
      pos[p1]={x:b.x,y:b.y};pos[p2]={x:a.x,y:a.y}
      if(carrier===p1)carrier=p2
    }
    if(carrier){
      const arr=elems.find(e=>e.type==='pass'&&(e.step??0)===s&&e.fromId===carrier)
      if(arr){let bd=PR+30,bi=null;for(const e of elems){if(!PLAYER_TYPES.includes(e.type)||e.id===carrier)continue;const p=pos[e.id]||{x:e.x,y:e.y};const d=Math.hypot(p.x-arr.x2,p.y-arr.y2);if(d<bd){bd=d;bi=e.id}}if(bi)carrier=bi}
    }
    const ballPos=carrier?pos[carrier]:null
    for(const e of elems){
      if(!['defense','xdefense'].includes(e.type)||!e.num)continue
      const manual=elems.some(x=>(MOVE_ARROW_TYPES.includes(x.type)||x.type==='handoff')&&(x.step??0)===s&&x.fromId===e.id)
      if(manual||!pos[e.id])continue
      const att=elems.find(x=>x.type==='offense'&&x.num===e.num)
      if(!att||!pos[att.id])continue
      const moved=!!moves[att.id]||!!moves[carrier]||elems.some(x=>x.type==='pass'&&(x.step??0)===s)
      if(!moved)continue
      const ideal=computeSmartDefPos(pos[att.id],ballPos,courtType,courtH)
      pos[e.id]={x:cx(ideal.x),y:cy(ideal.y)}
    }
  }
  return {playerPos:pos,carrierId:carrier}
}

/* ── court texture ───────────────────────────────────────────── */
function makeCourtTex(courtType) {
  const H_px = getH(courtType)
  const TW = 2048, TH = Math.round(2048 * H_px / CW)
  const c = document.createElement('canvas'); c.width=TW; c.height=TH
  const ctx = c.getContext('2d')
  // parquet
  const g = ctx.createLinearGradient(0,0,TW,0)
  g.addColorStop(0,'#c8843a');g.addColorStop(0.3,'#d4922e');g.addColorStop(0.7,'#bf7d2a');g.addColorStop(1,'#c8843a')
  ctx.fillStyle=g; ctx.fillRect(0,0,TW,TH)
  ctx.globalAlpha=0.06
  for(let x=0;x<TW;x+=TW/38){ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,TH);ctx.stroke()}
  ctx.globalAlpha=1
  // court lines
  ctx.save(); ctx.scale(TW/CW, TH/H_px)
  const mg=22,sx=(CW-2*mg)/15,sy=(H_px-2*mg)/14,s=(sx+sy)/2
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.4
  ctx.strokeRect(mg,mg,CW-2*mg,H_px-2*mg)
  const pW=4.9*sx,pH=5.8*sy,pX=(CW-pW)/2,pY=mg
  ctx.strokeRect(pX,pY,pW,pH)
  ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(CW/2-0.915*sx,pY+2);ctx.lineTo(CW/2+0.915*sx,pY+2);ctx.stroke();ctx.lineWidth=2.4
  const rimX=CW/2,rimY2=pY+1.575*sy,rimR=Math.max(0.225*s,13)
  ctx.beginPath();ctx.arc(rimX,rimY2,rimR,0,Math.PI*2);ctx.stroke()
  ctx.beginPath();ctx.arc(rimX,rimY2,1.25*s,0,Math.PI);ctx.stroke()
  const ftY2=pY+pH
  ctx.beginPath();ctx.moveTo(pX,ftY2);ctx.lineTo(pX+pW,ftY2);ctx.stroke()
  const ftR=1.8*s
  ctx.beginPath();ctx.arc(rimX,ftY2,ftR,Math.PI,0);ctx.stroke()
  ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY2,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
  const arc3R=6.75*sx,c3X=mg+0.9*sx,c3Xr=CW-c3X
  if(arc3R>rimX-c3X+1){
    const sH=Math.sqrt(arc3R**2-(rimX-c3X)**2)
    ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,rimY2+sH);ctx.stroke()
    ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,rimY2+sH);ctx.stroke()
    const a3=Math.asin((rimX-c3X)/arc3R)
    ctx.beginPath();ctx.arc(rimX,rimY2,arc3R,Math.PI/2-a3,Math.PI/2+a3);ctx.stroke()
  }
  if(courtType==='full'){
    ctx.beginPath();ctx.moveTo(mg,H_px/2);ctx.lineTo(CW-mg,H_px/2);ctx.stroke()
    ctx.beginPath();ctx.arc(CW/2,H_px/2,1.8*s,0,Math.PI*2);ctx.stroke()
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(CW/2,H_px/2,4,0,Math.PI*2);ctx.fill()
    ctx.save();ctx.translate(CW,H_px);ctx.rotate(Math.PI)
    ctx.strokeStyle='#fff';ctx.lineWidth=2.4
    ctx.strokeRect(pX,pY,pW,pH)
    ctx.beginPath();ctx.arc(rimX,rimY2,rimR,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,rimY2,1.25*s,0,Math.PI);ctx.stroke()
    ctx.beginPath();ctx.moveTo(pX,ftY2);ctx.lineTo(pX+pW,ftY2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,ftY2,ftR,Math.PI,0);ctx.stroke()
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY2,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
    if(arc3R>rimX-c3X+1){
      const sH=Math.sqrt(arc3R**2-(rimX-c3X)**2)
      ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,rimY2+sH);ctx.stroke()
      ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,rimY2+sH);ctx.stroke()
      const a3=Math.asin((rimX-c3X)/arc3R)
      ctx.beginPath();ctx.arc(rimX,rimY2,arc3R,Math.PI/2-a3,Math.PI/2+a3);ctx.stroke()
    }
    ctx.restore()
  } else {
    ctx.beginPath();ctx.arc(CW/2,H_px-mg,1.8*s,Math.PI,0);ctx.stroke()
  }
  ctx.restore()
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4
  return tex
}

/* ── 3D helpers ──────────────────────────────────────────────── */
function buildCourt(scene, courtType) {
  const H_px=getH(courtType), W_m=CW*S, H_m=H_px*S
  const tex=makeCourtTex(courtType)
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W_m,H_m), new THREE.MeshLambertMaterial({map:tex}))
  floor.rotation.x=-Math.PI/2; floor.position.set(0,0,H_m/2); floor.receiveShadow=true; scene.add(floor)
  // boundary raised edges
  const bMat=new THREE.MeshLambertMaterial({color:0xffffff})
  const panels=[
    [W_m+0.1,0.04,0.04, 0,0.02,0],[W_m+0.1,0.04,0.04, 0,0.02,H_m],
    [0.04,0.04,H_m, -W_m/2,0.02,H_m/2],[0.04,0.04,H_m, W_m/2,0.02,H_m/2],
  ]
  panels.forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bMat);m.position.set(x,y,z);scene.add(m)})
  addHoop(scene,courtType,H_m,false)
  if(courtType==='full') addHoop(scene,courtType,H_m,true)
}

function addHoop(scene, courtType, H_m, flipped) {
  const H_px=getH(courtType), mg=22, sy=(H_px/2-2*mg)/14
  const rimY_px=mg+1.575*sy
  const rimZ=(flipped?H_m-rimY_px*S:rimY_px*S)
  const RIM_H=3.05, RIM_R=0.23
  const dir=flipped?1:-1

  // backboard
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.83,1.07,0.05),new THREE.MeshPhongMaterial({color:0xffffff,transparent:true,opacity:0.35,shininess:80}))
  bb.position.set(0,RIM_H+0.53,rimZ+dir*0.3); scene.add(bb)
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.88,1.12,0.04),new THREE.MeshLambertMaterial({color:0x222222}))
  frame.position.copy(bb.position); frame.position.z+=dir*0.04; scene.add(frame)
  // inner square
  const ib=new THREE.Mesh(new THREE.BoxGeometry(0.59,0.45,0.06),new THREE.MeshLambertMaterial({color:0xff6600,transparent:true,opacity:0.4}))
  ib.position.copy(bb.position); scene.add(ib)
  // rim
  const rim=new THREE.Mesh(new THREE.TorusGeometry(RIM_R,0.02,8,32),new THREE.MeshPhongMaterial({color:0xff5500,shininess:60}))
  rim.rotation.x=Math.PI/2; rim.position.set(0,RIM_H,rimZ); rim.castShadow=true; scene.add(rim)
  // net
  const net=new THREE.Mesh(new THREE.ConeGeometry(RIM_R,0.4,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,side:THREE.DoubleSide,wireframe:true}))
  net.position.set(0,RIM_H-0.2,rimZ); scene.add(net)
  // support pole
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3.6,8),new THREE.MeshLambertMaterial({color:0x888888}))
  pole.position.set(dir*1.1,1.8,rimZ+dir*0.9); scene.add(pole)
}

function createPlayer(isOffense, num) {
  const group=new THREE.Group()
  const jerseyColor = isOffense ? 0x0f172a : 0xf8f8f8
  const shortsColor = isOffense ? 0x1e3a5f : 0xcccccc
  const skinColor   = isOffense ? 0x8b6050 : 0xf5c5a3
  const jMat=new THREE.MeshLambertMaterial({color:jerseyColor})
  const sMat=new THREE.MeshLambertMaterial({color:shortsColor})
  const skMat=new THREE.MeshLambertMaterial({color:skinColor})

  // feet/shoes
  const shoeMat=new THREE.MeshLambertMaterial({color:isOffense?0x222222:0x444444})
  ;[[-0.1,0],[0.1,0]].forEach(([ox])=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.09,0.28),shoeMat)
    shoe.position.set(ox,0.045,0.02); group.add(shoe)
  })
  // legs (shorts)
  ;[[-0.11,0],[0.11,0]].forEach(([ox])=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.085,0.82,8),sMat)
    leg.position.set(ox,0.5,0); group.add(leg)
  })
  // torso
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.21,0.7,8),jMat)
  torso.position.set(0,1.24,0); torso.castShadow=true; group.add(torso)
  // arms (simple cylinders, no CapsuleGeometry)
  ;[[-0.38,1.18],[ 0.38,1.18]].forEach(([ox,oy])=>{
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.07,0.38,7),jMat)
    upper.rotation.z=ox<0?0.55:-0.55; upper.position.set(ox,oy,0); group.add(upper)
    // sphere cap at shoulder joint
    const cap=new THREE.Mesh(new THREE.SphereGeometry(0.09,7,7),jMat)
    cap.position.set(ox<0?-0.23:0.23,1.3,0); group.add(cap)
  })
  // neck
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.14,8),skMat)
  neck.position.set(0,1.65,0); group.add(neck)
  // head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.22,12,12),skMat)
  head.position.set(0,1.9,0); head.castShadow=true; group.add(head)
  // jersey number
  const nc=document.createElement('canvas'); nc.width=128; nc.height=96
  const nctx=nc.getContext('2d')
  nctx.fillStyle=isOffense?'#0f172a':'#f8f8f8'
  nctx.fillRect(0,0,128,96)
  nctx.fillStyle=isOffense?'#ffffff':'#111827'
  nctx.font='bold 62px Arial,sans-serif'
  nctx.textAlign='center'; nctx.textBaseline='middle'
  nctx.fillText(String(num??''),64,50)
  const numPlane=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.26),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(nc),transparent:true}))
  numPlane.position.set(0,1.22,0.25); group.add(numPlane)
  return group
}

function createBall() {
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.12,16,16),new THREE.MeshPhongMaterial({color:0xf97316,shininess:50}))
  ball.castShadow=true
  const lMat=new THREE.LineBasicMaterial({color:0x1a0a00})
  const pts=n=>Array.from({length:n+1},(_,i)=>new THREE.Vector3(Math.cos(i/n*Math.PI*2)*0.124,0,Math.sin(i/n*Math.PI*2)*0.124))
  const eq=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts(40)),lMat); ball.add(eq)
  const m=eq.clone(); m.rotation.z=Math.PI/2; ball.add(m)
  const m2=eq.clone(); m2.rotation.x=Math.PI/2; ball.add(m2)
  return ball
}

/* ── main component ──────────────────────────────────────────── */
export default function Court3DView({ phases, courtType }) {
  const canvasRef = useRef(null)
  const stateRef  = useRef(null)
  const animRef   = useRef(null)
  const [playing,   setPlaying]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [camMode,   setCamMode]   = useState('overview')
  const [initError, setInitError] = useState(null)

  const H_px = getH(courtType)
  const H_m  = H_px * S
  const W_m  = CW * S

  /* ── scene init ───────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    let renderer, ro

    try {
      const W = canvas.clientWidth || 900, H = canvas.clientHeight || 540
      renderer = new THREE.WebGLRenderer({ canvas, antialias:true })
      renderer.setSize(W, H, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x070b12)
      scene.fog = new THREE.FogExp2(0x070b12, 0.025)

      // lighting
      scene.add(new THREE.AmbientLight(0xfff5e0, 0.6))
      ;[[0,13,H_m*0.15],[-W_m*0.4,11,H_m*0.5],[W_m*0.4,11,H_m*0.5],[0,13,H_m*0.85]].forEach(([x,y,z])=>{
        const dl=new THREE.DirectionalLight(0xfff8e0,0.65); dl.position.set(x,y,z); dl.castShadow=true; dl.shadow.mapSize.set(512,512); scene.add(dl)
      })
      scene.add(Object.assign(new THREE.PointLight(0x223355,0.4,40),{position:new THREE.Vector3(-W_m,1.5,H_m/2)}))
      scene.add(Object.assign(new THREE.PointLight(0x223355,0.4,40),{position:new THREE.Vector3( W_m,1.5,H_m/2)}))

      buildCourt(scene, courtType)

      const camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 100)
      setCamera(camera, 'overview', H_m, W_m)

      // player meshes from all phases combined (use phase 0 for initial positions)
      const playerMeshes = {}
      const elems0 = phases[0]?.elements || []
      for (const el of elems0) {
        if (!PLAYER_TYPES.includes(el.type)) continue
        const mesh = createPlayer(el.type==='offense', el.num??'?')
        const {x,z}=p3(el.x,el.y); mesh.position.set(x,0,z)
        scene.add(mesh); playerMeshes[el.id]=mesh
      }

      const ball = createBall()
      const initCarrier=elems0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
      if(initCarrier){const {x,z}=p3(initCarrier.x,initCarrier.y);ball.position.set(x,0.95,z)}
      else{const {x,z}=p3(CW/2,H_px*0.4);ball.position.set(x,0.95,z)}
      scene.add(ball)

      stateRef.current={renderer,scene,camera,playerMeshes,ball}
      renderer.render(scene,camera)
      setInitError(null)

      ro=new ResizeObserver(()=>{
        const w=canvas.clientWidth,h=canvas.clientHeight
        renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.render(scene,camera)
      }); ro.observe(canvas)

    } catch(e) {
      console.error('Court3DView init error:', e)
      setInitError(e.message || String(e))
    }

    return () => {
      cancelAnimationFrame(animRef.current)
      ro?.disconnect()
      try { renderer?.dispose() } catch(_){}
      stateRef.current=null
    }
  }, [phases, courtType]) // eslint-disable-line

  function setCamera(cam, mode, hm, wm) {
    if(mode==='overview'){cam.position.set(0,hm*0.88,hm*0.48-1.5);cam.lookAt(0,0,hm/2)}
    else if(mode==='follow'){cam.position.set(wm*0.55,5.5,hm*0.3);cam.lookAt(0,1,hm*0.45)}
    else{cam.position.set(wm*0.68,6.5,hm/2);cam.lookAt(0,1,hm/2)}
  }

  /* ── animation ───────────────────────────────────────────── */
  function stopAnim() {
    cancelAnimationFrame(animRef.current)
    setPlaying(false)
    const s=stateRef.current; if(!s) return
    const elems0=phases[0]?.elements||[]
    for(const el of elems0){
      if(!PLAYER_TYPES.includes(el.type))continue
      const m=s.playerMeshes[el.id];if(!m)continue
      const {x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.y=0
    }
    const initC=elems0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(initC){const {x,z}=p3(initC.x,initC.y);s.ball.position.set(x,0.95,z)}
    s.ball.scale.setScalar(1)
    s.renderer.render(s.scene,s.camera)
  }

  function startAnim() {
    const s=stateRef.current; if(!s||playing) return
    setPlaying(true)
    const {renderer,scene,camera,playerMeshes,ball}=s
    const nP=phases.length
    const meta=phases.map(ph=>({n:getNumSteps(ph.elements||[]),get dur(){return this.n*STEP_DUR+PHASE_HOLD}}))
    const starts=[0]; for(let i=0;i<nP;i++) starts.push(starts[i]+meta[i].dur)
    const total=starts[nP], t0=performance.now()

    function frame(ts) {
      const el=ts-t0
      if(el>=total){renderer.render(scene,camera);setTimeout(stopAnim,800);return}
      let pi=nP-1; for(let i=0;i<nP;i++) if(el<starts[i+1]){pi=i;break}
      const pe=el-starts[pi], {n}=meta[pi]
      const si=Math.min(Math.floor(pe/STEP_DUR),n-1)
      const st=Math.min((pe-si*STEP_DUR)/STEP_MOVE_DUR,1), et=ease(st)
      const elems=phases[pi]?.elements||[]
      const {playerPos:basePos,carrierId:baseC}=accumulateSteps(elems,si,H_px,courtType)

      // build targets
      const tgts={}
      for(const e of elems){
        if(!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==si)continue
        let pid=e.fromId&&basePos[e.fromId]?e.fromId:null
        if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const bp=basePos[p.id];if(!bp)continue;const d=Math.hypot(bp.x-e.x1,bp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
        if(pid)tgts[pid]={x:e.x2,y:e.y2}
      }
      for(const e of elems){
        if(e.type!=='handoff'||(e.step??0)!==si)continue
        let p1=e.fromId&&basePos[e.fromId]?e.fromId:null
        if(!p1){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const bp=basePos[p.id];if(!bp)continue;const d=Math.hypot(bp.x-e.x1,bp.y-e.y1);if(d<bd){bd=d;bi=p.id}}p1=bi}
        if(!p1)continue
        let p2=null,bd=PR*3
        for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const bp=basePos[p.id];if(!bp)continue;const d=Math.hypot(bp.x-e.x2,bp.y-e.y2);if(d<bd){bd=d;p2=p.id}}
        if(!p2)continue
        tgts[p1]={x:basePos[p2].x,y:basePos[p2].y};tgts[p2]={x:basePos[p1].x,y:basePos[p1].y}
      }
      const hasBX=elems.some(e=>(e.type==='pass'||e.type==='handoff')&&(e.step??0)===si)
      for(const e of elems){
        if(!['defense','xdefense'].includes(e.type)||!e.num||tgts[e.id])continue
        const att=elems.find(x=>x.type==='offense'&&x.num===e.num)
        if(!att||!basePos[att.id])continue
        if(!tgts[att.id]&&!hasBX)continue
        const ae=tgts[att.id]||basePos[att.id]
        const be=baseC?(tgts[baseC]||basePos[baseC]):null
        const id=computeSmartDefPos(ae,be,courtType,H_px)
        tgts[e.id]={x:Math.max(PR+4,Math.min(CW-PR-4,id.x)),y:Math.max(PR+4,Math.min(H_px-PR-4,id.y))}
      }

      // update players
      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=basePos[e.id];if(!b)continue
        const t=tgts[e.id]||b
        const bp=p3(b.x,b.y),tp=p3(t.x,t.y)
        m.position.x=lerp(bp.x,tp.x,et); m.position.z=lerp(bp.z,tp.z,et)
        const dx=tp.x-bp.x,dz=tp.z-bp.z
        if(Math.hypot(dx,dz)>0.02) m.rotation.y=Math.atan2(dx,dz)
      }

      // ball position
      let bx=null,by=0.95,bz=null; ball.scale.setScalar(1)
      if(st>0&&baseC){
        const cB=basePos[baseC]
        // handoff
        const ho=elems.find(e=>e.type==='handoff'&&(e.step??0)===si&&tgts[e.fromId||''])
        if(ho&&cB&&tgts[ho.fromId]){
          const p1b=p3(basePos[ho.fromId]?.x??cB.x,basePos[ho.fromId]?.y??cB.y)
          const p2k=Object.keys(tgts).find(k=>k!==ho.fromId&&basePos[k]&&Math.hypot(basePos[k].x-ho.x2,basePos[k].y-ho.y2)<PR*3)
          if(p2k){const p2b=p3(basePos[p2k].x,basePos[p2k].y);if(et<0.5){bx=lerp(p1b.x,p2b.x,et);bz=lerp(p1b.z,p2b.z,et)}else{bx=lerp(p2b.x,p1b.x,et);bz=lerp(p2b.z,p1b.z,et)}}
        }
        // shot arc
        if(bx===null){
          const sh=elems.find(e=>e.type==='shot'&&(e.step??0)===si&&(e.fromId===baseC||!e.fromId))
          if(sh&&cB){
            const sp=p3(cB.x,cB.y),ep=p3(sh.x2,sh.y2)
            const dist=Math.hypot(ep.x-sp.x,ep.z-sp.z),arcH=dist*0.55
            bx=lerp(sp.x,ep.x,et);bz=lerp(sp.z,ep.z,et);by=0.95+arcH*Math.sin(et*Math.PI)
            const sc=et>0.8?Math.max(0.01,1-(et-0.8)/0.2):1; ball.scale.setScalar(sc)
          }
        }
        // pass
        if(bx===null){
          const pa=elems.find(e=>e.type==='pass'&&(e.step??0)===si&&e.fromId===baseC)
          if(pa&&cB){
            const ct=tgts[baseC],cx2d=ct?lerp(cB.x,ct.x,et):cB.x,cy2d=ct?lerp(cB.y,ct.y,et):cB.y
            const cp=p3(cx2d,cy2d),ep=p3(pa.x2,pa.y2)
            bx=lerp(cp.x,ep.x,et);bz=lerp(cp.z,ep.z,et);by=0.95
          }
        }
        // dribble bounce
        if(bx===null&&tgts[baseC]){
          const bp2=p3(cB.x,cB.y),tp2=p3(tgts[baseC].x,tgts[baseC].y)
          bx=lerp(bp2.x,tp2.x,et);bz=lerp(bp2.z,tp2.z,et);by=0.95+Math.abs(Math.sin(et*Math.PI*4))*0.2
        }
        if(bx===null){const cp=p3(cB.x,cB.y);bx=cp.x;bz=cp.z}
      }
      if(bx!==null) ball.position.set(bx,by,bz)

      // follow-ball camera
      if(camMode==='follow'&&bx!==null){camera.position.set(bx,7,bz-4.5);camera.lookAt(bx,1,bz+2.5)}

      renderer.render(scene,camera)
      animRef.current=requestAnimationFrame(frame)
    }
    animRef.current=requestAnimationFrame(frame)
  }

  function toggleCam(mode) {
    setCamMode(mode)
    const s=stateRef.current; if(!s)return
    setCamera(s.camera,mode,H_m,W_m)
    if(!playing) s.renderer.render(s.scene,s.camera)
  }

  async function exportVideo() {
    const s=stateRef.current; if(!s||recording||typeof MediaRecorder==='undefined')return
    const stream=s.renderer.domElement.captureStream(30)
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'
    const rec=new MediaRecorder(stream,{mimeType:mime})
    const chunks=[]; rec.ondataavailable=e=>chunks.push(e.data)
    rec.onstop=()=>{
      const blob=new Blob(chunks,{type:'video/webm'})
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url;a.download='jugada-3d.webm';a.click()
      URL.revokeObjectURL(url);setRecording(false)
    }
    setRecording(true);rec.start()
    const totalMs=phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements||[])*STEP_DUR+PHASE_HOLD,0)+1200
    startAnim()
    setTimeout(()=>{stopAnim();rec.stop()},totalMs)
  }

  /* ── render ──────────────────────────────────────────────── */
  if(initError) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:'#e5e7eb',background:'#0f172a'}}>
      <div style={{fontSize:36}}>⚠️</div>
      <p style={{color:'#9ca3af',fontSize:13,margin:0,maxWidth:360,textAlign:'center'}}>Error al iniciar la vista 3D: {initError}</p>
    </div>
  )

  const btn=(active)=>({padding:'7px 13px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:active?'#3b82f6':'#1f2937',color:active?'#fff':'#9ca3af',transition:'all 0.15s'})

  return (
    <div style={{position:'relative',width:'100%',height:'100%',background:'#070b12',display:'flex',flexDirection:'column'}}>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}} />

      {/* controls */}
      <div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:9,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(12px)',padding:'10px 16px',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={playing?stopAnim:startAnim} style={{padding:'9px 22px',borderRadius:10,border:'none',cursor:'pointer',background:playing?'#f59e0b':'#3b82f6',color:'#fff',fontWeight:700,fontSize:13,boxShadow:playing?'none':'0 4px 16px rgba(59,130,246,0.4)'}}>
          {playing?'⏹ Parar':'▶ Reproducir'}
        </button>
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.12)'}}/>
        <span style={{color:'rgba(255,255,255,0.3)',fontSize:10,fontWeight:700,letterSpacing:0.8}}>CÁMARA</span>
        {[['overview','Táctica'],['follow','Balón'],['cinematic','TV']].map(([m,l])=>(
          <button key={m} onClick={()=>toggleCam(m)} style={btn(camMode===m)}>{l}</button>
        ))}
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.12)'}}/>
        <button onClick={exportVideo} disabled={recording} style={{padding:'7px 14px',borderRadius:8,border:'none',cursor:recording?'not-allowed':'pointer',background:recording?'#374151':'#7c3aed',color:'#fff',fontWeight:700,fontSize:12}}>
          {recording?'⏺ Grabando...':'🎬 Exportar'}
        </button>
      </div>

      <div style={{position:'absolute',top:12,left:14,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',padding:'5px 12px',borderRadius:8,color:'rgba(255,255,255,0.5)',fontSize:11,fontWeight:600,border:'1px solid rgba(255,255,255,0.07)'}}>
        {phases.length} fase{phases.length!==1?'s':''} · {courtType==='full'?'Pista completa':'Media pista'}
      </div>
    </div>
  )
}
