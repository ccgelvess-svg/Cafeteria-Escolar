import type { ReactNode } from 'react'
import { CircleAlert, Search, X } from 'lucide-react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p>}
        <h1 className="mt-1 text-[clamp(1.5rem,3vw,2.15rem)] font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500 sm:text-base">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function DemoBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 sm:text-sm">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-600" />
      Datos de demostración. Los cambios de esta vista viven únicamente en memoria y no se guardan ni sincronizan.
    </div>
  )
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
      <input className="admin-input admin-input-with-icon" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
    </label>
  )
}

export function StatusPill({ active, activeText = 'Activo', inactiveText = 'Inactivo' }: { active: boolean; activeText?: string; inactiveText?: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
      {active ? activeText : inactiveText}
    </span>
  )
}

interface AdminDialogProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
}

export function AdminDialog({ open, title, description, children, footer, onClose, size = 'md' }: AdminDialogProps) {
  if (!open) return null
  const maxWidth = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
      <section aria-labelledby="admin-dialog-title" aria-modal="true" className={`my-auto w-full ${maxWidth} overflow-hidden rounded-2xl bg-white shadow-2xl`} role="dialog">
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950" id="admin-dialog-title">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button aria-label="Cerrar ventana" className="admin-icon-button" onClick={onClose} type="button"><X aria-hidden="true" className="size-5" /></button>
        </header>
        <div className="max-h-[65dvh] overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</footer>}
      </section>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">{children}</div>
}
