import { CloudUpload, RefreshCw } from 'lucide-react'

export function FooterStatus() {
  return (
    <footer className="pos-footer shrink-0 border-t border-slate-200 bg-white px-3 py-2 text-[clamp(0.7rem,1.2vw,0.875rem)] text-slate-600 shadow-[0_-3px_12px_rgba(15,23,42,0.05)] sm:px-4">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 sm:px-2 lg:flex-nowrap">
        <div className="flex items-center gap-2 font-semibold">
          <CloudUpload aria-hidden="true" className="size-5 text-blue-600" />
          Pendientes de sincronizar:
          <strong className="text-lg text-orange-600">12</strong>
        </div>
        <span aria-hidden="true" className="hidden h-5 w-px bg-slate-300 sm:block" />
        <div className="flex items-center gap-2">
          <RefreshCw aria-hidden="true" className="size-5 text-blue-600" />
          Última sincronización local: <strong>10:35 a. m.</strong>
        </div>
        <span className="ml-auto hidden whitespace-nowrap text-xs font-semibold text-slate-400 xl:inline">Datos de demostración · Sin envío al servidor</span>
      </div>
    </footer>
  )
}
