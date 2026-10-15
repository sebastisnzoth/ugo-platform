import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabaseAdmin, UGO_TEST_REF, UGO_TEST_URL, isAdminRole, type AdminRole } from '../lib/supabaseAdmin'
import './admin-auth.css'

export type AdminSession = {
  session: Session
  role: AdminRole
  displayName: string
}

type GateState =
  | { phase: 'checking' }
  | { phase: 'locked'; error: string; notice: string }
  | { phase: 'recovery'; error: string; notice: string }
  | { phase: 'ready'; value: AdminSession }

const PROFILE_TIMEOUTS = [0, 400, 1200, 2600]

function sleep(ms: number) {
  return ms > 0 ? new Promise<void>((resolve) => window.setTimeout(resolve, ms)) : Promise.resolve()
}

function transient(message: string) {
  return /timeout|timed out|57014|fetch|network|abort|temporar|pgrst/i.test(message)
}

async function withTimeout<T>(operation: PromiseLike<T>, ms = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('ADMIN_PROFILE_TIMEOUT')), ms)),
  ])
}

function resolveIdentifier(value: string): string {
  const clean = value.trim()
  return clean.includes('@') ? clean.toLowerCase() : `${clean.toLowerCase()}@example.com`
}

function authMessage(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code || '')
  if (code === 'invalid_credentials' || code === 'email_not_confirmed') return 'Usuario o contraseña incorrectos. Revisá los datos e intentá otra vez.'
  if (code === 'over_request_rate_limit' || code === 'too_many_requests') return 'Demasiados intentos seguidos. Esperá un minuto y volvé a probar.'
  const message = error instanceof Error ? error.message : String(error || '')
  if (/fetch|network|failed/i.test(message)) return 'No pudimos contactar UGO TEST. Revisá tu conexión.'
  return message || 'No pudimos iniciar sesión de administrador.'
}

