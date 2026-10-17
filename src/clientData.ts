import { supabase } from './lib/supabase'

// ============================================================
// Contratos reales del Cliente en UGO TEST (ugo-admin-panel:
// ClientPostConfirmFlow.tsx, clientActionService.ts,
// ClientPaymentChoice.tsx, serviceRatingService.ts,
// client-*-runtime.mjs). Sin datos ficticios.
// ============================================================

const messageOf = (error: { message?: string } | null, fallback: string) => error?.message?.trim() || fallback

export type RealCategory = { id: string; nombre: string; emoji: string | null; slug: string | null }

export async function loadRealCategories(): Promise<RealCategory[]> {
  const { data, error } = await supabase.from('categorias')
    .select('id,nombre,emoji,slug').eq('activa', true).order('nombre')
  if (error) throw new Error(messageOf(error, 'No pudimos cargar las categorías.'))
  return (data || []) as RealCategory[]
}

export type CreateServiceInput = {
  categoriaId: string
  descripcion: string
  direccion: string
  zona?: string | null
  programadoPara?: string | null
  urgencia?: boolean
}

/** Alta real del pedido (estado 'buscando') + inicio del matching canónico. */
export async function createServiceRequest(userId: string, input: CreateServiceInput): Promise<string> {
  const descripcion = input.descripcion.trim()
  if (!input.categoriaId) throw new Error('Elegí una categoría real de UGO.')
  if (descripcion.length < 5) throw new Error('Contanos qué necesitás (mínimo 5 caracteres).')
  const { data, error } = await supabase.from('servicios').insert({
    cliente_id: userId,
    categoria_id: input.categoriaId,
    estado: 'buscando',
    descripcion,
    direccion_cliente: input.direccion.trim() || null,
    zona: input.zona || null,
    programado_para: input.programadoPara ? new Date(input.programadoPara).toISOString() : null,
    urgencia: Boolean(input.urgencia),
  }).select('id').single()
  if (error) throw new Error(messageOf(error, 'No pudimos crear el pedido.'))
  const serviceId = (data as { id: string }).id
  const { error: matchError } = await supabase.rpc('iniciar_matching', { p_servicio_id: serviceId })
  if (matchError) throw new Error(`Pedido creado, pero el matching no pudo iniciar: ${matchError.message}`)
  return serviceId
}

/** Cancelación temprana del pedido (antes de estar asignado). */
export async function cancelClientService(serviceId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('servicios')
    .update({ estado: 'cancelado' })
    .eq('id', serviceId).eq('cliente_id', userId)
    .in('estado', ['borrador', 'buscando', 'ofrecido'])
  if (error) throw new Error(messageOf(error, 'No pudimos cancelar el pedido.'))
}

export async function approveService(serviceId: string): Promise<void> {
  const { error } = await supabase.rpc('aprobar_servicio', { p_servicio_id: serviceId })
  if (error) throw new Error(messageOf(error, 'No pudimos aprobar el trabajo.'))
}

export async function confirmCashPayment(serviceId: string): Promise<void> {
  const { error } = await supabase.rpc('confirmar_pago_efectivo_cliente', { p_servicio_id: serviceId })
  if (error) throw new Error(messageOf(error, 'No pudimos confirmar el pago en efectivo.'))
}

export async function selectPaymentMethod(serviceId: string, metodo: string): Promise<void> {
  const { error } = await supabase.rpc('seleccionar_metodo_pago_servicio', { p_servicio_id: serviceId, p_metodo: metodo })
  if (error) throw new Error(messageOf(error, 'No pudimos guardar la forma de pago.'))
}

export async function cashPaymentEnabled(moneda: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cash_payment_enabled', { p_moneda: moneda || 'BRL' })
  if (error) return false
  return Boolean(data)
}

export type ServicePayment = {
  id: string
  servicio_id: string
  metodo?: string | null
  estado: string
  monto_bruto?: number | string | null
  comision_ugo?: number | string | null
  moneda?: string | null
  pix_copia_cola?: string | null
  pix_qr_code?: string | null
  created_at?: string | null
}

export async function loadServicePayment(serviceId: string): Promise<ServicePayment | null> {
  const { data, error } = await supabase.from('pagos')
    .select('id,servicio_id,metodo,estado,monto_bruto,comision_ugo,moneda,pix_copia_cola,pix_qr_code,created_at')
    .eq('servicio_id', serviceId).maybeSingle()
  if (error) throw new Error(messageOf(error, 'No pudimos cargar el pago.'))
  return (data as ServicePayment | null) ?? null
}

