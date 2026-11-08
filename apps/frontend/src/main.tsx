import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { cleanupObsoleteLocalCaches } from './infrastructure/storage/localStorageMaintenance'
import { AuthProvider } from './modules/auth'
import './styles/index.css'

cleanupObsoleteLocalCaches()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el elemento raíz de la aplicación.')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider><App /></AuthProvider>
  </StrictMode>,
)
