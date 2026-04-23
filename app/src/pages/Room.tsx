import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controls } from '@/components/Controls'
import { VideoTile } from '@/components/VideoTile'
import { useMeeting } from '@/hooks/useMeeting'
import { cn } from '@/lib/utils'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const id = roomId ?? ''

  const meeting = useMeeting(id)

  const tiles = useMemo(() => {
    const list: {
      key: string
      stream: MediaStream | null
      label: string
      muted?: boolean
    }[] = []
    if (meeting.localStream) {
      list.push({
        key: 'local',
        stream: meeting.localStream,
        label: meeting.selfPeerId
          ? `You (${meeting.selfPeerId.slice(0, 6)}…)`
          : 'You',
        muted: true,
      })
    }
    for (const [peerId, stream] of meeting.remoteStreams) {
      list.push({
        key: peerId,
        stream,
        label: `Guest (${peerId.slice(0, 6)}…)`,
      })
    }
    return list
  }, [meeting.localStream, meeting.remoteStreams, meeting.selfPeerId])

  if (!id) {
    navigate('/', { replace: true })
    return null
  }

  const handleLeave = () => {
    meeting.leave()
    navigate('/', { replace: true })
  }

  const gridClass =
    tiles.length <= 1
      ? 'grid-cols-1'
      : tiles.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Room
          </p>
          <p className="font-mono text-sm font-medium">{id}</p>
        </div>
        <p className="text-muted-foreground text-sm">
          {meeting.joined ? (
            <span className="text-foreground">Connected</span>
          ) : (
            'Connecting…'
          )}
        </p>
      </header>

      <main className="flex flex-1 flex-col">
        <div
          className={cn(
            'grid flex-1 gap-4 p-4',
            gridClass,
            'auto-rows-fr content-start'
          )}
        >
          {tiles.map((t) => (
            <VideoTile
              key={t.key}
              stream={t.stream}
              label={t.label}
              muted={t.muted}
            />
          ))}
        </div>

        <Controls
          micOn={meeting.micOn}
          camOn={meeting.camOn}
          onToggleMic={meeting.toggleMic}
          onToggleCam={meeting.toggleCam}
          onLeave={handleLeave}
        />
      </main>
    </div>
  )
}
