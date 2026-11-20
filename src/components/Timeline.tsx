import { Clock } from 'lucide-react'
import type { WeddingEvent } from '../lib/config'

// The timeline intentionally starts EMPTY. No event times have been
// supplied by the couple, so none are invented here. Add real events
// in Admin (/admin → Timeline); they are stored in wedding_events.
export default function Timeline({ events = [] }: { events?: WeddingEvent[] }) {
  return (
    <section id="timeline" className="px-5 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Wedding Day Timeline</h2>
        {events.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gold/60 bg-white/70 p-8">
            <Clock className="mx-auto text-gold" size={28} aria-hidden />
            <p className="mt-3 font-serif text-xl">Our timings are being finalised</p>
            <p className="mt-2 text-sm leading-relaxed text-brown-light">
              The order of the day will appear here once the couple confirms it.
              Please check back closer to 27 December 2026.
            </p>
          </div>
        ) : (
          <ol className="mt-10 space-y-4 text-left">
            {[...events].sort((a, b) => a.event_order - b.event_order).map((e) => (
              <li key={e.id} className="rounded-2xl border border-gold/40 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-medium tracking-[0.2em] text-gold-dark">{e.event_time}</p>
                <h3 className="mt-1 font-serif text-2xl">{e.title}</h3>
                {e.description && <p className="mt-1 text-sm text-brown-light">{e.description}</p>}
                {e.location && <p className="mt-1 text-xs text-brown-light">{e.location}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
