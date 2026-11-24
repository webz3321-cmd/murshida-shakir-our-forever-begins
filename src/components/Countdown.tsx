import { useEffect, useState } from 'react'
import { WEDDING } from '../lib/config'

function getRemaining() {
  const target = new Date(WEDDING.weddingDateISO).getTime()
  const diff = Math.max(0, target - Date.now())
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
    done: diff <= 0,
  }
}

export default function Countdown() {
  const [t, setT] = useState(getRemaining)
  useEffect(() => {
    const id = window.setInterval(() => setT(getRemaining()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (t.done) {
    return (
      <section className="px-5 py-16 text-center">
        <p className="font-script text-4xl text-gold-dark">Just Married</p>
        <p className="mt-2 text-sage-dark">Murshida &amp; Shakir began their forever on 27 December 2026.</p>
      </section>
    )
  }

  const cells: Array<[number, string]> = [
    [t.days, 'Days'],
    [t.hours, 'Hours'],
    [t.minutes, 'Minutes'],
    [t.seconds, 'Seconds'],
  ]
  return (
    <section aria-label="Countdown to the wedding" className="px-5 py-16 text-center">
      <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Counting Down to Forever</h2>
      <p className="mt-2 text-sm text-sage-dark">27 December 2026 · Asia/Kolkata</p>
      <div className="mx-auto mt-8 grid max-w-lg grid-cols-4 gap-3">
        {cells.map(([value, label]) => (
          <div key={label} className="rounded-xl border border-gold/50 bg-white/80 px-2 py-5 shadow-sm">
            <p className="font-serif text-4xl font-semibold tabular-nums text-emerald-dark sm:text-5xl">
              {String(value).padStart(2, '0')}
            </p>
            <p className="mt-1 text-[11px] font-medium tracking-[0.2em] text-gold-dark">{label.toUpperCase()}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
