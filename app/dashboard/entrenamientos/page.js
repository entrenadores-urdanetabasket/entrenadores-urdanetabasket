'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ModalPortal from '@/components/ModalPortal'
import dynamic from 'next/dynamic'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

const CATEGORIES = {
  calentamiento: { label: 'Calentamiento', emoji: '🔥', color: '#f97316' },
  tecnica:       { label: 'Técnica',       emoji: '🧠', color: '#2563eb' },
  tactica:       { label: 'Táctica',       emoji: '🏀', color: '#7c3aed' },
  fisico:        { label: 'Físico',        emoji: '💪', color: '#dc2626' },
  tiro:          { label: 'Tiro',          emoji: '🏹', color: '#16a34a' },
}

function CategoryBadge({ category }) {
  const c = CATEGORIES[category]
  if (!c) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: c.color, backgroundColor: c.color + '1a', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {c.emoji} {c.label}
    </span>
  )
}

const INTENSITIES = {
  baja:  { label: 'Baja',  color: '#16a34a' },
  media: { label: 'Media', color: '#f59e0b' },
  alta:  { label: 'Alta',  color: '#dc2626' },
}

function IntensityBadge({ intensity }) {
  const i = INTENSITIES[intensity]
  if (!i) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: i.color, backgroundColor: i.color + '1a', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      ⚡ {i.label}
    </span>
  )
}

