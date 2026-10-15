import {useEffect,useState,type FormEvent} from 'react'
import {Camera,ChevronLeft,ChevronRight,MapPin,ShieldCheck,Search} from 'lucide-react'
import {supabase} from './supabase'

type Category={id:string;nombre:string;emoji:string|null}
type Props={initialCategory:string;onBack:()=>void}
export default function ClientRequestForm({initialCategory,onBack}:Props){
 const [categories,setCategories]=useState<Category[]>([])
 const [catalogError,setCatalogError]=useState('')
 const [catalogLoading,setCatalogLoading]=useState(true)
 const [step,setStep]=useState(1)
 const [categoryId,setCategoryId]=useState('')
 const [description,setDescription]=useState('')
 const [address,setAddress]=useState('')
 const [urgency,setUrgency]=useState('Lo antes posible')
 const [photos,setPhotos]=useState<File[]>([])
 useEffect(()=>{
  let active=true
  supabase.from('categorias').select('id,nombre,emoji').order('nombre').then(({data,error})=>{
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
 const selected=categories.find(c=>c.id===categoryId)
 const canDetails=description.trim().length>=10&&address.trim().length>=5
 function selectFiles(e:FormEvent<HTMLInputElement>){const target=e.currentTarget;const files=Array.from(target.files||[]).filter(f=>f.type.startsWith('image/')&&f.size<=5*1024*1024);setPhotos(files.slice(0,5))}
 return <div className="request-wrap">
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
     <label><span>Dirección del servicio</span><input required minLength={5} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle, número y localidad"/></label>
     <label className="full"><span><Camera size={16}/> Fotos (máximo 5 archivos de 5 MB)</span><input type="file" accept="image/*" multiple onChange={selectFiles}/><small>{photos.length} archivo(s) seleccionado(s). Todavía no se suben a Storage.</small></label>
    </div>
    <div className="form-actions split"><button className="outline-button" onClick={()=>setStep(1)}><ChevronLeft size={17}/> Atrás</button><button className="primary-button" disabled={!canDetails} onClick={()=>setStep(3)}>Revisar solicitud <ChevronRight size={17}/></button></div></>}
   {step===3&&<><div className="form-heading"><span><ShieldCheck size={22}/></span><div><h2>Revisá tu solicitud</h2><p>Estos son tus datos, no ejemplos.</p></div></div>
    <div className="summary-box"><div><small>SERVICIO</small><strong>{selected?.nombre||'Sin categoría'}</strong><span>{description}</span></div><div><small>CUÁNDO</small><strong>{urgency}</strong></div><div><small>DIRECCIÓN</small><strong>{address}</strong><span>{photos.length} fotos seleccionadas</span></div></div>
    <div className="estimate"><span><ShieldCheck size={20}/></span><div><strong>No se creó ningún pedido todavía</strong><p>Falta integrar y probar la RPC de creación y el envío de fotos a UGO TEST. No se muestra un precio inventado.</p></div></div>
    <div className="form-actions split"><button className="outline-button" onClick={()=>setStep(2)}><ChevronLeft size={17}/> Editar</button><button className="primary-button" disabled title="Pendiente validar la creación de servicios en UGO TEST">Buscar profesional <Search size={17}/></button></div></>}
  </section>
 </div>
}
