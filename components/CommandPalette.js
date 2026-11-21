'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g'), '')

const PAGES = [
  { label: 'Inicio', href: '/dashboard', icon: 'home' },
  { label: 'Mi equipo / Equipos', href: '/dashboard/equipo', icon: 'users' },
  { label: 'Asistencia', href: '/dashboard/asistencia', icon: 'check' },
  { label: 'Incidencias', href: '/dashboard/incidencias', icon: 'alert' },
  { label: 'Estadísticas', href: '/dashboard/estadisticas', icon: 'chart' },
  { label: 'Convocatorias', href: '/dashboard/convocatorias', icon: 'clipboard' },
  { label: 'Tácticas', href: '/dashboard/tacticas', icon: 'ball' },
  { label: 'Entrenamientos', href: '/dashboard/entrenamientos', icon: 'file' },
  { label: 'Conceptos', href: '/dashboard/conceptos', icon: 'book' },
  { label: 'Documentos', href: '/dashboard/documentos', icon: 'folder' },
  { label: 'Mi perfil', href: '/dashboard/perfil', icon: 'user' },
]

export default function CommandPalette() {
  const { supabase, profile, myTeams } = useAuth()
  const router = useRouter()
  const isDirector = profile?.role === 'director'
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [players, setPlayers] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
      else if (e.key === 'Escape') setOpen(false)
    }
    function onOpen() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('urdaneta-open-search', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('urdaneta-open-search', onOpen) }
  }, [])

  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0)
    setTimeout(() => inputRef.current?.focus(), 30)
    if (players === null) {
      let query = supabase.from('players').select('id, full_name, number, position, teams(name)').eq('active', true).order('full_name').limit(1000)
      if (!isDirector) {
        const ids = (myTeams || []).map(t => t.id)
        if (!ids.length) { setPlayers([]); return }
        query = query.in('team_id', ids)
      }
      query.then(({ data }) => setPlayers(data || []))
    }
  }, [open])

  const results = useMemo(() => {
    const nq = norm(q.trim())
    const pages = PAGES.filter(p => !nq || norm(p.label).includes(nq)).map(p => ({ ...p, group: 'Ir a', kind: 'page' }))
    const ppl = nq
      ? (players || []).filter(p => norm(p.full_name).includes(nq) || String(p.number ?? '') === nq).slice(0, 8)
          .map(p => ({ label: p.full_name, sub: `${p.teams?.name || ''}${p.number != null ? ` · #${p.number}` : ''}`, href: `/dashboard/equipo/jugador/${p.id}`, icon: 'user', group: 'Jugadores', kind: 'player' }))
      : []
    return [...ppl, ...pages]
  }, [q, players])

  useEffect(() => { setSel(0) }, [q])

  function go(r) { setOpen(false); router.push(r.href) }

  function onInputKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel]) }
  }

  if (!open) return null
  let lastGroup = null
  return (
    <div className="cmdk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="cmdk" role="dialog" aria-label="Buscar">
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 18, color: '#94a3b8' }}>
          <Icon name="search" size={18} />
          <input ref={inputRef} className="cmdk-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onInputKey}
            placeholder="Busca un jugador o una sección…" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', marginRight: 16 }}>ESC</span>
        </div>
        <div className="cmdk-list">
          {results.length === 0 && <div style={{ padding: '22px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin resultados para “{q}”</div>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? <div className="cmdk-group" key={'g' + r.group}>{r.group}</div> : null
            lastGroup = r.group
            return (
              <div key={r.href + i}>
                {header}
                <button className={`cmdk-item${i === sel ? ' sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: '#eef5ee', color: '#1C5C2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={r.icon} size={16} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{r.label}</span>
                    {r.sub && <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{r.sub}</span>}
                  </span>
                  {i === sel && <Icon name="arrow" size={15} style={{ color: '#94a3b8' }} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
