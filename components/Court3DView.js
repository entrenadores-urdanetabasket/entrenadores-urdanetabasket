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

/* ── game logic (mirrored from CourtEditor) ──────────────────── */
function getNumSteps(elems){let max=-1;for(const e of elems)if(ARROW_TYPES.includes(e.type))max=Math.max(max,e.step??0);return Math.max(1,max+1)}
function computeSmartDefPos(attPos,ballPos,courtType,courtH){
  const mg=22,halfH=courtType==='full'?Math.round(courtH/2):courtH
  const sy=(halfH-2*mg)/14,rimY=mg+1.575*sy,ftY=mg+5.8*sy
  const useBot=courtType==='full'&&attPos.y>courtH/2
  const basketY=useBot?courtH-rimY:rimY,paintY=useBot?courtH-(rimY+ftY)/2:(rimY+ftY)/2
  const dxB=CW/2-attPos.x,dyB=basketY-attPos.y,distB=Math.hypot(dxB,dyB)||1
  const O=Math.min(46,distB*0.32),primX=attPos.x+(dxB/distB)*O,primY=attPos.y+(dyB/distB)*O
  if(!ballPos)return{x:primX,y:primY}
  const distBall=Math.hypot(ballPos.x-attPos.x,ballPos.y-attPos.y)
  if(distBall<55)return{x:primX,y:primY}
  const sag=Math.min(0.60,(distBall-55)/305)
  return{x:primX+(attPos.x+(CW/2-attPos.x)*0.35-primX)*sag,y:primY+(attPos.y+(paintY-attPos.y)*0.48-primY)*sag}
}
function accumulateSteps(elems,throughStep,courtH=FULL_H,courtType='half'){
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
  const cx=v=>cl(v,PR+4,CW-PR-4),cy=v=>cl(v,PR+4,courtH-PR-4)
  const pos={};for(const e of elems)if(!ARROW_TYPES.includes(e.type))pos[e.id]={x:e.x,y:e.y}
  let carrier=null;for(const e of elems)if(PLAYER_TYPES.includes(e.type)&&e.hasBall){carrier=e.id;break}
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
      let p2=null,bd2=PR*3
      for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const pp=pos[p.id];if(!pp)continue;const d=Math.hypot(pp.x-e.x2,pp.y-e.y2);if(d<bd2){bd2=d;p2=p.id}}
      if(!p2)continue
      const a={...pos[p1]},b={...pos[p2]};moves[p1]={dx:b.x-a.x,dy:b.y-a.y};moves[p2]={dx:a.x-b.x,dy:a.y-b.y}
      pos[p1]={x:b.x,y:b.y};pos[p2]={x:a.x,y:a.y};if(carrier===p1)carrier=p2
    }
    if(carrier){const arr=elems.find(e=>e.type==='pass'&&(e.step??0)===s&&e.fromId===carrier);if(arr){let bd=PR+30,bi=null;for(const e of elems){if(!PLAYER_TYPES.includes(e.type)||e.id===carrier)continue;const p=pos[e.id]||{x:e.x,y:e.y};const d=Math.hypot(p.x-arr.x2,p.y-arr.y2);if(d<bd){bd=d;bi=e.id}}if(bi)carrier=bi}}
    const ballPos=carrier?pos[carrier]:null
    for(const e of elems){
      if(!['defense','xdefense'].includes(e.type)||!e.num)continue
      const manual=elems.some(x=>(MOVE_ARROW_TYPES.includes(x.type)||x.type==='handoff')&&(x.step??0)===s&&x.fromId===e.id)
      if(manual||!pos[e.id])continue
      const att=elems.find(x=>x.type==='offense'&&x.num===e.num);if(!att||!pos[att.id])continue
      const moved=!!moves[att.id]||!!moves[carrier]||elems.some(x=>x.type==='pass'&&(x.step??0)===s)
      if(!moved)continue
      const ideal=computeSmartDefPos(pos[att.id],ballPos,courtType,courtH)
      pos[e.id]={x:cx(ideal.x),y:cy(ideal.y)}
    }
  }
  return{playerPos:pos,carrierId:carrier}
}

