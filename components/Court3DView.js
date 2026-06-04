'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

/* ── constants ───────────────────────────────────────────────── */
const CW = 560, HALF_H = 520, FULL_H = 970, PR = 20
const ARROW_TYPES      = ['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES     = ['offense','defense','xdefense']
const MOVE_ARROW_TYPES = ['dribble','cut','screen']
const STEP_MOVE_DUR = 1000, STEP_HOLD_DUR = 300
const STEP_DUR = STEP_MOVE_DUR + STEP_HOLD_DUR, PHASE_HOLD = 500
const S = 15 / CW

function getH(ct)    { return ct === 'full' ? FULL_H : HALF_H }
function ease(t)     { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }
function lerp(a,b,t) { return a + (b-a)*t }
function p3(px,py)   { return { x:(px-CW/2)*S, z:py*S } }

/* ── duplicated game logic ───────────────────────────────────── */
function getNumSteps(elems) {
  let max = -1
  for (const e of elems) if (ARROW_TYPES.includes(e.type)) max = Math.max(max, e.step ?? 0)
  return Math.max(1, max + 1)
}
function computeSmartDefPos(attPos, ballPos, courtType, courtH) {
  const mg=22,halfH=courtType==='full'?Math.round(courtH/2):courtH
  const sy=(halfH-2*mg)/14,rimY=mg+1.575*sy,ftY=mg+5.8*sy
  const useBot=courtType==='full'&&attPos.y>courtH/2
  const basketY=useBot?courtH-rimY:rimY,paintY=useBot?courtH-(rimY+ftY)/2:(rimY+ftY)/2
  const dxB=CW/2-attPos.x,dyB=basketY-attPos.y,distB=Math.hypot(dxB,dyB)||1
  const OFFSET=Math.min(46,distB*0.32)
  const primX=attPos.x+(dxB/distB)*OFFSET,primY=attPos.y+(dyB/distB)*OFFSET
  if(!ballPos)return{x:primX,y:primY}
  const distBall=Math.hypot(ballPos.x-attPos.x,ballPos.y-attPos.y)
  if(distBall<55)return{x:primX,y:primY}
  const sag=Math.min(0.60,(distBall-55)/305)
  return{x:primX+(attPos.x+(CW/2-attPos.x)*0.35-primX)*sag,y:primY+(attPos.y+(paintY-attPos.y)*0.48-primY)*sag}
}
function accumulateSteps(elems,throughStep,courtH=FULL_H,courtType='half'){
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
  const cx=v=>cl(v,PR+4,CW-PR-4),cy=v=>cl(v,PR+4,courtH-PR-4)
  const pos={}
  for(const e of elems)if(!ARROW_TYPES.includes(e.type))pos[e.id]={x:e.x,y:e.y}
  let carrier=null
  for(const e of elems)if(PLAYER_TYPES.includes(e.type)&&e.hasBall){carrier=e.id;break}
  for(let s=0;s<throughStep;s++){
    const moves={}
    for(const e of elems){
      if(!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==s)continue
      let pid=e.fromId&&pos[e.fromId]?e.fromId:null
      if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
      if(!pid||!pos[pid])continue
      const b=pos[pid];moves[pid]={dx:e.x2-b.x,dy:e.y2-b.y};pos[pid]={x:e.x2,y:e.y2}
    }
    for(const e of elems){
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
  return{playerPos:pos,carrierId:carrier}
}

/* ── court texture ───────────────────────────────────────────── */
function makeCourtTex(courtType) {
  const H_px=getH(courtType),TW=2048,TH=Math.round(2048*H_px/CW)
  const c=document.createElement('canvas');c.width=TW;c.height=TH
  const ctx=c.getContext('2d')

  // Rich parquet — alternating plank bands
  const plankW=TW/26
  for(let i=0;i<26;i++){
    const lum=i%2===0?0:8
    ctx.fillStyle=`rgb(${178+lum},${105+lum},${42+lum})`
    ctx.fillRect(i*plankW,0,plankW,TH)
  }
  // subtle horizontal grain lines
  ctx.globalAlpha=0.06
  ctx.strokeStyle='#000';ctx.lineWidth=1
  for(let y=0;y<TH;y+=TH/55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(TW,y);ctx.stroke()}
  // plank separators
  ctx.globalAlpha=0.18
  for(let i=0;i<=26;i++){ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(i*plankW,0);ctx.lineTo(i*plankW,TH);ctx.stroke()}
  ctx.globalAlpha=1

  // court lines
  ctx.save();ctx.scale(TW/CW,TH/H_px)
  const mg=22,sx=(CW-2*mg)/15,sy=(H_px-2*mg)/14,s=(sx+sy)/2
  ctx.strokeStyle='rgba(255,255,255,0.95)';ctx.lineWidth=2.5
  ctx.strokeRect(mg,mg,CW-2*mg,H_px-2*mg)
  const pW=4.9*sx,pH=5.8*sy,pX=(CW-pW)/2,pY=mg
  ctx.strokeRect(pX,pY,pW,pH)
  ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(CW/2-0.915*sx,pY+2);ctx.lineTo(CW/2+0.915*sx,pY+2);ctx.stroke();ctx.lineWidth=2.5
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
    ctx.strokeStyle='rgba(255,255,255,0.95)';ctx.lineWidth=2.5
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
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=8
  return tex
}

/* ── 3D scene builders ───────────────────────────────────────── */
function buildCourt(scene, courtType) {
  const H_px=getH(courtType),W_m=CW*S,H_m=H_px*S
  const tex=makeCourtTex(courtType)
  const floor=new THREE.Mesh(
    new THREE.PlaneGeometry(W_m,H_m),
    new THREE.MeshStandardMaterial({map:tex,roughness:0.38,metalness:0.04})
  )
  floor.rotation.x=-Math.PI/2;floor.position.set(0,0,H_m/2);floor.receiveShadow=true;scene.add(floor)

  // Court sidelines raised strip
  const bMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5})
  ;[
    [W_m+0.08,0.025,0.08,0,0.012,0],[W_m+0.08,0.025,0.08,0,0.012,H_m],
    [0.08,0.025,H_m,-W_m/2,0.012,H_m/2],[0.08,0.025,H_m,W_m/2,0.012,H_m/2],
  ].forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bMat);m.position.set(x,y,z);scene.add(m)})

  // Dark surround (arena floor outside court)
  const surround=new THREE.Mesh(
    new THREE.PlaneGeometry(W_m+12,H_m+12),
    new THREE.MeshStandardMaterial({color:0x060a10,roughness:0.9,metalness:0.0})
  )
  surround.rotation.x=-Math.PI/2;surround.position.set(0,-0.005,H_m/2);scene.add(surround)

  addHoop(scene,courtType,H_m,false)
  if(courtType==='full') addHoop(scene,courtType,H_m,true)
}

