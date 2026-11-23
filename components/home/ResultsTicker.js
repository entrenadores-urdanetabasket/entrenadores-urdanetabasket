'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

// Cinta de últimos resultados estilo retransmisión (equipo activo, o todo el club para el director)
export default function ResultsTicker() {
  const { supabase, profile, activeTeam } = useAuth()
  const [games, setGames] = useState(null)
  const isDirector = profile?.role === 'director'

  useEffect(() => {
    if (!profile) return
    if (!isDirector && !activeTeam) { setGames([]); return }
    let q = supabase.from('games').select('id,date,rival_name,our_score,rival_score,teams(name)').eq('status', 'finished').order('date', { ascending: false }).limit(10)
    if (!isDirector) q = q.eq('team_id', activeTeam.id)
    q.then(({ data }) => setGames(data || []))
  }, [profile?.id, activeTeam?.id])

  if (!games || games.length === 0) return null
  const items = games.map(g => {
    const a = g.our_score || 0, b = g.rival_score || 0
    return { id: g.id, team: g.teams?.name || 'Urdaneta', rival: g.rival_name, a, b, res: a > b ? 'V' : a < b ? 'D' : 'E' }
  })
  const row = k => (
    <div className="rt-row" key={k}>
      {items.map(i => (
        <span className="rt-item" key={i.id + k}>
          <b className={`rt-res ${i.res}`}>{i.res}</b>
          <span className="rt-team">{i.team}</span>
          <span className="rt-score num">{i.a}<i>–</i>{i.b}</span>
          <span className="rt-rival">{i.rival}</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="results-ticker keep-color" aria-label="Últimos resultados">
      <div className="rt-label"><span className="rt-dot" /> Resultados</div>
      <div className="rt-viewport"><div className="rt-track">{row(0)}{row(1)}</div></div>
    </div>
  )
}