/* ── court texture ───────────────────────────────────────────── */
function makeCourtTex(courtType){
  const H_px=getH(courtType),TW=2048,TH=Math.round(2048*H_px/CW)
  const c=document.createElement('canvas');c.width=TW;c.height=TH
  const ctx=c.getContext('2d')
  // Premium parquet — natural wood tones
  const numPlanks=30
  for(let i=0;i<numPlanks;i++){
    const t=i/numPlanks,lum=Math.sin(t*Math.PI*numPlanks)*3
    ctx.fillStyle=`rgb(${172+lum|0},${101+lum|0},${38+lum|0})`
    ctx.fillRect(i*TW/numPlanks,0,TW/numPlanks+1,TH)
  }
  ctx.globalAlpha=0.07;ctx.strokeStyle='#000';ctx.lineWidth=1.2
  for(let y=0;y<TH;y+=TH/60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(TW,y);ctx.stroke()}
  ctx.globalAlpha=0.15;ctx.lineWidth=1.8
  for(let i=0;i<=numPlanks;i++){const x=i*TW/numPlanks;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,TH);ctx.stroke()}
  ctx.globalAlpha=1
  // court lines
  ctx.save();ctx.scale(TW/CW,TH/H_px)
  const mg=22,sx=(CW-2*mg)/15,sy2=(H_px-2*mg)/14,s=(sx+sy2)/2
  ctx.strokeStyle='rgba(255,255,255,0.92)';ctx.lineWidth=2.5
  ctx.strokeRect(mg,mg,CW-2*mg,H_px-2*mg)
  const pW=4.9*sx,pH=5.8*sy2,pX=(CW-pW)/2,pY=mg
  // paint tinted
  ctx.fillStyle='rgba(200,130,40,0.12)';ctx.fillRect(pX,pY,pW,pH)
  ctx.strokeRect(pX,pY,pW,pH)
  ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(CW/2-0.915*sx,pY+2);ctx.lineTo(CW/2+0.915*sx,pY+2);ctx.stroke();ctx.lineWidth=2.5
  const rimX=CW/2,rimY2=pY+1.575*sy2,rimR=Math.max(0.225*s,13)
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
    ctx.strokeStyle='rgba(255,255,255,0.92)';ctx.lineWidth=2.5
    ctx.fillStyle='rgba(200,130,40,0.12)';ctx.fillRect(pX,pY,pW,pH)
    ctx.strokeRect(pX,pY,pW,pH)
    ctx.beginPath();ctx.arc(rimX,rimY2,rimR,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,rimY2,1.25*s,0,Math.PI);ctx.stroke()
    ctx.beginPath();ctx.moveTo(pX,ftY2);ctx.lineTo(pX+pW,ftY2);ctx.stroke()
    ctx.beginPath();ctx.arc(rimX,ftY2,ftR,Math.PI,0);ctx.stroke()
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(rimX,ftY2,ftR,0,Math.PI);ctx.stroke();ctx.setLineDash([])
    if(arc3R>rimX-c3X+1){const sH=Math.sqrt(arc3R**2-(rimX-c3X)**2);ctx.beginPath();ctx.moveTo(c3X,pY);ctx.lineTo(c3X,rimY2+sH);ctx.stroke();ctx.beginPath();ctx.moveTo(c3Xr,pY);ctx.lineTo(c3Xr,rimY2+sH);ctx.stroke();const a3=Math.asin((rimX-c3X)/arc3R);ctx.beginPath();ctx.arc(rimX,rimY2,arc3R,Math.PI/2-a3,Math.PI/2+a3);ctx.stroke()}
    ctx.restore()
  }else{ctx.beginPath();ctx.arc(CW/2,H_px-mg,1.8*s,Math.PI,0);ctx.stroke()}
  ctx.restore()
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=8;return tex
}

