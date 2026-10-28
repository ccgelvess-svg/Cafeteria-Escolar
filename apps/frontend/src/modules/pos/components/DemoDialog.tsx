import { CircleCheck, History, Info, X } from 'lucide-react'

export type DialogKind = 'history' | 'notice' | null

interface DemoDialogProps {
  kind: DialogKind
  title: string
  message: string
  onClose: () => void
}

export function DemoDialog({ kind, title, message, onClose }: DemoDialogProps) {
  if (!kind) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
      <section
        aria-labelledby="demo-dialog-title"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center gap-3 bg-gradient-to-r from-blue-700 to-sky-600 px-5 py-4 text-white">
          {kind === 'history' ? <History aria-hidden="true" className="size-6" /> : <Info aria-hidden="true" className="size-6" />}
          <h2 className="flex-1 text-xl font-black" id="demo-dialog-title">{title}</h2>
          <button aria-label="Cerrar" className="rounded-lg p-1 hover:bg-white/15" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-6" />
          </button>
        </header>

        <div className="p-5">
          <p className="whitespace-pre-line text-sm font-semibold text-slate-600">{message}</p>
          {kind === 'history' ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-900">Movimientos almacenados en este dispositivo.</div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
              <p className="font-bold">La operación fue procesada en este dispositivo.</p>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button className="rounded-lg bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800" onClick={onClose} type="button">
            Entendido
          </button>
        </footer>
      </section>
    </div>
  )
}
