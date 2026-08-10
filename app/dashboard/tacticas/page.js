'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'
import ModalPortal from '@/components/ModalPortal'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

export default function TacticasPage() {
  const { user, profile, supabase } = useAuth()

  const [teams,        setTeams]        = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [tactics,      setTactics]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [openEditor,   setOpenEditor]   = useState(false)
  const [editingTactic,setEditingTactic]= useState(null)
  const [saving,       setSaving]       = useState(false)

  const [tab, setTab] = useState('mias') // 'mias' | 'compartidas'

  // Tácticas compartidas
  const [sharedTactics, setSharedTactics]   = useState([])
  const [sharedProfiles, setSharedProfiles] = useState({}) // created_by → full_name
  const [sharedLoading, setSharedLoading]   = useState(false)
  const [sharingId, setSharingId]           = useState(null)
  const [viewingShared, setViewingShared]   = useState(null) // táctica ajena, solo lectura

  useEffect(() => { if (user && profile) loadTeams() }, [user, profile])

  async function loadTeams() {
    setLoading(true)
    let t = []
    if (profile?.role === 'director') {
      const { data } = await supabase.from('teams').select('*').eq('active', true).order('name')
      t = data || []
    } else {
      const { data: tc } = await supabase.from('team_coaches').select('team_id').eq('coach_id', user.id)
      const ids = (tc || []).map(r => r.team_id)
      if (ids.length > 0) {
        const { data } = await supabase.from('teams').select('*').in('id', ids).eq('active', true).order('name')
        t = data || []
      }
    }
    setTeams(t)
    if (t.length > 0) { setSelectedTeam(t[0].id); await loadTactics(t[0].id) }
    setLoading(false)
  }

  async function loadTactics(teamId) {
    const { data } = await supabase.from('tactics').select('*').eq('team_id', teamId).order('created_at', { ascending: false })
    setTactics(data || [])
  }

  async function loadSharedTactics() {
    setSharedLoading(true)
    // Buscamos en todos los equipos activos del club, no solo el mío
    const { data: allTeams } = await supabase.from('teams').select('id').eq('active', true)
    const teamIds = (allTeams || []).map(t => t.id)
    if (teamIds.length === 0) { setSharedTactics([]); setSharedLoading(false); return }

    const { data } = await supabase
      .from('tactics')
      .select('*, teams(name)')
      .eq('shared', true)
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })

    const list = data || []
    setSharedTactics(list)

    const creatorIds = [...new Set(list.map(t => t.created_by).filter(Boolean))]
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
      const map = {}
      for (const p of (profs || [])) map[p.id] = p.full_name || 'Entrenador'
      setSharedProfiles(map)
    }
    setSharedLoading(false)
  }

  async function handleSelectTeam(id) {
    setSelectedTeam(id); setTactics([])
    await loadTactics(id)
  }

  async function handleSave({ title, description, steps }) {
    if (!selectedTeam) return
    setSaving(true)
    const payload = { team_id: selectedTeam, title: title || 'Jugada sin nombre', description, play_data: { steps }, created_by: user.id }
    if (editingTactic?.id) await supabase.from('tactics').update(payload).eq('id', editingTactic.id)
    else await supabase.from('tactics').insert(payload)
    setSaving(false)
    setOpenEditor(false)
    setEditingTactic(null)
    await loadTactics(selectedTeam)
  }

  async function deleteTactic(id) {
    if (!confirm('¿Eliminar esta táctica?')) return
    await supabase.from('tactics').delete().eq('id', id)
    setTactics(t => t.filter(x => x.id !== id))
  }

  async function handleToggleShared(tactic, e) {
    e?.stopPropagation()
    const newShared = !tactic.shared
    setSharingId(tactic.id)
    await supabase.from('tactics').update({ shared: newShared }).eq('id', tactic.id)
    setTactics(prev => prev.map(t => t.id === tactic.id ? { ...t, shared: newShared } : t))
    setSharingId(null)
    if (tab === 'compartidas') await loadSharedTactics()
  }

  // Editor a pantalla completa: crear/editar táctica propia
  if (openEditor) {
    const initData = editingTactic
      ? { title: editingTactic.title, description: editingTactic.description || '', steps: editingTactic.play_data?.steps || [] }
      : null
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            initialData={initData}
            onSave={handleSave}
            onClose={() => { setOpenEditor(false); setEditingTactic(null) }}
          />
        </div>
      </ModalPortal>
    )
  }

  // Visor a pantalla completa: táctica compartida por otro entrenador, solo lectura
  if (viewingShared) {
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            readOnly
            initialData={{
              title: viewingShared.title,
              description: viewingShared.description || '',
              steps: viewingShared.play_data?.steps || [],
            }}
            onClose={() => setViewingShared(null)}
          />
        </div>
      </ModalPortal>
    )
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  const tabStyle = (t) => ({
    padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, transition: 'all 0.15s', border: 'none',
    background: tab === t ? 'linear-gradient(135deg,#1C5C2A,#52B043)' : '#f3f4f6',
    color: tab === t ? '#fff' : '#374151',
    boxShadow: tab === t ? '0 2px 8px rgba(28,92,42,0.30)' : 'none',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>Tácticas</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {tab === 'compartidas' ? 'Jugadas compartidas por todos los entrenadores' : 'Diseña jugadas y sistemas de juego'}
          </p>
        </div>
        {tab === 'mias' && (
          <button
            onClick={() => { setEditingTactic(null); setOpenEditor(true) }}
            disabled={!selectedTeam}
            style={{ background: 'linear-gradient(135deg,#1C5C2A,#52B043)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + Nueva jugada
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('mias')} style={tabStyle('mias')}>🏀 Mis tácticas</button>
        <button onClick={() => { setTab('compartidas'); loadSharedTactics() }} style={{
          ...tabStyle('compartidas'),
          background: tab === 'compartidas' ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f3f4f6',
          color: tab === 'compartidas' ? '#fff' : '#374151',
        }}>📤 Compartidas</button>
      </div>

      {/* Team selector — solo en "Mis tácticas" */}
      {tab === 'mias' && teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => handleSelectTeam(t.id)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
              background: selectedTeam === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam === t.id ? '#fff' : '#374151',
            }}>{t.name}</button>
          ))}
        </div>
      )}

      {/* ── PESTAÑA COMPARTIDAS ── */}
      {tab === 'compartidas' ? (
        sharedLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Cargando tácticas compartidas...</div>
          </div>
        ) : sharedTactics.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.55 }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sin tácticas compartidas todavía</div>
            <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
              Cuando un entrenador pulse <strong>«Compartir con el club»</strong> en una de sus jugadas, aparecerá aquí para que todos puedan verla.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sharedTactics.map(tac => {
              const authorName = sharedProfiles[tac.created_by] || 'Entrenador'
              const teamName   = tac.teams?.name || ''
              const isOwn      = tac.created_by === user?.id
              const stepCount  = tac.play_data?.steps?.length || 0
              return (
                <div key={tac.id} onClick={() => setViewingShared(tac)} style={{
                  backgroundColor: '#fff', borderRadius: 14, padding: '14px 16px',
                  border: '1px solid #ede9fe', boxShadow: '0 1px 4px rgba(124,58,237,0.06)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(124,58,237,0.06)'}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏀</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{tac.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {teamName && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1C5C2A', backgroundColor: '#f0fdf4', padding: '2px 7px', borderRadius: 5 }}>🏀 {teamName}</span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 7px', borderRadius: 5 }}>
                        {isOwn ? '👤 Tú' : `👤 ${authorName}`}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{stepCount} {stepCount === 1 ? 'fase' : 'fases'}</span>
                    </div>
                  </div>
                  <span style={{ color: '#7c3aed', fontSize: 18, flexShrink: 0 }}>→</span>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <>
          {teams.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏀</div>
              <div style={{ fontSize: 14 }}>No tienes equipos asignados</div>
            </div>
          )}

          {teams.length > 0 && tactics.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin jugadas todavía</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Diseña tu primera jugada con el editor visual</div>
              <button onClick={() => { setEditingTactic(null); setOpenEditor(true) }}
                style={{ background: 'linear-gradient(135deg,#1C5C2A,#52B043)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                + Crear jugada
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tactics.map(tac => {
              const stepCount = tac.play_data?.steps?.length || 0
              return (
                <div key={tac.id} style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#1C5C2A,#52B043)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏀</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{tac.title}</div>
                        {tac.shared && (
                          <span title="Compartido con el club" style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 7px', borderRadius: 5 }}>📤 Compartida</span>
                        )}
                      </div>
                      {tac.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{tac.description}</div>}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                        {stepCount} {stepCount === 1 ? 'fase' : 'fases'} · {new Date(tac.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={e => handleToggleShared(tac, e)}
                        disabled={sharingId === tac.id}
                        title={tac.shared ? 'Dejar de compartir' : 'Compartir con el club'}
                        style={{
                          padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          border: tac.shared ? 'none' : '1.5px solid #ddd6fe',
                          background: tac.shared ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f5f3ff',
                          color: tac.shared ? '#fff' : '#7c3aed',
                          opacity: sharingId === tac.id ? 0.6 : 1,
                        }}>
                        📤
                      </button>
                      <button onClick={() => { setEditingTactic(tac); setOpenEditor(true) }}
                        style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => deleteTactic(tac.id)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
