export type AppRole = 'administrator' | 'cashier' | 'inventory'

export type Permission =
  | 'admin:access'
  | 'pos:access'
  | 'pos:charge'
  | 'cash-register:own'
  | 'inventory:read'
  | 'inventory:write'

export interface AuthenticatedUser {
  id: string
  displayName: string
  email: string
  role: AppRole
  cashRegisterId?: string
  cashRegisterName?: string
}

export interface AuthSession {
  authenticated: true
  user: AuthenticatedUser
  expiresAt?: string
}

export type SessionResult =
  | AuthSession
  | { authenticated: false; configured: boolean }
