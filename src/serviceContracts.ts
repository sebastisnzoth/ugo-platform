import { supabase } from './lib/supabase'

// ============================================================
// Contratos compartidos Cliente ↔ Proveedor (UGO TEST):
// chat (mensajes), evidencias (evidencias_servicio + bucket
// service-evidence), disputas (abrir_disputa_v2 / responder_disputa)
// y tracking (obtener_tracking_servicio_cliente).
// Fuentes: ugo-admin-panel (ServiceChat.tsx, useDisputes.ts,
// service_evidence.sql, mcp/ugo-actions).
// ============================================================

const messageOf = (error: { message?: string } | null, fallback: string) => error?.message?.trim() || fallback

// ---------- Chat ----------

export type ChatMessage = {
  id: number | string
  servicio_id: string
  emisor_id: string
  emisor_rol: 'cliente' | 'proveedor' | string
  contenido: string
  created_at: string
}

export async function loadChat(serviceId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('mensajes')
    .select('id,servicio_id,emisor_id,emisor_rol,contenido,created_at')
    .eq('servicio_id', serviceId).order('created_at', { ascending: true })
  if (error) throw new Error(messageOf(error, 'No pudimos cargar el chat.'))
  return (data || []) as ChatMessage[]
}

export async function sendChatMessage(serviceId: string, emisorId: string, emisorRol: 'cliente' | 'proveedor', contenido: string): Promise<void> {
  const clean = contenido.trim()
  if (!clean) throw new Error('Escribí un mensaje.')
  const clientMessageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const { error } = await supabase.from('mensajes').insert({
    servicio_id: serviceId, emisor_id: emisorId, emisor_rol: emisorRol, contenido: clean, datos: { clientMessageId },
  })
  if (error) {
    // Idempotencia: si el mensaje ya se envió, no es un fallo real.
    const { data: existing } = await supabase.from('mensajes').select('id')
      .eq('servicio_id', serviceId).eq('emisor_id', emisorId).contains('datos', { clientMessageId }).maybeSingle()
    if (existing) return
    throw new Error(messageOf(error, 'No pudimos enviar el mensaje.'))
  }
}

// ---------- Evidencias ----------

export type EvidenceRow = {
  id?: string
  servicio_id: string
  usuario_id: string
  storage_path: string
  tipo?: string | null
  created_at?: string | null
}

export async function loadServiceEvidence(serviceId: string): Promise<EvidenceRow[]> {
  const { data, error } = await supabase.from('evidencias_servicio')
    .select('id,servicio_id,usuario_id,storage_path,tipo,created_at')
    .eq('servicio_id', serviceId).order('created_at', { ascending: true })
  if (error) throw new Error(messageOf(error, 'No pudimos cargar las evidencias.'))
  return (data || []) as EvidenceRow[]
}

export function evidencePublicUrl(storagePath: string): string {
  return supabase.storage.from('service-evidence').getPublicUrl(storagePath).data.publicUrl
}

export async function uploadServiceEvidence(serviceId: string, userId: string, file: File): Promise<void> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Cada archivo puede pesar hasta 10 MB.')
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-90) || 'evidencia'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const path = `${serviceId}/${userId}/${id}-${safe}`
  const { error: uploadError } = await supabase.storage.from('service-evidence').upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (uploadError) throw new Error(messageOf(uploadError, 'No pudimos subir la evidencia.'))
  const { error } = await supabase.from('evidencias_servicio').insert({ servicio_id: serviceId, usuario_id: userId, storage_path: path })
  if (error) throw new Error(messageOf(error, 'La evidencia se subió pero no se registró.'))
}

// ---------- Disputas ----------

export type DisputeReason = { codigo: string; actor: string; etiqueta: string; severidad: string; requiere_humano: boolean; evidencia_sugerida?: string | null }

export type ServiceDispute = {
  id: string
  numero?: string | number | null
  servicio_id: string
  estado: string
  motivo: string
  motivo_codigo?: string | null
  monto_disputado?: number | string | null
  resolucion?: string | null
  resolucion_favor?: 'cliente' | 'proveedor' | null
  created_at?: string | null
}

export async function loadDisputeReasons(actor: 'cliente' | 'proveedor'): Promise<DisputeReason[]> {
  const { data, error } = await supabase.from('reglas_motivos_disputa')
    .select('codigo,actor,etiqueta,severidad,requiere_humano,evidencia_sugerida')
    .eq('activo', true)
  if (error) throw new Error(messageOf(error, 'No pudimos cargar los motivos de disputa.'))
  return ((data || []) as DisputeReason[]).filter(reason => reason.actor === 'ambos' || reason.actor === actor)
}

export async function loadServiceDispute(serviceId: string): Promise<ServiceDispute | null> {
  const { data, error } = await supabase.from('disputas')
    .select('id,numero,servicio_id,estado,motivo,motivo_codigo,monto_disputado,resolucion,resolucion_favor,created_at')
    .eq('servicio_id', serviceId).maybeSingle()
  if (error) throw new Error(messageOf(error, 'No pudimos consultar la disputa.'))
  return (data as ServiceDispute | null) ?? null
}

export async function openServiceDispute(serviceId: string, motivoCodigo: string, motivo: string, evidencias: { path: string; name: string; type: string; size?: number }[] = []): Promise<void> {
  const { error } = await supabase.rpc('abrir_disputa_v2', {
    p_servicio_id: serviceId, p_motivo_codigo: motivoCodigo, p_motivo: motivo, p_evidencias: evidencias,
  })
  if (error) throw new Error(messageOf(error, 'No pudimos abrir la disputa.'))
}

export async function replyDispute(disputaId: string, mensaje: string, evidencias: { path: string; name: string; type: string; size?: number }[] = []): Promise<void> {
  const { error } = await supabase.rpc('responder_disputa', { p_disputa_id: disputaId, p_mensaje: mensaje, p_evidencias: evidencias })
  if (error) throw new Error(messageOf(error, 'No pudimos responder la disputa.'))
}

// ---------- Tracking ----------

export type TrackingFix = {
  lat: number | null
  lng: number | null
  precision_m?: number | null
  captured_at?: string | null
  proveedor_id?: string | null
}

export async function getServiceTracking(serviceId: string): Promise<TrackingFix | null> {
  const { data, error } = await supabase.rpc('obtener_tracking_servicio_cliente', { p_servicio_id: serviceId })
  if (error) throw new Error(messageOf(error, 'No pudimos obtener el seguimiento.'))
  const row = Array.isArray(data) ? data[0] : data
  return (row as TrackingFix | null) ?? null
}
