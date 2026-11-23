'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AuthContext = createContext({})

// Evita que una consulta colgada (red lenta/caida) deje la app cargando para siempre
function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// Mantiene la misma referencia si el contenido no ha cambiado. Evita que las pantallas se recarguen
// (y parpadeen) cuando Supabase vuelve a emitir eventos de sesión al volver a la pestaña en el móvil.
const sameData = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false } }
const keepIfSame = (prev, next) => (sameData(prev, next) ? prev : next)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [myTeams, setMyTeams]     = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()
  const profileLoadedFor = useRef(null) // id del usuario cuyo perfil ya está cargado

  useEffect(() => {
    withTimeout(supabase.auth.getSession())
      .then(({ data: { session } }) => {
        setUser(prev => keepIfSame(prev, session?.user ?? null))
        if (session?.user) fetchProfile(session.user.id)
        else setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(prev => (prev && u && prev.id === u.id ? prev : u))
      if (u) {
        // SIGNED_IN / TOKEN_REFRESHED se repiten al volver a la pestaña: si es el mismo usuario y su perfil ya está cargado, no hay nada que recargar
        const repeated = (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && profileLoadedFor.current === u.id
        if (!repeated) fetchProfile(u.id)
      } else { profileLoadedFor.current = null; setProfile(null); setMyTeams([]); setActiveTeam(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await withTimeout(supabase.from('profiles').select('*').eq('id', userId).single())
      setProfile(prev => keepIfSame(prev, data))
      if (data?.role === 'coach') {
        const { data: tc } = await withTimeout(supabase.from('team_coaches').select('team_id').eq('coach_id', userId))
        const teamIds = (tc || []).map(r => r.team_id)
        if (teamIds.length > 0) {
          const { data: teams } = await withTimeout(supabase.from('teams').select('*').in('id', teamIds).eq('active', true).order('name'))
          setMyTeams(prev => keepIfSame(prev, teams || []))
          setActiveTeam(prev => keepIfSame(prev, prev ? (teams || []).find(t => t.id === prev.id) || teams?.[0] || null : teams?.[0] || null))
        }
      }
      profileLoadedFor.current = userId
    } catch (err) {
      // Red lenta/caida: no dejar la app colgada en "Cargando..." para siempre
      console.error('fetchProfile failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await fetchProfile(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, myTeams, activeTeam, setActiveTeam, loading, supabase, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
