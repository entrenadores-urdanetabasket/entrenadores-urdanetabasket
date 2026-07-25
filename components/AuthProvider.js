'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AuthContext = createContext({})

// Evita que una consulta colgada (red lenta/caida) deje la app cargando para siempre
function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [myTeams, setMyTeams]     = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()

  useEffect(() => {
    withTimeout(supabase.auth.getSession())
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        else setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setMyTeams([]); setActiveTeam(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await withTimeout(supabase.from('profiles').select('*').eq('id', userId).single())
      setProfile(data)
      if (data?.role === 'coach') {
        const { data: tc } = await withTimeout(supabase.from('team_coaches').select('team_id').eq('coach_id', userId))
        const teamIds = (tc || []).map(r => r.team_id)
        if (teamIds.length > 0) {
          const { data: teams } = await withTimeout(supabase.from('teams').select('*').in('id', teamIds).order('name'))
          setMyTeams(teams || [])
          setActiveTeam(prev => prev ? (teams || []).find(t => t.id === prev.id) || teams?.[0] || null : teams?.[0] || null)
        }
      }
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
