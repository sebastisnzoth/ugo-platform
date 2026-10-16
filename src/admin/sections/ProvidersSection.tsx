import { useEffect, useState } from 'react'
import { loadPendingDocuments, loadProviderDocuments, loadProviders } from '../lib/data'
import { useAsync, useDebouncedValue } from '../lib/hooks'
import { formatDateTime, formatMoney, initials, personName, relativeTime, truncate } from '../lib/format'
import { verificationState, type ProviderRow } from '../lib/types'
import type { SectionProps } from '../lib/shell'
import { Avatar, Chip, Drawer, EmptyState, KeyValue, Pagination, SearchInput, SectionHeader, Segmented, StatusNote, TableSkeleton } from '../ui/kit'

const PAGE_SIZE = 40

const VERIFICATION_FILTERS = [
  { id: 'pendientes', label: 'Por revisar' },
  { id: 'verificado', label: 'Verificados' },
  { id: 'rechazado', label: 'Rechazados' },
  { id: 'todos', label: 'Todos' },
  { id: 'documentos', label: 'Documentos' },
] as const

type VerificationFilter = (typeof VERIFICATION_FILTERS)[number]['id']

export default function ProvidersSection({ shell, filter }: SectionProps) {
  const initial = (VERIFICATION_FILTERS.some((item) => item.id === filter) ? filter : 'pendientes') as VerificationFilter
  const [verification, setVerification] = useState<VerificationFilter>(initial)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ProviderRow | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    setPage(0)
  }, [verification, debouncedSearch, shell.refreshToken])

  useEffect(() => {
    if (filter && VERIFICATION_FILTERS.some((item) => item.id === filter)) setVerification(filter as VerificationFilter)
  }, [filter])

  const showDocuments = verification === 'documentos'

  const providers = useAsync(
    () => loadProviders({ estadoVerificacion: showDocuments ? 'todos' : verification, search: debouncedSearch, page, pageSize: PAGE_SIZE }),
    [verification, debouncedSearch, page, shell.refreshToken],
  )

  const documents = useAsync(() => (showDocuments ? loadPendingDocuments() : Promise.resolve(null)), [showDocuments, shell.refreshToken])

  const detailDocuments = useAsync(async () => (selected ? loadProviderDocuments(selected.usuario_id) : null), [selected?.usuario_id, shell.refreshToken])

  const rows = providers.data?.rows || []
  const status = providers.data?.status || 'ok'
  const documentRows = documents.data?.rows || []

  return (
    <div className="ad-section">
      <SectionHeader
        title="Profesionales"
        description="Legajos, verificación documental y disponibilidad real para recibir servicios."
        actions={<span className="ad-card-tag">{shell.metrics.verificationsPending.value ?? '—'} por revisar</span>}
      />

      <div className="ad-toolbar">
        <Segmented
          ariaLabel="Estado de verificación"
          value={verification}
          onChange={(next) => setVerification(next)}
          options={VERIFICATION_FILTERS.map((item) => ({ id: item.id, label: item.label }))}
        />
        {!showDocuments ? <SearchInput value={search} onChange={setSearch} placeholder="Buscar por ciudad o teléfono" ariaLabel="Buscar profesionales" /> : null}
      </div>

      {showDocuments ? (
        documents.loading ? (
          <TableSkeleton columns={4} />
        ) : documents.data && documents.data.status !== 'ok' ? (
          <StatusNote variant={documents.data.status === 'denied' ? 'denied' : 'missing'} title="Documentos no disponibles para tu rol" onRetry={documents.reload}>
            {documents.data.error}
          </StatusNote>
        ) : documentRows.length === 0 ? (
          <EmptyState title="Sin documentos pendientes" description="No hay archivos en estado pendiente, procesando o reenvío solicitado. Es buena señal." />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Usuario</th>
                  <th className="ad-num">Cargado</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <strong>{truncate(document.descripcion, 52)}</strong>
                      <small>{truncate(document.url_storage, 42)}</small>
                    </td>
                    <td>{document.tipo || '—'}</td>
                    <td>
                      <Chip label={document.estado || 'sin estado'} tone={document.estado === 'pendiente' ? 'amber' : 'blue'} />
                    </td>
                    <td>{truncate(document.usuario_id, 10)}</td>
                    <td className="ad-num">{relativeTime(document.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          {status !== 'ok' ? (
            <StatusNote variant={status === 'denied' ? 'denied' : 'missing'} title="Lectura de legajos restringida" onRetry={providers.reload}>
              {providers.data?.error}
            </StatusNote>
          ) : null}

          {providers.loading && rows.length === 0 ? (
            <TableSkeleton columns={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Sin profesionales en este filtro"
              description="No hay legajos con ese estado en UGO TEST. Cambiá el filtro o revisá la búsqueda."
            />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Profesional</th>
                    <th>Categoría</th>
                    <th>Verificación</th>
                    <th>Presencia</th>
                    <th>Ciudad base</th>
                    <th className="ad-num">Tarifa base</th>
                    <th className="ad-num">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const state = verificationState(row.estado_verificacion)
                    const name = personName(row.usuario)
                    return (
                      <tr key={row.usuario_id} onClick={() => setSelected(row)}>
                        <td>
                          <div className="ad-person">
                            <Avatar name={initials(name === '—' ? 'Profesional UGO' : name)} tone="lime" />
                            <div>
                              <strong>{name === '—' ? 'Profesional sin nombre' : name}</strong>
                              <small>{row.telefono_profesional || truncate(row.usuario_id, 12)}</small>
                            </div>
                          </div>
                        </td>
                        <td>{row.categoria ? `${row.categoria.emoji || ''} ${row.categoria.nombre || ''}`.trim() || '—' : '—'}</td>
                        <td>
                          <Chip label={state.label} tone={state.tone} />
                        </td>
                        <td>
                          {row.online ? <Chip label="Online" tone="green" /> : <Chip label="Offline" tone="neutral" />}
                          {row.disponible ? <Chip label="Disponible" tone="lime" /> : null}
                        </td>
                        <td>{row.ciudad_base || '—'}</td>
                        <td className="ad-num">{formatMoney(row.tarifa_base)}</td>
                        <td className="ad-num">{relativeTime(row.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={providers.data?.count ?? null} onChange={setPage} loading={providers.loading} />
        </>
      )}

      <Drawer
        open={Boolean(selected)}
        title={selected ? personName(selected.usuario) : 'Legajo profesional'}
        subtitle={selected ? `${verificationState(selected.estado_verificacion).label} · ${selected.ciudad_base || 'ciudad sin definir'}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <KeyValue
              items={[
                { label: 'ID', value: <code>{selected.usuario_id}</code> },
                { label: 'Verificación', value: <Chip label={verificationState(selected.estado_verificacion).label} tone={verificationState(selected.estado_verificacion).tone} /> },
                { label: 'Motivo de rechazo', value: selected.motivo_rechazo || '—' },
                { label: 'Categoría principal', value: selected.categoria ? `${selected.categoria.emoji || ''} ${selected.categoria.nombre || ''}`.trim() : selected.categoria_principal_id || '—' },
                { label: 'Experiencia', value: selected.experiencia_anos ? `${selected.experiencia_anos} años` : '—' },
                { label: 'Tarifa base', value: formatMoney(selected.tarifa_base) },
                { label: 'Teléfono', value: selected.telefono_profesional || '—' },
                { label: 'Presencia', value: `${selected.online ? 'Online' : 'Offline'} · ${selected.disponible ? 'disponible' : 'no disponible'}` },
                { label: 'Perfil actualizado', value: formatDateTime(selected.updated_at) },
              ]}
            />
            <div className="ad-inline-block">
              <h4>Documentos del legajo</h4>
              {detailDocuments.loading ? (
                <TableSkeleton rows={3} columns={2} />
              ) : detailDocuments.data?.status !== 'ok' ? (
                <StatusNote variant="missing" title="Documentos no disponibles">
                  {detailDocuments.data?.error}
                </StatusNote>
              ) : (detailDocuments.data?.rows || []).length === 0 ? (
                <p className="ad-muted">Este legajo no tiene documentos cargados en <code>documentos</code>.</p>
              ) : (
                <ul className="ad-list">
                  {(detailDocuments.data?.rows || []).map((document) => (
                    <li key={document.id}>
                      <div>
                        <strong>{document.tipo || 'documento'}</strong>
                        <small>{formatDateTime(document.created_at)}</small>
                        <p>{truncate(document.descripcion, 100)}</p>
                      </div>
                      <Chip label={document.estado || 'sin estado'} tone={document.estado === 'aprobado' ? 'green' : document.estado === 'rechazado' ? 'red' : 'amber'} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <StatusNote variant="info" title="Aprobación documental desde el panel de legajos">
              La aprobación/rechazo de verificación se realiza por el flujo de legajo de UGO. Este rediseño muestra el estado real y los documentos, sin ejecutar
              transiciones que el contrato no exponga como RPC administrativa.
            </StatusNote>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
