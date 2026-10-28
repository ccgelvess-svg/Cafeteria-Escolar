import { Boxes, LogOut } from 'lucide-react'

import { useAuth } from '../auth'
import { InventorySection } from './InventorySection'

export function InventoryAccessPage() {
  const { session, logout } = useAuth()
  return <main className="min-h-dvh bg-slate-100"><header className="sticky top-0 z-30 flex items-center gap-3 bg-blue-800 p-4 text-white shadow-lg"><Boxes aria-hidden="true" className="size-8" /><div className="min-w-0 flex-1"><h1 className="text-xl font-black">Cafetería Escolar</h1><p className="truncate text-sm text-blue-100">{session?.user.displayName} · Inventarios</p></div><button aria-label="Cerrar sesión" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/15 px-3 font-bold hover:bg-white/25" onClick={() => void logout()} type="button"><LogOut aria-hidden="true" className="size-5" /><span className="hidden sm:inline">Salir</span></button></header><div className="p-3 sm:p-5 lg:p-6"><InventorySection /></div></main>
}
