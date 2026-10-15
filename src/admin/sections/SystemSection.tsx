import { useAsync } from '../lib/hooks'
import { CONTRACT_RPCS, loadCategories, loadConfig, loadContractStatus } from '../lib/data'
import { formatDateTime, isSecretKey, maskValue, truncate } from '../lib/format'
import type { SectionProps } from '../lib/shell'
import { UGO_TEST_REF, UGO_TEST_URL } from '../../lib/supabaseAdmin'
import { Chip, EmptyState, KeyValue, SectionHeader, StatusNote, TableSkeleton } from '../ui/kit'

const STATUS_LABEL = {
  ok: 'Disponible',
  denied: 'Sin permisos',
  missing: 'No existe',
  error: 'Error',
} as const

const STATUS_TONE = {
  ok: 'green',
  denied: 'amber',
  missing: 'red',
  error: 'neutral',
} as const

export default function SystemSection({ shell }: SectionProps) {
  const contracts = useAsync(() => loadContractStatus(), [shell.refreshToken])
  const categories = useAsync(() => loadCategories(), [shell.refreshToken])
  const config = useAsync(() => loadConfig(), [shell.refreshToken])

  const tables = contracts.data?.tables || []
  const rpcs = contracts.data?.rpcs || []

  return (
    <div className="ad-section">
      <SectionHeader title="Sistema" description="Entorno, contratos activos y configuración vigente del proyecto UGO TEST." />

      <div className="ad-overview-grid">
        <section className="ad-card">
          <header className="ad-card-head">
            <div>
              <h3>Entorno conectado</h3>
              <p>Sin claves privilegiadas: el navegador sólo usa la clave publicable.</p>
            </div>
            <Chip label="TEST" tone="lime" />
          </header>
          <KeyValue
            items={[
              { label: 'Proyecto', value: UGO_TEST_REF },
              { label: 'URL', value: <code>{UGO_TEST_URL.replace('https://', '')}</code> },
              { label: 'Sesión admin', value: <code>ugo-platform-admin-auth</code> },
              { label: 'Rol de esta cuenta', value: <Chip label={shell.role} tone={shell.role === 'superadmin' ? 'violet' : 'green'} /> },
              { label: 'Última lectura', value: formatDateTime(shell.lastRefresh?.toISOString() || null) },
            ]}
          />
        </section>

        <section className="ad-card">
          <header className="ad-card-head">
            <div>
              <h3>Contratos que usa este panel</h3>
              <p>Estado real de cada tabla y RPC administrativa en el proyecto.</p>
            </div>
            <button type="button" className="ad-button ad-button-ghost" onClick={contracts.reload}>
              Revalidar
            </button>
          </header>
          {contracts.loading ? (
            <TableSkeleton rows={5} columns={2} />
          ) : (
            <>
              <div className="ad-contract-list">
                {tables.map((table) => (
                  <div key={table.name}>
                    <code>{table.name}</code>
                    <Chip label={STATUS_LABEL[table.status]} tone={STATUS_TONE[table.status]} />
                  </div>
                ))}
              </div>
              <div className="ad-inline-block">
                <h4>RPC administrativas</h4>
                <div className="ad-contract-list">
                  {CONTRACT_RPCS.map((name) => {
                    const row = rpcs.find((item) => item.name === name)
                    return (
                      <div key={name}>
                        <code>{name}</code>
                        <Chip label={row ? STATUS_LABEL[row.status] : 'Sin verificar'} tone={row ? STATUS_TONE[row.status] : 'neutral'} />
                      </div>
                    )
                  })}
                </div>
                {contracts.data && !contracts.data.catalogOk ? (
                  <StatusNote variant="warn" title="El catálogo de la API no respondió">
                    Las RPC quedaron sin verificar. Las tablas se comprobaron con lecturas reales de conteo.
                  </StatusNote>
                ) : null}
              </div>
              {tables.some((table) => table.status === 'denied' || table.status === 'missing') ? (
                <StatusNote variant="warn" title="Algunas superficies no están expuestas a tu rol">
                  Las tarjetas con estado “Sin permisos” o “No existe” se muestran en modo lectura degradada: el panel no inventa datos ni ejecuta escrituras
                  sobre contratos ausentes.
                </StatusNote>
              ) : null}
            </>
          )}
        </section>

        <section className="ad-card">
          <header className="ad-card-head">
            <div>
              <h3>Catálogo de categorías</h3>
              <p>Tabla <code>categorias</code> tal como está en UGO TEST.</p>
            </div>
          </header>
          {categories.loading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : categories.data?.status !== 'ok' ? (
            <StatusNote variant={categories.data?.status === 'denied' ? 'denied' : 'missing'} title="Categorías no disponibles" onRetry={categories.reload}>
              {categories.data?.error}
            </StatusNote>
          ) : (categories.data?.rows || []).length === 0 ? (
            <EmptyState title="Sin categorías cargadas" description="La tabla existe pero está vacía en este entorno." />
          ) : (
            <div className="ad-chip-grid">
              {(categories.data?.rows || []).map((category) => (
                <span key={category.id} className="ad-category-pill">
                  <em>{category.emoji || '•'}</em>
                  {category.nombre || truncate(category.id, 8)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="ad-card ad-card-wide">
          <header className="ad-card-head">
            <div>
              <h3>Configuración vigente</h3>
              <p>Lectura de <code>config_sistema</code>. Los valores sensibles se muestran enmascarados y nunca se editan desde acá.</p>
            </div>
          </header>
          {config.loading ? (
            <TableSkeleton rows={5} columns={3} />
          ) : config.data?.status !== 'ok' ? (
            <StatusNote variant={config.data?.status === 'denied' ? 'denied' : 'missing'} title="Configuración no disponible" onRetry={config.reload}>
              {config.data?.error}
            </StatusNote>
          ) : (config.data?.rows || []).length === 0 ? (
            <EmptyState title="Sin claves de configuración" description="La tabla existe pero no tiene filas en este proyecto." />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Clave</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(config.data?.rows || []).map((row) => (
                    <tr key={row.clave}>
                      <td>{row.grupo || 'general'}</td>
                      <td>
                        <code>{row.clave}</code>
                      </td>
                      <td className={isSecretKey(row.clave) ? 'ad-clip' : undefined}>{maskValue(row.valor, row.clave)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
