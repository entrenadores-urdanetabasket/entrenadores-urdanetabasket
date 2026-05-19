'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const TYPES = {
  lesion:    { label: 'Lesión',    emoji: '🤕', color: '#ef4444', bg: '#fef2f2' },
  sancion:   { label: 'Sanción',   emoji: '🟨', color: '#d97706', bg: '#fffbeb' },
  expulsion: { label: 'Expulsión', emoji: '🟥', color: '#dc2626', bg: '#fff1f1' },
  conflicto: { label: 'Conflicto', emoji: '⚡', color: '#7c3aed', bg: '#f5f3ff' },
  otro:      { label: 'Otros',     emoji: '📋', color: '#6b7280', bg: '#f9fafb' },
}

const STATUS = {
  present:   { label: 'Presente',    color: '#16a34a', bg: '#f0fdf4' },
  absent:    { label: 'Ausente',     color: '#ef4444', bg: '#fef2f2' },
  late:      { label: 'Tarde',       color: '#d97706', bg: '#fffbeb' },
  justified: { label: 'Justificado', color: '#6366f1', bg: '#eef2ff' },
}

export default function JugadorPage() {
  const { user, profile, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [player, setPlayer] = useState(null)
  const [records, setRecords] = useState([])
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState({ total: 0, attended: 0, absent: 0, late: 0, justified: 0, trainings: 0, trainingsAttended: 0, matches: 0, matchesAttended: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: p } = await supabase.from('players').select('*, teams(name, category, season)').eq('id', id).single()
    if (!p) { router.replace('/dashboard/equipo'); return }
    setPlayer(p)

    const [{ data: att }, { data: inc }] = await Promise.all([
      supabase.from('attendance').select('date, status, type').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('incidents').select('*').eq('player_id', id).order('date', { ascending: false })
    ])

    setRecords(att || [])
    setIncidents(inc || [])
    const s = { total: 0, attended: 0, absent: 0, late: 0, justified: 0, trainings: 0, trainingsAttended: 0, matches: 0, matchesAttended: 0 }
    att?.forEach(r => {
      const att  = r.status === 'present' || r.status === 'late'
      const isMt = r.type === 'match'
      s.total++
      if (att)                  s.attended++
      if (r.status === 'absent')    s.absent++
      if (r.status === 'late')      s.late++
      if (r.status === 'justified') s.justified++
      if (isMt) { s.matches++;   if (att) s.matchesAttended++ }
      else      { s.trainings++; if (att) s.trainingsAttended++ }
    })
    setStats(s)
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
  if (!player) return null

  const pct         = stats.total     > 0 ? Math.round((stats.attended          / stats.total)     * 100) : null
  const pctTraining = stats.trainings > 0 ? Math.round((stats.trainingsAttended / stats.trainings) * 100) : null
  const pctMatch    = stats.matches   > 0 ? Math.round((stats.matchesAttended   / stats.matches)   * 100) : null

  return (
    <div>
      <Link href='/dashboard/equipo' style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
        ← Volver al equipo
      </Link>

      {/* Cabecera jugador */}
      <div style={{
        borderRadius: 16, marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg,#1C5C2A 0%,#52B043 100%)',
        padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 14, flexShrink: 0,
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 24, fontWeight: 900
        }}>{player.number ?? '—'}</div>
        <div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{player.full_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
            {player.position || '—'} · {player.teams?.name} · {player.teams?.season}
            {player.birth_date && ` · ${new Date(player.birth_date).getFullYear()}`}
          </div>
        </div>
      </div>

      {/* Resumen estadísticas — fila superior */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Asistencia', value: pct !== null ? `${pct}%` : '—', color: pct !== null ? (pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444') : '#9ca3af' },
          { label: 'Sesiones',   value: stats.total,   color: '#111827' },
          { label: 'Faltas',     value: stats.absent,  color: '#ef4444' },
          { label: 'Tardes',     value: stats.late,    color: '#d97706' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: '#fff', borderRadius: 12, padding: '12px 8px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Barra general */}
      {pct !== null && (
        <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px', border: '1px solid #f3f4f6', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tasa global de asistencia</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' }}>{pct}%</span>
          </div>
          <div style={{ height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: pct >= 75 ? '#52B043' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      )}

      {/* Desglose Entrenamientos / Partidos */}
      {stats.total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {/* Entrenamientos */}
          <div style={{ backgroundColor: '#f0fdf4', borderRadius: 14, padding: '14px 16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🏋️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Entrenamientos</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#15803d', marginBottom: 2 }}>
              {pctTraining !== null ? `${pctTraining}%` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              {stats.trainingsAttended}/{stats.trainings} sesiones
            </div>
            {stats.trainings > 0 && (
              <div style={{ height: 6, backgroundColor: '#bbf7d0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctTraining}%`, borderRadius: 3, backgroundColor: '#16a34a' }} />
              </div>
            )}
          </div>

          {/* Partidos */}
          <div style={{ backgroundColor: '#eff6ff', borderRadius: 14, padding: '14px 16px', border: '1px solid #bfdbfe', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Partidos</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#1d4ed8', marginBottom: 2 }}>
              {pctMatch !== null ? `${pctMatch}%` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              {stats.matchesAttended}/{stats.matches} partidos
            </div>
            {stats.matches > 0 && (
              <div style={{ height: 6, backgroundColor: '#bfdbfe', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctMatch}%`, borderRadius: 3, backgroundColor: '#2563eb' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incidencias */}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
        Incidencias {incidents.filter(i => !i.resolved).length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>
            {incidents.filter(i => !i.resolved).length} activas
          </span>
        )}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 12, border: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 13 }}>Sin incidencias registradas</div>
          </div>
        ) : incidents.map(inc => {
          const t = TYPES[inc.type] || TYPES.otro
          return (
            <div key={inc.id} style={{
              backgroundColor: '#fff', borderRadius: 12, border: `1px solid ${t.bg}`,
              overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ backgroundColor: t.bg, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{t.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</span>
                  {!inc.resolved && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '1px 6px', borderRadius: 4 }}>ACTIVA</span>}
                  {inc.resolved && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '1px 6px', borderRadius: 4 }}>RESUELTA</span>}
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(inc.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{inc.description}</p>
                {inc.resolved && inc.resolved_note && (
                  <p style={{ fontSize: 12, color: '#16a34a', margin: '6px 0 0', fontStyle: 'italic' }}>↳ {inc.resolved_note}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Historial completo */}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Historial de asistencia</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 14 }}>Sin registros todavía</div>
          </div>
        )}
        {records.map(r => {
          const { label, color, bg } = STATUS[r.status] || STATUS.present
          const isMatch = r.type === 'match'
          return (
            <div key={r.date} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#fff', borderRadius: 12, padding: '12px 16px',
              border: `1px solid ${isMatch ? '#bfdbfe' : '#f3f4f6'}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, flexShrink: 0,
                  backgroundColor: isMatch ? '#dbeafe' : '#dcfce7',
                  color: isMatch ? '#1d4ed8' : '#15803d',
                }}>{isMatch ? '🏆' : '🏋️'}</span>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color, backgroundColor: bg, padding: '4px 10px', borderRadius: 8 }}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
