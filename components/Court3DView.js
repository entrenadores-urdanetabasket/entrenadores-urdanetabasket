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
   HELPERS: materials + outline
══════════════════════════════════════════════════════════════ */
let _toonGrad=null
function getToonGrad(){
  if(_toonGrad)return _toonGrad
  const c=document.createElement('canvas');c.width=4;c.height=1
  const ctx=c.getContext('2d')
  ;['#1a1a1a','#606060','#c0c0c0','#ffffff'].forEach((col,i)=>{ctx.fillStyle=col;ctx.fillRect(i,0,1,1)})
  _toonGrad=new THREE.CanvasTexture(c)
  _toonGrad.magFilter=THREE.NearestFilter;_toonGrad.minFilter=THREE.NearestFilter
  return _toonGrad
}
function tm(col){return new THREE.MeshToonMaterial({color:col,gradientMap:getToonGrad()})}
function smMat(col,rough=0.62){return new THREE.MeshStandardMaterial({color:col,roughness:rough,metalness:0})}
function ol(mesh,sc=1.055){
  const m=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color:0x060606,side:THREE.BackSide}))
  m.scale.setScalar(sc);mesh.add(m)
}
// Lathe helper — profile points [r,y] → LatheGeometry
function lathe(pts,seg=14){return new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg)}
function cylM(r1,r2,h,seg,mat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),mat);m.castShadow=true;return m}
function sphM(r,ws,hs,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),mat);m.castShadow=true;return m}
function boxM(w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.castShadow=true;return m}

/* ── palettes ──────────────────────────────────────────────── */
const SKINS=[0x7a4f3a,0xc07840,0xedc9a0,0x5c3520,0xd4956a,0x3d2010]
const HAIRS=[0x0d0400,0x1e0e04,0x241005,0x100804,0x180a03,0x4a3020]

