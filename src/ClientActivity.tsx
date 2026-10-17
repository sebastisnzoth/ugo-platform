import type { Session } from '@supabase/supabase-js'
import { formatOrderDate, orderTone, useClientOrders } from './useClientOrders'

export default function ClientActivity({ session, onNewRequest }: { session: Session | null; onNewRequest?: () => void }) {
  const { orders, loading, error } = useClientOrders(session, 30)
  return <section className="client-panel">
    <span className="client-kicker">ACTIVIDAD REAL</span><h1>Mis pedidos</h1>
    {!session ? <div className="ux-empty"><span className="ux-empty-icon">▤</span>
        <strong>Tus pedidos aparecen acá</strong>
        <p>Ingresá para ver los trabajos registrados con tu usuario.</p>
        <a className="ux-primary" href="./">Ingresar</a></div> :
      loading ? <div aria-label="Cargando pedidos">{[0, 1, 2].map(row =>
        <div className="ux-skeleton" key={row} style={{ height: 72 }} />)}</div> :
      error ? <p role="alert">{error}</p> :
      orders.length === 0 ? <div className="ux-empty"><span className="ux-empty-icon">✓</span>
        <strong>Todavía no tenés pedidos</strong>
        <p>Cuando solicites un servicio va a quedar registrado acá.</p>
        {onNewRequest && <button className="ux-primary" onClick={onNewRequest}>Solicitar servicio →</button>}</div> :
      <ul className="client-order-list">{orders.map(order =>
        <li key={order.id} className="ux-order-row">
          <div className="ux-order-main">
            <strong>Pedido {order.id.slice(0, 8)}</strong>
            {order.created_at && <small>{formatOrderDate(order.created_at)}</small>}
          </div>
          <span className={'ux-chip ux-chip-' + orderTone(order.estado)}>{order.estado || 'sin estado'}</span>
        </li>)}</ul>}
    <p className="client-muted">Solo se muestran datos que permite consultar tu cuenta. La gestión del pedido se habilitará después de validar las RPC correspondientes.</p>
  </section>
}
