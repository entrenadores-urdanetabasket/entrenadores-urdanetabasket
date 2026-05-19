'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

export default function EntrenamientosPage() {
  const { user, profile, supabase } = useAuth()
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
  const [editorExercise, setEditorExercise] = useState(null) // {id, play_data} o null para nuevo

  useEffect(() => { if (user && profile) loadTeams() }, [user, profile])

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').order('name')
      setTeams(data || [])
      if (data?.length > 0) await loadSessions(data[0])
      else setLoading(false)
    } else {
      const { data: tc } = await supabase.from('team_coaches').select('team_id').eq('coach_id', user.id)
      const ids = (tc || []).map(r => r.team_id)
      const { data } = ids.length > 0 ? await supabase.from('teams').select('*').in('id', ids) : { data: [] }
      if (data?.length > 0) { setTeams(data); await loadSessions(data[0]) }
      else setLoading(false)
    }
  }

  async function loadSessions(team) {
    setSelectedTeam(team)
    const { data } = await supabase.from('training_sessions').select('*').eq('team_id', team.id).order('date', { ascending: false })
    setSessions(data || [])
    setLoading(false)
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

  const today = new Date().toISOString().split('T')[0]
  const filtered = sessions.filter(s => tab === 'proximos' ? s.date >= today && !s.completed : s.date < today || s.completed)

  const tabStyle = (t) => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    backgroundColor: tab === t ? '#1C5C2A' : '#f3f4f6',
    color: tab === t ? '#fff' : '#374151'
  })

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  // Full-screen court editor for exercise play design
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

  if (!selectedTeam) return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📝</div>
      <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sin equipo asignado</h2>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  const totalMinutes = exercises.reduce((a, e) => a + (e.duration_minutes || 0), 0)

  return (
    <div>
      {/* Vista detalle sesión */}
      {detailSession ? (
        <div>
          <button onClick={() => setDetailSession(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
            ← Volver a entrenamientos
          </button>

          {/* Cabecera sesión */}
          <div style={{ borderRadius: 16, marginBottom: 20, background: detailSession.completed ? 'linear-gradient(135deg,#374151,#6b7280)' : 'linear-gradient(135deg,#1C5C2A,#52B043)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
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

          {/* Acciones sesión */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={() => handleToggleCompleted(detailSession)} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: detailSession.completed ? '#f3f4f6' : 'linear-gradient(135deg,#52B043,#3a8a2e)',
              color: detailSession.completed ? '#374151' : '#fff'
            }}>{detailSession.completed ? '↩ Marcar pendiente' : '✓ Marcar completado'}</button>
            <button onClick={() => openEditSession(detailSession)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
            <button onClick={() => handleDeleteSession(detailSession.id)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
          </div>

          {/* Ejercicios */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 }}>Ejercicios · {totalMinutes} min</h3>
            <button onClick={() => { setShowExForm(true); setExForm({ title: '', duration_minutes: 10, description: '' }) }} style={{
              padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontSize: 13, fontWeight: 700
            }}>+ Añadir</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏋️</div>
                <div style={{ fontSize: 14 }}>Añade ejercicios a esta sesión</div>
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
                      <button onClick={() => handleDeleteExercise(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                    </div>
                  </div>
                  {ex.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.5 }}>{ex.description}</p>}
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => setEditorExercise(ex)}
                      style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      🏀 {ex.play_data ? 'Ver/editar entrenamiento' : 'Diseñar entrenamiento'}
                    </button>
                    {ex.play_data && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>✓ Jugada guardada</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal añadir ejercicio */}
          {showExForm && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>Añadir ejercicio</h2>
                <form onSubmit={handleSaveExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nombre del ejercicio *</label>
                    <input type='text' value={exForm.title} onChange={e => setExForm(f => ({ ...f, title: e.target.value }))}
                      placeholder='Ej: Tiro libre, Defensa 1x1...' required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Duración (minutos)</label>
                    <input type='number' value={exForm.duration_minutes} onChange={e => setExForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                      min={1} max={120} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Descripción / Instrucciones</label>
                    <textarea value={exForm.description} onChange={e => setExForm(f => ({ ...f, description: e.target.value }))}
                      placeholder='Explica cómo se realiza el ejercicio...' rows={3}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                      onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type='button' onClick={() => setShowExForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                    <button type='submit' disabled={savingEx} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
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
              <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Entrenamientos</h1>
              <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>{selectedTeam.name} · {sessions.length} sesiones</p>
            </div>
            <button onClick={openNewSession} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
              fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(82,176,67,0.3)'
            }}>+ Nuevo</button>
          </div>

          {isDirector && teams.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => { setLoading(true); loadSessions(t) }} style={{
                  padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
                  color: selectedTeam?.id === t.id ? '#fff' : '#374151'
                }}>{t.name}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTab('proximos')} style={tabStyle('proximos')}>📅 Próximos</button>
            <button onClick={() => setTab('pasados')} style={tabStyle('pasados')}>✅ Pasados</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{tab === 'proximos' ? 'No hay entrenamientos planificados' : 'No hay entrenamientos pasados'}</div>
                {tab === 'proximos' && <div style={{ fontSize: 13, marginTop: 4 }}>Crea el primero con el botón de arriba</div>}
              </div>
            )}
            {filtered.map(session => (
              <div key={session.id} onClick={() => openDetail(session)} style={{
                backgroundColor: '#fff', borderRadius: 14, padding: '16px 18px',
                border: `1px solid ${session.completed ? '#e5e7eb' : '#d1fae5'}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                    background: session.completed ? 'linear-gradient(135deg,#6b7280,#374151)' : 'linear-gradient(135deg,#52B043,#1C5C2A)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff'
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{new Date(session.date + 'T12:00:00').getDate()}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>
                      {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: session.completed ? '#9ca3af' : '#111827' }}>{session.title}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {session.start_time ? session.start_time.slice(0,5) + 'h · ' : ''}{session.duration_minutes} min
                      {session.completed && ' · ✓ Completado'}
                    </div>
                    {session.objectives && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{session.objectives}</div>}
                  </div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: 18, flexShrink: 0 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal nueva/editar sesión */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>
              {editingSession ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}
            </h2>
            <form onSubmit={handleSaveSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Título *</label>
                <input type='text' value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder='Ej: Entrenamiento técnico, Partido de preparación...' required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type='date' value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div>
                  <label style={labelStyle}>Hora inicio</label>
                  <input type='time' value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Duración (minutos)</label>
                <input type='number' value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                  min={15} max={240} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label style={labelStyle}>Objetivos</label>
                <textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                  placeholder='¿Qué queremos trabajar hoy?' rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label style={labelStyle}>Notas adicionales</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder='Convocatoria, material necesario...' rows={2}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type='button' onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button type='submit' disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: saving ? '#e5e7eb' : 'linear-gradient(135deg,#52B043,#3a8a2e)', color: saving ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
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
