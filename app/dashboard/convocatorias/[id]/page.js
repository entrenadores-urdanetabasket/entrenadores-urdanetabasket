'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

export default function ConvocatoriaDetailPage({ params }) {
  const { user, profile, supabase } = useAuth()
  const router = useRouter()
  const isDirector = profile?.role === 'director'

  const [conv, setConv] = useState(null)
  const [players, setPlayers] = useState([])
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user || !params?.id) return
    loadConvocatoria()
  }, [user, params])

  async function loadConvocatoria() {
    try {
      const { data: c } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('id', params.id)
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
        .eq('convocatoria_id', params.id)

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
    await supabase.from('convocatorias').delete().eq('id', params.id)
    router.replace('/dashboard/convocatorias')
  }

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</div>
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
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Volver */}
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: 13, padding: 0, marginBottom: 16
        }}>← Volver</button>

        {/* Banner principal */}
        <div style={{
          borderRadius: 16, marginBottom: 20, overflow: 'hidden',
          background: 'linear-gradient(135deg,#1C5C2A 0%,#52B043 100%)',
          boxShadow: '0 4px 20px rgba(82,176,67,0.2)', padding: '22px 24px'
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 600,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6
          }}>
            {teamName} · Convocatoria
          </div>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 10 }}>
            vs {conv.rival}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              📅 {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
              {conv.time ? ` · ${conv.time}h` : ''}
            </div>
            {conv.location && (
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                📍 {conv.location}
              </div>
            )}
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginTop: 6 }}>
              👥 {players.length} jugadores convocados
            </div>
          </div>
          {conv.notes && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 10, color: 'rgba(255,255,255,0.9)', fontSize: 12
            }}>
              📝 {conv.notes}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <button onClick={handleCopyWhatsApp} style={{
            padding: '13px 16px', borderRadius: 12,
            border: `1.5px solid ${copied ? '#25D366' : '#25D366'}`,
            backgroundColor: copied ? '#25D366' : '#fff',
            color: copied ? '#fff' : '#25D366',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            {copied ? '✓ ¡Copiado!' : '📲 Copiar para WhatsApp'}
          </button>
          <button onClick={() => window.print()} style={{
            padding: '13px 16px', borderRadius: 12,
            border: '1.5px solid #3b82f6',
            backgroundColor: '#fff', color: '#3b82f6',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🖨️ Exportar PDF
          </button>
        </div>

        {/* Lista de jugadores */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 16, padding: 20,
          border: '1px solid #f3f4f6', marginBottom: 20
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16
          }}>
            Jugadores convocados
          </div>

          {players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
              No se seleccionaron jugadores
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10, backgroundColor: '#f9fafb'
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg,#52B043,#1C5C2A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 900
                  }}>{p.number ?? '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.position || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eliminar — solo entrenador */}
        {!isDirector && (
          <button onClick={handleDelete} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '1.5px solid #fecaca', backgroundColor: '#fef2f2',
            color: '#ef4444', fontSize: 13, fontWeight: 700,
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
