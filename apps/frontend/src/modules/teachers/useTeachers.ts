import { useCallback, useEffect, useState } from 'react'

import { SYNC_STATUS_EVENT } from '../../infrastructure/sync/outbox'
import { listTeachers, TEACHERS_CHANGED_EVENT } from './teacherRepository'
import type { Teacher } from './types'

export function useTeachers(cashRegisterId: string) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setTeachers(await listTeachers(cashRegisterId)); setError('') }
    catch (cause) { setTeachers([]); setError(cause instanceof Error ? cause.message : 'No fue posible cargar los profesores.') }
    finally { setLoading(false) }
  }, [cashRegisterId])

  useEffect(() => {
    void refresh()
    window.addEventListener(TEACHERS_CHANGED_EVENT, refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    return () => {
      window.removeEventListener(TEACHERS_CHANGED_EVENT, refresh)
      window.removeEventListener(SYNC_STATUS_EVENT, refresh)
    }
  }, [refresh])

  return { teachers, loading, error, refresh }
}
