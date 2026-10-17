import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { formatDateTime, money } from './providerData'
import { orderTone } from './useClientOrders'
import {
  adminLiberarEscrow,
  adminResolverDisputa,
  adminSetFeatureFlag,
  adminSuspenderProveedor,
  adminUpdateConfig,
  superadminEvaluarAutonomia,
  useAdminAccess,
  useAdminSnapshot,
} from './adminData'
import './client-zip-design.css'
import './admin-app.css'

type View = 'dashboard' | 'services' | 'users' | 'disputes' | 'documents' | 'vault' | 'audit' | 'system'

const params = new URLSearchParams(window.location.search)
const superMode = params.get('app') === 'superadmin'

const baseNavigation: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' }, { id: 'services', label: 'Servicios', icon: '◈' },
  { id: 'users', label: 'Usuarios', icon: '◉' }, { id: 'disputes', label: 'Disputas', icon: '⚑' },
  { id: 'documents', label: 'Documentos', icon: '▤' }, { id: 'vault', label: 'Bóveda', icon: '▣' },
  { id: 'audit', label: 'Auditoría', icon: '≡' },
]
const systemItem = { id: 'system' as View, label: 'Sistema', icon: '⚙' }

const titles: Record<View, string> = {
  dashboard: 'Centro de control', services: 'Servicios', users: 'Usuarios', disputes: 'Disputas',
  documents: 'Documentos / KYC', vault: 'Bóveda y pagos', audit: 'Auditoría', system: 'Sistema (Super Admin)',
}

