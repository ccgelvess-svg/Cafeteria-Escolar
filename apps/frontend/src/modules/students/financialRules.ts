export function assertPositiveInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('El valor debe ser un número entero mayor que cero.')
  }
}

export function movementAmount(type: 'consumption' | 'top-up' | 'debt-payment', value: number) {
  assertPositiveInteger(value)
  return type === 'consumption' ? -value : value
}

export function applyMovement(netBalance: number, amount: number) {
  if (!Number.isSafeInteger(netBalance) || !Number.isSafeInteger(amount)) {
    throw new Error('Los saldos deben expresarse en unidades monetarias enteras.')
  }
  const result = netBalance + amount
  if (!Number.isSafeInteger(result)) throw new Error('El saldo excede el rango permitido.')
  return result
}

export function splitBalance(netBalance: number) {
  return { balance: Math.max(0, netBalance), debt: Math.max(0, -netBalance) }
}

export function isMovementReversible(
  movement: { id: string; type: string },
  movements: Array<{ reversesMovementId?: string }>,
) {
  return movement.type !== 'reversal' && !movements.some((item) => item.reversesMovementId === movement.id)
}
