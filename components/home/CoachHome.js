'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'
import { Ring, Spark, Bars, FormDots, CardHead, GlassStat, EmptyNote } from '@/components/ui'
import { cap, ymd, daysAgo, parseDay, fmtLong, resultOf, attendancePct, weeklyAttendance, INCIDENT_LABEL } from '@/lib/homeUtils'

export default function CoachHome({ team }) {
  const { supabase } = useAuth()
  const [d, setD] = useState(null)

  useEffect(() => { if (team) load() }, [team?.id])

  async function load() {
    setD(null)
    const today = ymd(new Date())
    const since = daysAgo(55)
    const [pc, inc, att, gamesDone, nextGame, nextConv, nextTr] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', team.id).eq('active', true),
      supabase.from('incidents').select('id,type,description,date', { count: 'exact' }).eq('team_id', team.id).eq('resolved', false).order('date', { ascending: false }).limit(4),
      supabase.from('attendance').select('date,status').eq('team_id', team.id).gte('date', since).range(0, 999),
      supabase.from('games').select('id,date,rival_name,our_score,rival_score').eq('team_id', team.id).eq('status', 'finished').order('date', { ascending: false }).limit(10),
      supabase.from('games').select('*').eq('team_id', team.id).neq('status', 'finished').gte('date', today).order('date', { ascending: true }).limit(1),
      supabase.from('convocatorias').select('*').eq('team_id', team.id).gte('date', today).order('date', { ascending: true }).limit(1),
      supabase.from('training_sessions').select('id,title,date,start_time,duration_minutes').eq('team_id', team.id).gte('date', today).order('date', { ascending: true }).limit(1),
    ])
    const attRows = att.data || []
    const last30 = attRows.filter(r => r.date >= daysAgo(29))
    const games = [...(gamesDone.data || [])].reverse() // cronológico
    setD({
      players: pc.count || 0,
      incidentsCount: inc.count || 0,
      incidents: inc.data || [],
      att30: attendancePct(last30),
      weekly: weeklyAttendance(attRows, 8),
      games,
      nextGame: nextGame.data?.[0] || null,
      nextConv: nextConv.data?.[0] || null,
      nextTraining: nextTr.data?.[0] || null,
    })
  }

  if (!d) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="skeleton" style={{ height: 190, borderRadius: 24 }} />
        <div className="dash-grid"><div className="skeleton span-6" style={{ height: 150 }} /><div className="skeleton span-6" style={{ height: 150 }} /></div>
      </div>
    )
  }

  return <CoachHomeView team={team} d={d} />
}

