import { useEffect, useMemo, useState } from 'react'
import { loadAuthDirectory, loadUserContext, loadUsers, setUserActive } from '../lib/data'
import { useAsync, useDebouncedValue } from '../lib/hooks'
import { formatDateTime, initials, personName, relativeTime, truncate } from '../lib/format'
import { userTypeLabel, type UserRow } from '../lib/types'
import type { SectionProps } from '../lib/shell'
import { Avatar, Chip, Drawer, EmptyState, Field, KeyValue, Modal, Pagination, SearchInput, SectionHeader, Segmented, StatusNote, TableSkeleton } from '../ui/kit'

const PAGE_SIZE = 40

const TYPE_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'cliente', label: 'Clientes' },
  { id: 'proveedor', label: 'Profesionales' },
  { id: 'admin', label: 'Equipo' },
  { id: 'inactivos', label: 'Inactivos' },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]['id']

export default function PeopleSection({ shell, filter }: SectionProps) {
  const initial = (TYPE_FILTERS.some((item) => item.id === filter) ? filter : 'todos') as TypeFilter
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initial)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [pendingAction, setPendingAction] = useState<{ user: UserRow; next: boolean } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    setPage(0)
  }, [typeFilter, debouncedSearch, shell.refreshToken])

  const query = useAsync(
    () =>
      loadUsers({
        tipo: typeFilter === 'inactivos' ? 'todos' : typeFilter,
        onlyInactive: typeFilter === 'inactivos',
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      }),
    [typeFilter, debouncedSearch, page, shell.refreshToken],
  )

  const directory = useAsync(() => loadAuthDirectory(), [shell.refreshToken])

  const rows = query.data?.rows || []
  const status = query.data?.status || 'ok'

  const emails = useMemo(() => {
    const map = new Map<string, { email: string | null; lastSignIn: string | null; confirmed: boolean | null }>()
    for (const row of directory.data?.rows || []) {
      map.set(row.id, { email: row.email, lastSignIn: row.last_sign_in_at, confirmed: row.email_confirmed })
    }
    return map
  }, [directory.data])

  const context = useAsync(async () => {
    if (!selected) return null
    return loadUserContext([selected.id])
  }, [selected?.id, shell.refreshToken])

  const providerProfile = context.data?.providers.rows[0] || null
  const clientProfile = context.data?.clients.rows[0] || null

  async function applyAction() {
    if (!pendingAction) return
    setBusy(true)
    const outcome = await setUserActive(
      pendingAction.user.id,
      pendingAction.next,
      motivo.trim() || (pendingAction.next ? 'Reactivación desde panel admin UGO' : 'Desactivación desde panel admin UGO'),
    )
    setBusy(false)
    if (!outcome.ok) {
      shell.notify(outcome.message, 'error')
      return
    }
    shell.notify(pendingAction.next ? 'Cuenta reactivada y auditada.' : 'Cuenta desactivada y auditada (la sesión deja de operar).', 'success')
    setPendingAction(null)
    setMotivo('')
    query.reload()
  }

  return (
    <div className="ad-section">
      <SectionHeader
        title="Personas"
        description="Cuentas de UGO TEST con su rol real en la tabla usuarios y su último acceso en Auth."
        actions={
          <span className="ad-card-tag">
            {directory.data?.status === 'ok' ? 'Auth enlazado' : 'Auth sin enlace'}
          </span>
        }
      />

      <div className="ad-toolbar">
        <Segmented ariaLabel="Tipo de cuenta" value={typeFilter} onChange={(next) => setTypeFilter(next)} options={TYPE_FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, apellido, zona o país" ariaLabel="Buscar personas" />
      </div>

      {status !== 'ok' ? (
        <StatusNote variant={status === 'denied' ? 'denied' : 'missing'} title="Lectura de usuarios restringida" onRetry={query.reload}>
          {query.data?.error}
        </StatusNote>
      ) : null}

      {query.loading && rows.length === 0 ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin cuentas para este filtro" description="Probá con otro rol, limpiá la búsqueda o revisá si el filtro de inactivos es el correcto." />
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Zona</th>
                <th className="ad-num">Servicios</th>
                <th>Registro</th>
                <th className="ad-num">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const directoryEntry = emails.get(row.id)
                return (
                  <tr key={row.id} onClick={() => setSelected(row)}>
                    <td>
                      <div className="ad-person">
                        <Avatar name={initials(row.nombre, row.apellido)} tone={row.tipo === 'proveedor' ? 'lime' : row.tipo === 'cliente' ? 'green' : 'violet'} />
                        <div>
                          <strong>{personName(row)}</strong>
                          <small>{directoryEntry?.email || 'Email no expuesto a este rol'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{userTypeLabel(row.tipo)}</td>
                    <td>
                      <Chip label={row.activo ? 'Activo' : 'Inactivo'} tone={row.activo ? 'green' : 'neutral'} />
                    </td>
                    <td>{row.zona || row.pais || '—'}</td>
                    <td className="ad-num">{row.servicios_completados ?? '—'}</td>
                    <td className="ad-num">{relativeTime(row.created_at)}</td>
                    <td className="ad-num" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className={row.activo ? 'ad-button ad-button-danger' : 'ad-button ad-button-primary'}
                        onClick={() => {
                          setPendingAction({ user: row, next: !row.activo })
                          setMotivo('')
                        }}
                      >
                        {row.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
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
        title={selected ? personName(selected) : 'Ficha de la persona'}
        subtitle={selected ? `${userTypeLabel(selected.tipo)} · ${selected.activo ? 'activa' : 'inactiva'}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <KeyValue
              items={[
                { label: 'ID', value: <code>{selected.id}</code> },
                { label: 'Email (Auth)', value: emails.get(selected.id)?.email || '—' },
                { label: 'Email confirmado', value: emails.get(selected.id)?.confirmed === null || emails.get(selected.id)?.confirmed === undefined ? '—' : emails.get(selected.id)?.confirmed ? 'Sí' : 'No' },
                { label: 'Último acceso', value: formatDateTime(emails.get(selected.id)?.lastSignIn) },
                { label: 'Karma', value: selected.karma ?? '—' },
                { label: 'Servicios completados', value: selected.servicios_completados ?? '—' },
                { label: 'País', value: selected.pais || '—' },
                { label: 'Zona', value: selected.zona || '—' },
                { label: 'Registrado', value: formatDateTime(selected.created_at) },
                { label: 'Actualizado', value: formatDateTime(selected.updated_at) },
              ]}
            />
            {providerProfile ? (
              <div className="ad-inline-block">
                <h4>Perfil profesional</h4>
                <KeyValue
                  items={[
                    { label: 'Verificación', value: <Chip label={providerProfile.estado_verificacion || 'sin estado'} tone={providerProfile.estado_verificacion === 'verificado' ? 'green' : 'amber'} /> },
                    { label: 'Online', value: providerProfile.online ? 'Sí' : 'No' },
                    { label: 'Disponible', value: providerProfile.disponible ? 'Sí' : 'No' },
                    { label: 'Ciudad base', value: providerProfile.ciudad_base || '—' },
                    { label: 'Teléfono', value: providerProfile.telefono_profesional || '—' },
                  ]}
                />
              </div>
            ) : null}
            {clientProfile ? (
              <div className="ad-inline-block">
                <h4>Perfil de cliente</h4>
                <KeyValue
                  items={[
                    { label: 'Teléfono', value: clientProfile.telefono || '—' },
                    { label: 'Ciudad', value: clientProfile.ciudad || '—' },
                    { label: 'Dirección', value: truncate([clientProfile.direccion, clientProfile.barrio].filter(Boolean).join(', '), 70) },
                  ]}
                />
              </div>
            ) : null}
            <button
              type="button"
              className={selected.activo ? 'ad-button ad-button-danger ad-button-block' : 'ad-button ad-button-primary ad-button-block'}
              onClick={() => {
                setPendingAction({ user: selected, next: !selected.activo })
                setMotivo('')
              }}
            >
              {selected.activo ? 'Desactivar esta cuenta' : 'Reactivar esta cuenta'}
            </button>
          </>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(pendingAction)}
        title={pendingAction?.next ? 'Reactivar cuenta' : 'Desactivar cuenta'}
        description={
          pendingAction
            ? `${pendingAction.next ? 'Reactivar' : 'Desactivar'} a ${personName(pendingAction.user)} (${userTypeLabel(pendingAction.user.tipo)}). La acción se ejecuta por RPC administrativa y queda auditada.`
            : undefined
        }
        onClose={() => setPendingAction(null)}
      >
        <Field label="Motivo (queda en auditoría)" hint="Si lo dejás vacío se registra un motivo estándar del panel.">
          <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} rows={3} placeholder="Ej: cuenta duplicada, documentación vencida, reincorporación aprobada…" />
        </Field>
        <div className="ad-modal-actions">
          <button type="button" className="ad-button ad-button-ghost" onClick={() => setPendingAction(null)}>
            Cancelar
          </button>
          <button type="button" className={pendingAction?.next ? 'ad-button ad-button-primary' : 'ad-button ad-button-danger'} disabled={busy} onClick={applyAction}>
            {busy ? 'Aplicando…' : pendingAction?.next ? 'Reactivar y auditar' : 'Desactivar y auditar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
