import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { supabase } from '../../infrastructure/supabase/client'
import { getSession, signIn, signOut } from './authClient'
import { hasPermission } from './authorization'
import type { AuthSession, Permission } from './types'

interface AuthContextValue {
  session: AuthSession | null
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'unconfigured' | 'error'
  error: string
  can(permission: Permission): boolean
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await getSession()
      if (result.authenticated) { setSession(result); setStatus('authenticated') }
      else { setSession(null); setStatus(result.configured ? 'unauthenticated' : 'unconfigured') }
      setError('')
    } catch (cause) {
      setSession(null); setStatus('error')
      setError(cause instanceof Error ? cause.message : 'No fue posible verificar la sesión.')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const subscription = supabase?.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0)
    }).data.subscription
    return () => subscription?.unsubscribe()
  }, [refresh])

  const value = useMemo<AuthContextValue>(() => ({
    session, status, error,
    can: (permission) => Boolean(session && hasPermission(session.user.role, permission)),
    refresh: () => refresh(),
    login: async (email, password) => { await signIn(email, password); await refresh() },
    logout: async () => { await signOut(); setSession(null); setStatus('unauthenticated') },
  }), [session, status, error, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return context
}
