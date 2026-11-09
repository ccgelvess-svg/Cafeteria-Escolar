import { CircleDollarSign, Search, X } from 'lucide-react'

import { matchesStudentSearch } from '../../students'
import type { Student } from '../types'
import { formatCurrency } from '../format'

interface StudentPaymentDialogProps {
  busy: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
  onQueryChange: (value: string) => void
  onSelectStudent: (studentId: string) => void
  onValueChange: (value: string) => void
  open: boolean
  query: string
  selectedStudentId: string | null
  students: Student[]
  value: string
}

export function StudentPaymentDialog({
  busy, error, onClose, onConfirm, onQueryChange, onSelectStudent, onValueChange,
  open, query, selectedStudentId, students, value,
}: StudentPaymentDialogProps) {
  if (!open) return null
  const selected = students.find((student) => student.accountId === selectedStudentId) ?? null
  const filtered = students.filter((student) => matchesStudentSearch([student.name, student.id, student.course], query)).slice(0, 8)
  const amount = Number(value)

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
    <section aria-labelledby="student-payment-title" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog">
      <header className="flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-teal-600 px-5 py-4 text-white">
        <CircleDollarSign aria-hidden="true" className="size-6" />
        <div className="flex-1"><h2 className="text-xl font-black" id="student-payment-title">Registrar abono</h2><p className="text-sm font-semibold text-emerald-50">Selecciona estudiante, ingresa el valor y confirma.</p></div>
        <button aria-label="Cerrar" className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/15" disabled={busy} onClick={onClose} type="button"><X aria-hidden="true" className="size-6" /></button>
      </header>
      <div className="grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Buscar estudiante
          <span className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input autoFocus className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 font-semibold outline-none focus:border-emerald-600" onChange={(event) => onQueryChange(event.target.value)} placeholder="Nombre, código o curso" value={query} /></span>
        </label>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2" role="listbox">
          {filtered.map((student) => <button aria-selected={student.accountId === selectedStudentId} className={`flex min-h-12 w-full items-center justify-between rounded-lg px-3 py-2 text-left ${student.accountId === selectedStudentId ? 'bg-emerald-100 text-emerald-950' : 'hover:bg-slate-100'}`} key={student.accountId} onClick={() => onSelectStudent(student.accountId)} role="option" type="button"><span><strong className="block">{student.name}</strong><span className="text-xs font-semibold text-slate-500">{student.id} · {student.course}</span></span><span className="text-right text-xs font-bold"><span className="block text-emerald-700">Saldo {formatCurrency(student.balance)}</span><span className="text-rose-600">Deuda {formatCurrency(student.debt)}</span></span></button>)}
          {filtered.length === 0 && <p className="p-3 text-center text-sm font-semibold text-slate-500">No hay estudiantes que coincidan.</p>}
        </div>
        {selected && <p className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">Seleccionado: {selected.name}</p>}
        <label className="grid gap-2 text-sm font-bold text-slate-700">Valor en COP<input className="rounded-xl border border-slate-300 px-3 py-3 text-xl font-black outline-none focus:border-emerald-600" inputMode="numeric" min="1" onChange={(event) => onValueChange(event.target.value.replace(/\D/g, ''))} placeholder="$ 0" type="number" value={value} /></label>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700" role="alert">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3"><button className="min-h-12 rounded-lg border border-slate-300 px-5 py-2 font-bold text-slate-700" disabled={busy} onClick={onClose} type="button">Cancelar</button><button className="min-h-12 rounded-lg bg-emerald-700 px-5 py-2 font-black text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !selected || !Number.isSafeInteger(amount) || amount <= 0} onClick={onConfirm} type="button">{busy ? 'Registrando…' : 'Confirmar abono'}</button></footer>
    </section>
  </div>
}
