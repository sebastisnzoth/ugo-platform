import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const ClientExperience = lazy(() => import('./ClientExperience'))
const ProviderExperience = lazy(() => import('./ProviderExperience'))
const AdminExperience = lazy(() => import('./AdminExperience'))

const params = new URLSearchParams(window.location.search)
const app = params.get('app')

function Route() {
  if (app === 'client') return <ClientExperience />
  if (app === 'provider') return <ProviderExperience />
  if (app === 'admin' || app === 'superadmin') return <AdminExperience />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: 40, font: '14px Arial', color: '#70807b' }}>Cargando UGO…</div>}>
      <Route />
    </Suspense>
  </React.StrictMode>
)
