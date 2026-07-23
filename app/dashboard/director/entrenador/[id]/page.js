'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ModalPortal from '@/components/ModalPortal'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

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

function fmtRelative(iso, fallback = 'Nunca') {
  if (!iso) return fallback
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

function fmtMinutes(mins) {
  if (!mins || mins <= 0) return '0 min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
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
  const [detailTraining, setDetailTraining] = useState(null)
  const [detailTactic, setDetailTactic]     = useState(null)

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

  const { profile: coach, lastSignInAt, teams, trainings, tactics, incidents, convocatorias, games, attendanceSummary, attendanceSessions, usage } = data
  const maxDayMinutes = Math.max(1, ...usage.last30Days.map(d => d.minutes))

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

      {/* Tiempo de uso */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>⏱ Tiempo de uso de la web</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, backgroundColor: '#eef2f7' }}>
          <div style={{ backgroundColor: '#fff', padding: '16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{fmtMinutes(usage.totalMinutes)}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Tiempo total registrado</div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{usage.daysActiveLast30} / 30</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Días activo (últimos 30)</div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{fmtRelative(usage.lastActivityAt, 'Sin actividad registrada')}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Última actividad</div>
          </div>
        </div>

        {/* Tendencia últimos 30 días */}
        <div style={{ padding: '16px 18px', borderTop: '1px solid #eef2f7' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Actividad diaria (30 días)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
            {usage.last30Days.map(d => (
              <div key={d.date} title={`${d.date}: ${fmtMinutes(d.minutes)}`} style={{
                flex: 1, height: `${Math.max(3, (d.minutes / maxDayMinutes) * 100)}%`,
                backgroundColor: d.minutes > 0 ? '#52B043' : '#eef2f7', borderRadius: 2, minWidth: 2,
              }} />
            ))}
          </div>
        </div>

        {/* Desglose por sección */}
        <div style={{ padding: '4px 18px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, margin: '10px 0' }}>Tiempo por sección</div>
          {usage.bySection.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>Sin actividad registrada todavía</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {usage.bySection.map(s => (
                <div key={s.section} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{s.label}</div>
                  <div style={{ flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (s.minutes / usage.bySection[0].minutes) * 100)}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>{fmtMinutes(s.minutes)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', padding: '0 18px 14px' }}>
          Estimado a partir de la actividad con la pestaña abierta y visible (no cuenta el tiempo con la pestaña en segundo plano o el navegador cerrado).
        </p>
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

      {/* Sesiones de asistencia individuales */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>✅ Asistencia — sesiones registradas</div>
        {attendanceSessions.length === 0 ? <div style={emptyRow}>Sin sesiones de asistencia registradas</div> : attendanceSessions.map(s => (
          <div key={`${s.team_id}-${s.date}-${s.type}`} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.type === 'game' ? '🏆 Partido' : '🏋️ Entrenamiento'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.team_name} · {s.present}/{s.total} presentes</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(s.date)}</span>
          </div>
        ))}
      </div>

      {/* Entrenamientos */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>📝 Entrenamientos creados</div>
        {trainings.length === 0 ? <div style={emptyRow}>Sin entrenamientos registrados</div> : trainings.map(s => (
          <div key={s.id} style={{ ...row, cursor: 'pointer' }} onClick={() => setDetailTraining(s)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.title || 'Sin título'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.teams?.name || '—'} {s.exercises.length > 0 ? `· ${s.exercises.length} ejercicios` : ''}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(s.date)}</span>
            <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>

      {/* Tácticas */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>🏀 Tácticas / jugadas diseñadas</div>
        {tactics.length === 0 ? <div style={emptyRow}>Sin tácticas registradas</div> : tactics.map(t => (
          <div key={t.id} style={{ ...row, cursor: 'pointer' }} onClick={() => setDetailTactic(t)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.title || 'Jugada sin nombre'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.teams?.name || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(t.created_at?.slice(0,10))}</span>
            <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
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
          <Link key={c.id} href={`/dashboard/convocatorias/${c.id}`} style={{ ...row, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>vs {c.rival}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.teams?.name || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(c.date)}</span>
            <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
          </Link>
        ))}
      </div>

      {/* Partidos / estadísticas */}
      <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={sectionTitle}>📊 Partidos con estadísticas</div>
        {games.length === 0 ? <div style={emptyRow}>Sin partidos registrados</div> : games.map(g => (
          <Link key={g.id} href={`/live/${g.id}`} style={{ ...row, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                vs {g.rival_name} {g.status === 'finished' ? `· ${g.our_score}-${g.rival_score}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{g.teams?.name || '—'} · {g.status === 'finished' ? 'Finalizado' : g.status === 'live' ? 'En directo' : 'Pendiente'}</div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(g.date)}</span>
            <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
          </Link>
        ))}
      </div>

      {/* ── MODAL DETALLE ENTRENAMIENTO ── */}
      {detailTraining && (
        <ModalPortal>
        <div className="fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setDetailTraining(null) }}>
          <div className="scale-in" style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 70px rgba(0,0,0,0.22)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: -0.3 }}>{detailTraining.title || 'Sin título'}</h2>
              <button onClick={() => setDetailTraining(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 18px' }}>
              {detailTraining.teams?.name || '—'} · {fmtDate(detailTraining.date)}{detailTraining.start_time ? ` · ${detailTraining.start_time.slice(0,5)}` : ''}{detailTraining.duration_minutes ? ` · ${detailTraining.duration_minutes} min` : ''}
            </p>
            {detailTraining.objectives && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Objetivos</div>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{detailTraining.objectives}</div>
              </div>
            )}
            {detailTraining.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Notas</div>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{detailTraining.notes}</div>
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Ejercicios {detailTraining.exercises.length > 0 ? `(${detailTraining.exercises.length})` : ''}
            </div>
            {detailTraining.exercises.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Sin ejercicios añadidos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailTraining.exercises.map(ex => (
                  <div key={ex.id} style={{ padding: '10px 12px', borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #eef2f7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{ex.title}</span>
                      {ex.duration_minutes && <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{ex.duration_minutes} min</span>}
                    </div>
                    {ex.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{ex.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── VISOR DE TÁCTICA (editor en modo solo lectura, a pantalla completa) ── */}
      {detailTactic && (
        <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            readOnly
            initialData={{
              title: detailTactic.title,
              description: detailTactic.description || '',
              steps: detailTactic.play_data?.steps || [],
            }}
            onClose={() => setDetailTactic(null)}
          />
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
