import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type ClientOrder = { id:string; estado:string; created_at:string | null }
export default function ClientActivity({ session }: {session: Session|null}) {
  const [orders,setOrders]=useState<ClientOrder[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    setOrders([]);setError('')
    if(!session){setLoading(false);return}
    setLoading(true)
    supabase.from('servicios').select('id,estado,created_at')
      .eq('cliente_id',session.user.id).order('created_at',{ascending:false}).limit(30)
      .then(({data,error})=>{
        if(!active)return
        setLoading(false)
        if(error){setError('No pudimos cargar los pedidos: '+error.message);return}
        setOrders((data||[]) as ClientOrder[])
      })
    return ()=>{active=false}
  },[session])
  return <section className="client-panel">
    <span className="client-kicker">ACTIVIDAD REAL</span><h1>Mis pedidos</h1>
    {!session ? <p>Ingresá para ver tus pedidos reales. <a href="./">Ingresar</a></p>:
      loading ? <p role="status">Cargando tus pedidos...</p> :
      error ? <p role="alert">{error}</p> :
      orders.length===0 ? <p>No tenés pedidos registrados en UGO TEST.</p> :
      <ul className="client-order-list">{orders.map(order=><li key={order.id}>
        <strong>Pedido {order.id.slice(0,8)}</strong>
        <span>Estado: {order.estado}</span>
        {order.created_at && <small>{new Date(order.created_at).toLocaleString('pt-BR')}</small>}
      </li>)}</ul>}
    <p className="client-muted">Solo se muestran datos que permite consultar tu cuenta. La gestión del pedido se habilitará después de validar las RPC correspondientes.</p>
  </section>
}
