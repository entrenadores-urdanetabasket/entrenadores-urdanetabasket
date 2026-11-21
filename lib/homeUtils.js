export const ymd = d => d.toISOString().slice(0, 10)

export function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return ymd(d)
}

export function parseDay(s) { return new Date(s + 'T12:00:00') }

export function fmtLong(s) {
  return parseDay(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function resultOf(g) {
  const a = g.our_score || 0, b = g.rival_score || 0
  return a > b ? 'W' : a < b ? 'L' : 'D'
}

export function attendancePct(rows) {
  if (!rows.length) return null
  const ok = rows.filter(r => r.status === 'present' || r.status === 'late').length
  return Math.round((ok / rows.length) * 100)
}

// Porcentaje de asistencia por semana (lunes-domingo), las últimas `weeks`
export function weeklyAttendance(rows, weeks = 8) {
  const now = new Date()
  const mondayOf = d => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(12, 0, 0, 0); return x }
  const thisMonday = mondayOf(now)
  const buckets = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday); start.setDate(start.getDate() - i * 7)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    buckets.push({ start: ymd(start), end: ymd(end), label: `${start.getDate()}/${start.getMonth() + 1}`, rows: [] })
  }
  rows.forEach(r => { const b = buckets.find(x => r.date >= x.start && r.date <= x.end); if (b) b.rows.push(r) })
  return buckets.map(b => ({ label: b.label, value: attendancePct(b.rows) }))
}

export const INCIDENT_LABEL = {
  lesion: ['Lesión', '#ef4444'], sancion: ['Sanción', '#d97706'], expulsion: ['Expulsión', '#dc2626'],
  conflicto: ['Conflicto', '#7c3aed'], otro: ['Otro', '#64748b'], disciplinary: ['Disciplinaria', '#ef4444'],
  medical: ['Médica', '#f59e0b'], administrative: ['Administrativa', '#3b82f6'], other: ['Otro', '#64748b'],
}

export const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