/* ══════════════════════════════════════════════════════════════
   CARA DETALLADA — canvas 512x512 con ojos, nariz, boca, cejas
   Se aplica como PlaneGeometry billboard delante de la cabeza
══════════════════════════════════════════════════════════════ */
function makeDetailFace(skinHex,hairHex){
  const S=512,c=document.createElement('canvas');c.width=S;c.height=S
  const ctx=c.getContext('2d')
  const sr=(skinHex>>16)&0xff,sg=(skinHex>>8)&0xff,sb=skinHex&0xff

  // ── Profundidad de piel: gradiente radial para dar volumen ──
  const dg=ctx.createRadialGradient(S*.50,S*.42,S*.04,S*.50,S*.50,S*.47)
  dg.addColorStop(0,`rgba(${Math.min(255,sr+32)},${Math.min(255,sg+24)},${Math.min(255,sb+18)},0.40)`)
  dg.addColorStop(.65,`rgba(${sr},${sg},${sb},0.0)`)
  dg.addColorStop(1,`rgba(0,0,0,0.28)`)
  ctx.fillStyle=dg
  ctx.beginPath();ctx.ellipse(S*.5,S*.50,S*.46,S*.48,0,0,Math.PI*2);ctx.fill()

  // ── OJOS ──────────────────────────────────────────────────
  const eyeY=S*.40,eX=S*.155
  ;[S*.5-eX,S*.5+eX].forEach(ex=>{
    // sombra ocular
    ctx.fillStyle='rgba(0,0,0,0.12)'
    ctx.beginPath();ctx.ellipse(ex,eyeY,S*.122,S*.085,0,0,Math.PI*2);ctx.fill()
    // esclerótica
    ctx.fillStyle='#f6f6f4'
    ctx.beginPath();ctx.ellipse(ex,eyeY,S*.104,S*.070,0,0,Math.PI*2);ctx.fill()
    // iris (color según tono de piel)
    const irisC=sr<120?'#3d2205':'#284478'
    ctx.fillStyle=irisC
    ctx.beginPath();ctx.arc(ex,eyeY,S*.052,0,Math.PI*2);ctx.fill()
    // degradado iris para profundidad
    const ig=ctx.createRadialGradient(ex-S*.012,eyeY-S*.012,S*.005,ex,eyeY,S*.052)
    ig.addColorStop(0,'rgba(255,255,255,0.10)');ig.addColorStop(1,'rgba(0,0,0,0.25)')
    ctx.fillStyle=ig;ctx.beginPath();ctx.arc(ex,eyeY,S*.052,0,Math.PI*2);ctx.fill()
    // pupila
    ctx.fillStyle='#050505'
    ctx.beginPath();ctx.arc(ex,eyeY,S*.029,0,Math.PI*2);ctx.fill()
    // brillo principal
    ctx.fillStyle='rgba(255,255,255,0.94)'
    ctx.beginPath();ctx.arc(ex+S*.018,eyeY-S*.024,S*.018,0,Math.PI*2);ctx.fill()
    // brillo secundario pequeño
    ctx.fillStyle='rgba(255,255,255,0.58)'
    ctx.beginPath();ctx.arc(ex-S*.032,eyeY+S*.024,S*.011,0,Math.PI*2);ctx.fill()
    // párpado superior
    ctx.strokeStyle='rgba(0,0,0,0.65)';ctx.lineWidth=S*.022
    ctx.beginPath();ctx.arc(ex,eyeY,S*.100,Math.PI*1.08,Math.PI*1.92);ctx.stroke()
    // línea inferior párpado
    ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=S*.012
    ctx.beginPath();ctx.arc(ex,eyeY,S*.100,Math.PI*.06,Math.PI*.94);ctx.stroke()
    // pestañas superiores (4 líneas cortas)
    ctx.strokeStyle='rgba(0,0,0,0.70)';ctx.lineWidth=S*.014;ctx.lineCap='round'
    for(let i=-2;i<=2;i++){
      const a=Math.PI*1.5+i*0.18
      ctx.beginPath()
      ctx.moveTo(ex+Math.cos(a)*S*.100,eyeY+Math.sin(a)*S*.100)
      ctx.lineTo(ex+Math.cos(a)*S*.124,eyeY+Math.sin(a)*S*.124-S*.010)
      ctx.stroke()
    }
  })

  // ── CEJAS ─────────────────────────────────────────────────
  const browY=eyeY-S*.096
  const browDark=`rgba(${Math.max(0,sr-82)},${Math.max(0,sg-66)},${Math.max(0,sb-56)},0.94)`
  ;[[S*.5-eX,-1],[S*.5+eX,1]].forEach(([bx,sign])=>{
    ctx.save()
    ctx.strokeStyle=browDark;ctx.lineWidth=S*.052;ctx.lineCap='round';ctx.lineJoin='round'
    ctx.beginPath()
    ctx.moveTo(bx-S*.106,browY+S*.030*sign*.4)
    ctx.quadraticCurveTo(bx,browY-S*.016,bx+S*.106,browY+S*.022*sign)
    ctx.stroke()
    // relleno más oscuro en borde inferior
    ctx.strokeStyle=browDark.replace('0.94','0.40');ctx.lineWidth=S*.020
    ctx.beginPath()
    ctx.moveTo(bx-S*.100,browY+S*.042*sign*.4)
    ctx.quadraticCurveTo(bx,browY,bx+S*.100,browY+S*.036*sign)
    ctx.stroke()
    ctx.restore()
  })

  // ── NARIZ ─────────────────────────────────────────────────
  const noseY=S*.585
  // puente nasal
  ctx.strokeStyle=`rgba(${Math.max(0,sr-58)},${Math.max(0,sg-48)},${Math.max(0,sb-40)},0.48)`
  ctx.lineWidth=S*.026;ctx.lineCap='round'
  ctx.beginPath();ctx.moveTo(S*.5,eyeY+S*.06);ctx.lineTo(S*.5,noseY);ctx.stroke()
  // alas nasales
  ctx.fillStyle=`rgba(${Math.max(0,sr-48)},${Math.max(0,sg-40)},${Math.max(0,sb-34)},0.45)`
  ;[-S*.060,S*.060].forEach(ox=>{
    ctx.beginPath();ctx.ellipse(S*.5+ox,noseY+S*.022,S*.042,S*.032,0,0,Math.PI*2);ctx.fill()
  })
  // punta nasal — sombra
  ctx.fillStyle=`rgba(${Math.max(0,sr-38)},${Math.max(0,sg-30)},${Math.max(0,sb-25)},0.30)`
  ctx.beginPath();ctx.arc(S*.5,noseY,S*.028,0,Math.PI*2);ctx.fill()

  // ── BOCA ──────────────────────────────────────────────────
  const mY=S*.735
  // labio superior (arco de cupido)
  ctx.fillStyle=`rgba(${Math.max(0,sr-52)},${Math.max(0,sg-44)},${Math.max(0,sb-40)},0.82)`
  ctx.beginPath()
  ctx.moveTo(S*.368,mY+S*.010)
  ctx.quadraticCurveTo(S*.428,mY-S*.028,S*.500,mY+S*.002)
  ctx.quadraticCurveTo(S*.572,mY-S*.028,S*.632,mY+S*.010)
  ctx.quadraticCurveTo(S*.568,mY+S*.044,S*.500,mY+S*.040)
  ctx.quadraticCurveTo(S*.432,mY+S*.044,S*.368,mY+S*.010)
  ctx.fill()
  // labio inferior
  ctx.fillStyle=`rgba(${Math.max(0,sr-36)},${Math.max(0,sg-30)},${Math.max(0,sb-26)},0.72)`
  ctx.beginPath();ctx.ellipse(S*.5,mY+S*.062,S*.085,S*.040,0,0,Math.PI*2);ctx.fill()
  // brillo labio inferior
  ctx.fillStyle='rgba(255,255,255,0.15)'
  ctx.beginPath();ctx.ellipse(S*.5,mY+S*.055,S*.048,S*.018,0,0,Math.PI*2);ctx.fill()
  // línea intermedia boca
  ctx.strokeStyle=`rgba(${Math.max(0,sr-78)},${Math.max(0,sg-62)},${Math.max(0,sb-54)},0.72)`
  ctx.lineWidth=S*.015;ctx.lineCap='round'
  ctx.beginPath();ctx.moveTo(S*.368,mY+S*.014);ctx.lineTo(S*.632,mY+S*.014);ctx.stroke()
  // comisuras
  ctx.strokeStyle=`rgba(${Math.max(0,sr-45)},${Math.max(0,sg-36)},${Math.max(0,sb-30)},0.35)`
  ctx.lineWidth=S*.018;ctx.lineCap='round'
  ;[-S*.075,S*.075].forEach(ox=>{
    ctx.beginPath();ctx.arc(S*.5+ox,mY-S*.072,S*.098,Math.PI*.52,Math.PI*.95);ctx.stroke()
  })

  // ── MENTÓN ────────────────────────────────────────────────
  ctx.strokeStyle=`rgba(${Math.max(0,sr-28)},${Math.max(0,sg-22)},${Math.max(0,sb-18)},0.20)`
  ctx.lineWidth=S*.034;ctx.lineCap='round'
  ctx.beginPath();ctx.arc(S*.5,mY+S*.195,S*.136,Math.PI*.12,Math.PI*.88);ctx.stroke()

  const tex=new THREE.CanvasTexture(c);tex.anisotropy=16;return tex
}