/* ── arena environment ───────────────────────────────────────── */
function buildArena(scene,W_m,H_m){
  // Dark court surrounds
  const surroundMat=new THREE.MeshStandardMaterial({color:0x070a12,roughness:0.95})
  const surround=new THREE.Mesh(new THREE.PlaneGeometry(W_m+20,H_m+20),surroundMat)
  surround.rotation.x=-Math.PI/2;surround.position.set(0,-0.008,H_m/2);scene.add(surround)

  // Bleacher rows — 2 long sides + 2 short ends
  const rowColors=[0x0c0d18,0x0a0b14,0x0e0f1e,0x090a12,0x0c0d1a]
  const makeStand=(w,d,x,z,rot)=>{
    for(let r=0;r<6;r++){
      const h=0.65+r*0.55,depth=0.95
      const m=new THREE.Mesh(
        new THREE.BoxGeometry(w,h,depth),
        new THREE.MeshStandardMaterial({color:rowColors[r%rowColors.length],roughness:0.9})
      )
      m.rotation.y=rot;m.position.set(x+(rot===0?0:Math.sin(rot)*(r*depth*0.5)),h/2,z+(rot===0?r*depth*0.6:0));scene.add(m)
      // subtle crowd dots on face
    }
  }
  makeStand(W_m+6,0,-W_m/2-3.8,H_m/2,Math.PI/2)
  makeStand(W_m+6,0, W_m/2+3.8,H_m/2,-Math.PI/2)
  makeStand(H_m+6,0,0,-3.2,0)
  makeStand(H_m+6,0,0,H_m+3.2,Math.PI)

  // Arena ceiling plate (keeps the space bounded, dark)
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(W_m+30,H_m+30),new THREE.MeshStandardMaterial({color:0x040608,roughness:1}))
  ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,18,H_m/2);scene.add(ceiling)

  // Hanging light fixtures (8 units)
  const fixPos=[
    [-W_m*0.3,15,H_m*0.15],[W_m*0.3,15,H_m*0.15],
    [-W_m*0.3,15,H_m*0.85],[W_m*0.3,15,H_m*0.85],
    [-W_m*0.3,15,H_m*0.5], [W_m*0.3,15,H_m*0.5],
    [0,16,H_m*0.08],[0,16,H_m*0.92],
  ]
  fixPos.forEach(([fx,fy,fz])=>{
    // Housing
    const housing=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.35,1.1),new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.6,metalness:0.4}))
    housing.position.set(fx,fy,fz);scene.add(housing)
    // Bulb (very bright, triggers bloom)
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8),new THREE.MeshStandardMaterial({color:0xfffde8,emissive:0xfffde8,emissiveIntensity:4.5,roughness:0.0,metalness:0.0}))
    bulb.position.set(fx,fy-0.22,fz);scene.add(bulb)
    // Light cone suggestion
    const cone=new THREE.Mesh(new THREE.ConeGeometry(1.8,4.5,10,1,true),new THREE.MeshBasicMaterial({color:0xfff5d0,transparent:true,opacity:0.018,side:THREE.DoubleSide}))
    cone.rotation.x=Math.PI;cone.position.set(fx,fy-2.5,fz);scene.add(cone)
  })

  // Central scoreboard (above center of court)
  const sb=new THREE.Mesh(new THREE.BoxGeometry(4.5,2.2,0.28),new THREE.MeshStandardMaterial({color:0x050810,emissive:0x0a1840,emissiveIntensity:0.8,roughness:0.3,metalness:0.5}))
  sb.position.set(0,13.5,H_m/2);scene.add(sb)
  // Scoreboard frame
  const sbFrame=new THREE.Mesh(new THREE.BoxGeometry(4.6,2.3,0.1),new THREE.MeshStandardMaterial({color:0x333333,roughness:0.5,metalness:0.7}))
  sbFrame.position.set(0,13.5,H_m/2+0.15);scene.add(sbFrame)
  // Scoreboard cables
  ;[[-1.8,0],[1.8,0],[0,-0.9],[0,0.9]].forEach(([ox,oz])=>{
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,4,5),new THREE.MeshStandardMaterial({color:0x222222,metalness:0.8}))
    cable.position.set(ox,15.8,H_m/2+oz);scene.add(cable)
  })
}

/* ── basket ──────────────────────────────────────────────────── */
function addHoop(scene,courtType,H_m,flipped){
  const H_px=getH(courtType),mg=22,halfH=courtType==='full'?Math.round(H_px/2):H_px
  const sy=(halfH-2*mg)/14,rimY_px=mg+1.575*sy
  const rimZ=flipped?H_m-rimY_px*S:rimY_px*S
  const RIM_H=3.05,RIM_R=0.225,dir=flipped?1:-1

  const steelMat=new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:0.25,metalness:0.8})
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,4.2,10),steelMat)
  pole.position.set(0,2.1,rimZ+dir*1.05);scene.add(pole)
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,1.0),steelMat)
  arm.position.set(0,3.75,rimZ+dir*0.52);scene.add(arm)

  // Backboard — tinted glass
  const bbMat=new THREE.MeshPhongMaterial({color:0x99bbff,transparent:true,opacity:0.22,shininess:180,specular:0x88aaff})
  const bb=new THREE.Mesh(new THREE.BoxGeometry(1.83,1.07,0.04),bbMat)
  bb.position.set(0,RIM_H+0.535,rimZ+dir*0.12);scene.add(bb)
  // Board frame
  const fMat=new THREE.MeshStandardMaterial({color:0xdddddd,roughness:0.2,metalness:0.4})
  const bx=0,by=RIM_H+0.535,bz=rimZ+dir*0.12
  ;[[1.88,0.055,0.055,bx,by+0.537,bz],[1.88,0.055,0.055,bx,by-0.537,bz],[0.055,1.12,0.055,bx-0.935,by,bz],[0.055,1.12,0.055,bx+0.935,by,bz]]
    .forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fMat);m.position.set(x,y,z);scene.add(m)})
  // Orange targeting square
  const sqMat=new THREE.MeshStandardMaterial({color:0xff6600,emissive:0xff3300,emissiveIntensity:0.4,roughness:0.5})
  const sq=new THREE.Mesh(new THREE.BoxGeometry(0.59,0.45,0.055),sqMat)
  sq.position.set(bx,by,bz+dir*0.01);scene.add(sq)

  // Rim — glowing orange
  const rimMat=new THREE.MeshStandardMaterial({color:0xff5500,emissive:0xff4400,emissiveIntensity:0.5,roughness:0.25,metalness:0.45})
  const rim=new THREE.Mesh(new THREE.TorusGeometry(RIM_R,0.024,12,40),rimMat)
  rim.rotation.x=Math.PI/2;rim.position.set(0,RIM_H,rimZ);rim.castShadow=true;scene.add(rim)
  // Net
  const netMat=new THREE.MeshBasicMaterial({color:0xcccccc,transparent:true,opacity:0.28,wireframe:true,side:THREE.DoubleSide})
  const net=new THREE.Mesh(new THREE.ConeGeometry(RIM_R,0.48,14,5,true),netMat)
  net.position.set(0,RIM_H-0.24,rimZ);scene.add(net)
}

