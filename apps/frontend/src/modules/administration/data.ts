import type { AccountMovement, AdminUser, CashRegister, SaleRecord, StudentRecord } from './types'

export const demoStudents: StudentRecord[] = [
  { id: '1', code: 'EST-1042', firstName: 'Valentina', lastName: 'Rodríguez', grade: '5°', group: 'A', balance: 18500, debt: 0, status: 'active' },
  { id: '2', code: 'EST-0871', firstName: 'Samuel', lastName: 'Martínez', grade: '4°', group: 'B', balance: 4200, debt: 3500, status: 'active' },
  { id: '3', code: 'EST-1156', firstName: 'Mariana', lastName: 'Gómez', grade: '6°', group: 'A', balance: 12000, debt: 0, status: 'active' },
  { id: '4', code: 'EST-0934', firstName: 'Daniel', lastName: 'Herrera', grade: '5°', group: 'C', balance: 0, debt: 6800, status: 'active' },
  { id: '5', code: 'EST-0715', firstName: 'Luciana', lastName: 'Castro', grade: '3°', group: 'A', balance: 7600, debt: 0, status: 'inactive' },
  { id: '6', code: 'EST-1208', firstName: 'Mateo', lastName: 'Vargas', grade: '6°', group: 'B', balance: 2300, debt: 1200, status: 'active' },
]

export const demoMovements: AccountMovement[] = [
  { id: 'M-1001', studentId: '1', date: '2026-10-11', type: 'Consumo', detail: 'Jugo en vaso · Pastel de pollo', amount: -4500 },
  { id: 'M-1002', studentId: '1', date: '2026-10-10', type: 'Recarga', detail: 'Recarga en caja 01', amount: 20000 },
  { id: 'M-1003', studentId: '2', date: '2026-10-11', type: 'Abono', detail: 'Abono de demostración', amount: 3500 },
  { id: 'M-1004', studentId: '4', date: '2026-10-09', type: 'Consumo', detail: 'Hamburguesa · Gaseosa pequeña', amount: -8500 },
  { id: 'M-1005', studentId: '3', date: '2026-10-08', type: 'Consumo', detail: 'Agua pequeña · Papas medianas', amount: -3200 },
]

export const demoUsers: AdminUser[] = [
  { id: 'U-01', name: 'Laura Méndez', username: 'laura.admin', role: 'Administrador', register: 'Todas', permissions: ['Administración', 'Reportes', 'Cajas'], status: 'active', lastAccess: 'Hoy, 8:05 a. m.' },
  { id: 'U-02', name: 'Carlos Ruiz', username: 'carlos.caja', role: 'Cajero', register: 'Caja 01', permissions: ['Ventas', 'Abonos'], status: 'active', lastAccess: 'Hoy, 7:42 a. m.' },
  { id: 'U-03', name: 'Andrea León', username: 'andrea.inv', role: 'Inventarios', register: 'Sin caja', permissions: ['Inventario', 'Reportes'], status: 'active', lastAccess: 'Ayer, 3:16 p. m.' },
  { id: 'U-04', name: 'Miguel Rojas', username: 'miguel.caja', role: 'Cajero', register: 'Caja 02', permissions: ['Ventas'], status: 'inactive', lastAccess: '7 oct, 12:10 p. m.' },
]

export const demoRegisters: CashRegister[] = [
  { id: 'C-01', name: 'Caja 01', cashier: 'Carlos Ruiz', status: 'Abierta', openingCash: 50000, expectedCash: 328400, lastClose: '10 oct, 4:15 p. m.', difference: 0 },
  { id: 'C-02', name: 'Caja 02', cashier: 'Sin asignar', status: 'Cerrada', openingCash: 0, expectedCash: 0, lastClose: '10 oct, 4:20 p. m.', difference: -1200 },
  { id: 'C-03', name: 'Caja eventos', cashier: 'Sin asignar', status: 'Cerrada', openingCash: 0, expectedCash: 0, lastClose: '4 oct, 1:00 p. m.', difference: 0 },
]

export const demoSales: SaleRecord[] = [
  { id: 'V-2841', date: '2026-10-11', time: '9:42 a. m.', cashier: 'Carlos Ruiz', register: 'Caja 01', type: 'Estudiante', customer: 'Valentina Rodríguez', total: 4500, status: 'Completada', items: [{ name: 'Jugo en vaso', quantity: 1, subtotal: 2000 }, { name: 'Pastel de pollo', quantity: 1, subtotal: 2500 }] },
  { id: 'V-2840', date: '2026-10-11', time: '9:38 a. m.', cashier: 'Carlos Ruiz', register: 'Caja 01', type: 'Venta libre', customer: 'Venta libre', total: 7700, status: 'Completada', items: [{ name: 'Agua pequeña', quantity: 1, subtotal: 1200 }, { name: 'Pastel carne', quantity: 1, subtotal: 2500 }, { name: 'Papas medianas', quantity: 2, subtotal: 4000 }] },
  { id: 'V-2839', date: '2026-10-11', time: '9:31 a. m.', cashier: 'Carlos Ruiz', register: 'Caja 01', type: 'Estudiante', customer: 'Samuel Martínez', total: 3500, status: 'Completada', items: [{ name: 'Gatorade', quantity: 1, subtotal: 3500 }] },
  { id: 'V-2838', date: '2026-10-11', time: '9:18 a. m.', cashier: 'Carlos Ruiz', register: 'Caja 01', type: 'Venta libre', customer: 'Venta libre', total: 6500, status: 'Completada', items: [{ name: 'Hamburguesa', quantity: 1, subtotal: 6500 }] },
  { id: 'V-2837', date: '2026-10-11', time: '9:05 a. m.', cashier: 'Carlos Ruiz', register: 'Caja 01', type: 'Estudiante', customer: 'Mariana Gómez', total: 3200, status: 'Completada', items: [{ name: 'Agua pequeña', quantity: 1, subtotal: 1200 }, { name: 'Papas medianas', quantity: 1, subtotal: 2000 }] },
]

export const salesByHour = [
  { label: '7 a. m.', value: 38 }, { label: '8 a. m.', value: 72 }, { label: '9 a. m.', value: 94 },
  { label: '10 a. m.', value: 66 }, { label: '11 a. m.', value: 82 }, { label: '12 m.', value: 58 },
]

export const weeklySales = [
  { label: 'Lun', value: 68 }, { label: 'Mar', value: 78 }, { label: 'Mié', value: 62 },
  { label: 'Jue', value: 91 }, { label: 'Vie', value: 74 },
]
