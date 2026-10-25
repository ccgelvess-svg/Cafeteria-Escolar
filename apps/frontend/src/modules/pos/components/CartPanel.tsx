import {
  Banknote,
  CircleDollarSign,
  ClipboardList,
  History,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'

import { formatCurrency } from '../format'
import type { CartLine, SaleMode, Student } from '../types'

interface CartPanelProps {
  mode: SaleMode
  student: Student | null
  cart: CartLine[]
  paymentBusy: boolean
  canUndo: boolean
  onChangeQuantity: (productId: string, delta: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onUndo: () => void
  onShowHistory: () => void
  onPrimaryAction: () => void
  onRegisterPayment: () => void
}

export function CartPanel({
  mode,
  student,
  cart,
  paymentBusy,
  canUndo,
  onChangeQuantity,
  onRemove,
  onClear,
  onUndo,
  onShowHistory,
  onPrimaryAction,
  onRegisterPayment,
}: CartPanelProps) {
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)

  return (
    <aside className="pos-cart-panel flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[clamp(1.25rem,2vw,1.5rem)] font-black tracking-tight text-slate-950">Cuenta del cliente</h2>
          <p className="font-bold text-slate-500">
            {mode === 'free'
              ? 'Venta libre (pago en efectivo)'
              : student
                ? `${student.name} · ${student.course}`
                : 'Selecciona un estudiante'}
          </p>
        </div>
        <button
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={cart.length === 0}
          onClick={onClear}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Limpiar todo</span>
        </button>
      </div>

      <div className="cart-grid-header mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded-t-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <span>Producto</span>
        <span>Cantidad</span>
        <span className="min-w-20 text-right">Subtotal</span>
      </div>

      <div className="cart-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-lg border-x border-b border-slate-100">
        {cart.length > 0 ? (
          cart.map(({ product, quantity }) => {
            const Icon = product.icon
            return (
              <div className="cart-line grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-slate-100 px-2 py-2.5 last:border-b-0" key={product.id}>
                <div className="cart-product flex min-w-0 items-center gap-2">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${product.tint}`}>
                    <Icon aria-hidden="true" className={`size-5 ${product.iconColor}`} />
                  </span>
                  <span className="truncate text-sm font-bold text-slate-900">{product.shortName}</span>
                </div>
                <div className="cart-quantity flex items-center gap-1">
                  <button
                    aria-label={`Disminuir ${product.name}`}
                    className="quantity-button"
                    onClick={() => onChangeQuantity(product.id, -1)}
                    type="button"
                  >
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <span className="w-6 text-center font-black text-slate-950">{quantity}</span>
                  <button
                    aria-label={`Aumentar ${product.name}`}
                    className="quantity-button"
                    onClick={() => onChangeQuantity(product.id, 1)}
                    type="button"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <div className="cart-subtotal flex min-w-20 items-center justify-end gap-1">
                  <strong className="text-right text-sm text-slate-950">{formatCurrency(product.price * quantity)}</strong>
                  <button
                    aria-label={`Eliminar ${product.name}`}
                    className="grid min-h-11 min-w-11 place-items-center rounded-md text-rose-500 transition hover:bg-rose-50"
                    onClick={() => onRemove(product.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="grid min-h-32 place-items-center p-6 text-center text-slate-400">
            <div>
              <ClipboardList aria-hidden="true" className="mx-auto size-9" />
              <p className="mt-2 text-sm font-semibold">Toca un producto para agregarlo.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2">
        <span className="text-lg font-bold text-slate-800">Total</span>
        <strong className="text-2xl font-black text-slate-950">{formatCurrency(total)}</strong>
      </div>

      {mode === 'free' ? (
        <div className="mt-2 grid gap-2">
          <button
            className="mt-2 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-[clamp(1.05rem,2vw,1.25rem)] font-black text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:grayscale sm:min-h-16"
            disabled={total <= 0 || paymentBusy}
            onClick={onPrimaryAction}
            type="button"
          >
            <Banknote aria-hidden="true" className="size-8" />
            {paymentBusy ? 'Registrando…' : 'Pago en efectivo'}
          </button>
          <p className="text-center text-xs font-semibold text-slate-500">Se registrará como pagado por el total exacto.</p>
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2">
            <span className="font-bold text-indigo-900">Saldo disponible</span>
            <strong className="text-xl text-indigo-950">{formatCurrency(student?.balance ?? 0)}</strong>
          </div>
          <button
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 text-lg font-black text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!student || cart.length === 0}
            onClick={onPrimaryAction}
            type="button"
          >
            <ClipboardList aria-hidden="true" className="size-6" />
            Registrar consumo
          </button>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-lg font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!student}
            onClick={onRegisterPayment}
            type="button"
          >
            <CircleDollarSign aria-hidden="true" className="size-6" />
            Registrar abono
          </button>
        </div>
      )}

      <div className="cart-secondary-actions mt-2 grid grid-cols-2 gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-500 px-2 font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-5" />
          <span>Corregir último toque</span>
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2 font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={mode === 'student' && !student}
          onClick={onShowHistory}
          type="button"
        >
          <History aria-hidden="true" className="size-5" />
          Historial
        </button>
      </div>
    </aside>
  )
}
