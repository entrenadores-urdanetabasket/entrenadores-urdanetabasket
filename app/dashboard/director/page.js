'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import ModalPortal from '@/components/ModalPortal'

const CATEGORIES = ['Premini', 'Mini', 'Infantil', 'Cadete', 'Junior', 'Senior', 'Femenino Senior', 'Femenino Junior']
const SEASONS = ['2024-2025', '2025-2026', '2026-2027']

const INCIDENT_COLORS = {
  lesion:     { label: 'Lesión',     color: '#ef4444', bg: '#fef2f2' },
  sancion:    { label: 'Sanción',    color: '#d97706', bg: '#fffbeb' },
  expulsion:  { label: 'Expulsión',  color: '#dc2626', bg: '#fff1f1' },
  conflicto:  { label: 'Conflicto',  color: '#7c3aed', bg: '#f5f3ff' },
  otro:       { label: 'Otro',       color: '#6b7280', bg: '#f9fafb' },
  disciplinary:{ label: 'Disciplin.', color: '#ef4444', bg: '#fef2f2' },
  medical:    { label: 'Médica',     color: '#f59e0b', bg: '#fffbeb' },
  administrative:{ label: 'Admin.',  color: '#3b82f6', bg: '#eff6ff' },
  other:      { label: 'Otro',       color: '#6b7280', bg: '#f9fafb' },
}

