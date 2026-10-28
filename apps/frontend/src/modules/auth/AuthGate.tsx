import { LockKeyhole, ShieldAlert } from 'lucide-react'

import { canAccessRoute, defaultRouteFor, type ProtectedRoute } from './authorization'
import { useAuth } from './AuthProvider'
import { LoginForm } from './LoginForm'

export function AuthGate({ route, children }: { route: ProtectedRoute; children: React.ReactNode }) {
  const { session, status, error, refresh } = useAuth()

  if (status === 'loading') return <AuthMessage title="Verificando sesión" detail="Conectando con el servicio seguro de identidad…" />
  if (status === 'unconfigured') return <AuthMessage title="Supabase pendiente de configurar" detail="Define la URL del proyecto y su clave publicable. La interfaz permanecerá bloqueada hasta entonces." warning />
  if (status === 'error') return <AuthMessage title="No se pudo validar la sesión" detail={error} action={<button className="admin-primary-button" onClick={() => void refresh()} type="button">Reintentar</button>} warning />
  if (status === 'unauthenticated' || !session) return <AuthMessage title="Inicia sesión" detail="Usa la cuenta institucional creada en Supabase Auth." action={<LoginForm />} />
  if (!canAccessRoute(session.user.role, route)) {
    const allowedRoute = defaultRouteFor(session.user.role)
    return <AuthMessage title="Acceso restringido" detail="Tu rol no tiene permiso para abrir esta sección." action={<a className="admin-primary-button" href={`#/${allowedRoute}`}>Ir a mi área</a>} warning />
  }
  return children
}

function AuthMessage({ title, detail, action, warning = false }: { title: string; detail: string; action?: React.ReactNode; warning?: boolean }) {
  const Icon = warning ? ShieldAlert : LockKeyhole
  return <main className="grid min-h-dvh place-items-center bg-slate-100 p-4"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl"><div className={`mx-auto grid size-14 place-items-center rounded-full ${warning ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}><Icon aria-hidden="true" className="size-7" /></div><h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1><p className="mt-2 text-sm font-semibold text-slate-600">{detail}</p>{action && <div className="mt-5 block">{action}</div>}<p className="mt-5 text-xs text-slate-400">La autorización se valida con Supabase Auth y políticas RLS.</p></section></main>
}
