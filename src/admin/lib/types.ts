// Contratos de datos verificados contra UGO TEST (tablas y columnas que ya existen).
// Si un contrato no está disponible, la UI lo informa en lugar de inventar datos.

export type Tone = 'neutral' | 'lime' | 'green' | 'blue' | 'amber' | 'red' | 'violet'

export type ServiceRow = {
  id: string
  numero: number | null
  estado: string | null
  ambiente: string | null
  cliente_id: string | null
  proveedor_id: string | null
  categoria_id: string | null
  descripcion: string | null
  zona: string | null
  tarifa: number | null
  moneda: string | null
  comision_ugo: number | null
  ganancia_proveedor: number | null
  created_at: string | null
  aceptado_at?: string | null
  iniciado_at?: string | null
  completado_at?: string | null
  cancelado_at?: string | null
  categoria?: { nombre?: string | null; emoji?: string | null } | null
  cliente?: { nombre?: string | null; apellido?: string | null } | null
  proveedor?: { nombre?: string | null; apellido?: string | null } | null
}

export type ServiceEvent = {
  id: string | number
  actor_id?: string | null
  evento: string | null
  estado_anterior?: string | null
  estado_nuevo?: string | null
  detalles?: unknown
  created_at: string | null
}

export type EvidenceRow = {
  id: string
  tipo: string | null
  storage_path: string | null
  descripcion: string | null
  usuario_id?: string | null
  created_at: string | null
}

export type UserRow = {
  id: string
  nombre: string | null
  apellido: string | null
  tipo: string | null
  activo: boolean | null
  foto_url: string | null
  pais: string | null
  zona: string | null
  karma: number | null
  servicios_completados: number | null
  created_at: string | null
  updated_at: string | null
}

export type ClientProfile = {
  usuario_id: string
  telefono: string | null
  direccion: string | null
  barrio: string | null
  ciudad: string | null
}

export type ProviderRow = {
  usuario_id: string
  estado_verificacion: string | null
  motivo_rechazo?: string | null
  online: boolean | null
  disponible: boolean | null
  ciudad_base: string | null
  telefono_profesional?: string | null
  tarifa_base?: number | null
  experiencia_anos?: number | null
  bio?: string | null
  categoria_principal_id?: string | null
  updated_at?: string | null
  categoria?: { nombre?: string | null; emoji?: string | null } | null
  usuario?: { nombre?: string | null; apellido?: string | null; activo?: boolean | null; zona?: string | null } | null
}

export type PaymentRow = {
  id: string
  servicio_id: string | null
  ambiente: string | null
  metodo: string | null
  procesador?: string | null
  modelo_pago?: string | null
  estado: string | null
  monto_bruto: number | null
  comision_ugo: number | null
  ganancia_proveedor: number | null
  moneda: string | null
  pix_txid?: string | null
  pix_e2e_id?: string | null
  pix_informado_at?: string | null
  pix_conciliado_at?: string | null
  pix_conciliacion_nota?: string | null
  created_at: string | null
  autorizado_at?: string | null
  liberado_at?: string | null
  servicio?: { numero?: number | null; descripcion?: string | null } | null
}

export type DebtRow = {
  id: string
  pago_id: string | null
  servicio_id: string | null
  proveedor_id: string | null
  monto_servicio: number | null
  comision_ugo: number | null
  monto_pagado_ugo: number | null
  saldo_pendiente: number | null
  moneda: string | null
  estado: string | null
  referencia_pago: string | null
  pago_informado_at?: string | null
  pagado_at?: string | null
  ambiente: string | null
  created_at: string | null
  proveedor?: { nombre?: string | null; apellido?: string | null } | null
  servicio?: { numero?: number | null } | null
}

export type WithdrawalRow = {
  id: string
  proveedor_id: string | null
  ambiente: string | null
  monto: number | null
  moneda: string | null
  estado: string | null
  created_at: string | null
  procesado_at: string | null
  transferencia_externa_id: string | null
  notas?: string | null
  proveedor?: { nombre?: string | null; apellido?: string | null } | null
}

export type DisputeRow = {
  id: string
  numero: number | null
  servicio_id: string | null
  cliente_id: string | null
  proveedor_id: string | null
  estado: string | null
  motivo: string | null
  monto_disputado: number | null
  resolucion: string | null
  resolucion_favor: string | null
  created_at: string | null
  updated_at?: string | null
  resuelta_at?: string | null
  servicio?: { numero?: number | null; estado?: string | null } | null
  cliente?: { nombre?: string | null; apellido?: string | null } | null
  proveedor?: { nombre?: string | null; apellido?: string | null } | null
}

export type DisputeMessage = {
  id: number
  disputa_id: string
  autor_rol: string | null
  mensaje: string | null
  created_at: string | null
}

export type AuditRow = {
  id: number | string
  evento: string | null
  actor_id?: string | null
  actor_tipo?: string | null
  entidad_tipo?: string | null
  entidad_id?: string | null
  detalles?: unknown
  created_at: string | null
}

export type DocumentRow = {
  id: string
  usuario_id: string
  tipo: string | null
  estado: string | null
  url_storage: string | null
  descripcion: string | null
  notas?: string | null
  notas_rechazo?: string | null
  created_at: string | null
  updated_at?: string | null
  revisado_at?: string | null
}

export type CategoryRow = {
  id: string
  nombre: string | null
  emoji: string | null
}

