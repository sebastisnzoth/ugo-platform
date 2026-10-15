import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabaseAdmin, UGO_TEST_REF, type AdminSectionId } from '../lib/supabaseAdmin'
import { emptyMetrics, loadMetrics, type MetricsSnapshot } from './lib/data'
import { useAdminRealtime } from './lib/hooks'
import type { AdminSession } from './AdminGate'
import type { ShellApi } from './lib/shell'
import { ToastStack, type Toast, type ToastTone } from './ui/kit'
import {
  IconBolt,
  IconChevron,
  IconClose,
  IconCommand,
  IconExternal,
  IconGavel,
  IconGear,
  IconGrid,
  IconLogout,
  IconMenu,
  IconRefresh,
  IconScroll,
  IconSearch,
  IconShield,
  IconUsers,
  IconWallet,
  IconWrench,
} from './ui/icons'
import OverviewSection from './sections/OverviewSection'
import ServicesSection from './sections/ServicesSection'
import PeopleSection from './sections/PeopleSection'
import ProvidersSection from './sections/ProvidersSection'
import FinanceSection from './sections/FinanceSection'
import DisputesSection from './sections/DisputesSection'
import AuditSection from './sections/AuditSection'
import SystemSection from './sections/SystemSection'
import './admin.css'

type SectionConfig = {
  id: AdminSectionId
  label: string
  group: 'Operación' | 'Personas' | 'Dinero' | 'Sistema'
  hint: string
  icon: React.ReactNode
}

const SECTIONS: SectionConfig[] = [
  { id: 'overview', label: 'Visión general', group: 'Operación', hint: 'Pulso, indicadores y cola de atención', icon: <IconGrid size={17} /> },
  { id: 'services', label: 'Servicios', group: 'Operación', hint: 'Pedidos, estados y expedientes', icon: <IconWrench size={17} /> },
  { id: 'people', label: 'Personas', group: 'Personas', hint: 'Cuentas, roles y accesos', icon: <IconUsers size={17} /> },
  { id: 'providers', label: 'Profesionales', group: 'Personas', hint: 'Legajos, verificación y documentos', icon: <IconShield size={17} /> },
  { id: 'finance', label: 'Finanzas', group: 'Dinero', hint: 'Pix, bóveda, comisiones y retiros', icon: <IconWallet size={17} /> },
  { id: 'disputes', label: 'Disputas', group: 'Dinero', hint: 'Casos, conversación y resolución', icon: <IconGavel size={17} /> },
  { id: 'audit', label: 'Auditoría', group: 'Sistema', hint: 'Trazabilidad de acciones', icon: <IconScroll size={17} /> },
  { id: 'system', label: 'Sistema', group: 'Sistema', hint: 'Entorno, contratos y configuración', icon: <IconGear size={17} /> },
]

const GROUPS: SectionConfig['group'][] = ['Operación', 'Personas', 'Dinero', 'Sistema']

const REALTIME_TABLES = ['servicios', 'servicio_estado_eventos', 'pagos', 'perfiles_proveedor', 'usuarios', 'deudas_ugo_proveedor', 'disputas']

