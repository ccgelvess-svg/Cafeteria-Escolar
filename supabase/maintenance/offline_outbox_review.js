// Ejecutar en la consola del navegador de cada POS antes del reinicio.
(() => {
  const OUTBOX_KEY = 'cafeteria:sync-outbox:v1'
  const CLEAR_APPROVED = false
  const raw = localStorage.getItem(OUTBOX_KEY) ?? '[]'
  const pending = JSON.parse(raw)

  console.table(pending.map((operation) => ({
    id: operation.id,
    kind: operation.kind,
    saleId: operation.saleId,
    cashRegisterId: operation.cashRegisterId ?? 'legacy/unassigned',
    createdAt: operation.createdAt,
    attempts: operation.attempts,
  })))

  if (!CLEAR_APPROVED) return { pending: pending.length, cleared: false }

  const backupKey = `${OUTBOX_KEY}:reset-backup:${new Date().toISOString()}`
  localStorage.setItem(backupKey, raw)
  localStorage.setItem(OUTBOX_KEY, '[]')
  return { pending: pending.length, cleared: true, backupKey }
})()
