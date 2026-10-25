import { Banknote, GraduationCap, Search, UserRound, WalletCards } from 'lucide-react'

import { formatCurrency } from '../format'
import type { SaleMode, Student } from '../types'
import { matchesStudentSearch } from '../../students'

interface CustomerPanelProps {
  mode: SaleMode
  query: string
  selectedStudent: Student | null
  students: Student[]
  onModeChange: (mode: SaleMode) => void
  onQueryChange: (query: string) => void
  onSelectStudent: (student: Student) => void
}

export function CustomerPanel({
  mode,
  query,
  selectedStudent,
  students,
  onModeChange,
  onQueryChange,
  onSelectStudent,
}: CustomerPanelProps) {
  const matches = students.filter((student) =>
    matchesStudentSearch([student.name, student.id, student.course], query),
  )

  if (mode === 'free') {
    return (
      <section className="rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 p-1.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white ring-2 ring-white">
              <Banknote aria-hidden="true" className="size-6" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold leading-tight text-slate-950 sm:text-lg">Cliente: venta libre</h2>
              <p className="truncate text-xs font-semibold text-slate-600 sm:text-sm">Pago en efectivo · Sin cuenta de estudiante</p>
            </div>
          </div>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-blue-500 bg-white px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            onClick={() => onModeChange('student')}
            type="button"
          >
            <Search aria-hidden="true" className="size-5" />
            Buscar estudiante
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-700 text-white ring-2 ring-white">
            {selectedStudent ? <UserRound aria-hidden="true" className="size-6" /> : <GraduationCap aria-hidden="true" className="size-6" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold leading-tight text-slate-950 sm:text-lg">
              {selectedStudent?.name ?? 'Selecciona un estudiante'}
            </h2>
            <p className="truncate text-xs font-semibold text-slate-600 sm:text-sm">
              {selectedStudent ? `${selectedStudent.course} · ${selectedStudent.id}` : 'Busca por nombre, curso o código'}
            </p>
            {selectedStudent && (
              <div className="flex flex-wrap gap-x-3 text-xs font-bold sm:text-sm">
                <span className="text-emerald-700">Saldo: {formatCurrency(selectedStudent.balance)}</span>
                <span className={selectedStudent.debt > 0 ? 'text-rose-600' : 'text-slate-500'}>
                  Deuda: {formatCurrency(selectedStudent.debt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative w-56 min-w-0 shrink-0 xl:w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
          <input
            aria-label="Buscar estudiante"
            className="h-11 w-full rounded-lg border-2 border-blue-300 bg-white pl-10 pr-3 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar estudiante..."
            type="search"
            value={query}
          />
          {query && (
            <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
              {matches.length > 0 ? (
                matches.map((student) => (
                  <button
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-blue-50"
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    type="button"
                  >
                    <span>
                      <span className="block font-bold text-slate-900">{student.name}</span>
                      <span className="block text-xs text-slate-500">{student.course} · {student.id}</span>
                    </span>
                    <WalletCards aria-hidden="true" className="size-5 text-blue-600" />
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-sm text-slate-500">No hay coincidencias.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
