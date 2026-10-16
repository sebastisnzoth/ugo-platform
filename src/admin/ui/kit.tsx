import { useEffect, type ReactNode } from 'react'
import { IconAlert, IconCheck, IconClose, IconSearch } from './icons'
import { formatNumber } from '../lib/format'
import type { Tone } from '../lib/types'

export type ToastTone = 'info' | 'success' | 'error'
export type Toast = { id: number; message: string; tone: ToastTone }

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <span className={`ad-chip ad-chip-${tone}`}>{label}</span>
}

export function Avatar({ name, tone = 'green' }: { name: string; tone?: 'green' | 'lime' | 'violet' }) {
  return <span className={`ad-avatar ad-avatar-${tone}`}>{name}</span>
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="ad-page-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ad-page-actions">{actions}</div> : null}
    </div>
  )
}

export function Kpi({
  label,
  value,
  hint,
  tone = 'green',
  icon,
  loading,
}: {
  label: string
  value: number | string | null
  hint?: string
  tone?: Tone
  icon?: ReactNode
  loading?: boolean
}) {
  const display = value === null ? '—' : typeof value === 'number' ? formatNumber(value) : value
  return (
    <article className={`ad-kpi ad-kpi-${tone}`}>
      <header>
        <span className="ad-kpi-label">{label}</span>
        {icon ? <span className={`ad-kpi-icon ad-icon-${tone}`}>{icon}</span> : null}
      </header>
      <strong className={loading ? 'ad-kpi-value ad-skeleton-inline' : 'ad-kpi-value'}>{loading ? '' : display}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  )
}

export function StatusNote({
  variant,
  title,
  children,
  onRetry,
}: {
  variant: 'info' | 'warn' | 'missing' | 'denied' | 'error'
  title: string
  children?: ReactNode
  onRetry?: () => void
}) {
  return (
    <div className={`ad-note ad-note-${variant}`} role="status">
      <span className="ad-note-icon">{variant === 'info' ? <IconCheck size={16} /> : <IconAlert size={16} />}</span>
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" className="ad-button ad-button-ghost" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="ad-empty">
      <span className="ad-empty-mark">◍</span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="ad-skeleton" role="status" aria-label="Cargando datos">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="ad-skeleton-row" key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <span key={columnIndex} style={{ width: `${45 + ((rowIndex + columnIndex) % 5) * 11}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { id: T; label: string; badge?: number }[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div className="ad-segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? 'is-active' : undefined}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {typeof option.badge === 'number' && option.badge > 0 ? <em>{formatNumber(option.badge)}</em> : null}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  ariaLabel: string
  id?: string
}) {
  return (
    <label className="ad-search" htmlFor={id}>
      <IconSearch size={16} />
      <input id={id} type="search" value={value} placeholder={placeholder} aria-label={ariaLabel} onChange={(event) => onChange(event.target.value)} />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <IconClose size={14} />
        </button>
      ) : null}
    </label>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  loading,
}: {
  page: number
  pageSize: number
  total: number | null
  onChange: (next: number) => void
  loading?: boolean
}) {
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = total === null ? (page + 1) * pageSize : Math.min((page + 1) * pageSize, total)
  const hasNext = total === null ? true : to < total
  return (
    <div className="ad-pagination">
      <span>
        {formatNumber(from)}–{formatNumber(to)}
        {total === null ? '' : ` de ${formatNumber(total)}`}
      </span>
      <div>
        <button type="button" className="ad-button ad-button-ghost" disabled={page === 0 || loading} onClick={() => onChange(page - 1)}>
          Anterior
        </button>
        <button type="button" className="ad-button ad-button-ghost" disabled={!hasNext || loading} onClick={() => onChange(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="ad-drawer-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ad-drawer-backdrop" aria-label="Cerrar panel" onClick={onClose} />
      <aside className="ad-drawer">
        <header>
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="ad-icon-button" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </header>
        <div className="ad-drawer-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </aside>
    </div>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="ad-modal-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ad-drawer-backdrop" aria-label="Cerrar" onClick={onClose} />
      <section className="ad-modal">
        <header>
          <h3>{title}</h3>
          <button type="button" className="ad-icon-button" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </header>
        {description ? <p className="ad-modal-description">{description}</p> : null}
        <div className="ad-modal-body">{children}</div>
      </section>
    </div>
  )
}

export function KeyValue({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="ad-kv">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Timeline({ items }: { items: Array<{ id: string; title: string; time: string; detail?: ReactNode }> }) {
  if (items.length === 0) return <p className="ad-muted">Sin eventos registrados para este servicio.</p>
  return (
    <ol className="ad-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <span className="ad-timeline-dot" />
          <div>
            <strong>{item.title}</strong>
            <small>{item.time}</small>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PulseChart({ points }: { points: Array<{ label: string; created: number; completed: number }> }) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.created, point.completed)))
  return (
    <div className="ad-chart">
      <div className="ad-chart-legend">
        <span className="ad-legend-lime">Nuevos pedidos</span>
        <span className="ad-legend-green">Completados</span>
      </div>
      <div className="ad-chart-plot" role="img" aria-label="Pedidos creados y completados por día">
        {points.map((point) => (
          <div className="ad-chart-column" key={point.label} title={`${point.label} · nuevos ${point.created} · completados ${point.completed}`}>
            <div className="ad-chart-bars">
              <span className="ad-bar ad-bar-lime" style={{ height: `${Math.round((point.created / max) * 100)}%` }} />
              <span className="ad-bar ad-bar-green" style={{ height: `${Math.round((point.completed / max) * 100)}%` }} />
            </div>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="ad-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`ad-toast ad-toast-${toast.tone}`} key={toast.id}>
          <span>{toast.tone === 'success' ? <IconCheck size={16} /> : toast.tone === 'error' ? <IconAlert size={16} /> : null}</span>
          <p>{toast.message}</p>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso">
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
