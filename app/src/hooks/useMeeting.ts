import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { connectSignaling } from '@/lib/signaling'
import type { SignalingConnection } from '@/lib/signaling'
import { createPeerConnection } from '@/lib/webrtc'
import type { ServerMessage } from '@/types/signaling'

const defaultWsUrl = 'ws://localhost:8787/ws'

const NO_CAMERA_MESSAGE =
  'No camera available. You joined without video. Check if another app is using it.'

function signalingUrl(): string {
  const fromEnv = import.meta.env.VITE_SIGNALING_URL as string | undefined
  return (fromEnv && fromEnv.length > 0 ? fromEnv : defaultWsUrl).trim()
}

function isCameraUnavailableError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false
  return (
    err.name === 'NotReadableError' ||
    err.name === 'NotFoundError' ||
    err.name === 'OverconstrainedError' ||
    err.name === 'TrackStartError'
  )
}

export function useMeeting(roomId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    () => new Map()
  )
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [hasCamera, setHasCamera] = useState(true)
  const [joined, setJoined] = useState(false)
  const [selfPeerId, setSelfPeerId] = useState<string | null>(null)

  const signalingRef = useRef<SignalingConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let disposed = false
    const pcs = new Map<string, RTCPeerConnection>()
    const pendingIce = new Map<string, RTCIceCandidateInit[]>()
    let media: MediaStream | null = null

    const addIceSafe = async (
      peerId: string,
      candidate: RTCIceCandidateInit | null
    ) => {
      const pc = pcs.get(peerId)
      if (!pc) return
      if (!candidate) {
        try {
          await pc.addIceCandidate(null)
        } catch {
          /* ignore */
        }
        return
      }
      if (!pc.remoteDescription) {
        const q = pendingIce.get(peerId) ?? []
        q.push(candidate)
        pendingIce.set(peerId, q)
        return
      }
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        /* ignore */
      }
    }

    const flushIce = async (peerId: string) => {
      const pc = pcs.get(peerId)
      if (!pc?.remoteDescription) return
      const queued = pendingIce.get(peerId) ?? []
      pendingIce.delete(peerId)
      for (const c of queued) {
        await addIceSafe(peerId, c)
      }
    }

    const removePeer = (peerId: string) => {
      const pc = pcs.get(peerId)
      if (pc) {
        pc.close()
        pcs.delete(peerId)
      }
      pendingIce.delete(peerId)
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        next.delete(peerId)
        return next
      })
    }

    const attachLocalTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream)
      }
    }

    const createPcFor = (remotePeerId: string, stream: MediaStream) => {
      let pc = pcs.get(remotePeerId)
      if (pc) return pc
      pc = createPeerConnection()
      pcs.set(remotePeerId, pc)

      pc.onicecandidate = (ev) => {
        const c = ev.candidate
        if (!c) return
        const json = c.toJSON()
        signalingRef.current?.send({
          type: 'ice-candidate',
          to: remotePeerId,
          candidate: {
            candidate: json.candidate ?? null,
            sdpMLineIndex: json.sdpMLineIndex ?? null,
            sdpMid: json.sdpMid ?? null,
            usernameFragment: json.usernameFragment ?? null,
          },
        })
      }

      pc.ontrack = (ev) => {
        const incoming = ev.streams[0] ?? new MediaStream([ev.track])
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          const cur = next.get(remotePeerId)
          if (cur) {
            for (const t of incoming.getTracks()) {
              const exists = cur.getTracks().some((x) => x.id === t.id)
              if (!exists) cur.addTrack(t)
            }
            next.set(remotePeerId, cur)
          } else {
            next.set(remotePeerId, incoming)
          }
          return next
        })
      }

      attachLocalTracks(pc, stream)
      return pc
    }

    const handleMessage = async (msg: ServerMessage) => {
      const stream = localStreamRef.current
      const sig = signalingRef.current
      if (!stream || !sig) return

      switch (msg.type) {
        case 'joined': {
          setSelfPeerId(msg.peerId)
          setJoined(true)
          break
        }
        case 'peer-joined': {
          try {
            const pc = createPcFor(msg.peerId, stream)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sig.send({ type: 'offer', to: msg.peerId, sdp: offer.sdp ?? '' })
          } catch (e) {
            console.error(e)
            toast.error('Could not start connection to new peer')
          }
          break
        }
        case 'offer': {
          try {
            const pc = createPcFor(msg.from, stream)
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
            await flushIce(msg.from)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sig.send({ type: 'answer', to: msg.from, sdp: answer.sdp ?? '' })
          } catch (e) {
            console.error(e)
            toast.error('Failed to handle offer')
          }
          break
        }
        case 'answer': {
          try {
            const pc = pcs.get(msg.from)
            if (!pc) break
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
            await flushIce(msg.from)
          } catch (e) {
            console.error(e)
            toast.error('Failed to handle answer')
          }
          break
        }
        case 'ice-candidate': {
          if (!msg.candidate) {
            await addIceSafe(msg.from, null)
            break
          }
          const init: RTCIceCandidateInit = {
            candidate: msg.candidate.candidate ?? undefined,
            sdpMLineIndex: msg.candidate.sdpMLineIndex ?? undefined,
            sdpMid: msg.candidate.sdpMid ?? undefined,
            usernameFragment: msg.candidate.usernameFragment ?? undefined,
          }
          await addIceSafe(msg.from, init)
          break
        }
        case 'peer-left': {
          removePeer(msg.peerId)
          break
        }
        case 'error': {
          toast.error(msg.message)
          break
        }
        default:
          break
      }
    }

    const run = async () => {
      try {
        let cameraAvailable = true
        try {
          media = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
        } catch (err) {
          if (!isCameraUnavailableError(err)) throw err
          cameraAvailable = false
          media = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          })
        }
        if (disposed) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = media
        setLocalStream(media)
        setHasCamera(cameraAvailable)
        if (!cameraAvailable) {
          setCamOn(false)
          toast.error(NO_CAMERA_MESSAGE)
        }

        const sig = await connectSignaling(signalingUrl(), (m) => {
          void handleMessage(m)
        })
        if (disposed) {
          sig.close()
          media.getTracks().forEach((t) => t.stop())
          return
        }
        signalingRef.current = sig
        sig.send({ type: 'join', roomId })
      } catch (e) {
        console.error(e)
        if (!disposed) {
          toast.error(
            e instanceof Error ? e.message : 'Could not start meeting'
          )
        }
      }
    }

    void run()

    return () => {
      disposed = true
      signalingRef.current?.send({ type: 'leave' })
      signalingRef.current?.close()
      signalingRef.current = null
      localStreamRef.current = null
      for (const pc of pcs.values()) {
        pc.close()
      }
      pcs.clear()
      pendingIce.clear()
      if (media) {
        media.getTracks().forEach((t) => t.stop())
      }
      setLocalStream(null)
      setRemoteStreams(new Map())
      setJoined(false)
      setSelfPeerId(null)
      setHasCamera(true)
      setCamOn(true)
    }
  }, [roomId])

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current
    if (!s) return
    const next = !micOn
    for (const t of s.getAudioTracks()) {
      t.enabled = next
    }
    setMicOn(next)
  }, [micOn])

  const toggleCam = useCallback(() => {
    const s = localStreamRef.current
    if (!s) return
    const next = !camOn
    const videoTracks = s.getVideoTracks()
    if (next && (!hasCamera || videoTracks.length === 0)) {
      toast.error(NO_CAMERA_MESSAGE)
      return
    }
    for (const t of videoTracks) {
      t.enabled = next
    }
    setCamOn(next)
  }, [camOn, hasCamera])

  const leave = useCallback(() => {
    signalingRef.current?.send({ type: 'leave' })
    signalingRef.current?.close()
    signalingRef.current = null
    const s = localStreamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    setRemoteStreams(new Map())
    setJoined(false)
    setSelfPeerId(null)
  }, [])

  return {
    localStream,
    remoteStreams,
    micOn,
    camOn,
    joined,
    selfPeerId,
    toggleMic,
    toggleCam,
    leave,
  }
}
