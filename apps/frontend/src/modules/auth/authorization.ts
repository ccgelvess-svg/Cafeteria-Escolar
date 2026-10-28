import type { AppRole, Permission } from './types'

const rolePermissions: Record<AppRole, ReadonlySet<Permission>> = {
  administrator: new Set<Permission>(['admin:access', 'pos:access', 'pos:charge', 'cash-register:own', 'inventory:read', 'inventory:write']),
  cashier: new Set<Permission>(['pos:access', 'pos:charge', 'cash-register:own']),
  inventory: new Set<Permission>(['inventory:read', 'inventory:write']),
}

export type ProtectedRoute = 'admin' | 'inventory' | 'pos'

const routePermission: Record<ProtectedRoute, Permission> = {
  admin: 'admin:access',
  inventory: 'inventory:read',
  pos: 'pos:access',
}

export function hasPermission(role: AppRole, permission: Permission) {
  return rolePermissions[role].has(permission)
}

export function canAccessRoute(role: AppRole, route: ProtectedRoute) {
  return hasPermission(role, routePermission[route])
}

export function defaultRouteFor(role: AppRole): ProtectedRoute {
  if (role === 'inventory') return 'inventory'
  return role === 'administrator' ? 'admin' : 'pos'
}
