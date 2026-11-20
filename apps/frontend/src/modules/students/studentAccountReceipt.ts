import type { StudentMovement } from './types'
import { splitBalance } from './financialRules.ts'

export interface AccountReceiptSale {
  id: string
  occurredAt: string
  totalAmount: number
  status: 'completed' | 'voided'
  idempotencyKey: string
  items: Array<{ productName: string; unitPrice: number; quantity: number; lineTotal: number }>
}

type AccountReceiptMovement = Pick<StudentMovement, 'id' | 'occurredAt' | 'type' | 'amount' | 'detail' | 'idempotencyKey'>

export type AccountReceiptEntry =
  | { kind: 'sale'; id: string; occurredAt: string; balanceAfter?: number; sale: AccountReceiptSale }
  | { kind: 'movement'; id: string; occurredAt: string; balanceAfter: number; movement: AccountReceiptMovement }

export function scopeStudentAccountReceiptMovements(
  movements: StudentMovement[],
  studentId: string,
  cashRegisterId: string,
) {
  return movements.filter((movement) => movement.studentId === studentId && movement.cashRegisterId === cashRegisterId)
}

export function summarizeStudentAccountReceipt(netBalance: number, movements: Array<Pick<StudentMovement, 'type' | 'amount'>>) {
  const split = splitBalance(netBalance)
  return {
    purchases: movements.reduce((total, movement) => movement.type === 'consumption' && movement.amount < 0
      ? total + Math.abs(movement.amount) : total, 0),
    payments: movements.reduce((total, movement) => (movement.type === 'top-up' || movement.type === 'debt-payment') && movement.amount > 0
      ? total + movement.amount : total, 0),
    balance: split.balance,
    debt: split.debt,
  }
}

export function buildAccountReceiptEntries(
  netBalance: number,
  movements: AccountReceiptMovement[],
  sales: AccountReceiptSale[],
): AccountReceiptEntry[] {
  let runningBalance = netBalance
  const balances = new Map<string, number>()
  const orderedMovements = [...movements].sort((left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.id.localeCompare(left.id))

  for (const movement of orderedMovements) {
    balances.set(movement.id, runningBalance)
    runningBalance -= movement.amount
  }

  const saleMovements = new Map(
    orderedMovements
      .filter((movement) => movement.type === 'consumption')
      .map((movement) => [movement.idempotencyKey, movement]),
  )
  const matchedMovementIds = new Set<string>()
  const entries: AccountReceiptEntry[] = sales.map((sale) => {
    const movement = saleMovements.get(`sale:${sale.idempotencyKey}`)
    if (movement) matchedMovementIds.add(movement.id)
    return {
      kind: 'sale', id: `sale:${sale.id}`, occurredAt: sale.occurredAt,
      balanceAfter: movement ? balances.get(movement.id) : undefined, sale,
    }
  })

  for (const movement of orderedMovements) {
    if (movement.type === 'consumption' && matchedMovementIds.has(movement.id)) continue
    entries.push({
      kind: 'movement', id: `movement:${movement.id}`, occurredAt: movement.occurredAt,
      balanceAfter: balances.get(movement.id) ?? netBalance, movement,
    })
  }

  return entries.sort((left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.id.localeCompare(left.id))
}
