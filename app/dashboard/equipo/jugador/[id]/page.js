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

function emptyLine() {
  return { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
}

function addEventToLine(line, ev) {
  switch (ev.event_type) {
    case '2pt_made': line.pts += 2; line.fgm++; line.fga++; break
    case '2pt_miss': line.fga++; break
    case '3pt_made': line.pts += 3; line.fgm++; line.fga++; line.tpm++; line.tpa++; break
    case '3pt_miss': line.fga++; line.tpa++; break
    case 'ft_made':  line.pts += 1; line.ftm++; line.fta++; break
    case 'ft_miss':  line.fta++; break
    case 'rebound_off': case 'rebound_def': line.reb++; break
    case 'assist':  line.ast++; break
    case 'steal':   line.stl++; break
    case 'block':   line.blk++; break
    case 'turnover':line.tov++; break
    case 'foul_personal': case 'foul_technical': case 'foul_unsporting': case 'foul_disqualifying': line.pf++; break
  }
}

function shootPct(made, att) { return att > 0 ? Math.round((made / att) * 100) : null }
function avg(total, games) { return games > 0 ? (total / games).toFixed(1) : '—' }

export default function JugadorPage() {
  const { user, profile, supabase } = useAuth()
  const { id } = useParams()
  const router = useRouter()

  const [player, setPlayer] = useState(null)
  const [records, setRecords] = useState([])
  const [incidents, setIncidents] = useState([])
  const [gameLines, setGameLines] = useState([])
  const [season, setSeason] = useState(null)
  const [stats, setStats] = useState({ total: 0, attended: 0, absent: 0, late: 0, justified: 0, trainings: 0, trainingsAttended: 0, matches: 0, matchesAttended: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    const { data: p } = await supabase.from('players').select('*, teams(name, category, season)').eq('id', id).single()
    if (!p) { router.replace('/dashboard/equipo'); return }
    setPlayer(p)

    const [{ data: att }, { data: inc }, { data: gp }] = await Promise.all([
      supabase.from('attendance').select('date, status, type').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('incidents').select('*').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('game_players').select('game_id, jersey_number, starter, games(id, date, rival_name, our_score, rival_score, status, game_type)').eq('player_id', id),
    ])

    setRecords(att || [])
    setIncidents(inc || [])

    try {
      const gameRows = (gp || []).filter(r => r.games && !Array.isArray(r.games))
      const gameIds = gameRows.map(r => r.game_id)
      const { data: evs } = gameIds.length > 0
        ? await supabase.from('game_events').select('game_id, event_type').eq('player_id', id).in('game_id', gameIds)
        : { data: [] }

      const lineByGame = {}
      ;(evs || []).forEach(ev => {
        if (!lineByGame[ev.game_id]) lineByGame[ev.game_id] = emptyLine()
        addEventToLine(lineByGame[ev.game_id], ev)
      })

      const lines = gameRows
        .map(r => ({ ...r.games, jersey_number: r.jersey_number, starter: r.starter, line: lineByGame[r.game_id] || emptyLine() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setGameLines(lines)

      const totals = emptyLine()
      lines.forEach(g => { Object.keys(totals).forEach(k => { totals[k] += g.line[k] }) })
      setSeason({ ...totals, gamesPlayed: lines.length })
    } catch (err) {
      console.error('Error cargando estadísticas de partidos:', err)
      setGameLines([])
      setSeason({ ...emptyLine(), gamesPlayed: 0 })
    }
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

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
  if (!player) return null

  const pct         = stats.total     > 0 ? Math.round((stats.attended          / stats.total)     * 100) : null
  const pctTraining = stats.trainings > 0 ? Math.round((stats.trainingsAttended / stats.trainings) * 100) : null
  const pctMatch    = stats.matches   > 0 ? Math.round((stats.matchesAttended   / stats.matches)   * 100) : null

  return (
    <div className="fade-in">
      <Link href='/dashboard/equipo' style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 20 }}>
        ← Volver al equipo
      </Link>

      {/* Cabecera jugador */}
      <div style={{
        borderRadius: 20, marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
        padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {player.teams?.name} · {player.teams?.season}
          </p>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>{player.full_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
            {player.position || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Dorsal</div>
          <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, lineHeight: 0.9, letterSpacing: -3 }}>{player.number ?? '—'}</div>
        </div>
      </div>

      {/* Resumen estadísticas — fila superior */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Asistencia', value: pct !== null ? `${pct}%` : '—', color: pct !== null ? (pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444') : '#94a3b8' },
          { label: 'Sesiones',   value: stats.total,   color: '#0f172a' },
          { label: 'Faltas',     value: stats.absent,  color: '#ef4444' },
          { label: 'Tardes',     value: stats.late,    color: '#d97706' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 8px', border: '1px solid #e8edf3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1.5 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Barra general */}
      {pct !== null && (
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '16px 18px', border: '1px solid #e8edf3', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Tasa global de asistencia</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, backgroundColor: '#eef2f7', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: pct >= 75 ? 'linear-gradient(90deg,#52B043,#3a8a2e)' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
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

      {/* Estadísticas de partidos */}
      <h3 className="section-title" style={{ marginBottom: 12 }}>📊 Estadísticas de partidos</h3>
      {!season || season.gamesPlayed === 0 ? (
        <div className="empty-state" style={{ marginBottom: 28 }}>
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">Sin estadísticas de partidos todavía</div>
        </div>
      ) : (
        <>
          {/* Resumen de temporada */}
          <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
              Media de la temporada · {season.gamesPlayed} {season.gamesPlayed === 1 ? 'partido' : 'partidos'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, backgroundColor: '#eef2f7' }}>
              {[
                { label: 'Puntos', value: avg(season.pts, season.gamesPlayed) },
                { label: 'Rebotes', value: avg(season.reb, season.gamesPlayed) },
                { label: 'Asistencias', value: avg(season.ast, season.gamesPlayed) },
                { label: 'Robos', value: avg(season.stl, season.gamesPlayed) },
                { label: 'Tapones', value: avg(season.blk, season.gamesPlayed) },
                { label: 'Pérdidas', value: avg(season.tov, season.gamesPlayed) },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: '#fff', padding: '14px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 18px' }}>
              {[
                { label: 'Tiro de campo', made: season.fgm, att: season.fga },
                { label: 'Triples', made: season.tpm, att: season.tpa },
                { label: 'Tiros libres', made: season.ftm, att: season.fta },
              ].map(s => {
                const p = shootPct(s.made, s.att)
                return (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: p !== null ? '#2563eb' : '#94a3b8' }}>{p !== null ? `${p}%` : '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.made}/{s.att}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por partido */}
          <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)', marginBottom: 28, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Por partido</div>
            {gameLines.map(g => (
              <Link key={g.id} href={`/live/${g.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
                borderBottom: '1px solid #f9fafb', textDecoration: 'none', color: 'inherit'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>vs {g.rival_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {g.date ? new Date(g.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                    {g.status === 'finished' ? ` · ${g.our_score}-${g.rival_score}` : g.status === 'live' ? ' · En directo' : ' · Pendiente'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                  {[['PTS', g.line.pts], ['REB', g.line.reb], ['AST', g.line.ast]].map(([label, val]) => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 30 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{val}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Incidencias */}
      <h3 className="section-title" style={{ marginBottom: 12 }}>
        Incidencias {incidents.filter(i => !i.resolved).length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: '#ef4444', padding: '2px 9px', borderRadius: 7, marginLeft: 8 }}>
            {incidents.filter(i => !i.resolved).length} activas
          </span>
        )}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 14, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.6 }}>✅</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sin incidencias registradas</div>
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
      <h3 className="section-title" style={{ marginBottom: 12 }}>Historial de asistencia</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">Sin registros todavía</div>
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
