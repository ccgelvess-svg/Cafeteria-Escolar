import { useCallback, useEffect, useState } from 'react'

import { getLastSyncAt, readPendingSales, SYNC_STATUS_EVENT, syncPendingSales } from './outbox'
import { pendingSaleValidationError } from './outboxState'

export function useSyncStatus() {
  const snapshot = useCallback(async () => {
    const pendingSales = await readPendingSales()
    return {
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      pending: pendingSales.length,
      legacyPending: pendingSales.filter((operation) => pendingSaleValidationError(operation)).length,
      lastSyncAt: getLastSyncAt(),
    }
  }, [])
  const [status, setStatus] = useState({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pending: 0,
    legacyPending: 0,
    lastSyncAt: getLastSyncAt(),
  })

  useEffect(() => {
    const refresh = async () => setStatus(await snapshot())
    const synchronize = () => { void refresh(); void syncPendingSales().finally(() => void refresh()) }
    window.addEventListener('online', synchronize)
    window.addEventListener('offline', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    synchronize()
    const retryTimer = window.setInterval(() => {
      if (navigator.onLine) void readPendingSales().then((pending) => { if (pending.length > 0) synchronize() })
    }, 30_000)
    return () => {
      window.clearInterval(retryTimer)
      window.removeEventListener('online', synchronize)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(SYNC_STATUS_EVENT, refresh)
    }
  }, [snapshot])

  return status
}
