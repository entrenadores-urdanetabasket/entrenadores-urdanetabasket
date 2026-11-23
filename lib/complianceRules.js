// Reglas del sistema de cumplimiento (se ejecuta SIEMPRE en el servidor con la service role).
//
//  · Un "día completo" = ese día de entrenamiento del equipo tiene sesión creada Y asistencia registrada.
//  · Se mira siempre la ventana de los últimos `window_days` días, sin contar hoy (el día aún no ha terminado)
//    y sin contar nada anterior a `start_date`, a la temporada ni al alta del entrenador.
//  · Si hay `max_missed` o más días incompletos y al menos uno es posterior al último desbloqueo,
//    el perfil se bloquea (se crea una fila en coach_blocks).
//  · Un "día" cuenta una sola vez aunque el entrenador tenga varios equipos.

import { computeExpectedDates } from '@/lib/trainingCompliance'

const TZ = 'Europe/Madrid'
const madridDate = d => d.toLocaleDateString('sv-SE', { timeZone: TZ }) // YYYY-MM-DD

export function todayAndYesterday() {
  const now = new Date()
  const y = new Date(now.getTime() - 24 * 3600 * 1000)
  return { today: madridDate(now), yesterday: madridDate(y) }
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function fetchAll(makeQuery) {
  const out = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await makeQuery(from)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function getSettings(admin) {
  const { data } = await admin.from('compliance_settings').select('*').eq('id', 1).maybeSingle()
  return { enabled: true, start_date: '2026-11-30', max_missed: 2, window_days: 30, min_exercises: 5, ...(data || {}) }
}

// Evalúa a UN entrenador. Crea el bloqueo si corresponde. Devuelve el estado para mostrar.
export async function evaluateCoach(admin, coachId, settings) {
  const { today, yesterday } = todayAndYesterday()

  const { data: prof } = await admin.from('profiles').select('id, full_name, role, created_at').eq('id', coachId).single()
  if (!prof || prof.role !== 'coach') return null

  const { data: blocks } = await admin.from('coach_blocks').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
  let active = (blocks || []).find(b => b.status === 'blocked' || b.status === 'review') || null
  const lastCleared = (blocks || []).filter(b => b.status === 'cleared' && b.reviewed_at).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0]
  const clearedDate = lastCleared ? madridDate(new Date(lastCleared.reviewed_at)) : null

  const base = {
    coachId, name: prof.full_name, enabled: !!settings.enabled, max: settings.max_missed, windowDays: settings.window_days,
    minExercises: settings.min_exercises, startDate: settings.start_date, clearedDate,
    teams: [], missed: [], count: 0, todayPending: [], block: active, level: 'ok',
  }
  if (!settings.enabled) return { ...base, level: active ? 'blocked' : 'ok' }

  const { data: links } = await admin.from('team_coaches').select('teams(id, name, category, training_weekdays, active)').eq('coach_id', coachId)
  const teams = (links || []).map(l => l.teams).filter(t => t && t.active !== false)
  base.teams = teams.map(t => t.name)

  if (teams.length === 0) return { ...base, level: active ? 'blocked' : 'ok' }
  const teamIds = teams.map(t => t.id)

  const windowStart = addDays(today, -(settings.window_days - 1))
  const joined = prof.created_at ? madridDate(new Date(prof.created_at)) : windowStart
  const lower = [windowStart, settings.start_date, joined].sort().pop() // la más reciente de las tres

  const [sess, att, excRes] = await Promise.all([
    fetchAll(from => admin.from('training_sessions').select('team_id, date').in('team_id', teamIds).gte('date', lower).lte('date', today).order('date').range(from, from + 999)),
    fetchAll(from => admin.from('attendance').select('team_id, date').eq('type', 'training').in('team_id', teamIds).gte('date', lower).lte('date', today).order('date').range(from, from + 999)),
    admin.from('team_schedule_exceptions').select('team_id, date').in('team_id', teamIds).gte('date', lower).lte('date', today),
  ])
  const sessSet = new Set(sess.map(r => `${r.team_id}|${r.date}`))
  const attSet = new Set(att.map(r => `${r.team_id}|${r.date}`))
  const excByTeam = {}
  ;(excRes.data || []).forEach(r => { (excByTeam[r.team_id] ||= new Set()).add(r.date) })

  const missedByDate = {}
  const todayPending = []
  for (const team of teams) {
    const exc = excByTeam[team.id] || new Set()
    if (lower <= yesterday) {
      for (const date of computeExpectedDates(team, lower, yesterday, exc)) {
        const hasSession = sessSet.has(`${team.id}|${date}`)
        const hasAttendance = attSet.has(`${team.id}|${date}`)
        if (!(hasSession && hasAttendance)) (missedByDate[date] ||= []).push({ team: team.name, hasSession, hasAttendance })
      }
    }
    if (computeExpectedDates(team, today, today, exc).length > 0 && today >= settings.start_date) {
      const hasSession = sessSet.has(`${team.id}|${today}`)
      const hasAttendance = attSet.has(`${team.id}|${today}`)
      todayPending.push({ team: team.name, hasSession, hasAttendance, done: hasSession && hasAttendance })
    }
  }

  const missed = Object.keys(missedByDate).sort().map(date => ({ date, teams: missedByDate[date] }))
  const newAfterClear = missed.some(m => !clearedDate || m.date > clearedDate)
  const shouldBlock = missed.length >= settings.max_missed && newAfterClear

  if (shouldBlock && !active) {
    const { data: inserted } = await admin.from('coach_blocks')
      .insert({ coach_id: coachId, status: 'blocked', missed_dates: missed.map(m => m.date) }).select().single()
    active = inserted || null
  }

  const level = active ? 'blocked' : missed.length >= settings.max_missed ? 'critical' : missed.length > 0 ? 'warning' : 'ok'
  return { ...base, missed, count: missed.length, todayPending, block: active, level }
}

export async function evaluateAllCoaches(admin, settings) {
  const { data: coaches } = await admin.from('profiles').select('id').eq('role', 'coach')
  const out = []
  for (const c of coaches || []) {
    try { const s = await evaluateCoach(admin, c.id, settings); if (s) out.push(s) } catch (e) { console.error('evaluateCoach', c.id, e) }
  }
  return out
}
