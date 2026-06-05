'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/* ── constants ───────────────────────────────────────────────── */
const CW=560,HALF_H=520,FULL_H=970,PR=20
const ARROW_TYPES=['dribble','pass','cut','shot','handoff','screen']
const PLAYER_TYPES=['offense','defense','xdefense']
const MOVE_ARROW_TYPES=['dribble','cut','screen']
const STEP_MOVE_DUR=1000,STEP_HOLD_DUR=300
const STEP_DUR=STEP_MOVE_DUR+STEP_HOLD_DUR,PHASE_HOLD=500
const S=15/CW

function getH(ct){return ct==='full'?FULL_H:HALF_H}
function ease(t){return t<0.5?2*t*t:-1+(4-2*t)*t}
function lerp(a,b,t){return a+(b-a)*t}
function p3(px,py){return{x:(px-CW/2)*S,z:py*S}}

/* ── game logic ──────────────────────────────────────────────── */
function getNumSteps(e){let m=-1;for(const x of e)if(ARROW_TYPES.includes(x.type))m=Math.max(m,x.step??0);return Math.max(1,m+1)}
function computeSmartDefPos(a,b,ct,ch){
  const mg=22,hh=ct==='full'?Math.round(ch/2):ch,sy=(hh-2*mg)/14,rimY=mg+1.575*sy,ftY=mg+5.8*sy
  const useBot=ct==='full'&&a.y>ch/2,bsY=useBot?ch-rimY:rimY,ptY=useBot?ch-(rimY+ftY)/2:(rimY+ftY)/2
  const dxB=CW/2-a.x,dyB=bsY-a.y,dB=Math.hypot(dxB,dyB)||1,O=Math.min(46,dB*0.32)
  const px=a.x+(dxB/dB)*O,py=a.y+(dyB/dB)*O
  if(!b)return{x:px,y:py}
  const db=Math.hypot(b.x-a.x,b.y-a.y);if(db<55)return{x:px,y:py}
  const sag=Math.min(0.60,(db-55)/305)
  return{x:px+(a.x+(CW/2-a.x)*0.35-px)*sag,y:py+(a.y+(ptY-a.y)*0.48-py)*sag}
}
function accumulateSteps(elems,through,courtH=FULL_H,courtType='half'){
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
  const cx=v=>cl(v,PR+4,CW-PR-4),cy=v=>cl(v,PR+4,courtH-PR-4)
  const pos={};for(const e of elems)if(!ARROW_TYPES.includes(e.type))pos[e.id]={x:e.x,y:e.y}
  let car=null;for(const e of elems)if(PLAYER_TYPES.includes(e.type)&&e.hasBall){car=e.id;break}
  for(let s=0;s<through;s++){
    const mv={}
    for(const e of elems){
      if(!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==s)continue
      let pid=e.fromId&&pos[e.fromId]?e.fromId:null
      if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
      if(!pid||!pos[pid])continue
      const b=pos[pid];mv[pid]={dx:e.x2-b.x,dy:e.y2-b.y};pos[pid]={x:e.x2,y:e.y2}
    }
    for(const e of elems){
      if(e.type!=='handoff'||(e.step??0)!==s)continue
      let p1=e.fromId&&pos[e.fromId]?e.fromId:null
      if(!p1){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}p1=bi}
      if(!p1)continue
      let p2=null,bd=PR*3
      for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x2,pp.y-e.y2);if(d<bd){bd=d;p2=p.id}}
      if(!p2)continue
      const a={...pos[p1]},b={...pos[p2]};mv[p1]={dx:b.x-a.x,dy:b.y-a.y};mv[p2]={dx:a.x-b.x,dy:a.y-b.y}
      pos[p1]={x:b.x,y:b.y};pos[p2]={x:a.x,y:a.y};if(car===p1)car=p2
    }
    if(car){const arr=elems.find(e=>e.type==='pass'&&(e.step??0)===s&&e.fromId===car);if(arr){let bd=PR+30,bi=null;for(const e of elems){if(!PLAYER_TYPES.includes(e.type)||e.id===car)continue;const p=pos[e.id]||{x:e.x,y:e.y};const d=Math.hypot(p.x-arr.x2,p.y-arr.y2);if(d<bd){bd=d;bi=e.id}}if(bi)car=bi}}
    const bp=car?pos[car]:null
    for(const e of elems){
      if(!['defense','xdefense'].includes(e.type)||!e.num)continue
      const manual=elems.some(x=>(MOVE_ARROW_TYPES.includes(x.type)||x.type==='handoff')&&(x.step??0)===s&&x.fromId===e.id)
      if(manual||!pos[e.id])continue
      const att=elems.find(x=>x.type==='offense'&&x.num===e.num);if(!att||!pos[att.id])continue
      const moved=!!mv[att.id]||!!mv[car]||elems.some(x=>x.type==='pass'&&(x.step??0)===s)
      if(!moved)continue
      const ideal=computeSmartDefPos(pos[att.id],bp,courtType,courtH)
      pos[e.id]={x:cx(ideal.x),y:cy(ideal.y)}
    }
  }
  return{playerPos:pos,carrierId:car}
}

