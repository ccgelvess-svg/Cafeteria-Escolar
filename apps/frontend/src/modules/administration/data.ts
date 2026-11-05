import type { AccountMovement, AdminUser, CashRegister, SaleRecord, StudentRecord } from './types'

export const demoStudents: StudentRecord[] = []

export const demoMovements: AccountMovement[] = []

export const demoUsers: AdminUser[] = [
  { id: 'USR-DEMO-01', name: 'Administrador Demo', username: 'admin.demo', role: 'Administrador', register: 'Todas', permissions: ['Administración', 'Reportes', 'Cajas'], status: 'active', lastAccess: 'Sesión de demostración' },
  { id: 'USR-DEMO-02', name: 'Cajero Demo', username: 'cajero.demo', role: 'Cajero', register: 'Caja Demo 01', permissions: ['Ventas', 'Abonos'], status: 'active', lastAccess: 'Sesión de demostración' },
  { id: 'USR-DEMO-03', name: 'Inventarios Demo', username: 'inventarios.demo', role: 'Inventarios', register: 'Sin caja', permissions: ['Inventario', 'Reportes'], status: 'active', lastAccess: 'Sesión de demostración' },
]

export const demoRegisters: CashRegister[] = [
  { id: 'CAJA-DEMO-01', name: 'Caja Demo 01', cashier: 'Cajero Demo', status: 'Abierta', openingCash: 50000, expectedCash: 100000, lastClose: 'Cierre ficticio', difference: 0 },
  { id: 'CAJA-DEMO-02', name: 'Caja Demo 02', cashier: 'Sin asignar', status: 'Cerrada', openingCash: 0, expectedCash: 0, lastClose: 'Cierre ficticio', difference: 0 },
]

export const demoSales: SaleRecord[] = [
  { id: 'VENTA-DEMO-001', date: '2026-10-11', time: '9:42 a. m.', cashier: 'Cajero Demo', register: 'Caja Demo 01', type: 'Estudiante', customer: 'Estudiante Uno', total: 4500, status: 'Completada', items: [{ name: 'Jugo en vaso', quantity: 1, subtotal: 2000 }, { name: 'Pastel de pollo', quantity: 1, subtotal: 2500 }] },
  { id: 'VENTA-DEMO-002', date: '2026-10-11', time: '9:38 a. m.', cashier: 'Cajero Demo', register: 'Caja Demo 01', type: 'Venta libre', customer: 'Venta libre', total: 7700, status: 'Completada', items: [{ name: 'Agua pequeña', quantity: 1, subtotal: 1200 }, { name: 'Pastel carne', quantity: 1, subtotal: 2500 }, { name: 'Papas medianas', quantity: 2, subtotal: 4000 }] },
  { id: 'VENTA-DEMO-003', date: '2026-10-11', time: '9:31 a. m.', cashier: 'Cajero Demo', register: 'Caja Demo 01', type: 'Estudiante', customer: 'Estudiante Dos', total: 3500, status: 'Completada', items: [{ name: 'Gatorade', quantity: 1, subtotal: 3500 }] },
]
