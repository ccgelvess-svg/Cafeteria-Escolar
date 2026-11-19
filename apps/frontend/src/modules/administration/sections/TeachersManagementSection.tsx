import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Eye, Pencil, Plus, Power, ReceiptText, WalletCards } from 'lucide-react'

import { listActiveCashRegisters, type CashRegisterOption } from '../../sales'
import { createIdempotencyKey, matchesStudentSearch, splitBalance } from '../../students'
import {
  listTeacherMovements,
  registerTeacherPayment,
  saveTeacher,
  scopeTeacherAccountReceiptMovements,
  setTeacherStatus,
  useTeachers,
  type Teacher,
  type TeacherDraft,
  type TeacherMovement,
} from '../../teachers'
import { AdminDialog, EmptyState, PageHeader, SearchField, StatusPill } from '../components/AdminUi'
import { formatAdminCurrency } from '../format'
import { StudentAccountReceipt, type StudentAccountReceiptData, type StudentAccountReceiptMode } from '../components/StudentAccountReceipt'

const movementLabels: Record<TeacherMovement['type'], string> = {
  consumption: 'Consumo', 'top-up': 'Recarga', 'debt-payment': 'Abono', reversal: 'Reverso',
}
const fullName = (teacher: Teacher) => `${teacher.firstName} ${teacher.lastName}`
const emptyTeacher = (cashRegisterId: string): TeacherDraft => ({ cashRegisterId, code: '', firstName: '', lastName: '' })

