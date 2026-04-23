import type { WSContext } from 'hono/ws'
import type { ServerMessage } from './types.js'

export type PeerEntry = {
  ws: WSContext
}

const rooms = new Map<string, Map<string, PeerEntry>>()

function getOrCreateRoom(roomId: string): Map<string, PeerEntry> {
  let room = rooms.get(roomId)
  if (!room) {
    room = new Map()
    rooms.set(roomId, room)
  }
  return room
}

/** Returns peer IDs already in the room before `peerId` is added. */
export function addPeer(
  roomId: string,
  peerId: string,
  ws: WSContext
): string[] {
  const room = getOrCreateRoom(roomId)
  const existing = [...room.keys()]
  room.set(peerId, { ws })
  return existing
}

export function removePeer(roomId: string, peerId: string): void {
  const room = rooms.get(roomId)
  if (!room) return
  room.delete(peerId)
  if (room.size === 0) {
    rooms.delete(roomId)
  }
}

export function getPeer(roomId: string, peerId: string): PeerEntry | undefined {
  return rooms.get(roomId)?.get(peerId)
}

export function broadcastExcept(
  roomId: string,
  exceptPeerId: string,
  message: ServerMessage
): void {
  const room = rooms.get(roomId)
  if (!room) return
  const payload = JSON.stringify(message)
  for (const [id, entry] of room) {
    if (id === exceptPeerId) continue
    entry.ws.send(payload)
  }
}

export function sendToPeer(
  roomId: string,
  targetPeerId: string,
  message: ServerMessage
): boolean {
  const entry = getPeer(roomId, targetPeerId)
  if (!entry) return false
  entry.ws.send(JSON.stringify(message))
  return true
}