/* ── court texture ───────────────────────────────────────────── */
function makeCourtTex(courtType){
  const H_px=getH(courtType),TW=2048,TH=Math.round(2048*H_px/CW)
  const c=document.createElement('canvas');c.width=TW;c.height=TH
  const ctx=c.getContext('2d')
  // Parquet de arce claro — pabellón bien iluminado
  const n=24
  for(let i=0;i<n;i++){
    const r=218+Math.sin(i*1.3)*8|0,g=148+Math.sin(i*0.9)*6|0,b=62+Math.sin(i*1.7)*5|0
    ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(i*TW/n,0,TW/n+1,TH)
  }
  // Veta de madera horizontal
  ctx.globalAlpha=0.04;ctx.strokeStyle='#5a3010';ctx.lineWidth=1.2
  for(let y=0;y<TH;y+=TH/80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(TW,y);ctx.stroke()}
  // Separadores entre tablones
  ctx.globalAlpha=0.18;ctx.lineWidth=2
  for(let i=0;i<=n;i++){ctx.beginPath();ctx.moveTo(i*TW/n,0);ctx.lineTo(i*TW/n,TH);ctx.stroke()}
  ctx.globalAlpha=1
  // Court lines
  ctx.save();ctx.scale(TW/CW,TH/H_px)
  const mg=22,sx=(CW-2*mg)/15,sy=(H_px-2*mg)/14,s=(sx+sy)/2
  ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=2.5
  ctx.strokeRect(mg,mg,CW-2*mg,H_px-2*mg)
  const pW=4.9*sx,pH=5.8*sy,pX=(CW-pW)/2,pY=mg
  ctx.fillStyle='rgba(200,130,40,0.1)';ctx.fillRect(pX,pY,pW,pH)
  ctx.strokeRect(pX,pY,pW,pH)
  ctx.lineWidth=4.8;ctx.beginPath();ctx.moveTo(CW/2-0.915*sx,pY+2);ctx.lineTo(CW/2+0.915*sx,pY+2);ctx.stroke();ctx.lineWidth=2.5
  const rimX=CW/2,rimY2=pY+1.575*sy,rimR=Math.max(0.225*s,13)
  ctx.beginPath();ctx.arc(rimX,rimY2,rimR,0,Math.PI*2);ctx.stroke()
  ctx.beginPath();ctx.arc(rimX,rimY2,1.25*s,0,Math.PI);ctx.stroke()
  const ftY2=pY+pH
  ctx.beginPath();ctx.moveTo(pX,ftY2);ctx.lineTo(pX+pW,ftY2);ctx.stroke()
  const ftR=1.8*s
  ctx.beginPath();ctx.arc(rimX,ftY2,ftR,Math.PI,0);ctx.stroke()
  ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY2,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
  ;[1.7,2.9,3.7,4.6].forEach(d=>{const my=pY+d*sy;if(my>rimY2+rimR+4&&my<ftY2-2){ctx.beginPath();ctx.moveTo(pX,my);ctx.lineTo(pX+10,my);ctx.stroke();ctx.beginPath();ctx.moveTo(pX+pW-10,my);ctx.lineTo(pX+pW,my);ctx.stroke()}})
  const a3R=6.75*sx,c3X=mg+0.9*sx,c3Xr=CW-c3X
  if(a3R>rimX-c3X+1){const sH=Math.sqrt(a3R**2-(rimX-c3X)**2);ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,rimY2+sH);ctx.stroke();ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,rimY2+sH);ctx.stroke();const a3=Math.asin((rimX-c3X)/a3R);ctx.beginPath();ctx.arc(rimX,rimY2,a3R,Math.PI/2-a3,Math.PI/2+a3);ctx.stroke()}
  if(courtType==='full'){
    ctx.beginPath();ctx.moveTo(mg,H_px/2);ctx.lineTo(CW-mg,H_px/2);ctx.stroke()
    ctx.beginPath();ctx.arc(CW/2,H_px/2,1.8*s,0,Math.PI*2);ctx.stroke()
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(CW/2,H_px/2,4,0,Math.PI*2);ctx.fill()
    ctx.save();ctx.translate(CW,H_px);ctx.rotate(Math.PI)
    ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=2.5
    ctx.fillStyle='rgba(200,130,40,0.1)';ctx.fillRect(pX,pY,pW,pH);ctx.strokeRect(pX,pY,pW,pH)
    ctx.beginPath();ctx.arc(rimX,rimY2,rimR,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,rimY2,1.25*s,0,Math.PI);ctx.stroke()
    ctx.beginPath();ctx.moveTo(pX,ftY2);ctx.lineTo(pX+pW,ftY2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,ftY2,ftR,Math.PI,0);ctx.stroke()
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY2,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
    if(a3R>rimX-c3X+1){const sH=Math.sqrt(a3R**2-(rimX-c3X)**2);ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,rimY2+sH);ctx.stroke();ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,rimY2+sH);ctx.stroke();const a3=Math.asin((rimX-c3X)/a3R);ctx.beginPath();ctx.arc(rimX,rimY2,a3R,Math.PI/2-a3,Math.PI/2+a3);ctx.stroke()}
    ctx.restore()
  }else{ctx.beginPath();ctx.arc(CW/2,H_px-mg,1.8*s,Math.PI,0);ctx.stroke()}
  ctx.restore()
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=8;return tex
}

