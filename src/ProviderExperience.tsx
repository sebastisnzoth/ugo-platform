import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ServiceJobTools from './ServiceJobTools'
import { orderTone } from './useClientOrders'
import {
  KYC_TIPOS,
  PROVIDER_ACTIVE_STATES,
  PROVIDER_LIFECYCLE,
  acceptOffer,
  advanceService,
  cancelService,
  ensureProviderProfile,
  formatDateTime,
  informarPagoDeuda,
  listKycDocuments,
  loadProviderCategories,
  loadProviderDemand,
  matchingGpsReady,
  money,
  rejectOffer,
  saveProviderCategories,
  saveProviderProfile,
  setProviderAvailability,
  submitProviderProfileToReview,
  timeAgo,
  unresolvedDebts,
  uploadKycDocument,
  uploadProviderPhoto,
  useProviderSnapshot,
} from './providerData'
import type { DemandRow, KycDocument, ProviderCategory, ProviderTransition } from './providerData'
import './client-zip-design.css'
import './provider-app.css'

type View = 'home' | 'opportunities' | 'active' | 'history' | 'earnings' | 'profile'
type Item = { id: View; label: string; icon: string }
const navigation: Item[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' }, { id: 'opportunities', label: 'Oportunidades', icon: '✦' },
  { id: 'active', label: 'Servicio', icon: '◈' }, { id: 'history', label: 'Actividad', icon: '▤' },
  { id: 'earnings', label: 'Ingresos', icon: '▣' }, { id: 'profile', label: 'Perfil', icon: '◉' },
]

const titles: Record<View, string> = {
  home: 'Inicio', opportunities: 'Oportunidades', active: 'Mi servicio',
  history: 'Mis trabajos', earnings: 'Ingresos', profile: 'Mi perfil profesional',
}

const lifecycleLabels: Record<string, string> = {
  asignado: 'Asignado', en_camino: 'En camino', llegado: 'Llegado',
  en_progreso: 'En progreso', esperando_aprobacion: 'Esperando aprobación', completado: 'Completado',
}

const nextAction: Partial<Record<string, { label: string; state: ProviderTransition }>> = {
  asignado: { label: 'Estoy en camino →', state: 'en_camino' },
  en_camino: { label: 'Confirmar llegada', state: 'llegado' },
  llegado: { label: 'Empezar trabajo', state: 'en_progreso' },
  en_progreso: { label: 'Marcar TRABAJO LISTO', state: 'esperando_aprobacion' },
}

