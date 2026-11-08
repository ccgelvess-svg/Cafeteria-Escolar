import { useCallback, useEffect, useState } from 'react'
import { Download, FileClock, TrendingUp } from 'lucide-react'

import { getSalesReport, listActiveCashRegisters, SALES_CHANGED_EVENT, type CashRegisterOption, type SalesReport } from '../../sales'
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
  const [registers, setRegisters] = useState<CashRegisterOption[]>([])
  const [report, setReport] = useState<SalesReport | null>(null)
  const [notice, setNotice] = useState(false)
  const [error, setError] = useState('')
  const { students } = useStudents()
  const refresh = useCallback(async () => {
    try {
      const [nextReport, nextRegisters] = await Promise.all([
        getSalesReport(periodStart(period), registerId === 'all' ? undefined : registerId),
        listActiveCashRegisters(),
      ])
      setReport(nextReport); setRegisters(nextRegisters); setError('')
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar el reporte.') }
  }, [period, registerId])

  useEffect(() => {
    void refresh()
    window.addEventListener(SALES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh)
  }, [refresh])

  const receivables = students.reduce((sum, student) => sum + splitBalance(student.netBalance).debt, 0)
  const topProducts = report?.topProducts ?? []
  const maxUnits = Math.max(1, ...topProducts.map((item) => item.units))

  return <div className="admin-page-stack"><PageHeader eyebrow="Análisis" title="Reportes" description="Ventas y recaudo reales; cada pago en efectivo se refleja al confirmarse." action={<button className="admin-secondary-button" onClick={() => setNotice(true)} type="button"><Download className="size-5" />Preparar exportación</button>} />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
    <div className="flex flex-wrap gap-2">{(['Día', 'Semana', 'Mes'] as Period[]).map((item) => <button className={`min-h-11 rounded-xl px-5 text-sm font-black ${period === item ? 'bg-blue-700 text-white shadow' : 'border border-slate-200 bg-white text-slate-600'}`} onClick={() => setPeriod(item)} key={item} type="button">{item}</button>)}<select className="admin-select ml-auto max-w-64" onChange={(event) => setRegisterId(event.target.value)} value={registerId}><option value="all">Todas las cajas</option>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Total vendido', formatAdminCurrency(report?.totalAmount ?? 0)], ['Recaudo efectivo', formatAdminCurrency(report?.cashRevenue ?? 0)], ['Cuentas por cobrar (global)', formatAdminCurrency(receivables)], ['Ticket promedio', formatAdminCurrency(report?.averageTicket ?? 0)]].map(([label, value]) => <article className="admin-card" key={label}><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 flex items-center gap-1 text-xs font-black text-emerald-700"><TrendingUp className="size-3.5" />Periodo: {period}</p></article>)}</section>
    <section className="admin-card"><h2 className="admin-card-title">Productos más vendidos</h2><p className="admin-card-subtitle">Unidades de ventas vigentes en el periodo</p><div className="mt-5 space-y-4">{topProducts.map(({ productName, units }) => <div key={productName}><div className="flex justify-between gap-3 text-sm"><strong>{productName}</strong><span className="font-bold text-slate-500">{units} unidades</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400" style={{ width: `${Math.max(4, (units / maxUnits) * 100)}%` }} /></div></div>)}{topProducts.length === 0 && <EmptyState>No hay ventas vigentes en este periodo.</EmptyState>}</div></section>
    <section className="admin-card"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><FileClock /></div><div><h2 className="admin-card-title">Resumen por caja</h2><p className="admin-card-subtitle">Totales calculados en la base de datos</p></div></div><div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Caja</th><th>Ventas</th><th className="text-right">Total vendido</th><th className="text-right">Recaudo efectivo</th></tr></thead><tbody>{(report?.byRegister ?? []).map((totals) => <tr key={totals.registerId}><td><strong>{totals.registerName}</strong></td><td>{totals.sales}</td><td className="text-right font-black">{formatAdminCurrency(totals.total)}</td><td className="text-right font-black text-emerald-700">{formatAdminCurrency(totals.cash)}</td></tr>)}</tbody></table></div>{(report?.byRegister.length ?? 0) === 0 && <EmptyState>No hay cajas disponibles para este periodo.</EmptyState>}</section>
    <AdminDialog open={notice} title="Exportaciones" description="La consulta ya usa datos reales; la descarga de archivos aún no está habilitada." onClose={() => setNotice(false)} size="sm" footer={<button className="admin-primary-button" onClick={() => setNotice(false)} type="button">Entendido</button>}><p className="font-semibold text-slate-600">Puedes cambiar el periodo para consultar ventas, recaudo y productos.</p></AdminDialog>
  </div>
}
