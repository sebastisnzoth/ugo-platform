import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

// ============================================================
// Contratos reales de UGO TEST para Admin / Super Admin
// (ver ugo-admin-panel: AdminGate.tsx, admin_superadmin_config_hardening.sql,
//  database.types.ts y docs/UGO_DATA_BACKEND_MASTER.md §15).
// La autorización real vive en RLS/RPC (private.is_admin / is_superadmin);
// la UI solo refleja el rol y oculta acciones.
// ============================================================

export type AdminRole = 'admin' | 'superadmin'

export type AdminUserRow = {
  id: string
  email?: string | null
  nombre?: string | null
  apellido?: string | null
  tipo: string
  activo: boolean
  karma?: number | null
  servicios_completados?: number | null
  zona?: string | null
  pais?: string | null
  online?: boolean | null
  created_at?: string | null
  fecha_registro?: string | null
}

export type AdminDashboardRow = {
  servicios_activos?: number | null
  boveda_total?: number | null
  proveedores_online?: number | null
  proveedores_total?: number | null
  disputas_abiertas?: number | null
  monto_disputado?: number | null
  docs_pendientes?: number | null
  ingresos_hoy?: number | null
  comision_hoy?: number | null
  ingresos_mes?: number | null
  clientes_total?: number | null
  snapshot_at?: string | null
}

export type AdminServiceRow = {
  id: string
  numero?: number | string | null
  estado: string
  descripcion?: string | null
  tarifa?: number | string | null
  comision_ugo?: number | string | null
  ganancia_proveedor?: number | string | null
  moneda?: string | null
  created_at?: string | null
  categoria?: { nombre: string; emoji: string } | null
  cliente?: { nombre: string } | null
  proveedor?: { nombre: string } | null
}

export type AdminDisputeRow = {
  id: string
  numero?: string | number | null
  estado: string
  monto_disputado?: number | string | null
  motivo?: string | null
  resolucion?: string | null
  created_at?: string | null
  cliente_id?: string | null
  proveedor_id?: string | null
  servicio_id?: string | null
}

export type AdminDocumentRow = {
  id: string
  usuario_id: string | null
  tipo: string
  estado: string
  descripcion?: string | null
  created_at?: string | null
}

export type AdminEscrowRow = {
  id: string
  servicio_id?: string | null
  cliente_id?: string | null
  proveedor_id?: string | null
  monto_total?: number | string | null
  comision_ugo?: number | string | null
  monto_proveedor?: number | string | null
  estado: string
  created_at?: string | null
  liberado_at?: string | null
}

export type AdminAuditRow = {
  id: string
  evento: string
  actor_id?: string | null
  actor_tipo?: string | null
  entidad_tipo?: string | null
  entidad_id?: string | null
  detalles?: unknown
  created_at?: string | null
}

export type ConfigRow = {
  clave: string
  valor: unknown
  descripcion?: string | null
  grupo?: string | null
  updated_at?: string | null
  updated_by?: string | null
}

export type CredentialsStatusRow = {
  provider: string
  country: string
  environment: string
  enabled: boolean
  configured: boolean
  updated_at?: string | null
}

export type AdminSnapshot = {
  dashboard: AdminDashboardRow | null
  servicios: AdminServiceRow[]
  usuarios: AdminUserRow[]
  disputas: AdminDisputeRow[]
  documentos: AdminDocumentRow[]
  escrow: AdminEscrowRow[]
  auditoria: AdminAuditRow[]
  config: ConfigRow[]
  credenciales: CredentialsStatusRow[]
}

const emptySnapshot: AdminSnapshot = {
  dashboard: null, servicios: [], usuarios: [], disputas: [], documentos: [], escrow: [], auditoria: [], config: [], credenciales: [],
}

const messageOf = (error: { message?: string } | null, fallback: string) => error?.message?.trim() || fallback

/** Rol administrativo real según la tabla usuarios (tipo + activo), igual que AdminGate. */
export function useAdminAccess(session: Session | null) {
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!session) { setRole(null); setLoading(false); setError(''); return }
    setLoading(true); setError('')
    supabase.from('usuarios').select('tipo,activo').eq('id', session.user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return
        setLoading(false)
        if (queryError) { setError('No pudimos validar tu perfil administrativo: ' + queryError.message); setRole(null); return }
        const row = data as { tipo?: string; activo?: boolean } | null
        const tipo = row?.tipo
        if (row?.activo && (tipo === 'admin' || tipo === 'superadmin')) setRole(tipo === 'superadmin' ? 'superadmin' : 'admin')
        else setRole(null)
      })
    return () => { active = false }
  }, [session])

  return { role, loading, error }
}

