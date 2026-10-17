import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

// ============================================================
// Contratos reales de UGO TEST para el rol Proveedor
// (ver ugo-admin-panel: src/mvp/provider/providerService.ts y
//  docs/UGO_DATA_BACKEND_MASTER.md). Solo lecturas reales y
//  mutaciones canónicas del proveedor; sin datos ficticios.
// ============================================================

export type ProviderProfile = {
  usuario_id: string
  bio: string | null
  tarifa_base: number | null
  online: boolean
  disponible: boolean
  categoria_principal_id: string | null
  estado_verificacion: string | null
  ciudad_base: string | null
  zona_radio_km: number | null
  foto_perfil_path?: string | null
  ubicacion_updated_at?: string | null
  ubicacion_accuracy_m?: number | null
}

export type ProviderService = {
  id: string
  numero: number | string | null
  estado: string
  descripcion: string | null
  urgencia?: boolean | null
  direccion_cliente?: string | null
  zona_cliente?: string | null
  programado_para?: string | null
  tarifa?: number | string | null
  comision_ugo?: number | string | null
  ganancia_proveedor?: number | string | null
  moneda?: string | null
  created_at: string
  categoria?: { nombre: string; emoji: string } | null
  cliente?: { nombre: string } | null
  metadata?: Record<string, unknown> | null
}

export type ProviderOffer = {
  id: string
  servicio_id: string
  estado: string
  ranking: number | null
  distancia_km: number | null
  tarifa_ofrecida: number | null
  expira_at: string | null
  servicio?: ProviderService | null
}

export type ProviderPayment = {
  id: string
  servicio_id: string
  monto_bruto: number | string | null
  comision_ugo: number | string | null
  ganancia_proveedor: number | string | null
  moneda: string | null
  estado: string
  metodo?: string | null
  created_at?: string | null
}

export type ProviderDebt = {
  id: string
  pago_id: string | null
  servicio_id: string | null
  proveedor_id: string
  monto_servicio: number | string | null
  comision_ugo: number | string | null
  monto_pagado_ugo: number | string | null
  saldo_pendiente: number | string | null
  moneda: string | null
  ambiente: 'real' | 'demo'
  estado: string
  referencia_pago?: string | null
  created_at: string
  servicio?: { numero?: number | string | null } | null
}

export type ProviderCategory = { id: string; nombre: string; emoji: string; slug: string }

export const PROVIDER_ACTIVE_STATES = ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'disputado']
export const PROVIDER_LIFECYCLE = ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'completado'] as const
export type ProviderTransition = 'en_camino' | 'llegado' | 'en_progreso' | 'esperando_aprobacion'

