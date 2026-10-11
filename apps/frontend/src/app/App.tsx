import { useEffect, useState } from 'react'

import { AdministrationPage } from '../modules/administration'
import { PosPage } from '../modules/pos'

function getRoute() {
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'pos'
}

export function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const handleRouteChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', handleRouteChange)
    return () => window.removeEventListener('hashchange', handleRouteChange)
  }, [])

  return route === 'admin' ? <AdministrationPage /> : <PosPage />
}
