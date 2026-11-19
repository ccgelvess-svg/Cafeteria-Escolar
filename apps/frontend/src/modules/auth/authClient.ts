import { isSupabaseConfigured, requireSupabase } from '../../infrastructure/supabase/client'
import { readOfflineSnapshot, writeOfflineSnapshot } from '../../infrastructure/storage/offlineDatabase'
import { isConnectivityError } from '../../infrastructure/sync/outbox'
import { isOnlineForDataAccess } from '../../infrastructure/sync/connectivity'
import { normalizeAuthEmail, signInErrorMessage } from './authErrors'
import type { AppRole, AuthSession, SessionResult } from './types'

const validRoles = new Set<AppRole>(['administrator', 'cashier', 'inventory'])
const OFFLINE_PROFILE_MAX_AGE_MS = 8 * 60 * 60 * 1000

interface CachedProfile {
  userId: string
  verifiedAt: string
  session: AuthSession
}

function cachedProfileKey(userId: string) { return `auth-profile:${userId}` }

async function readVerifiedOfflineSession(userId: string) {
  const cached = await readOfflineSnapshot<CachedProfile>(cachedProfileKey(userId))
  if (!cached || cached.userId !== userId) return null
  const verifiedAt = Date.parse(cached.verifiedAt)
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > OFFLINE_PROFILE_MAX_AGE_MS) return null
  return cached.session
}

export async function getSession(): Promise<SessionResult> {
  if (!isSupabaseConfigured) return { authenticated: false, configured: false }
  const client = requireSupabase()
  const { data: sessionData } = await client.auth.getSession()
  const localUser = sessionData.session?.user
  if (!localUser) return { authenticated: false, configured: true }

  if (!isOnlineForDataAccess()) {
    const cached = await readVerifiedOfflineSession(localUser.id)
    if (cached) return cached
    throw new Error('La sesión offline no está verificada o venció. Conecta el equipo para validarla.')
  }
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    if (userError && isConnectivityError(new Error(userError.message))) {
      const cached = await readVerifiedOfflineSession(localUser.id)
      if (cached) return cached
    }
    return { authenticated: false, configured: true }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('display_name,role,cash_register_id,active,cash_registers(name)')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    if (isConnectivityError(new Error(profileError.message))) {
      const cached = await readVerifiedOfflineSession(localUser.id)
      if (cached) return cached
    }
    throw new Error('No fue posible consultar el perfil autorizado.')
  }
  if (!profile || !profile.active || !validRoles.has(profile.role as AppRole)) {
    await client.auth.signOut()
    throw new Error('La cuenta no tiene un rol activo asignado.')
  }

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
  try {
    await writeOfflineSnapshot(cachedProfileKey(userData.user.id), {
      userId: userData.user.id,
      verifiedAt: new Date().toISOString(),
      session,
    } satisfies CachedProfile)
  } catch { /* an online session remains valid if the offline cache is unavailable */ }
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
  const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
  if (error) throw new Error('No fue posible cerrar la sesión.')
}
