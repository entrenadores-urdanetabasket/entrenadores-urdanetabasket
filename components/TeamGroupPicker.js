'use client'

import { useState } from 'react'
import { sortTeamsByCategory, categoryGroup } from '@/lib/teamCategoryOrder'

// Selector de equipo para el director: con muchos equipos, los separa en
// Escolares/Federados y los ordena de categoría más baja a más alta,
// en vez de una lista plana alfabética.
export default function TeamGroupPicker({ teams, selectedTeamId, onSelect, activeColor = 'linear-gradient(135deg,#52B043,#3a8a2e)' }) {
  const [group, setGroup] = useState(() => {
    const sel = teams.find(t => t.id === selectedTeamId)
    return sel ? categoryGroup(sel.category) : 'escolar'
  })

  const schoolTeams = sortTeamsByCategory(teams.filter(t => categoryGroup(t.category) === 'escolar'))
  const federatedTeams = sortTeamsByCategory(teams.filter(t => categoryGroup(t.category) === 'federado'))
  const shown = group === 'escolar' ? schoolTeams : federatedTeams

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[{ key: 'escolar', label: '🎒 Escolares', list: schoolTeams }, { key: 'federado', label: '🏅 Federados', list: federatedTeams }].map(g => {
          const active = group === g.key
          return (
            <button key={g.key} onClick={() => setGroup(g.key)} style={{
              padding: '6px 13px', borderRadius: 18, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: 'none',
              background: active ? '#1f2937' : '#f1f5f9',
              color: active ? '#fff' : '#64748b',
            }}>{g.label} ({g.list.length})</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {shown.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#9ca3af', padding: '6px 2px' }}>Sin equipos {group === 'escolar' ? 'escolares' : 'federados'}</div>
        ) : shown.map(t => {
          const active = selectedTeamId === t.id
          return (
            <button key={t.id} onClick={() => onSelect(t)} style={{
              padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: active ? activeColor : '#fff',
              color: active ? '#fff' : '#475569',
              border: active ? 'none' : '1.5px solid #e2e8f0',
              boxShadow: active ? '0 2px 8px rgba(82,176,67,0.30)' : 'none',
              transition: 'all 0.15s',
            }}>{t.name}</button>
          )
        })}
      </div>
    </div>
  )
}
