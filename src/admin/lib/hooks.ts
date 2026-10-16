import { useCallback, useEffect, useRef, useState } from 'react'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export type AsyncState<T> = { loading: boolean; data: T | null; error: string | null }

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, data: null, error: null })
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    setState((previous) => ({ loading: true, data: previous.data, error: null }))
    loadRef
      .current()
      .then((data) => {
        if (alive) setState({ loading: false, data, error: null })
      })
      .catch((error: unknown) => {
        if (!alive) return
        setState({ loading: false, data: null, error: error instanceof Error ? error.message : 'No se pudieron cargar los datos.' })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { ...state, reload }
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export type RealtimeStatus = 'connecting' | 'live' | 'degraded'

export function useAdminRealtime(tables: string[], onEvent: () => void, enabled = true) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)
  const [epoch, setEpoch] = useState(0)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let timer: number | null = null
    const fire = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        if (alive) {
          setLastEventAt(new Date())
          onEventRef.current()
        }
      }, 700)
    }

    const channel = supabaseAdmin.channel(`ugo-admin-live-${epoch}`)
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire)
    })
    channel.subscribe((nextStatus) => {
      if (!alive) return
      if (nextStatus === 'SUBSCRIBED') {
        setStatus('live')
        return
      }
      if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') {
        setStatus('degraded')
        window.setTimeout(() => {
          if (alive) setEpoch((value) => value + 1)
        }, 2500)
      }
    })

    return () => {
      alive = false
      if (timer !== null) window.clearTimeout(timer)
      void supabaseAdmin.removeChannel(channel)
    }
  }, [tables.join(','), epoch, enabled])

  return { status, lastEventAt }
}
