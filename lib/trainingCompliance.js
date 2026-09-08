// Cálculo de cumplimiento de entrenamientos: qué días le tocaba entrenar a
// un equipo en un rango de fechas, y si ese día se creó una sesión de
// entrenamiento y se registró asistencia. Días de la semana con el mismo
// criterio que Date.getDay(): 0=domingo ... 6=sábado.

import { categoryGroup } from '@/lib/teamCategoryOrder'

export function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// Inicio real de la temporada de entrenamientos: los equipos federados
// (Cadete/Junior/Senior) empiezan antes que los escolares (Premini/Mini/
// Infantil). Aunque un equipo se creara antes en la aplicación, no cuenta
// como incumplimiento nada anterior a la fecha de su grupo.
export const SEASON_START_DATE = '2026-08-31'
export const SEASON_START_DATE_ESCOLAR = '2026-09-15'

export function seasonStartFor(team) {
  return categoryGroup(team?.category) === 'escolar' ? SEASON_START_DATE_ESCOLAR : SEASON_START_DATE
}

// Todas las fechas (YYYY-MM-DD) entre startStr y endStr (incluidos) en las
// que el equipo tiene entrenamiento según su horario semanal, sin contar
// días anteriores al inicio de temporada, futuros, ni marcados como suspendidos.
export function computeExpectedDates(team, startStr, endStr, suspendedSet = new Set()) {
  const weekdays = team.training_weekdays && team.training_weekdays.length > 0 ? team.training_weekdays : [2, 4, 5]
  const seasonStart = seasonStartFor(team)
  const todayStr = toDateStr(new Date())
  const end = endStr > todayStr ? todayStr : endStr
  const start = !startStr || startStr < seasonStart ? seasonStart : startStr
  if (start > end) return []
  const dates = []
  let cur = new Date(start + 'T12:00:00')
  const endDate = new Date(end + 'T12:00:00')
  while (cur <= endDate) {
    const dStr = toDateStr(cur)
    if (weekdays.includes(cur.getDay()) && !suspendedSet.has(dStr)) dates.push(dStr)
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// Clasifica cada fecha esperada según si existe sesión creada y/o asistencia
// registrada ese día. Devuelve { ok, missingBoth, missingSession, missingAttendance, dates: [{date,hasSession,hasAttendance}] }
export function classifyCompliance(expectedDates, sessionDatesSet, attendanceDatesSet) {
  const dates = expectedDates.map(date => ({
    date,
    hasSession: sessionDatesSet.has(date),
    hasAttendance: attendanceDatesSet.has(date),
  }))
  const ok = dates.filter(d => d.hasSession && d.hasAttendance).length
  const missingSession = dates.filter(d => !d.hasSession).length
  const missingAttendance = dates.filter(d => !d.hasAttendance).length
  const missingBoth = dates.filter(d => !d.hasSession && !d.hasAttendance).length
  return { dates, ok, missingSession, missingAttendance, missingBoth, total: dates.length }
}
