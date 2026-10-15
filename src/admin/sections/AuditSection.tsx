import { useState } from 'react'
import { loadAudit } from '../lib/data'
import { useAsync, useDebouncedValue } from '../lib/hooks'
import { formatDateTime, relativeTime, truncate } from '../lib/format'
import type { SectionProps } from '../lib/shell'
import { Drawer, EmptyState, KeyValue, SearchInput, SectionHeader, StatusNote, TableSkeleton } from '../ui/kit'
import type { AuditRow } from '../lib/types'

function pretty(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AuditSection({ shell }: SectionProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const debounced = useDebouncedValue(search)

  const query = useAsync(() => loadAudit(debounced), [debounced, shell.refreshToken])
  const rows = query.data?.rows || []
  const status = query.data?.status || 'ok'

  return (
    <div className="ad-section">
      <SectionHeader
        title="Auditoría"
        description="Trazabilidad de acciones del sistema: quién hizo qué, sobre qué entidad y cuándo."
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Filtrar por evento o entidad" ariaLabel="Buscar en auditoría" />}
      />

      {status !== 'ok' ? (
        <StatusNote variant={status === 'denied' ? 'denied' : 'missing'} title="Registro de auditoría restringido" onRetry={query.reload}>
          {query.data?.error}
        </StatusNote>
      ) : null}

      {query.loading && rows.length === 0 ? (
        <TableSkeleton columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin eventos para mostrar" description="El registro de auditoría se llena con acciones del sistema, RPC administrativas y flujos de servicio." />
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Actor</th>
                <th>Entidad</th>
                <th>Detalle</th>
                <th className="ad-num">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} onClick={() => setSelected(row)}>
                  <td>
                    <strong>{row.evento || 'evento sin nombre'}</strong>
                    <small>{relativeTime(row.created_at)}</small>
                  </td>
                  <td>{row.actor_tipo || truncate(row.actor_id, 10)}</td>
                  <td>
                    {row.entidad_tipo || '—'}
                    <small>{truncate(row.entidad_id, 12)}</small>
                  </td>
                  <td className="ad-clip">{truncate(pretty(row.detalles).replace(/\s+/g, ' '), 70)}</td>
                  <td className="ad-num">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={Boolean(selected)} title={selected?.evento || 'Evento auditado'} subtitle={selected ? formatDateTime(selected.created_at) : undefined} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <KeyValue
              items={[
                { label: 'ID', value: <code>{String(selected.id)}</code> },
                { label: 'Actor', value: `${selected.actor_tipo || 'sistema'} · ${selected.actor_id || 'sin id'}` },
                { label: 'Entidad', value: `${selected.entidad_tipo || '—'} · ${selected.entidad_id || '—'}` },
                { label: 'Fecha', value: formatDateTime(selected.created_at) },
              ]}
            />
            <div className="ad-inline-block">
              <h4>Detalles</h4>
              <pre className="ad-json">{pretty(selected.detalles)}</pre>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
