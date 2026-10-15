import { useMemo, useState } from 'react'
import { useAsync } from '../lib/hooks'
import { loadPulse, loadRecentAudit } from '../lib/data'
import { dayKey, formatDateTime, relativeTime } from '../lib/format'
import type { SectionProps } from '../lib/shell'
import { Kpi, PulseChart, Segmented, SectionHeader, StatusNote } from '../ui/kit'
import { IconAlert, IconBolt, IconCheck, IconClock, IconUsers, IconWallet, IconWrench } from '../ui/icons'

type Attention = {
  id: string
  title: string
  detail: string
  count: number | null
  severity: 'high' | 'medium' | 'low'
  action: string
  go: () => void
}

export default function OverviewSection({ shell }: SectionProps) {
  const [range, setRange] = useState<'14' | '30'>('14')
  const days = Number(range)

  const pulse = useAsync(() => loadPulse(days), [shell.refreshToken, days])
  const audit = useAsync(() => loadRecentAudit(7), [shell.refreshToken])

  const chartPoints = useMemo(() => {
    const buckets = new Map<string, { created: number; completed: number }>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(today)
      date.setDate(date.getDate() - index)
      buckets.set(dayKey(date), { created: 0, completed: 0 })
    }
    for (const row of pulse.data?.rows || []) {
      if (row.created_at) {
        const key = dayKey(new Date(row.created_at))
        const bucket = buckets.get(key)
        if (bucket) bucket.created += 1
      }
      if (row.completado_at) {
        const key = dayKey(new Date(row.completado_at))
        const bucket = buckets.get(key)
        if (bucket) bucket.completed += 1
      }
    }
    return Array.from(buckets.entries()).map(([key, value]) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      created: value.created,
      completed: value.completed,
    }))
  }, [pulse.data, days])

  const metrics = shell.metrics
  const attention = useMemo<Attention[]>(() => {
    const build: Attention[] = [
      {
        id: 'pix',
        title: 'Pix informados sin conciliar',
        detail: 'El cliente avisó el pago y la bóveda sigue esperando tu validación.',
        count: metrics.pixPending.value,
        severity: 'high',
        action: 'Ir a conciliación',
        go: () => shell.navigate('finance', 'pix'),
      },
      {
        id: 'disputes',
        title: 'Disputas abiertas o en revisión',
        detail: 'Cada caso necesita resolución escrita y queda auditado.',
        count: metrics.disputesOpen.value,
        severity: 'high',
        action: 'Abrir disputas',
        go: () => shell.navigate('disputes', 'abiertas'),
      },
      {
        id: 'debt',
        title: 'Comisiones UGO informadas',
        detail: 'Proveedores que transfirieron la comisión y esperan confirmación.',
        count: metrics.debtsReported.value,
        severity: 'medium',
        action: 'Ver comisiones',
        go: () => shell.navigate('finance', 'debts'),
      },
      {
        id: 'verification',
        title: 'Profesionales por verificar',
        detail: 'Perfiles en estado registrado o pendiente de revisión documental.',
        count: metrics.verificationsPending.value,
        severity: 'medium',
        action: 'Revisar legajos',
        go: () => shell.navigate('providers', 'pendientes'),
      },
      {
        id: 'stalled',
        title: 'Pedidos sin match hace más de 30 min',
        detail: 'Servicios en buscando/ofrecido que pueden requerir intervención manual.',
        count: metrics.stalledServices.value,
        severity: 'medium',
        action: 'Ver pedidos',
        go: () => shell.navigate('services', 'buscando'),
      },
      {
        id: 'documents',
        title: 'Documentos pendientes de revisión',
        detail: 'Archivos cargados por profesionales que todavía no fueron aprobados.',
        count: metrics.documentsPending.value,
        severity: 'low',
        action: 'Ver documentos',
        go: () => shell.navigate('providers', 'documentos'),
      },
    ]
    return build.sort((a, b) => {
      const weight = { high: 0, medium: 1, low: 2 }
      const countA = a.count ?? -1
      const countB = b.count ?? -1
      if (weight[a.severity] !== weight[b.severity]) return weight[a.severity] - weight[b.severity]
      return countB - countA
    })
  }, [metrics, shell])

  const pendingTotal = attention.reduce((total, item) => total + (item.count && item.count > 0 ? item.count : 0), 0)

  return (
    <div className="ad-section">
      <SectionHeader
        title="Visión general"
        description={
          shell.lastRefresh
            ? `Lectura directa de UGO TEST · actualizado ${relativeTime(shell.lastRefresh.toISOString())}`
            : 'Lectura directa de UGO TEST'
        }
        actions={
          <Segmented
            ariaLabel="Rango de días"
            value={range}
            onChange={(next) => setRange(next)}
            options={[
              { id: '14', label: '14 días' },
              { id: '30', label: '30 días' },
            ]}
          />
        }
      />

      {shell.metricsError ? (
        <StatusNote variant="warn" title="Indicadores incompletos" onRetry={shell.refresh}>
          {shell.metricsError}
        </StatusNote>
      ) : null}

      <div className="ad-kpi-grid">
        <Kpi label="Servicios activos" value={metrics.servicesActive.value} hint="Ambiente real, en curso" tone="green" icon={<IconWrench size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Profesionales online" value={metrics.providersOnline.value} hint="Online y disponibles" tone="lime" icon={<IconBolt size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Usuarios activos" value={metrics.usersActive.value} hint="Todas las cuentas activas" tone="blue" icon={<IconUsers size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Completados hoy" value={metrics.completedToday.value} hint="Con completado_at de hoy" tone="violet" icon={<IconCheck size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Pix por conciliar" value={metrics.pixPending.value} hint="Informados por el cliente" tone="amber" icon={<IconWallet size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Comisiones informadas" value={metrics.debtsReported.value} hint="Deuda UGO con saldo" tone="amber" icon={<IconWallet size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Disputas abiertas" value={metrics.disputesOpen.value} hint="Abiertas o en revisión" tone="red" icon={<IconAlert size={16} />} loading={shell.metricsLoading} />
        <Kpi label="Pedidos demorados" value={metrics.stalledServices.value} hint="Sin match hace +30 min" tone="neutral" icon={<IconClock size={16} />} loading={shell.metricsLoading} />
      </div>

      <div className="ad-overview-grid">
        <section className="ad-card ad-card-wide">
          <header className="ad-card-head">
            <div>
              <h3>Pulso operativo</h3>
              <p>Pedidos creados y completados por día en el ambiente real.</p>
            </div>
            <span className="ad-card-tag">{pendingTotal > 0 ? `${pendingTotal} pendientes` : 'Sin pendientes críticos'}</span>
          </header>
          {pulse.loading ? (
            <div className="ad-chart-skeleton" />
          ) : pulse.data && pulse.data.status !== 'ok' ? (
            <StatusNote variant={pulse.data.status === 'denied' ? 'denied' : 'missing'} title="No pudimos leer la serie de servicios" onRetry={pulse.reload}>
              {pulse.data.error}
            </StatusNote>
          ) : (
            <PulseChart points={chartPoints} />
          )}
        </section>

        <section className="ad-card">
          <header className="ad-card-head">
            <div>
              <h3>Requiere tu atención</h3>
              <p>Cola viva calculada con datos reales, sin valores inventados.</p>
            </div>
          </header>
          <ul className="ad-attention">
            {attention.map((item) => (
              <li key={item.id} className={`ad-attention-${item.severity}`}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <span className="ad-attention-count">{item.count === null ? '—' : item.count}</span>
                <button type="button" className="ad-button ad-button-ghost" onClick={item.go}>
                  {item.action}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="ad-card">
          <header className="ad-card-head">
            <div>
              <h3>Últimos movimientos auditados</h3>
              <p>Registro de <code>audit_log</code> con actor, entidad y evento.</p>
            </div>
            <button type="button" className="ad-button ad-button-ghost" onClick={() => shell.navigate('audit')}>
              Ver auditoría
            </button>
          </header>
          {audit.loading ? (
            <div className="ad-chart-skeleton" />
          ) : audit.data && audit.data.status !== 'ok' ? (
            <StatusNote variant={audit.data.status === 'denied' ? 'denied' : 'missing'} title="Sin acceso al registro de auditoría" onRetry={audit.reload}>
              {audit.data.error}
            </StatusNote>
          ) : audit.data && audit.data.rows.length === 0 ? (
            <p className="ad-muted">Todavía no hay eventos auditados en UGO TEST.</p>
          ) : (
            <ul className="ad-feed">
              {(audit.data?.rows || []).map((row) => (
                <li key={String(row.id)}>
                  <span className="ad-feed-dot" />
                  <div>
                    <strong>{row.evento || 'evento sin nombre'}</strong>
                    <small>
                      {row.entidad_tipo || 'entidad'} · {relativeTime(row.created_at)} · {formatDateTime(row.created_at)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
