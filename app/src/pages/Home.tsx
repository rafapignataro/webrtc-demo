import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customAlphabet } from 'nanoid'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const ROOM_ID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ROOM_ID_LENGTH = 6
const generateRoomId = customAlphabet(ROOM_ID_ALPHABET, ROOM_ID_LENGTH)

function normalizeRoomInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const fromPath = t.match(/\/room\/([^/?#]+)/)
  if (fromPath) return fromPath[1]
  return t
}

export default function Home() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')

  const startMeeting = () => {
    const id = generateRoomId()
    navigate(`/room/${id}`)
  }

  const joinMeeting = () => {
    const id = normalizeRoomInput(joinCode)
    if (!id) return
    navigate(`/room/${id}`)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">WebRTC Meet POC</h1>
        <p className="text-muted-foreground text-sm">
          Start a room and share the link, or join with a room code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New meeting</CardTitle>
          <CardDescription>
            Creates a room and opens the call. Share the URL with others.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={startMeeting}>
            Start meeting
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join meeting</CardTitle>
          <CardDescription>
            Paste a room code or the full meeting link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Room code or link"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') joinMeeting()
            }}
          />
          <Button type="button" onClick={joinMeeting}>
            Join
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