export default function DirectorPage() {
  const { profile, supabase } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState('resumen')

  // ── Resumen ────────────────────────────────────────────
  const [overview, setOverview]               = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  // ── Equipos ────────────────────────────────────────────
  const [teams, setTeams]           = useState([])
  const [coaches, setCoaches]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [teamDetail, setTeamDetail] = useState({})
  const [loadingDetail, setLoadingDetail] = useState(null)

  // Formulario
  // ── Entrenadores ───────────────────────────────────────────
  const [coachProfiles, setCoachProfiles]       = useState([])
  const [settingPasswordFor, setSettingPasswordFor] = useState(null) // { id, name }
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [settingPassword, setSettingPassword]   = useState(false)
  const [passwordSetFor, setPasswordSetFor]     = useState(new Set())
  const [passwordError, setPasswordError]       = useState('')

  const [editingCoach, setEditingCoach]     = useState(null) // { id }
  const [coachForm, setCoachForm]           = useState({ full_name: '', email: '', phone: '', coach_role: 'principal' })
  const [savingCoach, setSavingCoach]       = useState(false)
  const [coachError, setCoachError]         = useState('')
  const [deletingCoach, setDeletingCoach]   = useState(null)

  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState({ name: '', category: 'Senior', season: '2025-2026', gender: 'masculino' })
  const [teamCoaches, setTeamCoaches] = useState([])
  const [addingCoach, setAddingCoach] = useState('')
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(null)

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'director') { router.replace('/dashboard'); return }
    loadTeams()
    loadOverview()
    loadCoachProfiles()
  }, [profile])

  // ── RESUMEN ──────────────────────────────────────────────
  async function loadOverview() {
    setLoadingOverview(true)
    try {
      // Counts
      const [{ data: tList }, { data: cList }, { data: pList }] = await Promise.all([
        supabase.from('teams').select('id, name, category'),
        supabase.from('profiles').select('id').eq('role', 'coach'),
        supabase.from('players').select('id').eq('active', true),
      ])

      // Incidents (simple, no joins to avoid RLS issues)
      const { data: incList } = await supabase
        .from('incidents')
        .select('id, type, description, date, resolved, team_id, player_id')
        .order('date', { ascending: false })
        .limit(8)

      // Enrich incidents with team names
      const teamIds = (tList || []).map(t => t.id)
      const teamMap = Object.fromEntries((tList || []).map(t => [t.id, t.name]))

      // Attendance last 30 days
      let attSummary = []
      if (teamIds.length > 0) {
        const from = new Date(); from.setDate(from.getDate() - 30)
        const fromStr = from.toISOString().slice(0, 10)
        const { data: attData } = await supabase
          .from('attendance').select('team_id, status')
          .in('team_id', teamIds).gte('date', fromStr)
        const byTeam = {}
        ;(attData || []).forEach(a => {
          if (!byTeam[a.team_id]) byTeam[a.team_id] = { present: 0, total: 0 }
          byTeam[a.team_id].total++
          if (a.status === 'present' || a.status === 'late') byTeam[a.team_id].present++
        })
        attSummary = (tList || [])
          .map(t => ({ ...t, att: byTeam[t.id] || null }))
          .filter(t => t.att && t.att.total > 0)
          .sort((a, b) => (b.att.present / b.att.total) - (a.att.present / a.att.total))
      }

      setOverview({
        teamsCount:   (tList  || []).length,
        coachesCount: (cList  || []).length,
        playersCount: (pList  || []).length,
        incidents:    (incList || []).map(i => ({ ...i, teamName: teamMap[i.team_id] || '—' })),
        attSummary,
      })
    } catch (err) {
      console.error('loadOverview error:', err)
      setOverview({ teamsCount: 0, coachesCount: 0, playersCount: 0, incidents: [], attSummary: [] })
    } finally {
      setLoadingOverview(false)
    }
  }

  // ── ENTRENADORES ─────────────────────────────────────────
  async function loadCoachProfiles() {
    try {
      const { data: c } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, coach_role')
        .eq('role', 'coach')
        .order('full_name')
      const coachList = c || []
      if (coachList.length > 0) {
        const { data: tc } = await supabase
          .from('team_coaches')
          .select('coach_id, teams(name)')
        coachList.forEach(coach => {
          coach.teamNames = (tc || [])
            .filter(r => r.coach_id === coach.id)
            .map(r => r.teams?.name).filter(Boolean)
        })
      }
      setCoachProfiles(coachList)
    } catch (err) { console.error('loadCoachProfiles error:', err) }
  }

  async function handleSetPassword() {
    setPasswordError('')
    if (newPasswordInput.length < 6) { setPasswordError('Mínimo 6 caracteres'); return }
    setSettingPassword(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ coachId: settingPasswordFor.id, password: newPasswordInput })
      })
      const json = await res.json()
      if (!res.ok) { setPasswordError(json.error || 'Error al cambiar contraseña'); return }
      setPasswordSetFor(prev => new Set([...prev, settingPasswordFor.id]))
      setSettingPasswordFor(null)
      setNewPasswordInput('')
    } catch (err) {
      setPasswordError('Error de conexión')
    } finally {
      setSettingPassword(false)
    }
  }

  function openEditCoach(coach) {
    setEditingCoach({ id: coach.id })
    setCoachForm({ full_name: coach.full_name || '', email: coach.email || '', phone: coach.phone || '', coach_role: coach.coach_role || 'principal' })
    setCoachError('')
  }

  async function handleSaveCoach() {
    setCoachError('')
    if (!coachForm.full_name.trim()) { setCoachError('El nombre es obligatorio'); return }
    if (!coachForm.email.trim()) { setCoachError('El email es obligatorio'); return }
    setSavingCoach(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/update-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ coachId: editingCoach.id, ...coachForm })
      })
      const json = await res.json()
      if (!res.ok) { setCoachError(json.error || 'Error al guardar'); return }
      setEditingCoach(null)
      loadCoachProfiles()
    } catch (err) {
      setCoachError('Error de conexión')
    } finally {
      setSavingCoach(false)
    }
  }

  async function handleDeleteCoach(coach) {
    if (!confirm(`¿Eliminar a ${coach.full_name}? Esta acción no se puede deshacer.`)) return
    setDeletingCoach(coach.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/delete-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ coachId: coach.id })
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Error al eliminar'); return }
      loadCoachProfiles()
      loadOverview()
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setDeletingCoach(null)
    }
  }

  // ── EQUIPOS ──────────────────────────────────────────────
  async function loadTeams() {
    setLoading(true)
    try {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'coach').order('full_name'),
      ])
      const teamList  = t || []
      const coachList = c || []

      if (teamList.length > 0) {
        const { data: tc } = await supabase
          .from('team_coaches').select('team_id, coach_id, profiles(full_name)')
        teamList.forEach(team => {
          team.coaches = (tc || []).filter(r => r.team_id === team.id)
        })
      }
      setTeams(teamList)
      setCoaches(coachList)
    } catch (err) {
      console.error('loadTeams error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleTeamDetail(teamId) {
    if (expandedTeam === teamId) { setExpandedTeam(null); return }
    setExpandedTeam(teamId)
    if (teamDetail[teamId]) return
    setLoadingDetail(teamId)
    try {
      const from = new Date(); from.setDate(from.getDate() - 30)
      const fromStr = from.toISOString().slice(0, 10)
      const [{ data: players }, { data: incidents }, { data: attData }] = await Promise.all([
        supabase.from('players').select('id, full_name, number, position').eq('team_id', teamId).eq('active', true).order('number'),
        supabase.from('incidents').select('id, type, description, date, player_id').eq('team_id', teamId).eq('resolved', false).order('date', { ascending: false }).limit(5),
        supabase.from('attendance').select('status').eq('team_id', teamId).gte('date', fromStr),
      ])
      let attPct = null
      if (attData && attData.length > 0) {
        const ok = attData.filter(a => a.status === 'present' || a.status === 'late').length
        attPct = Math.round((ok / attData.length) * 100)
      }
      setTeamDetail(prev => ({ ...prev, [teamId]: { players: players || [], incidents: incidents || [], attPct } }))
    } catch (err) {
      console.error('toggleTeamDetail error:', err)
      setTeamDetail(prev => ({ ...prev, [teamId]: { players: [], incidents: [], attPct: null } }))
    } finally {
      setLoadingDetail(null)
    }
  }

  // Gestión
  async function openEdit(team, e) {
    e.stopPropagation()
    setEditing(team.id)
    setForm({ name: team.name, category: team.category || 'Senior', season: team.season || '2025-2026', gender: team.gender || 'masculino' })
    setTeamCoaches(team.coaches || [])
    setAddingCoach('')
    setShowForm(true)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', category: 'Senior', season: '2025-2026', gender: 'masculino' })
    setTeamCoaches([]); setAddingCoach(''); setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) {
        await supabase.from('teams').update({ name: form.name, category: form.category, season: form.season, gender: form.gender }).eq('id', editing)
      } else {
        await supabase.from('teams').insert({ name: form.name, category: form.category, season: form.season, gender: form.gender })
      }
    } finally { setSaving(false); setShowForm(false); loadTeams(); loadOverview() }
  }

  async function handleAddCoach() {
    if (!addingCoach || !editing) return
    if (teamCoaches.find(tc => tc.coach_id === addingCoach)) return
    await supabase.from('team_coaches').insert({ team_id: editing, coach_id: addingCoach })
    const coach = coaches.find(c => c.id === addingCoach)
    setTeamCoaches(prev => [...prev, { team_id: editing, coach_id: addingCoach, profiles: { full_name: coach?.full_name } }])
    setAddingCoach(''); loadTeams()
  }

  async function handleRemoveCoach(coachId) {
    await supabase.from('team_coaches').delete().eq('team_id', editing).eq('coach_id', coachId)
    setTeamCoaches(prev => prev.filter(tc => tc.coach_id !== coachId))
    loadTeams()
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este equipo?')) return
    setDeleting(id)
    await supabase.from('teams').delete().eq('id', id)
    setDeleting(null)
    if (expandedTeam === id) setExpandedTeam(null)
    loadTeams(); loadOverview()
  }

  const assignedCoachIds = new Set(teamCoaches.map(tc => tc.coach_id))
  const availableCoaches = coaches.filter(c => !assignedCoachIds.has(c.id))

  if (!profile) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Cabecera — banner verde */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            Club Deportivo Urdaneta
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Panel Director</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {overview
              ? `${overview.teamsCount} equipos · ${overview.coachesCount} entrenadores · ${overview.playersCount} jugadores`
              : 'Cargando...'}
          </p>
        </div>
        {tab === 'equipos'
          ? <button onClick={openNew} className="btn-primary" style={{ flexShrink: 0 }}>+ Nuevo equipo</button>
          : <div style={{ fontSize: 48, opacity: 0.35 }}>🛡️</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ key: 'resumen', label: '📊 Resumen' }, { key: 'equipos', label: '👥 Equipos' }, { key: 'entrenadores', label: '👤 Entrenadores' }].map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: active ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
              color: active ? '#fff' : '#475569',
              border: active ? 'none' : '1.5px solid #e2e8f0',
              boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none',
            }}>{t.label}</button>
          )
        })}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        loadingOverview ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
        ) : overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Equipos',          value: overview.teamsCount,   emoji: '🏆', color: '#1C5C2A', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Entrenadores',     value: overview.coachesCount, emoji: '👤', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                { label: 'Jugadores activos',value: overview.playersCount, emoji: '🏀', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
              ].map(card => (
                <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: 16, padding: '18px 18px', border: `1px solid ${card.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{card.emoji}</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: card.color, lineHeight: 1, letterSpacing: -2 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Asistencia */}
            {overview.attSummary.length > 0 && (
              <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                  ✅ Asistencia últimos 30 días
                </div>
                <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {overview.attSummary.map(t => {
                    const pct = t.att ? Math.round((t.att.present / t.att.total) * 100) : 0
                    const col = pct >= 80 ? '#52B043' : pct >= 60 ? '#f59e0b' : '#ef4444'
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.name}</div>
                        <div style={{ flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: col, borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 700, color: col, flexShrink: 0 }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Incidencias */}
            <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                ⚠️ Incidencias recientes
              </div>
              {overview.incidents.length === 0 ? (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>No hay incidencias registradas</div>
              ) : overview.incidents.map((inc, i) => {
                const it = INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.other
                const ds = inc.date ? new Date(inc.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'
                return (
                  <div key={inc.id} style={{ padding: '12px 18px', borderBottom: i < overview.incidents.length - 1 ? '1px solid #f9fafb' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, backgroundColor: it.bg, color: it.color, flexShrink: 0 }}>{it.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.description}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{inc.teamName}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{ds}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      )}

      {/* ── EQUIPOS ── */}
      {tab === 'equipos' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
        ) : teams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏀</div>
            <div className="empty-state-title">No hay equipos todavía</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teams.map(team => {
              const isOpen     = expandedTeam === team.id
              const detail     = teamDetail[team.id]
              const isLoading  = loadingDetail === team.id
              return (
                <div key={team.id} style={{
                  backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
                  border: `1px solid ${isOpen ? '#bbf7d0' : '#e8edf3'}`,
                  boxShadow: isOpen ? '0 4px 16px rgba(82,176,67,0.12)' : '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s'
                }}>
                  {/* Cabecera clicable */}
                  <div onClick={() => toggleTeamDetail(team.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 19, boxShadow: '0 2px 8px rgba(28,92,42,0.25)' }}>🏀</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: -0.2 }}>{team.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{team.category} · {team.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {team.season}</div>
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {team.coaches?.length > 0
                            ? team.coaches.map(tc => (
                              <span key={tc.coach_id} style={{ fontSize: 11, fontWeight: 700, color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 6 }}>
                                👤 {tc.profiles?.full_name}
                              </span>
                            ))
                            : <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700, backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 6 }}>⚠️ Sin entrenador asignado</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={e => openEdit(team, e)} style={{ padding: '7px 13px', borderRadius: 9, border: '1.5px solid #e2e8f0', backgroundColor: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Gestionar</button>
                      <button onClick={e => handleDelete(team.id, e)} disabled={deleting === team.id} style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                      <span style={{ fontSize: 18, color: '#94a3b8', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #eef2f7', padding: '16px 20px', backgroundColor: '#f8fafc' }}>
                      {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>Cargando datos...</div>
                      ) : detail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Stats rápidas */}
                          <div style={{ display: 'flex', gap: 10 }}>
                            {[
                              { label: 'Jugadores', value: detail.players.length, color: '#0f172a' },
                              { label: 'Asistencia 30d', value: detail.attPct !== null ? `${detail.attPct}%` : '—', color: detail.attPct !== null ? (detail.attPct >= 80 ? '#16a34a' : detail.attPct >= 60 ? '#d97706' : '#ef4444') : '#94a3b8' },
                              { label: 'Incid. activas', value: detail.incidents.length, color: detail.incidents.length > 0 ? '#ef4444' : '#16a34a' },
                            ].map(s => (
                              <div key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: '12px', border: '1px solid #e8edf3', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: 21, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Plantilla */}
                          {detail.players.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Plantilla</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {detail.players.map(p => (
                                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 8, padding: '5px 10px', border: '1px solid #f3f4f6' }}>
                                    <span style={{ width: 20, height: 20, borderRadius: 4, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 900, flexShrink: 0 }}>{p.number ?? '—'}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{p.full_name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Incidencias activas */}
                          {detail.incidents.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Incidencias activas</div>
                              {detail.incidents.map(inc => {
                                const it = INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.other
                                return (
                                  <div key={inc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 8, padding: '8px 12px', border: `1px solid #f3f4f6`, marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: it.bg, color: it.color, flexShrink: 0 }}>{it.label}</span>
                                    <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.description}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── ENTRENADORES ── */}
      {tab === 'entrenadores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {coachProfiles.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">No hay entrenadores registrados</div>
            </div>
          )}
          {coachProfiles.map(coach => (
            <div key={coach.id} style={{
              backgroundColor: '#fff', borderRadius: 16, padding: '16px 18px',
              border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              transition: 'all 0.2s'
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 900,
                  boxShadow: '0 2px 8px rgba(28,92,42,0.25)'
                }}>{coach.full_name?.charAt(0)?.toUpperCase() || 'E'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', letterSpacing: -0.2 }}>{coach.full_name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{coach.email}</div>
                  {coach.phone && <div style={{ fontSize: 12, color: '#94a3b8' }}>📞 {coach.phone}</div>}
                  {coach.teamNames?.length > 0 && (
                    <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, marginTop: 4 }}>
                      👥 {coach.teamNames.join(' · ')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => openEditCoach(coach)}
                  style={{
                    padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, backgroundColor: '#f8fafc', color: '#334155',
                  }}>
                  ✏️ Editar
                </button>
                <button
                  onClick={() => { setSettingPasswordFor({ id: coach.id, name: coach.full_name }); setNewPasswordInput(''); setPasswordError('') }}
                  style={{
                    padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                    backgroundColor: passwordSetFor.has(coach.id) ? '#f0fdf4' : '#eff6ff',
                    color: passwordSetFor.has(coach.id) ? '#16a34a' : '#2563eb',
                  }}>
                  {passwordSetFor.has(coach.id) ? '✓ Contraseña cambiada' : '🔑 Cambiar contraseña'}
                </button>
                <button
                  onClick={() => handleDeleteCoach(coach)}
                  disabled={deletingCoach === coach.id}
                  style={{
                    width: 32, height: 32, borderRadius: 9, border: '1.5px solid #fecaca', backgroundColor: '#fef2f2',
                    color: '#ef4444', fontSize: 14, cursor: deletingCoach === coach.id ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deletingCoach === coach.id ? 0.5 : 1,
                  }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
            Al pulsar "Resetear contraseña" se envía un email al entrenador con un enlace para crear una nueva contraseña.
          </p>
        </div>
      )}

      {/* ── MODAL CONTRASEÑA ── */}
      {settingPasswordFor && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', letterSpacing: -0.3 }}>Cambiar contraseña</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>{settingPasswordFor.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label-field">Nueva contraseña</label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="input-field"
                />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>El entrenador podrá cambiarla después desde su perfil.</p>
              </div>
              {passwordError && (
                <div style={{ padding: '9px 12px', borderRadius: 9, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{passwordError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setSettingPasswordFor(null); setNewPasswordInput(''); setPasswordError('') }} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>Cancelar</button>
                <button onClick={handleSetPassword} disabled={settingPassword} className="btn-primary" style={{
                  flex: 1, padding: '12px',
                  ...(settingPassword ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {})
                }}>{settingPassword ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── MODAL EDITAR ENTRENADOR ── */}
      {editingCoach && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>Editar entrenador</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label-field">Nombre completo *</label>
                <input type="text" value={coachForm.full_name} onChange={e => setCoachForm(f => ({ ...f, full_name: e.target.value }))}
                  autoFocus className="input-field" />
              </div>
              <div>
                <label className="label-field">Email *</label>
                <input type="email" value={coachForm.email} onChange={e => setCoachForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field" />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Si lo cambias, el entrenador tendrá que iniciar sesión con el nuevo email.</p>
              </div>
              <div>
                <label className="label-field">Teléfono</label>
                <input type="tel" value={coachForm.phone} onChange={e => setCoachForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Ej: 600 123 456" className="input-field" />
              </div>
              <div>
                <label className="label-field">Rol en el equipo</label>
                <select value={coachForm.coach_role} onChange={e => setCoachForm(f => ({ ...f, coach_role: e.target.value }))}
                  className="input-field" style={{ cursor: 'pointer' }}>
                  <option value="principal">Entrenador principal</option>
                  <option value="ayudante">Entrenador ayudante</option>
                  <option value="preparador">Preparador físico</option>
                </select>
              </div>
              {coachError && (
                <div style={{ padding: '9px 12px', borderRadius: 9, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{coachError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditingCoach(null)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  backgroundColor: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>Cancelar</button>
                <button onClick={handleSaveCoach} disabled={savingCoach} className="btn-primary" style={{
                  flex: 1, padding: '12px',
                  ...(savingCoach ? { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' } : {})
                }}>{savingCoach ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── MODAL GESTIONAR ── */}
      {showForm && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', margin: 'auto' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: '0 0 20px', letterSpacing: -0.3 }}>{editing ? 'Gestionar equipo' : 'Nuevo equipo'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div>
                <label className="label-field">Nombre</label>
                <input type='text' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder='Ej: Cadete A' className="input-field" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-field">Categoría</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="input-field" style={{ cursor: 'pointer' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Género</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="input-field" style={{ cursor: 'pointer' }}>
                    <option value='masculino'>Masculino</option>
                    <option value='femenino'>Femenino</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-field">Temporada</label>
                <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                  className="input-field" style={{ cursor: 'pointer' }}>
                  {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {!editing && (
                <div style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#166534', fontWeight: 500 }}>
                  💡 Guarda el equipo primero y luego edítalo para asignar entrenadores
                </div>
              )}

              {editing && (
                <div>
                  <label className="label-field" style={{ marginBottom: 8 }}>Entrenadores asignados</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {teamCoaches.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>Ninguno asignado todavía</div>}
                    {teamCoaches.map(tc => (
                      <div key={tc.coach_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>👤 {tc.profiles?.full_name}</span>
                        <button type='button' onClick={() => handleRemoveCoach(tc.coach_id)} style={{ padding: '4px 11px', borderRadius: 7, border: '1.5px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Quitar</button>
                      </div>
                    ))}
                  </div>
                  {availableCoaches.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={addingCoach} onChange={e => setAddingCoach(e.target.value)}
                        className="input-field" style={{ flex: 1, cursor: 'pointer' }}>
                        <option value=''>— Selecciona entrenador —</option>
                        {availableCoaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <button type='button' onClick={handleAddCoach} disabled={!addingCoach}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: addingCoach ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#e2e8f0', color: addingCoach ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: addingCoach ? 'pointer' : 'not-allowed', boxShadow: addingCoach ? '0 2px 8px rgba(82,176,67,0.30)' : 'none' }}>
                        Añadir
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#94a3b8', padding: '9px 12px', borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #eef2f7' }}>Todos los entrenadores ya están asignados</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
    </div>
  )
}
