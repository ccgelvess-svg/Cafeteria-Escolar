export function normalizeStudentCode(code: string) {
  return code.trim().toLocaleUpperCase('es')
}

export function normalizeStudentSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es')
}

export function matchesStudentSearch(values: Array<string | undefined>, query: string) {
  const needle = normalizeStudentSearch(query)
  return normalizeStudentSearch(values.filter(Boolean).join(' ')).includes(needle)
}

export function validateStudentFields(fields: {
  code: string
  firstName: string
  lastName: string
  grade: string
  group: string
}) {
  if (![fields.code, fields.firstName, fields.lastName, fields.grade, fields.group].every((value) => value.trim().length > 0)) {
    throw new Error('Completa todos los datos obligatorios.')
  }
}