// Bloque de texto con etiqueta, usado para objetivo/desarrollo/puntos clave/variantes
function DetailBlock({ label, text }) {
  if (!text) return null
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <p style={{ fontSize: 13, color: '#374151', margin: '2px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  )
}

const emptyExForm = {
  title: '', duration_minutes: 10, description: '', category: '',
  intensity: '', organization: '', materials: '', objective: '', key_points: '', variants: '',
}

// Campos de texto de un ejercicio que se copian tal cual entre sesión / biblioteca / plantilla
const EX_TEXT_FIELDS = ['title', 'description', 'category', 'intensity', 'organization', 'materials', 'objective', 'key_points', 'variants']

// Del formulario a la BD: las cadenas vacías (campos que el entrenador no rellenó) se guardan como null
function pickExFields(form) {
  const out = { duration_minutes: form.duration_minutes }
  for (const k of EX_TEXT_FIELDS) out[k] = form[k] || null
  return out
}

// De una fila de la BD al formulario: null se muestra como cadena vacía
function exToForm(row) {
  const out = { duration_minutes: row.duration_minutes || 10 }
  for (const k of EX_TEXT_FIELDS) out[k] = row[k] || ''
  return out
}

const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7 }
const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

// Campos del formulario de ejercicio, compartidos entre "Añadir/editar ejercicio"
// (dentro de una sesión) y "Nuevo ejercicio de biblioteca" — todos opcionales
// salvo el nombre, cada entrenador rellena lo que le sirve para explicarlo.
function ExerciseFormFields({ form, setForm }) {
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  return (
    <>
      <div>
        <label style={labelStyle}>Nombre del ejercicio *</label>
        <input type='text' value={form.title} onChange={set('title')}
          placeholder='Ej: Tiro libre, Defensa 1x1...' required style={inputStyle}
          onFocus={inputFocus} onBlur={inputBlur} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Duración (minutos)</label>
          <input type='number' value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
            min={1} max={120} style={inputStyle}
            onFocus={inputFocus} onBlur={inputBlur} />
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select value={form.category} onChange={set('category')} style={inputStyle}>
            <option value=''>Sin categoría</option>
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <option key={key} value={key}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Intensidad</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(INTENSITIES).map(([key, i]) => (
            <button key={key} type='button' onClick={() => setForm(f => ({ ...f, intensity: f.intensity === key ? '' : key }))} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
              border: `1.5px solid ${form.intensity === key ? i.color : '#e2e8f0'}`,
              background: form.intensity === key ? i.color + '1a' : '#fff',
              color: form.intensity === key ? i.color : '#64748b',
            }}>{i.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Organización</label>
          <input type='text' value={form.organization} onChange={set('organization')}
            placeholder='Ej: Grupos de 3' style={inputStyle}
            onFocus={inputFocus} onBlur={inputBlur} />
        </div>
        <div>
          <label style={labelStyle}>Material necesario</label>
          <input type='text' value={form.materials} onChange={set('materials')}
            placeholder='Ej: 4 conos, 2 balones' style={inputStyle}
            onFocus={inputFocus} onBlur={inputBlur} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>🎯 Objetivo</label>
        <textarea value={form.objective} onChange={set('objective')}
          placeholder='¿Qué se busca trabajar con este ejercicio?' rows={2}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          onFocus={inputFocus} onBlur={inputBlur} />
      </div>
      <div>
        <label style={labelStyle}>📋 Desarrollo / Cómo se hace</label>
        <textarea value={form.description} onChange={set('description')}
          placeholder='Explica cómo se realiza el ejercicio...' rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          onFocus={inputFocus} onBlur={inputBlur} />
      </div>
      <div>
        <label style={labelStyle}>💡 Puntos clave</label>
        <textarea value={form.key_points} onChange={set('key_points')}
          placeholder='¿Qué corregir o vigilar mientras se hace?' rows={2}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          onFocus={inputFocus} onBlur={inputBlur} />
      </div>
      <div>
        <label style={labelStyle}>🔄 Variantes</label>
        <textarea value={form.variants} onChange={set('variants')}
          placeholder='Formas de complicar o simplificar el ejercicio...' rows={2}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          onFocus={inputFocus} onBlur={inputBlur} />
      </div>
    </>
  )
}

export default function EntrenamientosPage() {
  const { user, profile, supabase, myTeams, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [sessions, setSessions] = useState([])
  const [tab, setTab] = useState('proximos')
  const [loading, setLoading] = useState(true)

  // Modal sesión
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], start_time: '18:00', duration_minutes: 90, objectives: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Vista detalle sesión
  const [detailSession, setDetailSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [showExForm, setShowExForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [exForm, setExForm] = useState(emptyExForm)
  const [savingEx, setSavingEx] = useState(false)

  // CourtEditor para ejercicio
  const [editorExercise, setEditorExercise] = useState(null)

  // Entrenamientos compartidos
  const [sharedSessions, setSharedSessions] = useState([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharingId, setSharingId] = useState(null) // sesión que se está compartiendo/descompartiendo

  // Duplicar entrenamiento compartido
  const [duplicating, setDuplicating] = useState(false)
  const [showTeamPicker, setShowTeamPicker] = useState(false)

  // Biblioteca de ejercicios (común a todo el club)
  const [libItems, setLibItems] = useState([])
  const [libLoading, setLibLoading] = useState(false)
  const [libFilter, setLibFilter] = useState('')
  const [showLibForm, setShowLibForm] = useState(false)
  const [editingLibItem, setEditingLibItem] = useState(null)
  const [libForm, setLibForm] = useState(emptyExForm)
  const [savingLib, setSavingLib] = useState(false)
  const [editorLibItem, setEditorLibItem] = useState(null)
  const [showLibPicker, setShowLibPicker] = useState(false)

  // Plantillas de sesión
  const [templates, setTemplates] = useState([])
  const [useTemplateId, setUseTemplateId] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateTitle, setTemplateTitle] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Modo entrenamiento en vivo
  const [liveMode, setLiveMode] = useState(false)
  const [liveIdx, setLiveIdx] = useState(0)
  const [liveSeconds, setLiveSeconds] = useState(0)
  const [liveRunning, setLiveRunning] = useState(false)
  const [liveHasStarted, setLiveHasStarted] = useState(false) // para el texto "Empezar" vs "Reanudar"
  const [liveShowDiagram, setLiveShowDiagram] = useState(false) // ver la pizarra del ejercicio actual

  useEffect(() => {
    if (!user || !profile) return
    loadLibrary()
    if (!isDirector && !activeTeam) return
    loadTeams()
  }, [user, profile, activeTeam])

  useEffect(() => {
    if (!liveMode || !liveRunning) return
    const t = setInterval(() => setLiveSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [liveMode, liveRunning])

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').eq('active', true).order('name')
      setTeams(data || [])
      if (data?.length > 0) await loadSessions(data[0])
      else setLoading(false)
    } else {
      if (!activeTeam) { setLoading(false); return }
      setTeams(myTeams)
      await loadSessions(activeTeam)
    }
  }

  async function loadSessions(team) {
    setSelectedTeam(team)
    const { data } = await supabase.from('training_sessions').select('*').eq('team_id', team.id).order('date', { ascending: false })
    setSessions(data || [])
    setLoading(false)
    await loadTemplates(team.id)
  }

  async function loadTemplates(teamId) {
    const { data } = await supabase.from('session_templates').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function loadSharedSessions() {
    setSharedLoading(true)
    // Cargamos todos los equipos del club para buscar sesiones compartidas de cualquier equipo
    const { data: allTeams } = await supabase.from('teams').select('id').eq('active', true)
    const teamIds = (allTeams || []).map(t => t.id)
    if (teamIds.length === 0) { setSharedLoading(false); return }

    const { data } = await supabase
      .from('training_sessions')
      .select('*, teams(name)')
      .eq('shared', true)
      .in('team_id', teamIds)
      .order('date', { ascending: false })

    setSharedSessions(data || [])
    setSharedLoading(false)
  }

  async function loadExercises(sessionId) {
    const { data } = await supabase.from('training_exercises').select('*').eq('session_id', sessionId).order('order_index')
    setExercises(data || [])
  }

  async function openDetail(session) {
    setDetailSession(session)
    await loadExercises(session.id)
  }

  function openNewSession() {
    setEditingSession(null)
    setUseTemplateId('')
    setForm({ title: '', date: new Date().toISOString().split('T')[0], start_time: '18:00', duration_minutes: 90, objectives: '', notes: '' })
    setShowForm(true)
  }

  function openEditSession(session) {
    setEditingSession(session.id)
    setUseTemplateId('')
    setForm({ title: session.title, date: session.date, start_time: session.start_time || '18:00', duration_minutes: session.duration_minutes || 90, objectives: session.objectives || '', notes: session.notes || '' })
    setShowForm(true)
  }

  function applyTemplate(id) {
    setUseTemplateId(id)
    if (!id) return
    const t = templates.find(x => x.id === id)
    if (!t) return
    setForm(f => ({ ...f, title: t.title, objectives: t.objectives || '', notes: t.notes || '', duration_minutes: t.duration_minutes || 90 }))
  }

  async function handleSaveSession(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, team_id: selectedTeam.id, created_by: user.id }
    if (editingSession) {
      await supabase.from('training_sessions').update(payload).eq('id', editingSession)
    } else {
      const { data: newSession } = await supabase.from('training_sessions').insert(payload).select().single()
      if (useTemplateId && newSession) {
        const { data: tExs } = await supabase.from('session_template_exercises').select('*').eq('template_id', useTemplateId).order('order_index')
        if (tExs?.length > 0) {
          await supabase.from('training_exercises').insert(tExs.map(te => ({
            ...pickExFields(te), session_id: newSession.id, play_data: te.play_data, order_index: te.order_index,
          })))
        }
      }
    }
    setSaving(false)
    setShowForm(false)
    setUseTemplateId('')
    await loadSessions(selectedTeam)
    if (detailSession?.id === editingSession) setDetailSession(s => ({ ...s, ...form }))
  }

  async function handleDeleteSession(id) {
    if (!confirm('¿Eliminar este entrenamiento?')) return
    await supabase.from('training_sessions').delete().eq('id', id)
    if (detailSession?.id === id) setDetailSession(null)
    await loadSessions(selectedTeam)
  }

  async function handleToggleCompleted(session) {
    await supabase.from('training_sessions').update({ completed: !session.completed }).eq('id', session.id)
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, completed: !s.completed } : s))
    if (detailSession?.id === session.id) setDetailSession(s => ({ ...s, completed: !s.completed }))
  }

  async function handleToggleShared(session) {
    const newShared = !session.shared
    setSharingId(session.id)
    await supabase.from('training_sessions').update({ shared: newShared }).eq('id', session.id)
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, shared: newShared } : s))
    if (detailSession?.id === session.id) setDetailSession(s => ({ ...s, shared: newShared }))
    setSharingId(null)
    // Refrescar compartidos si estamos en esa pestaña
    if (tab === 'compartidos') await loadSharedSessions()
  }

  async function handleSaveExercise(e) {
    e.preventDefault()
    setSavingEx(true)
    const payload = pickExFields(exForm)
    const { error } = editingExercise
      ? await supabase.from('training_exercises').update(payload).eq('id', editingExercise.id)
      : await supabase.from('training_exercises').insert({ ...payload, session_id: detailSession.id, order_index: exercises.length })
    setSavingEx(false)
    if (error) {
      console.error('Error guardando ejercicio:', error)
      alert(`No se pudo guardar el ejercicio: ${error.message}`)
      return
    }
    setShowExForm(false)
    setEditingExercise(null)
    setExForm(emptyExForm)
    await loadExercises(detailSession.id)
  }

  function openEditExercise(ex) {
    setEditingExercise(ex)
    setExForm(exToForm(ex))
    setShowExForm(true)
  }

  async function handleDeleteExercise(id) {
    await supabase.from('training_exercises').delete().eq('id', id)
    await loadExercises(detailSession.id)
  }

  async function moveExercise(idx, dir) {
    const otherIdx = idx + dir
    if (otherIdx < 0 || otherIdx >= exercises.length) return
    const a = exercises[idx], b = exercises[otherIdx]
    await supabase.from('training_exercises').update({ order_index: b.order_index }).eq('id', a.id)
    await supabase.from('training_exercises').update({ order_index: a.order_index }).eq('id', b.id)
    await loadExercises(detailSession.id)
  }

  async function saveExerciseToLibrary(ex) {
    await supabase.from('exercise_library').insert({ ...pickExFields(ex), play_data: ex.play_data, created_by: user.id })
    alert(`«${ex.title}» guardado en tu biblioteca de ejercicios`)
  }

  async function addExerciseFromLibrary(item) {
    await supabase.from('training_exercises').insert({
      ...pickExFields(item), session_id: detailSession.id, play_data: item.play_data, order_index: exercises.length,
    })
    setShowLibPicker(false)
    await loadExercises(detailSession.id)
  }

  // ── Biblioteca ─────────────────────────────────────────────────
  async function loadLibrary() {
    setLibLoading(true)
    const { data } = await supabase.from('exercise_library').select('*').order('created_at', { ascending: false })
    setLibItems(data || [])
    setLibLoading(false)
  }

  function openNewLibItem() {
    setEditingLibItem(null)
    setLibForm(emptyExForm)
    setShowLibForm(true)
  }

  function openEditLibItem(item) {
    setEditingLibItem(item)
    setLibForm(exToForm(item))
    setShowLibForm(true)
  }

  async function handleSaveLibItem(e) {
    e.preventDefault()
    setSavingLib(true)
    const payload = pickExFields(libForm)
    if (editingLibItem) await supabase.from('exercise_library').update(payload).eq('id', editingLibItem.id)
    else await supabase.from('exercise_library').insert({ ...payload, created_by: user.id })
    setSavingLib(false)
    setShowLibForm(false)
    setEditingLibItem(null)
    setLibForm(emptyExForm)
    await loadLibrary()
  }

  async function handleDeleteLibItem(id) {
    if (!confirm('¿Eliminar este ejercicio de la biblioteca?')) return
    const { error, count } = await supabase.from('exercise_library').delete({ count: 'exact' }).eq('id', id)
    if (error) {
      console.error('Error eliminando de la biblioteca:', error)
      alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    if (!count) {
      alert('No se ha eliminado ningún ejercicio — puede que no tengas permiso sobre este (solo el autor o el director pueden borrarlo).')
    }
    await loadLibrary()
  }

  async function handleSaveLibItemPlay({ title, description, steps, courtType }) {
    if (!editorLibItem) return
    await supabase.from('exercise_library').update({ play_data: { title, description, steps, courtType } }).eq('id', editorLibItem.id)
    setEditorLibItem(null)
    await loadLibrary()
  }

  // ── Plantillas ─────────────────────────────────────────────────
  async function handleSaveAsTemplate(e) {
    e.preventDefault()
    if (!detailSession) return
    setSavingTemplate(true)
    const { data: tmpl, error } = await supabase.from('session_templates').insert({
      team_id: detailSession.team_id,
      title: templateTitle || detailSession.title,
      objectives: detailSession.objectives,
      notes: detailSession.notes,
      duration_minutes: detailSession.duration_minutes,
      created_by: user.id,
    }).select().single()
    if (!error && tmpl && exercises.length > 0) {
      await supabase.from('session_template_exercises').insert(exercises.map(ex => ({
        ...pickExFields(ex), template_id: tmpl.id, play_data: ex.play_data, order_index: ex.order_index,
      })))
    }
    setSavingTemplate(false)
    setShowSaveTemplate(false)
    setTemplateTitle('')
    await loadTemplates(detailSession.team_id)
  }

  // ── Modo en vivo ───────────────────────────────────────────────
  function startLive() {
    if (exercises.length === 0) return
    setLiveIdx(0)
    setLiveSeconds((exercises[0]?.duration_minutes || 10) * 60)
    setLiveRunning(false)
    setLiveHasStarted(false)
    setLiveShowDiagram(false)
    setLiveMode(true)
  }
  function liveGoTo(idx) {
    if (idx < 0 || idx >= exercises.length) { setLiveMode(false); return }
    setLiveIdx(idx)
    setLiveSeconds((exercises[idx]?.duration_minutes || 10) * 60)
    setLiveRunning(false)
    setLiveHasStarted(false)
    setLiveShowDiagram(false)
  }

  function handleDuplicateClick() {
    if (!detailSession) return
    if (teams.length === 1) duplicateSessionTo(teams[0].id)
    else setShowTeamPicker(true)
  }

  async function duplicateSessionTo(teamId) {
    if (!detailSession) return
    setDuplicating(true)
    const { data: newSession, error } = await supabase.from('training_sessions').insert({
      team_id: teamId,
      title: detailSession.title,
      date: new Date().toISOString().split('T')[0],
      start_time: detailSession.start_time,
      duration_minutes: detailSession.duration_minutes,
      objectives: detailSession.objectives,
      notes: detailSession.notes,
      created_by: user.id,
      completed: false,
      shared: false,
    }).select().single()

    if (!error && newSession && exercises.length > 0) {
      const exPayload = exercises.map(ex => ({
        ...pickExFields(ex), session_id: newSession.id, order_index: ex.order_index, play_data: ex.play_data,
      }))
      await supabase.from('training_exercises').insert(exPayload)
    }

    setDuplicating(false)
    setShowTeamPicker(false)
    const targetTeam = teams.find(t => t.id === teamId)
    setDetailSession(null)
    setTab('proximos')
    if (targetTeam) await loadSessions(targetTeam)
  }

  async function handleSaveExercisePlay({ title, description, steps, courtType }) {
    if (!editorExercise) return
    await supabase.from('training_exercises').update({ play_data: { title, description, steps, courtType } }).eq('id', editorExercise.id)
    setEditorExercise(null)
    await loadExercises(detailSession.id)
  }

  // ¿Puede editar esta sesión? Solo si es suya o es director
  const canEditDetail = detailSession && (isDirector || detailSession.created_by === user?.id)
  // ¿Es una sesión compartida de otro entrenador (solo lectura)?
  const isReadOnly = detailSession && !canEditDetail

  const today = new Date().toISOString().split('T')[0]
  const filtered = sessions.filter(s => tab === 'proximos' ? s.date >= today && !s.completed : s.date < today || s.completed)
  const filteredLib = libFilter ? libItems.filter(i => i.category === libFilter) : libItems

  const tabStyle = (t) => ({
    padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
    background: tab === t ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
    color: tab === t ? '#fff' : '#475569',
    border: tab === t ? 'none' : '1.5px solid #e2e8f0',
    boxShadow: tab === t ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
  })

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  // Full-screen court editor para ejercicio de una sesión
  if (editorExercise) {
    const initData = editorExercise.play_data
      ? { title: editorExercise.play_data.title || editorExercise.title, description: editorExercise.play_data.description || '', steps: editorExercise.play_data.steps || [], courtType: editorExercise.play_data.courtType }
      : { title: editorExercise.title, description: '', steps: [] }
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            initialData={initData}
            onSave={handleSaveExercisePlay}
            onClose={() => setEditorExercise(null)}
            visionCones
            maxPlayers={15}
            multiBall
          />
        </div>
      </ModalPortal>
    )
  }

  // Full-screen court editor para ejercicio de biblioteca
  if (editorLibItem) {
    const canEditLib = editorLibItem.created_by === user.id || isDirector
    const initData = editorLibItem.play_data
      ? { title: editorLibItem.play_data.title || editorLibItem.title, description: editorLibItem.play_data.description || '', steps: editorLibItem.play_data.steps || [], courtType: editorLibItem.play_data.courtType }
      : { title: editorLibItem.title, description: '', steps: [] }
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            readOnly={!canEditLib}
            initialData={initData}
            onSave={canEditLib ? handleSaveLibItemPlay : undefined}
            onClose={() => setEditorLibItem(null)}
            visionCones
            maxPlayers={15}
            multiBall
          />
        </div>
      </ModalPortal>
    )
  }

  if (!selectedTeam && tab !== 'compartidos' && tab !== 'biblioteca') return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 56 }}>📝</div>
      <h2 className="empty-state-title" style={{ fontSize: 20, fontWeight: 800 }}>Sin equipo asignado</h2>
      <p className="empty-state-text" style={{ fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  const totalMinutes = exercises.reduce((a, e) => a + (e.duration_minutes || 0), 0)
  const liveEx = exercises[liveIdx]

  return (
    <div className="fade-in">
      {/* Modo entrenamiento en vivo */}
      {liveMode && (
        <ModalPortal>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', color: '#fff',
            background: 'linear-gradient(135deg,#0a1f0e,#122818 60%,#1a3820)',
            paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <button onClick={() => setLiveMode(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, color: '#fff', padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>✕ Salir</button>
              <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>Ejercicio {liveIdx + 1} / {exercises.length}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '12px 24px', textAlign: 'center', minHeight: 0, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <CategoryBadge category={liveEx?.category} />
                <IntensityBadge intensity={liveEx?.intensity} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 10, maxWidth: 480 }}>{liveEx?.title}</div>
              {liveEx?.play_data && (
                <button onClick={() => setLiveShowDiagram(true)} style={{
                  marginBottom: 10, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10, color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>🏀 Ver pizarra</button>
              )}
              <div style={{ fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: liveSeconds === 0 ? '#f59e0b' : '#fff', margin: '4px 0 10px' }}>
                {String(Math.floor(liveSeconds / 60)).padStart(2, '0')}:{String(liveSeconds % 60).padStart(2, '0')}
              </div>
              {liveSeconds === 0 && <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 10 }}>⏰ ¡Tiempo!</div>}
              <div style={{ maxWidth: 440, textAlign: 'left', width: '100%' }}>
                {liveEx?.objective && <div style={{ marginBottom: 10 }}><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>🎯 Objetivo</span><p style={{ fontSize: 13.5, opacity: 0.85, margin: '2px 0 0', lineHeight: 1.5 }}>{liveEx.objective}</p></div>}
                {liveEx?.description && <div style={{ marginBottom: 10 }}><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>📋 Desarrollo</span><p style={{ fontSize: 13.5, opacity: 0.85, margin: '2px 0 0', lineHeight: 1.5 }}>{liveEx.description}</p></div>}
                {liveEx?.key_points && <div style={{ marginBottom: 10 }}><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>💡 Puntos clave</span><p style={{ fontSize: 13.5, opacity: 0.85, margin: '2px 0 0', lineHeight: 1.5 }}>{liveEx.key_points}</p></div>}
              </div>
              <button onClick={() => { setLiveRunning(r => !r); setLiveHasStarted(true) }} style={{
                marginTop: 26, background: liveRunning ? 'rgba(255,255,255,0.12)' : '#52B043', border: 'none', borderRadius: 12,
                color: '#fff', padding: '13px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                {liveRunning ? '⏸ Pausar' : liveHasStarted ? '▶ Reanudar' : '▶ Empezar'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 20, flexShrink: 0 }}>
              <button onClick={() => liveGoTo(liveIdx - 1)} disabled={liveIdx === 0} style={{
                flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'transparent',
                color: liveIdx === 0 ? 'rgba(255,255,255,0.3)' : '#fff', fontWeight: 700, cursor: liveIdx === 0 ? 'default' : 'pointer',
              }}>← Anterior</button>
              <button onClick={() => liveGoTo(liveIdx + 1)} style={{
                flex: 1, padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontWeight: 700,
              }}>
                {liveIdx === exercises.length - 1 ? 'Terminar ✓' : 'Siguiente →'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Pizarra del ejercicio actual, vista desde el Modo en vivo */}
      {liveMode && liveShowDiagram && liveEx?.play_data && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, zIndex: 2100 }}>
            <CourtEditor
              readOnly
              initialData={{
                title: liveEx.play_data.title || liveEx.title,
                description: liveEx.play_data.description || '',
                steps: liveEx.play_data.steps || [],
                courtType: liveEx.play_data.courtType,
              }}
              onClose={() => setLiveShowDiagram(false)}
              visionCones
              maxPlayers={15}
              multiBall
            />
          </div>
        </ModalPortal>
      )}

      {/* Vista detalle sesión */}
      {detailSession ? (
        <div>
          <button onClick={() => setDetailSession(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
            ← Volver a entrenamientos
          </button>

          {/* Cabecera sesión */}
          <div style={{ borderRadius: 18, marginBottom: 20, background: detailSession.completed ? 'linear-gradient(135deg,#475569,#64748b)' : 'linear-gradient(135deg, #1C5C2A 0%, #2d7a3a 50%, #52B043 100%)', boxShadow: detailSession.completed ? '0 4px 20px rgba(71,85,105,0.20)' : '0 4px 20px rgba(28,92,42,0.25)', padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                {/* Si es de otro equipo, mostrar de cuál es */}
                {isReadOnly && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                      📤 Compartido por el equipo {detailSession.teams?.name || '—'}
                    </span>
                  </div>
                )}
                {/* Si es propio y está compartido, mostrar badge */}
                {!isReadOnly && detailSession.shared && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>📤 Compartido con el club</span>
                  </div>
                )}
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  {new Date(detailSession.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {detailSession.start_time && ` · ${detailSession.start_time.slice(0,5)}h`}
                </div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{detailSession.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
                  {detailSession.duration_minutes} min · {exercises.length} ejercicios
                  {totalMinutes > 0 && ` · ${totalMinutes} min planificados`}
                </div>
              </div>
              {detailSession.completed && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 8 }}>✓ COMPLETADO</span>}
            </div>
          </div>

          {/* Objetivos */}
          {detailSession.objectives && (
            <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #f3f4f6', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#52B043', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Objetivos</div>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{detailSession.objectives}</p>
            </div>
          )}

          {/* Notas */}
          {detailSession.notes && (
            <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #f3f4f6', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 Notas</div>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{detailSession.notes}</p>
            </div>
          )}

          {/* Modo en vivo — disponible para cualquiera que tenga ejercicios que seguir */}
          {exercises.length > 0 && (
            <button onClick={startLive} style={{
              width: '100%', marginBottom: 16, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#0a1f0e,#1C5C2A)', color: '#fff', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(10,31,14,0.3)',
            }}>▶ Modo entrenamiento en vivo</button>
          )}

          {/* Acciones sesión — solo si puede editar */}
          {canEditDetail && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {/* Marcar completado */}
              <button onClick={() => handleToggleCompleted(detailSession)} style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: detailSession.completed ? '#f3f4f6' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
                color: detailSession.completed ? '#374151' : '#fff'
              }}>{detailSession.completed ? '↩ Marcar pendiente' : '✓ Marcar completado'}</button>

              {/* Compartir entrenamiento */}
              <button
                onClick={() => handleToggleShared(detailSession)}
                disabled={sharingId === detailSession.id}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: detailSession.shared ? 'none' : '1.5px solid #7c3aed', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: detailSession.shared
                    ? 'linear-gradient(135deg,#7c3aed,#5b21b6)'
                    : 'transparent',
                  color: detailSession.shared ? '#fff' : '#7c3aed',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: sharingId === detailSession.id ? 0.6 : 1,
                }}
              >
                {sharingId === detailSession.id
                  ? '⏳ Guardando...'
                  : detailSession.shared
                    ? '📤 Compartido con el club'
                    : '📤 Compartir con el club'}
              </button>

              <button onClick={() => openEditSession(detailSession)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
              <button onClick={() => { setTemplateTitle(detailSession.title); setShowSaveTemplate(true) }} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💾 Guardar como plantilla</button>
              <button onClick={() => handleDeleteSession(detailSession.id)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          )}

          {/* Aviso si es solo lectura */}
          {isReadOnly && (
            <div style={{ backgroundColor: '#f5f3ff', borderRadius: 12, padding: '12px 16px', border: '1px solid #ddd6fe', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>👁️</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>Entrenamiento de solo lectura</div>
                <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>Puedes ver los ejercicios diseñados por el equipo {detailSession.teams?.name || 'otro equipo'}, pero no editarlos.</div>
              </div>
              <button onClick={handleDuplicateClick} disabled={duplicating} style={{
                padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: '#fff', flexShrink: 0,
                opacity: duplicating ? 0.6 : 1,
              }}>
                {duplicating ? '⏳ Duplicando...' : '📋 Duplicar a mi equipo'}
              </button>
            </div>
          )}

          {/* Ejercicios */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 }}>Ejercicios · {totalMinutes} min</h3>
            {canEditDetail && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowLibPicker(true)} style={{
                  padding: '7px 14px', borderRadius: 10, border: '1.5px solid #bfdbfe', cursor: 'pointer',
                  background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 700
                }}>📚 Desde biblioteca</button>
                <button onClick={() => { setEditingExercise(null); setShowExForm(true); setExForm(emptyExForm) }} style={{
                  padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontSize: 13, fontWeight: 700
                }}>+ Añadir</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏋️</div>
                <div style={{ fontSize: 14 }}>{isReadOnly ? 'Este entrenamiento no tiene ejercicios' : 'Añade ejercicios a esta sesión'}</div>
              </div>
            )}
            {exercises.map((ex, idx) => (
              <div key={ex.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {canEditDetail && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 4, flexShrink: 0 }}>
                    <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#e5e7eb' : '#6b7280', fontSize: 11, padding: 0, lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveExercise(idx, 1)} disabled={idx === exercises.length - 1} style={{ background: 'none', border: 'none', cursor: idx === exercises.length - 1 ? 'default' : 'pointer', color: idx === exercises.length - 1 ? '#e5e7eb' : '#6b7280', fontSize: 11, padding: 0, lineHeight: 1 }}>▼</button>
                  </div>
                )}
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{ex.title}</div>
                      <CategoryBadge category={ex.category} />
                      <IntensityBadge intensity={ex.intensity} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#52B043', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: 6 }}>{ex.duration_minutes} min</span>
                      {canEditDetail && (
                        <>
                          <button onClick={() => saveExerciseToLibrary(ex)} title="Guardar en mi biblioteca" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 13, padding: 0 }}>💾</button>
                          <button onClick={() => openEditExercise(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 13, padding: 0 }}>✏️</button>
                          <button onClick={() => handleDeleteExercise(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                        </>
                      )}
                    </div>
                  </div>
                  {(ex.organization || ex.materials) && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                      {ex.organization && <span>👥 {ex.organization}</span>}
                      {ex.organization && ex.materials && <span> · </span>}
                      {ex.materials && <span>🎒 {ex.materials}</span>}
                    </div>
                  )}
                  <DetailBlock label="🎯 Objetivo" text={ex.objective} />
                  <DetailBlock label="📋 Desarrollo" text={ex.description} />
                  <DetailBlock label="💡 Puntos clave" text={ex.key_points} />
                  <DetailBlock label="🔄 Variantes" text={ex.variants} />
                  <div style={{ marginTop: 8 }}>
                    <button
                      disabled={!ex.play_data && isReadOnly}
                      style={{
                        fontSize: 12, fontWeight: 600,
                        color: ex.play_data ? '#2563eb' : '#9ca3af',
                        background: ex.play_data ? '#eff6ff' : '#f9fafb',
                        border: 'none', borderRadius: 8, padding: '4px 10px',
                        cursor: (!ex.play_data && isReadOnly) ? 'default' : 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                      onClick={() => {
                        if (isReadOnly && ex.play_data) setEditorExercise(ex)
                        else if (!isReadOnly) setEditorExercise(ex)
                      }}
                    >
                      🏀 {ex.play_data ? (isReadOnly ? 'Ver diseño' : 'Ver/editar entrenamiento') : 'Diseñar entrenamiento'}
                    </button>
                    {ex.play_data && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>✓ Jugada guardada</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal añadir/editar ejercicio */}
          {showExForm && (
            <ModalPortal>
            <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>{editingExercise ? 'Editar ejercicio' : 'Añadir ejercicio'}</h2>
                <form onSubmit={handleSaveExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ExerciseFormFields form={exForm} setForm={setExForm} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type='button' onClick={() => { setShowExForm(false); setEditingExercise(null) }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    <button type='submit' disabled={savingEx} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                      {savingEx ? 'Guardando...' : editingExercise ? 'Guardar cambios' : 'Añadir'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            </ModalPortal>
          )}

          {/* Modal elegir ejercicio de la biblioteca */}
          {showLibPicker && (
            <ModalPortal>
            <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) setShowLibPicker(false) }}>
              <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>📚 Elegir de la biblioteca</h2>
                {libItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>Tu biblioteca está vacía todavía. Guarda ejercicios en ella desde el botón 💾 de cada ejercicio.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {libItems.map(item => {
                      const mine = item.created_by === user.id || isDirector
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff',
                        }}>
                          <button onClick={() => addExerciseFromLibrary(item)} style={{
                            flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{item.title}</span>
                                <CategoryBadge category={item.category} />
                              </div>
                              {item.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#52B043', flexShrink: 0 }}>{item.duration_minutes} min</span>
                          </button>
                          {mine && (
                            <button onClick={() => handleDeleteLibItem(item.id)} title="Eliminar de la biblioteca" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <button onClick={() => setShowLibPicker(false)} style={{ marginTop: 16, width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
              </div>
            </div>
            </ModalPortal>
          )}

          {/* Modal guardar como plantilla */}
          {showSaveTemplate && (
            <ModalPortal>
            <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>💾 Guardar como plantilla</h2>
                <p style={{ fontSize: 12.5, color: '#6b7280', margin: '0 0 16px' }}>Guarda los objetivos, notas y los {exercises.length} ejercicios de esta sesión como plantilla reutilizable para {selectedTeam?.name}.</p>
                <form onSubmit={handleSaveAsTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nombre de la plantilla</label>
                    <input type='text' value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} required style={inputStyle}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type='button' onClick={() => setShowSaveTemplate(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    <button type='submit' disabled={savingTemplate} className="btn-primary" style={{ flex: 1, padding: '11px' }}>
                      {savingTemplate ? 'Guardando...' : 'Guardar plantilla'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            </ModalPortal>
          )}
        </div>

      ) : (
        /* Vista lista sesiones / biblioteca */
        <div>
          <div style={{
            background: tab === 'biblioteca' ? 'linear-gradient(135deg, #0a1f2e 0%, #1C3C5C 50%, #2563eb 100%)' : 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
            borderRadius: 20, padding: '24px 28px', marginBottom: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
                {tab === 'compartidos' ? 'Compartidos en el club' : tab === 'biblioteca' ? 'Común a todo el club' : (selectedTeam?.name || 'Planificar sesiones')}
              </p>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>{tab === 'biblioteca' ? 'Biblioteca de ejercicios' : 'Entrenamientos'}</h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
                {tab === 'compartidos'
                  ? `Sesiones compartidas por todos los entrenadores`
                  : tab === 'biblioteca'
                  ? `${libItems.length} ${libItems.length === 1 ? 'ejercicio guardado' : 'ejercicios guardados'}`
                  : `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}`}
              </p>
            </div>
            {tab === 'biblioteca'
              ? <button onClick={openNewLibItem} className="btn-primary" style={{ flexShrink: 0 }}>+ Nuevo</button>
              : tab !== 'compartidos'
              ? <button onClick={openNewSession} className="btn-primary" style={{ flexShrink: 0 }}>+ Nuevo</button>
              : <div style={{ fontSize: 48, opacity: 0.35 }}>📝</div>}
          </div>

          {/* Selector de equipo — solo en pestañas de sesiones propias */}
          {tab !== 'compartidos' && tab !== 'biblioteca' && isDirector && teams.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {teams.map(t => {
                const active = selectedTeam?.id === t.id
                return (
                  <button key={t.id} onClick={() => { setLoading(true); loadSessions(t) }} style={{
                    padding: '8px 15px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: active ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
                    color: active ? '#fff' : '#475569',
                    border: active ? 'none' : '1.5px solid #e2e8f0',
                    boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
                  }}>{t.name}</button>
                )
              })}
            </div>
          )}

          {/* Pestañas */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setTab('proximos')} style={tabStyle('proximos')}>📅 Próximos</button>
            <button onClick={() => setTab('pasados')} style={tabStyle('pasados')}>✅ Pasados</button>
            <button onClick={() => { setTab('compartidos'); loadSharedSessions() }} style={{
              ...tabStyle('compartidos'),
              background: tab === 'compartidos' ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f3f4f6',
              color: tab === 'compartidos' ? '#fff' : '#374151',
            }}>
              📤 Compartidos
            </button>
            <button onClick={() => setTab('biblioteca')} style={{
              ...tabStyle('biblioteca'),
              background: tab === 'biblioteca' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#f3f4f6',
              color: tab === 'biblioteca' ? '#fff' : '#374151',
            }}>
              📚 Biblioteca
            </button>
          </div>

          {/* PESTAÑA BIBLIOTECA */}
          {tab === 'biblioteca' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => setLibFilter('')} style={{
                  padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: libFilter === '' ? '#111827' : '#f3f4f6', color: libFilter === '' ? '#fff' : '#374151',
                }}>Todos</button>
                {Object.entries(CATEGORIES).map(([key, c]) => (
                  <button key={key} onClick={() => setLibFilter(key)} style={{
                    padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: libFilter === key ? c.color : c.color + '1a', color: libFilter === key ? '#fff' : c.color,
                  }}>{c.emoji} {c.label}</button>
                ))}
              </div>

              {libLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  <div style={{ fontSize: 14 }}>Cargando biblioteca...</div>
                </div>
              ) : filteredLib.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3' }}>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>📚</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin ejercicios en la biblioteca</div>
                  <div style={{ fontSize: 13 }}>Crea el primero, o guarda uno desde una sesión con el botón 💾</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {filteredLib.map(item => {
                    const mine = item.created_by === user.id || isDirector
                    return (
                      <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{item.title}</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#52B043', backgroundColor: '#f0fdf4', padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>{item.duration_minutes} min</span>
                        </div>
                        <div style={{ marginTop: 4 }}><CategoryBadge category={item.category} /></div>
                        {item.description && <p style={{ fontSize: 12.5, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5 }}>{item.description}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                          <button onClick={() => setEditorLibItem(item)} style={{
                            fontSize: 12, fontWeight: 600, color: item.play_data ? '#2563eb' : '#9ca3af',
                            background: item.play_data ? '#eff6ff' : '#f9fafb', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                          }}>🏀 {item.play_data ? (mine ? 'Ver/editar' : 'Ver diseño') : 'Diseñar'}</button>
                          {mine && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => openEditLibItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 13, padding: 0 }}>✏️</button>
                              <button onClick={() => handleDeleteLibItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Modal crear/editar ejercicio de biblioteca */}
              {showLibForm && (
                <ModalPortal>
                <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>{editingLibItem ? 'Editar ejercicio' : 'Nuevo ejercicio de biblioteca'}</h2>
                    <form onSubmit={handleSaveLibItem} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <ExerciseFormFields form={libForm} setForm={setLibForm} />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type='button' onClick={() => { setShowLibForm(false); setEditingLibItem(null) }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                        <button type='submit' disabled={savingLib} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                          {savingLib ? 'Guardando...' : editingLibItem ? 'Guardar cambios' : 'Añadir'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                </ModalPortal>
              )}
            </div>
          )}

          {/* PESTAÑA COMPARTIDOS */}
          {tab === 'compartidos' && (
            <div>
              {sharedLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  <div style={{ fontSize: 14 }}>Cargando entrenamientos compartidos...</div>
                </div>
              ) : sharedSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.55 }}>📤</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sin entrenamientos compartidos todavía</div>
                  <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
                    Cuando un entrenador finalice una sesión y pulse <strong>«Compartir con el club»</strong>, aparecerá aquí para que todos puedan verla.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sharedSessions.map(session => {
                    const teamName = session.teams?.name || 'Equipo'
                    return (
                      <div key={session.id} onClick={() => openDetail(session)} style={{
                        backgroundColor: '#fff', borderRadius: 14, padding: '16px 18px',
                        border: '1px solid #ede9fe',
                        boxShadow: '0 1px 4px rgba(124,58,237,0.06)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                      }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(124,58,237,0.06)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {/* Icono fecha */}
                          <div style={{
                            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                            background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            color: '#fff'
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 900 }}>{new Date(session.date + 'T12:00:00').getDate()}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>
                              {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{session.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              {/* Badge equipo */}
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5b21b6', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: 5 }}>
                                🏀 {teamName}
                              </span>
                              {/* Duración */}
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                {session.duration_minutes} min
                              </span>
                            </div>
                            {session.objectives && (
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                {session.objectives}
                              </div>
                            )}
                          </div>
                        </div>
                        <span style={{ color: '#7c3aed', fontSize: 18, flexShrink: 0 }}>→</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑAS PRÓXIMOS / PASADOS */}
          {tab !== 'compartidos' && tab !== 'biblioteca' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <div className="empty-state-title">{tab === 'proximos' ? 'No hay entrenamientos planificados' : 'No hay entrenamientos pasados'}</div>
                  {tab === 'proximos' && <div className="empty-state-text">Crea el primero con el botón de arriba</div>}
                </div>
              )}
              {filtered.map(session => (
                <div key={session.id} onClick={() => openDetail(session)} style={{
                  backgroundColor: '#fff', borderRadius: 16, padding: '15px 18px',
                  border: `1px solid ${session.completed ? '#e8edf3' : '#bbf7d0'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  transition: 'all 0.2s'
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 13, flexShrink: 0,
                      background: session.completed ? 'linear-gradient(135deg,#94a3b8,#64748b)' : 'linear-gradient(135deg,#52B043,#1C5C2A)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', boxShadow: session.completed ? 'none' : '0 2px 8px rgba(28,92,42,0.25)'
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{new Date(session.date + 'T12:00:00').getDate()}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: 0.85, marginTop: 2 }}>
                        {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: session.completed ? '#94a3b8' : '#0f172a', letterSpacing: -0.2 }}>{session.title}</div>
                        {session.shared && (
                          <span title="Compartido con el club" style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 7px', borderRadius: 5 }}>📤 Compartido</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>
                        {session.start_time ? session.start_time.slice(0,5) + 'h · ' : ''}{session.duration_minutes} min
                        {session.completed && ' · ✓ Completado'}
                      </div>
                      {session.objectives && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{session.objectives}</div>}
                    </div>
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 18, flexShrink: 0 }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal nueva/editar sesión */}
      {showForm && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>
              {editingSession ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}
            </h2>
            <form onSubmit={handleSaveSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!editingSession && templates.length > 0 && (
                <div>
                  <label style={labelStyle}>Usar plantilla (opcional)</label>
                  <select value={useTemplateId} onChange={e => applyTemplate(e.target.value)} style={inputStyle}>
                    <option value=''>— Sin plantilla —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Título *</label>
                <input type='text' value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder='Ej: Entrenamiento técnico, Partido de preparación...' required style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type='date' value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div>
                  <label style={labelStyle}>Hora inicio</label>
                  <input type='time' value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Duración (minutos)</label>
                <input type='number' value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                  min={15} max={240} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label style={labelStyle}>Objetivos</label>
                <textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                  placeholder='¿Qué queremos trabajar hoy?' rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div>
                <label style={labelStyle}>Notas adicionales</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder='Convocatoria, material necesario...' rows={2}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                <button type='submit' disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px', ...(saving ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {}) }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal elegir equipo para duplicar */}
      {showTeamPicker && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTeamPicker(false) }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 24px 70px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>¿A qué equipo lo duplico?</h3>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>Se creará una copia propia (con sus ejercicios) que podrás editar sin afectar a la original.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => duplicateSessionTo(t.id)} disabled={duplicating} style={{
                  padding: '11px 14px', borderRadius: 10, border: '1.5px solid #ede9fe', background: '#f5f3ff',
                  color: '#5b21b6', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                }}>{t.name}</button>
              ))}
            </div>
            <button onClick={() => setShowTeamPicker(false)} style={{ marginTop: 14, width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  )
}
