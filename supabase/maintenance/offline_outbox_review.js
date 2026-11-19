// Ejecutar en la consola del navegador de cada POS antes del reinicio.
(() => {
  const OUTBOX_KEY = 'cafeteria:sync-outbox:v1'
  const APPLY_APPROVED_ASSIGNMENTS = false
  // Registrar aquí, de forma explícita y después de verificar el comprobante físico,
  // operation.id -> cash_register_id. Nunca inferir la caja por el usuario conectado.
  const APPROVED_ASSIGNMENTS = {
    // 'operation-id': '30000000-0000-4000-8000-000000000001',
  }
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

  const legacy = pending.filter((operation) => !operation.cashRegisterId)
  if (APPLY_APPROVED_ASSIGNMENTS) {
    const unresolved = legacy.filter((operation) => !APPROVED_ASSIGNMENTS[operation.id])
    if (unresolved.length > 0) {
      throw new Error(`Faltan asignaciones explícitas para ${unresolved.length} venta(s) antigua(s)`)
    }
    const backupKey = `${OUTBOX_KEY}:assignment-backup:${new Date().toISOString()}`
    localStorage.setItem(backupKey, raw)
    const reviewed = pending.map((operation) => operation.cashRegisterId ? operation : {
      ...operation,
      cashRegisterId: APPROVED_ASSIGNMENTS[operation.id],
      lastError: undefined,
    })
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(reviewed))
    return { pending: pending.length, assigned: legacy.length, backupKey }
  }

  if (!CLEAR_APPROVED) return { pending: pending.length, legacy: legacy.length, cleared: false }

  const backupKey = `${OUTBOX_KEY}:reset-backup:${new Date().toISOString()}`
  localStorage.setItem(backupKey, raw)
  localStorage.setItem(OUTBOX_KEY, '[]')
  return { pending: pending.length, cleared: true, backupKey }
})()
