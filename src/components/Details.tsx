import { CalendarHeart, Heart, MapPin, Users } from 'lucide-react'
import { WEDDING } from '../lib/config'

const items = [
  { icon: Heart, title: 'The Bride', value: WEDDING.brideName },
  { icon: Heart, title: 'The Groom', value: WEDDING.groomName },
  { icon: CalendarHeart, title: 'The Date', value: WEDDING.weddingDateDisplay },
  { icon: MapPin, title: 'The Venue', value: WEDDING.venueName },
]

export default function Details() {
  return (
    <section id="details" className="bg-sage/60 px-5 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-script text-4xl text-gold-dark">Our Special Day</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Wedding Details</h2>
        <div className="gold-divider my-6"><span aria-hidden>❦</span></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, value }) => (
            <article key={title} className="rounded-2xl border border-gold/40 bg-white/90 p-6 shadow-sm">
              <Icon className="mx-auto text-gold" size={28} aria-hidden />
              <h3 className="mt-3 text-xs font-medium tracking-[0.25em] text-gold-dark">{title.toUpperCase()}</h3>
              <p className="mt-2 font-serif text-2xl">{value}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-sage-dark">
          <Users size={16} aria-hidden /> {WEDDING.invitationMessage}
        </p>
      </div>
    </section>
  )
}
