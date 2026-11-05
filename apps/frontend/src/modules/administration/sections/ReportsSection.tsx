import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileClock, TrendingUp } from 'lucide-react'

import { listRegisteredSales, SALES_CHANGED_EVENT, type RegisteredSale } from '../../sales'
import { splitBalance, useStudents } from '../../students'
import { formatAdminCurrency } from '../format'
import { AdminDialog, EmptyState, PageHeader } from '../components/AdminUi'

type Period = 'Día' | 'Semana' | 'Mes'

function periodStart(period: Period) {
  const start = new Date()
  if (period === 'Día') start.setHours(0, 0, 0, 0)
  else start.setDate(start.getDate() - (period === 'Semana' ? 7 : 30))
  return start
}

export function ReportsSection() {
  const [period, setPeriod] = useState<Period>('Semana')
  const [registerId, setRegisterId] = useState('all')
  const [sales, setSales] = useState<RegisteredSale[]>([])
  const [notice, setNotice] = useState(false)
  const [error, setError] = useState('')
  const { students } = useStudents()
  const refresh = useCallback(async () => {
    try { setSales(await listRegisteredSales()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar el reporte.') }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(SALES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh)
  }, [refresh])

  const registers = useMemo(() => [...new Map(sales.filter((sale) => sale.registerId).map((sale) => [sale.registerId, sale.registerName ?? 'Sin nombre'])).entries()], [sales])
  const activeSales = useMemo(() => sales.filter((sale) => sale.status === 'completed' && new Date(sale.occurredAt) >= periodStart(period) && (registerId === 'all' || sale.registerId === registerId)), [sales, period, registerId])
  const totalSales = activeSales.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const cashRevenue = activeSales.filter((sale) => sale.paymentMethod === 'cash').reduce((sum, sale) => sum + sale.totalAmount, 0)
  const receivables = students.reduce((sum, student) => sum + splitBalance(student.netBalance).debt, 0)
  const averageTicket = activeSales.length ? Math.round(totalSales / activeSales.length) : 0
  const topProducts = useMemo(() => {
    const totals = new Map<string, number>()
    activeSales.flatMap((sale) => sale.items).forEach((item) => totals.set(item.productName, (totals.get(item.productName) ?? 0) + item.quantity))
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [activeSales])
  const maxUnits = Math.max(1, ...topProducts.map(([, units]) => units))
  const byRegister = useMemo(() => {
    const totals = new Map<string, { sales: number; cash: number; total: number }>()
    activeSales.forEach((sale) => {
      const name = sale.registerName ?? 'Sin caja (histórico)'
      const current = totals.get(name) ?? { sales: 0, cash: 0, total: 0 }
      current.sales += 1; current.total += sale.totalAmount
      if (sale.paymentMethod === 'cash') current.cash += sale.totalAmount
      totals.set(name, current)
    })
    return [...totals]
  }, [activeSales])

  return <div className="admin-page-stack"><PageHeader eyebrow="Análisis" title="Reportes" description="Ventas y recaudo reales; cada pago en efectivo se refleja al confirmarse." action={<button className="admin-secondary-button" onClick={() => setNotice(true)} type="button"><Download className="size-5" />Preparar exportación</button>} />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    <div className="flex flex-wrap gap-2">{(['Día', 'Semana', 'Mes'] as Period[]).map((item) => <button className={`min-h-11 rounded-xl px-5 text-sm font-black ${period === item ? 'bg-blue-700 text-white shadow' : 'border border-slate-200 bg-white text-slate-600'}`} onClick={() => setPeriod(item)} key={item} type="button">{item}</button>)}<select className="admin-select ml-auto max-w-64" onChange={(event) => setRegisterId(event.target.value)} value={registerId}><option value="all">Todas las cajas</option>{registers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Ventas', formatAdminCurrency(totalSales)], ['Recaudo efectivo', formatAdminCurrency(cashRevenue)], ['Cuentas por cobrar', formatAdminCurrency(receivables)], ['Ticket promedio', formatAdminCurrency(averageTicket)]].map(([label, value]) => <article className="admin-card" key={label}><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 flex items-center gap-1 text-xs font-black text-emerald-700"><TrendingUp className="size-3.5" />Periodo: {period}</p></article>)}</section>
    <section className="admin-card"><h2 className="admin-card-title">Productos más vendidos</h2><p className="admin-card-subtitle">Unidades de ventas vigentes en el periodo</p><div className="mt-5 space-y-4">{topProducts.map(([name, units]) => <div key={name}><div className="flex justify-between gap-3 text-sm"><strong>{name}</strong><span className="font-bold text-slate-500">{units} unidades</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400" style={{ width: `${Math.max(4, (units / maxUnits) * 100)}%` }} /></div></div>)}{topProducts.length === 0 && <EmptyState>No hay ventas vigentes en este periodo.</EmptyState>}</div></section>
    <section className="admin-card"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><FileClock /></div><div><h2 className="admin-card-title">Resumen por caja</h2><p className="admin-card-subtitle">Totales actualizados desde el POS</p></div></div><div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Caja</th><th>Ventas</th><th className="text-right">Total vendido</th><th className="text-right">Recaudo efectivo</th></tr></thead><tbody>{byRegister.map(([name, totals]) => <tr key={name}><td><strong>{name}</strong></td><td>{totals.sales}</td><td className="text-right font-black">{formatAdminCurrency(totals.total)}</td><td className="text-right font-black text-emerald-700">{formatAdminCurrency(totals.cash)}</td></tr>)}</tbody></table></div>{byRegister.length === 0 && <EmptyState>No hay ventas vigentes en este periodo.</EmptyState>}</section>
    <AdminDialog open={notice} title="Exportaciones" description="La consulta ya usa datos reales; la descarga de archivos aún no está habilitada." onClose={() => setNotice(false)} size="sm" footer={<button className="admin-primary-button" onClick={() => setNotice(false)} type="button">Entendido</button>}><p className="font-semibold text-slate-600">Puedes cambiar el periodo para consultar ventas, recaudo y productos.</p></AdminDialog>
  </div>
}
