import { useMemo, useState } from 'react'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'

import { demoMovements, demoStudents } from '../data'
import { formatAdminCurrency, studentFullName } from '../format'
import { AdminDialog, DemoBanner, PageHeader } from '../components/AdminUi'

export function BalancesSection() {
  const [studentId, setStudentId] = useState('all')
  const [movementType, setMovementType] = useState('Todos')
  const [fromDate, setFromDate] = useState('2026-10-01')
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const selected = demoStudents.find((student) => student.id === studentId)
  const filtered = useMemo(() => demoMovements.filter((movement) => (studentId === 'all' || movement.studentId === studentId) && (movementType === 'Todos' || movement.type === movementType) && movement.date >= fromDate), [studentId, movementType, fromDate])
  const studentName = (id: string) => { const student = demoStudents.find((item) => item.id === id); return student ? studentFullName(student) : id }

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Cuentas estudiantiles" title="Saldos y deudas" description="Consulta movimientos y prepara ajustes autorizados para revisión posterior." action={<button className="admin-primary-button" onClick={() => setAdjustmentOpen(true)} type="button"><SlidersHorizontal aria-hidden="true" className="size-5" />Preparar ajuste</button>} />
    <DemoBanner />
    <section className="grid gap-3 sm:grid-cols-3"><article className="admin-card"><p className="text-sm font-bold text-slate-500">Saldo consultado</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatAdminCurrency(selected?.balance ?? 44600)}</p></article><article className="admin-card"><p className="text-sm font-bold text-slate-500">Deuda consultada</p><p className="mt-2 text-2xl font-black text-rose-700">{formatAdminCurrency(selected?.debt ?? 11500)}</p></article><article className="admin-card"><p className="text-sm font-bold text-slate-500">Movimientos encontrados</p><p className="mt-2 text-2xl font-black text-blue-700">{filtered.length}</p></article></section>
    <section className="admin-card">
      <div className="grid gap-3 md:grid-cols-3"><label className="admin-field">Estudiante<select className="admin-select" onChange={(e) => setStudentId(e.target.value)} value={studentId}><option value="all">Todos los estudiantes</option>{demoStudents.map((student) => <option key={student.id} value={student.id}>{studentFullName(student)}</option>)}</select></label><label className="admin-field">Tipo de movimiento<select className="admin-select" onChange={(e) => setMovementType(e.target.value)} value={movementType}>{['Todos', 'Consumo', 'Recarga', 'Abono'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="admin-field">Desde<div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" /><input className="admin-input admin-input-with-icon" onChange={(e) => setFromDate(e.target.value)} type="date" value={fromDate} /></div></label></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Movimiento</th><th>Detalle</th><th className="text-right">Valor</th></tr></thead><tbody>{filtered.map((movement) => <tr key={movement.id}><td>{movement.date}</td><td><strong>{studentName(movement.studentId)}</strong></td><td><span className={`rounded-full px-2 py-1 text-xs font-black ${movement.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{movement.type}</span></td><td>{movement.detail}</td><td className={`text-right font-black ${movement.amount > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{formatAdminCurrency(Math.abs(movement.amount))}</td></tr>)}</tbody></table></div>
    </section>
    <AdminDialog open={adjustmentOpen} title="Preparar ajuste auditable" description="El ajuste no será aplicado ni persistido en esta fase." onClose={() => setAdjustmentOpen(false)} footer={<><button className="admin-secondary-button" onClick={() => setAdjustmentOpen(false)} type="button">Cancelar</button><button className="admin-primary-button" onClick={() => setAdjustmentOpen(false)} type="button">Guardar borrador</button></>}><div className="grid gap-4"><label className="admin-field">Estudiante<select className="admin-select"><option>Seleccionar estudiante</option>{demoStudents.map((student) => <option key={student.id}>{studentFullName(student)}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="admin-field">Tipo<select className="admin-select"><option>Saldo a favor</option><option>Corrección de deuda</option></select></label><label className="admin-field">Valor<input className="admin-input" inputMode="numeric" placeholder="$ 0" /></label></div><label className="admin-field">Justificación<textarea className="admin-input min-h-24 resize-y" placeholder="Motivo obligatorio para auditoría futura" /></label></div></AdminDialog>
  </div>
}
