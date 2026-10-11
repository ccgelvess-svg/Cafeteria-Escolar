import { useEffect, useState } from 'react'
import { CalendarDays, CloudOff, Store, Utensils } from 'lucide-react'

import { capitalize } from '../format'

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

export function TopBar() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="pos-topbar shrink-0 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 text-white shadow-md">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-2 px-3 py-2 sm:min-h-20 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Utensils aria-hidden="true" className="size-8 shrink-0 sm:size-9" strokeWidth={2.6} />
          <h1 className="brand-title whitespace-nowrap font-extrabold tracking-tight">Cafetería Escolar</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div aria-label="Modo offline" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-rose-500 px-2 py-2 text-sm font-bold shadow-sm sm:px-3 sm:text-base">
            <CloudOff aria-hidden="true" className="size-5" />
            <span className="offline-label">Modo offline</span>
          </div>

          <div className="hidden h-11 w-px bg-white/40 md:block" />
          <div className="hidden items-center gap-2 text-base font-semibold md:flex">
            <Store aria-hidden="true" className="size-6" />
            <span>Caja 01</span>
          </div>

          <div className="hidden h-11 w-px bg-white/40 lg:block" />
          <div className="hidden min-w-36 text-right leading-tight lg:block">
            <div className="text-lg font-extrabold">{formatTime(now)}</div>
            <div className="mt-1 flex items-center justify-end gap-1 text-xs font-medium text-blue-50">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {formatDate(now)}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
