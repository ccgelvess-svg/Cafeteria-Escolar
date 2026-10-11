export function formatCurrency(value: number) {
  return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)}`
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
