'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

/* ─── Constants ─────────────────────────────────────────── */
const TOOLS = [
  { id: 'select',   label: 'Seleccionar', emoji: '↖️' },
  { id: 'offense',  label: 'Ataque',      emoji: '🔵' },
  { id: 'defense',  label: 'Defensa',     emoji: '🔴' },
  { id: 'ball',     label: 'Balón',       emoji: '🏀' },
  { id: 'run',      label: 'Carrera',     emoji: '→' },
  { id: 'pass',     label: 'Pase',        emoji: '⇢' },
  { id: 'cut',      label: 'Corte',       emoji: '↗' },
  { id: 'cone',     label: 'Cono',        emoji: '🔶' },
  { id: 'screen',   label: 'Bloqueo',     emoji: '⬜' },
  { id: 'text',     label: 'Texto',       emoji: '✏️' },
  { id: 'erase',    label: 'Borrar',      emoji: '🗑️' },
]

const COURT_W = 560
const COURT_H_HALF = 370
const COURT_H_FULL = 560
const PLAYER_R = 18
const OFFENSE_NUM_COLOR = '#fff'
const OFFENSE_FILL = '#2563eb'
const DEFENSE_FILL = '#dc2626'
const BALL_COLOR = '#f97316'

/* ─── Arrow math helpers ─────────────────────────────────── */
function arrowHead(ctx, x1, y1, x2, y2, size = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 7), y2 - size * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 7), y2 - size * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
}

/* ─── Draw court ─────────────────────────────────────────── */
function drawCourt(ctx, type) {
  const W = COURT_W
  const H = type === 'full' ? COURT_H_FULL : COURT_H_HALF

  // Background (hardwood)
  ctx.fillStyle = '#c8a96e'
  ctx.fillRect(0, 0, W, H)

  // Lines
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2

  if (type === 'full') {
    // Full court outline
    ctx.strokeRect(4, 4, W - 8, H - 8)

    // Mid-court line
    ctx.beginPath(); ctx.moveTo(4, H / 2); ctx.lineTo(W - 4, H / 2); ctx.stroke()

    // Centre circle
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 45, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()

    drawHalfCourtLines(ctx, W, H, false) // top
    drawHalfCourtLines(ctx, W, H, true)  // bottom (flipped)
  } else {
    // Half court
    ctx.strokeRect(4, 4, W - 8, H - 8)
    // Half-court arc at top (open)
    ctx.beginPath(); ctx.arc(W / 2, 4, 50, 0, Math.PI); ctx.stroke()
    drawHalfCourtLines(ctx, W, H, false)
  }
}

function drawHalfCourtLines(ctx, W, H, flip) {
  const sy = flip ? H : 0
  const dir = flip ? -1 : 1
  const abs = (y) => sy + dir * y

  // Paint / key (16ft wide, 19ft long proportional)
  const paintW = 140, paintH = 170, paintX = (W - paintW) / 2
  ctx.strokeRect(paintX, abs(4), paintW, dir * paintH)

  // Backboard
  ctx.beginPath()
  ctx.moveTo(paintX + 10, abs(4))
  ctx.lineTo(paintX + paintW - 10, abs(4))
  ctx.stroke()

  // Rim
  ctx.beginPath()
  ctx.arc(W / 2, abs(30), 17, 0, Math.PI * 2)
  ctx.stroke()

  // Free-throw line (top of paint)
  ctx.beginPath()
  ctx.moveTo(paintX, abs(paintH + 4))
  ctx.lineTo(paintX + paintW, abs(paintH + 4))
  ctx.stroke()

  // Free-throw circle (top half)
  ctx.beginPath()
  ctx.arc(W / 2, abs(paintH + 4), 70, flip ? 0 : Math.PI, flip ? Math.PI : 0)
  ctx.stroke()
  // Bottom dashed half
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.arc(W / 2, abs(paintH + 4), 70, flip ? Math.PI : 0, flip ? 0 : Math.PI)
  ctx.stroke()
  ctx.setLineDash([])

  // Three-point arc
  const arcY = abs(paintH + 4)
  const arcR = 195
  const arcCY = abs(30)
  // Corner 3s (straights)
  const cornerX1 = paintX - 25, cornerX2 = paintX + paintW + 25
  const arcStart = Math.asin((cornerX1 - W / 2) / arcR)
  ctx.beginPath()
  ctx.moveTo(cornerX1, abs(4))
  ctx.lineTo(cornerX1, arcCY + dir * Math.sqrt(arcR * arcR - (cornerX1 - W / 2) ** 2) * (flip ? 1 : -1))
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cornerX2, abs(4))
  ctx.lineTo(cornerX2, arcCY + dir * Math.sqrt(arcR * arcR - (cornerX2 - W / 2) ** 2) * (flip ? 1 : -1))
  ctx.stroke()
  // Arc
  ctx.beginPath()
  const a1 = Math.PI - Math.asin((W / 2 - cornerX1) / arcR)
  const a2 = Math.asin((W / 2 - cornerX1) / arcR)
  if (flip) {
    ctx.arc(W / 2, arcCY, arcR, a2, Math.PI - a2)
  } else {
    ctx.arc(W / 2, arcCY, arcR, Math.PI + a2, -a2)
  }
  ctx.stroke()

  // Restricted area
  ctx.beginPath()
  ctx.arc(W / 2, abs(30), 40, flip ? 0 : Math.PI, flip ? Math.PI : 0)
  ctx.stroke()
}

