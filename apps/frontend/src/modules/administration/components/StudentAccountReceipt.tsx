import { Printer } from 'lucide-react'

import { buildAccountReceiptEntries, summarizeStudentAccountReceipt } from '../../students'
import type { AccountSale } from '../../sales'
import { formatAdminCurrency } from '../format'
import { AdminDialog, EmptyState } from './AdminUi'

export type StudentAccountReceiptMode = 'summary' | 'detailed'

export interface StudentAccountReceiptAccount {
  kind: 'student' | 'teacher'
  id: string
  code: string
  firstName: string
  lastName: string
  netBalance: number
  grade?: string
  group?: string
}

export interface StudentAccountReceiptMovement {
  id: string
  occurredAt: string
  type: 'consumption' | 'top-up' | 'debt-payment' | 'reversal'
  amount: number
  detail: string
  idempotencyKey: string
}

export interface StudentAccountReceiptData {
  account: StudentAccountReceiptAccount
  cashRegisterId: string
  schoolName: string
  generatedAt: string
  movements: StudentAccountReceiptMovement[]
  sales: AccountSale[]
  loading: boolean
  error?: string
}

const movementLabels = {
  consumption: 'Compra',
  'top-up': 'Recarga',
  'debt-payment': 'Abono',
  reversal: 'Reverso',
} as const

const formatDateTime = (value: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value))

export function StudentAccountReceipt({ data, mode, onModeChange, onClose }: {
  data: StudentAccountReceiptData | null
  mode: StudentAccountReceiptMode
  onModeChange: (mode: StudentAccountReceiptMode) => void
  onClose: () => void
}) {
  const movements = data?.movements ?? []
  const sales = data?.sales ?? []
  const summary = summarizeStudentAccountReceipt(data?.account.netBalance ?? 0, movements)
  const entries = buildAccountReceiptEntries(data?.account.netBalance ?? 0, movements, sales)

  return <AdminDialog
    open={Boolean(data)}
    title="Comprobante de estado de cuenta"
    description={data ? `${data.schoolName} · ${data.account.firstName} ${data.account.lastName}` : ''}
    onClose={onClose}
    size="lg"
    footer={<>
      <button className="admin-secondary-button" onClick={onClose} type="button">Cerrar</button>
      <button className="admin-primary-button" disabled={!data || data.loading || Boolean(data.error)} onClick={() => window.print()} type="button"><Printer aria-hidden="true" className="size-4" />Imprimir / Guardar PDF</button>
    </>}
  >
    {data && <div>
      <div className="receipt-screen-controls mb-4 flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Nivel de detalle del comprobante">
        <button aria-pressed={mode === 'summary'} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === 'summary' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`} onClick={() => onModeChange('summary')} type="button">Resumen</button>
        <button aria-pressed={mode === 'detailed'} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === 'detailed' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`} onClick={() => onModeChange('detailed')} type="button">Historial detallado</button>
      </div>
      {data.loading && <EmptyState>Consultando movimientos de esta caja…</EmptyState>}
      {data.error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700" role="alert">{data.error}</div>}
      {!data.loading && !data.error && <article className="student-account-receipt mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-5 font-mono text-[12px] leading-snug text-slate-950" id="student-account-receipt">
        <header className="border-b border-dashed border-slate-400 pb-3 text-center">
          <p className="text-sm font-black uppercase">Estado de cuenta</p>
          <p className="mt-1 font-bold">{data.schoolName}</p>
          <p>{formatDateTime(data.generatedAt)}</p>
        </header>
        <section className="border-b border-dashed border-slate-400 py-3">
          <p><strong>{data.account.kind === 'teacher' ? 'Profesor' : 'Estudiante'}:</strong> {data.account.firstName} {data.account.lastName}</p>
          <p><strong>Código:</strong> {data.account.code}</p>
          {data.account.kind === 'student' && <p><strong>Curso:</strong> {data.account.grade} {data.account.group}</p>}
        </section>
        <section className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-dashed border-slate-400 py-3">
          <span>Compras</span><strong className="text-right">{formatAdminCurrency(summary.purchases)}</strong>
          <span>Abonos / recargas</span><strong className="text-right">{formatAdminCurrency(summary.payments)}</strong>
          <span>Saldo a favor</span><strong className="text-right">{formatAdminCurrency(summary.balance)}</strong>
          <span>Deuda</span><strong className="text-right">{formatAdminCurrency(summary.debt)}</strong>
        </section>
        {mode === 'detailed' && <section className="border-b border-dashed border-slate-400 py-3">
          <h3 className="mb-2 text-center font-black uppercase">Movimientos</h3>
          {entries.map((entry) => entry.kind === 'sale'
            ? <div className="border-t border-dotted border-slate-300 py-2 first:border-0" key={entry.id}>
              <div className="flex justify-between gap-2"><span>{formatDateTime(entry.occurredAt)}</span><strong>Compra{entry.sale.status === 'voided' ? ' anulada' : ''}</strong></div>
              {entry.sale.items.map((item, index) => <div className="mt-1" key={`${entry.sale.id}:${index}`}>
                <p className="font-bold">{item.productName}</p>
                <div className="grid grid-cols-[auto_1fr_auto] gap-1 text-[11px]"><span>{item.quantity} × {formatAdminCurrency(item.unitPrice)}</span><span className="border-b border-dotted border-slate-300" /><span>{formatAdminCurrency(item.lineTotal)}</span></div>
              </div>)}
              {entry.sale.items.length === 0 && <p className="mt-1">Sin renglones de venta registrados.</p>}
              <div className="mt-2 flex justify-between gap-2 font-black"><span>Total compra</span><span>{formatAdminCurrency(entry.sale.totalAmount)}</span></div>
              <div className="flex justify-between gap-2"><span>Saldo resultante</span><strong>{entry.balanceAfter === undefined ? 'No disponible' : formatAdminCurrency(entry.balanceAfter)}</strong></div>
            </div>
            : <div className="border-t border-dotted border-slate-300 py-2 first:border-0" key={entry.id}>
              <div className="flex justify-between gap-2"><span>{formatDateTime(entry.occurredAt)}</span><strong>{movementLabels[entry.movement.type]}</strong></div>
              <div className="flex justify-between gap-2"><span className="break-words">{entry.movement.detail}</span><strong>{formatAdminCurrency(entry.movement.amount)}</strong></div>
              <div className="flex justify-between gap-2"><span>Saldo resultante</span><strong>{formatAdminCurrency(entry.balanceAfter)}</strong></div>
            </div>)}
          {entries.length === 0 && <p className="text-center">Sin movimientos para esta caja.</p>}
        </section>}
        <footer className="pt-3 text-center text-[10px]">
          <p>{movements.length} movimiento(s) consultado(s)</p>
          <p className="mt-2 font-black">Comprobante informativo, no válido como factura electrónica</p>
        </footer>
      </article>}
    </div>}
  </AdminDialog>
}