export type ConfigRow = {
  clave: string
  valor: string | null
  grupo: string | null
}

export type ServiceStateMeta = { label: string; tone: Tone }

const SERVICE_STATES: Record<string, ServiceStateMeta> = {
  buscando: { label: 'Buscando', tone: 'blue' },
  ofrecido: { label: 'Ofrecido', tone: 'violet' },
  asignado: { label: 'Asignado', tone: 'lime' },
  programado: { label: 'Programado', tone: 'blue' },
  en_camino: { label: 'En camino', tone: 'amber' },
  llegado: { label: 'Llegó', tone: 'amber' },
  en_progreso: { label: 'En progreso', tone: 'violet' },
  esperando_aprobacion: { label: 'Esperando aprobación', tone: 'amber' },
  disputado: { label: 'En disputa', tone: 'red' },
  completado: { label: 'Completado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
}

const PAYMENT_STATES: Record<string, ServiceStateMeta> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  retenido: { label: 'Retenido en bóveda', tone: 'blue' },
  liberado: { label: 'Liberado', tone: 'green' },
  reembolsado: { label: 'Reembolsado', tone: 'violet' },
  disputado: { label: 'En disputa', tone: 'red' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
  fallido: { label: 'Fallido', tone: 'red' },
  autorizado: { label: 'Autorizado', tone: 'lime' },
}

const VERIFICATION_STATES: Record<string, ServiceStateMeta> = {
  registrado: { label: 'Registrado', tone: 'neutral' },
  pendiente: { label: 'En revisión', tone: 'amber' },
  aprobado: { label: 'Aprobado', tone: 'lime' },
  verificado: { label: 'Verificado', tone: 'green' },
  rechazado: { label: 'Rechazado', tone: 'red' },
}

const DEBT_STATES: Record<string, ServiceStateMeta> = {
  pendiente: { label: 'Pendiente', tone: 'neutral' },
  informado: { label: 'Informado por proveedor', tone: 'amber' },
  parcial: { label: 'Parcial', tone: 'blue' },
  pagado: { label: 'Pagado', tone: 'green' },
  anulado: { label: 'Anulado', tone: 'neutral' },
}

const WITHDRAWAL_STATES: Record<string, ServiceStateMeta> = {
  solicitado: { label: 'Solicitado', tone: 'amber' },
  aprobado: { label: 'Aprobado', tone: 'blue' },
  procesando: { label: 'Procesando', tone: 'violet' },
  pagado: { label: 'Pagado', tone: 'green' },
  fallido: { label: 'Fallido', tone: 'red' },
  rechazado: { label: 'Rechazado', tone: 'red' },
}

const DISPUTE_STATES: Record<string, ServiceStateMeta> = {
  abierta: { label: 'Abierta', tone: 'red' },
  en_revision: { label: 'En revisión', tone: 'amber' },
  resuelta_cliente: { label: 'Resuelta · cliente', tone: 'blue' },
  resuelta_proveedor: { label: 'Resuelta · proveedor', tone: 'violet' },
  reembolsada: { label: 'Reembolsada', tone: 'green' },
  cerrada: { label: 'Cerrada', tone: 'neutral' },
}

function pick(map: Record<string, ServiceStateMeta>, value: string | null | undefined): ServiceStateMeta {
  if (!value) return { label: 'Sin estado', tone: 'neutral' }
  return map[value] || { label: value.replace(/_/g, ' '), tone: 'neutral' }
}

export const serviceState = (value: string | null | undefined) => pick(SERVICE_STATES, value)
export const paymentState = (value: string | null | undefined) => pick(PAYMENT_STATES, value)
export const verificationState = (value: string | null | undefined) => pick(VERIFICATION_STATES, value)
export const debtState = (value: string | null | undefined) => pick(DEBT_STATES, value)
export const withdrawalState = (value: string | null | undefined) => pick(WITHDRAWAL_STATES, value)
export const disputeState = (value: string | null | undefined) => pick(DISPUTE_STATES, value)

export const USER_TYPES: Record<string, string> = {
  cliente: 'Cliente',
  proveedor: 'Profesional',
  admin: 'Admin',
  superadmin: 'Super admin',
  arbitro: 'Árbitro',
}

export function userTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Sin rol'
  return USER_TYPES[value] || value
}

export const ACTIVE_SERVICE_STATES = [
  'buscando',
  'ofrecido',
  'asignado',
  'programado',
  'en_camino',
  'llegado',
  'en_progreso',
  'esperando_aprobacion',
  'disputado',
] as const

export const SERVICE_FILTERS = [
  { id: 'activos', label: 'Activos' },
  { id: 'buscando', label: 'Buscando' },
  { id: 'asignado', label: 'Asignados' },
  { id: 'en_camino', label: 'En camino' },
  { id: 'esperando_aprobacion', label: 'Por aprobar' },
  { id: 'disputado', label: 'En disputa' },
  { id: 'completado', label: 'Completados' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
] as const

export type ServiceFilterId = (typeof SERVICE_FILTERS)[number]['id']

export function resolveServiceStates(filter: string | null | undefined): string[] | null {
  switch (filter) {
    case 'activos':
      return [...ACTIVE_SERVICE_STATES]
    case 'todos':
    case null:
    case undefined:
    case '':
      return null
    default:
      return [filter]
  }
}
