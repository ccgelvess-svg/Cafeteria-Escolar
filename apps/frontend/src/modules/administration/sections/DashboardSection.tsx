import { AlertTriangle, Banknote, CircleDollarSign, PackageSearch, ShoppingBag, UsersRound } from 'lucide-react'

import { salesByHour } from '../data'
import { formatAdminCurrency } from '../format'
import { DemoBanner, PageHeader } from '../components/AdminUi'

const metrics = [
  { label: 'Ventas del día', value: '184', helper: '+12% frente al viernes anterior', icon: ShoppingBag, color: 'text-blue-700', background: 'bg-blue-50' },
  { label: 'Dinero recaudado', value: formatAdminCurrency(846500), helper: 'Efectivo y consumos demostrativos', icon: Banknote, color: 'text-emerald-700', background: 'bg-emerald-50' },
  { label: 'Deudas estudiantiles', value: formatAdminCurrency(128400), helper: '27 estudiantes con saldo pendiente', icon: CircleDollarSign, color: 'text-rose-700', background: 'bg-rose-50' },
  { label: 'Estudiantes registrados', value: '486', helper: '451 activos · 35 inactivos', icon: UsersRound, color: 'text-indigo-700', background: 'bg-indigo-50' },
]

export function DashboardSection() {
  return (
    <div className="admin-page-stack">
      <PageHeader eyebrow="Resumen general" title="Dashboard" description="Indicadores operativos de la cafetería para la jornada actual." />
      <DemoBanner />
      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {metrics.map(({ label, value, helper, icon: Icon, color, background }) => (
          <article className="admin-card flex min-w-0 items-start gap-3" key={label}>
            <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon aria-hidden="true" className="size-6" /></div>
            <div className="min-w-0"><p className="text-sm font-bold text-slate-500">{label}</p><strong className="mt-1 block truncate text-[clamp(1.35rem,2.5vw,1.8rem)] font-black text-slate-950">{value}</strong><p className="mt-1 text-xs font-semibold text-slate-400">{helper}</p></div>
          </article>
        ))}
      </section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <article className="admin-card min-w-0">
          <div className="flex items-start justify-between gap-3"><div><h2 className="admin-card-title">Ventas por hora</h2><p className="admin-card-subtitle">Comportamiento estimado de la jornada</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Hoy</span></div>
          <div className="mt-6 flex h-64 items-end gap-2 sm:gap-4" aria-label="Gráfico de ventas por hora">
            {salesByHour.map((item) => <div className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2" key={item.label}><span className="text-center text-xs font-black text-blue-700">{item.value}</span><div className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-sky-400" style={{ height: `${item.value}%` }} /><span className="truncate text-center text-[0.65rem] font-bold text-slate-500 sm:text-xs">{item.label}</span></div>)}
          </div>
        </article>
        <article className="admin-card">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><PackageSearch aria-hidden="true" /></div><div><h2 className="admin-card-title">Alertas de inventario</h2><p className="admin-card-subtitle">Requieren revisión</p></div></div>
          <div className="mt-4 space-y-3">
            {[['Agua pequeña', '8 unidades', 'Crítico'], ['Pastel de carne', '12 unidades', 'Bajo'], ['Gaseosa pequeña', '15 unidades', 'Bajo']].map(([name, stock, status]) => <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3" key={name}><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="truncate font-black text-slate-900">{name}</p><p className="text-xs font-semibold text-slate-500">{stock} disponibles</p></div><span className="text-xs font-black text-amber-700">{status}</span></div>)}
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400">Solo consulta. La gestión de inventario se desarrollará en una fase posterior.</p>
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-3">{[['Ticket promedio', formatAdminCurrency(4600)], ['Productos vendidos', '326'], ['Cajas abiertas', '1 de 3']].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white px-4 py-3" key={label}><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></article>)}</section>
    </div>
  )
}
