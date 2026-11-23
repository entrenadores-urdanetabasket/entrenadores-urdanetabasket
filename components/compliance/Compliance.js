'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Icon from '@/components/Icons'
import { toast, toastError } from '@/lib/toast'

const Ctx = createContext({ state: null, refresh: () => {} })
export const useCompliance = () => useContext(Ctx)

const sameJson = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false } }
export const fmtDay = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const madridToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

// Qué faltó cada día fallado: "sin entrenamiento", "sin asistencia" o ambos
export function missingText(m) {
  const noSession = m.teams.some(t => !t.hasSession)
  const noAtt = m.teams.some(t => !t.hasAttendance)
  return noSession && noAtt ? 'sin entrenamiento y sin asistencia' : noSession ? 'sin entrenamiento' : 'sin asistencia'
}

// ── Contenedor: pide el estado al servidor, bloquea si toca y muestra los recordatorios ───────
export function ComplianceGate({ children }) {
  const { profile, supabase } = useAuth()
  const pathname = usePathname()
  const isCoach = profile?.role === 'coach'
  const [state, setState] = useState(null)
  const last = useRef(0)
  const sb = useRef(supabase)
  sb.current = supabase

  const refresh = useCallback(async (force = false) => {
    if (!isCoach) return
    const now = Date.now()
    if (!force && now - last.current < 8000) return
    last.current = now
    try {
      const { data: { session } } = await sb.current.auth.getSession()
      if (!session) return
      const res = await fetch('/api/coach/compliance', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) return
      const json = await res.json()
      setState(prev => (sameJson(prev, json.state) ? prev : json.state))
    } catch { /* si falla la comprobación no se bloquea a nadie */ }
  }, [isCoach])

  useEffect(() => { refresh(true) }, [refresh, profile?.id])
  useEffect(() => { refresh() }, [pathname]) // tras completar algo y cambiar de pantalla se actualiza
  useEffect(() => {
    if (!isCoach) return
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onVis); document.addEventListener('visibilitychange', onVis)
    const id = setInterval(() => refresh(), 180000)
    return () => { window.removeEventListener('focus', onVis); document.removeEventListener('visibilitychange', onVis); clearInterval(id) }
  }, [isCoach, refresh])

  const block = state?.block
  const locked = isCoach && block && (block.status === 'blocked' || block.status === 'review')
  const allowedWhileBlocked = block?.status === 'blocked' && pathname.startsWith('/dashboard/entrenamientos')

  return (
    <Ctx.Provider value={{ state, refresh }}>
      {locked && !allowedWhileBlocked ? <LockScreen state={state} refresh={refresh} /> : (
        <>
          {locked && allowedWhileBlocked && <BlockedBanner state={state} />}
          {isCoach && !locked && pathname !== '/dashboard' && <ReminderBanner state={state} />}
          {children}
        </>
      )}
    </Ctx.Provider>
  )
}

