import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'
import { listAllStudentMovements, useStudents } from '../../students'
import type { StudentMovement } from '../../students'
import { accountTotals, filterAccountMovements } from '../balancesRules'
import type { MovementFilter } from '../balancesRules'
import { formatAdminCurrency } from '../format'
import { AdminDialog, EmptyState, PageHeader } from '../components/AdminUi'

const labels: Record<StudentMovement['type'], string> = {
  consumption: 'Consumo', 'top-up': 'Recarga', 'debt-payment': 'Abono', reversal: 'Reverso',
}

export function BalancesSection() {
  const { students, loading: studentsLoading, error: studentsError } = useStudents()
  const [movements, setMovements] = useState<StudentMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(true)
  const [movementsError, setMovementsError] = useState('')
  const [studentId, setStudentId] = useState('all')
  const [movementType, setMovementType] = useState<MovementFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)

  useEffect(() => {
    let active = true
    setMovementsLoading(true)
    void listAllStudentMovements()
      .then((items) => { if (active) { setMovements(items); setMovementsError('') } })
      .catch((cause) => { if (active) { setMovements([]); setMovementsError(cause instanceof Error ? cause.message : 'No fue posible cargar los movimientos.') } })
      .finally(() => { if (active) setMovementsLoading(false) })
    return () => { active = false }
  }, [students])

  useEffect(() => {
    if (studentId !== 'all' && !students.some((student) => student.id === studentId)) setStudentId('all')
  }, [studentId, students])

  const totals = useMemo(() => accountTotals(students, studentId), [students, studentId])
  const filtered = useMemo(() => filterAccountMovements(movements, studentId, movementType, fromDate), [movements, studentId, movementType, fromDate])
  const names = useMemo(() => new Map(students.map((student) => [student.id, `${student.firstName} ${student.lastName}`])), [students])
  const error = [studentsError, movementsError].filter(Boolean).join(' ')

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Cuentas estudiantiles" title="Saldos y deudas" description="Consulta saldos, deudas y movimientos registrados en PostgreSQL." action={<button className="admin-primary-button" disabled={students.length === 0} onClick={() => setAdjustmentOpen(true)} type="button"><SlidersHorizontal aria-hidden="true" className="size-5" />Preparar ajuste</button>} />
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-3">
      <article className="admin-card"><p className="text-sm font-bold text-slate-500">Saldo consultado</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatAdminCurrency(totals.balance)}</p></article>
      <article className="admin-card"><p className="text-sm font-bold text-slate-500">Deuda consultada</p><p className="mt-2 text-2xl font-black text-rose-700">{formatAdminCurrency(totals.debt)}</p></article>
      <article className="admin-card"><p className="text-sm font-bold text-slate-500">Movimientos encontrados</p><p className="mt-2 text-2xl font-black text-blue-700">{filtered.length}</p></article>
    </section>
    <section className="admin-card">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="admin-field">Estudiante<select className="admin-select" onChange={(event) => setStudentId(event.target.value)} value={studentId}><option value="all">Todos los estudiantes</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label>
        <label className="admin-field">Tipo de movimiento<select className="admin-select" onChange={(event) => setMovementType(event.target.value as MovementFilter)} value={movementType}><option value="all">Todos</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-field">Desde<div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" /><input className="admin-input admin-input-with-icon" onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} /></div></label>
      </div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Movimiento</th><th>Detalle</th><th className="text-right">Valor</th></tr></thead><tbody>{filtered.map((movement) => <tr key={movement.id}><td>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.occurredAt))}</td><td><strong>{names.get(movement.studentId) ?? 'Estudiante no disponible'}</strong></td><td>{labels[movement.type]}</td><td>{movement.detail}</td><td className="text-right font-black">{formatAdminCurrency(Math.abs(movement.amount))}</td></tr>)}</tbody></table></div>
      {!studentsLoading && !movementsLoading && !error && filtered.length === 0 && <EmptyState>No hay movimientos que coincidan con los filtros.</EmptyState>}
    </section>
    <AdminDialog open={adjustmentOpen} title="Preparar ajuste auditable" description="El ajuste no será aplicado ni persistido en esta fase." onClose={() => setAdjustmentOpen(false)} footer={<><button className="admin-secondary-button" onClick={() => setAdjustmentOpen(false)} type="button">Cancelar</button><button className="admin-primary-button" onClick={() => setAdjustmentOpen(false)} type="button">Guardar borrador</button></>}><div className="grid gap-4"><label className="admin-field">Estudiante<select className="admin-select"><option>Seleccionar estudiante</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="admin-field">Tipo<select className="admin-select"><option>Saldo a favor</option><option>Corrección de deuda</option></select></label><label className="admin-field">Valor<input className="admin-input" inputMode="numeric" placeholder="$ 0" /></label></div><label className="admin-field">Justificación<textarea className="admin-input min-h-24 resize-y" placeholder="Motivo obligatorio para auditoría futura" /></label></div></AdminDialog>
  </div>
}
