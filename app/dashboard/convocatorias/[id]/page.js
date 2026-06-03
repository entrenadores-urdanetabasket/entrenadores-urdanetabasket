'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'

export default function ConvocatoriaDetailPage() {
  const { user, profile, supabase } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const isDirector = profile?.role === 'director'

  const [conv, setConv] = useState(null)
  const [players, setPlayers] = useState([])
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    loadConvocatoria()
  }, [user, id])

  async function loadConvocatoria() {
    try {
      const { data: c } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('id', id)
        .single()

      if (!c) { router.replace('/dashboard/convocatorias'); return }
      setConv(c)

      // Nombre del equipo
      const { data: t } = await supabase.from('teams').select('name').eq('id', c.team_id).single()
      setTeamName(t?.name || '')

      // Jugadores convocados
      const { data: cp } = await supabase
        .from('convocatoria_players')
        .select('player_id, players(id, full_name, number, position)')
        .eq('convocatoria_id', id)

      const list = (cp || []).map(r => r.players).filter(Boolean)
      list.sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
      setPlayers(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function buildWhatsAppText() {
    const dateObj = new Date(conv.date + 'T12:00:00')
    const dateStr = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    let text = `🏀 *CONVOCATORIA*\n`
    text += `🆚 Rival: *${conv.rival}*\n`
    text += `📅 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`
    if (conv.time) text += ` · ${conv.time}h`
    text += '\n'
    if (conv.location) text += `📍 ${conv.location}\n`
    text += `\n*CONVOCADOS (${players.length}):*\n`
    players.forEach(p => {
      text += `${p.number != null ? `#${p.number}  ` : ''}${p.full_name}\n`
    })
    if (conv.notes) text += `\n📝 ${conv.notes}\n`
    text += '\n¡Mucho ánimo! 💪'
    return text
  }

  async function handleCopyWhatsApp() {
    try {
      await navigator.clipboard.writeText(buildWhatsAppText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('No se pudo copiar al portapapeles')
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta convocatoria? Esta acción no se puede deshacer.')) return
    await supabase.from('convocatorias').delete().eq('id', id)
    router.replace('/dashboard/convocatorias')
  }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
  if (!conv) return null

  const dateObj = new Date(conv.date + 'T12:00:00')
  const dateStr = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const dateStrShort = dateObj.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <>
      <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Volver */}
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', fontSize: 13, fontWeight: 700, padding: 0, marginBottom: 16
        }}>← Volver</button>

        {/* Banner principal */}
        <div style={{
          borderRadius: 18, marginBottom: 20, overflow: 'hidden',
          background: 'linear-gradient(135deg, #1C5C2A 0%, #2d7a3a 50%, #52B043 100%)',
          boxShadow: '0 4px 20px rgba(28,92,42,0.25)', padding: '24px 24px'
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8
          }}>
            {teamName} · Convocatoria
          </div>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 12, letterSpacing: -0.5 }}>
            vs {conv.rival}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
              📅 {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
              {conv.time ? ` · ${conv.time}h` : ''}
            </div>
            {conv.location && (
              <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 500 }}>
                📍 {conv.location}
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', color: '#fff', fontWeight: 800, fontSize: 13, marginTop: 8, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.20)', padding: '5px 12px', borderRadius: 20 }}>
              👥 {players.length} jugadores convocados
            </div>
          </div>
          {conv.notes && (
            <div style={{
              marginTop: 16, padding: '11px 14px',
              backgroundColor: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 12, color: 'rgba(255,255,255,0.92)', fontSize: 12.5, lineHeight: 1.5
            }}>
              📝 {conv.notes}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <button onClick={handleCopyWhatsApp} style={{
            padding: '14px 16px', borderRadius: 12, border: 'none',
            background: copied ? 'linear-gradient(135deg,#25D366,#1da851)' : 'linear-gradient(135deg,#25D366,#1da851)',
            color: '#fff',
            fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37,211,102,0.35)',
            transition: 'all 0.2s',
          }}>
            {copied ? '✓ ¡Copiado!' : '📲 Copiar para WhatsApp'}
          </button>
          <button onClick={() => window.print()} style={{
            padding: '14px 16px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff',
            fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37,99,235,0.35)',
          }}>
            🖨️ Exportar PDF
          </button>
        </div>

        {/* Lista de jugadores */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, padding: 20,
          border: '1px solid #e8edf3', marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: '#334155',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16
          }}>
            Jugadores convocados
          </div>

          {players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
              No se seleccionaron jugadores
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 13px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #eef2f7'
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 900,
                    boxShadow: '0 2px 6px rgba(28,92,42,0.20)'
                  }}>{p.number ?? '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', letterSpacing: -0.2 }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{p.position || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eliminar — solo entrenador */}
        {!isDirector && (
          <button onClick={handleDelete} style={{
            width: '100%', padding: '13px', borderRadius: 12,
            border: '1.5px solid #fecaca', backgroundColor: '#fef2f2',
            color: '#dc2626', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', marginBottom: 40,
          }}>
            🗑️ Eliminar convocatoria
          </button>
        )}
      </div>

      {/* ── Estilos de impresión (PDF) ── */}
      <style>{`
        @media print {
          /* Ocultar todo lo que no sea contenido */
          button, a[href^="/dashboard"],
          .sidebar-desktop, .sidebar-mobile,
          .mobile-menu-btn { display: none !important; }

          body { background: #fff !important; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Forzar colores en el banner */
          div[style*="linear-gradient"] {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        @page { margin: 20mm; }
      `}</style>
    </>
  )
}