function addHoop(scene,courtType,H_m,flipped){
  const H_px=getH(courtType),mg=22,halfH=courtType==='full'?Math.round(H_px/2):H_px
  const sy=(halfH-2*mg)/14,rimY_px=mg+1.575*sy
  const rimZ=flipped?H_m-rimY_px*S:rimY_px*S
  const RIM_H=3.05,RIM_R=0.225
  const dir=flipped?1:-1

  // Pole
  const poleMat=new THREE.MeshStandardMaterial({color:0x888888,roughness:0.4,metalness:0.6})
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,3.8,10),poleMat)
  pole.position.set(0,1.9,rimZ+dir*1.0);scene.add(pole)
  // Arm connecting pole to backboard
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,1.0),poleMat)
  arm.position.set(0,3.6,rimZ+dir*0.5);scene.add(arm)

  // Backboard — frosted glass look
  const bbMat=new THREE.MeshPhongMaterial({color:0xaaccff,transparent:true,opacity:0.28,shininess:120,specular:0x4488ff})
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.83,1.07,0.05),bbMat)
  bb.position.set(0,RIM_H+0.53,rimZ+dir*0.15);scene.add(bb)
  // Backboard frame
  const fMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.2})
  const makeEdge=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fMat);m.position.set(x,y,z);scene.add(m)}
  const bx=0,by=RIM_H+0.53,bz=rimZ+dir*0.15
  makeEdge(1.88,0.06,0.06,bx,by+0.53,bz);makeEdge(1.88,0.06,0.06,bx,by-0.53,bz)
  makeEdge(0.06,1.12,0.06,bx-0.93,by,bz);makeEdge(0.06,1.12,0.06,bx+0.93,by,bz)
  // Orange inner square
  const ib=new THREE.Mesh(new THREE.BoxGeometry(0.59,0.45,0.06),new THREE.MeshStandardMaterial({color:0xff6600,roughness:0.5,emissive:0x331100}))
  ib.position.set(bx,by,bz+dir*0.01);scene.add(ib)

  // Rim — bright orange, metallic
  const rimMat=new THREE.MeshStandardMaterial({color:0xff5500,roughness:0.3,metalness:0.5,emissive:0x220d00})
  const rim=new THREE.Mesh(new THREE.TorusGeometry(RIM_R,0.023,10,36),rimMat)
  rim.rotation.x=Math.PI/2;rim.position.set(0,RIM_H,rimZ);rim.castShadow=true;scene.add(rim)

  // Net (cone wireframe, tinted)
  const netMat=new THREE.MeshBasicMaterial({color:0xdddddd,transparent:true,opacity:0.3,wireframe:true,side:THREE.DoubleSide})
  const net=new THREE.Mesh(new THREE.ConeGeometry(RIM_R,0.45,16,4,true),netMat)
  net.position.set(0,RIM_H-0.22,rimZ);scene.add(net)
}

