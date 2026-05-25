'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [myTeams, setMyTeams]     = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setMyTeams([]); setActiveTeam(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    if (data?.role === 'coach') {
      const { data: tc } = await supabase.from('team_coaches').select('team_id').eq('coach_id', userId)
      const teamIds = (tc || []).map(r => r.team_id)
      if (teamIds.length > 0) {
        const { data: teams } = await supabase.from('teams').select('*').in('id', teamIds).order('name')
        setMyTeams(teams || [])
        setActiveTeam(prev => prev ? (teams || []).find(t => t.id === prev.id) || teams?.[0] || null : teams?.[0] || null)
      }
    }
    setLoading(false)
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
