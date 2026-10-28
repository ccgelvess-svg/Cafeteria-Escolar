import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'

import { listRegisteredSales, SALES_CHANGED_EVENT, voidSale, type RegisteredSale } from '../../sales'
import { AdminDialog, EmptyState, PageHeader, SearchField, StatusPill } from '../components/AdminUi'
import { formatAdminCurrency } from '../format'

export function SalesSection() {
  const [sales, setSales] = useState<RegisteredSale[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<RegisteredSale | null>(null)
  const [annul, setAnnul] = useState<RegisteredSale | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    try { setSales(await listRegisteredSales()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar las ventas.') }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(SALES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh)
  }, [refresh])

  const filtered = useMemo(() => sales.filter((sale) =>
    `${sale.id} ${sale.studentName ?? 'venta libre'} ${sale.registerName ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  ), [sales, query])

  async function confirmVoid() {
    if (!annul) return
    setBusy(true); setError('')
    try { await voidSale(annul.id, reason); setAnnul(null); setReason(''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible anular la venta.') }
    finally { setBusy(false) }
  }

  return <div className="admin-page-stack"><PageHeader eyebrow="Trazabilidad" title="Ventas" description="Consulta ventas reales y anula con reverso financiero y de inventario auditable." />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    <section className="admin-card"><SearchField onChange={setQuery} placeholder="Buscar venta, estudiante o caja" value={query} />
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Caja</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Acciones</th></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id}><td><strong className="font-mono">{sale.id.slice(0, 8)}</strong></td><td>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sale.occurredAt))}</td><td>{sale.studentName ?? 'Venta libre'}</td><td>{sale.paymentMethod === 'cash' ? 'Efectivo' : 'Cuenta estudiante'}</td><td>{sale.registerName ?? 'Administración'}</td><td><StatusPill active={sale.status === 'completed'} activeText="Completada" inactiveText="Anulada" /></td><td className="text-right font-black">{formatAdminCurrency(sale.totalAmount)}</td><td><div className="flex justify-end gap-1"><button className="admin-icon-button" onClick={() => setSelected(sale)} aria-label={`Ver ${sale.id}`} type="button"><Eye className="size-4" /></button><button className="admin-icon-button text-rose-600" disabled={sale.status === 'voided'} onClick={() => { setAnnul(sale); setReason('') }} aria-label={`Anular ${sale.id}`} type="button"><RotateCcw className="size-4" /></button></div></td></tr>)}</tbody></table></div>{filtered.length === 0 && <EmptyState>No hay ventas registradas para este filtro.</EmptyState>}
    </section>
    <AdminDialog open={Boolean(selected)} title={`Detalle de venta ${selected?.id.slice(0, 8) ?? ''}`} description={selected ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.occurredAt)) : ''} onClose={() => setSelected(null)} footer={<button className="admin-primary-button" onClick={() => setSelected(null)} type="button">Cerrar</button>}>{selected && <div><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{selected.items.map((item, index) => <div className="flex justify-between gap-3 p-3" key={`${item.productName}-${index}`}><span className="font-bold">{item.quantity} × {item.productName}</span><strong>{formatAdminCurrency(item.lineTotal)}</strong></div>)}</div>{selected.voidReason && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">Motivo de anulación: {selected.voidReason}</p>}<div className="mt-3 flex justify-between rounded-xl bg-slate-100 p-4 text-lg"><strong>Total</strong><strong>{formatAdminCurrency(selected.totalAmount)}</strong></div></div>}</AdminDialog>
    <AdminDialog open={Boolean(annul)} title={`Anular venta ${annul?.id.slice(0, 8) ?? ''}`} description="Esta operación reversa una sola vez el stock y, si aplica, el movimiento del estudiante." onClose={() => setAnnul(null)} size="sm" footer={<><button className="admin-secondary-button" onClick={() => setAnnul(null)} type="button">Cancelar</button><button className="admin-danger-button" disabled={busy || reason.trim().length < 3} onClick={() => void confirmVoid()} type="button">Confirmar anulación</button></>}><label className="admin-field">Motivo obligatorio<textarea className="admin-input min-h-24" onChange={(event) => setReason(event.target.value)} placeholder="Describe la causa" value={reason} /></label></AdminDialog>
  </div>
}
