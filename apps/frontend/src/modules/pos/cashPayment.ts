export interface CashPaymentAttempt {
  signature: string
  idempotencyKey: string
}

export function cashSaleSignature(cashRegisterId: string, lines: Array<{ productId: string; quantity: number }>) {
  return `cash:${cashRegisterId}:${lines.map((line) => `${line.productId}:${line.quantity}`).sort().join('|')}`
}

export function studentSaleSignature(cashRegisterId: string, studentId: string, lines: Array<{ productId: string; quantity: number }>) {
  return `student:${cashRegisterId}:${studentId}:${lines.map((line) => `${line.productId}:${line.quantity}`).sort().join('|')}`
}

export function prepareCashPaymentAttempt(
  current: CashPaymentAttempt | null,
  signature: string,
  createKey: () => string,
): CashPaymentAttempt {
  return current?.signature === signature ? current : { signature, idempotencyKey: createKey() }
}
