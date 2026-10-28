import { useState } from 'react'

import { useAuth } from './AuthProvider'

export function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await login(email, password) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.') }
    finally { setBusy(false) }
  }

  return <form className="mt-5 grid gap-3 text-left" onSubmit={submit}>
    <label className="admin-field">Correo institucional<input autoCapitalize="none" autoComplete="username" className="admin-input" onChange={(event) => setEmail(event.target.value)} required spellCheck={false} type="email" value={email} /></label>
    <label className="admin-field">Contraseña<input autoComplete="current-password" className="admin-input" onChange={(event) => setPassword(event.target.value)} required spellCheck={false} type={showPassword ? 'text' : 'password'} value={password} /></label>
    <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600"><input checked={showPassword} className="size-4" onChange={(event) => setShowPassword(event.target.checked)} type="checkbox" />Mostrar contraseña</label>
    {error && <p className="text-sm font-bold text-rose-700" role="alert">{error}</p>}
    <button className="admin-primary-button justify-center" disabled={busy} type="submit">{busy ? 'Verificando…' : 'Ingresar'}</button>
  </form>
}
