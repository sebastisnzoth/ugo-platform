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
export function draftStorageKey(userId:string){return DRAFT_PREFIX+userId}
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
