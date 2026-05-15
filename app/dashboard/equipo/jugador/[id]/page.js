'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [stats, setStats] = useState({ total: 0, attended: 0, absent: 0, late: 0, justified: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: p } = await supabase.from('players').select('*, teams(name, category, season)').eq('id', id).single()
    if (!p) { router.replace('/dashboard/equipo'); return }
    setPlayer(p)

    const { data: att } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('player_id', id)
      .order('date', { ascending: false })

    setRecords(att || [])
    const s = { total: 0, attended: 0, absent: 0, late: 0, justified: 0 }
    att?.forEach(r => {
      s.total++
      if (r.status === 'present' || r.status === 'late') s.attended++
      if (r.status === 'absent') s.absent++
      if (r.status === 'late') s.late++
      if (r.status === 'justified') s.justified++
    })
    setStats(s)
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
  if (!player) return null

  const pct = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : null

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

      {/* Resumen estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Asistencia', value: pct !== null ? `${pct}%` : '—', color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' },
          { label: 'Sesiones', value: stats.total, color: '#111827' },
          { label: 'Faltas', value: stats.absent, color: '#ef4444' },
          { label: 'Tardes', value: stats.late, color: '#d97706' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: '#fff', borderRadius: 14, padding: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {pct !== null && (
        <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #f3f4f6', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tasa de asistencia</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: pct >= 75 ? '#52B043' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      )}

      {/* Historial completo */}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Historial completo</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 14 }}>Sin registros todavía</div>
          </div>
        )}
        {records.map(r => {
          const { label, color, bg } = STATUS[r.status] || STATUS.present
          return (
            <div key={r.date} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#fff', borderRadius: 12, padding: '12px 16px',
              border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
                {new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color, backgroundColor: bg, padding: '4px 10px', borderRadius: 8 }}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
