import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ClientProfile from './ClientProfile'
import ClientActivity from './ClientActivity'
import ServiceJobTools from './ServiceJobTools'
import { formatOrderDate, orderTone, useClientOrders } from './useClientOrders'
import type { ClientOrder } from './useClientOrders'
import {
  approveService,
  cancelClientService,
  cashPaymentEnabled,
  confirmCashPayment,
  createServiceRequest,
  loadClientPayments,
  loadMyReview,
  loadServicePayment,
  rateService,
  selectPaymentMethod,
} from './clientData'
import type { RealCategory, ServicePayment } from './clientData'
import { getServiceTracking } from './serviceContracts'
import './client-zip-design.css'

type View = 'home' | 'explore' | 'request' | 'active' | 'activity' | 'payments' | 'profile'
type Item = { id: View; label: string; icon: string }
const navigation: Item[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' }, { id: 'explore', label: 'Explorar', icon: '⌕' },
  { id: 'active', label: 'Servicio', icon: '◈' }, { id: 'activity', label: 'Actividad', icon: '▤' },
  { id: 'payments', label: 'Pagos', icon: '▣' }, { id: 'profile', label: 'Perfil', icon: '◉' },
]
const tones = ['blue', 'yellow', 'purple', 'orange', 'cyan', 'pink']
const curated = [
  { name: 'Plomería', icon: '💧', tone: 'blue' }, { name: 'Electricidad', icon: '⚡', tone: 'yellow' },
  { name: 'Limpieza', icon: '🧹', tone: 'purple' }, { name: 'Reparaciones', icon: '🔧', tone: 'orange' },
  { name: 'Climatización', icon: '❄️', tone: 'cyan' }, { name: 'Pintura', icon: '🎨', tone: 'pink' },
]
type VisualCategory = { id: string | null; name: string; icon: string; tone: string }

type Urgency = 'flexible' | 'pronto' | 'hoy'
type RequestDraft = { category: string; categoryId: string | null; title: string; details: string; urgency: Urgency; address: string }
const DRAFT_KEY = 'ugo-request-draft'
const urgencyOptions: { value: Urgency; label: string }[] = [
  { value: 'flexible', label: 'Sin apuro' },
  { value: 'pronto', label: 'Esta semana' },
  { value: 'hoy', label: 'Lo antes posible' },
]
const urgencyLabel = (value: Urgency) => urgencyOptions.find(option => option.value === value)?.label ?? value