/* ── player model ────────────────────────────────────────────── */
function createPlayer(isOffense,num){
  const group=new THREE.Group()
  // Team colours — vivid and contrasting
  const jerseyHex =isOffense?0x1155cc:0xf5f5f5
  const accentHex =isOffense?0x55aaff:0xee3333
  const shortsHex =isOffense?0x0a2a66:0xd8d8d8
  const skinHex   =isOffense?0x7d5041:0xf0c89a
  const shoeHex   =isOffense?0x111122:0x333333

  const jMat =new THREE.MeshStandardMaterial({color:jerseyHex,roughness:0.65,metalness:0.0})
  const aMat =new THREE.MeshStandardMaterial({color:accentHex,emissive:accentHex,emissiveIntensity:0.08,roughness:0.6})
  const sMat =new THREE.MeshStandardMaterial({color:shortsHex,roughness:0.8})
  const skMat=new THREE.MeshStandardMaterial({color:skinHex,roughness:0.75})
  const shMat=new THREE.MeshStandardMaterial({color:shoeHex,roughness:0.55,metalness:0.1})

  // Floor shadow
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.36,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35}))
  shadow.rotation.x=-Math.PI/2;shadow.position.set(0,0.003,0);group.add(shadow)

  // Shoes
  ;[[-0.1,0],[0.1,0]].forEach(([ox])=>{
    const s=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.32),shMat);s.position.set(ox,0.05,0.02);group.add(s)
  })
  // Legs
  ;[[-0.11,0],[0.11,0]].forEach(([ox])=>{
    const l=new THREE.Mesh(new THREE.CylinderGeometry(0.087,0.082,0.82,9),sMat);l.position.set(ox,0.5,0);group.add(l)
  })
  // Torso
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.29,0.21,0.72,10),jMat)
  torso.position.set(0,1.24,0);torso.castShadow=true;group.add(torso)
  // Accent collar + sleeve band
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.295,0.295,0.08,10),aMat);collar.position.set(0,1.56,0);group.add(collar)
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.293,0.215,0.1,10),aMat);band.position.set(0,0.93,0);group.add(band)
  // Arms
  ;[[-1,1],[1,1]].forEach(([sx])=>{
    const u=new THREE.Mesh(new THREE.CylinderGeometry(0.092,0.083,0.44,8),jMat);u.rotation.z=sx*0.6;u.position.set(sx*0.42,1.17,0);group.add(u)
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.088,8,8),skMat);h.position.set(sx*0.56,0.96,0);group.add(h)
  })
  // Neck
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.097,0.103,0.16,8),skMat);neck.position.set(0,1.67,0);group.add(neck)
  // Head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.218,14,14),skMat);head.position.set(0,1.93,0);head.castShadow=true;group.add(head)
  // Hair
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.222,14,8,0,Math.PI*2,0,Math.PI*0.5),new THREE.MeshStandardMaterial({color:isOffense?0x1a0d00:0x2a1a0a,roughness:1}))
  hair.position.set(0,1.93,0);group.add(hair)

  // ── Number on TOP (visible from overhead) ──────────────────
  const mkNumCanvas=(size,bg,fg,txt)=>{
    const c=document.createElement('canvas');c.width=size;c.height=size
    const ctx=c.getContext('2d')
    ctx.beginPath();ctx.arc(size/2,size/2,size/2-4,0,Math.PI*2)
    ctx.fillStyle=bg;ctx.fill()
    ctx.strokeStyle=fg;ctx.lineWidth=size*0.05;ctx.stroke()
    ctx.fillStyle=fg;ctx.font=`bold ${size*0.48}px Arial,sans-serif`
    ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText(txt,size/2,size/2+size*0.03)
    return new THREE.CanvasTexture(c)
  }
  const numTop=new THREE.Mesh(new THREE.CircleGeometry(0.29,24),new THREE.MeshBasicMaterial({map:mkNumCanvas(192,isOffense?'#1155cc':'#f5f5f5',isOffense?'#ffffff':'#1155cc',String(num??'')),transparent:true,depthWrite:false}))
  numTop.rotation.x=-Math.PI/2;numTop.position.set(0,2.18,0);group.add(numTop)
  // Number on chest (side view)
  const numChest=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.28),new THREE.MeshBasicMaterial({map:mkNumCanvas(128,isOffense?'#1155cc':'#f5f5f5',isOffense?'#ffffff':'#1155cc',String(num??'')),transparent:true,depthWrite:false}))
  numChest.position.set(0,1.22,0.30);group.add(numChest)

  return group
}