export const money = (value: number | string | null | undefined, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(Number(value || 0))

export function timeAgo(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(value).toLocaleDateString('es')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Deudas reales abiertas de comisión UGO (ambiente real). */
export function unresolvedDebts(debts: ProviderDebt[]): ProviderDebt[] {
  return debts.filter(debt => debt.ambiente === 'real' && !['pagado', 'anulado'].includes(debt.estado) && Number(debt.saldo_pendiente || 0) > 0)
}

/** El matching exige Online + GPS fresco (<=90 s) y preciso (<=250 m). */
export function matchingGpsReady(profile: ProviderProfile | null): boolean {
  if (!profile?.online || !profile.disponible || !profile.ubicacion_updated_at) return false
  const at = Date.parse(profile.ubicacion_updated_at)
  const accuracy = Number(profile.ubicacion_accuracy_m)
  return Number.isFinite(at) && Date.now() - at <= 90_000 && Date.now() - at >= -5_000 && Number.isFinite(accuracy) && accuracy > 0 && accuracy <= 250
}

// ---------- GPS (requerido por las RPCs de disponibilidad/llegada) ----------

type GpsFix = { latitude: number; longitude: number; accuracy: number; capturedAt: string }

function getGpsFix(): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Tu navegador no permite obtener la ubicación GPS.')); return }
    navigator.geolocation.getCurrentPosition(
      position => {
        const accuracy = Number(position.coords.accuracy)
        if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 250) {
          reject(new Error('La precisión GPS no alcanza (máx. 250 m). Activá la ubicación precisa e intentá de nuevo.'))
          return
        }
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          capturedAt: new Date(Number(position.timestamp)).toISOString(),
        })
      },
      error => reject(new Error(error.code === 1
        ? 'Permiso de ubicación denegado. Activá el GPS para continuar.'
        : 'No pudimos obtener tu ubicación GPS reciente. Reintentá al aire libre.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

const messageOf = (error: { message?: string } | null, fallback: string) => error?.message?.trim() || fallback

// ---------- Acciones canónicas del proveedor ----------

/** Online = RPC GPS-gated; Offline = update propio del perfil. */
export async function setProviderAvailability(userId: string, online: boolean): Promise<void> {
  if (online) {
    const fix = await getGpsFix()
    const { error } = await supabase.rpc('activar_disponibilidad_proveedor', {
      p_lat: fix.latitude, p_lng: fix.longitude, p_captured_at: fix.capturedAt, p_accuracy_m: fix.accuracy,
    })
    if (error) throw new Error(messageOf(error, 'No pudimos activar tu disponibilidad.'))
    return
  }
  const { error } = await supabase.from('perfiles_proveedor').update({ disponible: false, online: false }).eq('usuario_id', userId)
  if (error) throw new Error(messageOf(error, 'No se pudo actualizar la disponibilidad.'))
}

export async function acceptOffer(offerId: string): Promise<void> {
  const { error } = await supabase.rpc('aceptar_oferta', { p_oferta_id: offerId })
  if (error) throw new Error(messageOf(error, 'No se pudo aceptar el pedido.'))
}

export async function rejectOffer(offerId: string): Promise<void> {
  const { error } = await supabase.rpc('rechazar_oferta', { p_oferta_id: offerId })
  if (error) throw new Error(messageOf(error, 'No se pudo rechazar el pedido.'))
}

export async function advanceService(serviceId: string, state: ProviderTransition): Promise<void> {
  if (state === 'llegado') {
    try {
      const fix = await getGpsFix()
      await supabase.rpc('publicar_ubicacion_proveedor', {
        p_servicio_id: serviceId, p_lat: fix.latitude, p_lng: fix.longitude, p_captured_at: fix.capturedAt, p_accuracy_m: fix.accuracy,
      })
    } catch { /* sin ubicación precisa el backend igual valida la llegada */ }
    const { error } = await supabase.rpc('marcar_llegada_proveedor', { p_servicio_id: serviceId })
    if (error) throw new Error(messageOf(error, 'No se pudo confirmar la llegada.'))
    return
  }
  const { error } = await supabase.rpc('avanzar_servicio', { p_servicio_id: serviceId, p_estado: state })
  if (error) throw new Error(messageOf(error, `No se pudo actualizar el servicio a ${state}.`))
}

export async function cancelService(serviceId: string, reason: string): Promise<void> {
  const motivo = reason.trim()
  if (motivo.length < 5) throw new Error('Indicá el motivo de la cancelación para que quede registrado.')
  const { error } = await supabase.rpc('cancelar_servicio_proveedor', { p_servicio_id: serviceId, p_motivo: motivo })
  if (error) throw new Error(messageOf(error, 'No se pudo cancelar el servicio.'))
}

export async function saveProviderProfile(userId: string, input: { bio: string | null; tarifa_base: number; ciudad_base: string | null; zona_radio_km: number }): Promise<void> {
  const { error } = await supabase.from('perfiles_proveedor').update(input).eq('usuario_id', userId)
  if (error) throw new Error(messageOf(error, 'No se pudo guardar el perfil profesional.'))
}

export async function saveProviderCategories(primaryId: string, selectedIds: string[]): Promise<void> {
  const ids = Array.from(new Set([...selectedIds, primaryId].filter(Boolean)))
  const { error } = await supabase.rpc('guardar_categorias_proveedor', { p_categoria_principal_id: primaryId, p_categorias: ids })
  if (error) throw new Error(messageOf(error, 'No se pudieron guardar las categorías.'))
}

export async function loadProviderCategories(userId: string): Promise<{ categories: ProviderCategory[]; primary: string; selected: string[] }> {
  const [{ data: cats, error: catsError }, { data: userRow, error: userError }] = await Promise.all([
    supabase.from('categorias').select('id,nombre,emoji,slug').eq('activa', true).order('nombre'),
    supabase.from('usuarios').select('categorias_ids').eq('id', userId).maybeSingle(),
  ])
  if (catsError) throw new Error(messageOf(catsError, 'No pudimos cargar las categorías.'))
  if (userError) throw new Error(messageOf(userError, 'No pudimos leer tus categorías.'))
  const categories = (cats || []) as ProviderCategory[]
  const stored = Array.isArray((userRow as { categorias_ids?: unknown } | null)?.categorias_ids)
    ? ((userRow as { categorias_ids: unknown[] }).categorias_ids.filter((id): id is string => typeof id === 'string'))
    : []
  return { categories, primary: stored[0] || '', selected: stored }
}

// ---------- Snapshot real del proveedor ----------

export type ProviderSnapshot = {
  profile: ProviderProfile | null
  offers: ProviderOffer[]
  services: ProviderService[]
  payments: ProviderPayment[]
  debts: ProviderDebt[]
}

const emptySnapshot: ProviderSnapshot = { profile: null, offers: [], services: [], payments: [], debts: [] }

export function useProviderSnapshot(session: Session | null) {
  const [data, setData] = useState<ProviderSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey(key => key + 1), [])

  useEffect(() => {
    let active = true
    if (!session) {
      setData(emptySnapshot); setLoading(false); setError('')
      return
    }
    setLoading(true); setError('')
    const uid = session.user.id
    Promise.all([
      supabase.from('perfiles_proveedor').select('*').eq('usuario_id', uid).maybeSingle(),
      supabase.rpc('obtener_ofertas_proveedor'),
      supabase.from('servicios')
        .select('*,categoria:categorias(nombre,emoji),cliente:usuarios!servicios_cliente_id_fkey(nombre)')
        .eq('proveedor_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('pagos').select('*').eq('proveedor_id', uid).order('created_at', { ascending: false }),
      supabase.from('deudas_ugo_proveedor')
        .select('id,pago_id,servicio_id,proveedor_id,monto_servicio,comision_ugo,monto_pagado_ugo,saldo_pendiente,moneda,ambiente,estado,referencia_pago,pago_informado_at,pagado_at,created_at,servicio:servicios!deudas_ugo_proveedor_servicio_id_fkey(numero)')
        .eq('proveedor_id', uid).order('created_at', { ascending: false }),
    ]).then(([profileRes, offersRes, servicesRes, paymentsRes, debtsRes]) => {
      if (!active) return
      const failures: string[] = []
      if (profileRes.error) failures.push('perfil')
      if (offersRes.error) failures.push('oportunidades')
      if (servicesRes.error) failures.push('servicios')
      if (paymentsRes.error) failures.push('pagos')
      if (debtsRes.error) failures.push('comisiones')
      setData({
        profile: (profileRes.data as ProviderProfile | null) ?? null,
        offers: (offersRes.data as ProviderOffer[] | null) ?? [],
        services: (servicesRes.data as ProviderService[] | null) ?? [],
        payments: (paymentsRes.data as ProviderPayment[] | null) ?? [],
        debts: (debtsRes.data as ProviderDebt[] | null) ?? [],
      })
      setError(failures.length ? `No pudimos cargar ${failures.join(', ')} de UGO TEST. Revisá tu conexión o el rol de la cuenta.` : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [session, reloadKey])

  return { ...data, loading, error, reload }
}

// ---------- Ampliaciones 2026-10-17: radar, deuda PIX, foto y KYC ----------

export type DemandRow = {
  zona_lat?: number | string | null
  zona_lng?: number | string | null
  pedidos?: number | string | null
  urgentes?: number | string | null
  tarifa_promedio?: number | string | null
  ultimo_pedido?: string | null
}

/** Radar de demanda real por categoría (solo proveedores verificados). */
export async function loadProviderDemand(categoriaId: string | null, horas = 24): Promise<DemandRow[]> {
  const { data, error } = await supabase.rpc('obtener_demanda_proveedor', { p_categoria_id: categoriaId, p_horas: horas })
  if (error) throw new Error(messageOf(error, 'No pudimos actualizar el radar de demanda.'))
  return (data || []) as DemandRow[]
}

/** Informar el pago de una deuda UGO (la generación PIX es backend). */
export async function informarPagoDeuda(deudaId: string, referencia: string): Promise<void> {
  if (referencia.trim().length < 4) throw new Error('Ingresá la referencia del pago (mínimo 4 caracteres).')
  const { error } = await supabase.rpc('informar_pago_deuda_ugo', { p_deuda_id: deudaId, p_referencia: referencia.trim() })
  if (error) throw new Error(messageOf(error, 'No pudimos informar el pago.'))
}

/** Foto de perfil pública del proveedor (bucket provider-public). */
export async function uploadProviderPhoto(userId: string, file: File): Promise<string> {
  const extByType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extByType[file.type]
  if (!ext) throw new Error('Usá una imagen JPG, PNG o WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto debe pesar hasta 5 MB.')
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const path = `${userId}/profile/${Date.now()}-${unique}.${ext}`
  const upload = await supabase.storage.from('provider-public').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (upload.error) throw new Error(messageOf(upload.error, 'No pudimos subir la foto.'))
  const publicUrl = supabase.storage.from('provider-public').getPublicUrl(path).data.publicUrl
  const { error } = await supabase.from('perfiles_proveedor').update({ foto_perfil_path: path }).eq('usuario_id', userId)
  if (error) {
    await supabase.storage.from('provider-public').remove([path]).catch(() => {})
    throw new Error(messageOf(error, 'No pudimos guardar la foto en tu perfil.'))
  }
  await supabase.from('usuarios').update({ foto_url: publicUrl }).eq('id', userId).then(() => {})
  return publicUrl
}

// ---------- Onboarding / KYC (ProviderOnboardingGate.tsx) ----------

export type KycDocument = { id?: string; usuario_id: string; tipo: string; url_storage: string; descripcion?: string | null; estado: string; created_at?: string | null }

export const KYC_TIPOS = [
  { value: 'documento_identidad', label: 'Documento de identidad' },
  { value: 'comprobante_domicilio', label: 'Comprobante de domicilio' },
  { value: 'licencia_profesional', label: 'Licencia / título profesional' },
  { value: 'antecedentes', label: 'Antecedentes' },
]

/** Crea el perfil de proveedor si no existe (estado inicial 'registrado'). */
export async function ensureProviderProfile(userId: string): Promise<void> {
  const { data, error } = await supabase.from('perfiles_proveedor').select('usuario_id').eq('usuario_id', userId).maybeSingle()
  if (error) throw new Error(messageOf(error, 'No pudimos leer tu perfil de proveedor.'))
  if (data) return
  const { error: insertError } = await supabase.from('perfiles_proveedor').insert({ usuario_id: userId, estado_verificacion: 'registrado', onboarding_paso: 1 })
  if (insertError) throw new Error(messageOf(insertError, 'No pudimos crear tu perfil de proveedor.'))
}

export async function listKycDocuments(userId: string): Promise<KycDocument[]> {
  const { data, error } = await supabase.from('documentos')
    .select('id,usuario_id,tipo,url_storage,descripcion,estado,created_at')
    .eq('usuario_id', userId).order('created_at', { ascending: true })
  if (error) throw new Error(messageOf(error, 'No pudimos leer tus documentos.'))
  return (data || []) as KycDocument[]
}

export async function uploadKycDocument(userId: string, tipo: string, file: File): Promise<void> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Cada documento puede pesar hasta 10 MB.')
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'documento'
  const path = `${userId}/${Date.now()}-${safe}`
  const { error: uploadError } = await supabase.storage.from('provider-kyc').upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (uploadError) throw new Error(messageOf(uploadError, 'No pudimos subir el documento.'))
  const descripcion = tipo.replaceAll('_', ' ')
  const { data: existing, error: readError } = await supabase.from('documentos')
    .select('id').eq('usuario_id', userId).eq('tipo', tipo).maybeSingle()
  if (readError) throw new Error(messageOf(readError, 'No pudimos verificar documentos previos.'))
  if (existing) {
    const { error } = await supabase.from('documentos')
      .update({ url_storage: path, estado: 'pendiente', notas_rechazo: null, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id)
    if (error) throw new Error(messageOf(error, 'No pudimos actualizar el documento.'))
    return
  }
  const { error } = await supabase.from('documentos').insert({ usuario_id: userId, tipo, url_storage: path, descripcion, estado: 'pendiente' })
  if (error) throw new Error(messageOf(error, 'No pudimos registrar el documento.'))
}

/** Envía el perfil a revisión (registrado/rechazado → pendiente) y acepta términos. */
export async function submitProviderProfileToReview(userId: string, termsAccepted: boolean): Promise<void> {
  if (!termsAccepted) throw new Error('Aceptá los términos para enviar tu perfil a revisión.')
  const { error } = await supabase.from('perfiles_proveedor')
    .update({ estado_verificacion: 'pendiente', termos_aceitos_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('usuario_id', userId).in('estado_verificacion', ['registrado', 'rechazado'])
  if (error) throw new Error(messageOf(error, 'No pudimos enviar tu perfil a revisión.'))
}

// ---------- Ampliaciones: foto visible, documentos KYC accesibles, contraseña ----------

export function providerPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('provider-public').getPublicUrl(path).data.publicUrl
}

/** URL firmada para ver un documento KYC (bucket privado provider-kyc). */
export async function kycSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('provider-kyc').createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw new Error(messageOf(error, 'No pudimos generar el enlace del documento.'))
  return data.signedUrl
}

export async function changeProviderPassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(messageOf(error, 'No pudimos actualizar la contraseña.'))
}
