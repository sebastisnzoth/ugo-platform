import { supabaseAdmin, UGO_TEST_KEY, UGO_TEST_URL } from '../../lib/supabaseAdmin'
import {
  ACTIVE_SERVICE_STATES,
  type AuditRow,
  type CategoryRow,
  type ClientProfile,
  type ConfigRow,
  type DebtRow,
  type DisputeMessage,
  type DisputeRow,
  type DocumentRow,
  type EvidenceRow,
  type PaymentRow,
  type ProviderRow,
  type ServiceEvent,
  type ServiceRow,
  type UserRow,
  type WithdrawalRow,
} from './types'
import { sanitizeSearch, startOfToday } from './format'

export type LoadStatus = 'ok' | 'missing' | 'denied' | 'error'

export type Res<T> = {
  rows: T[]
  count: number | null
  status: LoadStatus
  error: string | null
}

export type CountRes = {
  count: number | null
  status: LoadStatus
  error: string | null
}

type Thenable<T = unknown> = PromiseLike<{ data: T | null; count?: number | null; error: unknown }>

export const adminDb = supabaseAdmin

function classify(error: unknown): { status: LoadStatus; error: string } {
  const record = error as { code?: string; message?: string; details?: string } | null
  const code = String(record?.code || '')
  const message = String(record?.message || record?.details || 'Error desconocido')
  if (['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205', '404'].includes(code)) {
    return { status: 'missing', error: `Contrato no disponible en este entorno: ${message}` }
  }
  if (code === '42501' || /permission denied|row-level security|insufficient privilege|not authorized/i.test(message)) {
    return { status: 'denied', error: `Sin permisos de lectura para esta consulta (RLS). ${message}` }
  }
  if (/fetch|network|abort|timeout|timed out|failed to fetch/i.test(message)) {
    return { status: 'error', error: `No se pudo contactar el proyecto UGO TEST. ${message}` }
  }
  return { status: 'error', error: message }
}

const EMPTY = { rows: [], count: null, status: 'ok' as LoadStatus, error: null }

async function exec<T>(query: Thenable<T>) {
  try {
    const response = await query
    if (response.error) {
      const { status, error } = classify(response.error)
      return { data: null as T | null, count: null as number | null, status, error }
    }
    return {
      data: (response.data ?? null) as T | null,
      count: typeof response.count === 'number' ? response.count : null,
      status: 'ok' as LoadStatus,
      error: null as string | null,
    }
  } catch (error) {
    const { status, error: message } = classify(error)
    return { data: null as T | null, count: null as number | null, status, error: message }
  }
}

export async function selectRows<T>(query: Thenable, fallback?: () => Thenable): Promise<Res<T>> {
  const first = await exec(query)
  if (first.status === 'missing' && fallback) {
    const second = await exec(fallback())
    return { rows: (second.data as T[] | null) || [], count: second.count, status: second.status, error: second.error }
  }
  return { rows: (first.data as T[] | null) || [], count: first.count, status: first.status, error: first.error }
}

export async function selectCount(query: Thenable): Promise<CountRes> {
  const result = await exec(query)
  return { count: result.count, status: result.status, error: result.error }
}

export function emptyRes<T>(): Res<T> {
  return { ...EMPTY } as Res<T>
}

/* ---------------------------------- servicios --------------------------------- */

const SERVICE_COLUMNS =
  'id,numero,estado,ambiente,cliente_id,proveedor_id,categoria_id,descripcion,zona,tarifa,moneda,comision_ugo,ganancia_proveedor,created_at,aceptado_at,iniciado_at,completado_at,cancelado_at,categoria:categorias!servicios_categoria_id_fkey(nombre,emoji),cliente:usuarios!servicios_cliente_id_fkey(nombre,apellido),proveedor:usuarios!servicios_proveedor_id_fkey(nombre,apellido)'
const SERVICE_COLUMNS_PLAIN =
  'id,numero,estado,ambiente,cliente_id,proveedor_id,categoria_id,descripcion,zona,tarifa,moneda,comision_ugo,ganancia_proveedor,created_at,aceptado_at,iniciado_at,completado_at,cancelado_at'

