'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icons'

// Anillo de progreso (0-100)
export function Ring({ value = 0, size = 64, stroke = 7, color = '#7bd96a', track = 'rgba(255,255,255,0.16)', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ '--ring-full': c, animation: 'ringDraw 1.2s cubic-bezier(.2,.7,.2,1) both', transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

// Línea de tendencia con área suave
export function Spark({ values = [], width = 220, height = 56, color = '#52B043', zero = false }) {
  if (values.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: 12 }}>Sin datos suficientes todavía</div>
  const min = Math.min(...values, zero ? 0 : Infinity), max = Math.max(...values, zero ? 0 : -Infinity)
  const span = max - min || 1
  const pad = 4
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / (values.length - 1), pad + (1 - (v - min) / span) * (height - pad * 2)])
  const line = pts.map(p => p.join(',')).join(' ')
  const area = `${pad},${height} ${line} ${width - pad},${height}`
  const gid = 'sp' + color.replace('#', '') + values.length
  const zeroY = zero ? pad + (1 - (0 - min) / span) * (height - pad * 2) : null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {zeroY != null && <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
    </svg>
  )
}

// Barras verticales con etiqueta (porcentajes)
export function Bars({ data = [], height = 120, color = '#52B043' }) {
  if (!data.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d, i) => {
        const v = d.value
        const h = v == null ? 4 : Math.max(6, (v / 100) * (height - 22))
        const good = v != null && v >= 80
        const mid = v != null && v >= 60 && v < 80
        const c = v == null ? '#e2e8f0' : good ? color : mid ? '#f59e0b' : '#ef4444'
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }} className="num">{v == null ? '—' : `${v}%`}</div>
            <div style={{ width: '100%', maxWidth: 34, height: h, borderRadius: '8px 8px 4px 4px', background: v == null ? c : `linear-gradient(180deg, ${c}, ${c}bb)`, transition: 'height 0.6s ease', transformOrigin: 'bottom', animation: 'growY .8s cubic-bezier(.2,.7,.2,1) both', animationDelay: `${i * 70}ms` }} />
            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// Racha de resultados V / E / D
export function FormDots({ results = [] }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {results.map((r, i) => {
        const bg = r.res === 'W' ? '#16a34a' : r.res === 'L' ? '#dc2626' : '#94a3b8'
        return (
          <div key={i} title={r.title} style={{ width: 30, height: 30, borderRadius: 10, background: bg, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px ${bg}40` }}>
            {r.res === 'W' ? 'V' : r.res === 'L' ? 'D' : 'E'}
          </div>
        )
      })}
    </div>
  )
}

// Cabecera de tarjeta: icono + título + enlace
export function CardHead({ icon, title, href, linkLabel = 'Ver todo', color = '#1C5C2A' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color, background: `${color}14`, border: `1px solid ${color}22` }}>
        <Icon name={icon} size={16} />
      </div>
      <div className="panel-title" style={{ flex: 1, color: '#0f172a' }}>{title}</div>
      {href && (
        <Link href={href} style={{ fontSize: 12, fontWeight: 700, color: '#52B043', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {linkLabel} <Icon name="arrow" size={13} />
        </Link>
      )}
    </div>
  )
}

// Tarjeta de resumen en cristal para cabeceras oscuras
export function GlassStat({ label, value, sub, children }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 130, padding: '14px 16px', borderRadius: 16,
      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="num" style={{ color: '#fff', fontFamily: 'var(--font-scoreboard)', fontSize: 40, fontWeight: 700, lineHeight: 0.95, letterSpacing: 0.5 }}><CountUp value={value} /></div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: 700, marginTop: 7, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
        {sub && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function EmptyNote({ children }) {
  return <div style={{ padding: '22px 8px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{children}</div>
}

// Gráfico de radar: `axes` = [{ label, a, b }] con valores 0-100.
// a = serie principal (jugador), b = serie de referencia opcional (media del equipo)
export function Radar({ axes = [], size = 260, colorA = '#16a34a', colorB = '#94a3b8' }) {
  const n = axes.length
  if (n < 3) return null
  const c = size / 2, r = size / 2 - 34
  const pt = (i, v) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r
    return [c + Math.cos(ang) * rr, c + Math.sin(ang) * rr]
  }
  const poly = key => axes.map((ax, i) => pt(i, ax[key] ?? 0).join(',')).join(' ')
  const hasB = axes.some(ax => ax.b != null)
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
      {[25, 50, 75, 100].map(l => (
        <polygon key={l} points={axes.map((_, i) => pt(i, l).join(',')).join(' ')} fill={l === 100 ? 'rgba(148,163,184,0.06)' : 'none'} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" /> })}
      {hasB && <polygon points={poly('b')} fill={`${colorB}33`} stroke={colorB} strokeWidth="1.5" strokeDasharray="4 3" />}
      <polygon points={poly('a')} fill={`${colorA}40`} stroke={colorA} strokeWidth="2.2" strokeLinejoin="round" />
      {axes.map((ax, i) => { const [x, y] = pt(i, ax.a ?? 0); return <circle key={i} cx={x} cy={y} r="3.2" fill={colorA} stroke="#fff" strokeWidth="1.2" /> })}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 100)
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
        const lx = x + Math.cos(ang) * 16, ly = y + Math.sin(ang) * 14
        return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: '#64748b' }}>{ax.label}</text>
      })}
    </svg>
  )
}

// Cuenta animada de 0 hasta el valor (solo para números enteros, con % opcional)
export function CountUp({ value, duration = 1000 }) {
  const m = /^(\d+)(%?)$/.exec(String(value))
  const target = m ? parseInt(m[1], 10) : null
  const [n, setN] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (target == null) return
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  if (target == null) return <>{value}</>
  return <>{n}{m[2]}</>
}