/* ══════════════════════════════════════════════════════════════
   JERSEY TEXTURE — stripes, number area, subtle creases
══════════════════════════════════════════════════════════════ */
function makeJerseyTex(isOffense,accentHex){
  const S=256,c=document.createElement('canvas');c.width=S;c.height=S
  const ctx=c.getContext('2d')
  const ar=(accentHex>>16)&0xff,ag=(accentHex>>8)&0xff,ab=accentHex&0xff
  // bandas laterales del acento
  ctx.fillStyle=`rgba(${ar},${ag},${ab},0.85)`
  ctx.fillRect(0,0,S*.10,S);ctx.fillRect(S*.90,0,S*.10,S)
  // arrugas sutiles del tejido
  ctx.strokeStyle='rgba(0,0,0,0.07)';ctx.lineWidth=1.5
  ;[S*.3,S*.5,S*.7].forEach(y=>{
    ctx.beginPath();ctx.moveTo(S*.10,y);ctx.lineTo(S*.90,y);ctx.stroke()
  })
  // sombra bajo cuello
  const ng=ctx.createLinearGradient(0,0,0,S*.18)
  ng.addColorStop(0,'rgba(0,0,0,0.15)');ng.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=ng;ctx.fillRect(S*.10,0,S*.80,S*.18)
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=8;return tex
}

/* ══════════════════════════════════════════════════════════════
   SHOE TEXTURE — cordones y logo
══════════════════════════════════════════════════════════════ */
function makeShoeTex(shoeHex,accentHex){
  const S=128,c=document.createElement('canvas');c.width=S;c.height=S*.60|0
  const ctx=c.getContext('2d')
  const ar=(accentHex>>16)&0xff,ag=(accentHex>>8)&0xff,ab=accentHex&0xff
  ctx.fillStyle=`rgb(${ar},${ag},${ab})`;ctx.fillRect(S*.20,0,S*.60,4)
  // cordones
  ctx.strokeStyle='rgba(255,255,255,0.70)';ctx.lineWidth=2
  ;[.25,.35,.45,.55,.65,.75].forEach(y=>{
    ctx.beginPath();ctx.moveTo(S*.28,S*.60*y);ctx.lineTo(S*.72,S*.60*y);ctx.stroke()
  })
  const tex=new THREE.CanvasTexture(c);return tex
}

