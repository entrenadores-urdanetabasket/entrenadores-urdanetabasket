'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { PING_INTERVAL_SECONDS } from '@/lib/activityConfig'

function sectionFromPath(path) {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'live') return 'live'
  if (parts[0] !== 'dashboard') return 'otro'
  return parts[1] || 'inicio'
}

export default function ActivityTracker() {
  const { user, supabase } = useAuth()
  const pathname = usePathname()
  const pathRef = useRef(pathname)

  useEffect(() => { pathRef.current = pathname }, [pathname])

  useEffect(() => {
    if (!user) return

    async function ping() {
      if (document.visibilityState !== 'visible') { console.log('[activity ping] omitido, pestaña no visible'); return }
      const path = pathRef.current
      try {
        const { error } = await supabase.from('activity_pings').insert({ coach_id: user.id, path, section: sectionFromPath(path) })
        if (error) console.error('[activity ping] error al guardar:', error)
        else console.log('[activity ping] guardado', new Date().toISOString())
      } catch (err) {
        console.error('[activity ping] excepción:', err)
      }
    }

    ping()
    const id = setInterval(ping, PING_INTERVAL_SECONDS * 1000)
    return () => clearInterval(id)
  }, [user])

  return null
}