/* ── basket ──────────────────────────────────────────────────── */
function addHoop(scene,courtType,H_m,flipped){
  const H_px=getH(courtType),mg=22,hh=courtType==='full'?Math.round(H_px/2):H_px
  const sy=(hh-2*mg)/14,rimZ=(flipped?H_m-( mg+1.575*sy)*S:(mg+1.575*sy)*S)
  const RH=3.05,RR=0.225,dir=flipped?1:-1
  const steel=new THREE.MeshStandardMaterial({color:0xcccccc,roughness:0.2,metalness:0.85})
  // Pole
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,4.2,10),steel);pole.position.set(0,2.1,rimZ+dir*1.1);scene.add(pole)
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,1.05),steel);arm.position.set(0,3.85,rimZ+dir*0.57);scene.add(arm)
  // Backboard
  const bbMat=new THREE.MeshPhongMaterial({color:0xb8d4ff,transparent:true,opacity:0.25,shininess:150,specular:0x6688cc})
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.83,1.07,0.04),bbMat);bb.position.set(0,RH+0.535,rimZ+dir*0.12);scene.add(bb)
  const fM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.5})
  const bx=0,by=RH+0.535,bz=rimZ+dir*0.12
  ;[[1.88,0.055,0.055,bx,by+0.537,bz],[1.88,0.055,0.055,bx,by-0.537,bz],[0.055,1.12,0.055,bx-0.935,by,bz],[0.055,1.12,0.055,bx+0.935,by,bz]]
    .forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fM);m.position.set(x,y,z);scene.add(m)})
  const sq=new THREE.Mesh(new THREE.BoxGeometry(0.59,0.45,0.055),new THREE.MeshStandardMaterial({color:0xff6600,roughness:0.5,metalness:0}))
  sq.position.set(bx,by,bz+dir*0.01);scene.add(sq)
  // Rim
  const rimM=new THREE.MeshStandardMaterial({color:0xff5500,roughness:0.3,metalness:0.5})
  const rim=new THREE.Mesh(new THREE.TorusGeometry(RR,0.024,12,40),rimM)
  rim.rotation.x=Math.PI/2;rim.position.set(0,RH,rimZ);rim.castShadow=true;scene.add(rim)
  // Net
  const net=new THREE.Mesh(new THREE.ConeGeometry(RR,0.45,14,4,true),new THREE.MeshBasicMaterial({color:0xcccccc,transparent:true,opacity:0.25,wireframe:true,side:THREE.DoubleSide}))
  net.position.set(0,RH-0.22,rimZ);scene.add(net)
}

/* ══════════════════════════════════════════════════════════════
   GLTF PLAYER SYSTEM — Soldier.glb con animaciones motion-capture
══════════════════════════════════════════════════════════════ */

const TEAM_COLORS = {
  offense:  { jersey:0x1a3a8a, shorts:0x112060, accent:0xf5c518, shoe:0x111111 },
  defense:  { jersey:0xf0f0f0, shorts:0xd0d0d0, accent:0xcc2222, shoe:0xeeeeee },
  xdefense: { jersey:0xf0f0f0, shorts:0xd0d0d0, accent:0xcc2222, shoe:0xeeeeee },
}
const SKINS=[0x7a4f3a,0xc07840,0xedc9a0,0x5c3520,0xd4956a,0x3d2010]

/* cache del modelo para no cargarlo N veces */
let _gltfPromise=null
function getGLTF(){
  if(!_gltfPromise){
    _gltfPromise=new Promise((resolve,reject)=>{
      new GLTFLoader().load('/models/player.glb',resolve,undefined,reject)
    })
  }
  return _gltfPromise
}

/* número cenital sobre el jugador */
function makeNumSprite(num,isOffense){
  const S=128,cv=document.createElement('canvas');cv.width=S;cv.height=S
  const ctx=cv.getContext('2d')
  const bg=isOffense?'#1a3a8a':'#f0f0f0',fg=isOffense?'#f5c518':'#1a3a8a'
  ctx.fillStyle=bg;ctx.beginPath();ctx.arc(S/2,S/2,S/2-2,0,Math.PI*2);ctx.fill()
  ctx.strokeStyle=fg;ctx.lineWidth=4;ctx.beginPath();ctx.arc(S/2,S/2,S/2-4,0,Math.PI*2);ctx.stroke()
  ctx.fillStyle=fg;ctx.font='bold 56px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.fillText(String(num??''),S/2,S/2+3)
  const tex=new THREE.CanvasTexture(cv)
  const mat=new THREE.SpriteMaterial({map:tex,depthWrite:false,transparent:true})
  const sprite=new THREE.Sprite(mat);sprite.scale.set(0.55,0.55,1)
  return sprite
}

/* aplica colores de equipo al clon GLTF
   Reemplazamos TODO el material por MeshStandardMaterial fresco —
   el Soldier usa MeshPhongMaterial que no soporta emissive igual */
function colorizePlayer(model,type,skinIdx){
  const isOff=type==='offense'
  // Paleta clara: jerseys vibrantes, piel visible, zapatillas contrastadas
  const jerseyHex=isOff?0x1535a0:0xf5f5f5
  const shortsHex=isOff?0x0e2270:0xd8d8d8
  const skinHex  =SKINS[skinIdx%SKINS.length]
  const accentHex=isOff?0xf5c518:0xdd2222
  const shoeHex  =isOff?0x0a0a0a:0xffffff
  const meshes=[]
  model.traverse(c=>{if(c.isMesh)meshes.push(c)})
  // El Soldier.glb tiene 4 meshes en orden: cuerpo, piernas, manos, cabeza
  const palette=[jerseyHex,shortsHex,skinHex,accentHex]
  meshes.forEach((c,i)=>{
    const hex=palette[Math.min(i,palette.length-1)]
    const col=new THREE.Color(hex)
    const mat=new THREE.MeshStandardMaterial({
      color:col,roughness:i===2?0.65:0.72,metalness:0,
      emissive:col.clone(),emissiveIntensity:i===2?0.08:0.20
    })
    c.material=mat;c.castShadow=true;c.receiveShadow=true
  })
  // sombra en suelo
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.40,20),
    new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:0.35}))
  shadow.rotation.x=-Math.PI/2;shadow.position.y=0.01;model.add(shadow)
    child.castShadow=true;child.receiveShadow=true
  })
}

