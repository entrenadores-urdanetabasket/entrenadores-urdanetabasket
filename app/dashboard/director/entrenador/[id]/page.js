'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtRelative(iso) {
  if (!iso) return 'Nunca ha iniciado sesión'
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const days = Math.floor(diffMs / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  return `Hace ${years} ${years === 1 ? 'año' : 'años'}`
}

const card = { backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }
const sectionTitle = { padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }
const emptyRow = { padding: '20px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }
const row = { padding: '11px 18px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 10 }

export default function CoachActivityPage() {
  const { profile, supabase } = useAuth()
  const router = useRouter()
  const params = useParams()
  const coachId = params.id

  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'director') { router.replace('/dashboard'); return }
    loadActivity()
  }, [profile, coachId])

  async function loadActivity() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/coach-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ coachId })
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al cargar la actividad'); return }
      setData(json)
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!profile || loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
  if (error) return (
    <div>
      <Link href="/dashboard/director" style={{ fontSize: 13, color: '#52B043', fontWeight: 700, textDecoration: 'none' }}>← Volver</Link>
      <div style={{ ...card, padding: 24, marginTop: 16, textAlign: 'center', color: '#dc2626' }}>{error}</div>
    </div>
  )
  if (!data) return null

  const { profile: coach, lastSignInAt, teams, trainings, tactics, incidents, convocatorias, games, attendanceSummary } = data

  return (
    <div className="fade-in">
      <Link href="/dashboard/director" style={{ fontSize: 13, color: '#52B043', fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← Volver al panel</Link>

      {/* Cabecera */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 18,
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 26, fontWeight: 900,
        }}>{coach.full_name?.charAt(0)?.toUpperCase() || 'E'}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>{coach.full_name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '0 0 2px' }}>{coach.email}{coach.phone ? ` · 📞 ${coach.phone}` : ''}</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>
            Última conexión: {fmtRelative(lastSignInAt)}
          </p>
        </div>
      </div>

      {/* Equipos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {teams.length === 0 ? (
          <span style={{ fontSize: 12, color: '#d97706', fontWeight: 700, backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: 8 }}>⚠️ Sin equipo asignado</span>
        ) : teams.map(t => (
          <span key={t.id} style={{ fontSize: 12, fontWeight: 700, color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 8 }}>
            🏀 {t.name} · {t.category}
          </span>
        ))}
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Entrenamientos', value: trainings.length, emoji: '📝' },
          { label: 'Tácticas',       value: tactics.length,   emoji: '🏀' },
          { label: 'Incidencias',    value: incidents.length, emoji: '⚠️' },
          { label: 'Convocatorias',  value: convocatorias.length, emoji: '📋' },
          { label: 'Partidos',       value: games.length,     emoji: '📊' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Asistencia por equipo */}
      {attendanceSummary.length > 0 && (
        <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
          <div style={sectionTitle}>✅ Asistencia registrada (por equipo)</div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attendanceSummary.map(a => (
              <div key={a.team_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 130, fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{a.team_name}</div>
                <div style={{ flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${a.attendancePct ?? 0}%`, height: '100%', backgroundColor: '#52B043', borderRadius: 4 }} />
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{a.sessionsCount} sesiones</div>
                <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#52B043', flexShrink: 0 }}>{a.attendancePct !== null ? `${a.attendancePct}%` : '—'}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', padding: '0 18px 12px' }}>La asistencia se registra a nivel de equipo, no queda ligada a un entrenador concreto si el equipo tiene varios.</p>
        </div>
      )}

      {/* Entrenamientos */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>📝 Entrenamientos creados</div>
        {trainings.length === 0 ? <div style={emptyRow}>Sin entrenamientos registrados</div> : trainings.map(s => (
          <div key={s.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.title || 'Sin título'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.teams?.name || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(s.date)}</span>
          </div>
        ))}
      </div>

      {/* Tácticas */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>🏀 Tácticas / jugadas diseñadas</div>
        {tactics.length === 0 ? <div style={emptyRow}>Sin tácticas registradas</div> : tactics.map(t => (
          <div key={t.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.title || 'Jugada sin nombre'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.teams?.name || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(t.created_at?.slice(0,10))}</span>
          </div>
        ))}
      </div>

      {/* Incidencias */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>⚠️ Incidencias reportadas</div>
        {incidents.length === 0 ? <div style={emptyRow}>Sin incidencias reportadas</div> : incidents.map(inc => {
          const it = INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.other
          return (
            <div key={inc.id} style={row}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, backgroundColor: it.bg, color: it.color, flexShrink: 0 }}>{it.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.description}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{inc.teams?.name || '—'} {inc.resolved ? '· Resuelta' : '· Activa'}</div>
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(inc.date)}</span>
            </div>
          )
        })}
      </div>

      {/* Convocatorias */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>📋 Convocatorias creadas</div>
        {convocatorias.length === 0 ? <div style={emptyRow}>Sin convocatorias registradas</div> : convocatorias.map(c => (
          <div key={c.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>vs {c.rival}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.teams?.name || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(c.date)}</span>
          </div>
        ))}
      </div>

      {/* Partidos / estadísticas */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>📊 Partidos con estadísticas</div>
        {games.length === 0 ? <div style={emptyRow}>Sin partidos registrados</div> : games.map(g => (
          <div key={g.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                vs {g.rival_name} {g.status === 'finished' ? `· ${g.our_score}-${g.rival_score}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{g.teams?.name || '—'} · {g.status === 'finished' ? 'Finalizado' : g.status === 'live' ? 'En directo' : 'Pendiente'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(g.date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
