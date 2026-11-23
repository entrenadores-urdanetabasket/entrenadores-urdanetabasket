// Confeti de celebración (autónomo: crea su propio canvas y se elimina solo)
export function fireConfetti({ count = 140, duration = 2600 } = {}) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:10000'
  document.body.appendChild(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth, h = window.innerHeight
  canvas.width = w * dpr; canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const colors = ['#ff7a1a', '#ffb066', '#52B043', '#7bd96a', '#ffffff', '#1C5C2A']
  const ps = Array.from({ length: count }, () => {
    const fromLeft = Math.random() < 0.5
    const ang = (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.7
    const sp = 9 + Math.random() * 9
    return {
      x: fromLeft ? w * 0.08 : w * 0.92, y: h * 0.78,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      s: 5 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.3,
    }
  })
  const t0 = performance.now()
  const tick = now => {
    const t = now - t0
    ctx.clearRect(0, 0, w, h)
    const fade = t > duration - 600 ? Math.max(0, (duration - t) / 600) : 1
    for (const p of ps) {
      p.vy += 0.3; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill() } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2)
      ctx.restore()
    }
    if (t < duration) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