export type ServiceQuery = {
  filter?: string | null
  ambiente?: 'real' | 'demo' | 'todos'
  search?: string
  page?: number
  pageSize?: number
}

export async function loadServices(params: ServiceQuery = {}): Promise<Res<ServiceRow>> {
  const pageSize = params.pageSize ?? 40
  const page = Math.max(params.page ?? 0, 0)
  const from = page * pageSize
  const search = sanitizeSearch(params.search || '')
  const ambiente = params.ambiente ?? 'real'

  const build = (columns: string) => {
    let query = adminDb.from('servicios').select(columns, { count: 'exact' })
    if (ambiente !== 'todos') query = query.eq('ambiente', ambiente)
    if (params.filter === 'activos') query = query.in('estado', [...ACTIVE_SERVICE_STATES])
    else if (params.filter && params.filter !== 'todos') query = query.eq('estado', params.filter)
    if (search) {
      const numeric = Number(search)
      query = Number.isFinite(numeric) && /^\d+$/.test(search)
        ? query.or(`numero.eq.${numeric},descripcion.ilike.%${search}%,zona.ilike.%${search}%`)
        : query.or(`descripcion.ilike.%${search}%,zona.ilike.%${search}%`)
    }
    return query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  }

  return selectRows<ServiceRow>(build(SERVICE_COLUMNS), () => build(SERVICE_COLUMNS_PLAIN))
}