/* ── ball ────────────────────────────────────────────────────── */
function createBall(scene){
  const ball=new THREE.Mesh(
    new THREE.SphereGeometry(0.122,20,20),
    new THREE.MeshStandardMaterial({color:0xff7518,roughness:0.5,metalness:0.0,emissive:0xff4400,emissiveIntensity:0.35})
  )
  ball.castShadow=true
  const lMat=new THREE.LineBasicMaterial({color:0x1a0800,linewidth:1})
  const mkC=()=>new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:41},(_,i)=>new THREE.Vector3(Math.cos(i/40*Math.PI*2)*0.125,0,Math.sin(i/40*Math.PI*2)*0.125))),lMat)
  const eq=mkC();ball.add(eq)
  const m1=mkC();m1.rotation.z=Math.PI/2;ball.add(m1)
  const m2=mkC();m2.rotation.x=Math.PI/2;ball.add(m2)
  // Ball glow light
  const glow=new THREE.PointLight(0xff6600,1.2,4)
  glow.position.set(0,0,0);ball.add(glow)
  scene.add(ball);return ball
}

/* ── camera presets ──────────────────────────────────────────── */
function applyCamera(cam,mode,H_m,W_m){
  if(mode==='marcador'){
    // Scoreboard: center-court elevated, looking toward basket
    cam.fov=48;cam.updateProjectionMatrix()
    cam.position.set(0,9,H_m*0.68)
    cam.lookAt(0,2.8,1.5)
  } else if(mode==='cenital'){
    cam.fov=40;cam.updateProjectionMatrix()
    cam.position.set(0,22,H_m/2-1.5)
    cam.lookAt(0,0,H_m/2)
  } else if(mode==='follow'){
    cam.fov=55;cam.updateProjectionMatrix()
    cam.position.set(0,8,H_m*0.6)
    cam.lookAt(0,0,H_m*0.3)
  } else {
    // lateral TV
    cam.fov=50;cam.updateProjectionMatrix()
    cam.position.set(W_m*0.72,7,H_m/2)
    cam.lookAt(0,1,H_m/2)
  }
}