/* ── basketball canvas texture (costura figure-8 real) ────────── */
function makeBallTex(){
  const W=1024,H=512,c=document.createElement('canvas')
  c.width=W;c.height=H
  const ctx=c.getContext('2d')
  // Gradiente naranja con profundidad
  const g=ctx.createRadialGradient(W*0.36,H*0.30,8,W*0.5,H*0.5,W*0.54)
  g.addColorStop(0,'#f59040');g.addColorStop(0.55,'#d06018');g.addColorStop(1,'#9a3c06')
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
  // Textura de goma sutil
  ctx.globalAlpha=0.04
  for(let i=0;i<1200;i++){
    ctx.fillStyle=Math.random()>0.5?'#fff':'#000'
    ctx.fillRect(Math.random()*W,Math.random()*H,Math.random()*3+1,Math.random()*3+1)
  }
  ctx.globalAlpha=1
  // Costura figure-8 real: en proyección UV aparece como onda sinusoidal
  ctx.strokeStyle='#160700';ctx.lineCap='round';ctx.lineJoin='round'
  // Ecuador
  ctx.lineWidth=10
  ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke()
  // Las 2 costuras sinusoidales (figure-8 visto de lado)
  const A=H*0.30
  for(let s=0;s<2;s++){
    ctx.lineWidth=10
    ctx.beginPath()
    for(let x=0;x<=W;x++){
      const t=((x+s*(W/2))/W)*Math.PI*4
      const y=H/2+A*Math.sin(t)
      x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
    }
    ctx.stroke()
  }
  // Surcos paralelos a las costuras (textura de goma)
  ctx.lineWidth=3;ctx.globalAlpha=0.25
  for(let s=0;s<2;s++){
    for(const off of[-14,14]){
      ctx.beginPath()
      for(let x=0;x<=W;x++){
        const t=((x+s*(W/2))/W)*Math.PI*4
        const y=H/2+A*Math.sin(t)+off
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
      }
      ctx.stroke()
    }
  }
  ctx.globalAlpha=1
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=16;return tex
}

function createBall(scene){
  const ball=new THREE.Mesh(
    new THREE.SphereGeometry(0.122,36,28),
    new THREE.MeshStandardMaterial({map:makeBallTex(),roughness:0.78,metalness:0.0})
  )
  ball.castShadow=true
  scene.add(ball);return ball
}

/* ── arena surround (bleachers OUTSIDE court boundaries) ─────── */
function buildSurround(scene,W_m,H_m){
  // Dark arena floor (below and outside court)
  const floorMat=new THREE.MeshStandardMaterial({color:0x080a12,roughness:0.95})
  const arena=new THREE.Mesh(new THREE.PlaneGeometry(W_m+30,H_m+30),floorMat)
  arena.rotation.x=-Math.PI/2;arena.position.set(0,-0.01,H_m/2);scene.add(arena)

  // Court boundary strips (white)
  const eMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.4})
  ;[
    [W_m+0.08, 0.025, 0.08,  0,       0.012, 0      ],  // baseline near
    [W_m+0.08, 0.025, 0.08,  0,       0.012, H_m    ],  // baseline far
    [0.08, 0.025, H_m,       -W_m/2,  0.012, H_m/2  ],  // sideline left
    [0.08, 0.025, H_m,        W_m/2,  0.012, H_m/2  ],  // sideline right
  ].forEach(([w,h,d,x,y,z])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),eMat)
    m.position.set(x,y,z);scene.add(m)
  })

  // Bleachers — positioned OUTSIDE the court (beyond boundary lines)
  const blMat=new THREE.MeshStandardMaterial({color:0x0c0d1a,roughness:0.9})
  const gap=1.5  // distance from court edge to bleacher
  ;[
    // Long sides (parallel to court length, outside left/right)
    [4.5, 4, H_m+4,  -(W_m/2+gap+2.25), 2, H_m/2],
    [4.5, 4, H_m+4,   (W_m/2+gap+2.25), 2, H_m/2],
    // Short ends (parallel to court width, outside baselines)
    [W_m+12, 4, 4,   0, 2, -(gap+2)   ],
    [W_m+12, 4, 4,   0, 2,  H_m+gap+2 ],
  ].forEach(([w,h,d,x,y,z])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),blMat)
    m.position.set(x,y,z);scene.add(m)
  })
}

/* ── camera presets ──────────────────────────────────────────── */
function applyCamera(cam,mode,H_m,W_m){
  const full=H_m>20
  if(mode==='overhead'){
    // Pista completa necesita más altura — a h=26 solo cubre ~20m, la pista mide 26m
    cam.fov=full?54:44;cam.updateProjectionMatrix()
    cam.position.set(0,full?38:26,H_m/2)
    cam.lookAt(0,0,H_m/2)
  } else if(mode==='angled'){
    cam.fov=48;cam.updateProjectionMatrix()
    cam.position.set(0,full?22:18,H_m+(full?H_m*0.15:4))
    cam.lookAt(0,0,H_m/2)
  } else if(mode==='follow'){
    cam.fov=58;cam.updateProjectionMatrix()
    cam.position.set(0,9,H_m*0.55)
    cam.lookAt(0,0,H_m*0.25)
  } else {
    // lateral
    cam.fov=full?58:52;cam.updateProjectionMatrix()
    cam.position.set(full?W_m*1.1:W_m*0.85,full?12:8,H_m/2)
    cam.lookAt(0,1,H_m/2)
  }
}