/* ── Player: modern top-view-optimised design ─────────────────
   Viewed from above: coloured disk + visible number on top
   Viewed from side:  athletic capsule shape
────────────────────────────────────────────────────────────── */
function createPlayer(isOffense, num) {
  const group=new THREE.Group()

  // Team colours
  const jerseyHex = isOffense ? 0x0d1b2a : 0xf2f2f2
  const accentHex = isOffense ? 0x1a6bff : 0xe63946   // blue accent vs red accent
  const shortsHex = isOffense ? 0x162032 : 0xd0d0d0
  const skinHex   = isOffense ? 0x7d5041 : 0xf0c89a

  const jMat =new THREE.MeshStandardMaterial({color:jerseyHex,roughness:0.7,metalness:0.0})
  const aMat =new THREE.MeshStandardMaterial({color:accentHex,roughness:0.6,metalness:0.1,emissive:accentHex,emissiveIntensity:0.12})
  const sMat =new THREE.MeshStandardMaterial({color:shortsHex,roughness:0.8})
  const skMat=new THREE.MeshStandardMaterial({color:skinHex,  roughness:0.75})

  // Shadow ring on floor
  const shadowRing=new THREE.Mesh(
    new THREE.CircleGeometry(0.35,24),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.30})
  )
  shadowRing.rotation.x=-Math.PI/2;shadowRing.position.set(0,0.002,0);group.add(shadowRing)

  // Shoes
  const shoeMat=new THREE.MeshStandardMaterial({color:isOffense?0x111111:0x333333,roughness:0.6,metalness:0.1})
  ;[[-0.1,0],[0.1,0]].forEach(([ox])=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.09,0.30),shoeMat)
    shoe.position.set(ox,0.045,0.02);group.add(shoe)
  })
  // Calves / Legs
  ;[[-0.11,0],[0.11,0]].forEach(([ox])=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.08,0.78,9),sMat)
    leg.position.set(ox,0.48,0);group.add(leg)
  })
  // Torso — wider at shoulder
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.21,0.72,10),jMat)
  torso.position.set(0,1.24,0);torso.castShadow=true;group.add(torso)
  // Accent stripe on torso sides
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.285,0.215,0.14,10),aMat)
  stripe.position.set(0,1.32,0);group.add(stripe)
  // Arms
  ;[[-1,1],[1,1]].forEach(([sx])=>{
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.08,0.42,8),jMat)
    upper.rotation.z=sx*0.58;upper.position.set(sx*0.4,1.18,0);group.add(upper)
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.085,8,8),skMat)
    hand.position.set(sx*0.53,0.98,0);group.add(hand)
  })
  // Neck
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.1,0.15,8),skMat)
  neck.position.set(0,1.67,0);group.add(neck)
  // Head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.215,14,14),skMat)
  head.position.set(0,1.93,0);head.castShadow=true;group.add(head)
  // Hair band (adds character)
  const hair=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.045,6,20),new THREE.MeshStandardMaterial({color:isOffense?0x000000:0x333333,roughness:0.9}))
  hair.rotation.x=Math.PI/2;hair.position.set(0,2.02,0);group.add(hair)

  // ── Number plate ON TOP (visible from overhead camera) ──────
  const nc=document.createElement('canvas');nc.width=160;nc.height=160
  const nctx=nc.getContext('2d')
  // circle bg
  nctx.beginPath();nctx.arc(80,80,72,0,Math.PI*2)
  nctx.fillStyle=isOffense?'#0d1b2a':'#f2f2f2';nctx.fill()
  nctx.strokeStyle=isOffense?'#1a6bff':'#e63946';nctx.lineWidth=8;nctx.stroke()
  // number
  nctx.fillStyle=isOffense?'#ffffff':'#0d1b2a'
  nctx.font='bold 78px Arial,sans-serif';nctx.textAlign='center';nctx.textBaseline='middle'
  nctx.fillText(String(num??''),80,84)
  const numTop=new THREE.Mesh(
    new THREE.CircleGeometry(0.28,24),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(nc),transparent:true,depthWrite:false})
  )
  numTop.rotation.x=-Math.PI/2;numTop.position.set(0,2.16,0);group.add(numTop)

  // ── Number on chest (visible from side camera) ──────────────
  const nc2=document.createElement('canvas');nc2.width=128;nc2.height=96
  const nc2ctx=nc2.getContext('2d')
  nc2ctx.fillStyle=isOffense?'#0d1b2a':'#f2f2f2';nc2ctx.fillRect(0,0,128,96)
  nc2ctx.fillStyle=isOffense?'#ffffff':'#111827'
  nc2ctx.font='bold 60px Arial,sans-serif';nc2ctx.textAlign='center';nc2ctx.textBaseline='middle'
  nc2ctx.fillText(String(num??''),64,50)
  const numChest=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.26),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(nc2),transparent:true,depthWrite:false}))
  numChest.position.set(0,1.22,0.29);group.add(numChest)

  return group
}

