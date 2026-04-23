import { Link2, LogOut, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type ControlsProps = {
  micOn: boolean
  camOn: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onLeave: () => void
}

export function Controls({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onLeave,
}: ControlsProps) {
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Meeting link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t bg-card/50 px-4 py-3">
      <Button type="button" variant="outline" size="icon" onClick={onToggleMic}>
        {micOn ? <Mic /> : <MicOff />}
        <span className="sr-only">Toggle microphone</span>
      </Button>
      <Button type="button" variant="outline" size="icon" onClick={onToggleCam}>
        {camOn ? <Video /> : <VideoOff />}
        <span className="sr-only">Toggle camera</span>
      </Button>
      <Button type="button" variant="secondary" onClick={copyInvite}>
        <Link2 className="size-4 shrink-0" />
        Copy link
      </Button>
      <Button type="button" variant="destructive" onClick={onLeave}>
        <LogOut className="size-4 shrink-0" />
        Leave
      </Button>
    </div>
  )
}
