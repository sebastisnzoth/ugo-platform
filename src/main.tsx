import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ClientExperience from './ClientExperience'
import AppErrorBoundary from './AppErrorBoundary'
import BootDiagnostics from './BootDiagnostics'
import AdminGate from './admin/AdminGate'
import AdminExperience from './admin/AdminExperience'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const path = window.location.pathname.replace(/\/+$/, '')
const hash = window.location.hash.replace('#', '')
const queryApp = params.get('app')

// El panel admin se puede abrir de tres formas para que nunca dependa de una URL exacta.
const wantsAdmin =
  queryApp === 'admin' ||
  queryApp === 'superadmin' ||
  hash === 'admin' ||
  hash === 'superadmin' ||
  /\/admin$/i.test(path)

const wantsSuperAdmin = queryApp === 'superadmin' || hash === 'superadmin' || /\/superadmin$/i.test(path)
const wantsClient = queryApp === 'client'
const wantsDiagnostics = params.get('diag') === '1' || hash === 'diag'

const surface = wantsDiagnostics ? 'diagnostico' : wantsAdmin ? (wantsSuperAdmin ? 'superadmin' : 'admin') : wantsClient ? 'cliente' : 'web'

if (wantsAdmin) {
  document.title = wantsSuperAdmin ? 'UGO · Super Admin' : 'UGO · Panel admin'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a1614')
}

const target = wantsDiagnostics ? (
  <BootDiagnostics />
) : wantsAdmin ? (
  <AdminGate>{(session) => <AdminExperience session={session} />}</AdminGate>
) : wantsClient ? (
  <ClientExperience />
) : (
  <App />
)

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <AppErrorBoundary surface={surface}>{target}</AppErrorBoundary>
  </React.StrictMode>,
)

// Red de seguridad: si el módulo no llega a montar nada (script bloqueado, red, error previo),
// se muestra una pantalla explicativa en vez de un vacío blanco.
window.setTimeout(() => {
  const container = document.getElementById('root')
  if (!container || container.querySelector('.ugo-boot-shell, .ad-gate, .ad-shell, .app-shell, .uxugo')) return
  container.innerHTML = `
    <div class="ugo-boot-diagnostic">
      <div class="ugo-boot-card">
        <span class="ugo-boot-kicker">UGO · arranque</span>
        <h1>La interfaz no terminó de cargar</h1>
        <p>El código del panel no llegó a dibujarse. Suele pasar por red lenta, por un bloqueador que corta
        <code>tmossnqfwfwjrtzwcbmm.supabase.co</code> o por caché vieja del navegador.</p>
        <div class="ugo-boot-actions">
          <button type="button" class="ugo-boot-button ugo-boot-primary" onclick="window.location.reload()">Recargar</button>
          <a class="ugo-boot-button" href="/ugo-platform/?app=admin">Reintentar el panel</a>
          <a class="ugo-boot-button" href="/ugo-platform/">Ir a la web UGO</a>
        </div>
        <p class="ugo-boot-hint">Consejo: usá Ctrl+Shift+R (recarga forzada) y desactivá bloqueadores para este dominio.</p>
      </div>
    </div>`
}, 9000)
