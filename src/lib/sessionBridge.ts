// Puente de sesión entre las superficies UGO.
//
// La web/cliente guardan su sesión en `ugo-platform-auth`; el panel admin en
// `ugo-platform-admin-auth`. Si alguien ya inició sesión en la web con una cuenta
// administrativa, el panel reutiliza esos tokens en vez de pedir login otra vez.

export type BridgedSession = { access_token: string; refresh_token: string }

const SOURCE_KEYS = ['ugo-platform-auth', 'ugo-test-client-auth', 'ugo-test-provider-auth']

export function readBridgedSession(): BridgedSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  for (const key of SOURCE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Record<string, unknown> | null
      const candidate = (parsed && (parsed.currentSession as Record<string, unknown> | undefined)) || parsed
      const access = candidate?.access_token
      const refresh = candidate?.refresh_token
      if (typeof access === 'string' && access.length > 0 && typeof refresh === 'string' && refresh.length > 0) {
        return { access_token: access, refresh_token: refresh }
      }
    } catch {
      // claves corruptas: se ignoran y se sigue buscando
    }
  }
  return null
}

export function adminPath(section = 'overview', role: 'admin' | 'superadmin' = 'admin'): string {
  const base = typeof window === 'undefined' ? '/ugo-platform/' : window.location.pathname
  return `${base}?app=${role}&section=${section}`
}
