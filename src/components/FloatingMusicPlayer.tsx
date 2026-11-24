import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react'

/**
 * Single-audio-instance floating player. Audio only starts after a user
 * gesture (the envelope open / Play tap) — never on page load.
 * `trackUrl` / `trackTitle` come from the audio_library + audio_settings
 * rows in Supabase (Admin → Audio). With no track uploaded, the player
 * shows an honest empty state instead of pretending to play.
 */
export default function FloatingMusicPlayer({
  trackUrl,
  trackTitle,
  enabled,
  loop,
  defaultVolume,
  autoStart,
}: {
  trackUrl?: string
  trackTitle?: string
  enabled: boolean
  loop: boolean
  defaultVolume: number
  autoStart: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(defaultVolume)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = muted ? 0 : volume
    audio.loop = loop
  }, [volume, muted, loop])

  useEffect(() => {
    if (autoStart && trackUrl && enabled) {
      void audioRef.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
    // Only run when the envelope opens (autoStart flips). eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  if (!enabled) return null

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || !trackUrl) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <audio ref={audioRef} src={trackUrl} preload="none" onEnded={() => setPlaying(false)} />
      {open && (
        <div className="mb-2 w-64 rounded-2xl border border-gold/50 bg-white/95 p-4 shadow-xl">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Music size={16} className="text-gold" aria-hidden />
            {trackTitle ?? 'No music uploaded yet'}
          </p>
          <p className="mt-1 text-xs text-sage-dark">
            {trackUrl ? (playing ? 'Now playing' : 'Paused') : 'Upload background music in Admin → Audio.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={toggle} disabled={!trackUrl} aria-label={playing ? 'Pause music' : 'Play music'} className="rounded-full bg-emerald-dark p-2.5 text-mint disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gold">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full border border-gold/50 p-2.5 focus:outline-none focus:ring-2 focus:ring-gold">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" className="w-full accent-[#0F5132]" />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open music player"
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-dark text-mint shadow-lg focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
      >
        {playing ? (
          <span className="flex h-4 items-end gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => <span key={i} className="eq-bar w-1 rounded bg-mint" style={{ height: '100%', animationDelay: `${i * 0.15}s` }} />)}
          </span>
        ) : (
          <Music size={20} />
        )}
      </button>
    </div>
  )
}
