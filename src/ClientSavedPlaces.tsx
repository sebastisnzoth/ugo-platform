import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
type Place = {id:string;etiqueta:string;direccion:string;complemento:string|null;es_predeterminada:boolean}
export default function ClientSavedPlaces({session}:{session:Session|null}) {
 const [places,setPlaces]=useState<Place[]>([])
 const [draft,setDraft]=useState({etiqueta:'Casa',direccion:'',complemento:''})
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(false)
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{
  if(!session)return
  setLoading(true)
  const {data,error}=await supabase.from('direcciones_cliente').select('id,etiqueta,direccion,complemento,es_predeterminada').eq('usuario_id',session.user.id).order('es_predeterminada',{ascending:false})
  setLoading(false)
  if(error){setMessage('No pudimos leer las direcciones: '+error.message);return}
  setPlaces((data||[]) as Place[])
 },[session])
 useEffect(()=>{void load()},[load])
 async function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!session||busy)return
  if(draft.direccion.trim().length<5){setMessage('Ingresá una dirección válida.');return}
  setBusy(true);setMessage('')
  const {error}=await supabase.from('direcciones_cliente').insert({usuario_id:session.user.id,etiqueta:draft.etiqueta.trim(),direccion:draft.direccion.trim(),complemento:draft.complemento.trim()||null,es_predeterminada:places.length===0})
  setBusy(false)
  if(error){setMessage('No pudimos guardar: '+error.message);return}
  setDraft({etiqueta:'Casa',direccion:'',complemento:''});setMessage('Dirección guardada sin coordenadas; todavía no se validó la ubicación GPS.');void load()
 }
 async function makeDefault(id:string){
  if(busy)return;setBusy(true);setMessage('')
  const {error}=await supabase.rpc('set_direccion_cliente_predeterminada',{p_direccion_id:id})
  setBusy(false);if(error){setMessage(error.message);return}
  setMessage('Dirección principal actualizada.');void load()
 }
 async function remove(id:string){
  if(busy||!window.confirm('¿Eliminar esta dirección guardada?'))return
  setBusy(true);setMessage('')
  const {error}=await supabase.from('direcciones_cliente').delete().eq('id',id).eq('usuario_id',session?.user.id??'')
  setBusy(false);if(error){setMessage(error.message);return}
  setMessage('Dirección eliminada.');void load()
 }
 if(!session)return null
 return <section className="client-panel">
  <h2>Mis direcciones</h2><p>Guardá Casa, Trabajo u otras direcciones. No usaremos coordenadas aproximadas como GPS real.</p>
  {loading?<p role="status">Cargando direcciones...</p>:<ul className="client-order-list">{places.map(place=><li key={place.id}>
   <strong>{place.etiqueta} {place.es_predeterminada?'· Principal':''}</strong>
   <span>{place.direccion}</span>{place.complemento&&<small>{place.complemento}</small>}
   <div className="client-place-actions">
    {!place.es_predeterminada&&<button disabled={busy} onClick={()=>void makeDefault(place.id)}>Hacer principal</button>}
    <button disabled={busy} onClick={()=>void remove(place.id)}>Eliminar</button>
   </div>
  </li>)}</ul>}
  {!loading&&places.length===0&&<p>Aún no guardaste direcciones.</p>}
  <form className="client-profile-form" onSubmit={add}>
   <label>Etiqueta <input required maxLength={60} value={draft.etiqueta} onChange={e=>setDraft(d=>({...d,etiqueta:e.target.value}))}/></label>
   <label>Dirección <input required minLength={5} maxLength={240} value={draft.direccion} onChange={e=>setDraft(d=>({...d,direccion:e.target.value}))}/></label>
   <label>Complemento (opcional) <input maxLength={120} value={draft.complemento} onChange={e=>setDraft(d=>({...d,complemento:e.target.value}))}/></label>
   <button className="client-primary" disabled={busy}>{busy?'Guardando...':'Guardar dirección'}</button>
  </form>
  {message&&<p role="status">{message}</p>}
 </section>
}
