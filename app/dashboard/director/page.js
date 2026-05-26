'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

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

  if (!profile) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: 22, fontWeight: 900, margin: '0 0 3px' }}>Panel Director</h1>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            {overview
              ? `${overview.teamsCount} equipos · ${overview.coachesCount} entrenadores · ${overview.playersCount} jugadores`
              : 'Cargando...'}
          </p>
        </div>
        {tab === 'equipos' && (
          <button onClick={openNew} style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
            fontSize: 13, fontWeight: 700,
          }}>+ Nuevo equipo</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ key: 'resumen', label: '📊 Resumen' }, { key: 'equipos', label: '👥 Equipos' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            backgroundColor: tab === t.key ? '#1C5C2A' : '#f3f4f6',
            color: tab === t.key ? '#fff' : '#6b7280',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        loadingOverview ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
        ) : overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Equipos',          value: overview.teamsCount,   emoji: '🏆', color: '#1C5C2A', bg: '#f0fdf4' },
                { label: 'Entrenadores',     value: overview.coachesCount, emoji: '👤', color: '#2563eb', bg: '#eff6ff' },
                { label: 'Jugadores activos',value: overview.playersCount, emoji: '🏀', color: '#7c3aed', bg: '#f5f3ff' },
              ].map(card => (
                <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{card.emoji}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Asistencia */}
            {overview.attSummary.length > 0 && (
              <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', fontWeight: 800, fontSize: 14, color: '#111827' }}>
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
            <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', fontWeight: 800, fontSize: 14, color: '#111827' }}>
                ⚠️ Incidencias recientes
              </div>
              {overview.incidents.length === 0 ? (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No hay incidencias registradas</div>
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
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏀</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No hay equipos todavía</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teams.map(team => {
              const isOpen     = expandedTeam === team.id
              const detail     = teamDetail[team.id]
              const isLoading  = loadingDetail === team.id
              return (
                <div key={team.id} style={{
                  backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
                  border: `1px solid ${isOpen ? '#d1f0d1' : '#f3f4f6'}`,
                  boxShadow: isOpen ? '0 2px 12px rgba(82,176,67,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  {/* Cabecera clicable */}
                  <div onClick={() => toggleTeamDetail(team.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg,#52B043,#1C5C2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>🏀</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{team.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{team.category} · {team.gender === 'femenino' ? 'Femenino' : 'Masculino'} · {team.season}</div>
                        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {team.coaches?.length > 0
                            ? team.coaches.map(tc => (
                              <span key={tc.coach_id} style={{ fontSize: 11, fontWeight: 600, color: '#1C5C2A', backgroundColor: '#f0fdf4', padding: '2px 7px', borderRadius: 5 }}>
                                👤 {tc.profiles?.full_name}
                              </span>
                            ))
                            : <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠️ Sin entrenador asignado</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={e => openEdit(team, e)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Gestionar</button>
                      <button onClick={e => handleDelete(team.id, e)} disabled={deleting === team.id} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                      <span style={{ fontSize: 18, color: '#9ca3af', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px 20px', backgroundColor: '#fafafa' }}>
                      {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: 13 }}>Cargando datos...</div>
                      ) : detail ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Stats rápidas */}
                          <div style={{ display: 'flex', gap: 10 }}>
                            {[
                              { label: 'Jugadores', value: detail.players.length, color: '#111827' },
                              { label: 'Asistencia 30d', value: detail.attPct !== null ? `${detail.attPct}%` : '—', color: detail.attPct !== null ? (detail.attPct >= 80 ? '#16a34a' : detail.attPct >= 60 ? '#d97706' : '#ef4444') : '#9ca3af' },
                              { label: 'Incid. activas', value: detail.incidents.length, color: detail.incidents.length > 0 ? '#ef4444' : '#16a34a' },
                            ].map(s => (
                              <div key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #f3f4f6', textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
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

      {/* ── MODAL GESTIONAR ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', margin: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>{editing ? 'Gestionar equipo' : 'Nuevo equipo'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nombre</label>
                <input type='text' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder='Ej: Cadete A'
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#52B043'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Categoría</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Género</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box' }}>
                    <option value='masculino'>Masculino</option>
                    <option value='femenino'>Femenino</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Temporada</label>
                <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none', boxSizing: 'border-box' }}>
                  {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {!editing && (
                <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1px solid #d1fae5', fontSize: 13, color: '#166534' }}>
                  💡 Guarda el equipo primero y luego edítalo para asignar entrenadores
                </div>
              )}

              {editing && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Entrenadores asignados</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {teamCoaches.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Ninguno asignado todavía</div>}
                    {teamCoaches.map(tc => (
                      <div key={tc.coach_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #d1fae5' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1C5C2A' }}>👤 {tc.profiles?.full_name}</span>
                        <button type='button' onClick={() => handleRemoveCoach(tc.coach_id)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Quitar</button>
                      </div>
                    ))}
                  </div>
                  {availableCoaches.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={addingCoach} onChange={e => setAddingCoach(e.target.value)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13, border: '1.5px solid #e5e7eb', color: '#111827', outline: 'none' }}>
                        <option value=''>— Selecciona entrenador —</option>
                        {availableCoaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <button type='button' onClick={handleAddCoach} disabled={!addingCoach}
                        style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: addingCoach ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#e5e7eb', color: addingCoach ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 700, cursor: addingCoach ? 'pointer' : 'not-allowed' }}>
                        Añadir
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 12px', borderRadius: 8, backgroundColor: '#f9fafb' }}>Todos los entrenadores ya están asignados</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