export function CoachHomeView({ team, d }) {
  const wins = d.games.filter(g => resultOf(g) === 'W').length
  const losses = d.games.filter(g => resultOf(g) === 'L').length
  const form = d.games.slice(-5).map(g => ({ res: resultOf(g), title: `vs ${g.rival_name} ${g.our_score}-${g.rival_score}` }))
  const diffs = d.games.map(g => (g.our_score || 0) - (g.rival_score || 0))
  const avgDiff = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length) : 0
  const tr = d.nextTraining
  const trDate = tr ? parseDay(tr.date) : null
  const matchDate = d.nextGame?.date || d.nextConv?.date
  const matchRival = d.nextGame?.rival_name || d.nextConv?.rival
  const matchHref = d.nextGame ? `/live/${d.nextGame.id}` : d.nextConv ? `/dashboard/convocatorias/${d.nextConv.id}` : null

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Hero */}
      <div className="hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Tu equipo</div>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.1, margin: '0 0 12px' }}>{team.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {team.category && <span className="chip">{team.category}</span>}
              {team.season && <span className="chip">Temporada {team.season}</span>}
            </div>
          </div>
          <img src="/logo.png" alt="Escudo C.D. Urdaneta" style={{ width: 76, height: 76, objectFit: 'contain', opacity: 0.95, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          <GlassStat label="Jugadores" value={d.players} />
          <GlassStat label="Asistencia 30 días" value={d.att30 == null ? '—' : `${d.att30}%`}>
            <Ring value={d.att30 || 0} size={44} stroke={5} />
          </GlassStat>
          <GlassStat label="Balance" value={`${wins}-${losses}`} sub={d.games.length ? `últimos ${d.games.length} partidos` : 'sin partidos'} />
          <GlassStat label="Incidencias" value={d.incidentsCount} sub="abiertas" />
        </div>
      </div>

      {/* Próximo entrenamiento + partido */}
      <div className="dash-grid">
        <div className="panel span-6">
          <CardHead icon="file" title="Próximo entrenamiento" href="/dashboard/entrenamientos" linkLabel="Planificar" color="#ec4899" />
          {tr ? (
            <Link href={`/dashboard/entrenamientos?session=${tr.id}`} className="row-item" style={{ padding: 14 }}>
              <div style={{ width: 56, height: 62, borderRadius: 14, background: 'linear-gradient(160deg,#fdf2f8,#fce7f3)', border: '1px solid #fbcfe8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: '#be185d', lineHeight: 1 }}>{trDate.getDate()}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#db2777', textTransform: 'uppercase', marginTop: 3 }}>{trDate.toLocaleDateString('es-ES', { month: 'short' })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.title || 'Sesión de entrenamiento'}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                  {cap(trDate.toLocaleDateString('es-ES', { weekday: 'long' }))}{tr.start_time ? ` · ${tr.start_time.slice(0, 5)}` : ''}{tr.duration_minutes ? ` · ${tr.duration_minutes} min` : ''}
                </div>
              </div>
              <Icon name="arrow" size={16} style={{ color: '#94a3b8' }} />
            </Link>
          ) : (
            <EmptyNote>No hay ningún entrenamiento planificado.<br /><Link href="/dashboard/entrenamientos" style={{ color: '#52B043', fontWeight: 700 }}>Crear sesión</Link></EmptyNote>
          )}
        </div>

        <div className="panel span-6">
          <CardHead icon="ball" title="Próximo partido" href="/dashboard/convocatorias" linkLabel="Convocatorias" color="#0ea5e9" />
          {matchDate ? (
            <Link href={matchHref || '/dashboard/convocatorias'} className="row-item" style={{ padding: 14 }}>
              <div style={{ width: 56, height: 62, borderRadius: 14, background: 'linear-gradient(160deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: '#0369a1', lineHeight: 1 }}>{parseDay(matchDate).getDate()}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginTop: 3 }}>{parseDay(matchDate).toLocaleDateString('es-ES', { month: 'short' })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {matchRival || 'Rival por confirmar'}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{cap(fmtLong(matchDate))}</div>
              </div>
              <Icon name="arrow" size={16} style={{ color: '#94a3b8' }} />
            </Link>
          ) : (
            <EmptyNote>No hay partidos próximos.<br /><Link href="/dashboard/convocatorias/nueva" style={{ color: '#52B043', fontWeight: 700 }}>Crear convocatoria</Link></EmptyNote>
          )}
        </div>
      </div>

      {/* Asistencia + forma */}
      <div className="dash-grid">
        <div className="panel span-8">
          <CardHead icon="check" title="Asistencia por semana" href="/dashboard/asistencia" linkLabel="Registrar" color="#52B043" />
          {d.weekly.some(w => w.value != null) ? <Bars data={d.weekly} height={130} /> : <EmptyNote>Todavía no hay asistencia registrada.</EmptyNote>}
        </div>
        <div className="panel span-4">
          <CardHead icon="chart" title="Forma reciente" href="/dashboard/estadisticas" linkLabel="Partidos" color="#8b5cf6" />
          {d.games.length ? (
            <>
              <FormDots results={form} />
              <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Diferencia de puntos</div>
              <div style={{ margin: '6px 0 4px' }}><Spark values={diffs} zero color="#8b5cf6" height={64} /></div>
              <div style={{ fontSize: 12.5, color: '#64748b' }}>Media <b className="num" style={{ color: avgDiff >= 0 ? '#16a34a' : '#dc2626' }}>{avgDiff >= 0 ? '+' : ''}{avgDiff.toFixed(1)}</b> por partido</div>
            </>
          ) : <EmptyNote>Aún no hay partidos finalizados.</EmptyNote>}
        </div>
      </div>

      {/* Incidencias */}
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
                  <span className="num" style={{ fontSize: 11.5, color: '#94a3b8', flexShrink: 0 }}>{parseDay(i.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                </Link>
              )
            })}
          </div>
        ) : <EmptyNote>Sin incidencias abiertas. Todo en orden.</EmptyNote>}
      </div>
    </div>
  )
}
