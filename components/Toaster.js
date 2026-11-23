'use client'

import { useEffect, useState } from 'react'

export default function Toaster() {
  const [items, setItems] = useState([])

  useEffect(() => {
    function onToast(e) {
      const id = Math.random().toString(36).slice(2)
      const { message, type } = e.detail || {}
      setItems(list => [...list.slice(-3), { id, message, type, out: false }])
      setTimeout(() => setItems(list => list.map(t => t.id === id ? { ...t, out: true } : t)), 3200)
      setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 3500)
    }
    window.addEventListener('urdaneta-toast', onToast)
    return () => window.removeEventListener('urdaneta-toast', onToast)
  }, [])

  if (!items.length) return null
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast${t.type === 'error' ? ' error' : ''}${t.out ? ' out' : ''}`}>
          {t.type === 'error' ? <span style={{ fontSize: 16 }}>⚠️</span> : <span className="toast-ball" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
