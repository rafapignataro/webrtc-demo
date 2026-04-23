/** Signaling messages (JSON over WebSocket). */

export type IceCandidateJson = {
  candidate?: string | null
  sdpMLineIndex?: number | null
  sdpMid?: string | null
  usernameFragment?: string | null
} | null

export type ClientMessage =
  | { type: 'join'; roomId: string }
  | { type: 'offer'; to: string; sdp: string }
  | { type: 'answer'; to: string; sdp: string }
  | { type: 'ice-candidate'; to: string; candidate: IceCandidateJson }
  | { type: 'leave' }

export type ServerMessage =
  | { type: 'joined'; roomId: string; peerId: string; peers: string[] }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'offer'; from: string; sdp: string }
  | { type: 'answer'; from: string; sdp: string }
  | { type: 'ice-candidate'; from: string; candidate: IceCandidateJson }
  | { type: 'error'; message: string }
