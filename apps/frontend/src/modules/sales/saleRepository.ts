import { requireSupabase } from '../../infrastructure/supabase/client'
import { getDeviceId, STUDENTS_CHANGED_EVENT } from '../students'
import { INVENTORY_CHANGED_EVENT } from '../inventory'
import { enqueuePendingSale, isConnectivityError } from '../../infrastructure/sync/outbox'

export interface SaleItemDraft {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

export interface RegisteredSale {
  id: string
  occurredAt: string
  totalAmount: number
  paymentMethod: 'student-account' | 'cash'
  status: 'completed' | 'voided'
  voidReason?: string
  studentName?: string
  registerName?: string
  actorUserId: string
  items: Array<{ productName: string; unitPrice: number; quantity: number; lineTotal: number }>
}

export interface CashRegisterSummary {
  id: string
  name: string
  active: boolean
  completedSales: number
  voidedSales: number
  cashTotal: number
}

export const SALES_CHANGED_EVENT = 'cafeteria:sales-changed'

export interface SaleRegistrationResult {
  data: unknown
  queued: boolean
}

export async function registerStudentSale(input: {
  studentId: string
  totalAmount: number
  items: SaleItemDraft[]
  idempotencyKey: string
}) {
  const saleId = crypto.randomUUID()
  const operation = {
    id: crypto.randomUUID(), kind: 'student-sale' as const, saleId,
    studentId: input.studentId, totalAmount: input.totalAmount, items: input.items,
    deviceId: getDeviceId(), idempotencyKey: input.idempotencyKey,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueuePendingSale(operation)
    window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
    return { data: null, queued: true } satisfies SaleRegistrationResult
  }
  const { data, error } = await requireSupabase().rpc('record_student_sale', {
    p_sale_id: saleId,
    p_student_id: input.studentId,
    p_total_amount: input.totalAmount,
    p_items: input.items,
    p_device_id: getDeviceId(),
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) {
    const cause = new Error(error.message || 'No fue posible registrar la venta.')
    if (!isConnectivityError(cause)) throw cause
    enqueuePendingSale({ ...operation, lastError: cause.message })
    window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
    return { data: null, queued: true } satisfies SaleRegistrationResult
  }
  window.dispatchEvent(new Event(STUDENTS_CHANGED_EVENT))
  window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
  window.dispatchEvent(new Event(SALES_CHANGED_EVENT))
  return { data, queued: false } satisfies SaleRegistrationResult
}

export async function registerCashSale(input: {
  totalAmount: number
  items: SaleItemDraft[]
  idempotencyKey: string
}) {
  const saleId = crypto.randomUUID()
  const operation = {
    id: crypto.randomUUID(), kind: 'cash-sale' as const, saleId,
    totalAmount: input.totalAmount, items: input.items, idempotencyKey: input.idempotencyKey,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueuePendingSale(operation)
    window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
    return { data: null, queued: true } satisfies SaleRegistrationResult
  }
  const { data, error } = await requireSupabase().rpc('record_cash_sale', {
    p_sale_id: saleId,
    p_total_amount: input.totalAmount,
    p_items: input.items,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) {
    const cause = new Error(error.message || 'No fue posible registrar la venta en efectivo.')
    if (!isConnectivityError(cause)) throw cause
    enqueuePendingSale({ ...operation, lastError: cause.message })
    window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
    return { data: null, queued: true } satisfies SaleRegistrationResult
  }
  window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
  window.dispatchEvent(new Event(SALES_CHANGED_EVENT))
  return { data, queued: false } satisfies SaleRegistrationResult
}

export async function voidSale(saleId: string, reason: string) {
  const { data, error } = await requireSupabase().rpc('void_sale', {
    p_sale_id: saleId,
    p_reason: reason.trim(),
    p_device_id: getDeviceId(),
  })
  if (error) throw new Error(error.message || 'No fue posible anular la venta.')
  window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT))
  window.dispatchEvent(new Event(STUDENTS_CHANGED_EVENT))
  window.dispatchEvent(new Event(SALES_CHANGED_EVENT))
  return data
}

export async function listRegisteredSales() {
  const { data, error } = await requireSupabase().from('sales').select(`
    id,occurred_at,total_amount,payment_method,status,void_reason,actor_user_id,
    sale_items(product_name,unit_price,quantity,line_total),
    students(first_name,last_name),cash_registers(name)
  `).order('occurred_at', { ascending: false }).limit(200)
  if (error) throw new Error('No fue posible consultar las ventas autorizadas.')
  return (data as unknown as Array<{
    id: string; occurred_at: string; total_amount: number; payment_method: RegisteredSale['paymentMethod'];
    status: RegisteredSale['status']; void_reason: string | null; actor_user_id: string;
    sale_items: Array<{ product_name: string; unit_price: number; quantity: number; line_total: number }>;
    students: { first_name: string; last_name: string } | Array<{ first_name: string; last_name: string }> | null;
    cash_registers: { name: string } | Array<{ name: string }> | null;
  }>).map((row): RegisteredSale => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    const register = Array.isArray(row.cash_registers) ? row.cash_registers[0] : row.cash_registers
    return {
      id: row.id, occurredAt: row.occurred_at, totalAmount: row.total_amount,
      paymentMethod: row.payment_method, status: row.status, voidReason: row.void_reason ?? undefined,
      studentName: student ? `${student.first_name} ${student.last_name}` : undefined,
      registerName: register?.name, actorUserId: row.actor_user_id,
      items: row.sale_items.map((item) => ({ productName: item.product_name, unitPrice: item.unit_price, quantity: item.quantity, lineTotal: item.line_total })),
    }
  })
}

export async function listCashRegisterSummaries() {
  const { data, error } = await requireSupabase().from('cash_registers')
    .select('id,name,active,sales(id,total_amount,payment_method,status)')
    .order('name')
  if (error) throw new Error('No fue posible consultar las cajas autorizadas.')
  return (data as unknown as Array<{
    id: string; name: string; active: boolean
    sales: Array<{ id: string; total_amount: number; payment_method: RegisteredSale['paymentMethod']; status: RegisteredSale['status'] }>
  }>).map((row): CashRegisterSummary => ({
    id: row.id,
    name: row.name,
    active: row.active,
    completedSales: row.sales.filter((sale) => sale.status === 'completed').length,
    voidedSales: row.sales.filter((sale) => sale.status === 'voided').length,
    cashTotal: row.sales.filter((sale) => sale.status === 'completed' && sale.payment_method === 'cash').reduce((sum, sale) => sum + sale.total_amount, 0),
  }))
}
