import {supabase} from './supabase'

export type ClientOrderInput={
 categoryId:string
 description:string
 address:string
 scheduleAt:string|null
 paymentMethod:'efectivo'|'pix'
 draftId:string
}
export type CreatedOrder={id:string;estado:string;numero:number|null}
const DRAFT_PREFIX='ugo:client:request-draft:'
const ORDER_PREFIX='ugo:client:submitted-order:'
export function draftStorageKey(userId:string){return DRAFT_PREFIX+userId}
export function orderStorageKey(userId:string){return ORDER_PREFIX+userId}
export type OrderStatus={id:string;numero:number|null;estado:string;proveedor_id:string|null}
export async function readOwnedOrderStatus(id:string):Promise<OrderStatus>{
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)throw new Error('Sesión de Cliente no disponible.')
 const {data,error}=await supabase.from('servicios').select('id,numero,estado,proveedor_id').eq('id',id).eq('cliente_id',user.id).single()
 if(error||!data)throw new Error('No se pudo consultar el estado del pedido.')
 return data as OrderStatus
}
export function recoverOrNewDraftId(userId:string){
 const key=draftStorageKey(userId)
 const old=sessionStorage.getItem(key)
 if(old&&/^[0-9a-f-]{36}$/i.test(old))return old
 const id=crypto.randomUUID()
 sessionStorage.setItem(key,id)
 return id
}
async function findByDraft(userId:string,draftId:string){
 const {data,error}=await supabase.from('servicios').select('id,estado,numero')
  .eq('cliente_id',userId).eq('metadata->>request_draft_id',draftId).maybeSingle()
 if(error)throw error
 return data as CreatedOrder|null
}
export async function createOwnedClientOrder(input:ClientOrderInput):Promise<CreatedOrder>{
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)throw new Error('Iniciá sesión como cliente para publicar un pedido.')
 if(!input.categoryId||input.description.trim().length<10||input.address.trim().length<5)throw new Error('Completá categoría, descripción y dirección.')
 if(input.scheduleAt&&!(new Date(input.scheduleAt).getTime()>Date.now()))throw new Error('La programación debe ser futura.')
 if(!['efectivo','pix'].includes(input.paymentMethod))throw new Error('Elegí una forma de pago.')
 const existing=await findByDraft(user.id,input.draftId)
 if(existing)return existing
 const metadata={source:'ugo-platform-client-zip',request_draft_id:input.draftId,
  payment_method:input.paymentMethod,requested_payment_method:input.paymentMethod,
  requested_when:input.scheduleAt?'programar':'ahora',scheduled_at:input.scheduleAt,
  demo:false}
 const {data,error}=await supabase.from('servicios').insert({
  cliente_id:user.id,categoria_id:input.categoryId,estado:'buscando',
  descripcion:input.description.trim(),direccion_cliente:input.address.trim(),
  programado_para:input.scheduleAt,tarifa:null,urgencia:!input.scheduleAt,
  metadata
 }).select('id,estado,numero').single()
 if(error){
  // The backend unique index (cliente_id, metadata.request_draft_id) arbitrates
  // concurrent requests. Recover the persisted row even after an ambiguous timeout.
  const recovered=await findByDraft(user.id,input.draftId)
  if(recovered)return recovered
  throw error
 }
 if(!data?.id)throw new Error('UGO TEST no confirmó la creación del pedido.')
 return data as CreatedOrder
}
export async function uploadDraftEvidence(userId:string,draftId:string,files:File[]){
 for(const file of files){
  if(!file.type.startsWith('image/')||file.size>5*1024*1024)throw new Error('La imagen debe ser menor a 5 MB.')
  const existing=await supabase.from('evidencias_solicitud').select('id').eq('cliente_id',userId)
   .eq('draft_id',draftId).eq('metadata->>file_fingerprint',file.name+':'+file.size+':'+file.lastModified).limit(1)
  if(existing.error)throw existing.error
  if(existing.data?.length)continue
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()||'jpg'
  const path=userId+'/'+draftId+'/'+crypto.randomUUID()+'.'+ext
  const {error:uploadError}=await supabase.storage.from('request-evidence').upload(path,file,{contentType:file.type,upsert:false})
  if(uploadError)throw uploadError
  const {error:rowError}=await supabase.from('evidencias_solicitud').insert({
   cliente_id:userId,draft_id:draftId,storage_path:path,
   descripcion:'Foto adjunta por cliente',metadata:{mime:file.type,size:file.size,
    request_draft_id:draftId,file_fingerprint:file.name+':'+file.size+':'+file.lastModified}
  })
  if(rowError){await supabase.storage.from('request-evidence').remove([path]);throw rowError}
 }
}

export async function dispatchOwnedClientOrder(serviceId:string):Promise<string>{
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)throw new Error('Tu sesión expiró. Iniciá sesión otra vez.')
 const {data:row,error:readError}=await supabase.from('servicios')
  .select('id,estado,cliente_id,metadata,proveedor_id').eq('id',serviceId).eq('cliente_id',user.id).single()
 if(readError||!row)throw new Error('No encontramos el pedido en tu cuenta.')
 if(row.proveedor_id)return 'El profesional ya está asignado.'
 if(!['buscando','ofrecido'].includes(String(row.estado)))throw new Error('Este pedido no admite iniciar búsqueda en su estado actual.')
 const method=String((row.metadata as Record<string,unknown>|null)?.payment_method||'')
 if(!['efectivo','pix'].includes(method))throw new Error('Elegí una forma de pago válida.')
 if(!navigator.geolocation)throw new Error('El GPS no está disponible en este dispositivo.')
 const position=await new Promise<GeolocationPosition>((resolve,reject)=>
  navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}))
 if(!Number.isFinite(position.coords.latitude)||!Number.isFinite(position.coords.longitude)||
    position.coords.latitude===0&&position.coords.longitude===0||
    position.coords.accuracy>200||Date.now()-position.timestamp>30000)
   throw new Error('No pudimos confirmar un GPS preciso y reciente. Acercate a una ventana o habilitá ubicación exacta.')
 const {error:locationError}=await supabase.rpc('guardar_ubicacion_servicio_cliente',{
  p_servicio_id:serviceId,p_lat:position.coords.latitude,p_lng:position.coords.longitude
 })
 if(locationError)throw new Error('El pedido quedó guardado, pero falló el registro GPS: '+locationError.message)
 const {error:matchingError}=await supabase.rpc('iniciar_matching',{p_servicio_id:serviceId})
 if(matchingError)throw new Error('El pedido quedó guardado, pero no se pudo iniciar el matching: '+matchingError.message)
 return 'La búsqueda se inició en UGO TEST. Consultá Actividad para seguir el pedido.'
}
