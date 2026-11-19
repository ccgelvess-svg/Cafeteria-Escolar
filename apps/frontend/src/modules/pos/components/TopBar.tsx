import { useEffect, useState } from 'react'
import { CalendarDays, Cloud, CloudOff, LogOut, Settings, Store, Utensils } from 'lucide-react'

import { useAuth } from '../../auth'
import type { CashRegisterOption } from '../../sales'
import { capitalize } from '../format'
import { useSyncStatus } from '../../../infrastructure/sync/useSyncStatus'

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatDate(date: Date) {
  return capitalize(
    new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .replace(/\./g, ''),
  )
}

export function TopBar({ activeRegisterId, registers, onSelectRegister }: {
  activeRegisterId: string
  registers: CashRegisterOption[]
  onSelectRegister: (id: string) => void
}) {
  const [now, setNow] = useState(() => new Date())
  const { can, logout } = useAuth()
  const { manualOffline, networkOnline, online, pending, setManualOffline } = useSyncStatus()
  const statusLabel = online
    ? pending > 0 ? `Sincronizando · ${pending}` : 'En línea'
    : manualOffline ? `Offline manual · ${pending}` : `Sin conexión · ${pending}`

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="pos-topbar shrink-0 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 text-white shadow-md">
      <div className="pos-topbar-inner mx-auto flex min-h-16 max-w-[1600px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <div className="pos-topbar-brand flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Utensils aria-hidden="true" className="pos-brand-icon size-8 shrink-0 sm:size-9" strokeWidth={2.6} />
          <h1 className="brand-title whitespace-nowrap font-extrabold tracking-tight">Cafetería Escolar</h1>
        </div>

        <div className="pos-topbar-controls flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            aria-label={manualOffline ? `Desactivar modo offline manual, ${pending} operaciones pendientes` : `Activar modo offline manual, ${pending} operaciones pendientes`}
            aria-pressed={manualOffline}
            className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-bold shadow-sm transition sm:px-3 sm:text-base ${online ? 'bg-emerald-600 hover:bg-emerald-700' : manualOffline ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}
            onClick={() => setManualOffline(!manualOffline)}
            title={manualOffline ? 'Volver a conexión automática y sincronizar' : networkOnline ? 'Trabajar solo con datos locales' : 'Sin conexión real; el modo automático está activo'}
            type="button"
          >
            {online ? <Cloud aria-hidden="true" className="size-5" /> : <CloudOff aria-hidden="true" className="size-5" />}
            <span className="offline-label pos-status-label">{statusLabel}</span>
          </button>

          {can('admin:access') && <a
            aria-label="Abrir Administración"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/15 px-2 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-white/25 sm:px-3 sm:text-base"
            href="#/admin"
          >
            <Settings aria-hidden="true" className="size-5" />
            <span className="pos-admin-label hidden sm:inline">Admin</span>
          </a>}

          <label className="pos-register flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-white/15 px-2 text-sm font-bold">
            <Store aria-hidden="true" className="pos-register-icon size-5 shrink-0" />
            <span className="sr-only">Caja activa</span>
            <select className="pos-register-select min-w-0 max-w-40 bg-transparent font-bold text-white outline-none" onChange={(event) => onSelectRegister(event.target.value)} value={activeRegisterId}>
              <option className="text-slate-900" value="">Seleccionar caja</option>
              {registers.map((register) => <option className="text-slate-900" key={register.id} value={register.id}>{register.name}</option>)}
            </select>
          </label>

          <button aria-label="Cerrar sesión" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-blue-50 transition hover:bg-white/15" onClick={() => void logout()} title="Cerrar sesión" type="button"><LogOut aria-hidden="true" className="size-5" /></button>

          <div className="pos-clock-divider hidden h-11 w-px bg-white/40 xl:block" />
          <div className="pos-clock hidden min-w-36 text-right leading-tight xl:block">
            <div className="pos-clock-time text-lg font-extrabold">{formatTime(now)}</div>
            <div className="pos-clock-date mt-1 flex items-center justify-end gap-1 text-xs font-medium text-blue-50">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {formatDate(now)}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
