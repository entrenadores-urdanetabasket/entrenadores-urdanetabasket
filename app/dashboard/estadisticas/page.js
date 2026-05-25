'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABEL = {
  pending:  { label: 'Pendiente', color: '#6b7280', bg: '#f3f4f6' },
  live:     { label: '🔴 EN VIVO', color: '#fff',    bg: '#ef4444' },
  finished: { label: 'Finalizado', color: '#fff',   bg: '#16a34a' },
}

const TYPE_LABEL = {
  liga:      'Liga',
  copa:      'Copa',
  amistoso:  'Amistoso',
  torneo:    'Torneo',
  otro:      'Otro',
}

export default function EstadisticasPage() {
  const { user, profile, supabase, activeTeam } = useAuth()
  const router = useRouter()

  const [games, setGames]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [teamName, setTeamName]   = useState('')
  const [deleting, setDeleting]   = useState(null) // game id being deleted

  useEffect(() => {
    if (user && activeTeam) loadGames()
    else if (user && activeTeam === null && profile?.role !== 'coach') setLoading(false)
  }, [user, activeTeam])

  async function loadGames() {
    if (!activeTeam) { setLoading(false); return }
    setLoading(true)
    setTeamName(activeTeam.name)
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('team_id', activeTeam.id)
      .order('date', { ascending: false })
    setGames(data || [])
    setLoading(false)
  }

  async function deleteGame(gameId, e) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este partido? Se borrarán también todos sus eventos y estadísticas. Esta acción no se puede deshacer.')) return
    setDeleting(gameId)
    // Borrar en orden: eventos → jugadores del partido → partido
    await supabase.from('game_events').delete().eq('game_id', gameId)
    await supabase.from('game_players').delete().eq('game_id', gameId)
    await supabase.from('games').delete().eq('id', gameId)
    setGames(prev => prev.filter(g => g.id !== gameId))
    setDeleting(null)
  }

  const filtered = filter === 'all' ? games : games.filter(g => g.status === filter)

  const liveCount = games.filter(g => g.status === 'live').length

  const tabs = [
    { key: 'all',      label: 'Todos',       count: games.length },
    { key: 'live',     label: '🔴 En Vivo',  count: liveCount },
    { key: 'finished', label: 'Finalizados', count: games.filter(g => g.status === 'finished').length },
    { key: 'pending',  label: 'Pendientes',  count: games.filter(g => g.status === 'pending').length },
  ]

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>Estadísticas</h1>
          {teamName && <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>{teamName}</div>}
        </div>
        <Link href="/dashboard/estadisticas/nuevo" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          padding: '9px 16px', borderRadius: 10, textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(82,176,67,0.35)'
        }}>
          + Nuevo partido
        </Link>
      </div>

      {/* Tabs filtro */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s',
            backgroundColor: filter === t.key ? '#1C5C2A' : '#f3f4f6',
            color: filter === t.key ? '#fff' : '#6b7280',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, minWidth: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: filter === t.key ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
                color: filter === t.key ? '#fff' : '#6b7280',
                borderRadius: 8, padding: '0 4px'
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏀</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {filter === 'all' ? 'No hay partidos registrados' : `No hay partidos ${filter === 'live' ? 'en vivo' : filter === 'finished' ? 'finalizados' : 'pendientes'}`}
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
            {filter === 'all' ? 'Crea el primer partido para empezar a registrar estadísticas' : ''}
          </div>
          {filter === 'all' && (
            <Link href="/dashboard/estadisticas/nuevo" style={{
              display: 'inline-block', background: 'linear-gradient(135deg,#1C5C2A,#52B043)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              padding: '9px 20px', borderRadius: 10, textDecoration: 'none'
            }}>
              + Crear partido
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(game => {
            const st = STATUS_LABEL[game.status] || STATUS_LABEL.pending
            const dateStr = game.date
              ? new Date(game.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : '—'
            const isLive = game.status === 'live'
            return (
              <Link key={game.id} href={`/live/${game.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: '#fff', borderRadius: 14, border: `1px solid ${isLive ? '#fca5a5' : '#f3f4f6'}`,
                  padding: '14px 18px', boxShadow: isLive ? '0 2px 12px rgba(239,68,68,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.15s', position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          backgroundColor: st.bg, color: st.color
                        }}>{st.label}</span>
                        {game.game_type && (
                          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                            {TYPE_LABEL[game.game_type] || game.game_type}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 3 }}>
                        vs {game.rival_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {dateStr}{game.location ? ` · ${game.location}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                      {game.status !== 'pending' && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>
                            {game.our_score ?? 0} – {game.rival_score ?? 0}
                          </div>
                          {isLive && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textAlign: 'center' }}>EN VIVO</div>
                          )}
                        </div>
                      )}
                      {/* Botón eliminar */}
                      <button
                        onClick={(e) => deleteGame(game.id, e)}
                        disabled={deleting === game.id}
                        style={{
                          width: 32, height: 32, borderRadius: 8, border: '1px solid #fee2e2',
                          backgroundColor: deleting === game.id ? '#f3f4f6' : '#fff',
                          color: deleting === game.id ? '#d1d5db' : '#ef4444',
                          cursor: deleting === game.id ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, flexShrink: 0, transition: 'background 0.1s',
                        }}
                        title="Eliminar partido"
                      >
                        {deleting === game.id ? '…' : '🗑'}
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
