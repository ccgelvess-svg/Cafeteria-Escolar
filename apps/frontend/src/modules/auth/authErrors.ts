export function normalizeAuthEmail(email: string) {
  return email.normalize('NFKC').trim().toLowerCase()
}

export function signInErrorMessage(code?: string) {
  switch (code) {
    case 'invalid_credentials':
      return 'Supabase rechazó las credenciales (invalid_credentials). Verifica el correo y escribe manualmente la contraseña nueva.'
    case 'email_not_confirmed':
      return 'El correo todavía no está confirmado en Supabase (email_not_confirmed).'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Hay demasiados intentos. Espera unos minutos antes de volver a ingresar.'
    case 'user_banned':
      return 'La cuenta está bloqueada temporalmente en Supabase (user_banned).'
    default:
      return `Supabase rechazó el inicio de sesión (código: ${code || 'auth_error'}).`
  }
}
