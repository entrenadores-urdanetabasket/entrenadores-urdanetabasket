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
      if (document.visibilityState !== 'visible') return
      const path = pathRef.current
      try {
        await supabase.from('activity_pings').insert({ coach_id: user.id, path, section: sectionFromPath(path) })
      } catch {
        // El seguimiento de uso nunca debe romper la app
      }
    }

    ping()
    const id = setInterval(ping, PING_INTERVAL_SECONDS * 1000)
    return () => clearInterval(id)
  }, [user])

  return null
}
