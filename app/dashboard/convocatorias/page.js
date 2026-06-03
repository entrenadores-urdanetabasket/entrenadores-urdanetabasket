'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

function ConvocatoriaCard({ c, isDirector, onDelete, isPast }) {
  const count = c.convocatoria_players?.length || 0
  const dateStr = new Date(c.date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short'
  })

  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 16, padding: '14px 16px',
      border: `1.5px solid ${isPast ? '#e8edf3' : '#bbf7d0'}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      opacity: isPast ? 0.78 : 1, transition: 'all 0.2s'
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 13, flexShrink: 0,
          background: isPast
            ? 'linear-gradient(135deg,#94a3b8,#64748b)'
            : 'linear-gradient(135deg,#52B043,#1C5C2A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 23, boxShadow: isPast ? 'none' : '0 2px 8px rgba(28,92,42,0.25)'
        }}>🏀</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: -0.2 }}>vs {c.rival}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, fontWeight: 500, textTransform: 'capitalize' }}>
            {dateStr}{c.time ? ` · ${c.time}h` : ''}{c.location ? ` · ${c.location}` : ''}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 9px', borderRadius: 20 }}>
            👥 {count} convocados
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
        <Link href={`/dashboard/convocatorias/${c.id}`} style={{
          padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0',
          backgroundColor: '#fff', color: '#334155', fontSize: 12, fontWeight: 700,
          textDecoration: 'none'
        }}>Ver</Link>
        {!isDirector && (
          <button onClick={() => onDelete(c.id)} style={{
            padding: '7px 13px', borderRadius: 9, border: '1.5px solid #fecaca',
            backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 12,
            fontWeight: 700, cursor: 'pointer'
          }}>Eliminar</button>
        )}
      </div>
    </div>
  )
}

export default function ConvocatoriasPage() {
  const { user, profile, supabase, activeTeam, myTeams } = useAuth()
  const isDirector = profile?.role === 'director'

  const [convocatorias, setConvocatorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [allTeams, setAllTeams] = useState([])

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) return
    loadData()
  }, [user, profile, activeTeam])

  async function loadData() {
    setLoading(true)
    try {
      if (isDirector) {
        const { data: t } = await supabase.from('teams').select('*').order('name')
        const teamList = t || []
        setAllTeams(teamList)
        if (teamList.length > 0) {
          const team = selectedTeam || teamList[0]
          setSelectedTeam(team)
          await loadConvocatorias(team.id)
        } else {
          setLoading(false)
        }
      } else {
        setAllTeams(myTeams || [])
        setSelectedTeam(activeTeam)
        await loadConvocatorias(activeTeam.id)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  async function loadConvocatorias(teamId) {
    try {
      const { data } = await supabase
        .from('convocatorias')
        .select('*, convocatoria_players(player_id)')
        .eq('team_id', teamId)
        .order('date', { ascending: false })
      setConvocatorias(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function switchTeam(team) {
    setSelectedTeam(team)
    setLoading(true)
    await loadConvocatorias(team.id)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta convocatoria?')) return
    await supabase.from('convocatorias').delete().eq('id', id)
    loadConvocatorias(selectedTeam.id)
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = convocatorias.filter(c => c.date >= today)
  const past = convocatorias.filter(c => c.date < today)

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  return (
    <div className="fade-in">
      {/* Header — banner verde */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {selectedTeam?.name || 'Lista de citados'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Convocatorias</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {convocatorias.length} {convocatorias.length === 1 ? 'convocatoria' : 'convocatorias'}
          </p>
        </div>
        {!isDirector
          ? <Link href="/dashboard/convocatorias/nueva" className="btn-primary" style={{ flexShrink: 0, textDecoration: 'none' }}>+ Nueva</Link>
          : <div style={{ fontSize: 48, opacity: 0.35 }}>📋</div>}
      </div>

      {/* Selector equipos (director) */}
      {isDirector && allTeams.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {allTeams.map(t => {
            const active = selectedTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => switchTeam(t)} style={{
                padding: '8px 16px', borderRadius: 20,
                cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: active ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
                color: active ? '#fff' : '#475569',
                border: active ? 'none' : '1.5px solid #e2e8f0',
                boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none',
                transition: 'all 0.15s'
              }}>{t.name}</button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {convocatorias.length === 0 && (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <div className="empty-state-icon" style={{ fontSize: 52 }}>📋</div>
          <h2 className="empty-state-title" style={{ fontSize: 18, fontWeight: 800 }}>
            Sin convocatorias
          </h2>
          <p className="empty-state-text" style={{ fontSize: 14, marginBottom: 24 }}>
            {isDirector ? 'Este equipo no tiene convocatorias todavía' : 'Crea la primera convocatoria para este equipo'}
          </p>
          {!isDirector && (
            <Link href="/dashboard/convocatorias/nueva" className="btn-primary" style={{ textDecoration: 'none' }}>+ Nueva convocatoria</Link>
          )}
        </div>
      )}

      {/* Próximas */}
      {upcoming.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 800, color: '#94a3b8',
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10
          }}>Próximas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {upcoming.map(c => (
              <ConvocatoriaCard key={c.id} c={c} isDirector={isDirector} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}

      {/* Anteriores */}
      {past.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 800, color: '#94a3b8',
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10
          }}>Anteriores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map(c => (
              <ConvocatoriaCard key={c.id} c={c} isDirector={isDirector} onDelete={handleDelete} isPast />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
