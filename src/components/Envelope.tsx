import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Sparkles } from 'lucide-react'
import { WEDDING } from '../lib/config'
import { recordAnalyticsEvent } from '../lib/supabase'
import QubbaRing from './QubbaRing'

export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 1.2)
    })
  } catch {
    // Audio is best-effort; a blocked AudioContext must never break the open.
  }
}

export default function Envelope({
  soundOn,
  onToggleSound,
  onOpened,
}: {
  soundOn: boolean
  onToggleSound: () => void
  onOpened: () => void
}) {
  const [opening, setOpening] = useState(false)
  const [showQubba, setShowQubba] = useState(false)
  const timers = useRef<number[]>([])

  const open = () => {
    if (opening) return
    setOpening(true)
    if (soundOn) playChime()
    void recordAnalyticsEvent('invitation_open')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      timers.current.push(window.setTimeout(onOpened, 1400))
      return
    }
    // Envelope flap opens, then the Qubba ring blooms full-screen,
    // then the main site is revealed.
    timers.current.push(window.setTimeout(() => setShowQubba(true), 1400))
    timers.current.push(window.setTimeout(onOpened, 4200))
  }

  if (showQubba) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ivory px-5 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        >
          <QubbaRing variant="intro" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-6 font-serif text-lg italic text-brown-light"
        >
          {WEDDING.heading}
        </motion.p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ivory px-5 py-10 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {['🌸', '✦', '🌿', '✦', '🌸'].map((p, i) => (
          <span
            key={i}
            className="animate-floaty absolute text-2xl opacity-60"
            style={{ left: `${12 + i * 18}%`, top: `${14 + (i % 3) * 26}%`, animationDelay: `${i * 0.8}s` }}
          >
            {p}
          </span>
        ))}
      </div>

      <button
        onClick={onToggleSound}
        aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
        className="absolute right-4 top-4 z-20 rounded-full border border-gold/60 bg-white/80 p-2.5 text-brown shadow-sm focus:outline-none focus:ring-2 focus:ring-gold"
      >
        {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Huge invitation heading */}
        <h1 className="font-serif font-semibold leading-[0.95] tracking-wide text-brown">
          <span className="block text-6xl sm:text-7xl">YOU ARE</span>
          <span className="block text-7xl text-gold-dark sm:text-8xl">INVITED</span>
        </h1>
        <div className="gold-divider my-4"><Sparkles size={16} /></div>

        <div className={`envelope-scene relative mx-auto mt-2 h-72 w-full max-w-sm ${opening ? 'envelope-open' : ''}`}>
          {/* Inner card that slides out */}
          <div className="envelope-card absolute inset-x-6 top-4 z-10 rounded-lg border border-gold/70 bg-white px-6 py-8 shadow-xl">
            <p className="font-script text-5xl leading-tight text-brown">
              {WEDDING.brideName} <span className="text-gold">&amp;</span> {WEDDING.groomName}
            </p>
            <p className="mt-3 text-sm tracking-[0.25em] text-brown-light">27 DECEMBER 2026</p>
            <p className="mt-2 text-xs tracking-widest text-gold-dark">{WEDDING.dateShort}</p>
          </div>
          {/* Envelope body */}
          <div className="absolute inset-x-0 bottom-0 z-20 h-44 overflow-hidden rounded-b-xl border border-gold/60 bg-cream shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(214,181,109,0.25),transparent_60%)]" />
            <p className="mt-24 font-serif text-lg italic text-brown-light">{WEDDING.heading}</p>
          </div>
          {/* Flap */}
          <div className="envelope-flap absolute inset-x-0 top-0 z-30 h-36 origin-top rounded-t-xl border border-gold/60 bg-[#EFDDBB] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </div>

        {/* Blinking pointing finger above the button */}
        <div aria-hidden className="finger-blink mt-7 text-4xl text-gold-dark">👇</div>
        <button
          onClick={open}
          disabled={opening}
          className="mt-2 rounded-full bg-brown px-8 py-3.5 text-sm font-medium tracking-[0.2em] text-ivory shadow-lg transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:opacity-70"
        >
          {opening ? 'OPENING…' : 'OPEN INVITATION ✨'}
        </button>
        <p className="mt-4 text-sm text-brown-light">{WEDDING.invitationMessage}</p>
      </motion.div>
    </div>
  )
}