function createBall(scene) {
  const ball=new THREE.Mesh(
    new THREE.SphereGeometry(0.12,20,20),
    new THREE.MeshStandardMaterial({color:0xff7518,roughness:0.55,metalness:0.0,emissive:0x3d1800,emissiveIntensity:0.15})
  )
  ball.castShadow=true
  // seam lines
  const lMat=new THREE.LineBasicMaterial({color:0x1a0800,linewidth:1})
  const mkCircle=()=>new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    Array.from({length:41},(_,i)=>new THREE.Vector3(Math.cos(i/40*Math.PI*2)*0.123,0,Math.sin(i/40*Math.PI*2)*0.123))
  ),lMat)
  const eq=mkCircle();ball.add(eq)
  const m1=mkCircle();m1.rotation.z=Math.PI/2;ball.add(m1)
  const m2=mkCircle();m2.rotation.x=Math.PI/2;ball.add(m2)

  // Subtle glow point light attached to ball
  const glow=new THREE.PointLight(0xff6600,0.8,3.5)
  glow.position.set(0,0,0);ball.add(glow)

  scene.add(ball)
  return ball
}

/* ── camera presets ──────────────────────────────────────────── */
const CAM = {
  overview: (cam, H_m, W_m, fov) => {
    // Bird's-eye: directly above, looking straight down + tiny tilt
    cam.fov = fov || 40
    cam.updateProjectionMatrix()
    cam.position.set(0, 22, H_m/2 - 1.5)
    cam.lookAt(0, 0, H_m/2)
  },
  follow: (cam, H_m) => {
    cam.fov = 55; cam.updateProjectionMatrix()
    cam.position.set(0, 9, H_m*0.3)
    cam.lookAt(0, 0, H_m*0.55)
  },
  cinematic: (cam, H_m, W_m) => {
    cam.fov = 48; cam.updateProjectionMatrix()
    cam.position.set(W_m*0.72, 7, H_m/2)
    cam.lookAt(0, 1, H_m/2)
  },
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

  const H_px=getH(courtType), H_m=H_px*S, W_m=CW*S

  /* ── init ──────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas) return
    let renderer, ro
    try {
      const W=canvas.clientWidth||900, H=canvas.clientHeight||540
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true})
      renderer.setSize(W,H,false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
      renderer.shadowMap.enabled=true
      renderer.shadowMap.type=THREE.PCFSoftShadowMap
      renderer.toneMapping=THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure=1.25
      renderer.outputColorSpace=THREE.SRGBColorSpace

      const scene=new THREE.Scene()
      scene.background=new THREE.Color(0x05080f)
      scene.fog=new THREE.FogExp2(0x05080f,0.018)

      // ── Lighting: modern arena ─────────────────────────────
      // Warm ambient
      scene.add(new THREE.AmbientLight(0xfff0d8,0.55))
      // 4 main arena spotlights from high up
      ;[[0,20,H_m*0.18],[0,20,H_m*0.82],[-W_m*0.42,18,H_m/2],[W_m*0.42,18,H_m/2]].forEach(([x,y,z])=>{
        const dl=new THREE.DirectionalLight(0xfff5e0,0.7)
        dl.position.set(x,y,z);dl.castShadow=true
        dl.shadow.mapSize.set(1024,1024);dl.shadow.camera.near=1;dl.shadow.camera.far=40
        dl.shadow.camera.left=-12;dl.shadow.camera.right=12
        dl.shadow.camera.top=12;dl.shadow.camera.bottom=-12
        scene.add(dl)
      })
      // Cool blue fill from below
      const fl=new THREE.HemisphereLight(0x334466,0xc88030,0.35); scene.add(fl)
      // Side accent lights (arena rim)
      const sl1=new THREE.PointLight(0x2244aa,0.5,25); sl1.position.set(-W_m*0.7,3,H_m/2); scene.add(sl1)
      const sl2=new THREE.PointLight(0x2244aa,0.5,25); sl2.position.set( W_m*0.7,3,H_m/2); scene.add(sl2)

      buildCourt(scene,courtType)

      const camera=new THREE.PerspectiveCamera(40,W/H,0.1,200)
      CAM.overview(camera,H_m,W_m)

      // Players
      const playerMeshes={}
      const elems0=phases[0]?.elements||[]
      for(const el of elems0){
        if(!PLAYER_TYPES.includes(el.type))continue
        const mesh=createPlayer(el.type==='offense',el.num??'?')
        const {x,z}=p3(el.x,el.y);mesh.position.set(x,0,z)
        scene.add(mesh);playerMeshes[el.id]=mesh
      }

      const ball=createBall(scene)
      const ic=elems0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
      if(ic){const {x,z}=p3(ic.x,ic.y);ball.position.set(x,0.95,z)}
      else{const {x,z}=p3(CW/2,H_px*0.4);ball.position.set(x,0.95,z)}

      stateRef.current={renderer,scene,camera,playerMeshes,ball}
      renderer.render(scene,camera)
      setInitError(null)

      ro=new ResizeObserver(()=>{
        const w=canvas.clientWidth,h=canvas.clientHeight
        renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)
      });ro.observe(canvas)
    } catch(e) {
      console.error('3D init error:',e);setInitError(e.message||String(e))
    }
    return()=>{cancelAnimationFrame(animRef.current);ro?.disconnect();try{renderer?.dispose()}catch(_){};stateRef.current=null}
  },[phases,courtType]) // eslint-disable-line

  /* ── animation ─────────────────────────────────────────────── */
  function stopAnim() {
    cancelAnimationFrame(animRef.current);setPlaying(false)
    const s=stateRef.current;if(!s)return
    const e0=phases[0]?.elements||[]
    for(const el of e0){if(!PLAYER_TYPES.includes(el.type))continue;const m=s.playerMeshes[el.id];if(!m)continue;const{x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.y=0}
    const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(ic){const{x,z}=p3(ic.x,ic.y);s.ball.position.set(x,0.95,z)}
    s.ball.scale.setScalar(1)
    s.renderer.render(s.scene,s.camera)
  }

  function startAnim() {
    const s=stateRef.current;if(!s||playing)return
    setPlaying(true)
    const{renderer,scene,camera,playerMeshes,ball}=s
    const nP=phases.length
    const meta=phases.map(ph=>({n:getNumSteps(ph.elements||[]),get dur(){return this.n*STEP_DUR+PHASE_HOLD}}))
    const starts=[0];for(let i=0;i<nP;i++)starts.push(starts[i]+meta[i].dur)
    const total=starts[nP],t0=performance.now()

    function frame(ts){
      const el=ts-t0
      if(el>=total){renderer.render(scene,camera);setTimeout(stopAnim,800);return}
      let pi=nP-1;for(let i=0;i<nP;i++)if(el<starts[i+1]){pi=i;break}
      const pe=el-starts[pi],{n}=meta[pi]
      const si=Math.min(Math.floor(pe/STEP_DUR),n-1)
      const st=Math.min((pe-si*STEP_DUR)/STEP_MOVE_DUR,1),et=ease(st)
      const elems=phases[pi]?.elements||[]
      const{playerPos:basePos,carrierId:baseC}=accumulateSteps(elems,si,H_px,courtType)
      const tgts={}
      // regular moves
      for(const e of elems){
        if(!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==si)continue
        let pid=e.fromId&&basePos[e.fromId]?e.fromId:null
        if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const bp=basePos[p.id];if(!bp)continue;const d=Math.hypot(bp.x-e.x1,bp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
        if(pid)tgts[pid]={x:e.x2,y:e.y2}
      }
      // handoff
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
      // smart defense
      const hasBX=elems.some(e=>(e.type==='pass'||e.type==='handoff')&&(e.step??0)===si)
      for(const e of elems){
        if(!['defense','xdefense'].includes(e.type)||!e.num||tgts[e.id])continue
        const att=elems.find(x=>x.type==='offense'&&x.num===e.num)
        if(!att||!basePos[att.id])continue
        if(!tgts[att.id]&&!hasBX)continue
        const ae=tgts[att.id]||basePos[att.id],be=baseC?(tgts[baseC]||basePos[baseC]):null
        const id2=computeSmartDefPos(ae,be,courtType,H_px)
        tgts[e.id]={x:Math.max(PR+4,Math.min(CW-PR-4,id2.x)),y:Math.max(PR+4,Math.min(H_px-PR-4,id2.y))}
      }
      // move players
      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=basePos[e.id];if(!b)continue
        const t=tgts[e.id]||b
        const bp=p3(b.x,b.y),tp=p3(t.x,t.y)
        m.position.x=lerp(bp.x,tp.x,et);m.position.z=lerp(bp.z,tp.z,et)
        const dx=tp.x-bp.x,dz=tp.z-bp.z
        if(Math.hypot(dx,dz)>0.02)m.rotation.y=Math.atan2(dx,dz)
      }
      // ball
      let bx=null,by=0.95,bz=null;ball.scale.setScalar(1)
      if(st>0&&baseC){
        const cB=basePos[baseC]
        const ho=elems.find(e=>e.type==='handoff'&&(e.step??0)===si&&tgts[e.fromId||''])
        if(ho&&cB&&tgts[ho.fromId]){
          const p1b=p3(basePos[ho.fromId]?.x??cB.x,basePos[ho.fromId]?.y??cB.y)
          const p2k=Object.keys(tgts).find(k=>k!==ho.fromId&&basePos[k]&&Math.hypot(basePos[k].x-ho.x2,basePos[k].y-ho.y2)<PR*3)
          if(p2k){const p2b=p3(basePos[p2k].x,basePos[p2k].y);if(et<0.5){bx=lerp(p1b.x,p2b.x,et);bz=lerp(p1b.z,p2b.z,et)}else{bx=lerp(p2b.x,p1b.x,et);bz=lerp(p2b.z,p1b.z,et)}}
        }
        if(bx===null){
          const sh=elems.find(e=>e.type==='shot'&&(e.step??0)===si&&(e.fromId===baseC||!e.fromId))
          if(sh&&cB){
            const sp=p3(cB.x,cB.y),ep=p3(sh.x2,sh.y2),dist=Math.hypot(ep.x-sp.x,ep.z-sp.z)
            bx=lerp(sp.x,ep.x,et);bz=lerp(sp.z,ep.z,et);by=0.95+dist*0.55*Math.sin(et*Math.PI)
            const sc=et>0.8?Math.max(0.01,1-(et-0.8)/0.2):1;ball.scale.setScalar(sc)
          }
        }
        if(bx===null){
          const pa=elems.find(e=>e.type==='pass'&&(e.step??0)===si&&e.fromId===baseC)
          if(pa&&cB){
            const ct=tgts[baseC],cx2d=ct?lerp(cB.x,ct.x,et):cB.x,cy2d=ct?lerp(cB.y,ct.y,et):cB.y
            const cp=p3(cx2d,cy2d),ep=p3(pa.x2,pa.y2)
            bx=lerp(cp.x,ep.x,et);bz=lerp(cp.z,ep.z,et);by=0.95
          }
        }
        if(bx===null&&tgts[baseC]){
          const bp2=p3(cB.x,cB.y),tp2=p3(tgts[baseC].x,tgts[baseC].y)
          bx=lerp(bp2.x,tp2.x,et);bz=lerp(bp2.z,tp2.z,et);by=0.95+Math.abs(Math.sin(et*Math.PI*5))*0.22
        }
        if(bx===null){const cp=p3(cB.x,cB.y);bx=cp.x;bz=cp.z}
      }
      if(bx!==null)ball.position.set(bx,by,bz)
      if(camMode==='follow'&&bx!==null){camera.position.set(bx,10,bz-5);camera.lookAt(bx,0,bz+2.5)}
      renderer.render(scene,camera)
      animRef.current=requestAnimationFrame(frame)
    }
    animRef.current=requestAnimationFrame(frame)
  }

  function toggleCam(mode){
    setCamMode(mode)
    const s=stateRef.current;if(!s)return
    CAM[mode]?.(s.camera,H_m,W_m)
    s.camera.aspect=canvasRef.current.clientWidth/canvasRef.current.clientHeight
    s.camera.updateProjectionMatrix()
    if(!playing)s.renderer.render(s.scene,s.camera)
  }

  async function exportVideo(){
    const s=stateRef.current;if(!s||recording||typeof MediaRecorder==='undefined')return
    const stream=s.renderer.domElement.captureStream(30)
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'
    const rec=new MediaRecorder(stream,{mimeType:mime})
    const chunks=[];rec.ondataavailable=e=>chunks.push(e.data)
    rec.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jugada-3d.webm';a.click();URL.revokeObjectURL(url);setRecording(false)}
    setRecording(true);rec.start()
    const totalMs=phases.reduce((acc,ph)=>acc+getNumSteps(ph.elements||[])*STEP_DUR+PHASE_HOLD,0)+1400
    startAnim()
    setTimeout(()=>{stopAnim();rec.stop()},totalMs)
  }

  if(initError)return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:'#e5e7eb',background:'#0f172a'}}>
      <div style={{fontSize:36}}>⚠️</div>
      <p style={{color:'#9ca3af',fontSize:13,margin:0,maxWidth:360,textAlign:'center'}}>Error 3D: {initError}</p>
    </div>
  )

  const btn=active=>({padding:'7px 14px',borderRadius:8,border:`1px solid ${active?'#3b82f6':'rgba(255,255,255,0.1)'}`,cursor:'pointer',fontWeight:600,fontSize:12,background:active?'rgba(59,130,246,0.2)':'transparent',color:active?'#60a5fa':'rgba(255,255,255,0.5)',transition:'all 0.15s'})

  return(
    <div style={{position:'relative',width:'100%',height:'100%',background:'#05080f',display:'flex',flexDirection:'column'}}>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
      <div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:8,background:'rgba(5,8,15,0.88)',backdropFilter:'blur(16px)',padding:'10px 16px',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={playing?stopAnim:startAnim} style={{padding:'9px 24px',borderRadius:10,border:'none',cursor:'pointer',background:playing?'#f59e0b':'#3b82f6',color:'#fff',fontWeight:700,fontSize:13,boxShadow:playing?'none':'0 4px 20px rgba(59,130,246,0.5)'}}>
          {playing?'⏹ Parar':'▶ Reproducir'}
        </button>
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.1)'}}/>
        <span style={{color:'rgba(255,255,255,0.25)',fontSize:10,fontWeight:700,letterSpacing:1}}>CÁMARA</span>
        {[['overview','Cenital'],['follow','Balón'],['cinematic','TV']].map(([m,l])=>(
          <button key={m} onClick={()=>toggleCam(m)} style={btn(camMode===m)}>{l}</button>
        ))}
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.1)'}}/>
        <button onClick={exportVideo} disabled={recording} style={{padding:'7px 16px',borderRadius:8,border:'none',cursor:recording?'not-allowed':'pointer',background:recording?'#374151':'#7c3aed',color:'#fff',fontWeight:700,fontSize:12}}>
          {recording?'⏺ Grabando...':'🎬 Exportar'}
        </button>
      </div>
      <div style={{position:'absolute',top:12,left:14,background:'rgba(5,8,15,0.7)',backdropFilter:'blur(8px)',padding:'5px 12px',borderRadius:8,color:'rgba(255,255,255,0.35)',fontSize:11,fontWeight:600,border:'1px solid rgba(255,255,255,0.06)'}}>
        {phases.length} fase{phases.length!==1?'s':''} · {courtType==='full'?'Pista completa':'Media pista'}
      </div>
    </div>
  )
}
