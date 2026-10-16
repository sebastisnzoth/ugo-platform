const BRL = 'BRL'

export function formatMoney(value: number | null | undefined, currency = BRL): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || BRL, maximumFractionDigits: 2 }).format(Number(value))
  } catch {
    return `${Number(value).toFixed(2)} ${currency || BRL}`
  }
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('pt-BR').format(Number(value))
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(value: string | null | undefined, from: Date = new Date()): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = date.getTime() - from.getTime()
  const abs = Math.abs(diff)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ]
  const formatter = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }
  return 'ahora'
}

export function initials(...values: Array<string | null | undefined>): string {
  const text = values.filter(Boolean).join(' ').trim()
  if (!text) return 'U'
  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
}

export function personName(person: { nombre?: string | null; apellido?: string | null } | null | undefined): string {
  if (!person) return '—'
  const text = `${person.nombre || ''} ${person.apellido || ''}`.trim()
  return text || '—'
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000)
}

export function truncate(value: string | null | undefined, max = 64): string {
  if (!value) return '—'
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

const SECRET_KEY = /(secret|token|password|senha|clave|api_key|apikey|credential|private)/i

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key)
}

export function maskValue(value: string | null | undefined, key: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (!isSecretKey(key)) return value
  return `•••••••• (${value.length} caracteres, oculto)`
}

// PostgREST espera comas y paréntesis como sintaxis de filtros: se limpian del texto libre.
export function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
}
