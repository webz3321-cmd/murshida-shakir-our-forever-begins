import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { WEDDING } from '../lib/config'
import QubbaRing from './QubbaRing'

export default function Hero({ animationsEnabled = true }: { animationsEnabled?: boolean }) {
  // Gentle scroll parallax: the ring drifts up and fades as you scroll away.
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    if (!animationsEnabled) return
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [animationsEnabled])

  const ringOpacity = Math.max(0, 0.5 - scrollY / 1200)
  const ringShift = animationsEnabled ? Math.min(scrollY * 0.25, 120) : 0

  return (
    <header className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-mint px-5 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {['🍃', '✦', '🌿', '✦'].map((p, i) => (
          <span key={i} className="animate-floaty absolute text-2xl opacity-50" style={{ left: `${15 + i * 22}%`, top: `${18 + (i % 2) * 55}%`, animationDelay: `${i}s` }}>{p}</span>
        ))}
      </div>
      {/* Qubba ring resting behind the names */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ opacity: ringOpacity, transform: `translate(-50%, calc(-50% + ${ringShift}px))` }}
      >
        <QubbaRing variant="hero" showNames={false} />
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="relative z-10">
        <p className="font-script text-4xl text-gold-dark sm:text-5xl">Our Forever Begins</p>
        <h1 className="mt-4 font-serif text-6xl font-semibold leading-none tracking-wide text-emerald-dark sm:text-8xl">
          {WEDDING.brideName}
          <span className="mx-3 font-script text-5xl text-gold sm:text-7xl">&amp;</span>
          {WEDDING.groomName}
        </h1>
        <div className="gold-divider my-6"><span aria-hidden>❦</span></div>
        <p className="mx-auto max-w-xl font-serif text-xl italic leading-relaxed text-sage-dark">
          &ldquo;{WEDDING.heroMessage}&rdquo;
        </p>
        <p className="mt-6 text-sm font-medium tracking-[0.3em] text-emerald-dark">27 DECEMBER 2026</p>
        <p className="mt-1 text-xs tracking-[0.25em] text-gold-dark">{WEDDING.dateShort}</p>
        <a
          href="#details"
          className="mt-10 inline-block rounded-full bg-emerald-dark px-8 py-3.5 text-sm font-medium tracking-[0.2em] text-mint shadow-lg transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          EXPLORE OUR WEDDING
        </a>
      </motion.div>
      <ChevronDown className="absolute bottom-6 animate-bounce text-gold" aria-hidden />
    </header>
  )
}
