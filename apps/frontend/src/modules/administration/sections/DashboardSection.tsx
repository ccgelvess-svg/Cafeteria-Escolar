import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Banknote, CircleDollarSign, PackageSearch, ShoppingBag, UsersRound } from 'lucide-react'

import { getSalesReport, listActiveCashRegisters, SALES_CHANGED_EVENT, type CashRegisterOption, type SalesReport } from '../../sales'
import { useStudents } from '../../students'
import { useInventory } from '../../inventory'
import { formatAdminCurrency } from '../format'
import { EmptyState, PageHeader } from '../components/AdminUi'

export function DashboardSection() {
  const [report, setReport] = useState<SalesReport | null>(null)
  const [registers, setRegisters] = useState<CashRegisterOption[]>([])
  const [inventoryRegisterId, setInventoryRegisterId] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const { students, loading: studentsLoading, error: studentsError } = useStudents()
  const { products, loading: inventoryLoading, error: inventoryError } = useInventory(inventoryRegisterId, false)

  const refresh = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const [salesResult, registersResult] = await Promise.allSettled([getSalesReport(start), listActiveCashRegisters()])
    const errors: string[] = []
    if (salesResult.status === 'fulfilled') setReport(salesResult.value)
    else errors.push(salesResult.reason instanceof Error ? salesResult.reason.message : 'No fue posible cargar las ventas.')
    if (registersResult.status === 'fulfilled') {
      setRegisters(registersResult.value)
      setInventoryRegisterId((current) => current && registersResult.value.some((item) => item.id === current)
        ? current : registersResult.value[0]?.id ?? '')
    }
    else errors.push(registersResult.reason instanceof Error ? registersResult.reason.message : 'No fue posible cargar las cajas.')
    setDashboardError(errors.join(' '))
    setDashboardLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(SALES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SALES_CHANGED_EVENT, refresh)
  }, [refresh])

  const debtStudents = students.filter((student) => student.netBalance < 0)
  const totalDebt = debtStudents.reduce((sum, student) => sum - student.netBalance, 0)
  const activeStudents = students.filter((student) => student.status === 'active').length
  const lowStock = products.filter((product) => product.active && product.stockQuantity <= product.minimumStock)
  const hourlySales = report?.hourlySales ?? []
  const maxHourlySales = Math.max(1, ...hourlySales.map((item) => item.sales))
  const error = [dashboardError, studentsError, inventoryError].filter(Boolean).join(' ')
  const loading = dashboardLoading || studentsLoading || inventoryLoading
  const metrics = [
    { label: 'Ventas del día', value: String(report?.completedSales ?? 0), helper: 'Ventas confirmadas hoy', icon: ShoppingBag, color: 'text-blue-700', background: 'bg-blue-50' },
    { label: 'Dinero recaudado', value: formatAdminCurrency(report?.cashRevenue ?? 0), helper: 'Efectivo confirmado hoy', icon: Banknote, color: 'text-emerald-700', background: 'bg-emerald-50' },
    { label: 'Deudas estudiantiles', value: formatAdminCurrency(totalDebt), helper: `${debtStudents.length} estudiantes con deuda real`, icon: CircleDollarSign, color: 'text-rose-700', background: 'bg-rose-50' },
    { label: 'Estudiantes registrados', value: String(students.length), helper: `${activeStudents} activos · ${students.length - activeStudents} inactivos`, icon: UsersRound, color: 'text-indigo-700', background: 'bg-indigo-50' },
  ]

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Resumen general" title="Dashboard" description="Indicadores reales de Supabase para la jornada actual." />
    {loading ? <div className="admin-card text-sm font-bold text-slate-500">Cargando datos reales…</div> : error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">Error de conexión: {error}</div> : <>
      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">{metrics.map(({ label, value, helper, icon: Icon, color, background }) => <article className="admin-card flex min-w-0 items-start gap-3" key={label}><div className={`grid size-12 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon aria-hidden="true" className="size-6" /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-500">{label}</p><strong className="mt-1 block truncate text-[clamp(1.35rem,2.5vw,1.8rem)] font-black text-slate-950">{value}</strong><p className="mt-1 text-xs font-semibold text-slate-400">{helper}</p></div></article>)}</section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <article className="admin-card min-w-0"><div className="flex items-start justify-between gap-3"><div><h2 className="admin-card-title">Ventas por hora</h2><p className="admin-card-subtitle">Comportamiento real de la jornada</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Hoy</span></div>{hourlySales.length > 0 ? <div className="mt-6 flex h-64 items-end gap-2 sm:gap-4" aria-label="Gráfico de ventas por hora">{hourlySales.map(({ hour, sales }) => <div className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2" key={hour}><span className="text-center text-xs font-black text-blue-700">{sales}</span><div className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-sky-400" style={{ height: `${Math.max(4, (sales / maxHourlySales) * 100)}%` }} /><span className="truncate text-center text-[0.65rem] font-bold text-slate-500 sm:text-xs">{new Intl.DateTimeFormat('es-CO', { hour: 'numeric' }).format(new Date(2026, 0, 1, hour))}</span></div>)}</div> : <div className="mt-5"><EmptyState>No hay ventas confirmadas hoy.</EmptyState></div>}</article>
        <article className="admin-card"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><PackageSearch aria-hidden="true" /></div><div><h2 className="admin-card-title">Alertas de inventario</h2><p className="admin-card-subtitle">Existencias de la caja seleccionada</p></div></div><label className="admin-field mt-3">Caja<select className="admin-select" value={inventoryRegisterId} onChange={(event) => setInventoryRegisterId(event.target.value)}>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><div className="mt-4 space-y-3">{lowStock.map((product) => <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3" key={product.id}><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="truncate font-black text-slate-900">{product.name}</p><p className="text-xs font-semibold text-slate-500">{product.stockQuantity} disponibles · mínimo {product.minimumStock}</p></div><span className="text-xs font-black text-amber-700">Bajo</span></div>)}{lowStock.length === 0 && <EmptyState>No hay alertas de inventario.</EmptyState>}</div></article>
      </section>
      <section className="grid gap-4 md:grid-cols-3">{[['Ticket promedio', formatAdminCurrency(report?.averageTicket ?? 0)], ['Productos vendidos', String(report?.soldUnits ?? 0)], ['Cajas activas', String(registers.length)]].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white px-4 py-3" key={label}><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></article>)}</section>
      <section className="admin-card"><h2 className="admin-card-title">Resumen por caja</h2><p className="admin-card-subtitle">Ventas vigentes de hoy, separadas por caja</p><div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Caja</th><th>Vigentes</th><th className="text-right">Total vendido</th><th className="text-right">Recaudo</th></tr></thead><tbody>{(report?.byRegister ?? []).map((item) => <tr key={item.registerId}><td><strong>{item.registerName}</strong></td><td>{item.sales}</td><td className="text-right font-black">{formatAdminCurrency(item.total)}</td><td className="text-right font-black text-emerald-700">{formatAdminCurrency(item.cash)}</td></tr>)}</tbody></table></div>{(report?.byRegister.length ?? 0) === 0 && <EmptyState>No hay cajas activas.</EmptyState>}</section>
    </>}
  </div>
}
