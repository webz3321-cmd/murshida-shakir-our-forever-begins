import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { WEDDING } from '../lib/config'

export default function Hero() {
  return (
    <header className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ivory px-5 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {['🌸', '✦', '🌿', '✦'].map((p, i) => (
          <span key={i} className="animate-floaty absolute text-2xl opacity-50" style={{ left: `${15 + i * 22}%`, top: `${18 + (i % 2) * 55}%`, animationDelay: `${i}s` }}>{p}</span>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="relative z-10">
        <p className="font-script text-4xl text-gold-dark sm:text-5xl">Our Forever Begins</p>
        <h1 className="mt-4 font-serif text-6xl font-semibold leading-none tracking-wide text-brown sm:text-8xl">
          {WEDDING.brideName}
          <span className="mx-3 font-script text-5xl text-gold sm:text-7xl">&amp;</span>
          {WEDDING.groomName}
        </h1>
        <div className="gold-divider my-6"><span aria-hidden>❦</span></div>
        <p className="mx-auto max-w-xl font-serif text-xl italic leading-relaxed text-brown-light">
          &ldquo;{WEDDING.heroMessage}&rdquo;
        </p>
        <p className="mt-6 text-sm font-medium tracking-[0.3em] text-brown">27 DECEMBER 2026</p>
        <p className="mt-1 text-xs tracking-[0.25em] text-gold-dark">{WEDDING.dateShort}</p>
        <a
          href="#details"
          className="mt-10 inline-block rounded-full bg-brown px-8 py-3.5 text-sm font-medium tracking-[0.2em] text-ivory shadow-lg transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          EXPLORE OUR WEDDING
        </a>
      </motion.div>
      <ChevronDown className="absolute bottom-6 animate-bounce text-gold" aria-hidden />
    </header>
  )
}
