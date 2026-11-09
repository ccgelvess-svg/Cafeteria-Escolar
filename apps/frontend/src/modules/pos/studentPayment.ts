export function studentPaymentSignature(studentId: string, type: 'top-up' | 'debt-payment', value: number) {
  return `student-payment:${studentId}:${type}:${value}`
}

export function parseStudentPaymentValue(value: string) {
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
}
