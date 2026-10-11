import { useMemo, useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'

import { demoSales } from '../data'
import { formatAdminCurrency } from '../format'
import type { SaleRecord } from '../types'
import { AdminDialog, DemoBanner, PageHeader, SearchField } from '../components/AdminUi'

export function SalesSection() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('Todas')
  const [register, setRegister] = useState('Todas')
  const [selected, setSelected] = useState<SaleRecord | null>(null)
  const [annul, setAnnul] = useState<SaleRecord | null>(null)
  const filtered = useMemo(() => demoSales.filter((sale) => `${sale.id} ${sale.customer} ${sale.cashier}`.toLowerCase().includes(query.toLowerCase()) && (type === 'Todas' || sale.type === type) && (register === 'Todas' || sale.register === register)), [query, type, register])

  return <div className="admin-page-stack"><PageHeader eyebrow="Trazabilidad" title="Ventas" description="Consulta ventas de demostración y prepara solicitudes de anulación autorizada." /><DemoBanner />
    <section className="admin-card"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px]"><SearchField onChange={setQuery} placeholder="Buscar venta, cliente o cajero" value={query} /><select className="admin-select" onChange={(e) => setType(e.target.value)} value={type}>{['Todas', 'Venta libre', 'Estudiante'].map((item) => <option key={item}>{item}</option>)}</select><select className="admin-select" onChange={(e) => setRegister(e.target.value)} value={register}>{['Todas', 'Caja 01', 'Caja 02'].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Cajero / caja</th><th className="text-right">Total</th><th className="text-right">Acciones</th></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{sale.date}<span className="block text-xs text-slate-400">{sale.time}</span></td><td>{sale.customer}</td><td><span className={`rounded-full px-2 py-1 text-xs font-black ${sale.type === 'Estudiante' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>{sale.type}</span></td><td>{sale.cashier}<span className="block text-xs text-slate-400">{sale.register}</span></td><td className="text-right font-black">{formatAdminCurrency(sale.total)}</td><td><div className="flex justify-end gap-1"><button className="admin-icon-button" onClick={() => setSelected(sale)} aria-label={`Ver ${sale.id}`} type="button"><Eye className="size-4" /></button><button className="admin-icon-button text-rose-600" onClick={() => setAnnul(sale)} aria-label={`Preparar anulación ${sale.id}`} type="button"><RotateCcw className="size-4" /></button></div></td></tr>)}</tbody></table></div>
    </section>
    <AdminDialog open={Boolean(selected)} title={`Detalle de venta ${selected?.id ?? ''}`} description={selected ? `${selected.date} · ${selected.time} · ${selected.register}` : ''} onClose={() => setSelected(null)} footer={<button className="admin-primary-button" onClick={() => setSelected(null)} type="button">Cerrar</button>}>{selected && <div><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{selected.items.map((item) => <div className="flex justify-between gap-3 p-3" key={item.name}><span className="font-bold">{item.quantity} × {item.name}</span><strong>{formatAdminCurrency(item.subtotal)}</strong></div>)}</div><div className="mt-3 flex justify-between rounded-xl bg-slate-100 p-4 text-lg"><strong>Total</strong><strong>{formatAdminCurrency(selected.total)}</strong></div></div>}</AdminDialog>
    <AdminDialog open={Boolean(annul)} title={`Preparar anulación ${annul?.id ?? ''}`} description="Requerirá autorización y auditoría cuando exista backend." onClose={() => setAnnul(null)} size="sm" footer={<><button className="admin-secondary-button" onClick={() => setAnnul(null)} type="button">Cancelar</button><button className="admin-danger-button" onClick={() => setAnnul(null)} type="button">Guardar solicitud</button></>}><label className="admin-field">Motivo<textarea className="admin-input min-h-24" placeholder="Motivo obligatorio" /></label></AdminDialog>
  </div>
}
