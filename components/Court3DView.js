'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

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
  // Rich hardwood parquet
  const n=28
  for(let i=0;i<n;i++){
    const r=175+Math.sin(i*1.3)*6|0,g=103+Math.sin(i*0.9)*4|0,b=37+Math.sin(i*1.7)*3|0
    ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(i*TW/n,0,TW/n+1,TH)
  }
  // Grain
  ctx.globalAlpha=0.05;ctx.strokeStyle='#000';ctx.lineWidth=1
  for(let y=0;y<TH;y+=TH/70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(TW,y);ctx.stroke()}
  ctx.globalAlpha=0.12;ctx.lineWidth=1.6
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

/* ── realistic player ────────────────────────────────────────── */
function createPlayer(isOffense,num){
  const group=new THREE.Group()

  // Natural team colors — realistic kit
  const jerseyC =isOffense?0x1a3a8a:0xf0f0f0   // navy blue vs white
  const shortsC =isOffense?0x1a3a8a:0xf0f0f0
  const accentC =isOffense?0xf5c518:0xcc2222   // gold vs red accent
  const skinC   =isOffense?0x7a4f3a:0xedc9a0   // darker vs lighter skin
  const shoeC   =isOffense?0x111111:0xeeeeee

  const jMat=new THREE.MeshStandardMaterial({color:jerseyC,roughness:0.85,metalness:0})
  const sMat=new THREE.MeshStandardMaterial({color:shortsC,roughness:0.85,metalness:0})
  const aMat=new THREE.MeshStandardMaterial({color:accentC,roughness:0.8,metalness:0})
  const skMat=new THREE.MeshStandardMaterial({color:skinC,roughness:0.8,metalness:0})
  const shMat=new THREE.MeshStandardMaterial({color:shoeC,roughness:0.7,metalness:0.1})

  // Floor shadow
  const sh=new THREE.Mesh(new THREE.CircleGeometry(0.38,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.4}))
  sh.rotation.x=-Math.PI/2;sh.position.set(0,0.002,0);group.add(sh)

  // Shoes (left / right)
  ;[[-0.1,0],[0.1,0]].forEach(([ox])=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.10,0.31),shMat)
    shoe.position.set(ox,0.05,0.02);group.add(shoe)
    // sole stripe
    const sole=new THREE.Mesh(new THREE.BoxGeometry(0.195,0.03,0.315),aMat)
    sole.position.set(ox,0.015,0.02);group.add(sole)
  })

  // Lower legs (calves)
  ;[[-0.11,0],[0.11,0]].forEach(([ox])=>{
    const calf=new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.065,0.45,9),skMat)
    calf.position.set(ox,0.275,0);group.add(calf)
  })

  // Shorts (thighs) — team color
  ;[[-0.11,0],[0.11,0]].forEach(([ox])=>{
    const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.098,0.09,0.44,9),sMat)
    thigh.position.set(ox,0.62,0);group.add(thigh)
  })
  // Shorts waistband accent
  const waist=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.22,0.07,10),aMat)
  waist.position.set(0,0.88,0);group.add(waist)

  // Torso — jersey
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.22,0.68,10),jMat)
  torso.position.set(0,1.23,0);torso.castShadow=true;group.add(torso)
  // Collar
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.09,10),aMat)
  collar.position.set(0,1.6,0);group.add(collar)
  // Shoulder stripes
  ;[[-0.22,1.52],[0.22,1.52]].forEach(([ox,oy])=>{
    const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.28,8),aMat)
    stripe.rotation.z=ox<0?0.6:-0.6;stripe.position.set(ox,oy,0);group.add(stripe)
  })

  // Arms — upper (jersey) + forearm (skin)
  ;[[-1,1],[1,1]].forEach(([sx])=>{
    // Upper arm
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.088,0.082,0.40,8),jMat)
    upper.rotation.z=sx*0.55;upper.position.set(sx*0.38,1.21,0);group.add(upper)
    // Forearm
    const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.065,0.34,8),skMat)
    fore.rotation.z=sx*0.48;fore.position.set(sx*0.58,0.98,0);group.add(fore)
    // Hand
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,8),skMat)
    hand.position.set(sx*0.70,0.82,0);group.add(hand)
    // Store for animation
    if(sx<0) group.userData.leftArm=upper; else group.userData.rightArm=upper
    if(sx<0) group.userData.leftFore=fore; else group.userData.rightFore=fore
  })

  // Neck
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.11,0.17,9),skMat)
  neck.position.set(0,1.67,0);group.add(neck)

  // Head — realistic proportions
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.21,14,14),skMat)
  head.scale.set(1,1.12,1);head.position.set(0,1.93,0);head.castShadow=true;group.add(head)

  // Hair cap / hair (flat dark sphere top)
  const hair=new THREE.Mesh(
    new THREE.SphereGeometry(0.215,14,8,0,Math.PI*2,0,Math.PI*0.48),
    new THREE.MeshStandardMaterial({color:isOffense?0x1a0800:0x2a1a0a,roughness:1,metalness:0})
  )
  hair.position.set(0,1.93,0);group.add(hair)

  // ── Number textures ──────────────────────────────────────
  function numTex(size,bg,fg,txt){
    const cv=document.createElement('canvas');cv.width=size;cv.height=size
    const cx=cv.getContext('2d')
    cx.fillStyle=bg;cx.fillRect(0,0,size,size)
    cx.fillStyle=fg;cx.font=`bold ${Math.round(size*0.52)}px Arial,sans-serif`
    cx.textAlign='center';cx.textBaseline='middle'
    cx.fillText(txt,size/2,size/2+size*0.03)
    return new THREE.CanvasTexture(cv)
  }
  const bg=isOffense?'#1a3a8a':'#f0f0f0', fg=isOffense?'#f5c518':'#1a3a8a'
  const t=String(num??'')

  // Top number (visible from overhead camera — most important)
  const topNum=new THREE.Mesh(new THREE.CircleGeometry(0.22,20),new THREE.MeshBasicMaterial({map:numTex(160,bg,fg,t),transparent:true,depthWrite:false}))
  topNum.rotation.x=-Math.PI/2;topNum.position.set(0,2.16,0);group.add(topNum)
  // Chest number (side views)
  const chestNum=new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.24),new THREE.MeshBasicMaterial({map:numTex(120,bg,fg,t),transparent:true,depthWrite:false}))
  chestNum.position.set(0,1.23,0.28);group.add(chestNum)
  // Back number
  const backNum=new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.24),new THREE.MeshBasicMaterial({map:numTex(120,bg,fg,t),transparent:true,depthWrite:false}))
  backNum.rotation.y=Math.PI;backNum.position.set(0,1.23,-0.28);group.add(backNum)

  return group
}