export function TeachersManagementSection() {
  const [registers, setRegisters] = useState<CashRegisterOption[]>([])
  const [cashRegisterId, setCashRegisterId] = useState('')
  const { teachers, loading, error: loadError, refresh } = useTeachers(cashRegisterId)
  const [registerError, setRegisterError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Todos')
  const [editor, setEditor] = useState<TeacherDraft | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [financeId, setFinanceId] = useState<string | null>(null)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [movements, setMovements] = useState<TeacherMovement[]>([])
  const [receipt, setReceipt] = useState<StudentAccountReceiptData | null>(null)
  const [receiptMode, setReceiptMode] = useState<StudentAccountReceiptMode>('summary')
  const [paymentValue, setPaymentValue] = useState('')
  const [paymentDetail, setPaymentDetail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void listActiveCashRegisters()
      .then((items) => {
        setRegisters(items)
        setCashRegisterId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? '')
        setRegisterError('')
      })
      .catch((cause) => setRegisterError(cause instanceof Error ? cause.message : 'No fue posible cargar las cajas.'))
  }, [])

  const account = teachers.find((item) => item.id === accountId) ?? null
  const financeTeacher = teachers.find((item) => item.id === financeId) ?? null
  const statusTeacher = teachers.find((item) => item.id === statusId) ?? null
  const selectedRegister = registers.find((item) => item.id === cashRegisterId) ?? null
  const filtered = useMemo(() => teachers.filter((teacher) =>
    matchesStudentSearch([fullName(teacher), teacher.code], query)
    && (status === 'Todos' || teacher.status === status)), [teachers, query, status])
  const totals = useMemo(() => teachers.reduce((summary, teacher) => {
    const split = splitBalance(teacher.netBalance)
    return { balance: summary.balance + split.balance, debt: summary.debt + split.debt }
  }, { balance: 0, debt: 0 }), [teachers])

  useEffect(() => {
    if (!account) { setMovements([]); return }
    setMovements([])
    void listTeacherMovements(account.id, account.cashRegisterId)
      .then(setMovements)
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'No fue posible cargar los movimientos.'))
  }, [account])

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('')
    try { await action(); await refresh(); return true }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No fue posible completar la operación.'); return false }
    finally { setBusy(false) }
  }

  async function submitTeacher() {
    if (editor && await run(() => saveTeacher(editor))) setEditor(null)
  }

  async function toggleTeacher() {
    if (statusTeacher && await run(() => setTeacherStatus(statusTeacher.id, statusTeacher.status === 'active' ? 'inactive' : 'active'))) setStatusId(null)
  }

  async function submitPayment() {
    const value = Number(paymentValue)
    if (!financeTeacher || !Number.isSafeInteger(value) || value <= 0) return
    const type = financeTeacher.netBalance < 0 ? 'debt-payment' : 'top-up'
    if (await run(() => registerTeacherPayment({
      teacherId: financeTeacher.id,
      cashRegisterId: financeTeacher.cashRegisterId,
      type,
      value,
      detail: paymentDetail.trim() || (type === 'debt-payment' ? 'Abono docente' : 'Recarga docente'),
      idempotencyKey: createIdempotencyKey('teacher-admin'),
    }))) {
      setFinanceId(null); setPaymentValue(''); setPaymentDetail('')
    }
  }

  async function openReceipt(teacher: Teacher) {
    const register = registers.find((item) => item.id === cashRegisterId)
    if (!register || teacher.cashRegisterId !== register.id) {
      setMessage('Espera a que termine de cargar la cuenta del colegio seleccionado.')
      return
    }
    const requested = {
      account: { ...teacher, kind: 'teacher' as const }, cashRegisterId: register.id,
      schoolName: register.name, generatedAt: new Date().toISOString(), movements: [], loading: true,
    } satisfies StudentAccountReceiptData
    setReceiptMode('summary')
    setReceipt(requested)
    setMessage('')
    try {
      const scopedMovements = scopeTeacherAccountReceiptMovements(
        await listTeacherMovements(teacher.id, register.id), teacher.id, register.id,
      )
      setReceipt((current) => current?.account.id === teacher.id && current.cashRegisterId === register.id
        ? { ...current, movements: scopedMovements, loading: false }
        : current)
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'No fue posible generar el comprobante.'
      setReceipt((current) => current?.account.id === teacher.id && current.cashRegisterId === register.id
        ? { ...current, loading: false, error }
        : current)
    }
  }

  function changeRegister(nextId: string) {
    setCashRegisterId(nextId); setQuery(''); setStatus('Todos'); setEditor(null)
    setAccountId(null); setFinanceId(null); setStatusId(null); setReceipt(null); setMessage('')
  }

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Cuentas por colegio" title="Profesores" description="Registra docentes y administra fiados, abonos e historial separados por caja." action={<button className="admin-primary-button" disabled={!cashRegisterId} onClick={() => setEditor(emptyTeacher(cashRegisterId))} type="button"><Plus aria-hidden="true" className="size-5" />Nuevo profesor</button>} />
    {(message || loadError || registerError) && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="alert">{message || loadError || registerError}</div>}

    <section className="admin-card">
      <label className="admin-field max-w-md">Colegio / caja<select className="admin-select" onChange={(event) => changeRegister(event.target.value)} value={cashRegisterId}><option value="">Seleccionar caja</option>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="admin-card"><p className="text-sm font-bold text-slate-500">Profesores registrados</p><p className="mt-1 text-3xl font-black text-slate-950">{teachers.length}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-emerald-700">Saldos a favor</p><p className="mt-1 text-2xl font-black text-emerald-800">{formatAdminCurrency(totals.balance)}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-rose-700">Deudas pendientes</p><p className="mt-1 text-2xl font-black text-rose-800">{formatAdminCurrency(totals.debt)}</p></div>
    </div>

    <section className="admin-card">
      <div className="grid gap-3 md:grid-cols-[1fr_11rem]"><SearchField onChange={setQuery} placeholder="Buscar profesor por nombre o código" value={query} /><select aria-label="Filtrar por estado" className="admin-select" onChange={(event) => setStatus(event.target.value)} value={status}><option>Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Profesor</th><th>Código</th><th>Caja</th><th>Saldo</th><th>Deuda</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{filtered.map((teacher) => { const split = splitBalance(teacher.netBalance); return <tr key={teacher.id}><td><strong>{fullName(teacher)}</strong></td><td>{teacher.code}</td><td>{selectedRegister?.name ?? '—'}</td><td className="font-black text-emerald-700">{formatAdminCurrency(split.balance)}</td><td className="font-black text-rose-600">{formatAdminCurrency(split.debt)}</td><td><StatusPill active={teacher.status === 'active'} /></td><td><div className="flex justify-end gap-1"><button aria-label={`Ver movimientos de ${fullName(teacher)}`} className="admin-icon-button" onClick={() => setAccountId(teacher.id)} title="Ver movimientos" type="button"><Eye className="size-4" /></button><button aria-label={`Generar comprobante de ${fullName(teacher)}`} className="admin-icon-button" disabled={teacher.cashRegisterId !== cashRegisterId} onClick={() => void openReceipt(teacher)} title="Comprobante" type="button"><ReceiptText className="size-4" /></button><button aria-label={`Registrar abono de ${fullName(teacher)}`} className="admin-icon-button" onClick={() => { setFinanceId(teacher.id); setPaymentValue(''); setPaymentDetail('') }} title="Registrar abono" type="button"><WalletCards className="size-4" /></button><button aria-label={`Editar ${fullName(teacher)}`} className="admin-icon-button" onClick={() => setEditor({ id: teacher.id, cashRegisterId: teacher.cashRegisterId, code: teacher.code, firstName: teacher.firstName, lastName: teacher.lastName, status: teacher.status })} title="Editar" type="button"><Pencil className="size-4" /></button><button aria-label={`Cambiar estado de ${fullName(teacher)}`} className="admin-icon-button" onClick={() => setStatusId(teacher.id)} title="Activar / Desactivar" type="button"><Power className="size-4" /></button></div></td></tr> })}</tbody></table></div>
      {!loading && filtered.length === 0 && <EmptyState>{cashRegisterId ? 'No hay profesores que coincidan con los filtros.' : 'Selecciona una caja para consultar profesores.'}</EmptyState>}
    </section>

    <AdminDialog open={Boolean(editor)} title={editor?.id ? 'Editar profesor' : 'Nuevo profesor'} description="El código es único dentro de cada caja." onClose={() => setEditor(null)} footer={<><button className="admin-secondary-button" onClick={() => setEditor(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy} onClick={() => void submitTeacher()} type="button">Guardar</button></>}>
      {editor && <div className="grid gap-4 sm:grid-cols-2"><label className="admin-field sm:col-span-2">Colegio / caja<select className="admin-select" onChange={(event) => setEditor({ ...editor, cashRegisterId: event.target.value })} value={editor.cashRegisterId}>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><label className="admin-field">Nombre<input className="admin-input" onChange={(event) => setEditor({ ...editor, firstName: event.target.value })} value={editor.firstName} /></label><label className="admin-field">Apellido<input className="admin-input" onChange={(event) => setEditor({ ...editor, lastName: event.target.value })} value={editor.lastName} /></label><label className="admin-field sm:col-span-2">Código único<input className="admin-input" onChange={(event) => setEditor({ ...editor, code: event.target.value })} value={editor.code} /></label></div>}
    </AdminDialog>

    <AdminDialog open={Boolean(financeTeacher)} title="Registrar abono" description={financeTeacher ? `${fullName(financeTeacher)} · ${financeTeacher.code}` : ''} onClose={() => setFinanceId(null)} footer={<><button className="admin-secondary-button" onClick={() => setFinanceId(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy || Number(paymentValue) <= 0} onClick={() => void submitPayment()} type="button">Registrar</button></>}>
      {financeTeacher && <div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">Saldo</p><p className="text-2xl font-black text-emerald-900">{formatAdminCurrency(splitBalance(financeTeacher.netBalance).balance)}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm font-bold text-rose-700">Deuda</p><p className="text-2xl font-black text-rose-900">{formatAdminCurrency(splitBalance(financeTeacher.netBalance).debt)}</p></div></div><label className="admin-field">Valor en COP<input className="admin-input" inputMode="numeric" min="1" onChange={(event) => setPaymentValue(event.target.value.replace(/\D/g, ''))} type="number" value={paymentValue} /></label><label className="admin-field">Detalle<input className="admin-input" onChange={(event) => setPaymentDetail(event.target.value)} placeholder="Referencia del abono" value={paymentDetail} /></label></div>}
    </AdminDialog>

    <AdminDialog open={Boolean(account)} title="Movimientos del profesor" description={account ? `${fullName(account)} · ${selectedRegister?.name ?? ''}` : ''} onClose={() => setAccountId(null)} size="lg" footer={<button className="admin-primary-button" onClick={() => setAccountId(null)} type="button">Cerrar</button>}>
      {account && <><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">Saldo disponible</p><p className="text-2xl font-black text-emerald-900">{formatAdminCurrency(splitBalance(account.netBalance).balance)}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm font-bold text-rose-700">Deuda acumulada</p><p className="text-2xl font-black text-rose-900">{formatAdminCurrency(splitBalance(account.netBalance).debt)}</p></div></div><div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Detalle</th><th>Valor</th><th>Responsable</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.occurredAt))}</td><td>{movementLabels[movement.type]}</td><td>{movement.detail}</td><td className={movement.amount < 0 ? 'font-black text-rose-600' : 'font-black text-emerald-700'}>{formatAdminCurrency(movement.amount)}</td><td>{movement.responsible}</td></tr>)}</tbody></table></div>{movements.length === 0 && <EmptyState>Este profesor todavía no tiene movimientos.</EmptyState>}</>}
    </AdminDialog>

    <StudentAccountReceipt data={receipt} mode={receiptMode} onClose={() => setReceipt(null)} onModeChange={setReceiptMode} />

    <AdminDialog open={Boolean(statusTeacher)} title={statusTeacher?.status === 'active' ? 'Desactivar profesor' : 'Activar profesor'} description="Los movimientos históricos se conservarán." onClose={() => setStatusId(null)} size="sm" footer={<><button className="admin-secondary-button" onClick={() => setStatusId(null)} type="button">Cancelar</button><button className="admin-danger-button" disabled={busy} onClick={() => void toggleTeacher()} type="button">Confirmar cambio</button></>}><p className="flex items-center gap-2 font-semibold text-slate-600"><BriefcaseBusiness className="size-5 text-blue-600" />¿Deseas cambiar el estado de <strong className="text-slate-950">{statusTeacher ? fullName(statusTeacher) : ''}</strong>?</p></AdminDialog>
  </div>
}
