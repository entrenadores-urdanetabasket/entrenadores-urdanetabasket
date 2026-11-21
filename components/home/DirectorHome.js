'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'
import { Ring, GlassStat, CardHead, EmptyNote } from '@/components/ui'
import { ymd, daysAgo, parseDay, resultOf, INCIDENT_LABEL } from '@/lib/homeUtils'
import { computeExpectedDates, classifyCompliance } from '@/lib/trainingCompliance'
import { sortTeamsByCategory } from '@/lib/teamCategoryOrder'

export default function DirectorHome() {
  const { supabase } = useAuth()
  const [d, setD] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const startStr = daysAgo(13), endStr = ymd(new Date())
    const since30 = daysAgo(29)
    const [teamsR, coachesR, playersR, incR, gamesR, attAll, attOk] = await Promise.all([
      supabase.from('teams').select('*').eq('active', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('incidents').select('id,type,description,date,teams(name)', { count: 'exact' }).eq('resolved', false).order('date', { ascending: false }).limit(4),
      supabase.from('games').select('id,date,rival_name,our_score,rival_score,teams(name)').eq('status', 'finished').order('date', { ascending: false }).limit(6),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('date', since30),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('date', since30).in('status', ['present', 'late']),
    ])
    const teams = sortTeamsByCategory(teamsR.data || [])
    const ids = teams.map(t => t.id)
    let compliance = []
    if (ids.length) {
      const [tc, sess, att, exc] = await Promise.all([
        supabase.from('team_coaches').select('team_id, profiles(full_name)').in('team_id', ids),
        supabase.from('training_sessions').select('team_id,date').in('team_id', ids).gte('date', startStr).lte('date', endStr),
        supabase.from('attendance').select('team_id,date').eq('type', 'training').in('team_id', ids).gte('date', startStr).lte('date', endStr),
        supabase.from('team_schedule_exceptions').select('team_id,date').in('team_id', ids).gte('date', startStr).lte('date', endStr),
      ])
      compliance = teams.map(team => {
        const sSet = new Set((sess.data || []).filter(x => x.team_id === team.id).map(x => x.date))
        const aSet = new Set((att.data || []).filter(x => x.team_id === team.id).map(x => x.date))
        const eSet = new Set((exc.data || []).filter(x => x.team_id === team.id).map(x => x.date))
        const c = classifyCompliance(computeExpectedDates(team, startStr, endStr, eSet), sSet, aSet)
        const coaches = (tc.data || []).filter(x => x.team_id === team.id).map(x => x.profiles?.full_name).filter(Boolean)
        return { team, coaches, ...c }
      })
    }
    const total = attAll.count || 0
    setD({
      teams: teams.length, coaches: coachesR.count || 0, players: playersR.count || 0,
      incidentsCount: incR.count || 0, incidents: incR.data || [], games: gamesR.data || [],
      att30: total ? Math.round(((attOk.count || 0) / total) * 100) : null,
      compliance,
    })
  }

  if (!d) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 24 }} />
        <div className="dash-grid"><div className="skeleton span-8" style={{ height: 260 }} /><div className="skeleton span-4" style={{ height: 260 }} /></div>
      </div>
    )
  }

  return <DirectorHomeView d={d} />
}

export function DirectorHomeView({ d }) {
  const tone = pct => pct == null ? ['#94a3b8', '#f1f5f9'] : pct >= 90 ? ['#16a34a', '#dcfce7'] : pct >= 60 ? ['#d97706', '#fef3c7'] : ['#dc2626', '#fee2e2']

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Club Deportivo Urdaneta</div>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.1, margin: '0 0 12px' }}>Vista general del club</h2>
            <span className="chip">Temporada 2026-2027</span>
          </div>
          <img src="/logo.png" alt="Escudo C.D. Urdaneta" style={{ width: 76, height: 76, objectFit: 'contain', opacity: 0.95, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          <GlassStat label="Equipos" value={d.teams} />
          <GlassStat label="Entrenadores" value={d.coaches} />
          <GlassStat label="Jugadores" value={d.players} />
          <GlassStat label="Asistencia 30 días" value={d.att30 == null ? '—' : `${d.att30}%`}><Ring value={d.att30 || 0} size={44} stroke={5} /></GlassStat>
          <GlassStat label="Incidencias" value={d.incidentsCount} sub="abiertas" />
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel span-8">
          <CardHead icon="shield" title="Cumplimiento de entrenadores · 14 días" href="/dashboard/director" linkLabel="Seguimiento" color="#1C5C2A" />
          {d.compliance.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {d.compliance.map(({ team, coaches, ok, total }) => {
                const pct = total ? Math.round((ok / total) * 100) : null
                const [col, bg] = tone(pct)
                return (
                  <div key={team.id} className="row-item" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{team.name}</span>
                        <span style={{ fontSize: 11.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coaches.join(', ') || 'Sin entrenador'}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 99, background: '#e8edf3', overflow: 'hidden' }}>
                        <div style={{ width: `${pct ?? 0}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${col}, ${col}cc)`, transition: 'width 0.7s ease' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                      <span className="num" style={{ fontSize: 12, fontWeight: 800, color: col, background: bg, padding: '3px 9px', borderRadius: 8 }}>{pct == null ? 'Sin días' : `${pct}%`}</span>
                      {total > 0 && <div className="num" style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>{ok}/{total} días</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <EmptyNote>No hay equipos activos.</EmptyNote>}
        </div>

        <div className="panel span-4">
          <CardHead icon="chart" title="Últimos resultados" href="/dashboard/estadisticas" linkLabel="Ver" color="#8b5cf6" />
          {d.games.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {d.games.map(g => {
                const r = resultOf(g)
                const col = r === 'W' ? '#16a34a' : r === 'L' ? '#dc2626' : '#94a3b8'
                return (
                  <div key={g.id} className="row-item" style={{ padding: '9px 11px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: col, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r === 'W' ? 'V' : r === 'L' ? 'D' : 'E'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.teams?.name || 'Equipo'} vs {g.rival_name}</div>
                    </div>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 800, color: '#334155' }}>{g.our_score}-{g.rival_score}</span>
                  </div>
                )
              })}
            </div>
          ) : <EmptyNote>Aún no hay partidos finalizados.</EmptyNote>}
        </div>
      </div>

      <div className="panel">
        <CardHead icon="alert" title="Incidencias abiertas" href="/dashboard/incidencias" color="#ef4444" />
        {d.incidents.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {d.incidents.map(i => {
              const [lab, col] = INCIDENT_LABEL[i.type] || ['Incidencia', '#64748b']
              return (
                <Link key={i.id} href="/dashboard/incidencias" className="row-item">
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, color: col, background: `${col}14`, border: `1px solid ${col}30`, flexShrink: 0 }}>{lab}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</span>
                  <span style={{ fontSize: 11.5, color: '#94a3b8', flexShrink: 0 }}>{i.teams?.name}</span>
                </Link>
              )
            })}
          </div>
        ) : <EmptyNote>Sin incidencias abiertas. Todo en orden.</EmptyNote>}
      </div>
    </div>
  )
}