export default function ProviderExperience() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<{ type: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const snapshot = useProviderSnapshot(session)
  const { profile, offers, services, payments, debts, reload } = snapshot

  // Perfil profesional (edición) y categorías
  const [bio, setBio] = useState('')
  const [tarifaBase, setTarifaBase] = useState('')
  const [ciudadBase, setCiudadBase] = useState('')
  const [zonaRadio, setZonaRadio] = useState('')
  const [categories, setCategories] = useState<ProviderCategory[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [primaryCat, setPrimaryCat] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [demand, setDemand] = useState<DemandRow[]>([])
  const [kycDocs, setKycDocs] = useState<KycDocument[]>([])
  const [terms, setTerms] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setLoading(false) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!profile) return
    setBio(profile.bio || '')
    setTarifaBase(profile.tarifa_base != null ? String(profile.tarifa_base) : '')
    setCiudadBase(profile.ciudad_base || '')
    setZonaRadio(profile.zona_radio_km != null ? String(profile.zona_radio_km) : '')
  }, [profile])

  useEffect(() => {
    if (!session) return
    loadProviderCategories(session.user.id)
      .then(result => { setCategories(result.categories); setSelectedCats(result.selected); setPrimaryCat(result.primary) })
      .catch(error => setNotice({ type: 'info', text: error instanceof Error ? error.message : 'No pudimos cargar las categorías.' }))
  }, [session])

  const online = Boolean(profile?.online && profile?.disponible)
  const gpsReady = matchingGpsReady(profile)
  const openDebts = unresolvedDebts(debts)
  const debtBlocked = openDebts.length >= 3
  const verified = profile?.estado_verificacion === 'verificado'
  const firstName = session?.user.email?.split('@')[0] || ''
  const activeService = services.find(service => ['asignado', 'en_camino', 'llegado', 'en_progreso'].includes(service.estado))
    ?? services.find(service => PROVIDER_ACTIVE_STATES.includes(service.estado))

  // Radar de demanda real (solo con perfil verificado).
  useEffect(() => {
    if (!verified) { setDemand([]); return }
    loadProviderDemand(profile?.categoria_principal_id ?? null, 24)
      .then(rows => { setDemand(rows); setNotice(null) })
      .catch(error => setNotice({ type: 'info', text: error instanceof Error ? error.message : 'No pudimos actualizar el radar de demanda.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, profile?.categoria_principal_id])

  // Documentos de onboarding/KYC del proveedor.
  useEffect(() => {
    if (!session) return
    listKycDocuments(session.user.id).then(setKycDocs).catch(() => {})
  }, [session])

  function go(next: View) { setView(next); setMenuOpen(false); setNotice(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function run(action: () => Promise<void>, ok: string) {
    if (busy) return
    setBusy(true); setNotice(null)
    try {
      await action()
      reload()
      setNotice({ type: 'ok', text: ok })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'La operación fue rechazada. Revisá los permisos o la conexión.' })
    } finally {
      setBusy(false)
    }
  }

  function toggleAvailability() {
    if (!session || !profile) return
    if (!online && debtBlocked) {
      setNotice({ type: 'error', text: `Tenés ${openDebts.length} comisiones UGO pendientes. Regularizá al menos una para volver a recibir pedidos.` })
      return
    }
    void run(() => setProviderAvailability(session.user.id, !online), online ? 'Quedaste Offline.' : 'Ya estás Online.')
  }

  function saveProfileForm(event: FormEvent) {
    event.preventDefault()
    if (!session || savingProfile) return
    setSavingProfile(true); setNotice(null)
    saveProviderProfile(session.user.id, {
      bio: bio.trim() || null,
      tarifa_base: Number(tarifaBase || 0),
      ciudad_base: ciudadBase.trim() || null,
      zona_radio_km: Number(zonaRadio || 0),
    }).then(() => {
      setSavingProfile(false)
      setNotice({ type: 'ok', text: 'Perfil profesional actualizado en UGO TEST.' })
      reload()
    }).catch(error => {
      setSavingProfile(false)
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el perfil.' })
    })
  }

  function saveCategoriesForm() {
    if (!primaryCat) { setNotice({ type: 'error', text: 'Elegí tu categoría principal.' }); return }
    void run(() => saveProviderCategories(primaryCat, selectedCats), 'Categorías actualizadas para el matching.')
  }

  function acceptOfferAction(offerId: string) {
    void run(() => acceptOffer(offerId), 'Trabajo aceptado. Quedó asignado a vos.')
  }
  function rejectOfferAction(offerId: string) {
    void run(() => rejectOffer(offerId), 'Pedido rechazado.')
  }
  function advanceAction(serviceId: string, state: ProviderTransition) {
    void run(() => advanceService(serviceId, state),
      state === 'en_camino' ? 'UGO avisó que estás yendo.' : state === 'llegado' ? 'Llegada confirmada.' : state === 'en_progreso' ? 'Trabajo iniciado.' : 'Listo. UGO avisó al cliente y sigue el cierre por detrás.')
  }
  function cancelAction(serviceId: string) {
    const motivo = window.prompt('¿Por qué cancelás este servicio? Queda registrado:')
    if (motivo == null) return
    void run(() => cancelService(serviceId, motivo), 'Servicio cancelado y registrado.')
  }
  function informarPagoAction(deudaId: string) {
    const referencia = window.prompt('Referencia del pago realizado a UGO (comprobante, TXID…):')
    if (referencia == null) return
    void run(() => informarPagoDeuda(deudaId, referencia), 'Pago informado. UGO va a conciliar la referencia.')
  }
  function kycUploadAction(tipo: string, file: File | undefined) {
    if (!session || !file) return
    void run(async () => {
      await ensureProviderProfile(session.user.id)
      await uploadKycDocument(session.user.id, tipo, file)
      setKycDocs(await listKycDocuments(session.user.id))
    }, `Documento "${tipo.replaceAll('_', ' ')}" enviado a revisión.`)
  }
  function photoUploadAction(file: File | undefined) {
    if (!session || !file) return
    void run(async () => {
      await ensureProviderProfile(session.user.id)
      await uploadProviderPhoto(session.user.id, file)
      reload()
    }, 'Foto de perfil actualizada.')
  }
  function submitReviewAction() {
    if (!session) return
    void run(async () => {
      await ensureProviderProfile(session.user.id)
      await submitProviderProfileToReview(session.user.id, terms)
      reload()
    }, 'Perfil enviado a revisión. Te avisamos cuando el equipo de UGO lo verifique.')
  }

  const released = payments.filter(p => p.estado === 'liberado' && p.metodo !== 'efectivo').reduce((n, p) => n + Number(p.ganancia_proveedor || 0), 0)
  const retained = payments.filter(p => p.estado === 'retenido').reduce((n, p) => n + Number(p.ganancia_proveedor || 0), 0)
  const cashReceived = payments.filter(p => p.estado === 'liberado' && p.metodo === 'efectivo').reduce((n, p) => n + Number(p.monto_bruto || 0), 0)
  const ugoDebt = openDebts.reduce((n, d) => n + Number(d.saldo_pendiente || 0), 0)
  const activeCount = services.filter(service => PROVIDER_ACTIVE_STATES.includes(service.estado)).length

  return <div className="uxugo">
    <a className="ux-skip" href="#ux-content">Ir al contenido</a>
    {menuOpen && <button className="ux-backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}
    <aside className={'ux-sidebar ' + (menuOpen ? 'ux-sidebar-open' : '')}>
      <div className="ux-brand"><span>u<span>•</span>go</span><small>Panel profesional.</small><button onClick={() => setMenuOpen(false)} className="ux-close" aria-label="Cerrar menú">×</button></div>
      <button className={'uxp-availability ' + (online ? 'uxp-online' : '')} onClick={toggleAvailability} disabled={busy || !profile}>
        <span className="uxp-availability-dot" />
        {online ? 'Online · recibiendo pedidos' : 'Offline · activá para trabajar'}
      </button>
      <div className="ux-nav-caption">MENÚ</div>
      <nav className="ux-side-links" aria-label="Navegación principal">{navigation.map(item =>
        <button key={item.id} className={view === item.id ? 'selected' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="ux-side-bottom">
        <a className="ux-site-link" href="./">← Volver al sitio</a>
        <div className="ux-help">◉ <span><strong>¿Necesitás ayuda?</strong><small>Centro de soporte UGO</small></span></div>
        <button className="ux-person" onClick={() => go('profile')}>
          <span className="ux-person-symbol">◉</span>
          <span><strong>{firstName || 'Tu cuenta'}</strong><small>{session ? 'Proveedor UGO' : 'Ingresá a UGO'}</small></span>
        </button>
      </div>
    </aside>
    <div className="ux-main">
      <header className="ux-topbar">
        <button className="ux-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="ux-topcopy"><h1>{titles[view]}</h1><p>Tus trabajos y clientes, sin vueltas</p></div>
        <div className="ux-top-right">
          <span className="ux-location">⌖ Florianópolis</span>
          {session ? <span className="ux-avatar" title={session.user.email}>◉</span> : <a className="ux-login-link" href="./">Ingresar</a>}
        </div>
      </header>
      <main id="ux-content" className="ux-content">
        {loading || snapshot.loading
          ? <div className="ux-surface" role="status">Cargando tu panel de proveedor...</div>
          : <div className="ux-view" key={view}>
            {!session && <div className="ux-empty"><span className="ux-empty-icon">◉</span>
              <strong>Ingresá a tu cuenta de proveedor</strong>
              <p>Este panel muestra tus oportunidades, trabajos y pagos reales de UGO TEST.</p>
              <a className="ux-primary" href="./">Ingresar</a></div>}

            {session && !verified && <div className="ux-surface uxp-gate" role="status">
              <span className="ux-subtitle">CUENTA PROFESIONAL</span>
              <h2>{profile ? `Verificación: ${profile.estado_verificacion || 'pendiente'}` : 'Todavía no tenés perfil de proveedor'}</h2>
              <p>Para recibir pedidos hace falta un perfil de proveedor verificado, con onboarding completo y términos aceptados. La verificación de documentos se gestiona en el panel de UGO. Podés revisar tu perfil y tus datos reales mientras tanto.</p>
              <button className="ux-secondary" onClick={() => go('profile')}>Revisar mi perfil →</button>
            </div>}

            {session && <>
              {debtBlocked && <div className="ux-alert uxp-debt-alert" role="alert">
                Tenés {openDebts.length} comisiones UGO pendientes. Llegaste al límite: regularizá los pagos para volver a aceptar pedidos.
              </div>}
              {snapshot.error && <div className="ux-alert" role="alert">{snapshot.error}</div>}

              {view === 'home' && <>
                <section className="ux-hero">
                  <div className="ux-hero-text">
                    <span className="ux-pill">{online ? '● ONLINE' : '○ OFFLINE'}</span>
                    <h2>Hola, {firstName}.</h2>
                    <p>{online
                      ? (gpsReady ? 'Estás visible para el matching. Los pedidos cercanos van a llegar como oportunidades.' : 'Estás Online, pero el matching exige GPS fresco (menos de 90 s) y preciso. Movete o reactivá la disponibilidad.')
                      : 'Activá tu disponibilidad con GPS para empezar a recibir oportunidades.'}</p>
                    <button onClick={toggleAvailability} className="ux-primary" disabled={busy || !profile}>
                      {online ? 'Ponerme Offline' : 'Ponerme Online →'}
                    </button>
                    <span className="ux-trust">✓ Asignación única. Estado real desde UGO TEST.</span>
                  </div>
                  <div className="ux-hero-art" aria-hidden="true">
                    <span className="ux-hero-blob" />
                    <span className="ux-hero-circle">⚙</span>
                    <div className="ux-floating"><strong>{gpsReady ? '✓ Matching activo' : '◷ GPS ' + (online ? 'desactualizado' : 'requerido')}</strong><small>El radar usa tu ubicación real</small></div>
                  </div>
                </section>

                <div className="ux-stat-row">
                  <div className="ux-stat"><strong>{offers.length}</strong><small>Oportunidades</small></div>
                  <div className="ux-stat"><strong>{activeCount}</strong><small>Servicios activos</small></div>
                  <div className="ux-stat"><strong>{money(ugoDebt)}</strong><small>Deuda UGO</small></div>
                </div>

                {activeService && <div className="ux-surface uxp-active-preview">
                  <div className="ux-section-title ux-section-tight">
                    <div><h2>Servicio en curso</h2><p>Pedido #{String(activeService.numero ?? activeService.id.slice(0, 8))} · {activeService.categoria?.nombre ?? 'Servicio'} {activeService.categoria?.emoji ?? ''}</p></div>
                    <span className={'ux-chip ux-chip-' + orderTone(activeService.estado)}>{activeService.estado}</span>
                  </div>
                  <div className="ux-action-group">
                    <button className="ux-secondary" onClick={() => go('active')}>Ver detalle →</button>
                    {nextAction[activeService.estado] && <button className="ux-primary" disabled={busy} onClick={() => advanceAction(activeService.id, nextAction[activeService.estado]!.state)}>{nextAction[activeService.estado]!.label}</button>}
                  </div>
                </div>}

                <div className="ux-surface uxp-offers-preview">
                  <div className="ux-section-title ux-section-tight">
                    <div><h2>Oportunidades para vos</h2><p>Ofertas reales de UGO TEST</p></div>
                    <button className="ux-link" onClick={() => go('opportunities')}>Ver todas →</button>
                  </div>
                  {offers.length === 0
                    ? <p className="client-muted">No hay oportunidades disponibles ahora. Cuando te ofrezcan un pedido va a aparecer acá.</p>
                    : <ul className="client-order-list">{offers.slice(0, 3).map(offer =>
                      <li key={offer.id} className="ux-order-row">
                        <div className="ux-order-main">
                          <strong>{offer.servicio?.categoria?.nombre ?? 'Servicio'} · {money(offer.tarifa_ofrecida ?? offer.servicio?.tarifa ?? 0)}</strong>
                          {offer.servicio?.created_at && <small>{timeAgo(offer.servicio.created_at)} · {offer.servicio.zona_cliente || offer.servicio.direccion_cliente || 'Zona por confirmar'}</small>}
                        </div>
                        <button className="ux-primary" disabled={busy} onClick={() => acceptOfferAction(offer.id)}>Aceptar</button>
                      </li>)}</ul>}
                </div>

                <div className="ux-surface">
                  <div className="ux-section-title ux-section-tight">
                    <div><h2>Radar de demanda</h2><p>Demanda real de las últimas 24 h en tu categoría</p></div>
                  </div>
                  {demand.length === 0
                    ? <p className="client-muted">Sin señales de demanda ahora. El radar se actualiza con pedidos reales de tu zona.</p>
                    : <ul className="client-order-list">{demand.map((row, index) =>
                      <li key={index} className="ux-order-row">
                        <div className="ux-order-main">
                          <strong>Zona activa · {Math.max(0, Number(row.pedidos || 0))} pedido(s) reciente(s)</strong>
                          <small>{Math.max(0, Number(row.urgentes || 0))} urgentes · tarifa promedio {money(row.tarifa_promedio)}{row.ultimo_pedido ? ` · último ${timeAgo(row.ultimo_pedido)}` : ''}</small>
                        </div>
                      </li>)}</ul>}
                </div>
              </>}

              {view === 'opportunities' && <>
                <div className="ux-section-title"><div><h2>Pedidos disponibles</h2><p>Aceptá el que mejor te quede. La asignación es única y atómica.</p></div></div>
                {offers.length === 0
                  ? <div className="ux-empty"><span className="ux-empty-icon">✦</span>
                    <strong>Sin oportunidades por ahora</strong>
                    <p>Cuando un cliente solicite un servicio en tus categorías, la oferta va a aparecer acá.</p>
                    <button className="ux-secondary" onClick={() => go('home')}>Volver al inicio</button></div>
                  : <ul className="uxp-offer-list">{offers.map(offer => {
                    const service = offer.servicio
                    return <li key={offer.id} className="uxp-offer">
                      <div className="uxp-offer-head">
                        <span className="ux-category-icon blue">{service?.categoria?.emoji ?? '✦'}</span>
                        <div className="uxp-offer-title">
                          <strong>{service?.categoria?.nombre ?? 'Servicio'}</strong>
                          <small>{service?.zona_cliente || service?.direccion_cliente || 'Zona por confirmar'}{offer.distancia_km ? ` · ${Number(offer.distancia_km).toFixed(1)} km` : ''}</small>
                        </div>
                        {service?.urgencia ? <span className="ux-chip ux-chip-danger">urgente</span> : <span className="ux-chip ux-chip-neutral">normal</span>}
                      </div>
                      <p>{service?.descripcion || 'Sin descripción.'}</p>
                      <div className="uxp-offer-meta">
                        <strong>{money(offer.tarifa_ofrecida ?? service?.tarifa ?? 0, service?.moneda ?? 'BRL')}</strong>
                        <small>{service?.created_at ? timeAgo(service.created_at) : ''}{offer.expira_at ? ` · expira ${formatDateTime(offer.expira_at)}` : ''}{offer.ranking != null ? ` · ranking ${offer.ranking}` : ''}</small>
                      </div>
                      <div className="uxp-offer-actions">
                        <button className="ux-secondary" disabled={busy} onClick={() => rejectOfferAction(offer.id)}>Rechazar</button>
                        <button className="ux-primary" disabled={busy || debtBlocked} title={debtBlocked ? 'Regularizá tus comisiones UGO pendientes' : undefined} onClick={() => acceptOfferAction(offer.id)}>Aceptar pedido →</button>
                      </div>
                    </li>
                  })}</ul>}
                <p className="ux-note">Al aceptar, la RPC canónica <strong>aceptar_oferta</strong> asigna el servicio de forma atómica e invalida las ofertas de la competencia.</p>
              </>}

              {view === 'active' && (activeService ? <>
                <div className="ux-surface">
                  <div className="ux-section-title ux-section-tight">
                    <div>
                      <span className="ux-subtitle">SERVICIO #{String(activeService.numero ?? activeService.id.slice(0, 8))}</span>
                      <h2>{activeService.categoria?.emoji ?? ''} {activeService.categoria?.nombre ?? 'Servicio'}</h2>
                      <p>{activeService.descripcion || 'Sin descripción.'}</p>
                    </div>
                    <span className={'ux-chip ux-chip-' + orderTone(activeService.estado)}>{activeService.estado}</span>
                  </div>
                  <div className="uxp-steps">{PROVIDER_LIFECYCLE.map(state => {
                    const currentIndex = PROVIDER_LIFECYCLE.indexOf(activeService.estado as typeof PROVIDER_LIFECYCLE[number])
                    const index = PROVIDER_LIFECYCLE.indexOf(state)
                    return <span key={state} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}>{lifecycleLabels[state]}</span>
                  })}</div>
                  <dl className="ux-summary">
                    {activeService.cliente?.nombre && <div><dt>Cliente</dt><dd>{activeService.cliente.nombre}</dd></div>}
                    <div><dt>Dirección</dt><dd>{activeService.direccion_cliente || activeService.zona_cliente || 'A confirmar con el cliente'}</dd></div>
                    <div><dt>Tarifa</dt><dd>{money(activeService.tarifa, activeService.moneda ?? 'BRL')}{activeService.ganancia_proveedor != null ? ` · tu ganancia ${money(activeService.ganancia_proveedor, activeService.moneda ?? 'BRL')}` : ''}</dd></div>
                    <div><dt>Creado</dt><dd>{formatDateTime(activeService.created_at)}</dd></div>
                  </dl>
                  {nextAction[activeService.estado]
                    ? <div className="ux-action-group">
                      <button className="ux-secondary" disabled={busy} onClick={() => cancelAction(activeService.id)}>Cancelar servicio</button>
                      <button className="ux-primary" disabled={busy} onClick={() => advanceAction(activeService.id, nextAction[activeService.estado]!.state)}>{nextAction[activeService.estado]!.label}</button>
                    </div>
                    : <p className="ux-note">{activeService.estado === 'esperando_aprobacion'
                      ? 'Marcaste el trabajo como listo. El cliente aprueba el trabajo y confirma el pago para cerrar el servicio.'
                      : 'Este servicio está en disputa. El equipo de UGO va a contactarte con la resolución.'}</p>}
                </div>
                {payments.find(p => p.servicio_id === activeService.id) && (() => {
                  const payment = payments.find(p => p.servicio_id === activeService.id)!
                  return <div className="ux-surface uxp-payment-strip">
                    <span className="ux-subtitle">PAGO DE ESTE SERVICIO</span>
                    <h2>{payment.metodo === 'efectivo' ? 'Efectivo' : 'Pago electrónico'}</h2>
                    <p>Estado: <strong>{payment.estado}</strong> · Bruto {money(payment.monto_bruto, payment.moneda ?? 'BRL')} · Comisión UGO {money(payment.comision_ugo, payment.moneda ?? 'BRL')} · Tu ganancia {money(payment.ganancia_proveedor, payment.moneda ?? 'BRL')}</p>
                    {payment.metodo === 'efectivo' && <p className="client-muted">El cobro en efectivo lo confirma el cliente después de aprobar el trabajo. No hace falta que lo confirmes desde acá.</p>}
                  </div>
                })()}
                <ServiceJobTools serviceId={activeService.id} serviceEstado={activeService.estado} session={session} actor="proveedor" />
              </> : <div className="ux-empty">
                <span className="ux-empty-icon">◈</span>
                <strong>No tenés servicios activos</strong>
                <p>Aceptá una oportunidad y el trabajo asignado va a aparecer acá con su seguimiento.</p>
                <button className="ux-primary" onClick={() => go('opportunities')}>Ver oportunidades →</button>
              </div>)}

              {view === 'history' && <section className="client-panel">
                <span className="client-kicker">TRABAJOS REALES</span><h1>Mis trabajos</h1>
                {services.length === 0
                  ? <div className="ux-empty"><span className="ux-empty-icon">▤</span>
                    <strong>Todavía no tenés trabajos registrados</strong>
                    <p>Tu historial de servicios va a aparecer acá.</p></div>
                  : <ul className="client-order-list">{services.map(service =>
                    <li key={service.id} className="ux-order-row">
                      <div className="ux-order-main">
                        <strong>#{String(service.numero ?? service.id.slice(0, 8))} · {service.categoria?.nombre ?? 'Servicio'}</strong>
                        <small>{service.created_at ? formatDateTime(service.created_at) : ''}{service.tarifa != null ? ` · ${money(service.tarifa, service.moneda ?? 'BRL')}` : ''}</small>
                      </div>
                      <span className={'ux-chip ux-chip-' + orderTone(service.estado)}>{service.estado}</span>
                    </li>)}</ul>}
                <p className="client-muted">Historial según tu cuenta de UGO TEST. Los pagos y comisiones se detallan en Ingresos.</p>
              </section>}

              {view === 'earnings' && <>
                <div className="ux-stat-row">
                  <div className="ux-stat"><strong>{money(released)}</strong><small>Liberado (electrónico)</small></div>
                  <div className="ux-stat"><strong>{money(retained)}</strong><small>Retenido / protegido</small></div>
                  <div className="ux-stat"><strong>{money(cashReceived)}</strong><small>Efectivo recibido</small></div>
                </div>
                <div className="ux-bottom-row">
                  <div className="ux-surface">
                    <span className="ux-subtitle">COMISIONES UGO</span>
                    <h2>Deuda con UGO: {money(ugoDebt)}</h2>
                    {openDebts.length === 0
                      ? <p>Estás al día. No tenés comisiones pendientes.</p>
                      : <ul className="client-order-list">{openDebts.map(debt =>
                        <li key={debt.id} className="ux-order-row">
                          <div className="ux-order-main">
                            <strong>Comisión {money(debt.saldo_pendiente, debt.moneda ?? 'BRL')} · {debt.estado}</strong>
                            <small>Servicio #{String(debt.servicio?.numero ?? debt.servicio_id?.slice(0, 8) ?? '—')} · {formatDateTime(debt.created_at)}</small>
                          </div>
                          <button className="ux-secondary" disabled={busy} onClick={() => informarPagoAction(debt.id)}>Informar pago</button>
                        </li>)}</ul>}
                    <p className="client-muted">La generación del pago (PIX) y la conciliación se gestionan desde el flujo oficial de UGO con la RPC informar_pago_deuda_ugo.</p>
                  </div>
                  <div className="ux-surface ux-status">
                    <span className="ux-subtitle">PAGOS RECIENTES</span>
                    {payments.length === 0
                      ? <p>Todavía no registrás pagos. Cuando cierres trabajos van a aparecer acá.</p>
                      : <ul className="client-order-list">{payments.slice(0, 6).map(payment =>
                        <li key={payment.id} className="ux-order-row">
                          <div className="ux-order-main">
                            <strong>{money(payment.ganancia_proveedor, payment.moneda ?? 'BRL')}</strong>
                            <small>{payment.metodo || 'método'} · {payment.estado}{payment.created_at ? ` · ${formatDateTime(payment.created_at)}` : ''}</small>
                          </div>
                        </li>)}</ul>}
                  </div>
                </div>
              </>}

              {view === 'profile' && <section className="client-panel">
                <span className="client-kicker">MI PERFIL PROFESIONAL</span>
                <h1>Tus datos</h1>
                <p>{session.user.email} · Estado de verificación: <strong>{profile?.estado_verificacion || 'sin perfil'}</strong></p>
                <form onSubmit={saveProfileForm} className="client-profile-form">
                  <label>Descripción profesional
                    <textarea value={bio} maxLength={400} rows={3} onChange={e => setBio(e.target.value)} placeholder="Contanos tu experiencia y especialidad" />
                  </label>
                  <label>Tarifa base (BRL)
                    <input type="number" min="0" step="0.01" value={tarifaBase} onChange={e => setTarifaBase(e.target.value)} />
                  </label>
                  <label>Ciudad base
                    <input value={ciudadBase} maxLength={120} onChange={e => setCiudadBase(e.target.value)} placeholder="Florianópolis" />
                  </label>
                  <label>Radio de trabajo (km)
                    <input type="number" min="0" step="1" value={zonaRadio} onChange={e => setZonaRadio(e.target.value)} />
                  </label>
                  <button className="client-primary" disabled={savingProfile}>{savingProfile ? 'Guardando...' : 'Guardar perfil'}</button>
                </form>
                <div className="uxp-categories">
                  <h2>Tus categorías</h2>
                  <p>Definen qué oportunidades te llegan. La primera es tu categoría principal.</p>
                  <label className="uxp-primary-cat">Categoría principal
                    <select value={primaryCat} onChange={e => setPrimaryCat(e.target.value)}>
                      <option value="">Elegir…</option>
                      {categories.map(category => <option key={category.id} value={category.id}>{category.emoji} {category.nombre}</option>)}
                    </select>
                  </label>
                  <div className="ux-radio-row">{categories.map(category =>
                    <label key={category.id} className={selectedCats.includes(category.id) || primaryCat === category.id ? 'ux-radio-chosen' : ''}>
                      <input type="checkbox" checked={selectedCats.includes(category.id) || primaryCat === category.id}
                        onChange={() => setSelectedCats(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id])} />
                      {category.emoji} {category.nombre}
                    </label>)}</div>
                  <button className="ux-secondary" disabled={busy} onClick={saveCategoriesForm}>Guardar categorías</button>
                </div>
                <div className="uxp-categories">
                  <h2>Onboarding / Verificación</h2>
                  <p>Subí tus documentos y enviá tu perfil a revisión. Estado actual: <strong>{profile?.estado_verificacion || 'sin perfil'}</strong>.</p>
                  <div className="uxp-photo-row">
                    <label className="uxp-upload">📷 Cambiar foto de perfil
                      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { photoUploadAction(e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  </div>
                  {KYC_TIPOS.map(tipo =>
                    <div className="uxp-kyc-row" key={tipo.value}>
                      <span>{tipo.label}</span>
                      {kycDocs.filter(doc => doc.tipo === tipo.value).map(doc =>
                        <span key={doc.id ?? doc.url_storage} className={'ux-chip ux-chip-' + orderTone(doc.estado)}>{doc.estado}</span>)}
                      <label className="uxp-upload">Subir
                        <input type="file" accept="image/*,application/pdf" disabled={busy} onChange={e => { kycUploadAction(tipo.value, e.target.files?.[0]); e.target.value = '' }} />
                      </label>
                    </div>)}
                  <label className="ux-radio-row">
                    <span className={terms ? 'ux-radio-chosen' : ''}>
                      <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
                      Acepto los términos de UGO para proveedores
                    </span>
                  </label>
                  <button className="ux-primary" disabled={busy || (profile?.estado_verificacion !== 'registrado' && profile?.estado_verificacion !== 'rechazado' && profile != null)} onClick={submitReviewAction}>Enviar a revisión →</button>
                  {profile != null && profile.estado_verificacion !== 'registrado' && profile.estado_verificacion !== 'rechazado' &&
                    <p className="client-muted">Tu perfil está en estado “{profile.estado_verificacion}”. Solo podés reenviarlo desde “registrado” o “rechazado”.</p>}
                </div>
                <button className="client-secondary" onClick={async () => {
                  const { error } = await supabase.auth.signOut()
                  if (error) { setNotice({ type: 'error', text: error.message }); return }
                  window.location.assign('./')
                }}>Cerrar sesión</button>
              </section>}
            </>}
          </div>}
        {notice && <div className={'ux-alert ' + (notice.type === 'error' ? 'uxp-alert-error' : notice.type === 'ok' ? 'uxp-alert-ok' : '')} role="alert">
          {notice.text}<button onClick={() => setNotice(null)} aria-label="Cerrar alerta">×</button></div>}
      </main>
    </div>
    <nav className="ux-mobile-nav" aria-label="Navegación móvil">
      {([navigation[0], navigation[1], navigation[2], navigation[5]]).map(item =>
        <button key={item.id} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span>{item.icon}</span><small>{item.label}</small></button>)}
    </nav>
  </div>
}
