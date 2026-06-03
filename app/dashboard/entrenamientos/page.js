'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

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
  const [exForm, setExForm] = useState({ title: '', duration_minutes: 10, description: '' })
  const [savingEx, setSavingEx] = useState(false)

  // CourtEditor para ejercicio
  const [editorExercise, setEditorExercise] = useState(null)

  // Entrenamientos compartidos
  const [sharedSessions, setSharedSessions] = useState([])
  const [sharedProfiles, setSharedProfiles] = useState({}) // created_by → full_name
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharingId, setSharingId] = useState(null) // sesión que se está compartiendo/descompartiendo

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) return
    loadTeams()
  }, [user, profile, activeTeam])

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').order('name')
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
  }

  async function loadSharedSessions() {
    setSharedLoading(true)
    // Cargamos todos los equipos del club para buscar sesiones compartidas de cualquier equipo
    const { data: allTeams } = await supabase.from('teams').select('id')
    const teamIds = (allTeams || []).map(t => t.id)
    if (teamIds.length === 0) { setSharedLoading(false); return }

    const { data } = await supabase
      .from('training_sessions')
      .select('*, teams(name)')
      .eq('shared', true)
      .in('team_id', teamIds)
      .order('date', { ascending: false })

    const list = data || []
    setSharedSessions(list)

    // Cargamos nombres de los creadores
    const creatorIds = [...new Set(list.map(s => s.created_by).filter(Boolean))]
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
      const map = {}
      for (const p of (profs || [])) map[p.id] = p.full_name || 'Entrenador'
      setSharedProfiles(map)
    }

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
    setForm({ title: '', date: new Date().toISOString().split('T')[0], start_time: '18:00', duration_minutes: 90, objectives: '', notes: '' })
    setShowForm(true)
  }

  function openEditSession(session) {
    setEditingSession(session.id)
    setForm({ title: session.title, date: session.date, start_time: session.start_time || '18:00', duration_minutes: session.duration_minutes || 90, objectives: session.objectives || '', notes: session.notes || '' })
    setShowForm(true)
  }

  async function handleSaveSession(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, team_id: selectedTeam.id, created_by: user.id }
    if (editingSession) await supabase.from('training_sessions').update(payload).eq('id', editingSession)
    else await supabase.from('training_sessions').insert(payload)
    setSaving(false)
    setShowForm(false)
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
    await supabase.from('training_exercises').insert({ ...exForm, session_id: detailSession.id, order_index: exercises.length })
    setSavingEx(false)
    setShowExForm(false)
    setExForm({ title: '', duration_minutes: 10, description: '' })
    await loadExercises(detailSession.id)
  }

  async function handleDeleteExercise(id) {
    await supabase.from('training_exercises').delete().eq('id', id)
    await loadExercises(detailSession.id)
  }

  async function handleSaveExercisePlay({ title, description, steps }) {
    if (!editorExercise) return
    await supabase.from('training_exercises').update({ play_data: { title, description, steps } }).eq('id', editorExercise.id)
    setEditorExercise(null)
    await loadExercises(detailSession.id)
  }

  // ¿Puede editar esta sesión? Solo si es suya o es director
  const canEditDetail = detailSession && (isDirector || detailSession.created_by === user?.id)
  // ¿Es una sesión compartida de otro entrenador (solo lectura)?
  const isReadOnly = detailSession && !canEditDetail

  const today = new Date().toISOString().split('T')[0]
  const filtered = sessions.filter(s => tab === 'proximos' ? s.date >= today && !s.completed : s.date < today || s.completed)

  const tabStyle = (t) => ({
    padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
    background: tab === t ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
    color: tab === t ? '#fff' : '#475569',
    border: tab === t ? 'none' : '1.5px solid #e2e8f0',
    boxShadow: tab === t ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
  })

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s' }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 7 }
  const inputFocus = e => { e.target.style.borderColor = '#52B043'; e.target.style.boxShadow = '0 0 0 3px rgba(82,176,67,0.12)' }
  const inputBlur  = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  // Full-screen court editor para ejercicio
  if (editorExercise) {
    const initData = editorExercise.play_data
      ? { title: editorExercise.play_data.title || editorExercise.title, description: editorExercise.play_data.description || '', steps: editorExercise.play_data.steps || [] }
      : { title: editorExercise.title, description: '', steps: [] }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        <CourtEditor
          initialData={initData}
          onSave={handleSaveExercisePlay}
          onClose={() => setEditorExercise(null)}
        />
      </div>
    )
  }

  if (!selectedTeam && tab !== 'compartidos') return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 56 }}>📝</div>
      <h2 className="empty-state-title" style={{ fontSize: 20, fontWeight: 800 }}>Sin equipo asignado</h2>
      <p className="empty-state-text" style={{ fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  const totalMinutes = exercises.reduce((a, e) => a + (e.duration_minutes || 0), 0)

  return (
    <div className="fade-in">
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
                {/* Si es de otro entrenador, mostrar de quién es */}
                {isReadOnly && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                      📤 Compartido por {sharedProfiles[detailSession.created_by] || 'Entrenador'} · {detailSession.teams?.name || ''}
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
              <button onClick={() => handleDeleteSession(detailSession.id)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          )}

          {/* Aviso si es solo lectura */}
          {isReadOnly && (
            <div style={{ backgroundColor: '#f5f3ff', borderRadius: 12, padding: '12px 16px', border: '1px solid #ddd6fe', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>👁️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>Entrenamiento de solo lectura</div>
                <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>Puedes ver los ejercicios diseñados por {sharedProfiles[detailSession.created_by] || 'otro entrenador'}, pero no editarlos.</div>
              </div>
            </div>
          )}

          {/* Ejercicios */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 }}>Ejercicios · {totalMinutes} min</h3>
            {canEditDetail && (
              <button onClick={() => { setShowExForm(true); setExForm({ title: '', duration_minutes: 10, description: '' }) }} style={{
                padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontSize: 13, fontWeight: 700
              }}>+ Añadir</button>
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
              <div key={ex.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{ex.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#52B043', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: 6 }}>{ex.duration_minutes} min</span>
                      {canEditDetail && (
                        <button onClick={() => handleDeleteExercise(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                      )}
                    </div>
                  </div>
                  {ex.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.5 }}>{ex.description}</p>}
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

          {/* Modal añadir ejercicio */}
          {showExForm && (
            <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>Añadir ejercicio</h2>
                <form onSubmit={handleSaveExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nombre del ejercicio *</label>
                    <input type='text' value={exForm.title} onChange={e => setExForm(f => ({ ...f, title: e.target.value }))}
                      placeholder='Ej: Tiro libre, Defensa 1x1...' required style={inputStyle}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div>
                    <label style={labelStyle}>Duración (minutos)</label>
                    <input type='number' value={exForm.duration_minutes} onChange={e => setExForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                      min={1} max={120} style={inputStyle}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div>
                    <label style={labelStyle}>Descripción / Instrucciones</label>
                    <textarea value={exForm.description} onChange={e => setExForm(f => ({ ...f, description: e.target.value }))}
                      placeholder='Explica cómo se realiza el ejercicio...' rows={3}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type='button' onClick={() => setShowExForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    <button type='submit' disabled={savingEx} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                      {savingEx ? 'Guardando...' : 'Añadir'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

      ) : (
        /* Vista lista sesiones */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 className="page-title">Entrenamientos</h1>
              <p className="page-subtitle">
                {tab === 'compartidos'
                  ? `Entrenamientos compartidos por todos los entrenadores del club`
                  : `${selectedTeam?.name || ''} · ${sessions.length} sesiones`}
              </p>
            </div>
            {tab !== 'compartidos' && (
              <button onClick={openNewSession} className="btn-primary" style={{ flexShrink: 0 }}>+ Nuevo</button>
            )}
          </div>

          {/* Selector de equipo — solo en pestañas de sesiones propias */}
          {tab !== 'compartidos' && isDirector && teams.length > 1 && (
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTab('proximos')} style={tabStyle('proximos')}>📅 Próximos</button>
            <button onClick={() => setTab('pasados')} style={tabStyle('pasados')}>✅ Pasados</button>
            <button onClick={() => { setTab('compartidos'); loadSharedSessions() }} style={{
              ...tabStyle('compartidos'),
              background: tab === 'compartidos' ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f3f4f6',
              color: tab === 'compartidos' ? '#fff' : '#374151',
            }}>
              📤 Compartidos
            </button>
          </div>

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
                    const authorName = sharedProfiles[session.created_by] || 'Entrenador'
                    const teamName   = session.teams?.name || ''
                    const isOwn      = session.created_by === user?.id
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
                              {teamName && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#1C5C2A', backgroundColor: '#f0fdf4', padding: '2px 7px', borderRadius: 5 }}>
                                  🏀 {teamName}
                                </span>
                              )}
                              {/* Badge autor */}
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 7px', borderRadius: 5 }}>
                                {isOwn ? '👤 Tú' : `👤 ${authorName}`}
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
          {tab !== 'compartidos' && (
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
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>
              {editingSession ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}
            </h2>
            <form onSubmit={handleSaveSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
      )}

    </div>
  )
}