export default function ClientExperience() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<RequestDraft>({ category: 'Plomería', categoryId: null, title: '', details: '', urgency: 'flexible', address: '' })
  const [places, setPlaces] = useState<{ id: string; etiqueta: string; direccion: string }[]>([])
  const [realCats, setRealCats] = useState<RealCategory[]>([])
  const { orders, reload: reloadOrders } = useClientOrders(session, 30)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      setSession(data.session); setLoading(false)
      if (error) setNotice('No pudimos comprobar la sesión.')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  // Categorías reales de UGO TEST (contrato de matching).
  useEffect(() => {
    supabase.from('categorias').select('id,nombre,emoji,slug').eq('activa', true).order('nombre')
      .then(({ data, error }) => {
        if (!error && data && data.length) setRealCats(data as RealCategory[])
      })
  }, [])

  useEffect(() => {
    if (!session) { setPlaces([]); return }
    supabase.from('direcciones_cliente')
      .select('id,etiqueta,direccion').eq('usuario_id', session.user.id)
      .order('es_predeterminada', { ascending: false }).limit(6)
      .then(({ data }) => setPlaces((data || []) as { id: string; etiqueta: string; direccion: string }[]))
  }, [session])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<RequestDraft>
      setDraft(current => ({ ...current, ...saved }))
      setNotice('Recuperamos un borrador de pedido guardado en este dispositivo. Podés retomarlo en “Nuevo servicio”.')
    } catch { /* borrador ilegible: se ignora */ }
  }, [])

  const visualCategories: VisualCategory[] = useMemo(() => {
    if (realCats.length) {
      return realCats.map((category, index) => ({
        id: category.id,
        name: category.nombre,
        icon: category.emoji || '✦',
        tone: tones[index % tones.length],
      }))
    }
    return curated.map(category => ({ id: null, ...category }))
  }, [realCats])

  const filtered = useMemo(() => visualCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase().trim())), [search, visualCategories])
  const firstName = session?.user.email?.split('@')[0] || ''
  const focusOrder = orders.find(order => ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'disputado'].includes(order.estado))
    ?? orders.find(order => ['buscando', 'ofrecido'].includes(order.estado))
    ?? orders[0]

  function go(next: View) { setView(next); setMenuOpen(false); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function startRequest(name: string, categoryId: string | null = null) {
    setDraft(current => ({ ...current, category: name, categoryId }))
    setStep(1); go('request')
  }
  function goToStep(next: number) {
    if (next < 1 || next > 3) return
    if (next === 3 && draft.title.trim().length < 3) {
      setNotice('Completá el título del trabajo para ver la confirmación.')
      setStep(2); return
    }
    setStep(next); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function continueToReview(event: FormEvent) {
    event.preventDefault()
    if (draft.title.trim().length < 3) { setNotice('Contanos en pocas palabras qué necesitás (mínimo 3 caracteres).'); return }
    setNotice(''); setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function saveDraft() {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
    setNotice('Borrador guardado en este dispositivo.')
  }
  function clearDraft() {
    window.localStorage.removeItem(DRAFT_KEY)
    setDraft({ category: 'Plomería', categoryId: null, title: '', details: '', urgency: 'flexible', address: '' })
    setStep(1); setNotice('Borrador eliminado.')
  }

  async function submitRequest() {
    if (!session) { setNotice('Ingresá a tu cuenta para solicitar el servicio.'); return }
    const categoriaId = draft.categoryId ?? realCats.find(c => c.nombre.toLowerCase() === draft.category.toLowerCase())?.id ?? ''
    if (!categoriaId) { setNotice('No encontramos la categoría real de UGO. Elegí una de la lista.'); return }
    setBusy(true); setNotice('')
    try {
      await createServiceRequest(session.user.id, {
        categoriaId,
        descripcion: `${draft.title.trim()}${draft.details.trim() ? ` — ${draft.details.trim()}` : ''}`,
        direccion: draft.address,
        urgencia: draft.urgency === 'hoy',
      })
      window.localStorage.removeItem(DRAFT_KEY)
      setNotice('¡Pedido creado! Ya iniciamos la búsqueda de profesionales.')
      reloadOrders()
      setStep(1)
      go('active')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos crear el pedido.')
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<View, string> = { home: 'Inicio', explore: 'Explorar servicios', request: 'Nuevo servicio', active: 'Mi servicio', activity: 'Mis actividades', payments: 'Pagos', profile: 'Mi perfil' }
  return <div className="uxugo">
    <a className="ux-skip" href="#ux-content">Ir al contenido</a>
    {menuOpen && <button className="ux-backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}
    <aside className={'ux-sidebar ' + (menuOpen ? 'ux-sidebar-open' : '')}>
      <div className="ux-brand"><span>u<span>•</span>go</span><small>Todo resuelto.</small><button onClick={() => setMenuOpen(false)} className="ux-close" aria-label="Cerrar menú">×</button></div>
      <button className="ux-new" onClick={() => startRequest('Plomería')}>＋ Nuevo servicio</button>
      <div className="ux-nav-caption">MENÚ</div>
      <nav className="ux-side-links" aria-label="Navegación principal">{navigation.map(item =>
        <button key={item.id} className={view === item.id ? 'selected' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="ux-side-bottom">
        <a className="ux-site-link" href="./">← Volver al sitio</a>
        <div className="ux-help">◉ <span><strong>¿Necesitás ayuda?</strong><small>Centro de soporte UGO</small></span></div>
        <button className="ux-person" onClick={() => go('profile')}>
          <span className="ux-person-symbol">◉</span>
          <span><strong>{firstName || 'Tu cuenta'}</strong><small>{session ? 'Cliente UGO' : 'Ingresá a UGO'}</small></span>
        </button>
      </div>
    </aside>
    <div className="ux-main">
      <header className="ux-topbar">
        <button className="ux-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="ux-topcopy"><h1>{titles[view]}</h1><p>Soluciones para tu hogar, sin vueltas</p></div>
        <div className="ux-top-right">
          <span className="ux-location">⌖ Florianópolis</span>
          {session
            ? <span className="ux-avatar" title={session.user.email}>◉</span>
            : <a className="ux-login-link" href="./">Ingresar</a>}
        </div>
      </header>
      <main id="ux-content" className="ux-content">
        {loading ? <div className="ux-surface" role="status">Cargando tu cuenta...</div> : <div className="ux-view" key={view}>
          {view === 'home' && <>
            <section className="ux-hero">
              <div className="ux-hero-text">
                <span className="ux-pill">✦ SERVICIOS PROFESIONALES</span>
                <h2>{session ? <>Hola, {firstName}.</> : 'Tu hogar en buenas manos.'}</h2>
                <p>{session ? 'Todo lo que necesitás para tu hogar, en un solo lugar.' : 'Encontrá profesionales para lo que necesites, de forma simple y segura.'}</p>
                <button onClick={() => startRequest('Plomería')} className="ux-primary">{session ? 'Solicitar un servicio →' : 'Encontrar un profesional →'}</button>
                <span className="ux-trust">✓ Un pedido. Un profesional. Sin vueltas.</span>
              </div>
              <div className="ux-hero-art" aria-hidden="true">
                <span className="ux-hero-blob" />
                <span className="ux-hero-circle">⌂</span>
                <div className="ux-floating"><strong>✓ Servicio verificado</strong><small>UGO te acompaña</small></div>
              </div>
            </section>
            {session && <>
              <div className="ux-stat-row">
                <div className="ux-stat"><strong>{orders.length}</strong><small>Pedidos registrados</small></div>
                <div className="ux-stat"><strong>{places.length}</strong><small>Direcciones guardadas</small></div>
                <div className="ux-stat"><strong>{orders.filter(order => ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion'].includes(order.estado)).length}</strong><small>Servicios en curso</small></div>
              </div>
              <div className="ux-surface ux-orders-preview">
                <div className="ux-section-title ux-section-tight">
                  <div><h2>Tus últimos pedidos</h2><p>Actividad real de tu cuenta</p></div>
                  <button className="ux-link" onClick={() => go('activity')}>Ver todos →</button>
                </div>
                {orders.length === 0
                  ? <p className="client-muted">Todavía no tenés pedidos registrados. Cuando solicites un servicio va a aparecer acá.</p>
                  : <ul className="client-order-list">{orders.slice(0, 3).map(order =>
                    <li key={order.id} className="ux-order-row">
                      <div className="ux-order-main">
                        <strong>Pedido {order.id.slice(0, 8)}</strong>
                        {order.created_at && <small>{formatOrderDate(order.created_at)}</small>}
                      </div>
                      <span className={'ux-chip ux-chip-' + orderTone(order.estado)}>{order.estado || 'sin estado'}</span>
                    </li>)}</ul>}
              </div>
            </>}
            <div className="ux-section-title"><div><h2>¿Qué necesitás resolver?</h2><p>Elegí la categoría ideal para vos</p></div><button className="ux-link" onClick={() => go('explore')}>Ver todas →</button></div>
            <div className="ux-categories">{visualCategories.slice(0, 6).map(c =>
              <button key={c.name} className="ux-category" onClick={() => startRequest(c.name, c.id)}>
                <span className={'ux-category-icon ' + c.tone}>{c.icon}</span>
                <strong>{c.name}</strong><small>Explorar →</small></button>)}</div>
            <section className="ux-bottom-row">
              <div className="ux-surface">
                <span className="ux-subtitle">EMPEZÁ EN MINUTOS</span>
                <h2>¿Tenés algo pendiente?</h2>
                <p>Describí qué necesitás en tres pasos y enviá el pedido real. UGO inicia el matching para encontrar un profesional.</p>
                <button className="ux-secondary" onClick={() => startRequest('Reparaciones')}>Solicitar servicio →</button>
              </div>
              <div className="ux-surface ux-status">
                <span className="ux-subtitle">TU CUENTA</span>
                <h2>Tu actividad</h2>
                <p>{session ? 'Consultá los trabajos realmente registrados con tu usuario.' : 'Ingresá para ver tus pedidos, direcciones y perfil.'}</p>
                {session
                  ? <button className="ux-secondary" onClick={() => go('activity')}>Ver mis pedidos →</button>
                  : <a className="ux-secondary ux-inline-action" href="./">Ingresar →</a>}
              </div>
            </section>
          </>}

          {view === 'explore' && <>
            <div className="ux-section-title"><div><h2>Explorar servicios</h2><p>Categorías reales de UGO</p></div></div>
            <label className="ux-search">⌕ <input placeholder="Buscar plomería, electricidad, limpieza..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar categorías" /></label>
            <div className="ux-categories">{filtered.map(c =>
              <button key={c.name} className="ux-category" onClick={() => startRequest(c.name, c.id)}>
                <span className={'ux-category-icon ' + c.tone}>{c.icon}</span>
                <strong>{c.name}</strong><small>Consultar →</small></button>)}</div>
            {filtered.length === 0 && <div className="ux-empty"><span className="ux-empty-icon">⌕</span>
              <strong>Sin resultados</strong><p>No se encontraron categorías con ese nombre.</p></div>}
          </>}

          {view === 'request' && <div className="ux-request">
            <span className="ux-subtitle">NUEVA SOLICITUD</span>
            <h2>Contanos qué necesitás</h2>
            <div className="ux-stepper">
              <button className={step === 1 ? 'current' : step > 1 ? 'done' : ''} onClick={() => goToStep(1)}>1 Categoría</button>
              <button className={step === 2 ? 'current' : step > 2 ? 'done' : ''} onClick={() => goToStep(2)}>2 Detalles</button>
              <button className={step === 3 ? 'current' : ''} onClick={() => goToStep(3)}>3 Confirmación</button>
            </div>
            {step === 1 && <div className="ux-surface">
              <h3>Elegí el tipo de servicio</h3>
              <div className="ux-categories ux-request-grid">{visualCategories.map(c =>
                <button className={'ux-category ' + (draft.category === c.name ? 'ux-chosen' : '')} key={c.name} onClick={() => setDraft(d => ({ ...d, category: c.name, categoryId: c.id }))}>
                  <span className={'ux-category-icon ' + c.tone}>{c.icon}</span>
                  <strong>{c.name}</strong></button>)}</div>
              <p className="ux-note">Seleccionaste <strong>{draft.category}</strong>{realCats.length ? ' (categoría real de UGO, con matching).' : '.'}</p>
              <div className="ux-action-row">
                <button className="ux-secondary" onClick={() => go('home')}>Volver</button>
                <button className="ux-primary" onClick={() => setStep(2)}>Continuar →</button>
              </div>
            </div>}
            {step === 2 && <form className="ux-surface" onSubmit={continueToReview}>
              <h3>Detalles del trabajo</h3>
              <div className="ux-form-grid">
                <label>¿Qué necesitás? <input value={draft.title} maxLength={90} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Ej.: Cambiar la llave de agua de la cocina" /></label>
                <label>Contanos un poco más <textarea value={draft.details} maxLength={600} rows={4} onChange={e => setDraft(d => ({ ...d, details: e.target.value }))} placeholder="Medidas, materiales, horarios preferidos..." /></label>
                <fieldset className="ux-fieldset">
                  <legend>¿Para cuándo lo necesitás?</legend>
                  <div className="ux-radio-row">{urgencyOptions.map(option =>
                    <label key={option.value} className={draft.urgency === option.value ? 'ux-radio-chosen' : ''}>
                      <input type="radio" name="urgency" value={option.value} checked={draft.urgency === option.value} onChange={() => setDraft(d => ({ ...d, urgency: option.value }))} />
                      {option.label}</label>)}</div>
                </fieldset>
                <label>¿Dónde será el servicio?
                  <select value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}>
                    <option value="">Elegir después</option>
                    {places.map(place => <option key={place.id} value={`${place.etiqueta} · ${place.direccion}`}>{place.etiqueta} · {place.direccion}</option>)}
                  </select>
                </label>
              </div>
              <div className="ux-action-row">
                <button type="button" className="ux-secondary" onClick={() => setStep(1)}>← Volver</button>
                <button type="submit" className="ux-primary">Revisar →</button>
              </div>
            </form>}
            {step === 3 && <div className="ux-surface">
              <h3>Revisá tu solicitud</h3>
              <dl className="ux-summary">
                <div><dt>Categoría</dt><dd>{draft.category}</dd></div>
                <div><dt>Trabajo</dt><dd>{draft.title}</dd></div>
                {draft.details && <div><dt>Detalles</dt><dd>{draft.details}</dd></div>}
                <div><dt>Urgencia</dt><dd>{urgencyLabel(draft.urgency)}</dd></div>
                <div><dt>Dónde</dt><dd>{draft.address || 'A definir'}</dd></div>
              </dl>
              <p className="ux-note">Al solicitar, se crea tu pedido real en UGO TEST (estado <strong>buscando</strong>) y se ejecuta <strong>iniciar_matching</strong> para conseguir profesionales.</p>
              <div className="ux-action-row">
                <button className="ux-secondary" onClick={() => setStep(2)}>← Editar detalles</button>
                <div className="ux-action-group">
                  <button className="ux-secondary" onClick={clearDraft}>Descartar</button>
                  <button className="ux-secondary" onClick={saveDraft}>Guardar borrador</button>
                  <button className="ux-primary" disabled={busy || !session} title={!session ? 'Ingresá a tu cuenta para solicitar' : undefined} onClick={() => void submitRequest()}>
                    {busy ? 'Enviando…' : 'Solicitar ahora →'}
                  </button>
                </div>
              </div>
              {!session && <p className="ux-note">Ingresá a tu cuenta para enviar el pedido: <a className="ux-link" href="./">Ingresar →</a></p>}
            </div>}
          </div>}

          {view === 'activity' && <ClientActivity session={session} onNewRequest={() => startRequest(draft.category)} />}

          {view === 'profile' && <ClientProfile session={session} />}

          {view === 'active' && (focusOrder
            ? <ActiveJobConsole order={focusOrder} session={session} onChanged={() => reloadOrders()} onGoActivity={() => go('activity')} />
            : <div className="ux-surface">
              <span className="ux-subtitle">SEGUIMIENTO</span>
              <h2>Servicio en curso</h2>
              <p>No tenés servicios activos. Solicitá un servicio y hace el seguimiento desde acá.</p>
              <div className="ux-action-group">
                <button className="ux-secondary" onClick={() => go('activity')}>Ver mis pedidos →</button>
                <button className="ux-primary" onClick={() => startRequest(draft.category)}>Solicitar servicio →</button>
              </div>
            </div>)}

          {view === 'payments' && <PaymentsView session={session} />}
        </div>}
        {notice && <div className="ux-alert" role="alert">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar alerta">×</button></div>}
      </main>
    </div>
    <nav className="ux-mobile-nav" aria-label="Navegación móvil">
      {([navigation[0], navigation[1], navigation[3], navigation[5]]).map(item =>
        <button key={item.id} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
          <span>{item.icon}</span><small>{item.label}</small></button>)}
      <button className="ux-mobile-add" onClick={() => startRequest('Plomería')} aria-label="Nuevo servicio">＋</button>
    </nav>
  </div>
}

// ============================================================
// Consola del servicio activo (seguimiento, pago, aprobación)
// ============================================================

const lifecycle = ['buscando', 'ofrecido', 'asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'completado']
const lifecycleLabels: Record<string, string> = {
  buscando: 'Buscando', ofrecido: 'Ofrecido', asignado: 'Asignado', en_camino: 'En camino',
  llegado: 'Llegado', en_progreso: 'En progreso', esperando_aprobacion: 'Esperando aprobación', completado: 'Completado',
}

function ActiveJobConsole({ order, session, onChanged, onGoActivity }: { order: ClientOrder; session: Session | null; onChanged: () => void; onGoActivity: () => void }) {
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState<ServicePayment | null>(null)
  const [cashEnabled, setCashEnabled] = useState(false)
  const [tracking, setTracking] = useState<{ lat: number | null; lng: number | null; captured_at?: string | null } | null>(null)
  const [review, setReview] = useState<{ puntuacion: number; comentario?: string | null } | null>(null)
  const [stars, setStars] = useState(5)
  const [comment, setComment] = useState('')

  const metadata = (order.metadata ?? {}) as { trabajo_aprobado_at?: string }
  const approved = Boolean(metadata.trabajo_aprobado_at)
  const currentIndex = lifecycle.indexOf(order.estado)

  useEffect(() => {
    loadServicePayment(order.id).then(setPayment).catch(() => {})
    cashPaymentEnabled(order.moneda ?? 'BRL').then(setCashEnabled)
    loadMyReview(order.id, 'cliente').then(setReview)
  }, [order.id, order.moneda])

  useEffect(() => {
    if (!['en_camino', 'llegado'].includes(order.estado)) return
    getServiceTracking(order.id).then(setTracking).catch(() => setTracking(null))
  }, [order.id, order.estado])

  async function run(action: () => Promise<void>, ok: string) {
    if (busy) return
    setBusy(true); setNotice('')
    try {
      await action()
      setNotice(ok)
      onChanged()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'La operación fue rechazada.')
    } finally {
      setBusy(false)
    }
  }

  function chooseMethod(metodo: string) {
    void run(() => selectPaymentMethod(order.id, metodo), `Forma de pago guardada: ${metodo}.`)
      .then(() => loadServicePayment(order.id).then(setPayment).catch(() => {}))
  }

  function sendReview() {
    if (!session) return
    void run(() => rateService({
      servicioId: order.id, clienteId: session.user.id, proveedorId: order.proveedor_id ?? null,
      autorTipo: 'cliente', puntuacion: stars, comentario: comment,
    }), '¡Gracias por tu calificación!')
      .then(() => loadMyReview(order.id, 'cliente').then(setReview))
  }

  return <>
    <div className="ux-surface">
      <div className="ux-section-title ux-section-tight">
        <div>
          <span className="ux-subtitle">SERVICIO #{String(order.numero ?? order.id.slice(0, 8))}</span>
          <h2>{order.descripcion || 'Servicio'}</h2>
          {order.programado_para && <p>Programado: {formatOrderDate(order.programado_para)}</p>}
        </div>
        <span className={'ux-chip ux-chip-' + orderTone(order.estado)}>{order.estado}</span>
      </div>
      <div className="uxp-steps">{lifecycle.map((state, index) =>
        <span key={state} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}>{lifecycleLabels[state]}</span>)}</div>
      {order.tarifa != null && <dl className="ux-summary">
        <div><dt>Tarifa</dt><dd>{order.tarifa} {order.moneda ?? 'BRL'}</dd></div>
      </dl>}

      <div className="ux-action-group">
        {['buscando', 'ofrecido'].includes(order.estado) &&
          <button className="ux-secondary" disabled={busy} onClick={() => {
            if (window.confirm('¿Cancelar este pedido?')) void run(() => cancelClientService(order.id, session?.user.id ?? ''), 'Pedido cancelado.').then(onChanged)
          }}>Cancelar pedido</button>}
        {order.estado === 'asignado' && !payment?.metodo &&
          <span className="client-muted">Elegí la forma de pago para continuar.</span>}
        {order.estado === 'asignado' && payment?.metodo &&
          <span className="client-muted">Pago: {payment.metodo} ({payment.estado}). El proveedor va a iniciar el camino.</span>}
        {order.estado === 'esperando_aprobacion' && !approved &&
          <button className="ux-primary" disabled={busy} onClick={() => void run(() => approveService(order.id), 'Trabajo aprobado. Ahora confirmá el pago si corresponde.')}>Aprobar trabajo →</button>}
        {order.estado === 'esperando_aprobacion' && approved && payment?.metodo === 'efectivo' &&
          <button className="ux-primary" disabled={busy} onClick={() => void run(() => confirmCashPayment(order.id), 'Pago en efectivo confirmado. ¡Servicio completado!')}>Ya pagué (efectivo) →</button>}
        {order.estado === 'esperando_aprobacion' && approved && payment?.metodo !== 'efectivo' &&
          <span className="client-muted">Trabajo aprobado. La liberación del pago electrónico la procesa UGO.</span>}
      </div>
    </div>

    {['en_camino', 'llegado'].includes(order.estado) && <div className="ux-surface uxp-payment-strip">
      <span className="ux-subtitle">SEGUIMIENTO EN VIVO</span>
      <h2>{tracking?.lat != null ? `Profesional cerca de ${Number(tracking.lat).toFixed(4)}, ${Number(tracking.lng).toFixed(4)}` : 'Ubicación no disponible todavía'}</h2>
      <p>{tracking?.captured_at ? `Última actualización: ${formatOrderDate(tracking.captured_at)}` : 'Cuando el profesional comparta su ubicación GPS va a aparecer acá (ventana de frescura de 30 segundos).'}</p>
      <button className="ux-secondary" disabled={busy} onClick={() => {
        setBusy(true)
        getServiceTracking(order.id).then(setTracking).catch(() => setTracking(null)).finally(() => setBusy(false))
      }}>Actualizar ubicación</button>
    </div>}

    {order.estado === 'asignado' && <div className="ux-surface uxp-payment-strip">
      <span className="ux-subtitle">FORMA DE PAGO</span>
      <h2>¿Cómo querés pagar?</h2>
      <p>El método queda bloqueado mientras el servicio siga activo (contrato payment_method_lock).</p>
      <div className="ux-radio-row">
        {cashEnabled && <label className={payment?.metodo === 'efectivo' ? 'ux-radio-chosen' : ''}>
          <input type="radio" name="paymethod" checked={payment?.metodo === 'efectivo'} onChange={() => chooseMethod('efectivo')} disabled={busy} /> Efectivo (al finalizar)</label>}
        <label className={payment?.metodo === 'pix' ? 'ux-radio-chosen' : ''}>
          <input type="radio" name="paymethod" checked={payment?.metodo === 'pix'} onChange={() => chooseMethod('pix')} disabled={busy} /> Pix</label>
        <label className={payment?.metodo === 'tarjeta' ? 'ux-radio-chosen' : ''}>
          <input type="radio" name="paymethod" checked={payment?.metodo === 'tarjeta'} onChange={() => chooseMethod('tarjeta')} disabled={busy} /> Tarjeta / electrónico</label>
      </div>
    </div>}

    {order.estado === 'completado' && <div className="ux-surface uxp-payment-strip">
      <span className="ux-subtitle">CALIFICACIÓN</span>
      <h2>{review ? 'Tu calificación' : '¿Cómo fue el servicio?'}</h2>
      {review
        ? <p>{'★'.repeat(review.puntuacion)}{'☆'.repeat(5 - review.puntuacion)} {review.comentario ? `· ${review.comentario}` : ''}</p>
        : <>
          <div className="uxp-stars">{[1, 2, 3, 4, 5].map(value =>
            <button key={value} className={value <= stars ? 'on' : ''} onClick={() => setStars(value)} aria-label={`${value} estrellas`}>★</button>)}</div>
          <label className="uxp-primary-cat">Comentario (opcional)
            <input value={comment} maxLength={500} onChange={e => setComment(e.target.value)} placeholder="Contá cómo fue la experiencia" />
          </label>
          <button className="ux-primary" disabled={busy} onClick={sendReview}>Enviar calificación</button>
        </>}
    </div>}

    {session && ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'disputado', 'completado'].includes(order.estado) &&
      <ServiceJobTools serviceId={order.id} serviceEstado={order.estado} session={session} actor="cliente" />}

    <div className="ux-action-group" style={{ marginTop: 16 }}>
      <button className="ux-secondary" onClick={onGoActivity}>Ver todos mis pedidos →</button>
    </div>
    {notice && <div className="ux-alert" role="alert">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar alerta">×</button></div>}
  </>
}

function PaymentsView({ session }: { session: Session | null }) {
  const [payments, setPayments] = useState<ServicePayment[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!session) { setLoaded(true); return }
    loadClientPayments(session.user.id)
      .then(list => { setPayments(list); setError('') })
      .catch(err => setError(err instanceof Error ? err.message : 'No pudimos cargar tus pagos.'))
      .finally(() => setLoaded(true))
  }, [session])

  return <section className="client-panel">
    <span className="client-kicker">PAGOS REALES</span><h1>Mis pagos</h1>
    {!session
      ? <p>Ingresá para ver tus pagos. <a href="./">Ingresar</a></p>
      : !loaded
        ? <p role="status">Cargando pagos...</p>
        : error
          ? <p role="alert">{error}</p>
          : payments.length === 0
            ? <div className="ux-empty"><span className="ux-empty-icon">▣</span>
              <strong>Sin pagos todavía</strong>
              <p>Los pagos de tus servicios van a aparecer acá con su estado real.</p></div>
            : <ul className="client-order-list">{payments.map(payment =>
              <li key={payment.id} className="ux-order-row">
                <div className="ux-order-main">
                  <strong>{payment.monto_bruto != null ? `${payment.monto_bruto} ${payment.moneda ?? 'BRL'}` : 'Pago'} · {payment.metodo || 'método a definir'}</strong>
                  <small>Servicio {payment.servicio_id?.slice(0, 8) ?? '—'}{payment.created_at ? ` · ${formatOrderDate(payment.created_at)}` : ''}</small>
                </div>
                <span className={'ux-chip ux-chip-' + orderTone(payment.estado)}>{payment.estado}</span>
              </li>)}</ul>}
    <p className="client-muted">Estados reales del contrato de pagos UGO (pendiente → autorizado → retenido → liberado). El cobro en efectivo lo confirmás vos desde el servicio activo.</p>
  </section>
}
