import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { WSContext } from 'hono/ws'
import { nanoid } from 'nanoid'
import {
  addPeer,
  broadcastExcept,
  getPeer,
  removePeer,
  sendToPeer,
} from './rooms.js'
import type { ClientMessage, ServerMessage } from './types.js'

const app = new Hono()

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.use(
  '/*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
)

app.get('/health', (c) => c.json({ ok: true }))

app.get('/', (c) =>
  c.text('WebRTC signaling server. Connect WebSocket to /ws')
)

function send(ws: WSContext, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    /* ignore closed socket */
  }
}

function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data as ClientMessage
  } catch {
    return null
  }
}

app.get(
  '/ws',
  upgradeWebSocket(() => {
    let myPeerId: string | null = null
    let myRoomId: string | null = null

    const cleanup = (ws: WSContext) => {
      if (myPeerId && myRoomId) {
        removePeer(myRoomId, myPeerId)
        broadcastExcept(myRoomId, myPeerId, {
          type: 'peer-left',
          peerId: myPeerId,
        })
      }
      myPeerId = null
      myRoomId = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }

    return {
      onMessage(event, ws) {
        const msg = parseClientMessage(event.data)
        if (!msg) {
          send(ws, { type: 'error', message: 'Invalid message' })
          return
        }

        if (!myPeerId || !myRoomId) {
          if (msg.type !== 'join') {
            send(ws, { type: 'error', message: 'Send join first' })
            return
          }
          if (!msg.roomId || typeof msg.roomId !== 'string') {
            send(ws, { type: 'error', message: 'roomId required' })
            return
          }
          myRoomId = msg.roomId
          myPeerId = nanoid()
          const peers = addPeer(myRoomId, myPeerId, ws)
          send(ws, {
            type: 'joined',
            roomId: myRoomId,
            peerId: myPeerId,
            peers,
          })
          broadcastExcept(myRoomId, myPeerId, {
            type: 'peer-joined',
            peerId: myPeerId,
          })
          return
        }

        if (msg.type === 'join') {
          send(ws, { type: 'error', message: 'Already joined' })
          return
        }

        if (msg.type === 'leave') {
          cleanup(ws)
          return
        }

        if (msg.type === 'offer' || msg.type === 'answer') {
          if (!msg.to || typeof msg.sdp !== 'string') {
            send(ws, { type: 'error', message: 'Invalid relay payload' })
            return
          }
          if (!getPeer(myRoomId, msg.to)) {
            send(ws, { type: 'error', message: 'Unknown peer' })
            return
          }
          if (msg.type === 'offer') {
            sendToPeer(myRoomId, msg.to, {
              type: 'offer',
              from: myPeerId,
              sdp: msg.sdp,
            })
          } else {
            sendToPeer(myRoomId, msg.to, {
              type: 'answer',
              from: myPeerId,
              sdp: msg.sdp,
            })
          }
          return
        }

        if (msg.type === 'ice-candidate') {
          if (!msg.to) {
            send(ws, { type: 'error', message: 'Invalid ice-candidate' })
            return
          }
          if (!getPeer(myRoomId, msg.to)) {
            send(ws, { type: 'error', message: 'Unknown peer' })
            return
          }
          sendToPeer(myRoomId, msg.to, {
            type: 'ice-candidate',
            from: myPeerId,
            candidate: msg.candidate,
          })
          return
        }

        send(ws, { type: 'error', message: 'Unknown message type' })
      },
      onClose(_event, ws) {
        if (myPeerId && myRoomId) {
          removePeer(myRoomId, myPeerId)
          broadcastExcept(myRoomId, myPeerId, {
            type: 'peer-left',
            peerId: myPeerId,
          })
        }
        myPeerId = null
        myRoomId = null
      },
    }
  })
)

const server = serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Signaling server http://localhost:${info.port}`)
  }
)

injectWebSocket(server)