export function useAdminSnapshot(session: Session | null, enabled: boolean, isSuper: boolean) {
  const [data, setData] = useState<AdminSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey(key => key + 1), [])

  useEffect(() => {
    let active = true
    if (!session || !enabled) {
      setData(emptySnapshot); setLoading(false); setError('')
      return
    }
    setLoading(true); setError('')
    const uid = session.user.id
    const base = [
      supabase.from('vista_admin_dashboard').select('*').maybeSingle(),
      supabase.from('servicios')
        .select('*,categoria:categorias(nombre,emoji),cliente:usuarios!servicios_cliente_id_fkey(nombre),proveedor:usuarios!servicios_proveedor_id_fkey(nombre)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('usuarios').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('disputas').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('documentos').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('escrow').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(40),
    ]
    const extras = isSuper ? [
      supabase.from('config_sistema').select('*').order('grupo', { ascending: true }).order('clave', { ascending: true }),
      supabase.rpc('admin_payment_credentials_status'),
    ] : []
    void uid
    Promise.all([...base, ...extras]).then(results => {
      if (!active) return
      const names = ['dashboard', 'servicios', 'usuarios', 'disputas', 'documentos', 'escrow', 'auditoría']
      const failures: string[] = []
      results.forEach((result, index) => {
        if (result.error && index < names.length) failures.push(names[index])
      })
      const [dashRes, servRes, userRes, dispRes, docRes, escrowRes, auditRes, configRes, credRes] = results
      setData({
        dashboard: (dashRes.data as AdminDashboardRow | null) ?? null,
        servicios: (servRes.data as AdminServiceRow[] | null) ?? [],
        usuarios: (userRes.data as AdminUserRow[] | null) ?? [],
        disputas: (dispRes.data as AdminDisputeRow[] | null) ?? [],
        documentos: (docRes.data as AdminDocumentRow[] | null) ?? [],
        escrow: (escrowRes.data as AdminEscrowRow[] | null) ?? [],
        auditoria: (auditRes.data as AdminAuditRow[] | null) ?? [],
        config: (configRes?.data as ConfigRow[] | null) ?? [],
        credenciales: (credRes?.data as CredentialsStatusRow[] | null) ?? [],
      })
      const extraFailures: string[] = []
      if (configRes?.error) extraFailures.push('configuración')
      if (credRes?.error) extraFailures.push('credenciales')
      const all = [...failures, ...extraFailures]
      setError(all.length ? `No pudimos cargar: ${all.join(', ')}. Revisá permisos de administrador o la conexión.` : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [session, enabled, isSuper, reloadKey])

  return { ...data, loading, error, reload }
}

// ---------- Acciones administrativas (RPCs canónicas, con auditoría server-side) ----------

export async function adminSuspenderProveedor(proveedorId: string, motivo: string): Promise<void> {
  const args: Record<string, unknown> = { p_proveedor_id: proveedorId }
  if (motivo.trim()) args.p_motivo = motivo.trim()
  const { error } = await supabase.rpc('admin_suspender_proveedor', args)
  if (error) throw new Error(messageOf(error, 'No se pudo suspender al proveedor.'))
}

export async function adminLiberarEscrow(escrowId: string, notas: string): Promise<void> {
  const args: Record<string, unknown> = { p_escrow_id: escrowId }
  if (notas.trim()) args.p_notas = notas.trim()
  const { error } = await supabase.rpc('admin_liberar_escrow', args)
  if (error) throw new Error(messageOf(error, 'No se pudo liberar el escrow.'))
}

export async function adminResolverDisputa(disputaId: string, resolucion: string, favorDe: string): Promise<void> {
  const args: Record<string, unknown> = { p_disputa_id: disputaId, p_resolucion: resolucion.trim() }
  if (favorDe) args.p_favor_de = favorDe
  const { error } = await supabase.rpc('admin_resolver_disputa', args)
  if (error) throw new Error(messageOf(error, 'No se pudo resolver la disputa.'))
}

export async function adminUpdateConfig(clave: string, valorTexto: string): Promise<void> {
  let valor: unknown
  try { valor = JSON.parse(valorTexto) } catch { valor = valorTexto }
  const { error } = await supabase.rpc('admin_update_config', { p_clave: clave, p_valor: valor })
  if (error) throw new Error(messageOf(error, 'No se pudo actualizar la configuración.'))
}

export async function adminSetFeatureFlag(clave: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_feature_flag', { p_clave: clave, p_enabled: enabled })
  if (error) throw new Error(messageOf(error, 'No se pudo actualizar el feature flag.'))
}

export async function superadminEvaluarAutonomia(): Promise<string> {
  const { data, error } = await supabase.rpc('superadmin_evaluate_autonomy_on_gate')
  if (error) throw new Error(messageOf(error, 'No se pudo evaluar la autonomía del sistema.'))
  return typeof data === 'string' ? data : JSON.stringify(data ?? { status: 'evaluado' })
}
