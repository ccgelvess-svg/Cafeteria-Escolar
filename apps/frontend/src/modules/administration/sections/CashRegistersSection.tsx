import { useCallback, useEffect, useState } from 'react'
import { Banknote, RefreshCw, ShoppingBag, Store, Undo2 } from 'lucide-react'

import { listCashRegisterSummaries, SALES_CHANGED_EVENT, type CashRegisterSummary } from '../../sales'
import { formatAdminCurrency } from '../format'
import { EmptyState, PageHeader, StatusPill } from '../components/AdminUi'

export function CashRegistersSection() {
  const [registers, setRegisters] = useState<CashRegisterSummary[]>([])
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setRegisters(await listCashRegisterSummaries()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar las cajas.') }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(SALES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh)
  }, [refresh])

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Operación de caja" title="Cajas" description="Recaudo efectivo calculado desde ventas confirmadas; las anulaciones no suman al total." action={<button className="admin-secondary-button" onClick={() => void refresh()} type="button"><RefreshCw className="size-4" />Actualizar</button>} />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{registers.map((register) => <article className="admin-card" key={register.id}>
      <div className="flex items-start gap-3"><div className={`grid size-12 place-items-center rounded-xl ${register.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><Store /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="admin-card-title">{register.name}</h2><StatusPill active={register.active} activeText="Activa" inactiveText="Inactiva" /></div><p className="admin-card-subtitle">Actualización automática desde el POS</p></div></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div className="col-span-2"><dt className="flex items-center gap-1 font-bold text-slate-500"><Banknote className="size-4" />Recaudo efectivo</dt><dd className="mt-1 text-2xl font-black text-emerald-700">{formatAdminCurrency(register.cashTotal)}</dd></div><div><dt className="flex items-center gap-1 font-bold text-slate-400"><ShoppingBag className="size-4" />Ventas vigentes</dt><dd className="mt-1 text-xl font-black">{register.completedSales}</dd></div><div><dt className="flex items-center gap-1 font-bold text-slate-400"><Undo2 className="size-4" />Anuladas</dt><dd className="mt-1 text-xl font-black text-rose-600">{register.voidedSales}</dd></div></dl>
    </article>)}</section>
    {!error && registers.length === 0 && <EmptyState>No hay cajas autorizadas.</EmptyState>}
  </div>
}
