'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'

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

  useEffect(() => { if (user && profile) loadTeams() }, [user, profile])

  async function loadTeams() {
    setLoading(true)
    let t = []
    if (profile?.role === 'director') {
      const { data } = await supabase.from('teams').select('*').order('name')
      t = data || []
    } else {
      const { data: tc } = await supabase.from('team_coaches').select('team_id').eq('coach_id', user.id)
      const ids = (tc || []).map(r => r.team_id)
      if (ids.length > 0) {
        const { data } = await supabase.from('teams').select('*').in('id', ids).order('name')
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

  // Full-screen editor
  if (openEditor) {
    const initData = editingTactic
      ? { title: editingTactic.title, description: editingTactic.description || '', steps: editingTactic.play_data?.steps || [] }
      : null
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        <CourtEditor
          initialData={initData}
          onSave={handleSave}
          onClose={() => { setOpenEditor(false); setEditingTactic(null) }}
        />
      </div>
    )
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>Tácticas</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Diseña jugadas y sistemas de juego</p>
        </div>
        <button
          onClick={() => { setEditingTactic(null); setOpenEditor(true) }}
          disabled={!selectedTeam}
          style={{ background: 'linear-gradient(135deg,#1C5C2A,#52B043)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          + Nueva jugada
        </button>
      </div>

      {/* Team selector */}
      {teams.length > 1 && (
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
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{tac.title}</div>
                  {tac.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{tac.description}</div>}
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                    {stepCount} {stepCount === 1 ? 'fase' : 'fases'} · {new Date(tac.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
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
    </div>
  )
}
