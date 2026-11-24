import { MapPin, Navigation } from 'lucide-react'
import { WEDDING } from '../lib/config'

export default function Venue() {
  return (
    <section id="venue" className="px-5 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <MapPin className="mx-auto text-gold" size={28} aria-hidden />
        <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">The Venue</h2>
        <p className="mt-4 font-serif text-2xl">{WEDDING.venueName}</p>
        {WEDDING.venueAddress ? (
          <p className="mt-2 text-sage-dark">{WEDDING.venueAddress}</p>
        ) : (
          <p className="mt-2 text-sm text-sage-dark">
            Address to be confirmed — please check back closer to the day.
          </p>
        )}
        <div className="mx-auto mt-6 overflow-hidden rounded-2xl border border-gold/40 shadow-sm">
          <iframe
            title={`Map search for ${WEDDING.venueName}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(WEDDING.venueName)}&output=embed`}
            className="h-72 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <p className="mt-3 text-xs text-sage-dark">
          Map shown as a Google Maps search for the venue name — no address or pin has been invented.
        </p>
        <a
          href={WEDDING.mapsSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-dark px-7 py-3 text-sm font-medium tracking-widest text-mint shadow-lg transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          <Navigation size={16} aria-hidden /> GET DIRECTIONS
        </a>
      </div>
    </section>
  )
}
