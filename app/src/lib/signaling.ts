import type { ClientMessage, ServerMessage } from '@/types/signaling'

export type SignalingConnection = {
  send: (message: ClientMessage) => void
  close: () => void
}

function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data as ServerMessage
  } catch {
    return null
  }
}

export function connectSignaling(
  url: string,
  onMessage: (message: ServerMessage) => void
): Promise<SignalingConnection> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      const msg = parseServerMessage(event.data as string)
      if (msg) onMessage(msg)
    }

    ws.onopen = () => {
      resolve({
        send: (message: ClientMessage) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message))
          }
        },
        close: () => {
          ws.close()
        },
      })
    }

    ws.onerror = () => {
      reject(new Error('WebSocket connection failed'))
    }
  })
}
