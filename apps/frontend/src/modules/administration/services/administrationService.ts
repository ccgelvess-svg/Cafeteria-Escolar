import { demoMovements, demoRegisters, demoSales, demoStudents, demoUsers } from '../data'
import type { AdministrationService } from '../types'

// Adaptador temporal en memoria. Se reemplazará por el cliente del backend sin cambiar las vistas.
export const demoAdministrationService: AdministrationService = {
  async listStudents() { return structuredClone(demoStudents) },
  async listMovements() { return structuredClone(demoMovements) },
  async listUsers() { return structuredClone(demoUsers) },
  async listRegisters() { return structuredClone(demoRegisters) },
  async listSales() { return structuredClone(demoSales) },
}
