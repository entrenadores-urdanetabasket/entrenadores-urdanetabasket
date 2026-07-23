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
  const isDirector = profile?.role === 'director'

  const [games, setGames]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [teamName, setTeamName]   = useState('')
  const [deleting, setDeleting]   = useState(null) // game id being deleted
  const [allTeams, setAllTeams]         = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) { setLoading(false); return }
    loadData()
  }, [user, profile, activeTeam])

  async function loadData() {
    setLoading(true)
    if (isDirector) {
      const { data: t } = await supabase.from('teams').select('*').order('name')
      const teamList = t || []
      setAllTeams(teamList)
      if (teamList.length > 0) {
        const team = selectedTeam || teamList[0]
        setSelectedTeam(team)
        await loadGames(team)
      } else {
        setLoading(false)
      }
    } else {
      setSelectedTeam(activeTeam)
      await loadGames(activeTeam)
    }
  }

  function switchTeam(team) {
    setSelectedTeam(team)
    loadGames(team)
  }

  async function loadGames(team) {
    if (!team) { setLoading(false); return }
    setLoading(true)
    setTeamName(team.name)
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('team_id', team.id)
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
            {teamName || 'Análisis de partidos'}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Estadísticas</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {games.length} {games.length === 1 ? 'partido registrado' : 'partidos registrados'}
          </p>
        </div>
        {!isDirector && (
          <Link href="/dashboard/estadisticas/nuevo" className="btn-primary" style={{ flexShrink: 0, textDecoration: 'none' }}>
            + Nuevo partido
          </Link>
        )}
      </div>

      {/* Selector de equipo — solo director */}
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

      {/* Tabs filtro */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(t => {
          const active = filter === t.key
          return (
            <button key={t.key} onClick={() => setFilter(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 15px', borderRadius: 20, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: active ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
              color: active ? '#fff' : '#475569',
              border: active ? 'none' : '1.5px solid #e2e8f0',
              boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none',
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, minWidth: 17, height: 17,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#eef2f7',
                  color: active ? '#fff' : '#64748b',
                  borderRadius: 9, padding: '0 5px'
                }}>{t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>🏀</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            {filter === 'all' ? 'No hay partidos registrados' : `No hay partidos ${filter === 'live' ? 'en vivo' : filter === 'finished' ? 'finalizados' : 'pendientes'}`}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
            {filter === 'all' ? 'Crea el primer partido para empezar a registrar estadísticas' : ''}
          </div>
          {filter === 'all' && (
            <Link href="/dashboard/estadisticas/nuevo" className="btn-primary" style={{ textDecoration: 'none' }}>
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
                  backgroundColor: '#fff', borderRadius: 16, border: `1px solid ${isLive ? '#fca5a5' : '#e8edf3'}`,
                  padding: '14px 18px', boxShadow: isLive ? '0 4px 16px rgba(239,68,68,0.18)' : '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s', position: 'relative',
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = isLive ? '0 6px 22px rgba(239,68,68,0.24)' : '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = isLive ? '0 4px 16px rgba(239,68,68,0.18)' : '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 7,
                          backgroundColor: st.bg, color: st.color
                        }}>{st.label}</span>
                        {game.game_type && (
                          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                            {TYPE_LABEL[game.game_type] || game.game_type}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 3, letterSpacing: -0.2 }}>
                        vs {game.rival_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize' }}>
                        {dateStr}{game.location ? ` · ${game.location}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                      {game.status !== 'pending' && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 32, fontWeight: 900, color: '#0a1f0e', letterSpacing: -1.5 }}>
                            {game.our_score ?? 0} – {game.rival_score ?? 0}
                          </div>
                          {isLive && (
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textAlign: 'center', letterSpacing: 0.5 }}>EN VIVO</div>
                          )}
                        </div>
                      )}
                      {/* Botón eliminar */}
                      {!isDirector && (
                        <button
                          onClick={(e) => deleteGame(game.id, e)}
                          disabled={deleting === game.id}
                          style={{
                            width: 32, height: 32, borderRadius: 9, border: '1.5px solid #fee2e2',
                            backgroundColor: deleting === game.id ? '#f1f5f9' : '#fff',
                            color: deleting === game.id ? '#cbd5e1' : '#ef4444',
                            cursor: deleting === game.id ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, flexShrink: 0, transition: 'background 0.1s',
                          }}
                          title="Eliminar partido"
                        >
                          {deleting === game.id ? '…' : '🗑'}
                        </button>
                      )}
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