/* ── main component ──────────────────────────────────────────── */
export default function Court3DView({phases,courtType}){
  const mountRef  =useRef(null)   // div where Three.js mounts its own canvas
  const stateRef  =useRef(null)
  const animRef   =useRef(null)
  const [playing,  setPlaying] =useState(false)
  const [recording,setRecording]=useState(false)
  const [camMode,  setCamMode] =useState('overhead')
  const [initError,setInitError]=useState(null)

  const H_px=getH(courtType),H_m=H_px*S,W_m=CW*S

  /* ── init ──────────────────────────────────────────────────── */
  useEffect(()=>{
    const mount=mountRef.current; if(!mount)return
    let renderer,ro,canceled=false

    async function init(){
      try{
        const rect=mount.getBoundingClientRect()
        const W=Math.max(rect.width,400)||900
        const H=Math.max(rect.height,300)||540

        renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
        renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
        renderer.setSize(W,H)
        renderer.domElement.style.cssText='width:100%;height:100%;display:block'
        mount.appendChild(renderer.domElement)
        renderer.shadowMap.enabled=true
        renderer.shadowMap.type=THREE.PCFSoftShadowMap
        renderer.toneMapping=THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure=1.15
        renderer.outputColorSpace=THREE.SRGBColorSpace

        const full=H_m>20
        const scene=new THREE.Scene()
        scene.background=new THREE.Color(0x0a0d18)
        scene.fog=new THREE.Fog(0x0a0d18,50,100)

        // ── Iluminación pabellón ──────────────────────────────
        scene.add(new THREE.AmbientLight(0xfff8f0,1.0))
        const spotDist=full?65:45
        ;[
          [0,full?34:28,H_m*.10],[0,full?34:28,H_m*.90],
          [-W_m*.38,full?28:22,H_m*.28],[W_m*.38,full?28:22,H_m*.28],
          [-W_m*.38,full?28:22,H_m*.72],[W_m*.38,full?28:22,H_m*.72],
        ].forEach(([x,y,z])=>{
          const sp=new THREE.SpotLight(0xfffaf0,full?3.0:3.5)
          sp.position.set(x,y,z);sp.target.position.set(x*.15,0,z)
          sp.angle=Math.PI/5.5;sp.penumbra=0.45;sp.decay=1.1;sp.distance=spotDist
          sp.castShadow=true;sp.shadow.mapSize.set(512,512)
          sp.shadow.camera.near=1;sp.shadow.camera.far=spotDist+5
          scene.add(sp);scene.add(sp.target)
        })
        const fr=full?70:48
        const f1=new THREE.PointLight(0xffe8c8,.60,fr);f1.position.set(-W_m*1.3,4,H_m/2);scene.add(f1)
        const f2=new THREE.PointLight(0xffe8c8,.60,fr);f2.position.set(W_m*1.3,4,H_m/2);scene.add(f2)
        const fb=new THREE.DirectionalLight(0xffffff,.35);fb.position.set(0,5,H_m*1.5);scene.add(fb)

        // ── Pista ──────────────────────────────────────────────
        const floor=new THREE.Mesh(
          new THREE.PlaneGeometry(W_m,H_m),
          new THREE.MeshStandardMaterial({map:makeCourtTex(courtType),roughness:0.14,metalness:0.04})
        )
        floor.rotation.x=-Math.PI/2;floor.position.set(0,0,H_m/2);floor.receiveShadow=true;scene.add(floor)

        buildSurround(scene,W_m,H_m)
        addHoop(scene,courtType,H_m,false)
        if(courtType==='full')addHoop(scene,courtType,H_m,true)

        const camera=new THREE.PerspectiveCamera(44,W/H,0.1,150)
        applyCamera(camera,'overhead',H_m,W_m)

        // ── Cargar modelo GLTF ─────────────────────────────────
        const gltf=await getGLTF()
        if(canceled)return

        const anims=gltf.animations  // Run, Walk, Idle, TPose
        const template=gltf.scene

        // ── Crear jugadores desde GLTF ────────────────────────
        const playerMeshes={},mixers={},clocks={}
        // posición del aro para rotaciones inteligentes
        const _mg2=22,_sy2=(getH(courtType)-2*_mg2)/14
        const rimWorldZ=(_mg2+1.575*_sy2)*S   // Z del aro en coords 3D
        const e0=phases[0]?.elements||[]
        let pIdx=0
        for(const el of e0){
          if(!PLAYER_TYPES.includes(el.type))continue
          const clone=skeletonClone(template)
          colorizePlayer(clone,el.type,pIdx)
          clone.scale.setScalar(1.0)

          const{x,z}=p3(el.x,el.y)
          clone.position.set(x,0,z)
          // Rotación inicial inteligente según rol
          if(el.type==='offense'){
            // Ataque mira hacia el aro
            clone.rotation.y=Math.atan2(0-x,rimWorldZ-z)
          } else {
            // Defensa mira hacia el centro de la pista (hacia el balón)
            clone.rotation.y=Math.atan2(0-x,(H_m/2)-z)
          }
          scene.add(clone)

          // Sprite número encima — más grande y claro
          const sprite=makeNumSprite(el.num??'?',el.type==='offense')
          sprite.position.set(x,2.8,z)
          scene.add(sprite)
          clone.userData.numSprite=sprite

          // AnimationMixer con preload de ambas acciones
          const mixer=new THREE.AnimationMixer(clone)
          const idleClip=THREE.AnimationClip.findByName(anims,'Idle')
          const runClip =THREE.AnimationClip.findByName(anims,'Run')
          const mixData={mixer,anims,current:'Idle',actions:{}}
          if(idleClip){
            const a=mixer.clipAction(idleClip);a.play();mixData.actions['Idle']=a
          }
          if(runClip){
            // Precargar Run a speed x2.2 para movimiento baloncestístico real
            const a=mixer.clipAction(runClip);a.timeScale=2.2;a.enabled=true
            mixData.actions['Run']=a
          }
          mixers[el.id]=mixData
          // Primiamos el clock para evitar primer delta enorme
          const clk=new THREE.Clock(true);clk.getDelta();clocks[el.id]=clk

          playerMeshes[el.id]=clone
          pIdx++
        }

        const ball=createBall(scene)
        const BALL_H=0.95
        const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
        if(ic){const{x,z}=p3(ic.x,ic.y);ball.position.set(x,BALL_H,z)}
        else{const{x,z}=p3(CW/2,H_px*.4);ball.position.set(x,BALL_H,z)}

        stateRef.current={renderer,scene,camera,playerMeshes,mixers,clocks,ball,anims}
        renderer.render(scene,camera)
        setInitError(null)

        function resize(){
          const w=mount.clientWidth,h=mount.clientHeight
          if(!w||!h)return
          renderer.setSize(w,h,false)
          camera.aspect=w/h;camera.updateProjectionMatrix()
          renderer.render(scene,camera)
        }
        ro=new ResizeObserver(resize);ro.observe(mount)
        requestAnimationFrame(resize)

      }catch(e){console.error('3D init:',e);setInitError(e.message||String(e))}
    }

    init()

    return()=>{
      canceled=true
      cancelAnimationFrame(animRef.current)
      ro?.disconnect()
      try{if(renderer){mount.removeChild(renderer.domElement);renderer.dispose()}}catch(_){}
      stateRef.current=null
    }
  },[phases,courtType]) // eslint-disable-line

  /* ── animation ─────────────────────────────────────────────── */
  /* helper: crossfade a animation on a player */
  function switchAnim(mixerData,name){
    const{mixer,anims,actions}=mixerData
    if(mixerData.current===name)return
    if(!actions[name]){
      const clip=THREE.AnimationClip.findByName(anims,name)
      if(!clip)return
      actions[name]=mixer.clipAction(clip)
    }
    const prev=actions[mixerData.current]
    const next=actions[name]
    next.reset().play()
    if(prev&&prev!==next)prev.crossFadeTo(next,0.25,true)
    mixerData.current=name
  }

  function stopAnim(){
    cancelAnimationFrame(animRef.current);setPlaying(false)
    const s=stateRef.current;if(!s)return
    const e0=phases[0]?.elements||[]
    for(const el of e0){
      if(!PLAYER_TYPES.includes(el.type))continue
      const m=s.playerMeshes[el.id];if(!m)continue
      const{x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.set(0,0,0)
      // Switch back to Idle
      if(s.mixers?.[el.id])switchAnim(s.mixers[el.id],'Idle')
    }
    const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(ic){const{x,z}=p3(ic.x,ic.y);s.ball.position.set(x,0.95,z)}
    s.ball.scale.setScalar(1);s.renderer.render(s.scene,s.camera)
  }

  function startAnim(){
    const s=stateRef.current;if(!s||playing)return
    setPlaying(true)
    const{renderer,scene,camera,playerMeshes,mixers,clocks,ball}=s
    const nP=phases.length
    const meta=phases.map(ph=>({n:getNumSteps(ph.elements||[]),get dur(){return this.n*STEP_DUR+PHASE_HOLD}}))
    const starts=[0];for(let i=0;i<nP;i++)starts.push(starts[i]+meta[i].dur)
    const total=starts[nP],t0=performance.now()

    function frame(ts){
      const elapsed=ts-t0;if(elapsed>=total){renderer.render(scene,camera);setTimeout(stopAnim,800);return}
      let pi=nP-1;for(let i=0;i<nP;i++)if(elapsed<starts[i+1]){pi=i;break}
      const pe=elapsed-starts[pi],{n}=meta[pi]
      const si=Math.min(Math.floor(pe/STEP_DUR),n-1),st=Math.min((pe-si*STEP_DUR)/STEP_MOVE_DUR,1),et=ease(st)
      const elems=phases[pi]?.elements||[]
      const{playerPos:bp,carrierId:bc}=accumulateSteps(elems,si,H_px,courtType)
      const tg={}
      // move targets
      for(const e of elems){
        if(!MOVE_ARROW_TYPES.includes(e.type)||(e.step??0)!==si)continue
        let pid=e.fromId&&bp[e.fromId]?e.fromId:null
        if(!pid){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=bp[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}pid=bi}
        if(pid)tg[pid]={x:e.x2,y:e.y2}
      }
      for(const e of elems){
        if(e.type!=='handoff'||(e.step??0)!==si)continue
        let p1=e.fromId&&bp[e.fromId]?e.fromId:null
        if(!p1){let bd=PR*3,bi=null;for(const p of elems){if(!PLAYER_TYPES.includes(p.type))continue;const pp=bp[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x1,pp.y-e.y1);if(d<bd){bd=d;bi=p.id}}p1=bi}
        if(!p1)continue
        let p2=null,bd=PR*3
        for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const pp=bp[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x2,pp.y-e.y2);if(d<bd){bd=d;p2=p.id}}
        if(!p2)continue
        tg[p1]={x:bp[p2].x,y:bp[p2].y};tg[p2]={x:bp[p1].x,y:bp[p1].y}
      }
      const hasBX=elems.some(e=>(e.type==='pass'||e.type==='handoff')&&(e.step??0)===si)
      for(const e of elems){
        if(!['defense','xdefense'].includes(e.type)||!e.num||tg[e.id])continue
        const att=elems.find(x=>x.type==='offense'&&x.num===e.num);if(!att||!bp[att.id])continue
        if(!tg[att.id]&&!hasBX)continue
        const ae=tg[att.id]||bp[att.id],be=bc?(tg[bc]||bp[bc]):null
        const id2=computeSmartDefPos(ae,be,courtType,H_px)
        tg[e.id]={x:Math.max(PR+4,Math.min(CW-PR-4,id2.x)),y:Math.max(PR+4,Math.min(H_px-PR-4,id2.y))}
      }

      // ══ POSICIÓN, ROTACIÓN Y ANIMACIÓN GLTF ═════════════════
      const carrierPos2D=bc?bp[bc]:null
      // Aro en coordenadas 2D de la pizarra
      const _mg=22,_sy=(getH(courtType)-2*_mg)/14
      const rimX2D=CW/2,rimY2D=_mg+1.575*_sy

      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=bp[e.id];if(!b)continue
        const target=tg[e.id]||b
        const bp2=p3(b.x,b.y),tp2=p3(target.x,target.y)
        m.position.x=lerp(bp2.x,tp2.x,et)
        m.position.z=lerp(bp2.z,tp2.z,et)
        const dx=tp2.x-bp2.x,dz=tp2.z-bp2.z,dist=Math.hypot(dx,dz)
        const isMoving=!!tg[e.id]&&dist>0.05&&st>0

        // ── ROTACIÓN INTELIGENTE (baloncesto) ──────────────────
        if(isMoving){
          // Cara hacia dirección de carrera
          m.rotation.y=Math.atan2(dx,dz)
        } else if(e.type==='offense'||e.id===bc){
          // Ataque estático: mira hacia el aro
          const rimP=p3(rimX2D,rimY2D)
          m.rotation.y=Math.atan2(rimP.x-m.position.x,rimP.z-m.position.z)
        } else if(['defense','xdefense'].includes(e.type)){
          // Defensa: mira hacia el portador del balón
          if(carrierPos2D){
            const cp=p3(carrierPos2D.x,carrierPos2D.y)
            m.rotation.y=Math.atan2(cp.x-m.position.x,cp.z-m.position.z)
          }
        }

        // Sprite número sigue al jugador
        if(m.userData.numSprite){
          m.userData.numSprite.position.set(m.position.x,2.8,m.position.z)
        }

        // ── ANIMACIÓN GLTF ──────────────────────────────────────
        const mixData=mixers?.[e.id]
        if(mixData){
          // timeScale: carrera NBA ~5 m/s, animación base ~1 m/s → x2.2
          // Ajustamos dinámicamente según velocidad de desplazamiento
          if(mixData.actions['Run']){
            const speed=isMoving?Math.min(3.0,2.0+dist*0.8):2.2
            mixData.actions['Run'].timeScale=speed
          }
          switchAnim(mixData,isMoving?'Run':'Idle')
          const delta=Math.min(clocks?.[e.id]?.getDelta()??0.016, 0.05) // cap 50ms
          mixData.mixer.update(delta)
        }
      }

      // ball animation — balón a altura de cintura cuando está en manos
      let bx=null,by=0.95,bz=null;ball.scale.setScalar(1)
      if(st>0&&bc){
        const cB=bp[bc]
        // handoff
        const ho=elems.find(e=>e.type==='handoff'&&(e.step??0)===si&&tg[e.fromId||''])
        if(ho&&cB&&tg[ho.fromId]){
          const p1b=p3(bp[ho.fromId]?.x??cB.x,bp[ho.fromId]?.y??cB.y)
          const p2k=Object.keys(tg).find(k=>k!==ho.fromId&&bp[k]&&Math.hypot(bp[k].x-ho.x2,bp[k].y-ho.y2)<PR*3)
          if(p2k){const p2b=p3(bp[p2k].x,bp[p2k].y);if(et<0.5){bx=lerp(p1b.x,p2b.x,et);bz=lerp(p1b.z,p2b.z,et)}else{bx=lerp(p2b.x,p1b.x,et);bz=lerp(p2b.z,p1b.z,et)};by=0.9+Math.abs(Math.sin(et*Math.PI*2))*0.15}
        }
        // shot — realistic parabolic arc
        if(bx===null){
          const sh=elems.find(e=>e.type==='shot'&&(e.step??0)===si&&(e.fromId===bc||!e.fromId))
          if(sh&&cB){
            const sp=p3(cB.x,cB.y),ep=p3(sh.x2,sh.y2),dist2=Math.hypot(ep.x-sp.x,ep.z-sp.z)
            bx=lerp(sp.x,ep.x,et);bz=lerp(sp.z,ep.z,et)
            by=0.95+dist2*0.55*Math.sin(et*Math.PI)   // high arc
            const sc=et>0.8?Math.max(0.01,1-(et-0.8)/0.2):1;ball.scale.setScalar(sc)
          }
        }
        // pass — chest-pass height with slight arc
        if(bx===null){
          const pa=elems.find(e=>e.type==='pass'&&(e.step??0)===si&&e.fromId===bc)
          if(pa&&cB){
            const ct=tg[bc],cx2=ct?lerp(cB.x,ct.x,et):cB.x,cy2=ct?lerp(cB.y,ct.y,et):cB.y
            const cp=p3(cx2,cy2),ep=p3(pa.x2,pa.y2),pDist=Math.hypot(ep.x-cp.x,ep.z-cp.z)
            bx=lerp(cp.x,ep.x,et);bz=lerp(cp.z,ep.z,et)
            by=0.95+pDist*0.12*Math.sin(et*Math.PI)   // slight arc on pass
          }
        }
        // dribble — rebote real: va al suelo y vuelve a la mano (0.95m)
        if(bx===null&&tg[bc]){
          const bp3=p3(cB.x,cB.y),tp3=p3(tg[bc].x,tg[bc].y)
          bx=lerp(bp3.x,tp3.x,et);bz=lerp(bp3.z,tp3.z,et)
          // parábola: 0.95 → 0.08 → 0.95 (mano→suelo→mano)
          const bounce=Math.abs(Math.cos(et*Math.PI*3.5))
          by=0.08+bounce*0.87
        }
        // estático con balón: a altura de cintura
        if(bx===null){const cp=p3(cB.x,cB.y);bx=cp.x;bz=cp.z;by=0.95}
      }
      if(bx!==null)ball.position.set(bx,by,bz)

      // follow-ball camera
      if(camMode==='follow'&&bx!==null){camera.position.set(bx,10,bz-5);camera.lookAt(bx,0,bz+2)}

      renderer.render(scene,camera)
      animRef.current=requestAnimationFrame(frame)
    }
    animRef.current=requestAnimationFrame(frame)
  }

  function toggleCam(mode){
    setCamMode(mode)
    const s=stateRef.current;if(!s)return
    applyCamera(s.camera,mode,H_m,W_m)
    s.camera.aspect=(mountRef.current?.clientWidth||900)/(mountRef.current?.clientHeight||540)
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
    const tot=phases.reduce((a,ph)=>a+getNumSteps(ph.elements||[])*STEP_DUR+PHASE_HOLD,0)+1400
    startAnim();setTimeout(()=>{stopAnim();rec.stop()},tot)
  }

  if(initError)return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,background:'#0f172a'}}>
      <p style={{color:'#9ca3af',fontSize:13}}>Error 3D: {initError}</p>
    </div>
  )

  const btn=a=>({padding:'7px 14px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,border:`1px solid ${a?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.07)'}`,background:a?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.03)',color:a?'#fff':'rgba(255,255,255,0.4)',transition:'all 0.15s'})

  return(
    <div ref={mountRef} style={{position:'relative',width:'100%',height:'100%',background:'#080b14',overflow:'hidden'}}>
      {/* Three.js appends its own canvas here via mount.appendChild(renderer.domElement) */}
      {/* Subtle vignette */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 48%,transparent 52%,rgba(0,0,0,0.45) 100%)',pointerEvents:'none'}}/>
      {/* Controls */}
      <div style={{position:'absolute',bottom:18,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:8,background:'rgba(8,11,20,0.88)',backdropFilter:'blur(16px)',padding:'11px 18px',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 4px 24px rgba(0,0,0,0.5)',flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={playing?stopAnim:startAnim} style={{padding:'10px 26px',borderRadius:11,border:'none',cursor:'pointer',background:playing?'#b45309':'#1d4ed8',color:'#fff',fontWeight:800,fontSize:13,boxShadow:playing?'none':'0 0 18px rgba(29,78,216,0.4)'}}>
          {playing?'⏹ Parar':'▶ Reproducir'}
        </button>
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.08)'}}/>
        <span style={{color:'rgba(255,255,255,0.2)',fontSize:10,fontWeight:700,letterSpacing:1}}>CÁMARA</span>
        {[['overhead','⬆ Cenital'],['angled','↗ Inclinada'],['follow','🏀 Balón'],['lateral','↔ Lateral']].map(([m,l])=>(
          <button key={m} onClick={()=>toggleCam(m)} style={btn(camMode===m)}>{l}</button>
        ))}
        <div style={{width:1,height:22,background:'rgba(255,255,255,0.08)'}}/>
        <button onClick={exportVideo} disabled={recording} style={{padding:'8px 16px',borderRadius:10,border:'1px solid rgba(124,58,237,0.35)',cursor:recording?'not-allowed':'pointer',background:'rgba(124,58,237,0.22)',color:recording?'#666':'#c4b5fd',fontWeight:700,fontSize:12}}>
          {recording?'⏺ Grabando...':'🎬 Exportar'}
        </button>
      </div>
      <div style={{position:'absolute',top:12,left:14,background:'rgba(8,11,20,0.7)',backdropFilter:'blur(10px)',padding:'4px 12px',borderRadius:20,color:'rgba(255,255,255,0.28)',fontSize:11,fontWeight:600,border:'1px solid rgba(255,255,255,0.06)'}}>
        {phases.length} FASE{phases.length!==1?'S':''} · {courtType==='full'?'PISTA COMPLETA':'MEDIA PISTA'}
      </div>
    </div>
  )
}
