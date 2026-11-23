'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { toast, toastError } from '@/lib/toast'
import { fmtDay, missingText } from '@/components/compliance/Compliance'

const chip = (bg, color, border) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: bg, color, border: `1px solid ${border}` })
const inp = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, width: 90 }

// Panel del director: bloqueos, revisión de entrenamientos de recuperación y ajustes del sistema
export default function ComplianceAdmin() {
  const { supabase } = useAuth()
  const [data, setData] = useState(null)
  const [recovery, setRecovery] = useState({}) // blockId -> { session, exercises }
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/compliance-sweep', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setData(json)
      setForm(f => f || { ...json.settings })

      const inReview = json.states.filter(s => s.block?.status === 'review' && s.block.recovery_session_id)
      const sIds = inReview.map(s => s.block.recovery_session_id)
      const rec = {}
      if (sIds.length) {
        const [{ data: ss }, { data: ex }] = await Promise.all([
          supabase.from('training_sessions').select('id, title, date').in('id', sIds),
          supabase.from('training_exercises').select('session_id, title, duration_minutes, description').in('session_id', sIds).order('order_index'),
        ])
        inReview.forEach(s => {
          rec[s.block.id] = { session: (ss || []).find(x => x.id === s.block.recovery_session_id), exercises: (ex || []).filter(e => e.session_id === s.block.recovery_session_id) }
        })
      }
      setRecovery(rec)
    } catch (e) { toastError('No se pudo cargar el seguimiento: ' + e.message) }
    setLoading(false)
  }

  async function review(block, approve, label) {
    let note = null
    if (!approve) {
      note = window.prompt('Motivo del rechazo (el entrenador lo verá):', '')
      if (note === null) return
    } else if (label === 'manual' && !window.confirm('¿Desbloquear a este entrenador sin revisar ningún entrenamiento?')) return
    setBusy(true)
    const { error } = await supabase.rpc('review_block', { p_block: block.id, p_approve: approve, p_note: note })
    setBusy(false)
    if (error) { toastError(error.message); return }
    toast(approve ? 'Entrenador desbloqueado' : 'Envío rechazado')
    load()
  }

  async function saveSettings() {
    setBusy(true)
    const { error } = await supabase.from('compliance_settings').update({
      enabled: !!form.enabled, start_date: form.start_date, max_missed: Number(form.max_missed) || 2,
      window_days: Number(form.window_days) || 30, min_exercises: Number(form.min_exercises) || 5,
    }).eq('id', 1)
    setBusy(false)
    if (error) { toastError('No se pudo guardar: ' + error.message); return }
    toast('Ajustes guardados')
    load()
  }

  if (loading && !data) return <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0 16px' }}>Comprobando cumplimiento…</div>
  if (!data) return null

  const states = data.states
  const review_ = states.filter(s => s.block?.status === 'review')
  const blocked = states.filter(s => s.block?.status === 'blocked')
  const risk = states.filter(s => !s.block && (s.level === 'critical' || s.level === 'warning'))

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="panel-title" style={{ color: '#0f172a' }}>Bloqueos y cumplimiento</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
            {data.settings.enabled
              ? <>Activo desde el {fmtDay(data.settings.start_date)} · {data.settings.max_missed} días incompletos en {data.settings.window_days} días bloquean · recuperación: entrenamiento de {data.settings.min_exercises} ejercicios</>
              : 'Sistema desactivado: no se bloquea a nadie.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ padding: '8px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{loading ? '…' : '🔄 Revisar ahora'}</button>
          <button onClick={() => setShowSettings(s => !s)} style={{ padding: '8px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>⚙️ Ajustes</button>
        </div>
      </div>

      {showSettings && form && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'grid', gap: 5 }}>Sistema activo
            <select value={form.enabled ? '1' : '0'} onChange={e => setForm(f => ({ ...f, enabled: e.target.value === '1' }))} style={{ ...inp, width: 110 }}><option value="1">Sí</option><option value="0">No</option></select>
          </label>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'grid', gap: 5 }}>Empieza el
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ ...inp, width: 150 }} />
          </label>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'grid', gap: 5 }}>Días fallados para bloquear
            <input type="number" min={1} value={form.max_missed} onChange={e => setForm(f => ({ ...f, max_missed: e.target.value }))} style={inp} />
          </label>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'grid', gap: 5 }}>Ventana (días)
            <input type="number" min={7} value={form.window_days} onChange={e => setForm(f => ({ ...f, window_days: e.target.value }))} style={inp} />
          </label>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'grid', gap: 5 }}>Ejercicios para recuperar
            <input type="number" min={1} value={form.min_exercises} onChange={e => setForm(f => ({ ...f, min_exercises: e.target.value }))} style={inp} />
          </label>
          <button onClick={saveSettings} disabled={busy} className="btn-primary" style={{ padding: '9px 16px' }}>Guardar</button>
        </div>
      )}

      {review_.length === 0 && blocked.length === 0 && risk.length === 0 && (
        <div style={{ fontSize: 13.5, color: '#64748b', padding: '6px 0' }}>Ningún entrenador está bloqueado ni en riesgo. 🎉</div>
      )}

      {review_.length > 0 && (
        <Section title={`Pendientes de revisión (${review_.length})`} color="#7c3aed">
          {review_.map(s => {
            const r = recovery[s.block.id]
            return (
              <Row key={s.coachId} s={s}>
                <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#6b21a8' }}>
                    Entrenamiento enviado: {r?.session?.title || 'Entrenamiento'} {r?.session && <Link href={`/dashboard/entrenamientos?session=${r.session.id}`} style={{ fontWeight: 700, color: '#7c3aed', marginLeft: 6 }}>Abrir →</Link>}
                  </div>
                  <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
                    {(r?.exercises || []).map((e, i) => <li key={i}><b>{e.title || 'Ejercicio'}</b>{e.duration_minutes ? ` · ${e.duration_minutes} min` : ''}{e.description ? ` — ${String(e.description).slice(0, 90)}` : ''}</li>)}
                  </ol>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button disabled={busy} onClick={() => review(s.block, true)} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}>✓ Aceptar y desbloquear</button>
                    <button disabled={busy} onClick={() => review(s.block, false)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Rechazar</button>
                  </div>
                </div>
              </Row>
            )
          })}
        </Section>
      )}

      {blocked.length > 0 && (
        <Section title={`Bloqueados (${blocked.length})`} color="#dc2626">
          {blocked.map(s => (
            <Row key={s.coachId} s={s}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 12.5, color: '#64748b' }}>Esperando que cree un entrenamiento de {data.settings.min_exercises} ejercicios{s.block.review_note ? ` · último rechazo: “${s.block.review_note}”` : ''}</span>
                <button disabled={busy} onClick={() => review(s.block, true, 'manual')} style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Desbloquear sin revisión</button>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {risk.length > 0 && (
        <Section title={`En riesgo (${risk.length})`} color="#d97706">
          {risk.map(s => <Row key={s.coachId} s={s} />)}
        </Section>
      )}
    </div>
  )
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  )
}

function Row({ s, children }) {
  const lvl = s.block ? (s.block.status === 'review' ? chip('#f3e8ff', '#7c3aed', '#e9d5ff') : chip('#fee2e2', '#b91c1c', '#fecaca'))
    : s.level === 'critical' ? chip('#fee2e2', '#b91c1c', '#fecaca') : chip('#fef3c7', '#92400e', '#fde68a')
  const text = s.block ? (s.block.status === 'review' ? 'En revisión' : 'Bloqueado') : s.level === 'critical' ? 'Límite alcanzado' : '1 fallo'
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #e8edf3', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>{s.name}</div>
        <span style={lvl}>{text}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.teams.join(', ')}</span>
      </div>
      {s.missed.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {s.missed.map(m => <span key={m.date} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d' }}><b style={{ textTransform: 'capitalize' }}>{fmtDay(m.date)}</b> · {missingText(m)}</span>)}
        </div>
      )}
      {children}
    </div>
  )
}
