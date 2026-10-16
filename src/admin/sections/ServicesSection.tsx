import { useEffect, useMemo, useState } from 'react'
import { loadServiceDetail, loadServices } from '../lib/data'
import { useAsync, useDebouncedValue } from '../lib/hooks'
import { formatDateTime, formatMoney, personName, relativeTime, truncate } from '../lib/format'
import { SERVICE_FILTERS, serviceState, paymentState, type ServiceFilterId } from '../lib/types'
import type { SectionProps } from '../lib/shell'
import { Chip, Drawer, EmptyState, KeyValue, Pagination, SearchInput, SectionHeader, Segmented, StatusNote, TableSkeleton, Timeline } from '../ui/kit'
import { IconChevron } from '../ui/icons'

const PAGE_SIZE = 40

const AMBIENTE_OPTIONS = [
  { id: 'real', label: 'Real' },
  { id: 'demo', label: 'Demo' },
  { id: 'todos', label: 'Todo' },
] as const

type DetailTab = 'resumen' | 'eventos' | 'evidencias' | 'pagos'

export default function ServicesSection({ shell, filter }: SectionProps) {
  const initial = (SERVICE_FILTERS.some((item) => item.id === filter) ? filter : 'activos') as ServiceFilterId
  const [stateFilter, setStateFilter] = useState<ServiceFilterId>(initial)
  const [ambiente, setAmbiente] = useState<'real' | 'demo' | 'todos'>('real')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('resumen')
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    setPage(0)
  }, [stateFilter, ambiente, debouncedSearch, shell.refreshToken])

  useEffect(() => {
    if (filter && SERVICE_FILTERS.some((item) => item.id === filter)) setStateFilter(filter as ServiceFilterId)
  }, [filter])

  const query = useAsync(
    () => loadServices({ filter: stateFilter, ambiente, search: debouncedSearch, page, pageSize: PAGE_SIZE }),
    [stateFilter, ambiente, debouncedSearch, page, shell.refreshToken],
  )

  const detail = useAsync(
    async () => (selected ? loadServiceDetail(selected) : null),
    [selected, shell.refreshToken],
  )

  const rows = query.data?.rows || []
  const status = query.data?.status || 'ok'

  const service = detail.data?.service.rows[0] || null
  const events = detail.data?.events.rows || []
  const evidence = detail.data?.evidence.rows || []
  const payments = detail.data?.payments.rows || []
  const disputes = detail.data?.disputes.rows || []

  const kv = useMemo(() => {
    if (!service) return []
    return [
      { label: 'Número', value: service.numero ? `#${service.numero}` : truncate(service.id, 12) },
      { label: 'Estado', value: <Chip label={serviceState(service.estado).label} tone={serviceState(service.estado).tone} /> },
      { label: 'Ambiente', value: service.ambiente || '—' },
      { label: 'Categoría', value: service.categoria ? `${service.categoria.emoji || ''} ${service.categoria.nombre || ''}`.trim() : service.categoria_id || '—' },
      { label: 'Cliente', value: personName(service.cliente) !== '—' ? personName(service.cliente) : truncate(service.cliente_id, 12) },
      { label: 'Profesional', value: personName(service.proveedor) !== '—' ? personName(service.proveedor) : truncate(service.proveedor_id, 12) },
      { label: 'Zona', value: service.zona || '—' },
      { label: 'Tarifa', value: formatMoney(service.tarifa, service.moneda || undefined) },
      { label: 'Comisión UGO', value: formatMoney(service.comision_ugo, service.moneda || undefined) },
      { label: 'Ganancia profesional', value: formatMoney(service.ganancia_proveedor, service.moneda || undefined) },
      { label: 'Creado', value: formatDateTime(service.created_at) },
      { label: 'Aceptado', value: formatDateTime(service.aceptado_at) },
      { label: 'Iniciado', value: formatDateTime(service.iniciado_at) },
      { label: 'Completado', value: formatDateTime(service.completado_at) },
      { label: 'Cancelado', value: formatDateTime(service.cancelado_at) },
    ]
  }, [service])

  return (
    <div className="ad-section">
      <SectionHeader
        title="Servicios"
        description="Ciclo completo de pedidos: matching, ejecución, evidencias y cierre."
        actions={
          <Segmented ariaLabel="Ambiente" value={ambiente} onChange={(next) => setAmbiente(next)} options={AMBIENTE_OPTIONS} />
        }
      />

      <div className="ad-toolbar">
        <Segmented
          ariaLabel="Estado del servicio"
          value={stateFilter}
          onChange={(next) => setStateFilter(next)}
          options={SERVICE_FILTERS.map((item) => ({ id: item.id, label: item.label }))}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número, descripción o zona" ariaLabel="Buscar servicios" />
      </div>

      {status !== 'ok' ? (
        <StatusNote variant={status === 'denied' ? 'denied' : 'missing'} title="Lectura de servicios restringida" onRetry={query.reload}>
          {query.data?.error}
        </StatusNote>
      ) : null}

      {query.loading && rows.length === 0 ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin servicios para este filtro"
          description="Puede que no existan pedidos con ese estado en el ambiente elegido, o que tu rol no tenga lectura sobre ellos. Probá con otro filtro o cambiá el ambiente."
        />
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Estado</th>
                <th>Cliente</th>
                <th>Profesional</th>
                <th>Zona</th>
                <th className="ad-num">Tarifa</th>
                <th className="ad-num">Creado</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = serviceState(row.estado)
                return (
                  <tr key={row.id} onClick={() => { setSelected(row.id); setTab('resumen') }} tabIndex={0} onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setSelected(row.id)
                      setTab('resumen')
                    }
                  }}>
                    <td>
                      <strong>{row.numero ? `#${row.numero}` : truncate(row.id, 8)}</strong>
                      <small>{truncate(row.descripcion, 46)}</small>
                    </td>
                    <td>
                      <Chip label={state.label} tone={state.tone} />
                    </td>
                    <td>{personName(row.cliente) !== '—' ? personName(row.cliente) : truncate(row.cliente_id, 8)}</td>
                    <td>{personName(row.proveedor) !== '—' ? personName(row.proveedor) : 'Sin asignar'}</td>
                    <td>{row.zona || '—'}</td>
                    <td className="ad-num">{formatMoney(row.tarifa, row.moneda || undefined)}</td>
                    <td className="ad-num">{relativeTime(row.created_at)}</td>
                    <td className="ad-row-action">
                      <IconChevron size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.count ?? null} onChange={setPage} loading={query.loading} />

      <Drawer
        open={Boolean(selected)}
        title={service?.numero ? `Servicio #${service.numero}` : 'Detalle del servicio'}
        subtitle={service ? `${serviceState(service.estado).label} · ${service.ambiente || 'ambiente sin definir'}` : 'Cargando expediente…'}
        onClose={() => setSelected(null)}
      >
        {detail.loading && !service ? (
          <TableSkeleton rows={4} columns={3} />
        ) : !service ? (
          <StatusNote variant="error" title="No pudimos abrir el expediente" onRetry={detail.reload}>
            {detail.data?.service.error || detail.error || 'El servicio no está disponible para tu rol.'}
          </StatusNote>
        ) : (
          <>
            <div className="ad-tabs" role="tablist" aria-label="Secciones del expediente">
              {([
                ['resumen', 'Resumen'],
                ['eventos', `Eventos (${events.length})`],
                ['evidencias', `Evidencias (${evidence.length})`],
                ['pagos', `Pagos (${payments.length})`],
              ] as Array<[DetailTab, string]>).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : undefined} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'resumen' ? (
              <>
                <KeyValue items={kv} />
                {disputes.length > 0 ? (
                  <div className="ad-inline-block">
                    <h4>Disputas asociadas</h4>
                    {disputes.map((dispute) => (
                      <div key={dispute.id} className="ad-inline-row">
                        <Chip label={dispute.estado || 'sin estado'} tone="red" />
                        <span>{truncate(dispute.motivo, 90)}</span>
                        <button type="button" className="ad-link" onClick={() => shell.navigate('disputes', 'todas')}>
                          Ver disputas
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === 'eventos' ? (
              detail.data?.events.status !== 'ok' ? (
                <StatusNote variant="missing" title="Historial de eventos no disponible">
                  {detail.data?.events.error}
                </StatusNote>
              ) : (
                <Timeline
                  items={events.map((event) => ({
                    id: String(event.id),
                    title: `${event.evento || 'evento'}${event.estado_nuevo ? ` → ${event.estado_nuevo}` : ''}`,
                    time: `${formatDateTime(event.created_at)} · ${relativeTime(event.created_at)}`,
                    detail: event.estado_anterior ? `Estado anterior: ${event.estado_anterior}` : undefined,
                  }))}
                />
              )
            ) : null}

            {tab === 'evidencias' ? (
              detail.data?.evidence.status !== 'ok' ? (
                <StatusNote variant="missing" title="Evidencias no disponibles">
                  {detail.data?.evidence.error}
                </StatusNote>
              ) : evidence.length === 0 ? (
                <EmptyState title="Sin evidencias cargadas" description="Cuando el profesional o el cliente suban fotos de inicio y cierre, aparecerán aquí." />
              ) : (
                <ul className="ad-list">
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.tipo || 'evidencia'}</strong>
                        <small>{formatDateTime(item.created_at)}</small>
                        <p>{truncate(item.descripcion, 120)}</p>
                      </div>
                      <code className="ad-path">{truncate(item.storage_path, 34)}</code>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === 'pagos' ? (
              detail.data?.payments.status !== 'ok' ? (
                <StatusNote variant="missing" title="Pagos no disponibles">
                  {detail.data?.payments.error}
                </StatusNote>
              ) : payments.length === 0 ? (
                <EmptyState title="Sin pagos registrados" description="El movimiento financiero del pedido todavía no se generó." />
              ) : (
                <ul className="ad-list">
                  {payments.map((payment) => (
                    <li key={payment.id}>
                      <div>
                        <strong>{formatMoney(payment.monto_bruto, payment.moneda || undefined)}</strong>
                        <small>
                          {payment.metodo || 'método sin definir'} · {payment.procesador || 'procesador sin definir'} · {formatDateTime(payment.created_at)}
                        </small>
                        <p>
                          Comisión UGO {formatMoney(payment.comision_ugo, payment.moneda || undefined)} · Profesional {formatMoney(payment.ganancia_proveedor, payment.moneda || undefined)}
                        </p>
                      </div>
                      <Chip label={paymentState(payment.estado).label} tone={paymentState(payment.estado).tone} />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </>
        )}
      </Drawer>
    </div>
  )
}
