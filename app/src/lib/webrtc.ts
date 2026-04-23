export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
}
