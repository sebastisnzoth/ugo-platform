import { useEffect, useMemo, useState } from 'react'
import { confirmDebtCollected, loadDebts, loadPayments, loadWithdrawals, reconcilePix, updateWithdrawal } from '../lib/data'
import { useAsync } from '../lib/hooks'
import { formatMoney, personName, relativeTime, truncate } from '../lib/format'
import { debtState, paymentState, withdrawalState, type DebtRow, type PaymentRow, type WithdrawalRow } from '../lib/types'
import type { SectionProps } from '../lib/shell'
import { Chip, EmptyState, Field, Modal, Pagination, SectionHeader, Segmented, StatusNote, TableSkeleton } from '../ui/kit'

const PAGE_SIZE = 40

const TABS = [
  { id: 'pix', label: 'Pix por conciliar' },
  { id: 'payments', label: 'Pagos' },
  { id: 'debts', label: 'Comisiones UGO' },
  { id: 'withdrawals', label: 'Retiros' },
] as const

type FinanceTab = (typeof TABS)[number]['id']

const PAYMENT_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'retenido', label: 'En bóveda' },
  { id: 'liberado', label: 'Liberados' },
  { id: 'reembolsado', label: 'Reembolsados' },
  { id: 'disputado', label: 'Disputados' },
] as const

