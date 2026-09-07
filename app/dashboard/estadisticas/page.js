'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TeamGroupPicker from '@/components/TeamGroupPicker'

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

// Diferencia de puntos partido a partido — una barra por partido, verde si
// se ganó, roja si se perdió, con el marcador debajo
function DiffTrendChart({ data }) {
  if (data.length === 0) return <div style={{ fontSize: 12.5, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Sin partidos finalizados todavía</div>
  const max = Math.max(...data.map(d => Math.abs(d.us - d.rival)), 1)
  const barArea = 70
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: barArea + 40, padding: '0 2px' }}>
      {data.map((d, i) => {
        const diff = d.us - d.rival
        const win = diff > 0
        const height = Math.max(3, (Math.abs(diff) / max) * barArea)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', minWidth: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: diff >= 0 ? 'flex-end' : 'flex-start', width: '100%' }}>
              {diff >= 0 && <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: 2 }}>{diff > 0 ? `+${diff}` : '='}</div>}
              <div style={{ width: '100%', maxWidth: 22, margin: '0 auto', height, borderRadius: 3, backgroundColor: win ? '#22c55e' : diff === 0 ? '#94a3b8' : '#ef4444' }} />
              {diff < 0 && <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'center', marginTop: 2 }}>{diff}</div>}
            </div>
            <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap' }}>{d.us}-{d.rival}</div>
            <div style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 600 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
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

  const [view, setView] = useState('partidos') // 'partidos' | 'resumen'
  const [resumen, setResumen] = useState(null)
  const [resumenLoading, setResumenLoading] = useState(false)
  const [resumenLoadedFor, setResumenLoadedFor] = useState(null) // team id ya cargado

  useEffect(() => {
    if (view === 'resumen' && selectedTeam && !loading && resumenLoadedFor !== selectedTeam.id) {
      loadResumen(selectedTeam, games)
    }
  }, [view, selectedTeam, games, loading])

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) { setLoading(false); return }
    loadData()
  }, [user, profile, activeTeam])

  async function loadData() {
    setLoading(true)
    if (isDirector) {
      const { data: t } = await supabase.from('teams').select('*').eq('active', true).order('name')
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
    setResumenLoadedFor(null) // fuerza recalcular el resumen si se cambia de equipo
  }

  // Balance de temporada (victorias/derrotas, puntos a favor/en contra,
  // tendencia) y líderes del equipo (máximos anotadores/reboteadores/
  // asistentes), agregando los game_events de todos los partidos.
  async function loadResumen(team, gamesList) {
    if (!team) return
    setResumenLoading(true)
    const finished = gamesList.filter(g => g.status === 'finished')
    let w = 0, d = 0, l = 0, ptsFor = 0, ptsAgainst = 0
    finished.forEach(g => {
      ptsFor += g.our_score || 0
      ptsAgainst += g.rival_score || 0
      if ((g.our_score || 0) > (g.rival_score || 0)) w++
      else if ((g.our_score || 0) < (g.rival_score || 0)) l++
      else d++
    })
    const trend = [...finished]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(-10)
      .map(g => ({
        label: g.date ? new Date(g.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—',
        us: g.our_score || 0, rival: g.rival_score || 0,
      }))

    const gameIds = gamesList.map(g => g.id)
    let leaders = []
    if (gameIds.length > 0) {
      const [{ data: evs }, { data: playerRows }] = await Promise.all([
        supabase.from('game_events').select('player_id, event_type, game_id').eq('team', 'us').in('game_id', gameIds).not('player_id', 'is', null),
        supabase.from('players').select('id, full_name, number').eq('team_id', team.id),
      ])
      const nameById = Object.fromEntries((playerRows || []).map(p => [p.id, { name: p.full_name, number: p.number }]))
      const byPlayer = {}
      ;(evs || []).forEach(e => {
        if (!byPlayer[e.player_id]) byPlayer[e.player_id] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, games: new Set() }
        const s = byPlayer[e.player_id]
        s.games.add(e.game_id)
        switch (e.event_type) {
          case '2pt_made': s.pts += 2; break
          case '3pt_made': s.pts += 3; break
          case 'ft_made':  s.pts += 1; break
          case 'rebound_off': case 'rebound_def': s.reb++; break
          case 'assist': s.ast++; break
          case 'steal':  s.stl++; break
        }
      })
      leaders = Object.entries(byPlayer).map(([pid, s]) => {
        const gp = s.games.size
        const info = nameById[pid] || {}
        return { id: pid, name: info.name || 'Jugador', number: info.number, gamesPlayed: gp, pts: s.pts, reb: s.reb, ast: s.ast, stl: s.stl }
      })
    }

    setResumen({ record: { w, d, l }, ptsFor, ptsAgainst, gamesCount: finished.length, trend, leaders })
    setResumenLoadedFor(team.id)
    setResumenLoading(false)
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
    setResumenLoadedFor(null) // el partido borrado puede afectar al balance/líderes
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
        <TeamGroupPicker teams={allTeams} selectedTeamId={selectedTeam?.id} onSelect={switchTeam} />
      )}

      {/* Partidos / Resumen de temporada */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ key: 'partidos', label: '📋 Partidos' }, { key: 'resumen', label: '📊 Resumen' }].map(v => {
          const active = view === v.key
          return (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              padding: '9px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: 'none',
              background: active ? 'linear-gradient(135deg,#1C5C2A,#52B043)' : '#f3f4f6',
              color: active ? '#fff' : '#374151',
              boxShadow: active ? '0 2px 8px rgba(28,92,42,0.30)' : 'none',
            }}>{v.label}</button>
          )
        })}
      </div>

      {/* ══════════════════════ RESUMEN DE TEMPORADA ══════════════════════ */}
      {view === 'resumen' && (
        resumenLoading || !resumen ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
        ) : resumen.gamesCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sin partidos finalizados todavía</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>El resumen aparecerá aquí cuando termine el primer partido.</div>
          </div>
        ) : (
          <div>
            {/* Balance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Ganados', value: resumen.record.w, color: '#16a34a' },
                { label: 'Empatados', value: resumen.record.d, color: '#94a3b8' },
                { label: 'Perdidos', value: resumen.record.l, color: '#ef4444' },
                { label: 'Dif. media', value: (() => { const v = (resumen.ptsFor - resumen.ptsAgainst) / resumen.gamesCount; return `${v > 0 ? '+' : ''}${v.toFixed(1)}` })(), color: resumen.ptsFor >= resumen.ptsAgainst ? '#16a34a' : '#ef4444' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px solid #e8edf3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Puntos de media</span>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div><span style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>{(resumen.ptsFor / resumen.gamesCount).toFixed(1)}</span> <span style={{ fontSize: 11, color: '#94a3b8' }}>a favor</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{(resumen.ptsAgainst / resumen.gamesCount).toFixed(1)}</span> <span style={{ fontSize: 11, color: '#94a3b8' }}>en contra</span></div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Últimos {resumen.trend.length} partidos</div>
              <DiffTrendChart data={resumen.trend} />
            </div>

            {/* Líderes del equipo */}
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>🏆 Líderes del equipo</div>
            {resumen.leaders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3' }}>
                Sin estadísticas individuales todavía
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { key: 'pts', label: 'Máximos anotadores', emoji: '🏀', color: '#2563eb' },
                  { key: 'reb', label: 'Máximos reboteadores', emoji: '💪', color: '#7c3aed' },
                  { key: 'ast', label: 'Máximos asistentes', emoji: '🎯', color: '#16a34a' },
                  { key: 'stl', label: 'Máximos robadores', emoji: '🖐️', color: '#d97706' },
                ].map(({ key, label, emoji, color }) => {
                  const top = [...resumen.leaders].filter(p => p[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 5)
                  return (
                    <div key={key} style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12.5, fontWeight: 800, color }}>{emoji} {label}</div>
                      {top.length === 0 ? (
                        <div style={{ padding: '16px 14px', fontSize: 12, color: '#9ca3af' }}>—</div>
                      ) : (
                        <div>
                          {top.map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: i < top.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', width: 14, flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.number != null ? `#${p.number} ` : ''}{p.name.split(' ')[0]}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 900, color }}>{p[key]}</span>
                                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>({(p[key] / p.gamesPlayed).toFixed(1)} med.)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Tabs filtro */}
      {view === 'partidos' && (
      <>
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
      </>
      )}
    </div>
  )
}
