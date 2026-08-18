'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

function fileIcon(type = '') {
  if (type.includes('pdf')) return '📄'
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📊'
  if (type.includes('image')) return '🖼️'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('presentation') || type.includes('powerpoint')) return '📽️'
  if (type.includes('zip') || type.includes('compressed')) return '🗜️'
  return '📁'
}

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentosPage() {
  const { user, profile, supabase, myTeams, activeTeam } = useAuth()
  const isDirector = profile?.role === 'director'
  const fileInputRef = useRef(null)

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState('mios') // 'mios' | 'compartidos'
  const [sharedDocs, setSharedDocs] = useState([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharingId, setSharingId] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    if (!user || !profile) return
    if (!isDirector && !activeTeam) return
    loadTeams()
  }, [user, profile, activeTeam])

  async function loadTeams() {
    setLoading(true)
    if (isDirector) {
      const { data } = await supabase.from('teams').select('*').eq('active', true).order('name')
      setTeams(data || [])
      if (data?.length > 0) await loadDocuments(data[0])
      else setLoading(false)
    } else {
      if (!activeTeam) { setLoading(false); return }
      setTeams(myTeams)
      await loadDocuments(activeTeam)
    }
  }

  async function loadDocuments(team) {
    setSelectedTeam(team)
    const { data } = await supabase.from('documents').select('*').eq('team_id', team.id).order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  async function loadSharedDocuments() {
    setSharedLoading(true)
    const { data: allTeams } = await supabase.from('teams').select('id').eq('active', true)
    const teamIds = (allTeams || []).map(t => t.id)
    if (teamIds.length === 0) { setSharedDocs([]); setSharedLoading(false); return }

    const { data } = await supabase
      .from('documents')
      .select('*, teams(name)')
      .eq('shared', true)
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })

    setSharedDocs(data || [])
    setSharedLoading(false)
  }

  async function handleFilePicked(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedTeam) return
    setUploadError('')
    if (file.size > MAX_SIZE) { setUploadError('El archivo pesa más de 25 MB — súbelo comprimido o en partes.'); return }

    setUploading(true)
    const path = `${selectedTeam.id}/${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) {
      setUploadError('No se pudo subir el archivo. Inténtalo de nuevo.')
      setUploading(false)
      return
    }
    await supabase.from('documents').insert({
      team_id: selectedTeam.id,
      uploaded_by: user.id,
      title: file.name,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
    })
    setUploading(false)
    await loadDocuments(selectedTeam)
  }

  async function handleToggleShared(doc) {
    const newShared = !doc.shared
    setSharingId(doc.id)
    await supabase.from('documents').update({ shared: newShared }).eq('id', doc.id)
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, shared: newShared } : d))
    setSharingId(null)
    if (tab === 'compartidos') await loadSharedDocuments()
  }

  async function handleDelete(doc) {
    if (!confirm(`¿Eliminar «${doc.title}»?`)) return
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  async function handleDownload(doc) {
    setDownloadingId(doc.id)
    const { data, error } = await supabase.storage.from('documents').download(doc.file_path)
    setDownloadingId(null)
    if (error || !data) { alert('No se pudo descargar el archivo.'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = doc.file_name || doc.title
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabStyle = (t) => ({
    padding: '9px 18px', borderRadius: 20, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
    background: tab === t ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
    color: tab === t ? '#fff' : '#475569',
    border: tab === t ? 'none' : '1.5px solid #e2e8f0',
    boxShadow: tab === t ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
  })

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>

  if (!selectedTeam && tab !== 'compartidos') return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ fontSize: 56 }}>📁</div>
      <h2 className="empty-state-title" style={{ fontSize: 20, fontWeight: 800 }}>Sin equipo asignado</h2>
      <p className="empty-state-text" style={{ fontSize: 14 }}>El director deportivo te asignará un equipo en breve.</p>
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{
        background: 'linear-gradient(135deg, #0a1f0e 0%, #1C5C2A 50%, #2d7a3a 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,31,14,0.35)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>
            {tab === 'compartidos' ? 'Compartidos en el club' : (selectedTeam?.name || 'Archivador')}
          </p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>Documentos</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, fontWeight: 500 }}>
            {tab === 'compartidos' ? 'Documentos compartidos por todos los entrenadores' : `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`}
          </p>
        </div>
        {tab !== 'compartidos' ? (
          <>
            <input ref={fileInputRef} type="file" onChange={handleFilePicked} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary" style={{ flexShrink: 0 }}>
              {uploading ? '⏳ Subiendo...' : '+ Subir archivo'}
            </button>
          </>
        ) : <div style={{ fontSize: 48, opacity: 0.35 }}>📁</div>}
      </div>

      {uploadError && (
        <div style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
          {uploadError}
        </div>
      )}

      {/* Selector de equipo — solo en "Mis documentos" */}
      {tab !== 'compartidos' && isDirector && teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {teams.map(t => {
            const active = selectedTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => { setLoading(true); loadDocuments(t) }} style={{
                padding: '8px 15px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: active ? 'linear-gradient(135deg,#52B043,#3a8a2e)' : '#fff',
                color: active ? '#fff' : '#475569',
                border: active ? 'none' : '1.5px solid #e2e8f0',
                boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none'
              }}>{t.name}</button>
            )
          })}
        </div>
      )}

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('mios')} style={tabStyle('mios')}>📁 Mis documentos</button>
        <button onClick={() => { setTab('compartidos'); loadSharedDocuments() }} style={{
          ...tabStyle('compartidos'),
          background: tab === 'compartidos' ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f3f4f6',
          color: tab === 'compartidos' ? '#fff' : '#374151',
        }}>📤 Compartidos</button>
      </div>

      {/* PESTAÑA COMPARTIDOS */}
      {tab === 'compartidos' ? (
        sharedLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Cargando documentos compartidos...</div>
          </div>
        ) : sharedDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.55 }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sin documentos compartidos todavía</div>
            <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
              Cuando un entrenador suba un documento y pulse <strong>«Compartir con el club»</strong>, aparecerá aquí para que todos puedan descargarlo.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sharedDocs.map(doc => (
              <div key={doc.id} style={{
                backgroundColor: '#fff', borderRadius: 14, padding: '14px 16px',
                border: '1px solid #ede9fe', boxShadow: '0 1px 4px rgba(124,58,237,0.06)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{fileIcon(doc.file_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5b21b6', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: 5 }}>🏀 {doc.teams?.name || 'Equipo'}</span>
                    {doc.file_size && <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtSize(doc.file_size)}</span>}
                  </div>
                </div>
                <button onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id} style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: '#fff', flexShrink: 0,
                }}>
                  {downloadingId === doc.id ? '⏳' : '⬇ Descargar'}
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {documents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📁</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin documentos todavía</div>
              <div style={{ fontSize: 13 }}>Sube el primero con el botón de arriba</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#1C5C2A,#52B043)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{fileIcon(doc.file_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                    {doc.shared && (
                      <span title="Compartido con el club" style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 7px', borderRadius: 5, flexShrink: 0 }}>📤 Compartido</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                    {fmtSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    {downloadingId === doc.id ? '⏳' : '⬇'}
                  </button>
                  <button
                    onClick={() => handleToggleShared(doc)}
                    disabled={sharingId === doc.id}
                    title={doc.shared ? 'Dejar de compartir' : 'Compartir con el club'}
                    style={{
                      padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      border: doc.shared ? 'none' : '1.5px solid #ddd6fe',
                      background: doc.shared ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#f5f3ff',
                      color: doc.shared ? '#fff' : '#7c3aed',
                      opacity: sharingId === doc.id ? 0.6 : 1,
                    }}>
                    📤
                  </button>
                  <button onClick={() => handleDelete(doc)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
