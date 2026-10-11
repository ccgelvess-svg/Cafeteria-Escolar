import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Power } from 'lucide-react'

import { demoStudents } from '../data'
import { formatAdminCurrency, studentFullName } from '../format'
import type { StudentRecord } from '../types'
import { AdminDialog, DemoBanner, EmptyState, PageHeader, SearchField, StatusPill } from '../components/AdminUi'

const emptyStudent: StudentRecord = { id: '', code: '', firstName: '', lastName: '', grade: '5°', group: 'A', balance: 0, debt: 0, status: 'active' }

export function StudentsSection() {
  const [students, setStudents] = useState(demoStudents)
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('Todos')
  const [editor, setEditor] = useState<StudentRecord | null>(null)
  const [account, setAccount] = useState<StudentRecord | null>(null)
  const [confirmation, setConfirmation] = useState<StudentRecord | null>(null)
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase('es'); return students.filter((student) => `${studentFullName(student)} ${student.code} ${student.grade} ${student.group}`.toLocaleLowerCase('es').includes(needle) && (grade === 'Todos' || student.grade === grade)) }, [students, query, grade])

  function saveStudent() { if (!editor || !editor.firstName.trim() || !editor.lastName.trim() || !editor.code.trim()) return; setStudents((items) => editor.id ? items.map((item) => item.id === editor.id ? editor : item) : [...items, { ...editor, id: `demo-${Date.now()}` }]); setEditor(null) }
  function toggleStudent() { if (!confirmation) return; setStudents((items) => items.map((item) => item.id === confirmation.id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item)); setConfirmation(null) }

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Gestión académica" title="Estudiantes" description="Consulta y prepara registros de estudiantes y sus estados de cuenta." action={<button className="admin-primary-button" onClick={() => setEditor({ ...emptyStudent })} type="button"><Plus aria-hidden="true" className="size-5" />Registrar estudiante</button>} />
    <DemoBanner />
    <section className="admin-card">
      <div className="flex flex-col gap-3 md:flex-row"><SearchField onChange={setQuery} placeholder="Buscar por nombre, grado o código" value={query} /><div className="shrink-0 md:w-44"><select aria-label="Filtrar por grado" className="admin-select" onChange={(event) => setGrade(event.target.value)} value={grade}>{['Todos', '3°', '4°', '5°', '6°'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Estudiante</th><th>Código</th><th>Curso</th><th>Saldo</th><th>Deuda</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td><strong>{studentFullName(student)}</strong></td><td>{student.code}</td><td>{student.grade} {student.group}</td><td className="font-black text-emerald-700">{formatAdminCurrency(student.balance)}</td><td className="font-black text-rose-600">{formatAdminCurrency(student.debt)}</td><td><StatusPill active={student.status === 'active'} /></td><td><div className="flex justify-end gap-1"><button aria-label={`Ver cuenta de ${studentFullName(student)}`} className="admin-icon-button" onClick={() => setAccount(student)} type="button"><Eye aria-hidden="true" className="size-4" /></button><button aria-label={`Editar ${studentFullName(student)}`} className="admin-icon-button" onClick={() => setEditor({ ...student })} type="button"><Pencil aria-hidden="true" className="size-4" /></button><button aria-label={`Cambiar estado de ${studentFullName(student)}`} className="admin-icon-button" onClick={() => setConfirmation(student)} type="button"><Power aria-hidden="true" className="size-4" /></button></div></td></tr>)}</tbody></table></div>
      {filtered.length === 0 && <EmptyState>No hay estudiantes que coincidan con los filtros.</EmptyState>}
    </section>
    <AdminDialog open={Boolean(editor)} title={editor?.id ? 'Editar estudiante' : 'Registrar estudiante'} description="Formulario temporal de demostración." onClose={() => setEditor(null)} footer={<><button className="admin-secondary-button" onClick={() => setEditor(null)} type="button">Cancelar</button><button className="admin-primary-button" onClick={saveStudent} type="button">Guardar en memoria</button></>}>
      {editor && <div className="grid gap-4 sm:grid-cols-2"><label className="admin-field">Nombre<input className="admin-input" onChange={(e) => setEditor({ ...editor, firstName: e.target.value })} value={editor.firstName} /></label><label className="admin-field">Apellido<input className="admin-input" onChange={(e) => setEditor({ ...editor, lastName: e.target.value })} value={editor.lastName} /></label><label className="admin-field">Código único<input className="admin-input" onChange={(e) => setEditor({ ...editor, code: e.target.value })} value={editor.code} /></label><label className="admin-field">Grado<select className="admin-select" onChange={(e) => setEditor({ ...editor, grade: e.target.value })} value={editor.grade}>{['3°', '4°', '5°', '6°'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="admin-field">Grupo<select className="admin-select" onChange={(e) => setEditor({ ...editor, group: e.target.value })} value={editor.group}>{['A', 'B', 'C'].map((item) => <option key={item}>{item}</option>)}</select></label></div>}
    </AdminDialog>
    <AdminDialog open={Boolean(account)} title="Estado de cuenta" description={account ? `${studentFullName(account)} · ${account.code}` : ''} onClose={() => setAccount(null)} footer={<button className="admin-primary-button" onClick={() => setAccount(null)} type="button">Cerrar</button>}>{account && <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">Saldo disponible</p><p className="mt-1 text-2xl font-black text-emerald-900">{formatAdminCurrency(account.balance)}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm font-bold text-rose-700">Deuda acumulada</p><p className="mt-1 text-2xl font-black text-rose-900">{formatAdminCurrency(account.debt)}</p></div></div>}</AdminDialog>
    <AdminDialog open={Boolean(confirmation)} title={confirmation?.status === 'active' ? 'Desactivar estudiante' : 'Activar estudiante'} description="Esta acción solo cambiará el estado temporal de la demostración." onClose={() => setConfirmation(null)} size="sm" footer={<><button className="admin-secondary-button" onClick={() => setConfirmation(null)} type="button">Cancelar</button><button className="admin-danger-button" onClick={toggleStudent} type="button">Confirmar cambio</button></>}><p className="font-semibold text-slate-600">¿Deseas cambiar el estado de <strong className="text-slate-950">{confirmation ? studentFullName(confirmation) : ''}</strong>?</p></AdminDialog>
  </div>
}