export async function loadServiceDetail(serviceId: string) {
  const [service, events, evidence, payments, disputes] = await Promise.all([
    selectRows<ServiceRow>(adminDb.from('servicios').select(SERVICE_COLUMNS).eq('id', serviceId).limit(1), () =>
      adminDb.from('servicios').select(SERVICE_COLUMNS_PLAIN).eq('id', serviceId).limit(1),
    ),
    selectRows<ServiceEvent>(
      adminDb
        .from('eventos_servicio')
        .select('id,actor_id,evento,estado_anterior,estado_nuevo,detalles,created_at')
        .eq('servicio_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(50),
      () =>
        adminDb
          .from('servicio_estado_eventos')
          .select('id,actor_id,evento,estado_anterior,estado_nuevo,created_at')
          .eq('servicio_id', serviceId)
          .order('created_at', { ascending: false })
          .limit(50),
    ),
    selectRows<EvidenceRow>(
      adminDb
        .from('evidencias_servicio')
        .select('id,tipo,storage_path,descripcion,usuario_id,created_at')
        .eq('servicio_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(30),
    ),
    selectRows<PaymentRow>(
      adminDb
        .from('pagos')
        .select(
          'id,servicio_id,ambiente,metodo,procesador,modelo_pago,estado,monto_bruto,comision_ugo,ganancia_proveedor,moneda,pix_e2e_id,pix_informado_at,pix_conciliado_at,pix_conciliacion_nota,created_at,autorizado_at,liberado_at,reembolsado_at',
        )
        .eq('servicio_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(10),
    ),
    selectRows<DisputeRow>(
      adminDb
        .from('disputas')
        .select('id,numero,servicio_id,estado,motivo,monto_disputado,resolucion,resolucion_favor,created_at,resuelta_at')
        .eq('servicio_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(10),
    ),
  ])

  return { service, events, evidence, payments, disputes }
}

export async function loadPulse(days = 14) {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))
  return selectRows<Pick<ServiceRow, 'id' | 'estado' | 'created_at' | 'completado_at'>>(
    adminDb
      .from('servicios')
      .select('id,estado,created_at,completado_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(3000),
  )
}

/* ---------------------------------- usuarios ---------------------------------- */

const USER_COLUMNS = 'id,nombre,apellido,tipo,activo,foto_url,pais,zona,karma,servicios_completados,created_at,updated_at'

export type UserQuery = {
  tipo?: string | null
  search?: string
  page?: number
  pageSize?: number
  onlyInactive?: boolean
}

export async function loadUsers(params: UserQuery = {}): Promise<Res<UserRow>> {
  const pageSize = params.pageSize ?? 40
  const page = Math.max(params.page ?? 0, 0)
  const from = page * pageSize
  const search = sanitizeSearch(params.search || '')

  const build = (columns: string) => {
    let query = adminDb.from('usuarios').select(columns, { count: 'exact' })
    if (params.tipo && params.tipo !== 'todos') {
      if (params.tipo === 'admin') query = query.in('tipo', ['admin', 'superadmin', 'arbitro'])
      else query = query.eq('tipo', params.tipo)
    }
    if (params.onlyInactive) query = query.eq('activo', false)
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,apellido.ilike.%${search}%,zona.ilike.%${search}%,pais.ilike.%${search}%`)
    }
    return query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  }

  return selectRows<UserRow>(build(USER_COLUMNS), () =>
    build('id,nombre,apellido,tipo,activo,pais,zona,created_at'),
  )
}

export async function loadUserContext(userIds: string[]) {
  if (userIds.length === 0) return { providers: emptyRes<ProviderRow>(), clients: emptyRes<ClientProfile>() }
  const [providers, clients] = await Promise.all([
    selectRows<ProviderRow>(
      adminDb
        .from('perfiles_proveedor')
        .select('usuario_id,estado_verificacion,motivo_rechazo,online,disponible,ciudad_base,telefono_profesional,tarifa_base,experiencia_anos,updated_at')
        .in('usuario_id', userIds),
      () => adminDb.from('perfiles_proveedor').select('usuario_id,estado_verificacion,online,disponible,ciudad_base').in('usuario_id', userIds),
    ),
    selectRows<ClientProfile>(
      adminDb.from('perfiles_cliente').select('usuario_id,telefono,direccion,barrio,ciudad').in('usuario_id', userIds),
      () => adminDb.from('perfiles_cliente').select('usuario_id,ciudad').in('usuario_id', userIds),
    ),
  ])
  return { providers, clients }
}

/* -------------------------------- proveedores --------------------------------- */

export type ProviderQuery = {
  estadoVerificacion?: string | null
  search?: string
  onlyOnline?: boolean
  page?: number
  pageSize?: number
}

const PROVIDER_COLUMNS =
  'usuario_id,estado_verificacion,motivo_rechazo,online,disponible,ciudad_base,telefono_profesional,tarifa_base,experiencia_anos,updated_at,categoria_principal_id,categoria:categorias!perfiles_proveedor_categoria_principal_id_fkey(nombre,emoji),usuario:usuarios!perfiles_proveedor_usuario_id_fkey(nombre,apellido,activo,zona)'
const PROVIDER_COLUMNS_PLAIN =
  'usuario_id,estado_verificacion,motivo_rechazo,online,disponible,ciudad_base,telefono_profesional,tarifa_base,experiencia_anos,updated_at,categoria_principal_id'

export async function loadProviders(params: ProviderQuery = {}): Promise<Res<ProviderRow>> {
  const pageSize = params.pageSize ?? 40
  const page = Math.max(params.page ?? 0, 0)
  const from = page * pageSize
  const search = sanitizeSearch(params.search || '')

  const build = (columns: string) => {
    let query = adminDb.from('perfiles_proveedor').select(columns, { count: 'exact' })
    if (params.estadoVerificacion && params.estadoVerificacion !== 'todos') {
      if (params.estadoVerificacion === 'pendientes') query = query.in('estado_verificacion', ['registrado', 'pendiente'])
      else query = query.eq('estado_verificacion', params.estadoVerificacion)
    }
    if (params.onlyOnline) query = query.eq('online', true)
    if (search) query = query.or(`ciudad_base.ilike.%${search}%,telefono_profesional.ilike.%${search}%`)
    return query.order('updated_at', { ascending: false }).range(from, from + pageSize - 1)
  }

  return selectRows<ProviderRow>(build(PROVIDER_COLUMNS), () => build(PROVIDER_COLUMNS_PLAIN))
}

export async function loadProviderDocuments(userId: string) {
  return selectRows<DocumentRow>(
    adminDb
      .from('documentos')
      .select('id,usuario_id,tipo,estado,url_storage,descripcion,notas,notas_rechazo,created_at,revisado_at')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    () => adminDb.from('documentos').select('id,usuario_id,tipo,estado,url_storage,created_at').eq('usuario_id', userId).limit(30),
  )
}

export async function loadPendingDocuments() {
  return selectRows<DocumentRow>(
    adminDb
      .from('documentos')
      .select('id,usuario_id,tipo,estado,url_storage,descripcion,created_at')
      .in('estado', ['pendiente', 'procesando', 'reenvio_solicitado'])
      .order('created_at', { ascending: false })
      .limit(25),
    () => adminDb.from('documentos').select('id,usuario_id,tipo,estado,created_at').in('estado', ['pendiente', 'procesando']).limit(25),
  )
}

/* ---------------------------------- finanzas ---------------------------------- */

const PAYMENT_COLUMNS =
  'id,servicio_id,ambiente,metodo,procesador,modelo_pago,estado,monto_bruto,comision_ugo,ganancia_proveedor,moneda,pix_e2e_id,pix_informado_at,pix_conciliado_at,pix_conciliacion_nota,created_at,autorizado_at,liberado_at,servicio:servicios!pagos_servicio_id_fkey(numero,descripcion)'
const PAYMENT_COLUMNS_PLAIN =
  'id,servicio_id,ambiente,metodo,procesador,modelo_pago,estado,monto_bruto,comision_ugo,ganancia_proveedor,moneda,pix_e2e_id,pix_informado_at,pix_conciliado_at,created_at,autorizado_at,liberado_at'

export type PaymentQuery = {
  estado?: string | null
  metodo?: string | null
  ambiente?: 'real' | 'demo' | 'todos'
  onlyPixReported?: boolean
  page?: number
  pageSize?: number
}

export async function loadPayments(params: PaymentQuery = {}): Promise<Res<PaymentRow>> {
  const pageSize = params.pageSize ?? 40
  const page = Math.max(params.page ?? 0, 0)
  const from = page * pageSize
  const ambiente = params.ambiente ?? 'real'

  const build = (columns: string) => {
    let query = adminDb.from('pagos').select(columns, { count: 'exact' })
    if (ambiente !== 'todos') query = query.eq('ambiente', ambiente)
    if (params.estado && params.estado !== 'todos') query = query.eq('estado', params.estado)
    if (params.metodo && params.metodo !== 'todos') query = query.eq('metodo', params.metodo)
    if (params.onlyPixReported) {
      query = query.eq('metodo', 'pix_direto').eq('estado', 'pendiente').not('pix_informado_at', 'is', null)
    }
    return query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  }

  return selectRows<PaymentRow>(build(PAYMENT_COLUMNS), () => build(PAYMENT_COLUMNS_PLAIN))
}

const DEBT_COLUMNS =
  'id,pago_id,servicio_id,proveedor_id,monto_servicio,comision_ugo,monto_pagado_ugo,saldo_pendiente,moneda,estado,referencia_pago,pago_informado_at,pagado_at,ambiente,created_at,proveedor:usuarios!deudas_ugo_proveedor_proveedor_id_fkey(nombre,apellido),servicio:servicios!deudas_ugo_proveedor_servicio_id_fkey(numero)'
const DEBT_COLUMNS_PLAIN =
  'id,pago_id,servicio_id,proveedor_id,monto_servicio,comision_ugo,monto_pagado_ugo,saldo_pendiente,moneda,estado,referencia_pago,pago_informado_at,pagado_at,ambiente,created_at'

export async function loadDebts(estado: string | null = 'informado'): Promise<Res<DebtRow>> {
  const build = (columns: string) => {
    let query = adminDb.from('deudas_ugo_proveedor').select(columns, { count: 'exact' })
    if (estado && estado !== 'todos') query = query.eq('estado', estado)
    return query.order('created_at', { ascending: false }).limit(60)
  }
  return selectRows<DebtRow>(build(DEBT_COLUMNS), () => build(DEBT_COLUMNS_PLAIN))
}

const WITHDRAWAL_COLUMNS =
  'id,proveedor_id,ambiente,monto,moneda,estado,created_at,procesado_at,transferencia_externa_id,notas,proveedor:usuarios!retiros_proveedor_id_fkey(nombre,apellido)'
const WITHDRAWAL_COLUMNS_PLAIN =
  'id,proveedor_id,ambiente,monto,moneda,estado,created_at,procesado_at,transferencia_externa_id,notas'

export async function loadWithdrawals(estado: string | null = null): Promise<Res<WithdrawalRow>> {
  const build = (columns: string) => {
    let query = adminDb.from('retiros').select(columns, { count: 'exact' })
    if (estado && estado !== 'todos') query = query.eq('estado', estado)
    else if (estado !== 'todos') query = query.in('estado', ['solicitado', 'aprobado', 'procesando'])
    return query.order('created_at', { ascending: false }).limit(60)
  }
  return selectRows<WithdrawalRow>(build(WITHDRAWAL_COLUMNS), () => build(WITHDRAWAL_COLUMNS_PLAIN))
}

/* ---------------------------------- disputas ---------------------------------- */

const DISPUTE_COLUMNS =
  'id,numero,servicio_id,cliente_id,proveedor_id,estado,motivo,monto_disputado,resolucion,resolucion_favor,created_at,updated_at,resuelta_at,servicio:servicios!disputas_servicio_id_fkey(numero,estado),cliente:usuarios!disputas_cliente_id_fkey(nombre,apellido),proveedor:usuarios!disputas_proveedor_id_fkey(nombre,apellido)'
const DISPUTE_COLUMNS_PLAIN =
  'id,numero,servicio_id,cliente_id,proveedor_id,estado,motivo,monto_disputado,resolucion,resolucion_favor,created_at,updated_at,resuelta_at'

export async function loadDisputes(estado: string | null = 'abiertas'): Promise<Res<DisputeRow>> {
  const build = (columns: string) => {
    let query = adminDb.from('disputas').select(columns, { count: 'exact' })
    if (estado === 'abiertas') query = query.in('estado', ['abierta', 'en_revision'])
    else if (estado === 'resueltas') query = query.in('estado', ['resuelta_cliente', 'resuelta_proveedor', 'reembolsada'])
    else if (estado && estado !== 'todos') query = query.eq('estado', estado)
    return query.order('created_at', { ascending: false }).limit(60)
  }
  return selectRows<DisputeRow>(build(DISPUTE_COLUMNS), () => build(DISPUTE_COLUMNS_PLAIN))
}

export async function loadDisputeMessages(disputeId: string) {
  return selectRows<DisputeMessage>(
    adminDb
      .from('disputa_mensajes')
      .select('id,disputa_id,autor_rol,mensaje,created_at')
      .eq('disputa_id', disputeId)
      .order('created_at', { ascending: true })
      .limit(80),
  )
}

/* ---------------------------------- auditoría ---------------------------------- */

export async function loadAudit(search = ''): Promise<Res<AuditRow>> {
  const clean = sanitizeSearch(search)
  const build = (columns: string) => {
    let query = adminDb.from('audit_log').select(columns, { count: 'exact' })
    if (clean) query = query.or(`evento.ilike.%${clean}%,entidad_tipo.ilike.%${clean}%`)
    return query.order('created_at', { ascending: false }).limit(60)
  }
  return selectRows<AuditRow>(
    build('id,evento,actor_id,actor_tipo,entidad_tipo,entidad_id,detalles,created_at'),
    () => build('id,evento,actor_id,entidad_tipo,entidad_id,created_at'),
  )
}

export async function loadRecentAudit(limit = 6): Promise<Res<AuditRow>> {
  return selectRows<AuditRow>(
    adminDb.from('audit_log').select('id,evento,actor_tipo,entidad_tipo,entidad_id,created_at').order('created_at', { ascending: false }).limit(limit),
    () => adminDb.from('audit_log').select('id,evento,entidad_tipo,created_at').order('created_at', { ascending: false }).limit(limit),
  )
}

/* ----------------------------------- sistema ---------------------------------- */

export async function loadCategories() {
  return selectRows<CategoryRow>(
    adminDb.from('categorias').select('id,nombre,emoji').order('nombre', { ascending: true }).limit(200),
    () => adminDb.from('categorias').select('id,nombre').limit(200),
  )
}

export async function loadConfig() {
  return selectRows<ConfigRow>(
    adminDb.from('config_sistema').select('clave,valor,grupo').order('grupo', { ascending: true }).limit(200),
    () => adminDb.from('config_sistema').select('clave,valor').limit(200),
  )
}

export type AuthDirectoryRow = {
  id: string
  email: string | null
  email_confirmed: boolean | null
  last_sign_in_at: string | null
}

// Directorio de Auth (emails y último acceso). Sólo responden cuentas admin por RLS/RPC.
export async function loadAuthDirectory() {
  return selectRows<AuthDirectoryRow>(adminDb.rpc('admin_get_auth_users'))
}

export const CONTRACT_TABLES = [
  'usuarios',
  'perfiles_cliente',
  'perfiles_proveedor',
  'servicios',
  'eventos_servicio',
  'evidencias_servicio',
  'pagos',
  'deudas_ugo_proveedor',
  'retiros',
  'disputas',
  'disputa_mensajes',
  'documentos',
  'audit_log',
  'categorias',
  'config_sistema',
] as const

export const CONTRACT_RPCS = [
  'admin_set_usuario_activo',
  'conciliar_pix_direto',
  'admin_confirmar_deuda_ugo_pagada',
  'admin_actualizar_retiro',
  'admin_resolver_disputa',
  'admin_get_auth_users',
] as const

export type ContractRow = { name: string; status: LoadStatus; error: string | null }

export async function loadContractStatus(): Promise<{ tables: ContractRow[]; rpcs: ContractRow[]; catalogOk: boolean }> {
  const { data: sessionData } = await adminDb.auth.getSession()
  const token = sessionData.session?.access_token || UGO_TEST_KEY

  let documented = new Set<string>()
  let catalogOk = false
  try {
    const response = await fetch(`${UGO_TEST_URL}/rest/v1/`, {
      headers: { apikey: UGO_TEST_KEY, Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const spec = (await response.json()) as { paths?: Record<string, unknown> }
      documented = new Set(Object.keys(spec.paths || {}))
      catalogOk = documented.size > 0
    }
  } catch {
    catalogOk = false
  }

  const tables = await Promise.all(
    CONTRACT_TABLES.map(async (table) => {
      const result = await selectCount(adminDb.from(table).select('*', { count: 'exact', head: true }))
      if (result.status === 'error' && catalogOk && !documented.has(`/${table}`)) {
        return { name: table, status: 'missing' as LoadStatus, error: 'La tabla no aparece en el catálogo de la API.' }
      }
      return { name: table, status: result.status, error: result.error }
    }),
  )

  // Las RPC se verifican contra el catálogo OpenAPI de PostgREST: lectura pura, sin ejecutar nada.
  const rpcs: ContractRow[] = CONTRACT_RPCS.map((name) => {
    if (!catalogOk) return { name, status: 'error', error: 'No se pudo leer el catálogo de la API para verificar la función.' }
    return documented.has(`/rpc/${name}`)
      ? { name, status: 'ok', error: null }
      : { name, status: 'missing', error: 'La función no está expuesta por la API de este proyecto.' }
  })

  return { tables, rpcs, catalogOk }
}

/* ---------------------------------- métricas ---------------------------------- */

export type MetricId =
  | 'servicesActive'
  | 'providersOnline'
  | 'usersActive'
  | 'completedToday'
  | 'pixPending'
  | 'debtsReported'
  | 'disputesOpen'
  | 'verificationsPending'
  | 'documentsPending'
  | 'stalledServices'

export type MetricResult = { value: number | null; status: LoadStatus; error: string | null }
export type MetricsSnapshot = Record<MetricId, MetricResult>

const METRIC_EMPTY: MetricResult = { value: null, status: 'error', error: 'Sin datos' }

export async function loadMetrics(): Promise<MetricsSnapshot> {
  const today = startOfToday().toISOString()
  const stallLimit = new Date(Date.now() - 30 * 60000).toISOString()

  const [servicesActive, providersOnline, usersActive, completedToday, pixPending, debtsReported, disputesOpen, verificationsPending, documentsPending, stalledServices] =
    await Promise.all([
      selectCount(adminDb.from('servicios').select('id', { count: 'exact', head: true }).eq('ambiente', 'real').in('estado', [...ACTIVE_SERVICE_STATES])),
      selectCount(adminDb.from('perfiles_proveedor').select('usuario_id', { count: 'exact', head: true }).eq('online', true).eq('disponible', true)),
      selectCount(adminDb.from('usuarios').select('id', { count: 'exact', head: true }).eq('activo', true)),
      selectCount(adminDb.from('servicios').select('id', { count: 'exact', head: true }).eq('ambiente', 'real').eq('estado', 'completado').gte('completado_at', today)),
      selectCount(
        adminDb
          .from('pagos')
          .select('id', { count: 'exact', head: true })
          .eq('ambiente', 'real')
          .eq('metodo', 'pix_direto')
          .eq('estado', 'pendiente')
          .not('pix_informado_at', 'is', null),
      ),
      selectCount(adminDb.from('deudas_ugo_proveedor').select('id', { count: 'exact', head: true }).eq('ambiente', 'real').eq('estado', 'informado').gt('saldo_pendiente', 0)),
      selectCount(adminDb.from('disputas').select('id', { count: 'exact', head: true }).in('estado', ['abierta', 'en_revision'])),
      selectCount(adminDb.from('perfiles_proveedor').select('usuario_id', { count: 'exact', head: true }).in('estado_verificacion', ['registrado', 'pendiente'])),
      selectCount(adminDb.from('documentos').select('id', { count: 'exact', head: true }).in('estado', ['pendiente', 'procesando'])),
      selectCount(
        adminDb
          .from('servicios')
          .select('id', { count: 'exact', head: true })
          .eq('ambiente', 'real')
          .in('estado', ['buscando', 'ofrecido'])
          .lt('created_at', stallLimit),
      ),
    ])

  const toResult = (result: CountRes): MetricResult => ({
    value: result.status === 'ok' ? result.count ?? 0 : null,
    status: result.status,
    error: result.error,
  })

  return {
    servicesActive: toResult(servicesActive),
    providersOnline: toResult(providersOnline),
    usersActive: toResult(usersActive),
    completedToday: toResult(completedToday),
    pixPending: toResult(pixPending),
    debtsReported: toResult(debtsReported),
    disputesOpen: toResult(disputesOpen),
    verificationsPending: toResult(verificationsPending),
    documentsPending: toResult(documentsPending),
    stalledServices: toResult(stalledServices),
  }
}

export function emptyMetrics(): MetricsSnapshot {
  return {
    servicesActive: { ...METRIC_EMPTY },
    providersOnline: { ...METRIC_EMPTY },
    usersActive: { ...METRIC_EMPTY },
    completedToday: { ...METRIC_EMPTY },
    pixPending: { ...METRIC_EMPTY },
    debtsReported: { ...METRIC_EMPTY },
    disputesOpen: { ...METRIC_EMPTY },
    verificationsPending: { ...METRIC_EMPTY },
    documentsPending: { ...METRIC_EMPTY },
    stalledServices: { ...METRIC_EMPTY },
  }
}

/* ---------------------------------- acciones ---------------------------------- */

const RPC_MESSAGES: Array<[string, string]> = [
  ['ADMIN_REQUIRED', 'Tu sesión no tiene permisos de administración en UGO TEST.'],
  ['Acceso Admin requerido', 'Tu sesión no tiene permisos de administración en UGO TEST.'],
  ['Solo admin', 'Tu sesión no tiene permisos de administración en UGO TEST.'],
  ['PIX_REFERENCE_REQUIRED', 'Ingresá el identificador end-to-end del Pix (entre 6 y 160 caracteres).'],
  ['PIX_NOT_REPORTED', 'El cliente todavía no informó el Pix de este pago.'],
  ['PIX_ALREADY_RECONCILED', 'Ese Pix ya fue conciliado.'],
  ['PIX_REAL_ONLY', 'Solo se concilian pagos del ambiente real.'],
  ['PIX_DIRECT_ONLY', 'Ese pago no es Pix directo.'],
  ['PIX_STATE_CHANGED', 'El pago cambió de estado mientras conciliabas. Actualizá y reintentá.'],
  ['PAYMENT_NOT_FOUND', 'No encontramos ese pago.'],
  ['PAYMENT_REQUIRED', 'Falta el pago a conciliar.'],
  ['La referencia de cobro a UGO es obligatoria', 'Ingresá la referencia del cobro a UGO (mínimo 4 caracteres).'],
  ['Deuda inexistente', 'No encontramos esa deuda UGO.'],
  ['TRANSFER_REFERENCE_REQUIRED', 'Para marcar el retiro como pagado necesitás la referencia de la transferencia.'],
  ['INVALID_WITHDRAWAL_STATE', 'Estado de retiro inválido.'],
  ['INVALID_WITHDRAWAL_TRANSITION', 'Ese cambio de estado no está permitido por el contrato de retiros.'],
  ['WITHDRAWAL_ALREADY_FINAL', 'Ese retiro ya está cerrado (pagado o fallido).'],
  ['WITHDRAWAL_NOT_FOUND', 'No encontramos ese retiro.'],
  ['DEMO_WITHDRAWAL_FORBIDDEN', 'Los retiros DEMO no se procesan como dinero real.'],
  ['Resolución inválida', 'Elegí a favor de quién se resuelve la disputa.'],
  ['La resolución requiere una explicación', 'La resolución necesita una explicación de al menos 8 caracteres.'],
  ['Disputa no encontrada o ya resuelta', 'La disputa ya fue resuelta o no existe.'],
]

export function friendlyRpcError(error: unknown): string {
  const record = error as { message?: string; details?: string; hint?: string; code?: string } | null
  const raw = String(record?.message || record?.details || '')
  for (const [needle, message] of RPC_MESSAGES) {
    if (raw.includes(needle)) return message
  }
  if (record?.code === '42501') return 'Tu sesión no tiene permisos para esta operación.'
  if (record?.code === '42P01' || record?.code === 'PGRST202') return 'Ese contrato administrativo todavía no está disponible en UGO TEST.'
  if (/fetch|network|abort|failed to fetch/i.test(raw)) return 'No se pudo contactar UGO TEST. Revisá la conexión y reintentá.'
  return raw || 'La operación no se pudo completar.'
}

export type ActionOutcome = { ok: true } | { ok: false; message: string }

export async function callAdminRpc(fn: string, args: Record<string, unknown>): Promise<ActionOutcome> {
  try {
    const { error } = await adminDb.rpc(fn, args)
    if (error) return { ok: false, message: friendlyRpcError(error) }
    return { ok: true }
  } catch (error) {
    return { ok: false, message: friendlyRpcError(error) }
  }
}

export const setUserActive = (userId: string, active: boolean, motivo: string) =>
  callAdminRpc('admin_set_usuario_activo', { p_usuario_id: userId, p_activo: active, p_motivo: motivo })

export const resolveDispute = (disputeId: string, resolucion: string, favorDe: 'cliente' | 'proveedor') =>
  callAdminRpc('admin_resolver_disputa', { p_disputa_id: disputeId, p_resolucion: resolucion, p_favor_de: favorDe })

export const reconcilePix = (paymentId: string, aprobar: boolean, referencia: string | null, nota: string | null) =>
  callAdminRpc('conciliar_pix_direto', {
    p_pago_id: paymentId,
    p_aprobar: aprobar,
    p_referencia: referencia,
    p_nota: nota,
  })

export const confirmDebtCollected = (debtId: string, referencia: string, notas: string | null) =>
  callAdminRpc('admin_confirmar_deuda_ugo_pagada', { p_deuda_id: debtId, p_referencia: referencia, p_notas: notas })

export const updateWithdrawal = (withdrawalId: string, estado: 'procesando' | 'pagado' | 'fallido', referencia: string | null, notas: string | null) =>
  callAdminRpc('admin_actualizar_retiro', {
    p_retiro_id: withdrawalId,
    p_estado: estado,
    p_transferencia_externa_id: referencia,
    p_notas: notas,
  })
