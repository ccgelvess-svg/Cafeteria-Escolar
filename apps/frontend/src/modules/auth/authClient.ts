import { isSupabaseConfigured, requireSupabase } from '../../infrastructure/supabase/client'
import { normalizeAuthEmail, signInErrorMessage } from './authErrors'
import type { AppRole, AuthSession, SessionResult } from './types'

const validRoles = new Set<AppRole>(['administrator', 'cashier', 'inventory'])

export async function getSession(): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { authenticated: false, configured: false }
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return { authenticated: false, configured: true }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('display_name,role,cash_register_id,active,cash_registers(name)')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (profileError) throw new Error('No fue posible consultar el perfil autorizado.')
  if (!profile || !profile.active || !validRoles.has(profile.role as AppRole)) {
    await client.auth.signOut()
    throw new Error('La cuenta no tiene un rol activo asignado.')
  }

  const { data: sessionData } = await client.auth.getSession()
  const cashRegister = Array.isArray(profile.cash_registers)
    ? profile.cash_registers[0]
    : profile.cash_registers
  const session: AuthSession = {
    authenticated: true,
    user: {
      id: userData.user.id,
      email: userData.user.email ?? '',
      displayName: profile.display_name,
      role: profile.role as AppRole,
      cashRegisterId: profile.cash_register_id ?? undefined,
      cashRegisterName: cashRegister?.name ?? undefined,
    },
    expiresAt: sessionData.session?.expires_at
      ? new Date(sessionData.session.expires_at * 1000).toISOString()
      : undefined,
  }
  return session
}

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({
    email: normalizeAuthEmail(email),
    password,
  })
  if (error) throw new Error(signInErrorMessage(error.code))
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw new Error('No fue posible cerrar la sesión.')
}
