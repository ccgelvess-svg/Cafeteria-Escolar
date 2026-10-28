import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Power, RotateCcw, WalletCards } from 'lucide-react'

import { createIdempotencyKey, isMovementReversible, listStudentMovements, matchesStudentSearch, registerMovement, reverseMovement, saveStudent, setStudentStatus, splitBalance, useStudents } from '../../students'
import type { Student, StudentDraft, StudentMovement } from '../../students'
import { formatAdminCurrency } from '../format'
import { AdminDialog, EmptyState, PageHeader, SearchField, StatusPill } from '../components/AdminUi'
import { useAuth } from '../../auth'

const emptyStudent: StudentDraft = { code: '', firstName: '', lastName: '', grade: '5°', group: 'A' }
const movementLabels = { consumption: 'Consumo', 'top-up': 'Recarga', 'debt-payment': 'Abono', reversal: 'Reverso' } as const
const fullName = (student: Student) => `${student.firstName} ${student.lastName}`

export function StudentsManagementSection() {
  const { session } = useAuth()
  const { students, loading, error: loadError, refresh } = useStudents()
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('Todos')
  const [status, setStatus] = useState('Todos')
  const [editor, setEditor] = useState<StudentDraft | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [financeId, setFinanceId] = useState<string | null>(null)
  const [movementType, setMovementType] = useState<'top-up' | 'debt-payment'>('top-up')
  const [movementValue, setMovementValue] = useState('')
  const [movementDetail, setMovementDetail] = useState('')
  const [confirmMovement, setConfirmMovement] = useState(false)
  const [movements, setMovements] = useState<StudentMovement[]>([])
  const [reversal, setReversal] = useState<{ student: Student; movement: StudentMovement } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const account = students.find((item) => item.id === accountId) ?? null
  const statusStudent = students.find((item) => item.id === statusId) ?? null
  const financeStudent = students.find((item) => item.id === financeId) ?? null
  const grades = useMemo(() => ['Todos', ...Array.from(new Set(students.map((item) => item.grade))).sort()], [students])
  const filtered = useMemo(() => {
    return students.filter((item) => matchesStudentSearch([fullName(item), item.code, item.grade, item.group], query)
      && (grade === 'Todos' || item.grade === grade) && (status === 'Todos' || item.status === status))
  }, [students, query, grade, status])
  const totals = useMemo(() => students.reduce((summary, item) => {
    const split = splitBalance(item.netBalance)
    return { balance: summary.balance + split.balance, debt: summary.debt + split.debt }
  }, { balance: 0, debt: 0 }), [students])

  useEffect(() => {
    if (!accountId) return
    void listStudentMovements(accountId).then(setMovements).catch((cause) => setMessage(cause instanceof Error ? cause.message : 'No fue posible cargar los movimientos.'))
  }, [accountId, students])

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('')
    try { await action(); await refresh(); return true }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No fue posible completar la operación.'); return false }
    finally { setBusy(false) }
  }

  async function submitStudent() {
    if (editor && await run(() => saveStudent(editor))) setEditor(null)
  }
  async function toggleStudent() {
    if (statusStudent && await run(() => setStudentStatus(statusStudent.id, statusStudent.status === 'active' ? 'inactive' : 'active'))) setStatusId(null)
  }
  async function submitMovement() {
    if (!financeStudent) return
    if (await run(() => registerMovement({ studentId: financeStudent.id, type: movementType, value: Number(movementValue), detail: movementDetail.trim() || (movementType === 'top-up' ? 'Recarga administrativa' : 'Abono a cuenta'), responsible: session?.user.displayName ?? '', idempotencyKey: createIdempotencyKey('admin') }))) {
      setFinanceId(null); setConfirmMovement(false); setMovementValue(''); setMovementDetail('')
    }
  }
  function openFinance(student: Student) {
    setFinanceId(student.id); setMovementType(student.netBalance < 0 ? 'debt-payment' : 'top-up')
    setMovementValue(''); setMovementDetail(''); setConfirmMovement(false); setMessage('')
  }

  async function confirmReversal() {
    if (!reversal) return
    const { student, movement } = reversal
    setBusy(true); setMessage('')
    try {
      await reverseMovement(student.id, movement.id, session?.user.displayName ?? '')
      setMovements(await listStudentMovements(student.id))
      await refresh()
      setReversal(null); setAccountId(student.id)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No fue posible reversar el movimiento.') }
    finally { setBusy(false) }
  }

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Gestión académica" title="Estudiantes" description="Administra estudiantes y sus cuentas protegidas en PostgreSQL." action={<button className="admin-primary-button" onClick={() => { setEditor({ ...emptyStudent }); setMessage('') }} type="button"><Plus aria-hidden="true" className="size-5" />Nuevo estudiante</button>} />
    {(message || loadError) && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">{message || loadError}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="admin-card"><p className="text-sm font-bold text-slate-500">Registrados</p><p className="mt-1 text-3xl font-black text-slate-950">{students.length}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-emerald-700">Saldos a favor</p><p className="mt-1 text-2xl font-black text-emerald-800">{formatAdminCurrency(totals.balance)}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-rose-700">Deudas pendientes</p><p className="mt-1 text-2xl font-black text-rose-800">{formatAdminCurrency(totals.debt)}</p></div>
    </div>
    <section className="admin-card">
      <div className="grid gap-3 md:grid-cols-[1fr_11rem_11rem]"><SearchField onChange={setQuery} placeholder="Buscar por nombre, código o grado" value={query} /><select aria-label="Filtrar por grado" className="admin-select" onChange={(event) => setGrade(event.target.value)} value={grade}>{grades.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filtrar por estado" className="admin-select" onChange={(event) => setStatus(event.target.value)} value={status}><option>Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Estudiante</th><th>Código</th><th>Curso</th><th>Saldo</th><th>Deuda</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{filtered.map((student) => { const split = splitBalance(student.netBalance); return <tr key={student.id}><td><strong>{fullName(student)}</strong></td><td>{student.code}</td><td>{student.grade} {student.group}</td><td className="font-black text-emerald-700">{formatAdminCurrency(split.balance)}</td><td className="font-black text-rose-600">{formatAdminCurrency(split.debt)}</td><td><StatusPill active={student.status === 'active'} /></td><td><div className="flex justify-end gap-1"><button aria-label={`Ver movimientos de ${fullName(student)}`} className="admin-icon-button" onClick={() => setAccountId(student.id)} title="Ver movimientos" type="button"><Eye aria-hidden="true" className="size-4" /></button><button aria-label={`Recargar o abonar a ${fullName(student)}`} className="admin-icon-button" onClick={() => openFinance(student)} title="Recargar / Abonar" type="button"><WalletCards aria-hidden="true" className="size-4" /></button><button aria-label={`Editar ${fullName(student)}`} className="admin-icon-button" onClick={() => setEditor({ id: student.id, code: student.code, firstName: student.firstName, lastName: student.lastName, grade: student.grade, group: student.group, status: student.status })} title="Editar" type="button"><Pencil aria-hidden="true" className="size-4" /></button><button aria-label={`Cambiar estado de ${fullName(student)}`} className="admin-icon-button" onClick={() => setStatusId(student.id)} title="Activar / Desactivar" type="button"><Power aria-hidden="true" className="size-4" /></button></div></td></tr> })}</tbody></table></div>
      {!loading && filtered.length === 0 && <EmptyState>No hay estudiantes que coincidan con los filtros.</EmptyState>}
    </section>

    <AdminDialog open={Boolean(editor)} title={editor?.id ? 'Editar estudiante' : 'Nuevo estudiante'} description="El código debe ser único." onClose={() => setEditor(null)} footer={<><button className="admin-secondary-button" onClick={() => setEditor(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy} onClick={submitStudent} type="button">Guardar</button></>}>
      {editor && <div className="grid gap-4 sm:grid-cols-2"><label className="admin-field">Nombre<input className="admin-input" onChange={(e) => setEditor({ ...editor, firstName: e.target.value })} value={editor.firstName} /></label><label className="admin-field">Apellido<input className="admin-input" onChange={(e) => setEditor({ ...editor, lastName: e.target.value })} value={editor.lastName} /></label><label className="admin-field">Código único<input className="admin-input" onChange={(e) => setEditor({ ...editor, code: e.target.value })} value={editor.code} /></label><label className="admin-field">Grado<input className="admin-input" onChange={(e) => setEditor({ ...editor, grade: e.target.value })} value={editor.grade} /></label><label className="admin-field">Grupo<input className="admin-input" onChange={(e) => setEditor({ ...editor, group: e.target.value })} value={editor.group} /></label></div>}
    </AdminDialog>

    <AdminDialog open={Boolean(financeStudent)} title={confirmMovement ? 'Confirmar movimiento' : 'Recargar / Abonar'} description={financeStudent ? `${fullName(financeStudent)} · ${financeStudent.code}` : ''} onClose={() => { setFinanceId(null); setConfirmMovement(false) }} footer={<><button className="admin-secondary-button" onClick={() => confirmMovement ? setConfirmMovement(false) : setFinanceId(null)} type="button">{confirmMovement ? 'Volver' : 'Cancelar'}</button><button className="admin-primary-button" disabled={busy || Number(movementValue) <= 0} onClick={() => confirmMovement ? void submitMovement() : setConfirmMovement(true)} type="button">{confirmMovement ? 'Confirmar y registrar' : 'Continuar'}</button></>}>
      {confirmMovement ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><p>Se registrará un movimiento auditable e inmutable.</p><p className="mt-2 text-xl font-black">{movementType === 'top-up' ? 'Recarga' : 'Abono'} · {formatAdminCurrency(Number(movementValue) || 0)}</p><p className="mt-1">{movementDetail || (movementType === 'top-up' ? 'Recarga administrativa' : 'Abono a cuenta')}</p></div> : <div className="grid gap-4"><label className="admin-field">Tipo<select className="admin-select" onChange={(e) => setMovementType(e.target.value as 'top-up' | 'debt-payment')} value={movementType}><option value="top-up">Recarga</option><option value="debt-payment">Abono a deuda</option></select></label><label className="admin-field">Valor en COP<input className="admin-input" inputMode="numeric" min="1" onChange={(e) => setMovementValue(e.target.value.replace(/\D/g, ''))} type="number" value={movementValue} /></label><label className="admin-field">Detalle<input className="admin-input" onChange={(e) => setMovementDetail(e.target.value)} placeholder="Motivo o referencia" value={movementDetail} /></label></div>}
    </AdminDialog>

    <AdminDialog open={Boolean(account)} title="Movimientos financieros" description={account ? `${fullName(account)} · ${account.code}` : ''} onClose={() => setAccountId(null)} size="lg" footer={<button className="admin-primary-button" onClick={() => setAccountId(null)} type="button">Cerrar</button>}>
      {account && <><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">Saldo disponible</p><p className="mt-1 text-2xl font-black text-emerald-900">{formatAdminCurrency(splitBalance(account.netBalance).balance)}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm font-bold text-rose-700">Deuda acumulada</p><p className="mt-1 text-2xl font-black text-rose-900">{formatAdminCurrency(splitBalance(account.netBalance).debt)}</p></div></div><div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Detalle</th><th>Valor</th><th>Responsable</th><th className="text-right">Acciones</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.occurredAt))}</td><td>{movementLabels[movement.type]}</td><td>{movement.detail}</td><td className={movement.amount < 0 ? 'font-black text-rose-600' : 'font-black text-emerald-700'}>{formatAdminCurrency(movement.amount)}</td><td>{movement.responsible}</td><td><div className="flex justify-end"><button aria-label={`Reversar movimiento ${movement.id}`} className="admin-icon-button text-rose-600" disabled={!isMovementReversible(movement, movements)} onClick={() => { setReversal({ student: account, movement }); setAccountId(null) }} title="Reversar movimiento" type="button"><RotateCcw aria-hidden="true" className="size-4" /></button></div></td></tr>)}</tbody></table></div>{movements.length === 0 && <EmptyState>Este estudiante todavía no tiene movimientos.</EmptyState>}</>}
    </AdminDialog>

    <AdminDialog open={Boolean(reversal)} title="Confirmar reversión" description={reversal ? `${fullName(reversal.student)} · ${movementLabels[reversal.movement.type]}` : ''} onClose={() => { if (reversal) setAccountId(reversal.student.id); setReversal(null) }} size="sm" footer={<><button className="admin-secondary-button" onClick={() => { if (reversal) setAccountId(reversal.student.id); setReversal(null) }} type="button">Cancelar</button><button className="admin-danger-button" disabled={busy} onClick={() => void confirmReversal()} type="button">Reversar movimiento</button></>}><p className="font-semibold text-slate-600">Se creará un movimiento compensatorio auditable. El registro original permanecerá intacto.</p></AdminDialog>

    <AdminDialog open={Boolean(statusStudent)} title={statusStudent?.status === 'active' ? 'Desactivar estudiante' : 'Activar estudiante'} description="Los movimientos históricos se conservarán." onClose={() => setStatusId(null)} size="sm" footer={<><button className="admin-secondary-button" onClick={() => setStatusId(null)} type="button">Cancelar</button><button className="admin-danger-button" disabled={busy} onClick={toggleStudent} type="button">Confirmar cambio</button></>}><p className="font-semibold text-slate-600">¿Deseas cambiar el estado de <strong className="text-slate-950">{statusStudent ? fullName(statusStudent) : ''}</strong>?</p></AdminDialog>
  </div>
}
