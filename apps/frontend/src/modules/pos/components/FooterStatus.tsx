import { CloudUpload, RefreshCw } from 'lucide-react'
import { useSyncStatus } from '../../../infrastructure/sync/useSyncStatus'

export function FooterStatus() {
  const { lastSyncAt, online, pending } = useSyncStatus()
  const lastSync = lastSyncAt
    ? new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(lastSyncAt))
    : 'Sin sincronización registrada'
  return (
    <footer className="pos-footer shrink-0 border-t border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-[0_-3px_12px_rgba(15,23,42,0.05)] sm:px-4">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-1 sm:px-1 lg:flex-nowrap">
        <div className="flex items-center gap-1.5 font-semibold">
          <CloudUpload aria-hidden="true" className="size-4 text-blue-600" />
          Pendientes:
          <strong className="text-base text-orange-600">{pending}</strong>
        </div>
        <span aria-hidden="true" className="hidden h-5 w-px bg-slate-300 sm:block" />
        <div className="flex items-center gap-1.5">
          <RefreshCw aria-hidden="true" className="size-4 text-blue-600" />
          Última sync: <strong>{lastSync}</strong>
        </div>
        <span className="ml-auto hidden whitespace-nowrap text-xs font-semibold text-slate-400 xl:inline">{online ? 'Conectado a Supabase' : 'Los cambios se conservarán en este dispositivo'}</span>
      </div>
    </footer>
  )
}