/* ── main component ──────────────────────────────────────────── */
export default function Court3DView({phases,courtType}){
  const canvasRef  =useRef(null)
  const stateRef   =useRef(null)
  const animRef    =useRef(null)
  const composerRef=useRef(null)
  const [playing,   setPlaying]  =useState(false)
  const [recording, setRecording]=useState(false)
  const [camMode,   setCamMode]  =useState('marcador')
  const [initError, setInitError]=useState(null)

  const H_px=getH(courtType),H_m=H_px*S,W_m=CW*S

  /* ── scene init ──────────────────────────────────────────── */
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    let renderer,ro
    ;(async()=>{
      try{
        const W=canvas.clientWidth||900,H=canvas.clientHeight||540
        renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true})
        renderer.setSize(W,H,false)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
        renderer.shadowMap.enabled=true
        renderer.shadowMap.type=THREE.PCFSoftShadowMap
        renderer.toneMapping=THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure=1.2
        renderer.outputColorSpace=THREE.SRGBColorSpace

        const scene=new THREE.Scene()
        scene.background=new THREE.Color(0x040710)
        scene.fog=new THREE.FogExp2(0x040710,0.016)

        // Lighting
        scene.add(new THREE.AmbientLight(0xfff0d8,0.4))
        scene.add(new THREE.HemisphereLight(0x334466,0xb87428,0.3))
        // 4 strong arena spotlights with shadows
        ;[[0,18,H_m*0.12],[0,18,H_m*0.88],[-W_m*0.38,16,H_m/2],[W_m*0.38,16,H_m/2]].forEach(([x,y,z])=>{
          const dl=new THREE.DirectionalLight(0xfff8e8,0.75);dl.position.set(x,y,z);dl.castShadow=true
          dl.shadow.mapSize.set(1024,1024);dl.shadow.camera.near=1;dl.shadow.camera.far=45
          ;['left','right','top','bottom'].forEach((k,i)=>(dl.shadow.camera[k]=[-12,12,10,-10][i]))
          scene.add(dl)
        })
        // Accent from sides
        const sl1=new THREE.PointLight(0x1133aa,0.6,30);sl1.position.set(-W_m*0.8,4,H_m/2);scene.add(sl1)
        const sl2=new THREE.PointLight(0x1133aa,0.6,30);sl2.position.set( W_m*0.8,4,H_m/2);scene.add(sl2)

        // Court
        const tex=makeCourtTex(courtType)
        const floor=new THREE.Mesh(new THREE.PlaneGeometry(W_m,H_m),new THREE.MeshStandardMaterial({map:tex,roughness:0.32,metalness:0.06,envMapIntensity:0.4}))
        floor.rotation.x=-Math.PI/2;floor.position.set(0,0,H_m/2);floor.receiveShadow=true;scene.add(floor)
        // Court edge strips
        const eMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5})
        ;[[W_m+0.08,0.025,0.08,0,0.012,0],[W_m+0.08,0.025,0.08,0,0.012,H_m],[0.08,0.025,H_m,-W_m/2,0.012,H_m/2],[0.08,0.025,H_m,W_m/2,0.012,H_m/2]]
          .forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),eMat);m.position.set(x,y,z);scene.add(m)})

        buildArena(scene,W_m,H_m)
        addHoop(scene,courtType,H_m,false)
        if(courtType==='full')addHoop(scene,courtType,H_m,true)

        const camera=new THREE.PerspectiveCamera(48,W/H,0.1,200)
        applyCamera(camera,'marcador',H_m,W_m)

        // Players
        const playerMeshes={}
        const elems0=phases[0]?.elements||[]
        for(const el of elems0){
          if(!PLAYER_TYPES.includes(el.type))continue
          const mesh=createPlayer(el.type==='offense',el.num??'?')
          const{x,z}=p3(el.x,el.y);mesh.position.set(x,0,z)
          scene.add(mesh);playerMeshes[el.id]=mesh
        }
        const ball=createBall(scene)
        const ic=elems0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
        if(ic){const{x,z}=p3(ic.x,ic.y);ball.position.set(x,0.95,z)}
        else{const{x,z}=p3(CW/2,H_px*0.4);ball.position.set(x,0.95,z)}

        stateRef.current={renderer,scene,camera,playerMeshes,ball}

        // ── Bloom post-processing ──────────────────────────
        try{
          const[{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass}]=await Promise.all([
            import('three/addons/postprocessing/EffectComposer.js'),
            import('three/addons/postprocessing/RenderPass.js'),
            import('three/addons/postprocessing/UnrealBloomPass.js'),
            import('three/addons/postprocessing/OutputPass.js'),
          ])
          const comp=new EffectComposer(renderer)
          comp.addPass(new RenderPass(scene,camera))
          const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),0.42,0.5,0.82)
          comp.addPass(bloom)
          comp.addPass(new OutputPass())
          composerRef.current=comp
        }catch(be){console.warn('Bloom not available:',be)}

        const doRender=()=>{
          if(composerRef.current)composerRef.current.render()
          else renderer.render(scene,camera)
        }
        doRender()
        setInitError(null)

        ro=new ResizeObserver(()=>{
          const w=canvas.clientWidth,h=canvas.clientHeight
          renderer.setSize(w,h,false)
          if(composerRef.current)composerRef.current.setSize(w,h)
          camera.aspect=w/h;camera.updateProjectionMatrix();doRender()
        });ro.observe(canvas)
      }catch(e){console.error('3D init:',e);setInitError(e.message||String(e))}
    })()
    return()=>{cancelAnimationFrame(animRef.current);ro?.disconnect();try{renderer?.dispose()}catch(_){};composerRef.current=null;stateRef.current=null}
  },[phases,courtType]) // eslint-disable-line

  /* ── animation loop ──────────────────────────────────────── */
  function doRender(){
    const s=stateRef.current;if(!s)return
    if(composerRef.current)composerRef.current.render()
    else s.renderer.render(s.scene,s.camera)
  }

  function stopAnim(){
    cancelAnimationFrame(animRef.current);setPlaying(false)
    const s=stateRef.current;if(!s)return
    const e0=phases[0]?.elements||[]
    for(const el of e0){if(!PLAYER_TYPES.includes(el.type))continue;const m=s.playerMeshes[el.id];if(!m)continue;const{x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.y=0}
    const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(ic){const{x,z}=p3(ic.x,ic.y);s.ball.position.set(x,0.95,z)}
    s.ball.scale.setScalar(1);doRender()
  }

  function startAnim(){
    const s=stateRef.current;if(!s||playing)return
    setPlaying(true)
    const{scene,camera,playerMeshes,ball}=s
    const nP=phases.length
    const meta=phases.map(ph=>({n:getNumSteps(ph.elements||[]),get dur(){return this.n*STEP_DUR+PHASE_HOLD}}))
    const starts=[0];for(let i=0;i<nP;i++)starts.push(starts[i]+meta[i].dur)
    const total=starts[nP],t0=performance.now()

    // Subtle camera breathing (only marcador/lateral)
    let camBreath=0

    function frame(ts){
      const el=ts-t0;if(el>=total){doRender();setTimeout(stopAnim,800);return}
      let pi=nP-1;for(let i=0;i<nP;i++)if(el<starts[i+1]){pi=i;break}
      const pe=el-starts[pi],{n}=meta[pi]
      const si=Math.min(Math.floor(pe/STEP_DUR),n-1)
      const st=Math.min((pe-si*STEP_DUR)/STEP_MOVE_DUR,1),et=ease(st)
      const elems=phases[pi]?.elements||[]
      const{playerPos:basePos,carrierId:baseC}=accumulateSteps(elems,si,H_px,courtType)
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
        let p2=null,bd2=PR*3
        for(const p of elems){if(!PLAYER_TYPES.includes(p.type)||p.id===p1)continue;const bp=basePos[p.id];if(!bp)continue;const d=Math.hypot(bp.x-e.x2,bp.y-e.y2);if(d<bd2){bd2=d;p2=p.id}}
        if(!p2)continue
        tgts[p1]={x:basePos[p2].x,y:basePos[p2].y};tgts[p2]={x:basePos[p1].x,y:basePos[p1].y}
      }
      const hasBX=elems.some(e=>(e.type==='pass'||e.type==='handoff')&&(e.step??0)===si)
      for(const e of elems){
        if(!['defense','xdefense'].includes(e.type)||!e.num||tgts[e.id])continue
        const att=elems.find(x=>x.type==='offense'&&x.num===e.num);if(!att||!basePos[att.id])continue
        if(!tgts[att.id]&&!hasBX)continue
        const ae=tgts[att.id]||basePos[att.id],be=baseC?(tgts[baseC]||basePos[baseC]):null
        const id2=computeSmartDefPos(ae,be,courtType,H_px)
        tgts[e.id]={x:Math.max(PR+4,Math.min(CW-PR-4,id2.x)),y:Math.max(PR+4,Math.min(H_px-PR-4,id2.y))}
      }
      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=basePos[e.id];if(!b)continue
        const t=tgts[e.id]||b
        const bp=p3(b.x,b.y),tp=p3(t.x,t.y)
        m.position.x=lerp(bp.x,tp.x,et);m.position.z=lerp(bp.z,tp.z,et)
        const dx=tp.x-bp.x,dz=tp.z-bp.z;if(Math.hypot(dx,dz)>0.02)m.rotation.y=Math.atan2(dx,dz)
      }
      // ball
      let bx=null,by=0.95,bz=null;ball.scale.setScalar(1)
      if(st>0&&baseC){
        const cB=basePos[baseC]
        const ho=elems.find(e=>e.type==='handoff'&&(e.step??0)===si&&tgts[e.fromId||''])
        if(ho&&cB&&tgts[ho.fromId]){
          const p1b=p3(basePos[ho.fromId]?.x??cB.x,basePos[ho.fromId]?.y??cB.y)
          const p2k=Object.keys(tgts).find(k=>k!==ho.fromId&&basePos[k]&&Math.hypot(basePos[k].x-ho.x2,basePos[k].y-ho.y2)<PR*3)
          if(p2k){const p2b=p3(basePos[p2k].x,basePos[p2k].y);if(et<0.5){bx=lerp(p1b.x,p2b.x,et);bz=lerp(p1b.z,p2b.z,et)}else{bx=lerp(p2b.x,p1b.x,et);bz=lerp(p2b.z,p1b.z,et)};by=0.95}
        }
        if(bx===null){
          const sh=elems.find(e=>e.type==='shot'&&(e.step??0)===si&&(e.fromId===baseC||!e.fromId))
          if(sh&&cB){
            const sp=p3(cB.x,cB.y),ep=p3(sh.x2,sh.y2),dist=Math.hypot(ep.x-sp.x,ep.z-sp.z)
            bx=lerp(sp.x,ep.x,et);bz=lerp(sp.z,ep.z,et);by=0.95+dist*0.6*Math.sin(et*Math.PI)
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
        if(bx===null&&tgts[baseC]){const bp2=p3(cB.x,cB.y),tp2=p3(tgts[baseC].x,tgts[baseC].y);bx=lerp(bp2.x,tp2.x,et);bz=lerp(bp2.z,tp2.z,et);by=0.95+Math.abs(Math.sin(et*Math.PI*5))*0.22}
        if(bx===null){const cp=p3(cB.x,cB.y);bx=cp.x;bz=cp.z}
      }
      if(bx!==null)ball.position.set(bx,by,bz)

      // camera movement
      camBreath+=0.015
      if(camMode==='follow'&&bx!==null){
        camera.position.set(bx,10,bz-5.5);camera.lookAt(bx,0,bz+2)
      } else if(camMode==='marcador'){
        // subtle breath
        camera.position.y=9+Math.sin(camBreath)*0.08
      }

      doRender()
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
    if(!playing)doRender()
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

  const btn=active=>({
    padding:'7px 14px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,
    border:`1px solid ${active?'rgba(59,130,246,0.6)':'rgba(255,255,255,0.08)'}`,
    background:active?'rgba(59,130,246,0.18)':'rgba(255,255,255,0.04)',
    color:active?'#93c5fd':'rgba(255,255,255,0.45)',transition:'all 0.15s',
  })

  return(
    <div style={{position:'relative',width:'100%',height:'100%',background:'#040710',display:'flex',flexDirection:'column'}}>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>

      {/* Cinematic vignette overlay */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',pointerEvents:'none'}}/>

      {/* Controls */}
      <div style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:8,background:'rgba(4,7,16,0.9)',backdropFilter:'blur(20px)',padding:'11px 18px',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={playing?stopAnim:startAnim} style={{padding:'10px 26px',borderRadius:12,border:'none',cursor:'pointer',background:playing?'#d97706':'#2563eb',color:'#fff',fontWeight:800,fontSize:13,boxShadow:playing?'none':'0 0 20px rgba(37,99,235,0.5)',letterSpacing:0.3}}>
          {playing?'⏹ Parar':'▶ Reproducir'}
        </button>
        <div style={{width:1,height:24,background:'rgba(255,255,255,0.08)'}}/>
        {[['marcador','📺 Marcador'],['cenital','🔭 Cenital'],['follow','🏀 Balón'],['lateral','📷 Lateral']].map(([m,l])=>(
          <button key={m} onClick={()=>toggleCam(m)} style={btn(camMode===m)}>{l}</button>
        ))}
        <div style={{width:1,height:24,background:'rgba(255,255,255,0.08)'}}/>
        <button onClick={exportVideo} disabled={recording} style={{padding:'8px 16px',borderRadius:10,border:'none',cursor:recording?'not-allowed':'pointer',background:recording?'rgba(55,65,81,0.8)':'rgba(124,58,237,0.7)',color:'#fff',fontWeight:700,fontSize:12,border:'1px solid rgba(124,58,237,0.4)'}}>
          {recording?'⏺ Grabando...':'🎬 Exportar'}
        </button>
      </div>

      {/* Info pill */}
      <div style={{position:'absolute',top:14,left:16,background:'rgba(4,7,16,0.75)',backdropFilter:'blur(12px)',padding:'5px 14px',borderRadius:20,color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:600,border:'1px solid rgba(255,255,255,0.06)',letterSpacing:0.5}}>
        {phases.length} FASE{phases.length!==1?'S':''} · {courtType==='full'?'PISTA COMPLETA':'MEDIA PISTA'}
      </div>
    </div>
  )
}
