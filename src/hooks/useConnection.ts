import { useCallback, useEffect, useState } from 'react'
import { loadConnection, type Connection } from '../lib/config'
import { embedHealth } from '../lib/embed'
import { qdrant } from '../lib/qdrant'

export type ConnState = 'checking' | 'online' | 'offline'
export type EmbedConnState = 'checking' | 'online' | 'offline'

/** 读取当前连接信息，并对 Qdrant / 向量服务做轻量探活 */
export function useConnection() {
  const [conn, setConn] = useState<Connection>(() => loadConnection())
  const [state, setState] = useState<ConnState>('checking')
  const [embedState, setEmbedState] = useState<EmbedConnState>('checking')

  const checkEmbed = useCallback(async () => {
    setEmbedState('checking')
    try {
      await embedHealth()
      setEmbedState('online')
    } catch {
      setEmbedState('offline')
    }
  }, [])

  const check = useCallback(async () => {
    setState('checking')
    try {
      await qdrant.health()
      setState('online')
    } catch {
      setState('offline')
    }
    await checkEmbed()
  }, [checkEmbed])

  useEffect(() => {
    setConn(loadConnection())
    check()
    const id = window.setInterval(check, 12_000)
    return () => window.clearInterval(id)
  }, [check])

  return { conn, state, embedState, recheck: check }
}
