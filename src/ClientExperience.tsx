import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './client-experience.css'

type View = 'home' | 'services' | 'activity' | 'profile'
const services = [
  { icon: '⚡', label: 'Electricidad' },
  { icon: '🔧', label: 'Plomería' },
  { icon: '🧹', label: 'Limpieza' },
  { icon: '🎨', label: 'Pintura' },
]

/** Initial, non-destructive client shell ported from the UGO flow reference.
 * Only Supabase Auth operations are live. Never represent demo orders as real.
 */
export default function ClientExperience() {
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
      if (error) setNotice('No pudimos verificar tu sesión. Volvé a ingresar.')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  const matches = useMemo(() => services.filter(s => s.label.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es'))), [term])
  function requestService(service: string) {
    setSelected(service)
    setNotice('La solicitud de ' + service + ' aún no está conectada al contrato de pedidos de UGO TEST. No se creó ningún pedido.')
    setView('services')
  }

  return <div className="ugo-client">
    <div className="client-layout">
      <header className="client-top">
        <a href="./" className="client-logo" aria-label="UGO - sitio principal">ugo<span>.</span></a>
        <span className="client-area">⌖ Florianópolis · UGO TEST</span>
        <a className="client-account-link" href="./">{session ? 'Mi cuenta' : 'Ingresar'}</a>
      </header>
      <main id="client-main" className="client-page">
        {loading ? <p role="status">Verificando sesión...</p> : <>
          {view === 'home' && <>
            <section className="client-welcome">
              <span className="client-kicker">SERVICIOS CERCA DE VOS</span>
              <h1>¿Qué necesitás <em>resolver?</em></h1>
              <p>Un pedido. Un profesional. Sin vueltas.</p>
              <label className="client-search-label">Buscar un servicio
                <input value={term} onChange={e => setTerm(e.target.value)} placeholder="⌕  Buscar plomero, pintor..." />
              </label>
            </section>
            <section aria-label="Servicios">
              <h2>Servicios cerca de vos</h2>
              <div className="client-tiles">
                {matches.map(s => <button key={s.label} className="client-tile" onClick={() => requestService(s.label)}>
                  <span className="client-icon">{s.icon}</span><span>{s.label}</span><span aria-hidden="true">↗</span>
                </button>)}
              </div>
              {matches.length === 0 && <p>No encontramos esa categoría en el catálogo visual.</p>}
            </section>
            <section className="client-panel">
              <h2>Tu próximo servicio empieza acá</h2>
              <p>El diseño ya está disponible. La creación de pedidos se habilitará cuando quede conectado y probado el contrato real de UGO TEST.</p>
              <button className="client-primary" onClick={() => setView('services')}>Explorar servicios →</button>
            </section>
          </>}
          {view === 'services' && <section>
            <span className="client-kicker">CATEGORÍAS</span>
            <h1>Encontrá un servicio</h1>
            <p>Seleccioná una categoría para iniciar tu solicitud cuando esté conectada.</p>
            <div className="client-tiles">
              {services.map(s => <button key={s.label} className="client-tile" aria-pressed={selected === s.label} onClick={() => requestService(s.label)}>
                <span className="client-icon">{s.icon}</span><span>{s.label}</span><span aria-hidden="true">↗</span>
              </button>)}
            </div>
          </section>}
          {view === 'activity' && <section className="client-panel"><span className="client-kicker">ACTIVIDAD</span>
            <h1>Mis pedidos</h1><p>El historial de pedidos reales se mostrará cuando se integre y verifique la consulta autorizada de UGO TEST.</p>
            <p className="client-muted">No mostramos servicios inventados ni estados simulados.</p>
          </section>}
          {view === 'profile' && <section className="client-panel"><span className="client-kicker">MI PERFIL</span>
            <h1>Tu cuenta</h1>
            {session ? <>
              <p>Sesión activa</p><p><strong>Email:</strong> {session.user.email ?? 'Sin email registrado'}</p>
              <button className="client-secondary" onClick={async () => {
                const { error } = await supabase.auth.signOut()
                if (error) setNotice('No se pudo cerrar la sesión. Intentá nuevamente.')
                else setNotice('Sesión cerrada correctamente.')
              }}>Cerrar sesión</button>
            </> : <><p>Para administrar tu perfil, ingresá con tu cuenta real de UGO.</p><a className="client-primary client-inline-link" href="./">Ingresar o crear cuenta</a></>}
            <p className="client-muted">La edición de datos y direcciones se conectará tras verificar los contratos del perfil.</p>
          </section>}
        </>}
        {notice && <div className="client-alert" role="status"><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Cerrar mensaje">×</button></div>}
      </main>
      <nav className="client-bottom" aria-label="Navegación Cliente">
        {([['home', '⌂', 'Inicio'], ['activity', '▤', 'Actividad'], ['services', '⌕', 'Servicios'], ['profile', '◉', 'Perfil']] as const).map(([id, icon, label]) =>
          <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setNotice('') }}><span>{icon}</span>{label}</button>
        )}
      </nav>
    </div>
  </div>
}