// ── Pantalla de bloqueo ─────────────────────────────────────────────────────────────────────
function LockScreen({ state, refresh }) {
  const { supabase, user } = useAuth()
  const block = state.block
  const [sessions, setSessions] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const missed = state.missed || []

  useEffect(() => { if (block.status === 'blocked') loadSessions(); else setLoading(false) }, [block.id, block.status])

  async function loadSessions() {
    setLoading(true)
    const { data: ss } = await supabase.from('training_sessions').select('id, title, date, created_at')
      .eq('created_by', user.id).gte('created_at', block.created_at).order('created_at', { ascending: false })
    const ids = (ss || []).map(s => s.id)
    const counts = {}
    if (ids.length) {
      const { data: ex } = await supabase.from('training_exercises').select('session_id').in('session_id', ids)
      ;(ex || []).forEach(e => { counts[e.session_id] = (counts[e.session_id] || 0) + 1 })
    }
    setSessions((ss || []).map(s => ({ ...s, n: counts[s.id] || 0 })))
    setLoading(false)
  }

  async function submit(sessionId) {
    setBusy(true)
    const { error } = await supabase.rpc('submit_recovery', { p_block: block.id, p_session: sessionId })
    setBusy(false)
    if (error) { toastError(error.message); return }
    toast('Enviado al director para su revisión')
    refresh(true)
  }

  async function logout() { await supabase.auth.signOut(); window.location.href = '/login' }

  const min = state.minExercises || 5
  const inReview = block.status === 'review'

  return (
    <div className="panel" style={{ maxWidth: 680, margin: '8px auto 0', padding: 0, overflow: 'hidden', borderColor: '#fecaca' }}>
      <div style={{ padding: '22px 24px', background: 'linear-gradient(135deg,#7f1d1d,#b91c1c)', color: '#fff' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{inReview ? 'En revisión' : 'Perfil bloqueado'}</div>
        <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 6 }}>
          {inReview ? 'El director está revisando tu entrenamiento de recuperación.' : `Has acumulado ${missed.length} días sin completar el sistema (entrenamiento + asistencia) en los últimos ${state.windowDays} días.`}
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gap: 18 }}>
        {missed.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Días que faltaron</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {missed.map(m => (
                <div key={m.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13 }}>
                  <b style={{ color: '#7f1d1d', textTransform: 'capitalize' }}>{fmtDay(m.date)}</b>
                  <span style={{ color: '#b91c1c' }}>{missingText(m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {block.status === 'blocked' && block.review_note && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            <b>El director rechazó tu envío anterior:</b> {block.review_note}
          </div>
        )}

        {inReview ? (
          <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.55 }}>
            Cuando el director lo acepte, tu perfil se desbloqueará automáticamente.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => refresh(true)} className="btn-primary" style={{ padding: '10px 18px' }}>Comprobar ahora</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Cómo desbloquearlo</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
              <li>Crea un entrenamiento completo con <b>al menos {min} ejercicios</b> en <Link href="/dashboard/entrenamientos" style={{ color: '#1C5C2A', fontWeight: 800 }}>Entrenamientos</Link>.</li>
              <li>Vuelve aquí y envíalo a revisión.</li>
              <li>Cuando el director lo apruebe, tu perfil se desbloquea.</li>
            </ol>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Tus entrenamientos creados desde el bloqueo</div>
              {loading ? <div style={{ fontSize: 13, color: '#94a3b8' }}>Cargando…</div> : sessions.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: '14px 0' }}>Todavía no has creado ninguno.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {sessions.map(s => {
                    const ok = s.n >= min
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${ok ? '#bbf7d0' : '#e2e8f0'}`, background: ok ? '#f0fdf4' : '#fff' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Entrenamiento'}</div>
                          <div style={{ fontSize: 12, color: ok ? '#15803d' : '#b45309' }}>{s.n} {s.n === 1 ? 'ejercicio' : 'ejercicios'}{ok ? '' : ` · faltan ${min - s.n}`}</div>
                        </div>
                        <button disabled={!ok || busy} onClick={() => submit(s.id)} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5, opacity: ok ? 1 : 0.5 }}>Enviar a revisión</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Link href="/dashboard/entrenamientos" className="btn-primary" style={{ padding: '10px 18px', display: 'inline-flex' }}>Ir a Entrenamientos</Link>
                <button onClick={loadSessions} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Actualizar lista</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 14 }}>
          <button onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Icon name="logout" size={15} /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Aviso mientras está bloqueado y en Entrenamientos ───────────────────────────────────────
function BlockedBanner({ state }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 14, marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d', fontSize: 13.5, lineHeight: 1.5 }}>
      <b>Tu perfil está bloqueado.</b> Crea aquí un entrenamiento con al menos {state.minExercises} ejercicios y, cuando lo tengas, vuelve a <Link href="/dashboard" style={{ fontWeight: 800, textDecoration: 'underline' }}>Inicio</Link> para enviarlo a revisión.
    </div>
  )
}

// ── Recordatorio didáctico en todas las pantallas ───────────────────────────────────────────
function ReminderBanner({ state }) {
  if (!state || !state.enabled) return null
  const today = madridToday()
  if (today < state.startDate) return null
  const pending = (state.todayPending || []).filter(p => !p.done)
  const { level, missed, max } = state

  let tone = null, text = null, links = []
  if (level === 'critical') {
    tone = 'red'
    text = <><b>Atención:</b> tienes {missed.length} días sin completar en los últimos {state.windowDays}. <b>Cualquier día nuevo sin entrenamiento y asistencia bloqueará tu perfil.</b></>
    links = [['/dashboard/asistencia', 'Pasar lista'], ['/dashboard/entrenamientos', 'Entrenamientos']]
  } else if (level === 'warning') {
    tone = 'amber'
    const m = missed[missed.length - 1]
    text = <><b>Te falta completar el {fmtDay(m.date)}</b> ({missingText(m)}). Con {max} días incompletos en {state.windowDays} días se bloquea tu perfil. Aún estás a tiempo de ponerlo al día.</>
    links = [['/dashboard/asistencia', 'Pasar lista'], ['/dashboard/entrenamientos', 'Entrenamientos']]
  } else if (pending.length > 0) {
    tone = 'blue'
    const needs = [pending.some(p => !p.hasSession) && 'crear el entrenamiento', pending.some(p => !p.hasAttendance) && 'pasar lista'].filter(Boolean).join(' y ')
    text = <>Hoy hay entrenamiento: te falta <b>{needs}</b>. Recuerda que cada día debe quedar completo.</>
    links = [['/dashboard/asistencia', 'Pasar lista'], ['/dashboard/entrenamientos', 'Entrenamientos']]
  }
  if (!tone) return null
  const c = { red: ['#fef2f2', '#fecaca', '#7f1d1d'], amber: ['#fffbeb', '#fde68a', '#92400e'], blue: ['#eff6ff', '#bfdbfe', '#1e3a8a'] }[tone]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 14, marginBottom: 16, background: c[0], border: `1px solid ${c[1]}`, color: c[2], fontSize: 13.5, lineHeight: 1.5 }}>
      <div style={{ flex: '1 1 260px' }}>{text}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {links.map(([href, label]) => <Link key={href} href={href} style={{ padding: '7px 12px', borderRadius: 9, background: '#fff', border: `1px solid ${c[1]}`, color: c[2], fontWeight: 800, fontSize: 12.5 }}>{label}</Link>)}
      </div>
    </div>
  )
}

// ── Guía "Tu seguimiento" para la pantalla de Inicio ───────────────────────────────────────
export function PendingGuide() {
  const { state } = useCompliance()
  if (!state || !state.enabled) return null
  const today = madridToday()
  const { missed, count, max, todayPending, level } = state
  const notStarted = today < state.startDate
  const tone = level === 'critical' || level === 'blocked' ? '#dc2626' : level === 'warning' ? '#d97706' : '#16a34a'

  return (
    <div className="panel" style={{ marginBottom: 16, borderColor: `${tone}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="panel-title" style={{ color: '#0f172a' }}>Tu seguimiento</div>
        {!notStarted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {Array.from({ length: max }).map((_, i) => <span key={i} style={{ width: 22, height: 8, borderRadius: 4, background: i < count ? tone : '#e2e8f0' }} />)}
            </div>
            <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>{count}/{max} días incompletos · {state.windowDays} días</span>
          </div>
        )}
      </div>

      {notStarted ? (
        <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>
          El seguimiento empieza el <b>{fmtDay(state.startDate)}</b>. A partir de ese día, cada día de entrenamiento debe quedar con su <b>entrenamiento creado</b> y su <b>asistencia pasada</b>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Hoy</div>
            {todayPending.length === 0 ? (
              <div style={{ fontSize: 13.5, color: '#64748b' }}>Hoy no tienes entrenamiento programado. 🙌</div>
            ) : todayPending.map(p => (
              <div key={p.team} style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                {todayPending.length > 1 && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>{p.team}</div>}
                <Task done={p.hasSession} label="Crear el entrenamiento de hoy" href="/dashboard/entrenamientos" />
                <Task done={p.hasAttendance} label="Pasar lista de hoy" href="/dashboard/asistencia" />
              </div>
            ))}
          </div>

          {missed.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Días atrasados</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {missed.map(m => (
                  <div key={m.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13 }}>
                    <span><b style={{ textTransform: 'capitalize', color: '#92400e' }}>{fmtDay(m.date)}</b> <span style={{ color: '#b45309' }}>· {missingText(m)}</span></span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {m.teams.some(t => !t.hasSession) && <Link href="/dashboard/entrenamientos" style={{ fontWeight: 800, color: '#92400e', fontSize: 12.5 }}>Crear entreno →</Link>}
                      {m.teams.some(t => !t.hasAttendance) && <Link href="/dashboard/asistencia" style={{ fontWeight: 800, color: '#92400e', fontSize: 12.5 }}>Pasar lista →</Link>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55, borderTop: '1px solid #eef2f7', paddingTop: 12 }}>
            💡 Cada día de entrenamiento debe tener su <b>sesión de entrenamiento</b> y su <b>asistencia</b>. Con <b>{max} días incompletos en {state.windowDays} días</b> tu perfil se bloquea hasta que crees un entrenamiento con {state.minExercises} ejercicios y el director lo apruebe. Puedes completar días atrasados antes de llegar al límite.
          </div>
        </div>
      )}
    </div>
  )
}

function Task({ done, label, href }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: done ? '#f0fdf4' : '#f8fafc', border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`, fontSize: 13.5, fontWeight: 600, color: done ? '#15803d' : '#0f172a', textDecoration: 'none' }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#16a34a' : '#fff', border: `1.5px solid ${done ? '#16a34a' : '#cbd5e1'}`, color: '#fff', fontSize: 12, fontWeight: 800 }}>{done ? '✓' : ''}</span>
      <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.75 : 1 }}>{label}</span>
      {!done && <Icon name="arrow" size={14} style={{ color: '#94a3b8' }} />}
    </Link>
  )
}
