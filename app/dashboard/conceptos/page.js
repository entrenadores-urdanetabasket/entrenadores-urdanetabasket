'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import dynamic from 'next/dynamic'
import ModalPortal from '@/components/ModalPortal'

const CourtEditor = dynamic(() => import('@/components/CourtEditor'), { ssr: false })

const CATS = {
  ofensivo: { label: 'Ofensivos', emoji: '🔵', color: '#2563eb', dark: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  defensivo: { label: 'Defensivos', emoji: '🔴', color: '#dc2626', dark: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

export default function ConceptosPage() {
  const { user, profile, supabase } = useAuth()
  const isDirector = profile?.role === 'director'

  const [tab, setTab] = useState('ofensivo') // 'ofensivo' | 'defensivo'
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)

  const [openEditor, setOpenEditor] = useState(false)
  const [editingConcept, setEditingConcept] = useState(null)
  const [viewingConcept, setViewingConcept] = useState(null)

  useEffect(() => { if (user && profile) loadConcepts(tab) }, [user, profile, tab])

  async function loadConcepts(category) {
    setLoading(true)
    const { data } = await supabase.from('concepts').select('*').eq('category', category).order('created_at', { ascending: false })
    setConcepts(data || [])
    setLoading(false)
  }

  async function handleSave({ title, description, steps, courtType }) {
    const payload = {
      category: editingConcept ? editingConcept.category : tab,
      title: title || 'Concepto sin nombre',
      description,
      play_data: { steps, courtType },
      created_by: user.id,
    }
    if (editingConcept?.id) await supabase.from('concepts').update(payload).eq('id', editingConcept.id)
    else await supabase.from('concepts').insert(payload)
    setOpenEditor(false)
    setEditingConcept(null)
    await loadConcepts(tab)
  }

  async function handleDelete(concept, e) {
    e?.stopPropagation()
    if (!confirm(`¿Eliminar el concepto «${concept.title}»?`)) return
    await supabase.from('concepts').delete().eq('id', concept.id)
    setConcepts(prev => prev.filter(c => c.id !== concept.id))
  }

  function openConcept(concept) {
    const canEdit = concept.created_by === user.id || isDirector
    if (canEdit) { setEditingConcept(concept); setOpenEditor(true) }
    else setViewingConcept(concept)
  }

  const cat = CATS[tab]

  // Editor a pantalla completa: crear/editar concepto propio
  if (openEditor) {
    const initData = editingConcept
      ? { title: editingConcept.title, description: editingConcept.description || '', steps: editingConcept.play_data?.steps || [], courtType: editingConcept.play_data?.courtType }
      : null
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            initialData={initData}
            onSave={handleSave}
            onClose={() => { setOpenEditor(false); setEditingConcept(null) }}
            notesPanel
            visionCones={(editingConcept ? editingConcept.category : tab) === 'defensivo'}
          />
        </div>
      </ModalPortal>
    )
  }

  // Visor a pantalla completa: concepto de otro entrenador, solo lectura + animar
  if (viewingConcept) {
    const vc = CATS[viewingConcept.category]
    return (
      <ModalPortal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <CourtEditor
            readOnly
            initialData={{
              title: viewingConcept.title,
              description: viewingConcept.description || '',
              steps: viewingConcept.play_data?.steps || [],
              courtType: viewingConcept.play_data?.courtType,
            }}
            onClose={() => setViewingConcept(null)}
            readOnlyLabel={`${vc.emoji} ${vc.label.replace(/s$/, '')}`}
            notesPanel
            visionCones={viewingConcept.category === 'defensivo'}
          />
        </div>
      </ModalPortal>
    )
  }

  return (
    <div className="fade-in">
      <div style={{
        background: `linear-gradient(135deg, ${cat.dark} 0%, ${cat.color} 100%)`,
        borderRadius: 20, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: `0 8px 32px ${cat.color}40`, transition: 'background 0.2s',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            Biblioteca del club
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Conceptos {cat.label.toLowerCase()}</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {concepts.length} {concepts.length === 1 ? 'concepto' : 'conceptos'} explicados en la pizarra
          </p>
        </div>
        <button onClick={() => { setEditingConcept(null); setOpenEditor(true) }} style={{
          background: '#fff', color: cat.dark, border: 'none', borderRadius: 12,
          padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        }}>
          + Nuevo concepto
        </button>
      </div>

      {/* Selector grande de categoría */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        {Object.entries(CATS).map(([key, c]) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              fontSize: 15, fontWeight: 800, transition: 'all 0.15s',
              background: active ? `linear-gradient(135deg,${c.dark},${c.color})` : '#fff',
              color: active ? '#fff' : '#374151',
              border: active ? 'none' : `1.5px solid ${c.border}`,
              boxShadow: active ? `0 4px 16px ${c.color}45` : 'none',
            }}>
              <span style={{ fontSize: 18 }}>{c.emoji}</span> {c.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14 }}>Cargando conceptos...</div>
        </div>
      ) : concepts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 16, border: `1px solid ${cat.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>{cat.emoji}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin conceptos {cat.label.toLowerCase()} todavía</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Dibuja el primero en la pizarra para que todo el club lo entienda de un vistazo</div>
          <button onClick={() => { setEditingConcept(null); setOpenEditor(true) }} style={{
            background: `linear-gradient(135deg,${cat.dark},${cat.color})`, color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>+ Crear concepto</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {concepts.map(c => {
            const stepCount = c.play_data?.steps?.length || 0
            const mine = c.created_by === user.id || isDirector
            return (
              <div key={c.id} onClick={() => openConcept(c)} style={{
                backgroundColor: '#fff', borderRadius: 16, border: `1px solid ${cat.border}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 20px ${cat.color}25`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{
                  height: 84, background: `linear-gradient(135deg, ${cat.bg}, #fff)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                  borderBottom: `1px solid ${cat.border}`,
                }}>{cat.emoji}</div>
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{c.title}</div>
                  {c.description && (
                    <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {c.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{stepCount} {stepCount === 1 ? 'fase' : 'fases'}</span>
                    {mine ? (
                      <button onClick={e => handleDelete(c, e)} style={{ padding: '4px 9px', borderRadius: 7, border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>▶ Ver y animar</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