export async function loadClientPayments(userId: string): Promise<ServicePayment[]> {
  const { data, error } = await supabase.from('pagos')
    .select('id,servicio_id,metodo,estado,monto_bruto,comision_ugo,moneda,created_at')
    .eq('cliente_id', userId).order('created_at', { ascending: false }).limit(30)
  if (error) throw new Error(messageOf(error, 'No pudimos cargar tus pagos.'))
  return (data || []) as ServicePayment[]
}

export type ServiceReview = { id?: string; servicio_id: string; autor_tipo: 'cliente' | 'proveedor'; puntuacion: number; comentario?: string | null }

export async function loadMyReview(serviceId: string, autorTipo: 'cliente' | 'proveedor'): Promise<{ puntuacion: number; comentario?: string | null } | null> {
  const { data, error } = await supabase.from('resenas')
    .select('puntuacion,comentario')
    .eq('servicio_id', serviceId).eq('autor_tipo', autorTipo).maybeSingle()
  if (error) return null
  return (data as { puntuacion: number; comentario?: string | null } | null) ?? null
}

export async function rateService(input: {
  servicioId: string
  clienteId: string
  proveedorId: string | null
  autorTipo: 'cliente' | 'proveedor'
  puntuacion: number
  comentario?: string
}): Promise<void> {
  if (!input.proveedorId) throw new Error('Este servicio todavía no tiene proveedor asignado.')
  const payload = {
    servicio_id: input.servicioId,
    cliente_id: input.clienteId,
    proveedor_id: input.proveedorId,
    autor_tipo: input.autorTipo,
    puntuacion: Math.min(5, Math.max(1, Math.round(input.puntuacion))),
    comentario: input.comentario?.trim() || null,
  }
  const { error } = await supabase.from('resenas').insert(payload)
  if (error) throw new Error(messageOf(error, 'No pudimos enviar la calificación.'))
}

// ---------- Ampliaciones 2026-10-17: foto, preferencia de pago, contraseña ----------

const CLIENT_PHOTO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Foto de perfil del cliente (bucket client-public + perfiles_cliente.foto_perfil_path). */
export async function uploadClientPhoto(userId: string, file: File): Promise<{ path: string; publicUrl: string }> {
  const ext = CLIENT_PHOTO_EXT[file.type]
  if (!ext) throw new Error('Usá una imagen JPG, PNG o WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto debe pesar hasta 5 MB.')
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const path = `${userId}/profile/${Date.now()}-${unique}.${ext}`
  const uploaded = await supabase.storage.from('client-public').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (uploaded.error) throw new Error(messageOf(uploaded.error, 'No pudimos subir la foto.'))
  const { data, error } = await supabase.from('perfiles_cliente')
    .select('foto_perfil_path').eq('usuario_id', userId).maybeSingle()
  const previous = (data as { foto_perfil_path?: string | null } | null)?.foto_perfil_path ?? null
  const { error: saveError } = await supabase.from('perfiles_cliente')
    .upsert({ usuario_id: userId, foto_perfil_path: path }, { onConflict: 'usuario_id' })
  if (saveError) {
    await supabase.storage.from('client-public').remove([path]).catch(() => {})
    throw new Error(messageOf(saveError, 'No pudimos guardar la foto en tu perfil.'))
  }
  if (previous && previous !== path) await supabase.storage.from('client-public').remove([previous]).catch(() => {})
  void error
  const publicUrl = supabase.storage.from('client-public').getPublicUrl(path).data.publicUrl
  return { path, publicUrl }
}

export function clientPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('client-public').getPublicUrl(path).data.publicUrl
}

export async function loadClientPhotoPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('perfiles_cliente')
    .select('foto_perfil_path').eq('usuario_id', userId).maybeSingle()
  if (error) return null
  return (data as { foto_perfil_path?: string | null } | null)?.foto_perfil_path ?? null
}

/** Preferencia de pago pre-orden (efectivo | pix). */
export async function loadPaymentPreference(userId: string): Promise<'efectivo' | 'pix'> {
  const { data } = await supabase.from('preferencias_pago_cliente')
    .select('metodo').eq('usuario_id', userId).maybeSingle()
  return (data as { metodo?: string } | null)?.metodo === 'pix' ? 'pix' : 'efectivo'
}

export async function setPaymentPreference(metodo: 'efectivo' | 'pix'): Promise<void> {
  const { error } = await supabase.rpc('set_preorder_payment_preference', { p_metodo: metodo })
  if (error) throw new Error(messageOf(error, 'No pudimos guardar la preferencia de pago.'))
}

export async function changePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(messageOf(error, 'No pudimos actualizar la contraseña.'))
}
