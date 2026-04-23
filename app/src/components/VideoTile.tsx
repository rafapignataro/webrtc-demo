import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type VideoTileProps = {
  stream: MediaStream | null
  label: string
  muted?: boolean
  className?: string
}

export function VideoTile({
  stream,
  label,
  muted,
  className,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !stream) return
    el.srcObject = stream
    return () => {
      el.srcObject = null
    }
  }, [stream])

  return (
    <div
      className={cn(
        'relative aspect-video h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl border bg-muted/30',
        className
      )}
    >
      <video
        ref={ref}
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        muted={muted}
      />
      <div className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
        {label}
      </div>
    </div>
  )
}
