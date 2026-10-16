import { useEffect, useState } from 'react'
import { supabaseAdmin, UGO_TEST_KEY, UGO_TEST_REF, UGO_TEST_URL, isAdminRole } from './lib/supabaseAdmin'

type Check = {
  id: string
  label: string
  state: 'running' | 'ok' | 'warn' | 'fail'
  detail: string
}

const initial: Check[] = [
  { id: 'js', label: 'JavaScript de la app cargado', state: 'ok', detail: 'El módulo principal se ejecutó en este navegador.' },
  { id: 'url', label: 'URL interpretada', state: 'ok', detail: '' },
  { id: 'storage', label: 'Almacenamiento del navegador', state: 'running', detail: 'Comprobando localStorage…' },
  { id: 'module', label: 'Módulo del panel admin', state: 'running', detail: 'Cargando el código del panel…' },
  { id: 'network', label: 'Conectividad con UGO TEST', state: 'running', detail: `Consultando ${UGO_TEST_REF}…` },
  { id: 'session', label: 'Sesión admin en este navegador', state: 'running', detail: 'Buscando sesión guardada…' },
  { id: 'role', label: 'Rol administrativo en usuarios', state: 'running', detail: 'Pendiente de sesión…' },
]

export default function BootDiagnostics() {
  const [checks, setChecks] = useState<Check[]>(() => {
    const params = new URLSearchParams(window.location.search)
    return initial.map((check) =>
      check.id === 'url'
        ? {
            ...check,
            detail: `path=${window.location.pathname} · search="${window.location.search}" · hash="${window.location.hash}" · app=${params.get('app') ?? '—'}`,
          }
        : check,
    )
  })

  const update = (id: string, patch: Partial<Check>) =>
    setChecks((current) => current.map((check) => (check.id === id ? { ...check, ...patch } : check)))

  useEffect(() => {
    let alive = true
    void (async () => {
      // 1. Almacenamiento
      let storage = 'disponible'
      let storageState: Check['state'] = 'ok'
      try {
        window.localStorage.setItem('ugo-diag', '1')
        window.localStorage.removeItem('ugo-diag')
      } catch (error) {
        storageState = 'fail'
        storage = `bloqueado por el navegador (${error instanceof Error ? error.message : 'acceso denegado'}). Sin almacenamiento no se puede guardar la sesión admin: probá abrir el panel en una pestaña propia, no embebido.`
      }
      const adminKey = (() => {
        try {
          return window.localStorage.getItem('ugo-platform-admin-auth')
        } catch {
          return null
        }
      })()
      const webKey = (() => {
        try {
          return window.localStorage.getItem('ugo-platform-auth')
        } catch {
          return null
        }
      })()
      if (alive && storageState === 'ok') {
        update('storage', {
          state: 'ok',
          detail: `disponible · sesión panel: ${adminKey ? 'sí' : 'no'} · sesión web: ${webKey ? 'sí' : 'no'}`,
        })
      } else if (alive) {
        update('storage', { state: storageState, detail: storage })
      }

      // 2. Módulo del panel (import dinámico real del bundle)
      try {
        const mod = await import('./admin/AdminExperience')
        if (alive) {
          update('module', {
            state: typeof mod.default === 'function' ? 'ok' : 'warn',
            detail: typeof mod.default === 'function' ? 'AdminExperience cargó correctamente.' : 'El módulo cargó pero no exporta el componente esperado.',
          })
        }
      } catch (error) {
        if (alive) update('module', { state: 'fail', detail: `No se pudo cargar: ${error instanceof Error ? error.message : String(error)}` })
      }

      // 3. Conectividad con Supabase (auth health + REST)
      try {
        const [health, rest] = await Promise.all([
          fetch(`${UGO_TEST_URL}/auth/v1/health`, { headers: { apikey: UGO_TEST_KEY } }).then((response) => response.status).catch(() => 0),
          fetch(`${UGO_TEST_URL}/rest/v1/`, { headers: { apikey: UGO_TEST_KEY, Authorization: `Bearer ${UGO_TEST_KEY}` } })
            .then((response) => response.status)
            .catch(() => 0),
        ])
        if (alive) {
          const ok = health >= 200 && health < 400 && rest >= 200 && rest < 400
          update('network', {
            state: ok ? 'ok' : 'fail',
            detail: ok
              ? `auth/v1/health=${health} · rest/v1=${rest} · proyecto ${UGO_TEST_REF}`
              : `auth/v1/health=${health} · rest/v1=${rest}. El navegador no puede alcanzar ${UGO_TEST_URL}. Revisá conexión, VPN o bloqueadores de anuncios/rastreadores para este dominio.`,
          })
        }
      } catch (error) {
        if (alive) update('network', { state: 'fail', detail: error instanceof Error ? error.message : 'Fallo de red desconocido' })
      }

      // 4. Sesión y rol
      try {
        const { data } = await supabaseAdmin.auth.getSession()
        if (!alive) return
        update('session', {
          state: data.session ? 'ok' : 'warn',
          detail: data.session ? `sesión activa de ${data.session.user.email || data.session.user.id}` : 'Sin sesión guardada: el panel mostrará la pantalla de acceso.',
        })
        if (!data.session) {
          update('role', { state: 'warn', detail: 'Necesitás iniciar sesión para validar el rol.' })
          return
        }
        const { data: profile, error } = await supabaseAdmin.from('usuarios').select('tipo,activo').eq('id', data.session.user.id).maybeSingle()
        if (!alive) return
        if (error) {
          update('role', { state: 'fail', detail: `No se pudo leer usuarios: ${error.message}` })
          return
        }
        const tipo = String((profile as { tipo?: string } | null)?.tipo || '')
        const activo = Boolean((profile as { activo?: boolean } | null)?.activo)
        update('role', {
          state: activo && isAdminRole(tipo) ? 'ok' : 'fail',
          detail: profile
            ? `tipo=${tipo || '—'} · activo=${activo ? 'sí' : 'no'}. ${activo && isAdminRole(tipo) ? 'Acceso administrativo habilitado.' : 'Esta cuenta no puede entrar al panel: un super admin debe dejar tipo=admin/superadmin y activo=true en usuarios.'}`
            : 'La cuenta no tiene fila en usuarios: no puede validarse como administrador.',
        })
      } catch (error) {
        if (alive) {
          const message = error instanceof Error ? error.message : String(error)
          update('session', { state: 'fail', detail: message })
          update('role', { state: 'warn', detail: 'No se pudo validar el rol por un error de sesión.' })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const report = checks.map((check) => `${check.state === 'ok' ? 'OK  ' : check.state === 'warn' ? 'AVISO' : check.state === 'fail' ? 'FALLA' : '…  '} ${check.label}: ${check.detail}`).join('\n')
  const adminLink = `${window.location.pathname.replace(/\/$/, '')}?app=admin`

  return (
    <div className="ugo-boot-diagnostic">
      <div className="ugo-boot-card">
        <span className="ugo-boot-kicker">UGO · autodiagnóstico</span>
        <h1>Chequeo del panel admin</h1>
        <p>
          Esta página se ejecuta en <strong>tu navegador</strong> y prueba módulo, almacenamiento, red con UGO TEST y permisos de tu cuenta. No cambia ningún dato.
        </p>
        <ul className="ugo-diag-list">
          {checks.map((check) => (
            <li key={check.id} className={`ugo-diag-${check.state}`}>
              <span className="ugo-diag-mark">{check.state === 'ok' ? '✓' : check.state === 'warn' ? '!' : check.state === 'fail' ? '×' : '…'}</span>
              <div>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </div>
            </li>
          ))}
        </ul>
        <div className="ugo-boot-actions">
          <a className="ugo-boot-button ugo-boot-primary" href={adminLink}>
            Ir al panel admin
          </a>
          <button
            type="button"
            className="ugo-boot-button"
            onClick={() => {
              void navigator.clipboard?.writeText(report)
            }}
          >
            Copiar informe
          </button>
        </div>
        <details className="ugo-boot-details">
          <summary>Ver informe completo</summary>
          <pre>{report}</pre>
        </details>
      </div>
    </div>
  )
}
