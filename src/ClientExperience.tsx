import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ClientProfile from './ClientProfile'
import ClientActivity from './ClientActivity'
import './client-zip-design.css'
import './client-screenshot-fidelity.css'

type View = 'home'|'explore'|'request'|'active'|'activity'|'payments'|'profile'
type Item = {id:View;label:string;icon:string}
const navigation:Item[]=[
 {id:'home',label:'Inicio',icon:'⌂'},{id:'explore',label:'Explorar',icon:'⌕'},
 {id:'active',label:'Servicio',icon:'◈'},{id:'activity',label:'Actividad',icon:'▤'},
 {id:'payments',label:'Pagos',icon:'▣'},{id:'profile',label:'Perfil',icon:'◉'},
]
type Category = { id: string; name: string; icon: string; tone: string }
const palette = ['blue','yellow','purple','orange','cyan','pink']
export default function ClientExperience(){
 const [session,setSession]=useState<Session|null>(null)
 const [loading,setLoading]=useState(true)
 const [view,setView]=useState<View>('home')
 const [menuOpen,setMenuOpen]=useState(false)
 const [search,setSearch]=useState('')
 const [category,setCategory]=useState('')
 const [notice,setNotice]=useState('')
 const [categories,setCategories]=useState<Category[]>([])
 const [catalogLoading,setCatalogLoading]=useState(true)
 const [catalogError,setCatalogError]=useState('')
 useEffect(()=>{
  let mounted=true
  supabase.auth.getSession().then(({data,error})=>{if(!mounted)return;setSession(data.session);setLoading(false);if(error)setNotice('No pudimos comprobar la sesión.')})
  const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next)})
  return()=>{mounted=false;listener.subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  let active=true
  const fetchCatalog=async()=>{
   setCatalogLoading(true);setCatalogError('')
   const {data,error}=await supabase.from('categorias').select('id,nombre,emoji,slug').order('nombre',{ascending:true})
   if(!active)return
   setCatalogLoading(false)
   if(error){setCategories([]);setCatalogError('No se pudo cargar el catálogo real: '+error.message);return}
   const rows=(data||[]) as {id:string;nombre:string;emoji:string|null;slug:string|null}[]
   setCategories(rows.map((row,i)=>({id:row.id,name:row.nombre,icon:row.emoji||'◈',tone:palette[i%palette.length]})))
  }
  void fetchCatalog()
  return()=>{active=false}
 },[])
 const firstCategory=categories[0]?.name||''
 const filtered=useMemo(()=>categories.filter(c=>c.name.toLowerCase().includes(search.toLowerCase().trim())),[search])
 function go(next:View){setView(next);setMenuOpen(false);setNotice('');window.scrollTo({top:0,behavior:'smooth'})}
 function startRequest(name:string){if(!name){setNotice('Esperá a que carguen las categorías reales.');return}setCategory(name);go('request')}
 const titles:Record<View,string>={home:'Inicio',explore:'Explorar servicios',request:'Nuevo servicio',active:'Mi servicio',activity:'Mis actividades',payments:'Pagos',profile:'Mi perfil'}
 return <div className="uxugo">
  <a className="ux-skip" href="#ux-content">Ir al contenido</a>
  {menuOpen&&<button className="ux-backdrop" onClick={()=>setMenuOpen(false)} aria-label="Cerrar menú"/>}
  <aside className={'ux-sidebar '+(menuOpen?'ux-sidebar-open':'')}>
   <div className="ux-brand"><span>u<span>•</span>go</span><small>TODO RESUELTO.</small><button onClick={()=>setMenuOpen(false)} className="ux-close" aria-label="Cerrar menú">×</button></div>
   <button className="ux-new" onClick={()=>startRequest(firstCategory)}>＋ Nuevo servicio</button>
   <div className="ux-nav-caption">MENÚ</div>
   <nav className="ux-side-links" aria-label="Navegación principal">{navigation.map(item=><button key={item.id} className={view===item.id?'selected':''} onClick={()=>go(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
   <div className="ux-side-bottom"><div className="ux-help">◉ <span><strong>¿Necesitás ayuda?</strong><small>Centro de soporte UGO</small></span></div>
    <div className="ux-person"><span className="ux-person-symbol">◉</span><span><strong>{session?.user.email?.split('@')[0]||'Tu cuenta'}</strong><small>{session?'Cliente UGO':'Ingresá a UGO'}</small></span></div>
   </div>
  </aside>
  <div className="ux-main">
   <header className="ux-topbar"><button className="ux-menu" aria-label="Abrir menú" onClick={()=>setMenuOpen(true)}>☰</button>
    <div className="ux-topcopy"><h1>{titles[view]}</h1><p>¿Qué necesitás resolver hoy?</p></div>
    <div className="ux-top-right"><span className="ux-location">⌖ Canasvieiras, Floripa</span><span className="ux-avatar" title={session?.user.email||'Sin iniciar sesión'}>◉</span></div>
   </header>
   <main id="ux-content" className="ux-content">
    {loading?<div className="ux-surface" role="status">Cargando tu cuenta...</div>:<>
    {view==='home'&&<>
     <section className="ux-hero"><div className="ux-hero-text"><span className="ux-pill">✧ PROFESIONALES DE CONFIANZA</span><h2>Tu casa en buenas manos.</h2>
      <p>Contanos qué necesitás. Encontramos al profesional indicado, cerca de ti y con garantía UGO.</p><button onClick={()=>startRequest('Plomería')} className="ux-primary">Solicitar un servicio →</button>
      <span className="ux-trust">♧ Garantía UGO　◷ Respuesta rápida　✧ Expertos verificados</span></div>
      <div className="ux-hero-art" aria-hidden="true"><span className="ux-hero-ring ux-ring-one"/><span className="ux-hero-ring ux-ring-two"/><img className="ux-hero-photo" src="https://images.pexels.com/photos/7562139/pexels-photo-7562139.jpeg?auto=compress&cs=tinysrgb&w=520" alt="" loading="lazy"/><div className="ux-floating"><strong>✓ Profesionales verificados</strong><small>UGO · servicios reales</small></div></div>
     </section>
     <div className="ux-section-title"><div><h2>¿Qué necesitás hoy?</h2><p>Soluciones para tu hogar, en un solo lugar</p></div><button className="ux-link" onClick={()=>go('explore')}>Ver todas →</button></div>
     {catalogLoading&&<p role="status">Cargando categorías de UGO TEST...</p>}
     {catalogError&&<p role="alert">{catalogError}</p>}
     {!catalogLoading&&!catalogError&&categories.length===0&&<p>No hay categorías disponibles en UGO TEST.</p>}
     <div className="ux-categories">{categories.map(c=><button key={c.name} className="ux-category" onClick={()=>startRequest(c.name)}><span className={'ux-category-icon '+c.tone}>{c.icon}</span><strong>{c.name}</strong><small>Profesionales cerca →</small></button>)}</div>
     <section className="ux-bottom-row ux-bottom-single"><div className="ux-surface ux-progress"><span className="ux-subtitle">● TU SERVICIO</span><h2>Consultá el estado de tus solicitudes</h2><p>Revisá tus pedidos y el profesional asignado cuando UGO TEST confirme la información. No se muestran llegadas ni trabajos de demostración.</p><button className="ux-link" onClick={()=>go('activity')}>Ver detalle →</button></div></section>
     <section className="ux-support"><span aria-hidden="true">◎</span><div><strong>¿Una urgencia?</strong><p>Soporte UGO disponible desde los canales oficiales.</p></div><button className="ux-link" onClick={()=>setNotice('El contacto con soporte está pendiente de conectar a UGO TEST.')}>Contactar →</button></section>
    </>}
    {view==='explore'&&<><div className="ux-section-title"><div><h2>Explorar profesionales</h2><p>Encontrá el servicio que buscás</p></div></div>
      <label className="ux-search">⌕ <input placeholder="Buscar plomería, electricidad, limpieza..." value={search} onChange={e=>setSearch(e.target.value)} aria-label="Buscar categorías"/></label>
      {catalogLoading&&<p role="status">Cargando categorías...</p>}
      {catalogError&&<p role="alert">{catalogError}</p>}
      <div className="ux-categories">{filtered.map(c=><button key={c.name} className="ux-category" onClick={()=>startRequest(c.name)}><span className={'ux-category-icon '+c.tone}>{c.icon}</span><strong>{c.name}</strong><small>Consultar →</small></button>)}</div>
      {filtered.length===0&&<div className="ux-surface">No se encontraron categorías visuales con ese nombre.</div>}
      <div className="ux-surface ux-warning"><strong>Disponibilidad real de profesionales</strong><p>La búsqueda y los resultados por ubicación se mostrarán cuando se valide el matching en UGO TEST. No mostramos profesionales inventados.</p></div>
    </>}
    {view==='request'&&<div className="ux-request"><span className="ux-subtitle">NUEVA SOLICITUD</span><h2>Contanos qué necesitás</h2>
     <div className="ux-stepper"><span className="current">1 Categoría</span><span>2 Detalles</span><span>3 Confirmación</span></div>
     <div className="ux-surface"><h3>Elegí el tipo de servicio</h3><div className="ux-categories ux-request-grid">{categories.map(c=><button className={'ux-category '+(category===c.name?'ux-chosen':'')} key={c.name} onClick={()=>setCategory(c.name)}><span className={'ux-category-icon '+c.tone}>{c.icon}</span><strong>{c.name}</strong></button>)}</div>
     {catalogError&&<p role="alert">{catalogError}</p>}
     <p className="ux-note">Seleccionaste <strong>{category}</strong>. El envío del pedido queda deshabilitado hasta conectar y probar el contrato de creación de servicios de UGO TEST. No se creará una solicitud ficticia.</p>
     <div className="ux-action-row"><button className="ux-secondary" onClick={()=>go('home')}>Volver</button><button className="ux-primary" disabled title="Contrato de creación de pedidos aún sin verificar">Continuar →</button></div></div></div>}
    {view==='activity'&&<ClientActivity session={session}/>}
    {view==='profile'&&<ClientProfile session={session}/>}
    {view==='active'&&<div className="ux-surface"><span className="ux-subtitle">SEGUIMIENTO</span><h2>Servicio en curso</h2><p>Revisá la actividad para ver tus pedidos reales. El mapa y el seguimiento se habilitarán tras validar GPS y los eventos de estados de UGO TEST.</p><button className="ux-secondary" onClick={()=>go('activity')}>Ver mis pedidos →</button></div>}
    {view==='payments'&&<div className="ux-surface"><span className="ux-subtitle">MIS PAGOS</span><h2>Tu billetera UGO</h2><p>Los métodos y movimientos se conectarán al contrato de pagos existente. No mostramos saldos, cargos ni operaciones ficticias.</p><button className="ux-secondary" onClick={()=>go('profile')}>Ir a mi perfil →</button></div>}
    </>}
    {notice&&<div className="ux-alert" role="alert">{notice}<button onClick={()=>setNotice('')} aria-label="Cerrar alerta">×</button></div>}
   </main>
  </div>
  <nav className="ux-mobile-nav" aria-label="Navegación móvil">{([navigation[0],navigation[1],navigation[3],navigation[5]]).map(item=><button key={item.id} className={view===item.id?'active':''} onClick={()=>go(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}<button className="ux-mobile-add" onClick={()=>startRequest('Plomería')} aria-label="Nuevo servicio">＋</button></nav>
 </div>
}
