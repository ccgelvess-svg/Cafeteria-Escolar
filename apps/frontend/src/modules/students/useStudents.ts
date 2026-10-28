import { useCallback, useEffect, useState } from 'react'

import { listStudents, STUDENTS_CHANGED_EVENT } from './studentRepository'
import type { Student } from './types'

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setStudents(await listStudents()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar los estudiantes.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener(STUDENTS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(STUDENTS_CHANGED_EVENT, refresh)
  }, [refresh])
  return { students, loading, error, refresh }
}
