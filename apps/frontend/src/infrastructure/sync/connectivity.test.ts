import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getConnectivityState,
  isManualOfflineEnabled,
  MANUAL_OFFLINE_STORAGE_KEY,
  setManualOfflineEnabled,
} from './connectivity.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

test('el modo offline manual persiste por dispositivo y prevalece aunque exista red', () => {
  const storage = memoryStorage()
  setManualOfflineEnabled(true, storage)
  assert.equal(storage.getItem(MANUAL_OFFLINE_STORAGE_KEY), 'true')
  assert.equal(isManualOfflineEnabled(storage), true)
  assert.deepEqual(getConnectivityState(storage, true), {
    manualOffline: true,
    networkOnline: true,
    online: false,
    offlineReason: 'manual',
  })
})

test('al desactivar el modo manual se distingue una desconexión real', () => {
  const storage = memoryStorage()
  setManualOfflineEnabled(true, storage)
  setManualOfflineEnabled(false, storage)
  assert.deepEqual(getConnectivityState(storage, false), {
    manualOffline: false,
    networkOnline: false,
    online: false,
    offlineReason: 'network',
  })
  assert.equal(getConnectivityState(storage, true).online, true)
})