/* ── basketball ──────────────────────────────────────────────── */
function createBall(scene){
  // Realistic orange rubber ball
  const ball=new THREE.Mesh(
    new THREE.SphereGeometry(0.122,24,24),
    new THREE.MeshStandardMaterial({color:0xd85010,roughness:0.72,metalness:0.0})
  )
  ball.castShadow=true
  // Black seam lines — 3 great circles
  const seamMat=new THREE.LineBasicMaterial({color:0x111111,linewidth:1.5})
  const mkSeam=()=>{
    const pts=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return new THREE.Vector3(Math.cos(a)*0.126,0,Math.sin(a)*0.126)})
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),seamMat)
  }
  const eq=mkSeam();ball.add(eq)
  const ms=mkSeam();ms.rotation.z=Math.PI/2;ball.add(ms)
  // Curved seam lines for realism
  const cs=mkSeam();cs.rotation.x=Math.PI/4;ball.add(cs)
  scene.add(ball);return ball
}

/* ── simple arena surround ───────────────────────────────────── */
function buildSurround(scene,W_m,H_m){
  // Dark floor outside court
  const mat=new THREE.MeshStandardMaterial({color:0x0a0a12,roughness:0.9})
  const s=new THREE.Mesh(new THREE.PlaneGeometry(W_m+24,H_m+24),mat)
  s.rotation.x=-Math.PI/2;s.position.set(0,-0.006,H_m/2);scene.add(s)
  // Simple dark bleachers — just neutral rows, no glowing
  const rowM=new THREE.MeshStandardMaterial({color:0x0d0d1a,roughness:0.9})
  ;[  // [w, h, depth, x, y, z, rotY]
    [W_m+10,5,4,  0,2.5,H_m/2, Math.PI/2],
    [W_m+10,5,4,  0,2.5,H_m/2,-Math.PI/2],
    [H_m+10,5,4,  0,2.5,H_m/2+0.5,0],
    [H_m+10,5,4,  0,2.5,H_m/2-0.5,Math.PI],
  ].forEach(([w,h,d,x,y,z,ry])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),rowM)
    m.rotation.y=ry;m.position.set(x,y,z);scene.add(m)
  })
  // Court edge white strips
  const eM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5})
  ;[[W_m+0.06,0.02,0.06,0,0.01,0],[W_m+0.06,0.02,0.06,0,0.01,H_m],[0.06,0.02,H_m,-W_m/2,0.01,H_m/2],[0.06,0.02,H_m,W_m/2,0.01,H_m/2]]
    .forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),eM);m.position.set(x,y,z);scene.add(m)})
}

