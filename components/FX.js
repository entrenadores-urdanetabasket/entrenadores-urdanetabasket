'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Efectos globales del panel (solo decorativos, no tocan datos):
//  · foco de luz que sigue al cursor sobre tarjetas
//  · inclinación 3D de tarjetas con el ratón
//  · barra de progreso naranja al cambiar de pantalla
//  · polvo flotante de fondo
export default function FX() {
  const pathname = usePathname()
  const [navKey, setNavKey] = useState(0)
  const dust = useRef(null)
  const first = useRef(true)

  // Barra de progreso en cada cambio de ruta
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setNavKey(k => k + 1)
  }, [pathname])

  // Foco + inclinación
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    let tiltEl = null

    const onMove = e => {
      const t = e.target
      if (!(t instanceof Element)) return
      const card = t.closest('.panel, .module-card, .hero, .tilt')
      if (card) {
        const r = card.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top
        card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px')
        const tiltable = !reduce && fine && (card.classList.contains('tilt') || card.classList.contains('module-card'))
        if (tiltable) {
          const px = x / r.width - 0.5, py = y / r.height - 0.5
          card.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg'); card.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg')
          tiltEl = card
        }
      }
      if (tiltEl && tiltEl !== card) { tiltEl.style.setProperty('--rx', '0deg'); tiltEl.style.setProperty('--ry', '0deg'); tiltEl = null }
    }
    const onLeave = () => { if (tiltEl) { tiltEl.style.setProperty('--rx', '0deg'); tiltEl.style.setProperty('--ry', '0deg'); tiltEl = null } }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)


    return () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Polvo flotante de fondo
  useEffect(() => {
    const canvas = dust.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0
    const resize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    resize(); window.addEventListener('resize', resize)
    const ps = Array.from({ length: 38 }, () => ({
      x: Math.random() * 1600, y: Math.random() * 1000, r: Math.random() * 2 + 0.6, v: Math.random() * 0.25 + 0.06,
      dx: (Math.random() - 0.5) * 0.15, c: Math.random() < 0.3 ? '255,122,26' : '82,176,67', a: Math.random() * 0.22 + 0.08,
    }))
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        p.y -= p.v; p.x += p.dx
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w }
        if (p.x < -6) p.x = w + 6; if (p.x > w + 6) p.x = -6
        ctx.beginPath(); ctx.fillStyle = `rgba(${p.c},${p.a})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <>
      <canvas ref={dust} className="fx-dust keep-color" aria-hidden="true" />
      {navKey > 0 && <div key={navKey} className="fx-progress keep-color" aria-hidden="true" />}
    </>
  )
}
