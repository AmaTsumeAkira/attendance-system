import { useEffect, useRef, useCallback, useState } from 'react'

export function useWebSocket(token) {
  const wsRef = useRef(null)
  const listenersRef = useRef(new Map())
  const reconnectTimer = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (!token) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`)

    ws.onopen = () => {
      setConnected(true)
      // Re-subscribe on reconnect
      listenersRef.current.forEach((_, key) => {
        if (key.startsWith('session:')) {
          ws.send(JSON.stringify({ type: 'subscribe', payload: { sessionId: parseInt(key.split(':')[1]) } }))
        }
      })
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        listenersRef.current.forEach((cb) => cb(msg))
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
    wsRef.current = ws
  }, [token])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const subscribe = useCallback((sessionId) => {
    const key = `session:${sessionId}`
    listenersRef.current.set(key, () => {}) // placeholder
    send({ type: 'subscribe', payload: { sessionId } })
    return key
  }, [send])

  const addListener = useCallback((key, cb) => {
    listenersRef.current.set(key, cb)
    return () => listenersRef.current.delete(key)
  }, [])

  return { send, subscribe, addListener, connected }
}
