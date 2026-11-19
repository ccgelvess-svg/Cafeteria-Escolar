import { useCallback, useEffect, useState } from 'react'

import { getLastSyncAt, readPendingSales, SYNC_STATUS_EVENT, syncPendingSales } from './outbox'
import { pendingSaleValidationError } from './outboxState'
import {
  CONNECTIVITY_STATUS_EVENT,
  getConnectivityState,
  setManualOfflineEnabled,
} from './connectivity'

export function useSyncStatus() {
  const snapshot = useCallback(async () => {
    const pendingSales = await readPendingSales()
    return {
      ...getConnectivityState(),
      pending: pendingSales.length,
      legacyPending: pendingSales.filter((operation) => pendingSaleValidationError(operation)).length,
      lastSyncAt: getLastSyncAt(),
    }
  }, [])
  const [status, setStatus] = useState({
    ...getConnectivityState(),
    pending: 0,
    legacyPending: 0,
    lastSyncAt: getLastSyncAt(),
  })

  useEffect(() => {
    const refresh = async () => setStatus(await snapshot())
    const synchronize = () => {
      void refresh()
      if (getConnectivityState().online) void syncPendingSales().finally(() => void refresh())
    }
    window.addEventListener('online', synchronize)
    window.addEventListener('offline', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    window.addEventListener(CONNECTIVITY_STATUS_EVENT, synchronize)
    synchronize()
    const retryTimer = window.setInterval(() => {
      if (getConnectivityState().online) void readPendingSales().then((pending) => { if (pending.length > 0) synchronize() })
    }, 30_000)
    return () => {
      window.clearInterval(retryTimer)
      window.removeEventListener('online', synchronize)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(SYNC_STATUS_EVENT, refresh)
      window.removeEventListener(CONNECTIVITY_STATUS_EVENT, synchronize)
    }
  }, [snapshot])

  const setManualOffline = (enabled: boolean) => setManualOfflineEnabled(enabled)
  return { ...status, setManualOffline }
}