export default function AdminGate({ children }: { children: (value: AdminSession) => ReactNode }) {
  const [state, setState] = useState<GateState>({ phase: 'checking' })
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          const { error: exchangeError } = await supabaseAdmin.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            if (alive) setState({ phase: 'locked', error: `El enlace de recuperación no es válido o ya venció. ${exchangeError.message}`, notice: '' })
            return
          }
          params.delete('code')
          const query = params.toString()
          window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
          if (alive) setState({ phase: 'recovery', error: '', notice: 'Enlace validado. Definí tu nueva contraseña.' })
          return
        }
        const { data, error } = await supabaseAdmin.auth.getSession()
        if (error) throw error
        if (!data.session) {
          const wantsRecovery = params.get('recovery') === '1'
          if (alive) setState(wantsRecovery ? { phase: 'recovery', error: '', notice: '' } : { phase: 'locked', error: '', notice: '' })
          return
        }
        const result = await authorize(data.session)
        if (!alive) return
        setState(result.ok ? { phase: 'ready', value: result.value } : { phase: 'locked', error: result.message, notice: '' })
        if (!result.ok) await supabaseAdmin.auth.signOut()
      } catch (error) {
        if (alive) setState({ phase: 'locked', error: authMessage(error), notice: '' })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function loadProfile(userId: string) {
    let lastError: unknown = null
    for (const delay of PROFILE_TIMEOUTS) {
      await sleep(delay)
      const { data, error } = await withTimeout(
        supabaseAdmin.from('usuarios').select('tipo,activo,nombre,apellido').eq('id', userId).maybeSingle(),
      )
      if (!error) return { profile: data as { tipo: string | null; activo: boolean | null; nombre: string | null; apellido: string | null } | null, error: null }
      lastError = error
      const message = String((error as { message?: string } | null)?.message || '')
      if (!transient(message)) break
    }
    return { profile: null, error: lastError }
  }

  async function authorize(session: Session): Promise<{ ok: true; value: AdminSession } | { ok: false; message: string }> {
    const { profile, error } = await loadProfile(session.user.id)
    if (error && !profile) {
      const message = String((error as { message?: string } | null)?.message || '')
      return {
        ok: false,
        message: transient(message)
          ? 'Tu sesión sigue activa, pero UGO TEST está tardando en responder el perfil. Reintentá en unos segundos.'
          : message || 'No pudimos validar tu perfil de administrador.',
      }
    }
    if (!profile || !profile.activo || !isAdminRole(profile.tipo)) {
      return { ok: false, message: 'Esa cuenta no tiene rol de administrador activo en UGO TEST.' }
    }
    // ?app=superadmin exige explícitamente el rol superadmin, igual que la sección Super Admin del panel original.
    const requestedSuperAdmin = new URLSearchParams(window.location.search).get('app') === 'superadmin'
    if (requestedSuperAdmin && profile.tipo !== 'superadmin') {
      return { ok: false, message: 'Acceso denegado: esta superficie requiere una cuenta con rol Super Admin activo.' }
    }
    try {
      await supabaseAdmin.realtime.setAuth(session.access_token)
    } catch {
      /* realtime puede degradar sin bloquear el panel */
    }
    const displayName = `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || session.user.email || 'Admin UGO'
    return { ok: true, value: { session, role: profile.tipo as AdminRole, displayName } }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setState({ phase: 'locked', error: '', notice: '' })
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email: resolveIdentifier(identifier), password })
      if (error) throw error
      if (!data.session) throw new Error('Supabase no devolvió una sesión válida.')
      const result = await authorize(data.session)
      if (!result.ok) {
        await supabaseAdmin.auth.signOut()
        setState({ phase: 'locked', error: result.message, notice: '' })
        return
      }
      setState({ phase: 'ready', value: result.value })
    } catch (error) {
      setState({ phase: 'locked', error: authMessage(error), notice: '' })
    } finally {
      setBusy(false)
    }
  }

  async function sendRecovery() {
    const clean = identifier.trim()
    if (!clean.includes('@')) {
      setState({ phase: 'locked', error: 'Para recuperar la contraseña ingresá el email completo de tu cuenta admin.', notice: '' })
      return
    }
    setBusy(true)
    try {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}${window.location.pathname}?app=admin&recovery=1`,
      })
      if (error) throw error
      setState({ phase: 'locked', error: '', notice: 'Te enviamos el enlace de recuperación. Revisá el correo de la cuenta admin.' })
    } catch (error) {
      setState({ phase: 'locked', error: authMessage(error), notice: '' })
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setState({ phase: 'recovery', error: 'La nueva contraseña necesita al menos 8 caracteres.', notice: '' })
      return
    }
    setBusy(true)
    try {
      const { error } = await supabaseAdmin.auth.updateUser({ password: newPassword })
      if (error) throw error
      setState({ phase: 'recovery', error: '', notice: 'Contraseña actualizada. Ya podés ingresar con la nueva.' })
    } catch (error) {
      setState({ phase: 'recovery', error: authMessage(error), notice: '' })
    } finally {
      setBusy(false)
    }
  }

  if (state.phase === 'ready') return <>{children(state.value)}</>

  const showRecovery = state.phase === 'recovery' || new URLSearchParams(window.location.search).get('recovery') === '1'

  return (
    <div className="ad-gate">
      <section className="ad-gate-brand">
        <div className="ad-gate-brand-top">
          <span className="ad-gate-logo">
            ugo<span>.</span>
          </span>
          <span className="ad-env-badge">UGO TEST · {UGO_TEST_REF}</span>
        </div>
        <h1>
          Centro de control
          <br />
          <em>de operaciones UGO.</em>
        </h1>
        <p>
          Servicios, personas, bóveda y disputas del proyecto compartido UGO TEST, en una sola consola. Cada lectura y cada acción usa las tablas y RPC reales:
          nada de datos de demostración mezclados con producción.
        </p>
        <ul className="ad-gate-list">
          <li>
            <strong>Acceso restringido</strong>
            <span>El rol se valida en <code>usuarios</code> (<code>tipo</code> admin/superadmin y <code>activo</code>).</span>
          </li>
          <li>
            <strong>Operación en vivo</strong>
            <span>Realtime sobre servicios, pagos, proveedores, usuarios y deudas.</span>
          </li>
          <li>
            <strong>Acciones auditadas</strong>
            <span>Conciliación Pix, retiros, comisiones y disputas por RPC administrativas.</span>
          </li>
        </ul>
        <div className="ad-gate-foot">
          <span className="ad-pulse-dot" />
          {UGO_TEST_URL.replace('https://', '')}
        </div>
      </section>

      <section className="ad-gate-card">
        {state.phase === 'checking' ? (
          <div className="ad-gate-block" role="status">
            <span className="ad-spinner" />
            <h2>Validando sesión</h2>
            <p>Comprobando tu cuenta y tu rol administrativo en UGO TEST…</p>
          </div>
        ) : showRecovery ? (
          <form className="ad-gate-form" onSubmit={savePassword}>
            <span className="ad-gate-kicker">Restablecer acceso</span>
            <h2>Definí una contraseña nueva</h2>
            <p className="ad-gate-help">El enlace de recuperación se valida con Supabase Auth. La contraseña no se guarda en el panel.</p>
            <label>
              Nueva contraseña
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <button type="submit" className="ad-button ad-button-primary ad-button-block" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            {state.error ? <p className="ad-gate-error" role="alert">{state.error}</p> : null}
            {state.notice ? <p className="ad-gate-notice">{state.notice}</p> : null}
            <button
              type="button"
              className="ad-gate-link"
              onClick={async () => {
                await supabaseAdmin.auth.signOut()
                const url = new URL(window.location.href)
                url.searchParams.delete('recovery')
                window.history.replaceState({}, '', url.toString())
                setState({ phase: 'locked', error: '', notice: '' })
              }}
            >
              Volver al ingreso
            </button>
          </form>
        ) : (
          <form className="ad-gate-form" onSubmit={signIn}>
            <span className="ad-gate-kicker">Panel administrativo</span>
            <h2>Ingresá a tu consola</h2>
            <p className="ad-gate-help">Usá tu email de UGO (o el usuario corto) y la contraseña que ya tenés en UGO TEST.</p>
            <label>
              Usuario o email
              <input
                type="text"
                inputMode="email"
                autoComplete="username"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="vos@ugo.app"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
              />
            </label>
            <button type="submit" className="ad-button ad-button-primary ad-button-block" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar al panel'}
            </button>
            {state.error ? <p className="ad-gate-error" role="alert">{state.error}</p> : null}
            {state.notice ? <p className="ad-gate-notice">{state.notice}</p> : null}
            <button type="button" className="ad-gate-link" onClick={sendRecovery} disabled={busy}>
              Recuperar contraseña
            </button>
            <p className="ad-gate-note">El panel no crea usuarios ni credenciales. Si tu cuenta no aparece como admin activo, pedile a un super admin que la habilite.</p>
          </form>
        )}
      </section>
    </div>
  )
}