export default function AdminExperience() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<{ type: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // Gate de login propio del panel
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')

  const access = useAdminAccess(session)
  const isSuper = access.role === 'superadmin'
  const gateOpen = Boolean(access.role) && (!superMode || isSuper)
  const snapshot = useAdminSnapshot(session, gateOpen, isSuper)

  const [serviceFilter, setServiceFilter] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolucion, setResolucion] = useState('')
  const [favorDe, setFavorDe] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setSessionReady(true) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const navigation = useMemo(() => isSuper ? [...baseNavigation, systemItem] : baseNavigation, [isSuper])

  function go(next: View) { setView(next); setMenuOpen(false); setNotice(null); setResolvingId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function run(action: () => Promise<void>, ok: string) {
    if (busy) return
    setBusy(true); setNotice(null)
    try {
      await action()
      snapshot.reload()
      setNotice({ type: 'ok', text: ok })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'La operación fue rechazada por el servidor.' })
    } finally {
      setBusy(false)
    }
  }

  function adminLogin(event: FormEvent) {
    event.preventDefault()
    setLoginBusy(true); setLoginError('')
    const email = identifier.includes('@') ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase()}@example.com`
    supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
      setLoginBusy(false)
      if (error) {
        setLoginError(error.code === 'invalid_credentials' || error.code === 'email_not_confirmed'
          ? 'Usuario/email o contraseña incorrectos. Verificá los datos e intentá nuevamente.'
          : error.message)
      }
    })
  }

  function suspenderProveedor(userId: string) {
    const motivo = window.prompt('Motivo de la suspensión (queda auditado):')
    if (motivo == null) return
    void run(() => adminSuspenderProveedor(userId, motivo), 'Proveedor suspendido y auditado.')
  }
  function liberarEscrow(escrowId: string) {
    const notas = window.prompt('Notas de la liberación (opcional, quedan auditadas):') ?? ''
    void run(() => adminLiberarEscrow(escrowId, notas), 'Escrow liberado.')
  }
  function resolverDisputa(disputaId: string) {
    if (resolucion.trim().length < 5) { setNotice({ type: 'error', text: 'Escribí una resolución (mínimo 5 caracteres).' }); return }
    void run(() => adminResolverDisputa(disputaId, resolucion, favorDe), 'Disputa resuelta y auditada.')
      .then(() => { setResolvingId(null); setResolucion(''); setFavorDe('') })
  }
  function editarConfig(clave: string, actual: unknown) {
    const valor = window.prompt(`Nuevo valor para "${clave}" (JSON o texto):`, JSON.stringify(actual ?? ''))
    if (valor == null) return
    void run(() => adminUpdateConfig(clave, valor), `Configuración "${clave}" actualizada.`)
  }

  const metrics = snapshot.dashboard
    ? [
      { label: 'Servicios activos', value: String(snapshot.dashboard.servicios_activos ?? 0) },
      { label: 'Bóveda total', value: money(snapshot.dashboard.boveda_total) },
      { label: 'Proveedores online', value: String(snapshot.dashboard.proveedores_online ?? 0) },
      { label: 'Proveedores total', value: String(snapshot.dashboard.proveedores_total ?? 0) },
      { label: 'Clientes total', value: String(snapshot.dashboard.clientes_total ?? 0) },
      { label: 'Disputas abiertas', value: String(snapshot.dashboard.disputas_abiertas ?? 0) },
      { label: 'Monto disputado', value: money(snapshot.dashboard.monto_disputado) },
      { label: 'Docs pendientes', value: String(snapshot.dashboard.docs_pendientes ?? 0) },
      { label: 'Ingresos hoy', value: money(snapshot.dashboard.ingresos_hoy) },
      { label: 'Comisión hoy', value: money(snapshot.dashboard.comision_hoy) },
      { label: 'Ingresos del mes', value: money(snapshot.dashboard.ingresos_mes) },
      { label: 'Snapshot', value: snapshot.dashboard.snapshot_at ? formatDateTime(snapshot.dashboard.snapshot_at) : '—' },
    ]
    : []

  const serviciosFiltrados = serviceFilter
    ? snapshot.servicios.filter(service => service.estado === serviceFilter)
    : snapshot.servicios
  const estadosUnicos = Array.from(new Set(snapshot.servicios.map(service => service.estado))).sort()

  // ---------- GATE ----------
  if (!sessionReady || (session && access.loading)) {
    return <div className="uxugo uxadmin"><div className="adm-gate" role="status"><p>Validando acceso U.G.O…</p></div></div>
  }
  if (!session) {
    return <div className="uxugo uxadmin"><div className="adm-gate">
      <div className="adm-gate-card">
        <div className="adm-kicker">U.GO · {superMode ? 'SUPER ADMIN' : 'ADMIN'}</div>
        <h1>{superMode ? 'Super Admin' : 'Panel de control'}</h1>
        <p>Solo administradores con sesión activa pueden acceder a este panel.</p>
        <form onSubmit={adminLogin}>
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Usuario o email" aria-label="Usuario o email" autoComplete="username" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" aria-label="Contraseña" autoComplete="current-password" />
          <button className="ux-primary" disabled={loginBusy}>{loginBusy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        {loginError && <p className="adm-gate-error" role="alert">{loginError}</p>}
        <a className="ux-site-link" href="./">← Volver al sitio</a>
      </div>
    </div></div>
  }
  if (!gateOpen) {
    return <div className="uxugo uxadmin"><div className="adm-gate"><div className="adm-gate-card">
      <div className="adm-kicker">ACCESO RESTRINGIDO</div>
      <h1>Acceso denegado</h1>
      <p>{superMode
        ? 'Esta cuenta no tiene rol Super Admin activo. El panel Super Admin exige usuarios.tipo = superadmin y activo = true.'
        : access.error || 'Esta cuenta no tiene rol de administrador activo (usuarios.tipo = admin o superadmin, activo = true).'}</p>
      <div className="ux-action-group">
        <a className="ux-secondary ux-inline-action" href="./">Volver al sitio</a>
        <button className="ux-primary" onClick={async () => { await supabase.auth.signOut(); window.location.assign('./') }}>Cerrar sesión</button>
      </div>
    </div></div></div>
  }

  // ---------- APP ----------
  return <div className="uxugo uxadmin">
    <a className="ux-skip" href="#ux-content">Ir al contenido</a>
    {menuOpen && <button className="ux-backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}
    <aside className={'ux-sidebar ' + (menuOpen ? 'ux-sidebar-open' : '')}>
      <div className="ux-brand"><span>u<span>•</span>go</span><small>Control Center.</small><button onClick={() => setMenuOpen(false)} className="ux-close" aria-label="Cerrar menú">×</button></div>
      <div className={'adm-role-chip ' + (isSuper ? 'adm-role-super' : '')}>{isSuper ? 'SUPER ADMIN' : 'ADMIN'} · {access.role}</div>
      <div className="ux-nav-caption">OPERACIONES</div>
      <nav className="ux-side-links" aria-label="Navegación principal">{navigation.map(item =>
        <button key={item.id} className={view === item.id ? 'selected' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="ux-side-bottom">
        <a className="ux-site-link" href="./">← Volver al sitio</a>
        <button className="ux-person" onClick={async () => { await supabase.auth.signOut(); window.location.assign('./') }}>
          <span className="ux-person-symbol">◉</span>
          <span><strong>{session.user.email?.split('@')[0] || 'Admin'}</strong><small>Cerrar sesión</small></span>
        </button>
      </div>
    </aside>
    <div className="ux-main">
      <header className="ux-topbar">
        <button className="ux-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="ux-topcopy"><h1>{titles[view]}</h1><p>Autorización real en RLS/RPC · cada acción crítica queda auditada</p></div>
        <div className="ux-top-right">
          <button className="ux-login-link" disabled={busy} onClick={() => snapshot.reload()}>Actualizar</button>
          <span className="ux-avatar" title={session.user.email ?? ''}>◉</span>
        </div>
      </header>
      <main id="ux-content" className="ux-content">
        {snapshot.loading
          ? <div className="ux-surface" role="status">Cargando datos administrativos...</div>
          : <div className="ux-view" key={view}>
            {snapshot.error && <div className="ux-alert" role="alert">{snapshot.error}</div>}

            {view === 'dashboard' && <>
              <div className="adm-metric-grid">{metrics.map(metric =>
                <div className="ux-stat" key={metric.label}><strong>{metric.value}</strong><small>{metric.label}</small></div>)}</div>
              <div className="ux-surface">
                <h2>Vista administrativa</h2>
                <p>Métricas reales de <strong>vista_admin_dashboard</strong> en UGO TEST. La autoridad de autorización vive en <strong>private.is_admin / is_superadmin</strong>; la UI solo refleja el rol.</p>
              </div>
            </>}

            {view === 'services' && <>
              <div className="ux-section-title">
                <div><h2>Servicios ({serviciosFiltrados.length})</h2><p>Registro real de la tabla servicios</p></div>
                <select className="adm-filter" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} aria-label="Filtrar por estado">
                  <option value="">Todos los estados</option>
                  {estadosUnicos.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                </select>
              </div>
              {serviciosFiltrados.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">◈</span><strong>Sin servicios</strong><p>No hay servicios registrados con este filtro.</p></div>
                : <ul className="client-order-list">{serviciosFiltrados.map(service =>
                  <li key={service.id} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>#{String(service.numero ?? service.id.slice(0, 8))} · {service.categoria?.nombre ?? 'Servicio'} {service.categoria?.emoji ?? ''}</strong>
                      <small>
                        {service.cliente?.nombre ? `Cliente: ${service.cliente.nombre} · ` : ''}{service.proveedor?.nombre ? `Proveedor: ${service.proveedor.nombre} · ` : ''}
                        {service.tarifa != null ? `${money(service.tarifa, service.moneda ?? 'BRL')} · ` : ''}{service.created_at ? formatDateTime(service.created_at) : ''}
                      </small>
                    </div>
                    <span className={'ux-chip ux-chip-' + orderTone(service.estado)}>{service.estado}</span>
                  </li>)}</ul>}
            </>}

            {view === 'users' && <>
              <div className="ux-section-title"><div><h2>Usuarios ({snapshot.usuarios.length})</h2><p>Cuentas registradas en UGO TEST</p></div></div>
              {snapshot.usuarios.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">◉</span><strong>Sin usuarios visibles</strong><p>Tu cuenta no ve usuarios con los permisos actuales.</p></div>
                : <ul className="client-order-list">{snapshot.usuarios.map(user =>
                  <li key={user.id} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>{[user.nombre, user.apellido].filter(Boolean).join(' ') || user.email || user.id.slice(0, 8)}</strong>
                      <small>
                        {user.email ? `${user.email} · ` : ''}{user.zona || user.pais || ''} · karma {user.karma ?? 0} · {user.servicios_completados ?? 0} trabajos
                        {!user.activo && ' · inactivo'}
                      </small>
                    </div>
                    <div className="adm-row-actions">
                      <span className={'adm-chip adm-chip-' + (user.tipo === 'superadmin' ? 'super' : user.tipo === 'admin' ? 'admin' : user.tipo === 'proveedor' ? 'prov' : 'cli')}>{user.tipo}</span>
                      {user.tipo === 'proveedor' && user.activo &&
                        <button className="ux-secondary" disabled={busy} onClick={() => suspenderProveedor(user.id)}>Suspender</button>}
                    </div>
                  </li>)}</ul>}
            </>}

            {view === 'disputes' && <>
              <div className="ux-section-title"><div><h2>Disputas ({snapshot.disputas.length})</h2><p>Resolución con RPC admin_resolver_disputa (auditada)</p></div></div>
              {snapshot.disputas.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">⚑</span><strong>Sin disputas</strong><p>No hay disputas registradas.</p></div>
                : <ul className="client-order-list">{snapshot.disputas.map(dispute =>
                  <li key={dispute.id} className="adm-dispute">
                    <div className="ux-order-row">
                      <div className="ux-order-main">
                        <strong>#{String(dispute.numero ?? dispute.id.slice(0, 8))} · {money(dispute.monto_disputado)}</strong>
                        <small>{dispute.motivo || 'Sin motivo detallado'} · {dispute.created_at ? formatDateTime(dispute.created_at) : ''}</small>
                      </div>
                      <span className={'ux-chip ux-chip-' + orderTone(dispute.estado)}>{dispute.estado}</span>
                    </div>
                    {resolvingId === dispute.id
                      ? <div className="adm-resolve-form">
                        <label>Resolución
                          <textarea value={resolucion} rows={2} maxLength={600} onChange={e => setResolucion(e.target.value)} placeholder="Detalle de la resolución (queda auditada)" />
                        </label>
                        <label>A favor de
                          <select value={favorDe} onChange={e => setFavorDe(e.target.value)}>
                            <option value="">Según resolución</option>
                            <option value="cliente">Cliente</option>
                            <option value="proveedor">Proveedor</option>
                          </select>
                        </label>
                        <div className="ux-action-group">
                          <button className="ux-secondary" onClick={() => { setResolvingId(null); setResolucion(''); setFavorDe('') }}>Cancelar</button>
                          <button className="ux-primary" disabled={busy} onClick={() => resolverDisputa(dispute.id)}>Confirmar resolución</button>
                        </div>
                      </div>
                      : <button className="ux-secondary" disabled={busy} onClick={() => { setResolvingId(dispute.id); setResolucion(dispute.resolucion || ''); setFavorDe('') }}>Resolver disputa</button>}
                  </li>)}</ul>}
            </>}

            {view === 'documents' && <>
              <div className="ux-section-title"><div><h2>Documentos / KYC ({snapshot.documentos.length})</h2><p>Verificación de identidad de usuarios</p></div></div>
              {snapshot.documentos.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">▤</span><strong>Sin documentos</strong><p>No hay documentos cargados.</p></div>
                : <ul className="client-order-list">{snapshot.documentos.map(doc =>
                  <li key={doc.id} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>{doc.tipo}{doc.descripcion ? ` · ${doc.descripcion}` : ''}</strong>
                      <small>Usuario {doc.usuario_id?.slice(0, 8) ?? '—'} · {doc.created_at ? formatDateTime(doc.created_at) : ''}</small>
                    </div>
                    <span className={'ux-chip ux-chip-' + orderTone(doc.estado)}>{doc.estado}</span>
                  </li>)}</ul>}
              <p className="client-muted">La aprobación/rechazo de documentos con OCR se gestiona en el flujo KYC completo (ugo-admin-panel).</p>
            </>}

            {view === 'vault' && <>
              <div className="ux-section-title"><div><h2>Bóveda / Escrow ({snapshot.escrow.length})</h2><p>Liberación con RPC admin_liberar_escrow (auditada)</p></div></div>
              {snapshot.escrow.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">▣</span><strong>Sin movimientos de escrow</strong><p>Cuando haya pagos retenidos van a aparecer acá.</p></div>
                : <ul className="client-order-list">{snapshot.escrow.map(row =>
                  <li key={row.id} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>{money(row.monto_total)} · comisión {money(row.comision_ugo)} · neto {money(row.monto_proveedor)}</strong>
                      <small>Servicio {row.servicio_id?.slice(0, 8) ?? '—'} · {row.created_at ? formatDateTime(row.created_at) : ''}</small>
                    </div>
                    <div className="adm-row-actions">
                      <span className={'ux-chip ux-chip-' + orderTone(row.estado)}>{row.estado}</span>
                      {row.estado === 'retenido' && <button className="ux-secondary" disabled={busy} onClick={() => liberarEscrow(row.id)}>Liberar</button>}
                    </div>
                  </li>)}</ul>}
            </>}

            {view === 'audit' && <>
              <div className="ux-section-title"><div><h2>Auditoría ({snapshot.auditoria.length})</h2><p>Registro inmutable de acciones críticas</p></div></div>
              {snapshot.auditoria.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">≡</span><strong>Sin eventos</strong><p>Las acciones administrativas quedan registradas acá.</p></div>
                : <ul className="client-order-list">{snapshot.auditoria.map(entry =>
                  <li key={entry.id} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>{entry.evento}</strong>
                      <small>
                        {entry.entidad_tipo ? `${entry.entidad_tipo}${entry.entidad_id ? ` ${String(entry.entidad_id).slice(0, 8)}` : ''} · ` : ''}
                        {entry.created_at ? formatDateTime(entry.created_at) : ''}
                        {entry.detalles ? ` · ${JSON.stringify(entry.detalles).slice(0, 120)}` : ''}
                      </small>
                    </div>
                  </li>)}</ul>}
            </>}

            {view === 'system' && isSuper && <>
              <div className="ux-section-title"><div><h2>Configuración del sistema</h2><p>config_sistema · los feature flags exigen rol Super Admin</p></div></div>
              {snapshot.config.length === 0
                ? <div className="ux-empty"><span className="ux-empty-icon">⚙</span><strong>Sin parámetros visibles</strong><p>No hay configuración cargada o tu rol no alcanza para leerla.</p></div>
                : <ul className="client-order-list">{snapshot.config.map(row =>
                  <li key={row.clave} className="ux-order-row">
                    <div className="ux-order-main">
                      <strong>{row.clave}</strong>
                      <small>{String(row.valor ?? '')}{row.descripcion ? ` · ${row.descripcion}` : ''} · {row.grupo ?? 'general'}</small>
                    </div>
                    <div className="adm-row-actions">
                      {row.clave.startsWith('feature_')
                        ? <button className="ux-secondary" disabled={busy} onClick={() => void run(() => adminSetFeatureFlag(row.clave, !(row.valor === true || row.valor === 'true' || row.valor === 1)), `Feature flag "${row.clave}" actualizado.`)}>
                          {(row.valor === true || row.valor === 'true' || row.valor === 1) ? 'ON → OFF' : 'OFF → ON'}
                        </button>
                        : <button className="ux-secondary" disabled={busy} onClick={() => editarConfig(row.clave, row.valor)}>Editar</button>}
                    </div>
                  </li>)}</ul>}
              <div className="ux-surface">
                <h2>Bóveda de credenciales de pago</h2>
                <p>Estado de <strong>private.payment_credentials</strong>. Las credenciales nunca se exponen al frontend: solo el estado de configuración.</p>
                {snapshot.credenciales.length === 0
                  ? <p className="client-muted">Sin credenciales registradas.</p>
                  : <ul className="client-order-list">{snapshot.credenciales.map(row =>
                    <li key={`${row.provider}-${row.country}-${row.environment}`} className="ux-order-row">
                      <div className="ux-order-main">
                        <strong>{row.provider} · {row.country} · {row.environment}</strong>
                        <small>{row.updated_at ? `Actualizado ${formatDateTime(row.updated_at)}` : ''}</small>
                      </div>
                      <div className="adm-row-actions">
                        <span className={'ux-chip ' + (row.configured ? 'ux-chip-success' : 'ux-chip-pending')}>{row.configured ? 'configurada' : 'sin credenciales'}</span>
                        <span className={'ux-chip ' + (row.enabled ? 'ux-chip-active' : 'ux-chip-neutral')}>{row.enabled ? 'habilitada' : 'deshabilitada'}</span>
                      </div>
                    </li>)}</ul>}
              </div>
              <div className="ux-surface">
                <h2>Autonomía del sistema</h2>
                <p>Evaluación del gate de trabajadores autónomos (superadmin_evaluate_autonomy_on_gate). Cada ejecución queda auditada.</p>
                <button className="ux-primary" disabled={busy} onClick={() => {
                  void run(async () => {
                    const result = await superadminEvaluarAutonomia()
                    setNotice({ type: 'info', text: `Autonomía evaluada: ${result}` })
                  }, 'Evaluación de autonomía ejecutada.')
                }}>Evaluar autonomía ahora →</button>
              </div>
            </>}
          </div>}
        {notice && <div className={'ux-alert ' + (notice.type === 'error' ? 'uxp-alert-error' : notice.type === 'ok' ? 'uxp-alert-ok' : '')} role="alert">
          {notice.text}<button onClick={() => setNotice(null)} aria-label="Cerrar alerta">×</button></div>}
      </main>
    </div>
    <nav className="ux-mobile-nav" aria-label="Navegación móvil">
      {([navigation[0], navigation[1], navigation[2], navigation[navigation.length - 1]]).map(item =>
        <button key={item.id} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span>{item.icon}</span><small>{item.label}</small></button>)}
    </nav>
  </div>
}
