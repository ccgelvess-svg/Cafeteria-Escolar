export type AdministrationSection =
  | 'dashboard'
  | 'students'
  | 'balances'
  | 'inventory'
  | 'users'
  | 'registers'
  | 'sales'
  | 'reports'
  | 'settings'

export type RecordStatus = 'active' | 'inactive'
export type UserRole = 'Administrador' | 'Cajero' | 'Inventarios'

export interface StudentRecord {
  id: string
  code: string
  firstName: string
  lastName: string
  grade: string
  group: string
  balance: number
  debt: number
  status: RecordStatus
}

export interface AccountMovement {
  id: string
  studentId: string
  date: string
  type: 'Consumo' | 'Recarga' | 'Abono' | 'Ajuste preparado'
  detail: string
  amount: number
}

export interface AdminUser {
  id: string
  name: string
  username: string
  role: UserRole
  register: string
  permissions: string[]
  status: RecordStatus
  lastAccess: string
}

export interface CashRegister {
  id: string
  name: string
  cashier: string
  status: 'Abierta' | 'Cerrada'
  openingCash: number
  expectedCash: number
  lastClose: string
  difference: number
}

export interface SaleRecord {
  id: string
  date: string
  time: string
  cashier: string
  register: string
  type: 'Venta libre' | 'Estudiante'
  customer: string
  total: number
  status: 'Completada' | 'Anulación preparada'
  items: Array<{ name: string; quantity: number; subtotal: number }>
}

export interface AdministrationService {
  listStudents(): Promise<StudentRecord[]>
  listMovements(): Promise<AccountMovement[]>
  listUsers(): Promise<AdminUser[]>
  listRegisters(): Promise<CashRegister[]>
  listSales(): Promise<SaleRecord[]>
}