/* ══════════════════════════════════════════════════════════════
   JUGADOR ARTICULADO — NBA proportions + cara detallada
   Altura ~2.05m. Joints para animación completa.
══════════════════════════════════════════════════════════════ */
function createPlayer(isOffense,num,idx=0){
  const G=new THREE.Group()
  const jC=isOffense?0x1a3a8a:0xf0f0f0
  const sC=isOffense?0x0e1e55:0xd5d5d5
  const aC=isOffense?0xf5c518:0xcc2222
  const skC=SKINS[idx%SKINS.length]
  const hC=HAIRS[idx%HAIRS.length]
  const shC=isOffense?0x111111:0xf0f0f0

  // Jersey usa StandardMaterial con textura para mejor luz PBR
  const jTex=makeJerseyTex(isOffense,aC)
  const J=new THREE.MeshStandardMaterial({color:jC,map:jTex,roughness:0.80,metalness:0})
  const S=new THREE.MeshStandardMaterial({color:sC,roughness:0.82,metalness:0})
  const SK=smMat(skC,0.65)  // piel: Standard para SSS aproximado
  const AC=tm(aC)
  const SH=new THREE.MeshStandardMaterial({color:shC,roughness:0.55,metalness:0.05})
  const WHT=smMat(0xfafafa,0.85)

  // ── Sombra suelo ──────────────────────────────────────────
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.42,24),
    new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:0.38}))
  shadow.rotation.x=-Math.PI/2;shadow.position.y=0.002;G.add(shadow)

  // ══ PIERNAS con LatheGeometry muscular ═══════════════════
  function makeLeg(sx){
    const hipG=new THREE.Group()
    hipG.position.set(sx*0.122,0.92,0)

    // MUSLO: LatheGeometry — quad y bíceps femoral
    const thighGeo=lathe([
      [0.00,  0.00], [0.092,0.02],[0.110,0.10],  // quad
      [0.116,0.22],[0.112,0.34],[0.098,0.46],     // rodilla
    ],13)
    const thigh=new THREE.Mesh(thighGeo,S);thigh.castShadow=true
    thigh.position.y=-0.46;ol(thigh,1.05);hipG.add(thigh)

    const kneeG=new THREE.Group();kneeG.position.y=-0.46

    // PANTORRILLA: LatheGeometry — gemelo
    const calfGeo=lathe([
      [0.00,0.00],[0.065,0.02],[0.082,0.12],   // gemelo
      [0.078,0.24],[0.064,0.38],[0.056,0.46],  // tobillo
    ],12)
    const calf=new THREE.Mesh(calfGeo,SK);calf.castShadow=true
    calf.position.y=-0.46;ol(calf,1.05);kneeG.add(calf)

    // CALCETÍN
    const sockGeo=lathe([[0.00,0],[0.072,0.01],[0.074,0.14],[0.070,0.16]],12)
    const sock=new THREE.Mesh(sockGeo,WHT);sock.position.y=-0.46;kneeG.add(sock)

    // ZAPATILLA con forma más realista
    const shoeGrp=new THREE.Group();shoeGrp.position.set(0,-0.525,0.035)
    // suela
    const soleGeo=new THREE.BoxGeometry(0.205,0.038,0.330)
    const soleMesh=new THREE.Mesh(soleGeo,new THREE.MeshStandardMaterial({color:aC,roughness:0.5}))
    soleMesh.position.y=-0.022;shoeGrp.add(soleMesh)
    // parte superior (forma ligeramente curvada)
    const upperGeo=new THREE.BoxGeometry(0.192,0.098,0.318)
    const upperMesh=new THREE.Mesh(upperGeo,SH);upperMesh.position.y=0.022
    upperMesh.castShadow=true;ol(upperMesh,1.03);shoeGrp.add(upperMesh)
    // lengüeta / cordones (plano con textura)
    const laceTex=makeShoeTex(shC,aC)
    const lacePlane=new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.12),
      new THREE.MeshBasicMaterial({map:laceTex,transparent:true,alphaTest:0.01}))
    lacePlane.position.set(0,0.068,0.155);lacePlane.rotation.x=-0.22;shoeGrp.add(lacePlane)
    kneeG.add(shoeGrp)

    hipG.add(kneeG);G.add(hipG)
    return{hipG,kneeG}
  }
  const LL=makeLeg(-1),RL=makeLeg(1)

  // ══ TORSO GROUP — LatheGeometry trapezoidal (hombros anchos) ═
  const torsoG=new THREE.Group();torsoG.position.y=0.92

  // cinturilla
  const waistGeo=lathe([[0.00,0],[0.240,0.01],[0.252,0.10],[0.248,0.12]],16)
  const waistM=new THREE.Mesh(waistGeo,AC);waistM.position.y=0;torsoG.add(waistM)

  // torso: wide at shoulders, tapers at waist
  const bodyGeo=lathe([
    [0.00,0.00],[0.238,0.02],[0.252,0.10],  // cintura
    [0.270,0.28],[0.295,0.48],               // pecho
    [0.305,0.62],[0.298,0.72],               // pectoral
    [0.268,0.76],[0.220,0.80],               // hombro
  ],16)
  const bodyM=new THREE.Mesh(bodyGeo,J);bodyM.castShadow=true
  bodyM.position.y=0;ol(bodyM,1.035);torsoG.add(bodyM)

  // collar
  const collarGeo=lathe([[0.00,0],[0.148,0.01],[0.152,0.07],[0.148,0.08]],14)
  const collarM=new THREE.Mesh(collarGeo,AC);collarM.position.y=0.78;torsoG.add(collarM)

  // caps de hombro esféricos
  ;[-1,1].forEach(sx=>{
    const cap=sphM(0.085,10,10,J);cap.castShadow=true
    cap.position.set(sx*0.310,0.76,0);ol(cap,1.04);torsoG.add(cap)
  })

  G.add(torsoG)

  // ══ BRAZOS con LatheGeometry muscular ════════════════════
  function makeArm(sx){
    const shG=new THREE.Group()
    shG.position.set(sx*0.310,0.76+0.92,0)

    // BÍCEP: LatheGeometry
    const bicepGeo=lathe([
      [0.00,0.00],[0.088,0.01],[0.098,0.10],  // bicep pico
      [0.090,0.22],[0.078,0.38],[0.072,0.42],
    ],11)
    const bicep=new THREE.Mesh(bicepGeo,J);bicep.castShadow=true
    bicep.position.y=-0.42;ol(bicep,1.05);shG.add(bicep)

    const elG=new THREE.Group();elG.position.y=-0.42

    // ANTEBRAZO
    const foreGeo=lathe([
      [0.00,0.00],[0.070,0.01],[0.078,0.08],  // pico del antebrazo
      [0.068,0.22],[0.055,0.36],[0.048,0.40],
    ],11)
    const fore=new THREE.Mesh(foreGeo,SK);fore.castShadow=true
    fore.position.y=-0.40;ol(fore,1.05);elG.add(fore)

    // MANO — ligeramente aplanada para realismo
    const handGeo=new THREE.SphereGeometry(0.072,12,10)
    const hand=new THREE.Mesh(handGeo,SK);hand.castShadow=true
    hand.scale.set(1.10,0.82,1.20);hand.position.y=-0.43
    ol(hand,1.06);elG.add(hand)
    // dedos simplificados (3 esferas pequeñas)
    ;[-0.035,0,0.035].forEach((ox,i)=>{
      const fing=new THREE.Mesh(new THREE.SphereGeometry(0.022,8,6),SK)
      fing.scale.set(0.8,1,1.5);fing.position.set(ox,-0.50+i*0.003,0.040)
      elG.add(fing)
    })

    shG.add(elG);torsoG.add(shG)
    return{shG,elG,hand}
  }
  const LA=makeArm(-1),RA=makeArm(1)

  // ══ CUELLO ════════════════════════════════════════════════
  const neckGeo=lathe([[0.00,0],[0.112,0.01],[0.118,0.10],[0.108,0.20],[0.098,0.22]],12)
  const neckM=new THREE.Mesh(neckGeo,SK);neckM.castShadow=true
  neckM.position.set(0,0.92+0.82+0.02,0);ol(neckM);G.add(neckM)

  // ══ CABEZA ════════════════════════════════════════════════
  const headG=new THREE.Group()
  headG.position.set(0,0.92+0.82+0.26,0)

  // Cráneo con SphereGeometry alta resolución
  const skull=sphM(0.228,22,18,SK);skull.scale.set(1.0,1.08,0.98)
  skull.castShadow=true;ol(skull,1.038);headG.add(skull)

  // CARA DETALLADA — PlaneGeometry con canvas de cara
  const faceTex=makeDetailFace(skC,hC)
  const faceMat=new THREE.MeshBasicMaterial({map:faceTex,transparent:true,alphaTest:0.01,depthWrite:false})
  const facePlane=new THREE.Mesh(new THREE.PlaneGeometry(0.44,0.44),faceMat)
  facePlane.position.set(0,0.02,0.215)
  headG.add(facePlane)

  // PELO — varios volúmenes para más realismo
  const hairMat=new THREE.MeshStandardMaterial({color:hC,roughness:0.95,metalness:0})
  // capa base
  const hairBase=new THREE.Mesh(new THREE.SphereGeometry(0.232,16,10,0,Math.PI*2,0,Math.PI*.47),hairMat)
  headG.add(hairBase)
  // volumen superior adicional
  const hairTop=new THREE.Mesh(new THREE.SphereGeometry(0.225,14,8,0,Math.PI*2,0,Math.PI*.25),hairMat)
  hairTop.position.y=0.06;headG.add(hairTop)
  // contorno negro
  const hairOL=new THREE.Mesh(new THREE.SphereGeometry(0.238,16,10,0,Math.PI*2,0,Math.PI*.47),
    new THREE.MeshBasicMaterial({color:0x060606,side:THREE.BackSide}))
  headG.add(hairOL)
  // orejas
  ;[-1,1].forEach(sx=>{
    const earGeo=new THREE.SphereGeometry(0.038,8,8);earGeo.scale(1,1.4,0.5)
    const ear=new THREE.Mesh(earGeo,SK);ear.position.set(sx*0.225,-0.02,0)
    headG.add(ear)
  })

  G.add(headG)

  // ══ NÚMEROS ══════════════════════════════════════════════
  function numTex(sz,bg,fg,t){
    const cv=document.createElement('canvas');cv.width=sz;cv.height=sz
    const cx=cv.getContext('2d');cx.fillStyle=bg;cx.fillRect(0,0,sz,sz)
    cx.fillStyle=fg;cx.font=`bold ${Math.round(sz*.50)}px Arial,sans-serif`
    cx.textAlign='center';cx.textBaseline='middle';cx.fillText(t,sz/2,sz/2+sz*.03)
    return new THREE.CanvasTexture(cv)
  }
  const nbg=isOffense?'#1a3a8a':'#f0f0f0',nfg=isOffense?'#f5c518':'#1a3a8a'
  const nStr=String(num??'')
  const topN=new THREE.Mesh(new THREE.CircleGeometry(0.24,22),
    new THREE.MeshBasicMaterial({map:numTex(160,nbg,nfg,nStr),transparent:true,depthWrite:false}))
  topN.rotation.x=-Math.PI/2;topN.position.set(0,2.28,0);G.add(topN)
  const chN=new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.24),
    new THREE.MeshBasicMaterial({map:numTex(120,nbg,nfg,nStr),transparent:true,depthWrite:false}))
  chN.position.set(0,0.92+0.55,0.306);G.add(chN)

  // ══ JOINTS PARA ANIMACIÓN ════════════════════════════════
  G.userData={
    leftHipG:LL.hipG,rightHipG:RL.hipG,
    leftKneeG:LL.kneeG,rightKneeG:RL.kneeG,
    leftShG:LA.shG,rightShG:RA.shG,
    leftElG:LA.elG,rightElG:RA.elG,
    rightHand:RA.hand,leftHand:LA.hand,
    torsoG,headG,
    leftArm:LA.shG,rightArm:RA.shG,
    leftFore:LA.elG,rightFore:RA.elG,
  }
  return G
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
    let renderer,ro
    try{
      // Leer dimensiones después de que el layout está pintado
      const rect=mount.getBoundingClientRect()
      const W=Math.max(rect.width,400)||900
      const H=Math.max(rect.height,300)||540

      // Three.js creates its own canvas and appends it to the mount div
      renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
      renderer.setSize(W,H)   // sets canvas attributes correctly
      renderer.domElement.style.width='100%'
      renderer.domElement.style.height='100%'
      renderer.domElement.style.display='block'
      mount.appendChild(renderer.domElement)
      renderer.shadowMap.enabled=true
      renderer.shadowMap.type=THREE.PCFSoftShadowMap
      renderer.toneMapping=THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure=1.05
      renderer.outputColorSpace=THREE.SRGBColorSpace

      const full=H_m>20
      const scene=new THREE.Scene()
      scene.background=new THREE.Color(0x080b14)
      scene.fog=new THREE.Fog(0x080b14,45,90)

      // ── Pabellón bien iluminado ────────────────────────────────
      // Luz ambiental alta — pabellón moderno con LED
      scene.add(new THREE.AmbientLight(0xfff8f0,0.90))
      // 6 focos cenital de techo — cuadriculados como en un pabellón real
      const spotDist=full?65:45
      ;[
        [0,          full?34:28, H_m*0.10],
        [0,          full?34:28, H_m*0.90],
        [-W_m*0.38,  full?28:22, H_m*0.28],
        [ W_m*0.38,  full?28:22, H_m*0.28],
        [-W_m*0.38,  full?28:22, H_m*0.72],
        [ W_m*0.38,  full?28:22, H_m*0.72],
      ].forEach(([x,y,z])=>{
        const sp=new THREE.SpotLight(0xfffaf0,full?2.8:3.2)
        sp.position.set(x,y,z)
        sp.target.position.set(x*0.15,0,z)
        sp.angle=Math.PI/5.5
        sp.penumbra=0.45
        sp.decay=1.2
        sp.distance=spotDist
        sp.castShadow=true
        sp.shadow.mapSize.set(512,512)
        sp.shadow.camera.near=1;sp.shadow.camera.far=spotDist+5
        scene.add(sp);scene.add(sp.target)
      })
      // Luces de relleno laterales cálidas (rebote desde graderías)
      const fillRange=full?70:48
      const fill1=new THREE.PointLight(0xffe8c8,0.55,fillRange);fill1.position.set(-W_m*1.3,4,H_m/2);scene.add(fill1)
      const fill2=new THREE.PointLight(0xffe8c8,0.55,fillRange);fill2.position.set( W_m*1.3,4,H_m/2);scene.add(fill2)
      // Luz desde debajo de cámara para eliminar sombras duras en vista cenital
      const fillBot=new THREE.DirectionalLight(0xffffff,0.30);fillBot.position.set(0,5,H_m*1.5);scene.add(fillBot)

      // Court floor — parquet brillante
      const floor=new THREE.Mesh(
        new THREE.PlaneGeometry(W_m,H_m),
        new THREE.MeshStandardMaterial({map:makeCourtTex(courtType),roughness:0.15,metalness:0.04})
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
      let pIdx=0
      for(const el of e0){
        if(!PLAYER_TYPES.includes(el.type))continue
        const mesh=createPlayer(el.type==='offense',el.num??'?',pIdx++)
        const{x,z}=p3(el.x,el.y);mesh.position.set(x,0,z)
        scene.add(mesh);playerMeshes[el.id]=mesh
      }
      const ball=createBall(scene)
      const BALL_HOLD_H=0.95   // altura de cintura al portar el balón
      const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
      if(ic){const{x,z}=p3(ic.x,ic.y);ball.position.set(x,BALL_HOLD_H,z)}
      else{const{x,z}=p3(CW/2,H_px*0.4);ball.position.set(x,BALL_HOLD_H,z)}

      stateRef.current={renderer,scene,camera,playerMeshes,ball}
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
      // Forzar resize en el siguiente frame por si el layout no estaba listo
      requestAnimationFrame(resize)
    }catch(e){console.error('3D init:',e);setInitError(e.message||String(e))}
    return()=>{
      cancelAnimationFrame(animRef.current)
      ro?.disconnect()
      try{if(renderer){mount.removeChild(renderer.domElement);renderer.dispose()}}catch(_){}
      stateRef.current=null
    }
  },[phases,courtType]) // eslint-disable-line

  /* ── animation ─────────────────────────────────────────────── */
  function stopAnim(){
    cancelAnimationFrame(animRef.current);setPlaying(false)
    const s=stateRef.current;if(!s)return
    const e0=phases[0]?.elements||[]
    for(const el of e0){
      if(!PLAYER_TYPES.includes(el.type))continue
      const m=s.playerMeshes[el.id];if(!m)continue
      const{x,z}=p3(el.x,el.y);m.position.set(x,0,z);m.rotation.set(0,0,0)
      if(m.userData.leftArm){m.userData.leftArm.rotation.x=0;m.userData.rightArm.rotation.x=0}
    }
    const ic=e0.find(e=>PLAYER_TYPES.includes(e.type)&&e.hasBall)
    if(ic){const{x,z}=p3(ic.x,ic.y);s.ball.position.set(x,0.95,z)}
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

      // ══ ANIMACIÓN DE JUGADORES ════════════════════════════════
      // Detectar acciones del paso actual para cada jugador
      const passingId  =elems.find(e=>e.type==='pass'  &&(e.step??0)===si)?.fromId||null
      const shootingId =elems.find(e=>e.type==='shot'  &&(e.step??0)===si)?.fromId||null
      const handoffIds =elems.find(e=>e.type==='handoff'&&(e.step??0)===si)?.fromId||null
      const screenIds  =elems.filter(e=>e.type==='screen'&&(e.step??0)===si).map(e=>e.fromId||'')

      // Función que resetea todos los joints a posición neutral
      function resetJoints(ud){
        if(!ud)return
        ;['leftHipG','rightHipG','leftKneeG','rightKneeG'].forEach(k=>{if(ud[k]){ud[k].rotation.x=0;ud[k].rotation.z=0}})
        ;['leftShG','rightShG','leftElG','rightElG'].forEach(k=>{if(ud[k]){ud[k].rotation.x=0;ud[k].rotation.z=0}})
        if(ud.torsoG){ud.torsoG.rotation.x=0;ud.torsoG.rotation.z=0}
      }

      for(const e of elems){
        if(!PLAYER_TYPES.includes(e.type))continue
        const m=playerMeshes[e.id];if(!m)continue
        const b=bp[e.id];if(!b)continue
        const target=tg[e.id]||b
        const bp2=p3(b.x,b.y),tp2=p3(target.x,target.y)
        m.position.x=lerp(bp2.x,tp2.x,et);m.position.z=lerp(bp2.z,tp2.z,et)
        const dx=tp2.x-bp2.x,dz=tp2.z-bp2.z,dist=Math.hypot(dx,dz)
        const ud=m.userData
        const isMoving=!!tg[e.id]&&dist>0.04

        // ── CARA HACIA DIRECCIÓN ──
        if(dist>0.02)m.rotation.y=Math.atan2(dx,dz)

        // ── CARRERA ARTICULADA ────────────────────────────────
        if(isMoving&&st>0){
          const speed=Math.min(1,dist*2.2)
          // ciclo de marcha: 4.5 ciclos en STEP_MOVE_DUR para velocidad realista
          const cycle=et*Math.PI*9.0*speed
          // Bob vertical (rebote al correr)
          m.position.y=Math.abs(Math.sin(cycle*0.5))*0.08*speed
          // Inclinación del torso hacia delante
          if(ud.torsoG)ud.torsoG.rotation.x=-0.18*speed*Math.sin(et*Math.PI)

          // PIERNAS — cadera y rodilla alternadas
          if(ud.leftHipG)  ud.leftHipG.rotation.x  = Math.sin(cycle)*0.65*speed
          if(ud.rightHipG) ud.rightHipG.rotation.x  =-Math.sin(cycle)*0.65*speed
          // Rodilla se dobla en la fase de retroceso
          if(ud.leftKneeG)  ud.leftKneeG.rotation.x  = Math.max(0,-Math.sin(cycle))*0.80*speed
          if(ud.rightKneeG) ud.rightKneeG.rotation.x  = Math.max(0, Math.sin(cycle))*0.80*speed
          // Separación lateral de piernas al correr
          if(ud.leftHipG)  ud.leftHipG.rotation.z  = 0.04*speed
          if(ud.rightHipG) ud.rightHipG.rotation.z  =-0.04*speed

          // BRAZOS — patrón cruzado (brazo izq ↔ pierna der)
          if(ud.leftShG)  ud.leftShG.rotation.x  =-Math.sin(cycle)*0.50*speed
          if(ud.rightShG) ud.rightShG.rotation.x  = Math.sin(cycle)*0.50*speed
          // Codo doblado en el swing
          if(ud.leftElG)  ud.leftElG.rotation.x  = 0.55+Math.cos(cycle)*0.25*speed
          if(ud.rightElG) ud.rightElG.rotation.x  = 0.55-Math.cos(cycle)*0.25*speed

        // ── GESTO: PASE ──────────────────────────────────────
        } else if(e.id===passingId&&st>0){
          resetJoints(ud)
          // Wind-up → lanzamiento
          const t2=et<0.4?et/0.4:1-(et-0.4)/0.6
          if(ud.rightShG){ud.rightShG.rotation.x=-0.6+t2*1.2;ud.rightShG.rotation.z=0.2-t2*0.35}
          if(ud.rightElG) ud.rightElG.rotation.x=0.3+t2*0.3
          if(ud.leftShG)  {ud.leftShG.rotation.x=-0.2;ud.leftShG.rotation.z=0.25}
          if(ud.leftElG)  ud.leftElG.rotation.x=0.5
          if(ud.torsoG)   ud.torsoG.rotation.x=-0.12*et
          m.position.y=0

        // ── GESTO: TIRO ──────────────────────────────────────
        } else if(e.id===shootingId&&st>0){
          resetJoints(ud)
          // Brazos suben → extensión en el tiro
          const rise=Math.min(1,et*1.5)
          if(ud.rightShG){ud.rightShG.rotation.x=-rise*1.1;ud.rightShG.rotation.z=-0.15}
          if(ud.rightElG) ud.rightElG.rotation.x=Math.max(0,0.7-rise*0.9)
          if(ud.leftShG)  {ud.leftShG.rotation.x=-rise*0.9;ud.leftShG.rotation.z=0.15}
          if(ud.leftElG)  ud.leftElG.rotation.x=Math.max(0,0.6-rise*0.8)
          // Ligera inclinación atrás al cargar, adelante al soltar
          if(ud.torsoG)   ud.torsoG.rotation.x=et<0.5?0.08:-0.05
          m.position.y=rise*0.10

        // ── GESTO: HANDOFF ───────────────────────────────────
        } else if(e.id===handoffIds&&st>0){
          resetJoints(ud)
          // Brazo extendido con el balón hacia el compañero
          if(ud.rightShG){ud.rightShG.rotation.x=-0.4;ud.rightShG.rotation.z=-0.2}
          if(ud.rightElG) ud.rightElG.rotation.x=0.3
          if(ud.leftShG)  {ud.leftShG.rotation.x=-0.1;ud.leftShG.rotation.z=0.20}
          if(ud.torsoG)   ud.torsoG.rotation.x=-0.08
          m.position.y=0

        // ── GESTO: BLOQUEO (SCREEN) ──────────────────────────
        } else if(screenIds.includes(e.id)){
          resetJoints(ud)
          // Posición de bloqueo: pies separados, brazos cruzados en pecho
          if(ud.leftHipG)  {ud.leftHipG.rotation.z=0.12}
          if(ud.rightHipG) {ud.rightHipG.rotation.z=-0.12}
          if(ud.leftShG)   {ud.leftShG.rotation.x=-0.15;ud.leftShG.rotation.z=0.55}
          if(ud.rightShG)  {ud.rightShG.rotation.x=-0.15;ud.rightShG.rotation.z=-0.55}
          if(ud.leftElG)   ud.leftElG.rotation.x=1.0
          if(ud.rightElG)  ud.rightElG.rotation.x=1.0
          m.position.y=0

        // ── POSTURA: PORTADOR DEL BALÓN (estático) ───────────
        } else if(e.id===bc&&!isMoving){
          resetJoints(ud)
          // Botea: brazo derecho bajo, ligeramente extendido
          if(ud.rightShG){ud.rightShG.rotation.x=0.10;ud.rightShG.rotation.z=-0.22}
          if(ud.rightElG) ud.rightElG.rotation.x=0.55
          if(ud.leftShG)  {ud.leftShG.rotation.x=-0.08;ud.leftShG.rotation.z=0.30}
          if(ud.leftElG)  ud.leftElG.rotation.x=0.40
          // Flexión ligera de rodillas (postura de baloncesto)
          if(ud.leftHipG)  ud.leftHipG.rotation.x=0.12
          if(ud.rightHipG) ud.rightHipG.rotation.x=0.12
          if(ud.leftKneeG)  ud.leftKneeG.rotation.x=0.18
          if(ud.rightKneeG) ud.rightKneeG.rotation.x=0.18
          m.position.y=0

        // ── POSTURA: DEFENSA (estático) ──────────────────────
        } else if(['defense','xdefense'].includes(e.type)&&!isMoving){
          resetJoints(ud)
          // Postura defensiva: rodillas flexionadas, brazos abiertos
          if(ud.leftHipG)  ud.leftHipG.rotation.x=0.20
          if(ud.rightHipG) ud.rightHipG.rotation.x=0.20
          if(ud.leftKneeG)  ud.leftKneeG.rotation.x=0.30
          if(ud.rightKneeG) ud.rightKneeG.rotation.x=0.30
          if(ud.leftShG)   {ud.leftShG.rotation.x=-0.05;ud.leftShG.rotation.z=0.55}
          if(ud.rightShG)  {ud.rightShG.rotation.x=-0.05;ud.rightShG.rotation.z=-0.55}
          if(ud.leftElG)   ud.leftElG.rotation.x=0.45
          if(ud.rightElG)  ud.rightElG.rotation.x=0.45
          m.position.y=0

        } else {
          // Idle genérico
          resetJoints(ud)
          m.position.y=0
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
