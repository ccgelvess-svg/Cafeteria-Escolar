import { useCallback, useEffect, useState } from 'react'

import { getLastSyncAt, readPendingSales, SYNC_STATUS_EVENT, syncPendingSales } from './outbox'

export function useSyncStatus() {
  const snapshot = useCallback(() => ({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pending: readPendingSales().length,
    lastSyncAt: getLastSyncAt(),
  }), [])
  const [status, setStatus] = useState(snapshot)

  useEffect(() => {
    const refresh = () => setStatus(snapshot())
    const synchronize = () => { refresh(); void syncPendingSales().finally(refresh) }
    window.addEventListener('online', synchronize)
    window.addEventListener('offline', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    synchronize()
    const retryTimer = window.setInterval(() => {
      if (navigator.onLine && readPendingSales().length > 0) synchronize()
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
