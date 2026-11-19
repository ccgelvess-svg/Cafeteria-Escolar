export const CONNECTIVITY_STATUS_EVENT = 'cafeteria:connectivity-status-changed'
export const MANUAL_OFFLINE_STORAGE_KEY = 'cafeteria:manual-offline:v1'

interface StorageReader {
  getItem(key: string): string | null
}

interface StorageWriter extends StorageReader {
  setItem(key: string, value: string): void
}

function browserStorage(): StorageWriter | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function isManualOfflineEnabled(storage: StorageReader | null = browserStorage()) {
  return storage?.getItem(MANUAL_OFFLINE_STORAGE_KEY) === 'true'
}

export function getConnectivityState(
  storage: StorageReader | null = browserStorage(),
  networkOnline = typeof navigator === 'undefined' ? true : navigator.onLine,
) {
  const manualOffline = isManualOfflineEnabled(storage)
  return {
    manualOffline,
    networkOnline,
    online: networkOnline && !manualOffline,
    offlineReason: manualOffline ? 'manual' as const : networkOnline ? null : 'network' as const,
  }
}

export function isOnlineForDataAccess() {
  return getConnectivityState().online
}

export function setManualOfflineEnabled(enabled: boolean, storage: StorageWriter | null = browserStorage()) {
  storage?.setItem(MANUAL_OFFLINE_STORAGE_KEY, String(enabled))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONNECTIVITY_STATUS_EVENT))
}