export default function AdminExperience({ session }: { session: AdminSession }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const requested = params.get('section')
  const [section, setSection] = useState<AdminSectionId>(
    (SECTIONS.some((item) => item.id === requested) ? (requested as AdminSectionId) : 'overview'),
  )
  const [filters, setFilters] = useState<Record<string, string | null>>(() => {
    const view = params.get('view')
    return view ? { [requested || 'overview']: view } : {}
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [metrics, setMetrics] = useState<MetricsSnapshot>(emptyMetrics)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const toastId = useRef(0)

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = (toastId.current += 1)
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6500)
  }, [])

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1)
    setLastRefresh(new Date())
  }, [])

  const navigate = useCallback((next: AdminSectionId, filter?: string) => {
    setSection(next)
    setMenuOpen(false)
    setPaletteOpen(false)
    if (filter !== undefined) setFilters((current) => ({ ...current, [next]: filter }))
    const url = new URL(window.location.href)
    url.searchParams.set('app', 'admin')
    url.searchParams.set('section', next)
    window.history.replaceState({}, '', url.toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const reloadMetrics = useCallback(async () => {
    setMetricsError(null)
    try {
      const snapshot = await loadMetrics()
      setMetrics(snapshot)
      const failed = Object.values(snapshot).filter((metric) => metric.value === null)
      if (failed.length > 0) {
        setMetricsError(`No pudimos leer ${failed.length} indicador(es) con tu rol actual. Los valores faltantes se muestran como “—”, nunca como cero.`)
      }
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : 'No pudimos actualizar los indicadores.')
    } finally {
      setMetricsLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    void reloadMetrics()
  }, [reloadMetrics, refreshToken])

  const realtime = useAdminRealtime(REALTIME_TABLES, () => {
    setRefreshToken((value) => value + 1)
    setLastRefresh(new Date())
  })

  useEffect(() => {
    if (realtime.status === 'live') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRefreshToken((value) => value + 1)
        setLastRefresh(new Date())
      }
    }, 25000)
    return () => window.clearInterval(timer)
  }, [realtime.status])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
        setPaletteQuery('')
        return
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setMenuOpen(false)
      }
      if (event.key === '/' && !paletteOpen) {
        const target = event.target as HTMLElement | null
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        const input = document.querySelector<HTMLInputElement>('.ad-section input[type="search"]')
        if (input) {
          event.preventDefault()
          input.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const badges: Partial<Record<AdminSectionId, number>> = {
    finance: (metrics.pixPending.value || 0) + (metrics.debtsReported.value || 0),
    disputes: metrics.disputesOpen.value || 0,
    providers: metrics.verificationsPending.value || 0,
    services: metrics.stalledServices.value || 0,
  }

  const shell: ShellApi = {
    role: session.role,
    displayName: session.displayName,
    session: { user: { id: session.session.user.id, email: session.session.user.email } },
    refreshToken,
    lastRefresh,
    refresh,
    navigate,
    notify,
    metrics,
    metricsLoading,
    metricsError,
  }

  const current = SECTIONS.find((item) => item.id === section) || SECTIONS[0]
  const filter = filters[section] ?? null

  const paletteItems = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase()
    const base = SECTIONS.map((item) => ({
      id: `go-${item.id}`,
      label: item.label,
      hint: item.hint,
      run: () => navigate(item.id),
    }))
    base.push(
      { id: 'action-refresh', label: 'Actualizar datos ahora', hint: 'Recarga indicadores y la sección activa', run: () => refresh() },
      {
        id: 'action-client',
        label: 'Abrir app cliente',
        hint: 'Abre la experiencia de cliente UGO en otra pestaña',
        run: () => window.open(`${window.location.pathname}?app=client`, '_blank', 'noopener'),
      },
      {
        id: 'action-logout',
        label: 'Cerrar sesión admin',
        hint: 'Termina la sesión de este panel',
        run: () => void supabaseAdmin.auth.signOut(),
      },
    )
    if (!query) return base
    return base.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query))
  }, [paletteQuery, navigate, refresh])

  const liveLabel = realtime.status === 'live' ? 'Tiempo real' : realtime.status === 'connecting' ? 'Conectando' : 'Sincronización degradada'

  return (
    <div className="ad-shell">
      {menuOpen ? <button type="button" className="ad-rail-backdrop" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /> : null}

      <aside className={menuOpen ? 'ad-rail is-open' : 'ad-rail'}>
        <div className="ad-rail-brand">
          <span className="ad-rail-logo">
            ugo<span>.</span>
          </span>
          <button type="button" className="ad-icon-button ad-rail-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <IconClose size={18} />
          </button>
          <small>Centro de control admin</small>
        </div>

        <button type="button" className="ad-rail-search" onClick={() => { setPaletteOpen(true); setPaletteQuery('') }}>
          <IconSearch size={15} />
          <span>Buscar o saltar</span>
          <kbd>
            <IconCommand size={12} />K
          </kbd>
        </button>

        <nav className="ad-rail-nav" aria-label="Secciones del panel">
          {GROUPS.map((group) => (
            <div key={group} className="ad-rail-group">
              <span className="ad-rail-caption">{group}</span>
              {SECTIONS.filter((item) => item.group === group).map((item) => {
                const badge = badges[item.id]
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={section === item.id ? 'is-active' : undefined}
                    onClick={() => navigate(item.id)}
                    aria-current={section === item.id ? 'page' : undefined}
                  >
                    <span className="ad-rail-icon">{item.icon}</span>
                    <span className="ad-rail-label">{item.label}</span>
                    {badge && badge > 0 ? <em className="ad-rail-badge">{badge}</em> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="ad-rail-foot">
          <div className="ad-env-card">
            <span className="ad-env-dot" />
            <div>
              <strong>UGO TEST</strong>
              <small>{UGO_TEST_REF}</small>
            </div>
          </div>
          <div className="ad-rail-user">
            <span className="ad-rail-avatar">{session.displayName.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{session.displayName}</strong>
              <small>{session.role === 'superadmin' ? 'Super admin' : 'Admin'}</small>
            </div>
            <button type="button" className="ad-icon-button" onClick={() => void supabaseAdmin.auth.signOut()} aria-label="Cerrar sesión">
              <IconLogout size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="ad-main">
        <header className="ad-topbar">
          <button type="button" className="ad-icon-button ad-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <IconMenu size={20} />
          </button>
          <div className="ad-topbar-copy">
            <h1>{current.label}</h1>
            <p>{current.hint}</p>
          </div>
          <div className="ad-topbar-actions">
            <span className={`ad-live ad-live-${realtime.status}`}>
              <span className="ad-live-dot" />
              {liveLabel}
              {realtime.lastEventAt ? <em>{realtime.lastEventAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</em> : null}
            </span>
            <a className="ad-button ad-button-ghost" href={`${window.location.pathname}?app=client`} target="_blank" rel="noreferrer">
              App cliente <IconExternal size={14} />
            </a>
            <button type="button" className="ad-button ad-button-dark" onClick={refresh}>
              <IconRefresh size={15} /> Actualizar
            </button>
          </div>
        </header>

        <main className="ad-content">
          {section === 'overview' ? <OverviewSection shell={shell} filter={filter} /> : null}
          {section === 'services' ? <ServicesSection shell={shell} filter={filter} /> : null}
          {section === 'people' ? <PeopleSection shell={shell} filter={filter} /> : null}
          {section === 'providers' ? <ProvidersSection shell={shell} filter={filter} /> : null}
          {section === 'finance' ? <FinanceSection shell={shell} filter={filter} /> : null}
          {section === 'disputes' ? <DisputesSection shell={shell} filter={filter} /> : null}
          {section === 'audit' ? <AuditSection shell={shell} filter={filter} /> : null}
          {section === 'system' ? <SystemSection shell={shell} filter={filter} /> : null}
        </main>

        <footer className="ad-foot">
          <span>UGO · panel admin conectado a UGO TEST</span>
          <span>
            Lecturas y acciones reales. Sin datos de demostración mezclados con producción.
            <IconBolt size={13} />
          </span>
        </footer>
      </div>

      {paletteOpen ? (
        <div className="ad-palette-layer" role="dialog" aria-modal="true" aria-label="Buscador de acciones">
          <button type="button" className="ad-drawer-backdrop" aria-label="Cerrar buscador" onClick={() => setPaletteOpen(false)} />
          <div className="ad-palette">
            <label>
              <IconSearch size={16} />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Ir a una sección o ejecutar una acción…"
                aria-label="Buscar acciones"
              />
              <kbd>Esc</kbd>
            </label>
            <ul>
              {paletteItems.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={item.run}>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                    <IconChevron size={15} />
                  </button>
                </li>
              ))}
              {paletteItems.length === 0 ? <li className="ad-palette-empty">Sin resultados para “{paletteQuery}”.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  )
}