const DEBT_FILTERS = [
  { id: 'informado', label: 'Informadas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'parcial', label: 'Parciales' },
  { id: 'pagado', label: 'Pagadas' },
  { id: 'todos', label: 'Todas' },
] as const

const WITHDRAWAL_FILTERS = [
  { id: 'pendientes', label: 'En curso' },
  { id: 'todos', label: 'Todos' },
] as const

export default function FinanceSection({ shell, filter }: SectionProps) {
  const initial = (TABS.some((tab) => tab.id === filter) ? filter : 'pix') as FinanceTab
  const [tab, setTab] = useState<FinanceTab>(initial)
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]['id']>('todos')
  const [debtFilter, setDebtFilter] = useState<(typeof DEBT_FILTERS)[number]['id']>('informado')
  const [withdrawalFilter, setWithdrawalFilter] = useState<(typeof WITHDRAWAL_FILTERS)[number]['id']>('pendientes')
  const [page, setPage] = useState(0)
  const [pixAction, setPixAction] = useState<{ payment: PaymentRow; aprobar: boolean } | null>(null)
  const [pixReference, setPixReference] = useState('')
  const [pixNote, setPixNote] = useState('')
  const [debtAction, setDebtAction] = useState<DebtRow | null>(null)
  const [debtReference, setDebtReference] = useState('')
  const [withdrawalAction, setWithdrawalAction] = useState<{ withdrawal: WithdrawalRow; estado: 'procesando' | 'pagado' | 'fallido' } | null>(null)
  const [transferReference, setTransferReference] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (filter && TABS.some((item) => item.id === filter)) setTab(filter as FinanceTab)
  }, [filter])

  useEffect(() => {
    setPage(0)
  }, [tab, paymentFilter, debtFilter, withdrawalFilter, shell.refreshToken])

  const pix = useAsync(() => (tab === 'pix' ? loadPayments({ onlyPixReported: true, page, pageSize: PAGE_SIZE }) : Promise.resolve(null)), [tab, page, shell.refreshToken])
  const payments = useAsync(
    () => (tab === 'payments' ? loadPayments({ estado: paymentFilter, page, pageSize: PAGE_SIZE }) : Promise.resolve(null)),
    [tab, paymentFilter, page, shell.refreshToken],
  )
  const debts = useAsync(() => (tab === 'debts' ? loadDebts(debtFilter) : Promise.resolve(null)), [tab, debtFilter, shell.refreshToken])
  const withdrawals = useAsync(
    () => (tab === 'withdrawals' ? loadWithdrawals(withdrawalFilter === 'pendientes' ? null : 'todos') : Promise.resolve(null)),
    [tab, withdrawalFilter, shell.refreshToken],
  )

  const pixRows = pix.data?.rows || []
  const paymentRows = payments.data?.rows || []
  const debtRows = debts.data?.rows || []
  const withdrawalRows = withdrawals.data?.rows || []

  const totalRetained = useMemo(
    () => paymentRows.filter((row) => row.estado === 'retenido').reduce((total, row) => total + (row.monto_bruto || 0), 0),
    [paymentRows],
  )

  async function applyPix() {
    if (!pixAction) return
    if (pixAction.aprobar && pixReference.trim().length < 6) {
      shell.notify('Ingresá el identificador end-to-end del Pix (mínimo 6 caracteres).', 'error')
      return
    }
    setBusy(true)
    const outcome = await reconcilePix(pixAction.payment.id, pixAction.aprobar, pixAction.aprobar ? pixReference.trim() : null, pixNote.trim() || null)
    setBusy(false)
    if (!outcome.ok) {
      shell.notify(outcome.message, 'error')
      return
    }
    shell.notify(pixAction.aprobar ? 'Pix conciliado: el pago pasa a bóveda retenida y el servicio puede avanzar.' : 'Pix rechazado. El cliente recibe la notificación del contrato.', 'success')
    setPixAction(null)
    setPixReference('')
    setPixNote('')
    pix.reload()
    shell.refresh()
  }

  async function applyDebt() {
    if (!debtAction) return
    if (debtReference.trim().length < 4) {
      shell.notify('La referencia del cobro necesita al menos 4 caracteres.', 'error')
      return
    }
    setBusy(true)
    const outcome = await confirmDebtCollected(debtAction.id, debtReference.trim(), `Confirmado por ${shell.displayName} desde panel admin UGO`)
    setBusy(false)
    if (!outcome.ok) {
      shell.notify(outcome.message, 'error')
      return
    }
    shell.notify('Comisión UGO confirmada y auditada.', 'success')
    setDebtAction(null)
    setDebtReference('')
    debts.reload()
    shell.refresh()
  }

  async function applyWithdrawal() {
    if (!withdrawalAction) return
    if (withdrawalAction.estado === 'pagado' && transferReference.trim().length < 4) {
      shell.notify('Para marcar el retiro como pagado necesitás la referencia de la transferencia.', 'error')
      return
    }
    setBusy(true)
    const outcome = await updateWithdrawal(
      withdrawalAction.withdrawal.id,
      withdrawalAction.estado,
      withdrawalAction.estado === 'procesando' ? null : transferReference.trim() || null,
      withdrawalAction.estado === 'fallido' ? 'Marcado fallido desde panel admin UGO' : null,
    )
    setBusy(false)
    if (!outcome.ok) {
      shell.notify(outcome.message, 'error')
      return
    }
    shell.notify('Retiro actualizado y auditado.', 'success')
    setWithdrawalAction(null)
    setTransferReference('')
    withdrawals.reload()
  }

  const active = tab === 'pix' ? pix : tab === 'payments' ? payments : debts
  const activeStatus = active.data?.status || 'ok'

  return (
    <div className="ad-section">
      <SectionHeader
        title="Finanzas"
        description="Bóveda, Pix directo, comisiones de efectivo y retiros reales del proyecto UGO TEST."
        actions={tab === 'payments' ? <span className="ad-card-tag">En bóveda {formatMoney(totalRetained)}</span> : null}
      />

      <div className="ad-toolbar ad-toolbar-stack">
        <Segmented ariaLabel="Sección financiera" value={tab} onChange={(next) => setTab(next)} options={TABS.map((item) => ({ id: item.id, label: item.label }))} />
        {tab === 'payments' ? (
          <Segmented ariaLabel="Estado del pago" value={paymentFilter} onChange={(next) => setPaymentFilter(next)} options={PAYMENT_FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
        ) : null}
        {tab === 'debts' ? (
          <Segmented ariaLabel="Estado de la comisión" value={debtFilter} onChange={(next) => setDebtFilter(next)} options={DEBT_FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
        ) : null}
        {tab === 'withdrawals' ? (
          <Segmented ariaLabel="Estado del retiro" value={withdrawalFilter} onChange={(next) => setWithdrawalFilter(next)} options={WITHDRAWAL_FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
        ) : null}
      </div>

      {tab !== 'withdrawals' && activeStatus !== 'ok' ? (
        <StatusNote variant={activeStatus === 'denied' ? 'denied' : 'missing'} title="Lectura financiera restringida" onRetry={active.reload}>
          {active.data?.error}
        </StatusNote>
      ) : null}

      {tab === 'pix' ? (
        pix.loading && pixRows.length === 0 ? (
          <TableSkeleton columns={5} />
        ) : pixRows.length === 0 ? (
          <EmptyState
            title="No hay Pix esperando conciliación"
            description="Sólo aparecen pagos pix_direto en estado pendiente que el cliente ya informó. Sin datos reales, la cola queda vacía a propósito."
          />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Pago</th>
                  <th>Servicio</th>
                  <th className="ad-num">Monto</th>
                  <th>Informado</th>
                  <th className="ad-num">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pixRows.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{truncate(payment.id, 10)}</strong>
                      <small>{payment.metodo || 'pix'} · {payment.ambiente || '—'}</small>
                    </td>
                    <td>{payment.servicio?.numero ? `#${payment.servicio.numero}` : truncate(payment.servicio_id, 8)}</td>
                    <td className="ad-num">{formatMoney(payment.monto_bruto, payment.moneda || undefined)}</td>
                    <td>{relativeTime(payment.pix_informado_at)}</td>
                    <td className="ad-num">
                      <div className="ad-row-buttons">
                        <button
                          type="button"
                          className="ad-button ad-button-primary"
                          onClick={() => {
                            setPixAction({ payment, aprobar: true })
                            setPixReference('')
                            setPixNote('')
                          }}
                        >
                          Conciliar
                        </button>
                        <button
                          type="button"
                          className="ad-button ad-button-danger"
                          onClick={() => {
                            setPixAction({ payment, aprobar: false })
                            setPixReference('')
                            setPixNote('')
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'payments' ? (
        payments.loading && paymentRows.length === 0 ? (
          <TableSkeleton columns={6} />
        ) : paymentRows.length === 0 ? (
          <EmptyState title="Sin pagos con ese estado" description="Cambiá el filtro de estado para ver otros movimientos de bóveda." />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Pago</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                  <th>Método</th>
                  <th className="ad-num">Bruto</th>
                  <th className="ad-num">Comisión</th>
                  <th className="ad-num">Creado</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((payment) => {
                  const state = paymentState(payment.estado)
                  return (
                    <tr key={payment.id}>
                      <td>
                        <strong>{truncate(payment.id, 10)}</strong>
                        <small>{payment.pix_e2e_id ? `E2E ${truncate(payment.pix_e2e_id, 14)}` : payment.ambiente || '—'}</small>
                      </td>
                      <td>{payment.servicio?.numero ? `#${payment.servicio.numero}` : truncate(payment.servicio_id, 8)}</td>
                      <td>
                        <Chip label={state.label} tone={state.tone} />
                      </td>
                      <td>{payment.metodo || '—'}</td>
                      <td className="ad-num">{formatMoney(payment.monto_bruto, payment.moneda || undefined)}</td>
                      <td className="ad-num">{formatMoney(payment.comision_ugo, payment.moneda || undefined)}</td>
                      <td className="ad-num">{relativeTime(payment.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'debts' ? (
        debts.loading && debtRows.length === 0 ? (
          <TableSkeleton columns={5} />
        ) : debtRows.length === 0 ? (
          <EmptyState title="Sin comisiones en ese estado" description="Las comisiones de pago en efectivo se registran en deudas_ugo_proveedor cuando el servicio se libera." />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                  <th className="ad-num">Saldo</th>
                  <th>Referencia informada</th>
                  <th className="ad-num">Acción</th>
                </tr>
              </thead>
              <tbody>
                {debtRows.map((debt) => {
                  const state = debtState(debt.estado)
                  return (
                    <tr key={debt.id}>
                      <td>{personName(debt.proveedor) !== '—' ? personName(debt.proveedor) : truncate(debt.proveedor_id, 10)}</td>
                      <td>{debt.servicio?.numero ? `#${debt.servicio.numero}` : truncate(debt.servicio_id, 8)}</td>
                      <td>
                        <Chip label={state.label} tone={state.tone} />
                      </td>
                      <td className="ad-num">{formatMoney(debt.saldo_pendiente || debt.comision_ugo, debt.moneda || undefined)}</td>
                      <td>{debt.referencia_pago || '—'}</td>
                      <td className="ad-num">
                        <button
                          type="button"
                          className="ad-button ad-button-primary"
                          disabled={debt.estado === 'pagado' || debt.estado === 'anulado'}
                          onClick={() => {
                            setDebtAction(debt)
                            setDebtReference(debt.referencia_pago || '')
                          }}
                        >
                          Confirmar cobro
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'withdrawals' ? (
        withdrawals.loading && withdrawalRows.length === 0 ? (
          <TableSkeleton columns={5} />
        ) : withdrawals.data && withdrawals.data.status !== 'ok' ? (
          <StatusNote variant={withdrawals.data.status === 'denied' ? 'denied' : 'missing'} title="Retiros no disponibles para tu rol" onRetry={withdrawals.reload}>
            {withdrawals.data.error}
          </StatusNote>
        ) : withdrawalRows.length === 0 ? (
          <EmptyState title="Sin retiros en curso" description="Los retiros reales aparecen aquí para pasarlos a procesando, pagado o fallido con trazabilidad." />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Estado</th>
                  <th className="ad-num">Monto</th>
                  <th>Referencia</th>
                  <th className="ad-num">Solicitado</th>
                  <th className="ad-num">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRows.map((withdrawal) => {
                  const state = withdrawalState(withdrawal.estado)
                  const closed = withdrawal.estado === 'pagado' || withdrawal.estado === 'fallido'
                  return (
                    <tr key={withdrawal.id}>
                      <td>{personName(withdrawal.proveedor) !== '—' ? personName(withdrawal.proveedor) : truncate(withdrawal.proveedor_id, 10)}</td>
                      <td>
                        <Chip label={state.label} tone={state.tone} />
                      </td>
                      <td className="ad-num">{formatMoney(withdrawal.monto, withdrawal.moneda || undefined)}</td>
                      <td>{withdrawal.transferencia_externa_id || '—'}</td>
                      <td className="ad-num">{relativeTime(withdrawal.created_at)}</td>
                      <td className="ad-num">
                        <div className="ad-row-buttons">
                          <button
                            type="button"
                            className="ad-button ad-button-ghost"
                            disabled={closed}
                            onClick={() => {
                              setWithdrawalAction({ withdrawal, estado: 'procesando' })
                              setTransferReference('')
                            }}
                          >
                            Procesando
                          </button>
                          <button
                            type="button"
                            className="ad-button ad-button-primary"
                            disabled={closed || withdrawal.ambiente !== 'real'}
                            onClick={() => {
                              setWithdrawalAction({ withdrawal, estado: 'pagado' })
                              setTransferReference('')
                            }}
                          >
                            Pagado
                          </button>
                          <button
                            type="button"
                            className="ad-button ad-button-danger"
                            disabled={closed}
                            onClick={() => {
                              setWithdrawalAction({ withdrawal, estado: 'fallido' })
                              setTransferReference('')
                            }}
                          >
                            Fallido
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'payments' ? <Pagination page={page} pageSize={PAGE_SIZE} total={payments.data?.count ?? null} onChange={setPage} loading={payments.loading} /> : null}
      {tab === 'pix' ? <Pagination page={page} pageSize={PAGE_SIZE} total={pix.data?.count ?? null} onChange={setPage} loading={pix.loading} /> : null}

      <Modal
        open={Boolean(pixAction)}
        title={pixAction?.aprobar ? 'Conciliar Pix directo' : 'Rechazar Pix informado'}
        description={
          pixAction
            ? `${pixAction.aprobar ? 'Confirmar' : 'Rechazar'} el Pix de ${formatMoney(pixAction.payment.monto_bruto, pixAction.payment.moneda || undefined)} del servicio ${
                pixAction.payment.servicio?.numero ? `#${pixAction.payment.servicio.numero}` : truncate(pixAction.payment.servicio_id, 8)
              }. La operación la ejecuta conciliar_pix_direto y queda auditada.`
            : undefined
        }
        onClose={() => setPixAction(null)}
      >
        {pixAction?.aprobar ? (
          <Field label="Identificador end-to-end del Pix" hint="Lo entrega el banco/PSP del cliente. Entre 6 y 160 caracteres.">
            <input value={pixReference} onChange={(event) => setPixReference(event.target.value)} placeholder="Ej: E00038165202610151234abcdef" />
          </Field>
        ) : null}
        <Field label="Nota de conciliación (opcional)">
          <textarea value={pixNote} onChange={(event) => setPixNote(event.target.value)} rows={3} placeholder="Detalle para el expediente y la auditoría" />
        </Field>
        <div className="ad-modal-actions">
          <button type="button" className="ad-button ad-button-ghost" onClick={() => setPixAction(null)}>
            Cancelar
          </button>
          <button type="button" className={pixAction?.aprobar ? 'ad-button ad-button-primary' : 'ad-button ad-button-danger'} disabled={busy} onClick={applyPix}>
            {busy ? 'Aplicando…' : pixAction?.aprobar ? 'Conciliar Pix' : 'Rechazar Pix'}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(debtAction)}
        title="Confirmar cobro de comisión UGO"
        description={
          debtAction
            ? `Comisión de ${formatMoney(debtAction.saldo_pendiente || debtAction.comision_ugo, debtAction.moneda || undefined)} · ${personName(debtAction.proveedor)} · servicio ${
                debtAction.servicio?.numero ? `#${debtAction.servicio.numero}` : truncate(debtAction.servicio_id, 8)
              }. Se ejecuta admin_confirmar_deuda_ugo_pagada.`
            : undefined
        }
        onClose={() => setDebtAction(null)}
      >
        <Field label="Referencia del cobro" hint="Comprobante o ID de la transferencia recibida (mínimo 4 caracteres).">
          <input value={debtReference} onChange={(event) => setDebtReference(event.target.value)} placeholder="Ej: 0019-99887766" />
        </Field>
        <div className="ad-modal-actions">
          <button type="button" className="ad-button ad-button-ghost" onClick={() => setDebtAction(null)}>
            Cancelar
          </button>
          <button type="button" className="ad-button ad-button-primary" disabled={busy} onClick={applyDebt}>
            {busy ? 'Confirmando…' : 'Confirmar cobro'}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(withdrawalAction)}
        title={withdrawalAction ? `Retiro · ${withdrawalAction.estado === 'pagado' ? 'marcar como pagado' : withdrawalAction.estado === 'fallido' ? 'marcar como fallido' : 'pasar a procesando'}` : 'Retiro'}
        description={
          withdrawalAction
            ? `${formatMoney(withdrawalAction.withdrawal.monto, withdrawalAction.withdrawal.moneda || undefined)} para ${personName(withdrawalAction.withdrawal.proveedor)}. Ejecuta admin_actualizar_retiro y queda auditado.`
            : undefined
        }
        onClose={() => setWithdrawalAction(null)}
      >
        {withdrawalAction?.estado !== 'procesando' ? (
          <Field label="Referencia de la transferencia" hint="Obligatoria para marcar el retiro como pagado.">
            <input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="Ej: TRANSF-2209845" />
          </Field>
        ) : (
          <p className="ad-muted">Al pasar a procesando no se exige referencia: queda registrado que el retiro está en curso.</p>
        )}
        <div className="ad-modal-actions">
          <button type="button" className="ad-button ad-button-ghost" onClick={() => setWithdrawalAction(null)}>
            Cancelar
          </button>
          <button type="button" className={withdrawalAction?.estado === 'fallido' ? 'ad-button ad-button-danger' : 'ad-button ad-button-primary'} disabled={busy} onClick={applyWithdrawal}>
            {busy ? 'Aplicando…' : 'Confirmar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
