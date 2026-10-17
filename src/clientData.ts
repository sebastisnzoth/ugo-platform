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
