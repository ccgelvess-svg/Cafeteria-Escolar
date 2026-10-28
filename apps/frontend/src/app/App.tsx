import { useEffect, useState } from 'react'

import { AdministrationPage } from '../modules/administration'
import { AuthGate, type ProtectedRoute } from '../modules/auth'
import { InventoryAccessPage } from '../modules/inventory'
import { PosPage } from '../modules/pos'

function getRoute(): ProtectedRoute {
  if (window.location.hash.startsWith('#/admin')) return 'admin'
  if (window.location.hash.startsWith('#/inventory')) return 'inventory'
  return 'pos'
}

export function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const handleRouteChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', handleRouteChange)
    return () => window.removeEventListener('hashchange', handleRouteChange)
  }, [])

  const pages: Record<ProtectedRoute, React.ReactNode> = {
    admin: <AdministrationPage />,
    inventory: <InventoryAccessPage />,
    pos: <PosPage />,
  }

  return <AuthGate route={route}>{pages[route]}</AuthGate>
}
