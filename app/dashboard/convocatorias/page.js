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
      backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px',
      border: `1.5px solid ${isPast ? '#f3f4f6' : '#d1f0d1'}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      opacity: isPast ? 0.72 : 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 10, flexShrink: 0,
          background: isPast
            ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
            : 'linear-gradient(135deg,#52B043,#1C5C2A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22
        }}>🏀</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>vs {c.rival}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {dateStr}{c.time ? ` · ${c.time}h` : ''}{c.location ? ` · ${c.location}` : ''}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#52B043', marginTop: 4 }}>
            👥 {count} convocados
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Link href={`/dashboard/convocatorias/${c.id}`} style={{
          padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
          backgroundColor: '#fff', color: '#374151', fontSize: 12, fontWeight: 600,
          textDecoration: 'none'
        }}>Ver</Link>
        {!isDirector && (
          <button onClick={() => onDelete(c.id)} style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca',
            backgroundColor: '#fef2f2', color: '#ef4444', fontSize: 12,
            fontWeight: 600, cursor: 'pointer'
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

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>
            Convocatorias
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            {isDirector ? selectedTeam?.name : `${selectedTeam?.name || ''} · ${convocatorias.length} convocatorias`}
          </p>
        </div>
        {!isDirector && (
          <Link href="/dashboard/convocatorias/nueva" style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#52B043,#3a8a2e)', color: '#fff',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(82,176,67,0.3)'
          }}>+ Nueva</Link>
        )}
      </div>

      {/* Selector equipos (director) */}
      {isDirector && allTeams.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {allTeams.map(t => (
            <button key={t.id} onClick={() => switchTeam(t)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: selectedTeam?.id === t.id ? '#1C5C2A' : '#f3f4f6',
              color: selectedTeam?.id === t.id ? '#fff' : '#374151',
              transition: 'all 0.15s'
            }}>{t.name}</button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {convocatorias.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>📋</div>
          <h2 style={{ color: '#111827', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            Sin convocatorias
          </h2>
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>
            {isDirector ? 'Este equipo no tiene convocatorias todavía' : 'Crea la primera convocatoria para este equipo'}
          </p>
          {!isDirector && (
            <Link href="/dashboard/convocatorias/nueva" style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'linear-gradient(135deg,#52B043,#3a8a2e)',
              color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(82,176,67,0.25)'
            }}>+ Nueva convocatoria</Link>
          )}
        </div>
      )}

      {/* Próximas */}
      {upcoming.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9ca3af',
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
            fontSize: 11, fontWeight: 700, color: '#9ca3af',
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
