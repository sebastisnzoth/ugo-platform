import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Service = { icon: string; name: string; detail: string; color: string }
const services: Service[] = [
  { icon: '🔧', name: 'Reparaciones', detail: 'Electricidad, plomería y mantenimiento', color: 'peach' },
  { icon: '🧹', name: 'Limpieza', detail: 'Hogares, oficinas y espacios', color: 'mint' },
  { icon: '🎨', name: 'Hogar y obra', detail: 'Pintura, montaje y reformas', color: 'lavender' },
  { icon: '💻', name: 'Tecnología', detail: 'Computación, redes y soporte', color: 'blue' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [role, setRole] = useState('cliente')
  const [search, setSearch] = useState('')
  const [adminRole, setAdminRole] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Si la cuenta que inició sesión es administrativa, ofrecemos la entrada al panel.
  useEffect(() => {
    let alive = true
    const userId = session?.user.id
    if (!userId) {
      setAdminRole(null)
      return
    }
    supabase
      .from('usuarios')
      .select('tipo,activo')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const tipo = String((data as { tipo?: string } | null)?.tipo || '')
        const activo = Boolean((data as { activo?: boolean } | null)?.activo)
        setAdminRole(activo && ['admin', 'superadmin'].includes(tipo) ? tipo : null)
      })
    return () => {
      alive = false
    }
  }, [session?.user.id])

  const adminPanelHref = `${window.location.pathname}?app=${adminRole === 'superadmin' ? 'superadmin' : 'admin'}&section=overview`

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { setMessage(error.message); return }
    const userId = data.session?.user.id
    const { data: profile } = userId
      ? await supabase.from('usuarios').select('tipo,activo').eq('id', userId).maybeSingle()
      : { data: null }
    const tipo = String((profile as { tipo?: string } | null)?.tipo || '')
    const activo = Boolean((profile as { activo?: boolean } | null)?.activo)
    if (activo && ['admin', 'superadmin'].includes(tipo)) {
      setAdminRole(tipo)
      setAuthOpen(false)
      setMessage(`Sesión de ${tipo === 'superadmin' ? 'super admin' : 'administrador'} iniciada. Usá “Panel admin” en la barra superior.`)
      return
    }
    setMessage('Sesión iniciada correctamente.')
  }

  async function signUp(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { tipo: role, role } } })
    setBusy(false)
    setMessage(error ? error.message : 'Cuenta creada. Si el proyecto lo requiere, revisá tu correo para confirmar el registro.')
  }

  const filtered = services.filter((service) => `${service.name} ${service.detail}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#inicio" aria-label="UGO inicio"><span className="brand-mark">u</span><span>ugo<span className="brand-dot">.</span></span></a><nav className="desktop-nav"><a href="#servicios">Servicios</a><a href="#como-funciona">Cómo funciona</a><a href="#profesionales">Profesionales</a></nav><div className="top-actions">{session ? <>{adminRole && <a className="button button-dark" href={adminPanelHref}>Panel admin <span>↗</span></a>}<span className="signed-in">{session.user.email}</span><button className="button button-light" onClick={() => supabase.auth.signOut()}>Salir</button></> : <><button className="button button-light login" onClick={() => {setAuthOpen(true);setMessage('')}}>Ingresar</button><button className="button button-dark" onClick={() => {setAuthOpen(true);setMessage('')}}>Crear cuenta <span>↗</span></button></>}</div></header>
    <main id="inicio"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> SERVICIOS QUE TE LO HACEN FÁCIL</div><h1>Lo que necesitás.<br/><span>Resuelto.</span></h1><p className="hero-text">Encontrá profesionales confiables para tu hogar y tu día a día. Pedí ayuda, compará opciones y elegí con tranquilidad.</p><div className="hero-buttons"><a className="button button-dark button-large" href="#servicios">Encontrar un profesional <span>↗</span></a><a className="text-link" href="#como-funciona">¿Cómo funciona? <span>↓</span></a></div><div className="trust-row"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><div><strong>Una forma más simple de resolver</strong><small>Tu próximo servicio empieza acá</small></div></div></div><div className="hero-art"><div className="sun-shape"/><div className="art-card card-top"><span className="tiny-icon">✳</span><span><b>Tu tiempo vale</b><small>Dejá el trabajo en buenas manos</small></span></div><div className="person-illustration"><div className="person-hair"/><div className="person-head"/><div className="person-body"/><div className="person-arm"/><div className="toolbox"><span>UGO</span></div></div><div className="art-card card-bottom"><span className="check-icon">✓</span><span><b>Un profesional para vos</b><small>Encontrá la ayuda que necesitás</small></span></div><span className="sparkle sparkle-one">✳</span><span className="sparkle sparkle-two">✦</span></div></section>
    <section className="service-section" id="servicios"><div className="section-heading"><div><div className="eyebrow">TODO EMPIEZA POR ACÁ</div><h2>¿Qué necesitás resolver?</h2><p>Encontrá el servicio ideal para vos.</p></div><label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar un servicio..." aria-label="Buscar un servicio"/></label></div><div className="service-grid">{filtered.map((service) => <button className="service-card" key={service.name} onClick={() => {setSearch(service.name);setMessage(`Elegiste ${service.name}. Próximo paso: conectar el catálogo de profesionales.`)}}><span className={`service-icon ${service.color}`}>{service.icon}</span><span className="service-name">{service.name}</span><span className="service-detail">{service.detail}</span><span className="service-arrow">↗</span></button>)}</div>{filtered.length === 0 && <p className="empty-state">No encontramos ese servicio. Probá con otra búsqueda.</p>}</section>
    <section className="steps-section" id="como-funciona"><div className="eyebrow">SIMPLE, DE PRINCIPIO A FIN</div><h2>Resolverlo es así de fácil.</h2><div className="steps-grid"><article><span className="step-number">01</span><h3>Contanos qué necesitás</h3><p>Elegí un servicio y describí tu trabajo.</p></article><article><span className="step-number">02</span><h3>Encontrá a tu profesional</h3><p>Revisá opciones y elegí la que te cierre.</p></article><article><span className="step-number">03</span><h3>Coordiná y listo</h3><p>Organizá el trabajo con tranquilidad.</p></article></div></section>
    <section className="pro-banner" id="profesionales"><div><div className="eyebrow">¿SOS PROFESIONAL?</div><h2>Tu próximo cliente puede estar acá.</h2><p>Sumate a UGO y acercá tus servicios a más personas.</p></div><button className="button button-dark" onClick={() => {setRole('proveedor');setAuthOpen(true);setMessage('')}}>Quiero ofrecer mis servicios <span>↗</span></button></section></main>
    <footer><a className="brand footer-brand" href="#inicio"><span className="brand-mark">u</span><span>ugo<span className="brand-dot">.</span></span></a><span>Menos vueltas. Más resuelto.</span><a className="footer-admin" href={`${window.location.pathname}?app=admin`}>Acceso admin ↗</a><span>© 2026 UGO</span></footer>
    {message && !authOpen && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Cerrar">×</button></div>}
    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Cerrar">×</button><div className="eyebrow">BIENVENIDO A UGO</div><h2>Empezá por acá.</h2><p>Ingresá a tu cuenta o creá una nueva.</p><form onSubmit={signIn}><label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@correo.com"/></label><label>Contraseña<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label><button className="button button-dark submit-button" disabled={busy}>{busy ? 'Un momento…' : 'Ingresar a mi cuenta'}</button></form><div className="auth-divider"><span/> o <span/></div><label className="role-label">Quiero registrarme como<select value={role} onChange={e => setRole(e.target.value)}><option value="cliente">Cliente</option><option value="proveedor">Profesional</option></select></label><button className="button button-outline submit-button" disabled={busy || !email || password.length < 6} onClick={signUp}>{busy ? 'Un momento…' : 'Crear cuenta'}</button>{message && <p className="auth-message" role="status">{message}</p>}<small className="auth-note">La cuenta se valida con el sistema de autenticación de Supabase existente.</small></section></div>}
  </div>
}
