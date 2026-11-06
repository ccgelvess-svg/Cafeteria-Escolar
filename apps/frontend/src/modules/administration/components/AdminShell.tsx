import { useEffect, useState } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  Boxes,
  CircleDollarSign,
  Cloud,
  CloudOff,
  FileChartColumn,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MonitorCog,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'

import type { AdministrationSection } from '../types'
import { useAuth } from '../../auth'
import { supabase } from '../../../infrastructure/supabase/client'

type ConnectivityStatus = 'checking' | 'connected' | 'offline' | 'unavailable'

interface NavigationItem {
  id: AdministrationSection
  label: string
  icon: LucideIcon
}

const navigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Estudiantes', icon: UsersRound },
  { id: 'balances', label: 'Saldos y deudas', icon: CircleDollarSign },
  { id: 'inventory', label: 'Inventarios', icon: Boxes },
  { id: 'users', label: 'Usuarios y cajeros', icon: ShieldCheck },
  { id: 'registers', label: 'Cajas', icon: Store },
  { id: 'sales', label: 'Ventas', icon: ShoppingBag },
  { id: 'reports', label: 'Reportes', icon: FileChartColumn },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

interface AdminShellProps {
  activeSection: AdministrationSection
  onSectionChange: (section: AdministrationSection) => void
  children: React.ReactNode
}

export function AdminShell({ activeSection, onSectionChange, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>('checking')
  const { session, logout } = useAuth()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true

    async function checkConnectivity() {
      if (!window.navigator.onLine) {
        if (active) setConnectivity('offline')
        return
      }
      if (!supabase) {
        if (active) setConnectivity('unavailable')
        return
      }

      const { error } = await supabase.auth.getUser()
      if (active) setConnectivity(error ? 'unavailable' : 'connected')
    }

    const handleOffline = () => setConnectivity('offline')
    const handleOnline = () => {
      setConnectivity('checking')
      void checkConnectivity()
    }
    void checkConnectivity()
    const timer = window.setInterval(() => void checkConnectivity(), 60_000)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const connectivityIndicator = connectivity === 'connected'
    ? { label: 'Conectado', Icon: Cloud, className: 'bg-emerald-50 text-emerald-700' }
    : connectivity === 'checking'
      ? { label: 'Verificando', Icon: LoaderCircle, className: 'bg-slate-100 text-slate-600' }
      : connectivity === 'offline'
        ? { label: 'Sin red', Icon: CloudOff, className: 'bg-rose-50 text-rose-600' }
        : { label: 'No disponible', Icon: CloudOff, className: 'bg-amber-50 text-amber-700' }

  function selectSection(section: AdministrationSection) {
    onSectionChange(section)
    setMenuOpen(false)
  }

  return (
    <div className="admin-shell flex h-dvh min-h-0 min-w-0 overflow-hidden bg-slate-100 text-slate-900">
      {menuOpen && <button aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMenuOpen(false)} type="button" />}

      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-gradient-to-b from-blue-800 via-blue-900 to-slate-950 text-white shadow-2xl transition-transform lg:static lg:z-auto lg:w-20 lg:translate-x-0 lg:shadow-none xl:w-72 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-4 lg:justify-center lg:px-2 xl:justify-start xl:px-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15"><MonitorCog aria-hidden="true" className="size-7" /></div>
          <div className="min-w-0 lg:hidden xl:block">
            <strong className="block truncate text-lg font-black">Cafetería Escolar</strong>
            <span className="text-xs font-semibold text-blue-200">Administración</span>
          </div>
          <button aria-label="Cerrar menú" className="ml-auto grid size-11 place-items-center rounded-lg hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(false)} type="button"><X aria-hidden="true" /></button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:px-2 xl:px-3" aria-label="Navegación administrativa">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={activeSection === id ? 'page' : undefined}
              className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition lg:justify-center lg:px-2 xl:justify-start xl:px-3 ${activeSection === id ? 'bg-white text-blue-800 shadow-md' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
              key={id}
              onClick={() => selectSection(id)}
              title={label}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="lg:hidden xl:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3 lg:p-2 xl:p-3">
          <a className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-blue-100 transition hover:bg-white/10 hover:text-white lg:justify-center lg:px-2 xl:justify-start xl:px-3" href="#/pos" title="Volver al punto de venta">
            <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />
            <span className="lg:hidden xl:inline">Volver al POS</span>
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5">
          <div className="lg:hidden"><button aria-label="Abrir menú" className="admin-icon-button" onClick={() => setMenuOpen(true)} type="button"><Menu aria-hidden="true" className="size-6" /></button></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950">{session?.user.displayName}</p>
            <p className="truncate text-xs font-semibold text-slate-500">Administrador · Sesión verificada por servidor</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 sm:flex">
            <BookOpenCheck aria-hidden="true" className="size-4 text-blue-600" />
            {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(now)}
          </div>
          <div className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black ${connectivityIndicator.className}`}>
            <connectivityIndicator.Icon aria-hidden="true" className={`size-5 ${connectivity === 'checking' ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{connectivityIndicator.label}</span>
          </div>
          <button aria-label="Cerrar sesión" className="admin-icon-button" onClick={() => void logout()} title="Cerrar sesión" type="button"><LogOut aria-hidden="true" className="size-5" /></button>
        </header>

        <main className="admin-content min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

export const adminVisualIcons = { BarChart3, Boxes, Users }
