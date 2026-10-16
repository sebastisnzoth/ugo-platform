import {useEffect,useState,type FormEvent} from 'react'
import {Camera,ChevronLeft,ChevronRight,MapPin,ShieldCheck,Search} from 'lucide-react'
import {supabase} from './supabase'
import {createOwnedClientOrder,recoverOrNewDraftId,uploadDraftEvidence,draftStorageKey,dispatchOwnedClientOrder,readOwnedOrderStatus,orderStorageKey,type OrderStatus} from './clientOrderService'

type Category={id:string;nombre:string;emoji:string|null}
type Props={initialCategory:string;onBack:()=>void}
export default function ClientRequestForm({initialCategory,onBack}:Props){
 const [categories,setCategories]=useState<Category[]>([])
 const [authUser,setAuthUser]=useState<string|null>(null)
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [authBusy,setAuthBusy]=useState(false)
 const [authMessage,setAuthMessage]=useState('')
 useEffect(()=>{
  let active=true
  void supabase.auth.getUser().then(({data})=>{if(active)setAuthUser(data.user?.email||null)})
  const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>setAuthUser(session?.user.email||null))
  return()=>{active=false;listener.subscription.unsubscribe()}
 },[])
 async function login(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setAuthBusy(true);setAuthMessage('')
  const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
  setAuthBusy(false)
  if(error)setAuthMessage('No pudimos iniciar sesión: '+error.message)
  else {setAuthMessage('Sesión conectada con UGO TEST. Ya podés continuar con el pedido.');setPassword('')}
 }
 async function register(){
  setAuthBusy(true);setAuthMessage('')
  const {error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{tipo:'cliente',role:'cliente'}}})
  setAuthBusy(false);setAuthMessage(error?error.message:'Revisá tu email si UGO TEST solicita confirmar la cuenta.')
 }
 const [catalogError,setCatalogError]=useState('')
 const [catalogLoading,setCatalogLoading]=useState(true)
 const [step,setStep]=useState(1)
 const [categoryId,setCategoryId]=useState('')
 const [description,setDescription]=useState('')
 const [address,setAddress]=useState('')
 const [urgency,setUrgency]=useState('Lo antes posible')
 const [scheduledAt,setScheduledAt]=useState('')
 const [fileError,setFileError]=useState('')
 const [photos,setPhotos]=useState<File[]>([])
 const [paymentMethod,setPaymentMethod]=useState<'efectivo'|'pix'>('efectivo')
 const [busy,setBusy]=useState(false)
 const [submitError,setSubmitError]=useState('')
 const [dispatchMessage,setDispatchMessage]=useState('')
 const [dispatching,setDispatching]=useState(false)
 const [created,setCreated]=useState<{id:string;estado:string;numero:number|null}|null>(null)
 const [liveStatus,setLiveStatus]=useState<OrderStatus|null>(null)
 const [trackingError,setTrackingError]=useState('')
 useEffect(()=>{
  let active=true
  supabase.from('categorias').select('id,nombre,emoji').eq('activa',true).order('nombre').then(({data,error})=>{
   if(!active)return
   setCatalogLoading(false)
   if(error){setCatalogError('No pudimos cargar categorías de UGO TEST: '+error.message);return}
   const rows=(data||[]) as Category[]
   setCategories(rows)
   const match=rows.find(c=>c.nombre.toLocaleLowerCase('es')===initialCategory.toLocaleLowerCase('es'))
   if(match)setCategoryId(match.id)
  })
  return()=>{active=false}
 },[initialCategory])
 useEffect(()=>{
  let active=true
  const restore=async()=>{
   const {data:{user}}=await supabase.auth.getUser()
   if(!active||!user)return
   const id=sessionStorage.getItem(orderStorageKey(user.id))
   if(!id)return
   try{const row=await readOwnedOrderStatus(id);if(active){setCreated(row);setLiveStatus(row);setStep(3)}}
   catch{if(active)sessionStorage.removeItem(orderStorageKey(user.id))}
  }
  void restore()
  return()=>{active=false}
 },[])
 useEffect(()=>{
  if(!created?.id)return
  let active=true
  const refresh=async()=>{try{
   const row=await readOwnedOrderStatus(created.id)
   if(active){setLiveStatus(row);setTrackingError('')}
  }catch(error){if(active)setTrackingError(error instanceof Error?error.message:'No se pudo actualizar el estado del pedido.')}}
  void refresh()
  const interval=window.setInterval(()=>void refresh(),10000)
  const ch=supabase.channel('zip-client-service-'+created.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'servicios',filter:'id=eq.'+created.id},()=>void refresh()).subscribe()
  return()=>{active=false;window.clearInterval(interval);void supabase.removeChannel(ch)}
 },[created?.id])
 async function beginAnotherOrder(){
  const {data:{user}}=await supabase.auth.getUser()
  if(user){sessionStorage.removeItem(orderStorageKey(user.id));sessionStorage.removeItem(draftStorageKey(user.id))}
  setCreated(null);setLiveStatus(null);setDispatchMessage('');setTrackingError('');setSubmitError('')
  setCategoryId('');setDescription('');setAddress('');setPhotos([]);setScheduledAt('');setUrgency('Lo antes posible');setStep(1)
 }
 async function submitOrder(){
  if(busy||created||!selected||!canDetails)return
  setBusy(true);setSubmitError('')
  try{
   const {data:{user}}=await supabase.auth.getUser()
   if(!user)throw new Error('Iniciá sesión para publicar la solicitud.')
   const draftId=recoverOrNewDraftId(user.id)
   // Upload linked evidence before creating the row; its DB trigger binds by draft id.
   if(photos.length)await uploadDraftEvidence(user.id,draftId,photos)
   const order=await createOwnedClientOrder({
    categoryId:categoryId,description,address,scheduleAt:urgency==='Elegir fecha'?new Date(scheduledAt).toISOString():null,
    paymentMethod,draftId
   })
   setCreated(order)
   sessionStorage.setItem(orderStorageKey(user.id),order.id)
   // Keep the same draft until dispatch succeeds, so refresh and retry remain safe.
  }catch(error){setSubmitError(error instanceof Error?error.message:'No se pudo guardar el pedido en UGO TEST. Reintentá sin perder el borrador.')}
  finally{setBusy(false)}
 }
 async function dispatchOrder(){
  if(!created||dispatching)return
  setDispatching(true);setSubmitError('');setDispatchMessage('')
  try{const result=await dispatchOwnedClientOrder(created.id);setDispatchMessage(result)
   const {data:{user}}=await supabase.auth.getUser()
   if(user){sessionStorage.removeItem(draftStorageKey(user.id))}
   const row=await readOwnedOrderStatus(created.id);setLiveStatus(row)
  }
  catch(error){setSubmitError(error instanceof Error?error.message:'El pedido sigue guardado, pero no pudimos iniciar la búsqueda.')}
  finally{setDispatching(false)}
 }
 const selected=categories.find(c=>c.id===categoryId)
 const scheduleValid=urgency!=='Elegir fecha'||(scheduledAt.length>0&&new Date(scheduledAt).getTime()>Date.now())
 const canDetails=description.trim().length>=10&&address.trim().length>=5&&scheduleValid
 function selectFiles(e:FormEvent<HTMLInputElement>){
  const files=Array.from(e.currentTarget.files||[])
  const invalid=files.filter(f=>!f.type.startsWith('image/')||f.size>5*1024*1024)
  setFileError(invalid.length>0?'Solo imágenes de hasta 5 MB cada una. Los archivos incompatibles fueron rechazados.':files.length>5?'Podés seleccionar como máximo cinco fotografías.':'')
  setPhotos(files.filter(f=>f.type.startsWith('image/')&&f.size<=5*1024*1024).slice(0,5))
 }
 return <div className="request-wrap">
  {!authUser?<section className="request-card"><div className="form-heading"><span><ShieldCheck size={22}/></span><div><h2>Ingresá a UGO TEST</h2><p>Para crear pedidos reales necesitás iniciar sesión.</p></div></div><form onSubmit={e=>void login(e)} className="form-grid"><label className="full"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full"><span>Contraseña</span><input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="form-actions"><button type="submit" className="primary-button" disabled={authBusy}> {authBusy?"Conectando…":"Ingresar y continuar"} </button><button type="button" className="outline-button" disabled={authBusy||!email.trim()||password.length<6} onClick={()=>void register()}>Crear cuenta Cliente</button></div></form>{authMessage&&<p role="status">{authMessage}</p>}</section>:<p role="status">Conectado a UGO TEST: {authUser} <button type="button" className="outline-button" onClick={()=>void supabase.auth.signOut()}>Salir</button></p>}
  {authUser&&<>
  <div className="stepper">{['Servicio','Detalles','Confirmación'].map((label,i)=><div key={label} className={step>=i+1?'active':''}><span>{i+1}</span><b>{label}</b>{i<2&&<i/>}</div>)}</div>
  <section className="request-card">
   {step===1&&<><div className="form-heading"><span><Search size={22}/></span><div><h2>¿Qué servicio necesitás?</h2><p>Categorías disponibles en UGO TEST.</p></div></div>
    {catalogLoading&&<p role="status">Cargando categorías reales...</p>}
    {catalogError&&<p role="alert">{catalogError}</p>}
    {!catalogLoading&&!catalogError&&categories.length===0&&<p>No hay categorías disponibles.</p>}
    <div className="category-select">{categories.map(c=><button type="button" key={c.id} className={c.id===categoryId?'selected':''} onClick={()=>setCategoryId(c.id)}><span>{c.emoji||'🔧'}</span><b>{c.nombre}</b></button>)}</div>
    <div className="form-actions split"><button className="outline-button" onClick={onBack}><ChevronLeft size={17}/> Volver</button><button className="primary-button" disabled={!selected} onClick={()=>setStep(2)}>Continuar <ChevronRight size={17}/></button></div></>}
   {step===2&&<><div className="form-heading"><span><MapPin size={22}/></span><div><h2>Contanos los detalles</h2><p>La información se conserva hasta la confirmación.</p></div></div>
    <div className="form-grid">
     <label className="full"><span>Descripción del trabajo</span><textarea required minLength={10} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describí qué necesitás resolver..."/></label>
     <label><span>¿Cuándo lo necesitás?</span><select value={urgency} onChange={e=>setUrgency(e.target.value)}><option>Lo antes posible</option><option>Hoy por la tarde</option><option>Elegir fecha</option></select></label>
     {urgency==='Elegir fecha'&&<label><span>Fecha y hora del servicio</span><input type="datetime-local" required value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>}
     <label><span>Dirección del servicio</span><input required minLength={5} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle, número y localidad"/></label>
     <label className="full"><span><Camera size={16}/> Fotos (máximo 5 archivos de 5 MB)</span><input type="file" accept="image/*" multiple onChange={selectFiles}/><small>{photos.length} archivo(s) seleccionado(s). Todavía no se suben a Storage.</small>{fileError&&<span role="alert">{fileError}</span>}</label>
    </div>
    <div className="form-actions split"><button className="outline-button" onClick={()=>setStep(1)}><ChevronLeft size={17}/> Atrás</button><button className="primary-button" disabled={!canDetails} onClick={()=>setStep(3)}>Revisar solicitud <ChevronRight size={17}/></button></div></>}
   {step===3&&<><div className="form-heading"><span><ShieldCheck size={22}/></span><div><h2>Revisá tu solicitud</h2><p>Estos son tus datos, no ejemplos.</p></div></div>
    <div className="form-grid"><label><span>Método de pago</span><select value={paymentMethod} disabled={busy||!!created} onChange={e=>setPaymentMethod(e.target.value as 'efectivo'|'pix')}><option value="efectivo">Efectivo</option><option value="pix">PIX</option></select></label></div><div className="summary-box"><div><small>SERVICIO</small><strong>{selected?.nombre||'Sin categoría'}</strong><span>{description}</span></div><div><small>CUÁNDO</small><strong>{urgency==='Elegir fecha'?new Date(scheduledAt).toLocaleString('pt-BR'):urgency}</strong></div><div><small>DIRECCIÓN</small><strong>{address}</strong><span>{photos.length} fotos seleccionadas</span></div></div>
    <div className="estimate"><span><ShieldCheck size={20}/></span><div><strong>{created?`Pedido #${created.numero??created.id} registrado en UGO TEST`:"Confirmar pedido en UGO TEST"}</strong><p>{created?`Estado actual: ${created.estado}. Consultá Actividad para seguirlo. Usá «Iniciar búsqueda con mi GPS» para ofrecer el pedido a profesionales.`:"Confirmar guarda un pedido real. No inicia la búsqueda hasta verificar ubicación y reglas de matching."}</p></div></div>
    {submitError&&<p role="alert">{submitError}</p>}
    {dispatchMessage&&<p role="status">{dispatchMessage}</p>}
    {created&&<p role="status">Estado actual UGO TEST: <strong>{liveStatus?.estado||created.estado}</strong>{liveStatus?.proveedor_id?' · Proveedor asignado':' · Sin proveedor asignado'}</p>}
    {trackingError&&<p role="alert">{trackingError}</p>}
    {created&&<button type="button" className="outline-button" onClick={()=>void beginAnotherOrder()}>Crear otro pedido independiente</button>}
    {created&&<div className="form-actions"><button className="primary-button" disabled={dispatching||!!dispatchMessage} onClick={()=>void dispatchOrder()}>{dispatching?'Comprobando GPS y buscando…':'Iniciar búsqueda con mi GPS'}</button><small>Solo se envía tras obtener GPS reciente y guardar la ubicación en UGO TEST.</small></div>}
    <div className="form-actions split"><button className="outline-button" disabled={busy||!!created} onClick={()=>setStep(2)}><ChevronLeft size={17}/> Editar</button><button className="primary-button" disabled={busy||!!created||!canDetails} onClick={()=>void submitOrder()}>{busy?"Guardando…":created?"Pedido guardado":"Confirmar pedido"} <Search size={17}/></button></div></>}
  </section></>}
 </div>
}
