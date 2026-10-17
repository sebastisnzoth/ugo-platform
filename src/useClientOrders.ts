import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

export type ClientOrder = {
  id: string
  estado: string
  created_at: string | null
  numero?: number | string | null
  descripcion?: string | null
  categoria_id?: string | null
  proveedor_id?: string | null
  tarifa?: number | string | null
  moneda?: string | null
  programado_para?: string | null
  metadata?: Record<string, unknown> | null
}

/** Pedidos reales del usuario autenticado (tabla servicios de UGO TEST). */
export function useClientOrders(session: Session | null, limit = 30) {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let active = true
    if (!session) {
      setOrders([]); setLoading(false); setError('')
      return
    }
    setLoading(true); setError('')
    supabase
      .from('servicios')
      .select('id,estado,created_at,numero,descripcion,categoria_id,proveedor_id,tarifa,moneda,programado_para,metadata')
      .eq('cliente_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error: queryError }) => {
        if (!active) return
        setLoading(false)
        if (queryError) {
          setError('No pudimos cargar los pedidos: ' + queryError.message)
          return
        }
        setOrders((data || []) as ClientOrder[])
      })
    return () => { active = false }
  }, [session, limit, reloadKey])

  return { orders, loading, error, reload }
}

export function orderTone(estado: string): 'success' | 'active' | 'pending' | 'danger' | 'neutral' {
  const value = (estado || '').toLowerCase()
  if (/cancel|rechaz|anulad|disput/.test(value)) return 'danger'
  if (/complet/.test(value)) return 'success'
  if (/camino|llegad|progreso|asignad|ejecut|curso|confirmad|trabaj/.test(value)) return 'active'
  if (/pend|solicit|nuev|espera|revision|buscand|ofrecid|borrador|negociand|aprobacion/.test(value)) return 'pending'
  return 'neutral'
}

export function formatOrderDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
