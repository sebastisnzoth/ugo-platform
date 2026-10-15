import { useEffect, useState } from 'react'
import { loadDisputeMessages, loadDisputes, resolveDispute } from '../lib/data'
import { useAsync } from '../lib/hooks'
import { formatDateTime, formatMoney, personName, relativeTime, truncate } from '../lib/format'
import { disputeState, type DisputeRow } from '../lib/types'
import type { SectionProps } from '../lib/shell'
import { Chip, Drawer, EmptyState, Field, KeyValue, SectionHeader, Segmented, StatusNote, TableSkeleton, Timeline } from '../ui/kit'

const FILTERS = [
  { id: 'abiertas', label: 'Abiertas' },
  { id: 'resueltas', label: 'Resueltas' },
  { id: 'todas', label: 'Todas' },
] as const

type DisputeFilter = (typeof FILTERS)[number]['id']

export default function DisputesSection({ shell, filter }: SectionProps) {
  const initial = (FILTERS.some((item) => item.id === filter) ? filter : 'abiertas') as DisputeFilter
  const [stateFilter, setStateFilter] = useState<DisputeFilter>(initial)
  const [selected, setSelected] = useState<DisputeRow | null>(null)
  const [favorDe, setFavorDe] = useState<'cliente' | 'proveedor'>('cliente')
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (filter && FILTERS.some((item) => item.id === filter)) setStateFilter(filter as DisputeFilter)
  }, [filter])

  const query = useAsync(
    () =>
      loadDisputes(
        stateFilter === 'abiertas' ? 'abiertas' : stateFilter === 'resueltas' ? 'resueltas' : 'todos',
      ),
    [stateFilter, shell.refreshToken],
  )

  const messages = useAsync(async () => (selected ? loadDisputeMessages(selected.id) : null), [selected?.id, shell.refreshToken])

  const rows = query.data?.rows || []
  const status = query.data?.status || 'ok'
  const canResolve = Boolean(selected && (selected.estado === 'abierta' || selected.estado === 'en_revision'))

  async function applyResolution() {
    if (!selected) return
    if (resolution.trim().length < 8) {
      shell.notify('La resolución necesita al menos 8 caracteres de explicación.', 'error')
      return
    }
    setBusy(true)
    const outcome = await resolveDispute(selected.id, resolution.trim(), favorDe)
    setBusy(false)
    if (!outcome.ok) {
      shell.notify(outcome.message, 'error')
      return
    }
    shell.notify(`Disputa resuelta a favor de ${favorDe === 'cliente' ? 'el cliente' : 'el profesional'}. Se notificó a las partes y quedó auditada.`, 'success')
    setResolution('')
    setSelected(null)
    query.reload()
    shell.refresh()
  }

  return (
    <div className="ad-section">
      <SectionHeader
        title="Disputas"
        description="Casos abiertos por clientes o profesionales, con evidencia y resolución auditada."
        actions={<span className="ad-card-tag">{shell.metrics.disputesOpen.value ?? '—'} activas</span>}
      />

      <div className="ad-toolbar">
        <Segmented ariaLabel="Estado de disputas" value={stateFilter} onChange={(next) => setStateFilter(next)} options={FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
      </div>

      {status !== 'ok' ? (
        <StatusNote variant={status === 'denied' ? 'denied' : 'missing'} title="Lectura de disputas restringida" onRetry={query.reload}>
          {query.data?.error}
        </StatusNote>
      ) : null}

      {query.loading && rows.length === 0 ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin disputas en esta vista"
          description="Cuando un cliente o profesional abra un caso, aparece acá con su servicio, monto y conversación."
        />
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Servicio</th>
                <th>Cliente</th>
                <th>Profesional</th>
                <th>Estado</th>
                <th className="ad-num">Monto</th>
                <th className="ad-num">Abierta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = disputeState(row.estado)
                return (
                  <tr key={row.id} onClick={() => { setSelected(row); setResolution(''); setFavorDe('cliente') }}>
                    <td>
                      <strong>{row.numero ? `#${row.numero}` : truncate(row.id, 8)}</strong>
                      <small>{truncate(row.motivo, 48)}</small>
                    </td>
                    <td>{row.servicio?.numero ? `#${row.servicio.numero}` : truncate(row.servicio_id, 8)}</td>
                    <td>{personName(row.cliente) !== '—' ? personName(row.cliente) : truncate(row.cliente_id, 8)}</td>
                    <td>{personName(row.proveedor) !== '—' ? personName(row.proveedor) : truncate(row.proveedor_id, 8)}</td>
                    <td>
                      <Chip label={state.label} tone={state.tone} />
                    </td>
                    <td className="ad-num">{formatMoney(row.monto_disputado)}</td>
                    <td className="ad-num">{relativeTime(row.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={Boolean(selected)}
        title={selected?.numero ? `Disputa #${selected.numero}` : 'Expediente de disputa'}
        subtitle={selected ? `${disputeState(selected.estado).label} · abierta ${relativeTime(selected.created_at)}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <KeyValue
              items={[
                { label: 'Estado', value: <Chip label={disputeState(selected.estado).label} tone={disputeState(selected.estado).tone} /> },
                { label: 'Servicio', value: selected.servicio?.numero ? `#${selected.servicio.numero}` : truncate(selected.servicio_id, 10) },
                { label: 'Monto disputado', value: formatMoney(selected.monto_disputado) },
                { label: 'Motivo', value: selected.motivo || '—' },
                { label: 'Resolución', value: selected.resolucion || 'Sin resolución registrada' },
                { label: 'A favor de', value: selected.resolucion_favor || '—' },
                { label: 'Abierta', value: formatDateTime(selected.created_at) },
                { label: 'Resuelta', value: formatDateTime(selected.resuelta_at) },
              ]}
            />

            <div className="ad-inline-block">
              <h4>Conversación del caso</h4>
              {messages.loading ? (
                <TableSkeleton rows={3} columns={2} />
              ) : messages.data?.status !== 'ok' ? (
                <StatusNote variant="missing" title="Mensajes no disponibles">
                  {messages.data?.error}
                </StatusNote>
              ) : (messages.data?.rows || []).length === 0 ? (
                <p className="ad-muted">Todavía no hay mensajes en <code>disputa_mensajes</code> para este caso.</p>
              ) : (
                <Timeline
                  items={(messages.data?.rows || []).map((message) => ({
                    id: String(message.id),
                    title: `${message.autor_rol || 'participante'}: ${truncate(message.mensaje, 90)}`,
                    time: `${formatDateTime(message.created_at)} · ${relativeTime(message.created_at)}`,
                  }))}
                />
              )}
            </div>

            {canResolve ? (
              <div className="ad-inline-block ad-resolve">
                <h4>Resolver la disputa</h4>
                <Segmented
                  ariaLabel="Favor de"
                  value={favorDe}
                  onChange={(next) => setFavorDe(next)}
                  options={[
                    { id: 'cliente', label: 'A favor del cliente' },
                    { id: 'proveedor', label: 'A favor del profesional' },
                  ]}
                />
                <Field label="Resolución" hint="Mínimo 8 caracteres. Se guarda en el expediente, se notifica a las partes y queda en audit_log.">
                  <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={4} placeholder="Explicá brevemente por qué se resuelve así y qué pasa con el pago." />
                </Field>
                <button type="button" className="ad-button ad-button-primary ad-button-block" disabled={busy} onClick={applyResolution}>
                  {busy ? 'Resolviendo…' : `Resolver a favor de ${favorDe === 'cliente' ? 'el cliente' : 'el profesional'}`}
                </button>
              </div>
            ) : (
              <StatusNote variant="info" title="Caso cerrado">
                Esta disputa ya tiene resolución registrada. El detalle queda disponible para auditoría.
              </StatusNote>
            )}
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