/* ─── Draw elements ──────────────────────────────────────── */
function drawElement(ctx, el, selected) {
  ctx.save()
  if (selected) {
    ctx.shadowColor = '#facc15'
    ctx.shadowBlur = 12
  }

  if (el.type === 'offense') {
    ctx.fillStyle = OFFENSE_FILL
    ctx.beginPath()
    ctx.arc(el.x, el.y, PLAYER_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = OFFENSE_NUM_COLOR
    ctx.font = `bold 14px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.number || '?', el.x, el.y)
  }

  if (el.type === 'defense') {
    ctx.strokeStyle = DEFENSE_FILL
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(el.x, el.y, PLAYER_R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = `bold 16px sans-serif`
    ctx.fillStyle = DEFENSE_FILL
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('X', el.x, el.y)
  }

  if (el.type === 'ball') {
    ctx.fillStyle = BALL_COLOR
    ctx.beginPath()
    ctx.arc(el.x, el.y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    // lines on ball
    ctx.beginPath()
    ctx.moveTo(el.x - 11, el.y)
    ctx.lineTo(el.x + 11, el.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(el.x, el.y, 11, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (el.type === 'cone') {
    ctx.fillStyle = '#f97316'
    ctx.beginPath()
    ctx.moveTo(el.x, el.y - 14)
    ctx.lineTo(el.x - 10, el.y + 10)
    ctx.lineTo(el.x + 10, el.y + 10)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(el.x - 12, el.y + 10, 24, 4)
  }

  if (el.type === 'screen') {
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 3
    ctx.strokeRect(el.x - 12, el.y - 18, 24, 36)
  }

  if (el.type === 'text') {
    ctx.font = `bold 14px sans-serif`
    ctx.fillStyle = '#1f2937'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.content || 'Texto', el.x, el.y)
  }

  if (el.type === 'run') {
    ctx.strokeStyle = '#ca8a04'
    ctx.fillStyle = '#ca8a04'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.stroke()
    arrowHead(ctx, el.x1, el.y1, el.x2, el.y2)
  }

  if (el.type === 'pass') {
    ctx.strokeStyle = '#7c3aed'
    ctx.fillStyle = '#7c3aed'
    ctx.lineWidth = 2.5
    ctx.setLineDash([10, 6])
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.stroke()
    ctx.setLineDash([])
    arrowHead(ctx, el.x1, el.y1, el.x2, el.y2)
  }

  if (el.type === 'cut') {
    ctx.strokeStyle = '#16a34a'
    ctx.fillStyle = '#16a34a'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.stroke()
    arrowHead(ctx, el.x1, el.y1, el.x2, el.y2, 12)
  }

  ctx.restore()
}

/* ─── Main component ─────────────────────────────────────── */
export default function CourtEditor({ initialData, courtType: initCourtType = 'half', onSave, onClose }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const courtType = initCourtType
  const COURT_H = courtType === 'full' ? COURT_H_FULL : COURT_H_HALF

  const emptyStep = () => ({ elements: [] })

  const [steps, setSteps] = useState(() => {
    if (initialData?.steps?.length) return initialData.steps
    return [emptyStep()]
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [tool, setTool] = useState('select')
  const [selectedId, setSelectedId] = useState(null)
  const [offenseCount, setOffenseCount] = useState(1)
  const [dragging, setDragging] = useState(null)
  const [arrowStart, setArrowStart] = useState(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [textPrompt, setTextPrompt] = useState(null)
  const [description, setDescription] = useState(initialData?.description || '')
  const [title, setTitle] = useState(initialData?.title || '')

  /* ─── Render ─────────────────────────────────────────── */
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, COURT_W, COURT_H)
    drawCourt(ctx, courtType)
    const els = steps[currentStep]?.elements || []
    els.forEach(el => drawElement(ctx, el, el.id === selectedId))

    // Arrow preview while drawing
    if (arrowStart) {
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = tool === 'run' ? '#ca8a04' : tool === 'pass' ? '#7c3aed' : '#16a34a'
      ctx.lineWidth = 2
      if (tool === 'pass') ctx.setLineDash([8, 5])
      ctx.beginPath()
      ctx.moveTo(arrowStart.x, arrowStart.y)
      ctx.lineTo(arrowStart.cx || arrowStart.x, arrowStart.cy || arrowStart.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }, [steps, currentStep, selectedId, arrowStart, tool, courtType, COURT_H])

  useEffect(() => { render() }, [render])

  /* ─── Mouse helpers ──────────────────────────────────── */
  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const scaleX = COURT_W / r.width
    const scaleY = COURT_H / r.height
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    }
  }

  function hitTest(x, y) {
    const els = steps[currentStep]?.elements || []
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]
      if (el.type === 'run' || el.type === 'pass' || el.type === 'cut') continue
      const dx = x - el.x, dy = y - el.y
      if (Math.sqrt(dx * dx + dy * dy) < PLAYER_R + 4) return el
    }
    return null
  }

  function updateElement(id, patch) {
    setSteps(prev => {
      const next = prev.map((s, i) => {
        if (i !== currentStep) return s
        return { ...s, elements: s.elements.map(el => el.id === id ? { ...el, ...patch } : el) }
      })
      return next
    })
  }

  function addElement(el) {
    const id = Math.random().toString(36).slice(2)
    setSteps(prev => {
      const next = [...prev]
      next[currentStep] = { ...next[currentStep], elements: [...(next[currentStep]?.elements || []), { ...el, id }] }
      return next
    })
    return id
  }

  function removeSelected() {
    if (!selectedId) return
    setSteps(prev => prev.map((s, i) => i !== currentStep ? s : {
      ...s, elements: s.elements.filter(el => el.id !== selectedId)
    }))
    setSelectedId(null)
  }

  /* ─── Mouse events ───────────────────────────────────── */
  function onMouseDown(e) {
    const { x, y } = getPos(e)

    if (tool === 'select' || tool === 'erase') {
      const hit = hitTest(x, y)
      if (hit) {
        if (tool === 'erase') {
          setSteps(prev => prev.map((s, i) => i !== currentStep ? s : { ...s, elements: s.elements.filter(el => el.id !== hit.id) }))
          setSelectedId(null)
        } else {
          setSelectedId(hit.id)
          setDragging({ id: hit.id, ox: x - hit.x, oy: y - hit.y })
        }
      } else {
        setSelectedId(null)
      }
      return
    }

    if (tool === 'offense') {
      addElement({ type: 'offense', x, y, number: offenseCount })
      setOffenseCount(c => c < 5 ? c + 1 : 1)
      return
    }

    if (tool === 'defense') {
      addElement({ type: 'defense', x, y })
      return
    }

    if (tool === 'ball') {
      addElement({ type: 'ball', x, y })
      return
    }

    if (tool === 'cone') {
      addElement({ type: 'cone', x, y })
      return
    }

    if (tool === 'screen') {
      addElement({ type: 'screen', x, y })
      return
    }

    if (tool === 'text') {
      setTextPrompt({ x, y })
      return
    }

    if (tool === 'run' || tool === 'pass' || tool === 'cut') {
      setArrowStart({ x, y, cx: x, cy: y })
      return
    }
  }

  function onMouseMove(e) {
    const { x, y } = getPos(e)

    if (dragging) {
      updateElement(dragging.id, { x: x - dragging.ox, y: y - dragging.oy })
      return
    }

    if (arrowStart) {
      setArrowStart(prev => ({ ...prev, cx: x, cy: y }))
    }
  }

  function onMouseUp(e) {
    if (dragging) { setDragging(null); return }
    if (arrowStart) {
      const { x, y } = getPos(e)
      const dx = x - arrowStart.x, dy = y - arrowStart.y
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        addElement({ type: tool, x1: arrowStart.x, y1: arrowStart.y, x2: x, y2: y })
      }
      setArrowStart(null)
    }
  }

  // Touch support
  function toMouseEvt(te) {
    const t = te.touches[0] || te.changedTouches[0]
    return { clientX: t.clientX, clientY: t.clientY }
  }

  /* ─── Steps management ───────────────────────────────── */
  function addStep() {
    setSteps(prev => {
      const copy = JSON.parse(JSON.stringify(prev[currentStep]))
      const next = [...prev]
      next.splice(currentStep + 1, 0, copy)
      return next
    })
    setCurrentStep(c => c + 1)
  }

  function removeStep() {
    if (steps.length === 1) return
    setSteps(prev => prev.filter((_, i) => i !== currentStep))
    setCurrentStep(c => Math.max(0, c - 1))
  }

  function duplicateStep() {
    setSteps(prev => {
      const copy = JSON.parse(JSON.stringify(prev[currentStep]))
      return [...prev, copy]
    })
    setCurrentStep(steps.length)
  }

  /* ─── Animation ──────────────────────────────────────── */
  function animate() {
    if (isAnimating) {
      cancelAnimationFrame(animRef.current)
      setIsAnimating(false)
      return
    }
    setIsAnimating(true)
    let step = 0
    function tick() {
      setCurrentStep(step)
      step++
      if (step < steps.length) {
        animRef.current = setTimeout(tick, 1200)
      } else {
        setIsAnimating(false)
        setCurrentStep(0)
      }
    }
    tick()
  }

  /* ─── Video export ───────────────────────────────────── */
  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas) return

    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'jugada'}.webm`
      a.click()
      URL.revokeObjectURL(url)
      setIsRecording(false)
    }

    recorder.start()
    setIsRecording(true)

    // Record each step for 1.5s
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i)
      await new Promise(r => setTimeout(r, 1500))
    }
    recorder.stop()
  }

  /* ─── Save ───────────────────────────────────────────── */
  function handleSave() {
    if (onSave) onSave({ title, description, steps })
  }

  /* ─── Clear step ─────────────────────────────────────── */
  function clearStep() {
    setSteps(prev => prev.map((s, i) => i !== currentStep ? s : { ...s, elements: [] }))
    setSelectedId(null)
  }

  /* ─── Keyboard ───────────────────────────────────────── */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, currentStep])

  /* ─── Render ─────────────────────────────────────────── */
  const btnBase = {
    border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
    fontSize: 11, padding: '6px 8px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2, minWidth: 48, transition: 'all 0.15s',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      background: '#111827', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)', maxWidth: 680, width: '100%', margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#1f2937', borderBottom: '1px solid #374151' }}>
        <span style={{ fontSize: 18 }}>🏀</span>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nombre de la jugada..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontWeight: 700 }}
        />
        {onClose && (
          <button onClick={onClose} style={{ ...btnBase, background: '#374151', color: '#9ca3af', padding: '6px 12px', minWidth: 'auto' }}>✕</button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#1f2937', overflowX: 'auto', flexWrap: 'wrap' }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); setArrowStart(null) }}
            title={t.label}
            style={{
              ...btnBase,
              background: tool === t.id ? '#3b82f6' : '#374151',
              color: tool === t.id ? '#fff' : '#d1d5db',
            }}
          >
            <span style={{ fontSize: 16 }}>{t.emoji}</span>
            <span style={{ fontSize: 9 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', background: '#111827', display: 'flex', justifyContent: 'center', padding: '8px' }}>
        <canvas
          ref={canvasRef}
          width={COURT_W}
          height={COURT_H}
          style={{ width: '100%', maxWidth: COURT_W, borderRadius: 8, cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={e => { e.preventDefault(); onMouseDown(toMouseEvt(e)) }}
          onTouchMove={e => { e.preventDefault(); onMouseMove(toMouseEvt(e)) }}
          onTouchEnd={e => { e.preventDefault(); onMouseUp(toMouseEvt(e)) }}
        />

        {/* Step counter overlay */}
        <div style={{ position: 'absolute', top: 18, right: 20, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}>
          Paso {currentStep + 1}/{steps.length}
        </div>
      </div>

      {/* Steps bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#1f2937', overflowX: 'auto' }}>
        <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Pasos:</span>
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            style={{
              ...btnBase, minWidth: 36, padding: '4px 8px',
              background: i === currentStep ? '#3b82f6' : '#374151',
              color: i === currentStep ? '#fff' : '#9ca3af',
              fontSize: 13,
            }}
          >
            {i + 1}
          </button>
        ))}
        <button onClick={addStep} style={{ ...btnBase, background: '#374151', color: '#9ca3af', padding: '4px 8px', minWidth: 28, fontSize: 18 }} title="Añadir paso">+</button>
        {steps.length > 1 && <button onClick={removeStep} style={{ ...btnBase, background: '#374151', color: '#ef4444', padding: '4px 8px', minWidth: 28, fontSize: 14 }} title="Eliminar paso">—</button>}
        <div style={{ flex: 1 }} />
        <button onClick={clearStep} style={{ ...btnBase, background: '#374151', color: '#9ca3af', fontSize: 11, padding: '4px 8px', minWidth: 'auto' }}>🧹 Limpiar</button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#1f2937', flexWrap: 'wrap' }}>
        <button
          onClick={animate}
          disabled={isRecording}
          style={{ ...btnBase, background: isAnimating ? '#f59e0b' : '#374151', color: '#fff', flexDirection: 'row', padding: '8px 14px', minWidth: 'auto', fontSize: 12 }}
        >
          {isAnimating ? '⏹ Parar' : '▶️ Animar'}
        </button>
        <button
          onClick={exportVideo}
          disabled={isAnimating || isRecording}
          style={{ ...btnBase, background: isRecording ? '#ef4444' : '#374151', color: '#fff', flexDirection: 'row', padding: '8px 14px', minWidth: 'auto', fontSize: 12 }}
        >
          {isRecording ? '⏺ Grabando...' : '🎬 Exportar vídeo'}
        </button>
        <div style={{ flex: 1 }} />
        {selectedId && (
          <button onClick={removeSelected} style={{ ...btnBase, background: '#7f1d1d', color: '#fca5a5', flexDirection: 'row', padding: '8px 12px', minWidth: 'auto', fontSize: 12 }}>
            🗑 Eliminar
          </button>
        )}
        <button onClick={handleSave} style={{ ...btnBase, background: '#16a34a', color: '#fff', flexDirection: 'row', padding: '8px 18px', minWidth: 'auto', fontSize: 12 }}>
          💾 Guardar
        </button>
      </div>

      {/* Description */}
      <div style={{ padding: '10px 12px', background: '#1f2937', borderTop: '1px solid #374151' }}>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descripción de la jugada (objetivos, instrucciones, variantes...)"
          rows={3}
          style={{
            width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 8,
            color: '#e5e7eb', fontSize: 13, padding: '8px 10px', resize: 'vertical',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Text prompt modal */}
      {textPrompt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#1f2937', borderRadius: 14, padding: 24, width: 300 }}>
            <p style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Añadir texto</p>
            <input
              autoFocus
              id="txt-input"
              placeholder="Escribe el texto..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = e.target.value.trim()
                  if (val) addElement({ type: 'text', x: textPrompt.x, y: textPrompt.y, content: val })
                  setTextPrompt(null)
                }
                if (e.key === 'Escape') setTextPrompt(null)
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setTextPrompt(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#374151', color: '#9ca3af', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button
                onClick={() => {
                  const val = document.getElementById('txt-input').value.trim()
                  if (val) addElement({ type: 'text', x: textPrompt.x, y: textPrompt.y, content: val })
                  setTextPrompt(null)
                }}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
