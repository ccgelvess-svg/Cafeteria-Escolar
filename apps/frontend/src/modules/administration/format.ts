export function formatAdminCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function studentFullName(student: { firstName: string; lastName: string }) {
  return `${student.firstName} ${student.lastName}`
}
