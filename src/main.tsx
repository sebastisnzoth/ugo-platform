import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ClientExperience from './ClientExperience'
import AdminGate from './admin/AdminGate'
import AdminExperience from './admin/AdminExperience'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const app = params.get('app')

if (app === 'admin' || app === 'superadmin') {
  document.title = app === 'superadmin' ? 'UGO · Super Admin' : 'UGO · Panel admin'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a1614')
}

const target =
  app === 'admin' || app === 'superadmin' ? (
    <AdminGate>{(session) => <AdminExperience session={session} />}</AdminGate>
  ) : app === 'client' ? (
    <ClientExperience />
  ) : (
    <App />
  )

createRoot(document.getElementById('root')!).render(<React.StrictMode>{target}</React.StrictMode>)