/* ── camera presets ──────────────────────────────────────────── */
function applyCamera(cam,mode,H_m,W_m){
  if(mode==='overhead'){
    // ── TECHO: cámara desde arriba del centro de pista, vista completa ──
    // FOV estrecho para que la pista llene el encuadre
    cam.fov=44;cam.updateProjectionMatrix()
    cam.position.set(0,21,H_m/2)
    cam.lookAt(0,0,H_m/2)
  } else if(mode==='angled'){
    // Vista ligeramente inclinada (muestra algo de profundidad 3D)
    cam.fov=46;cam.updateProjectionMatrix()
    cam.position.set(0,18,H_m+2)
    cam.lookAt(0,0,H_m/2)
  } else if(mode==='follow'){
    cam.fov=55;cam.updateProjectionMatrix()
    cam.position.set(0,9,H_m*0.55)
    cam.lookAt(0,0,H_m*0.25)
  } else {
    // lateral
    cam.fov=50;cam.updateProjectionMatrix()
    cam.position.set(W_m*0.75,8,H_m/2)
    cam.lookAt(0,1,H_m/2)
  }
}

/* ── main component ──────────────────────────────────────────── */
export default function Court3DView({phases,courtType}){
  const canvasRef=useRef(null)
  const stateRef =useRef(null)
  const animRef  =useRef(null)
  const [playing,  setPlaying] =useState(false)
  const [recording,setRecording]=useState(false)
  const [camMode,  setCamMode] =useState('overhead')
  const [initError,setInitError]=useState(null)

  const H_px=getH(courtType),H_m=H_px*S,W_m=CW*S

  /* ── init ──────────────────────────────────────────────────── */
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    let renderer,ro
    try{
      const W=canvas.clientWidth||900,H=canvas.clientHeight||540
      renderer=new THREE.WebGLRenderer({canvas,antialias:true})
      renderer.setSize(W,H,false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
      renderer.shadowMap.enabled=true
      renderer.shadowMap.type=THREE.PCFSoftShadowMap
      renderer.toneMapping=THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure=1.05
      renderer.outputColorSpace=THREE.SRGBColorSpace

      const scene=new THREE.Scene()
      scene.background=new THREE.Color(0x080b14)
      scene.fog=new THREE.Fog(0x080b14,30,55)

      // ── Natural arena lighting ─────────────────────────────
      // Main overhead light (simulates arena ceiling lights)
      scene.add(new THREE.AmbientLight(0xfff0d8,0.45))
      // 4 overhead directional lights (arena spotlights) — no glowing bulbs, just light
      ;[[0,22,H_m*0.1],[0,22,H_m*0.9],[-W_m*0.35,18,H_m/2],[W_m*0.35,18,H_m/2]].forEach(([x,y,z])=>{
        const dl=new THREE.DirectionalLight(0xfff8e8,0.72)
        dl.position.set(x,y,z);dl.castShadow=true
        dl.shadow.mapSize.set(1024,1024);dl.shadow.camera.near=1;dl.shadow.camera.far=50
        ;['left','right','top','bottom'].forEach((k,i)=>(dl.shadow.camera[k]=[-14,14,12,-12][i]))
        scene.add(dl)
      })
      // Soft fill from sides (no colored tints — natural grey fill)
      const fill1=new THREE.PointLight(0xc8d0e0,0.35,35);fill1.position.set(-W_m,3,H_m/2);scene.add(fill1)
      const fill2=new THREE.PointLight(0xc8d0e0,0.35,35);fill2.position.set( W_m,3,H_m/2);scene.add(fill2)

      // Court floor
      const floor=new THREE.Mesh(
        new THREE.PlaneGeometry(W_m,H_m),
        new THREE.MeshStandardMaterial({map:makeCourtTex(courtType),roughness:0.35,metalness:0.04})
      )
      floor.rotation.x=-Math.PI/2;floor.position.set(0,0,H_m/2);floor.receiveShadow=true;scene.add(floor)

      buildSurround(scene,W_m,H_m)
      addHoop(scene,courtType,H_m,false)
      if(courtType==='full')addHoop(scene,courtType,H_m,true)

      const camera=new THREE.PerspectiveCamera(44,W/H,0.1,150)
      applyCamera(camera,'overhead',H_m,W_m)

      // Players
      const playerMeshes={}
      const e0=phases[0]?.elements||[]
      for(const el of e0){
        if(!PLAYER_TYPES.includes(el.type))continue
        const mesh=createPlayer(el.type==='offense',el.num??'?')
        const{x,z}=p3(el.x,el.y);mesh.position.set(x,0,z)
        scene.add(mesh);playerMeshes[el.id]=mesh
      }
      const ball=createBall(scene)
      const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
      if(ic){const{x,z}=p3(ic.x,ic.y);ball.position.set(x,0.12,z)}
      else{const{x,z}=p3(CW/2,H_px*0.4);ball.position.set(x,0.12,z)}

      stateRef.current={renderer,scene,camera,playerMeshes,ball}
      renderer.render(scene,camera)
      setInitError(null)

      ro=new ResizeObserver(()=>{
        const w=canvas.clientWidth,h=canvas.clientHeight
        renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)
      });ro.observe(canvas)
    }catch(e){console.error('3D init:',e);setInitError(e.message||String(e))}
    return()=>{cancelAnimationFrame(animRef.current);ro?.disconnect();try{renderer?.dispose()}catch(_){};stateRef.current=null}
  },[phases,courtType]) // eslint-disable-line

  /* ── animation ─────────────────────────────────────────────── */
  function stopAnim(){
    cancelAnimationFrame(animRef.current);setPlaying(false)
    const s=stateRef.current;if(!s)return
    const e0=phases[0]?.elements||[]
    for(const el of e0){
      if(!PLAYER_TYPES.includes(el.type))continue
      const m=s.playerMeshes[el.id];if(!m)continue
      const{x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.y=0
      if(m.userData.leftArm){m.userData.leftArm.rotation.x=0;m.userData.rightArm.rotation.x=0}
    }
    const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(ic){const{x,z}=p3(ic.x,ic.y);s.ball.position.set(x,0.12,z)}
    s.ball.scale.setScalar(1);s.renderer.render(s.scene,s.camera)
  }

  function startAnim(){
    const s=stateRef.current;if(!s||playing)return
    setPlaying(true)
    const{renderer,scene,camera,playerMeshes,ball}=s
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

      // update player positions + realistic movement animations
      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=bp[e.id];if(!b)continue
        const t=tg[e.id]||b
        const bp2=p3(b.x,b.y),tp2=p3(t.x,t.y)
        m.position.x=lerp(bp2.x,tp2.x,et);m.position.z=lerp(bp2.z,tp2.z,et)
        const dx=tp2.x-bp2.x,dz=tp2.z-bp2.z,dist=Math.hypot(dx,dz)
        // face direction of movement
        if(dist>0.02)m.rotation.y=Math.atan2(dx,dz)
        // natural running bob + arm swing
        if(tg[e.id]&&st>0&&dist>0.05){
          const speed=Math.min(1,dist*1.5)
          m.position.y=Math.abs(Math.sin(et*Math.PI*5))*0.06*speed
          if(m.userData.leftArm&&m.userData.rightArm){
            const sw=Math.sin(et*Math.PI*5)*0.35*speed
            m.userData.leftArm.rotation.x=sw;m.userData.rightArm.rotation.x=-sw
            if(m.userData.leftFore){m.userData.leftFore.rotation.x=sw*0.6;m.userData.rightFore.rotation.x=-sw*0.6}
          }
        } else {
          m.position.y=0
          if(m.userData.leftArm){m.userData.leftArm.rotation.x=0;m.userData.rightArm.rotation.x=0}
        }
      }

      // ball animation
      let bx=null,by=0.12,bz=null;ball.scale.setScalar(1)
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
        // dribble — ball bounces
        if(bx===null&&tg[bc]){
          const bp3=p3(cB.x,cB.y),tp3=p3(tg[bc].x,tg[bc].y)
          bx=lerp(bp3.x,tp3.x,et);bz=lerp(bp3.z,tp3.z,et)
          by=0.12+Math.abs(Math.sin(et*Math.PI*4))*0.65  // realistic dribble bounce
        }
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
    <div style={{position:'relative',width:'100%',height:'100%',background:'#080b14',display:'flex',flexDirection:'column'}}>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
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
