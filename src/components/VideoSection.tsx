import { useRef, useState } from 'react'
import { Clapperboard, Play } from 'lucide-react'
import type { WeddingVideo } from '../lib/config'

/**
 * OUR BEAUTIFUL MOMENTS — cinematic wedding video section.
 * Fed only by real admin uploads (wedding_videos). With no published
 * video, an elegant empty state is shown — never fake video content.
 * The featured video plays first; the film list below selects others.
 */
export default function VideoSection({ videos = [] }: { videos?: WeddingVideo[] }) {
  const published = [...videos]
    .filter((v) => v.is_published)
    .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || a.video_order - b.video_order)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = published.find((v) => v.id === selectedId) ?? published[0]

  return (
    <section id="videos" className="bg-cream/60 px-5 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <p className="font-script text-4xl text-gold-dark">Our Beautiful Moments</p>
        <div className="gold-divider my-5"><span aria-hidden>❦</span></div>
        <p className="mx-auto max-w-xl font-serif text-xl italic leading-relaxed text-brown-light">
          &ldquo;Every beautiful story deserves to be remembered.&rdquo;
        </p>

        {!current ? (
          <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-dashed border-gold/60 bg-white/70 p-10">
            <Clapperboard className="mx-auto text-gold" size={32} aria-hidden />
            <p className="mt-4 font-serif text-2xl">Our films are on their way</p>
            <p className="mt-2 text-sm leading-relaxed text-brown-light">
              No wedding video has been published yet. The couple will share their
              beautiful moments here once they are ready — please check back soon.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-3xl border-2 border-gold/60 bg-brown shadow-xl">
              <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl border border-gold-light/50" aria-hidden />
              <video
                key={current.id}
                ref={videoRef}
                src={current.video_url}
                poster={current.poster_url ?? undefined}
                controls
                playsInline
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="aspect-video w-full bg-brown object-cover"
                aria-label={current.title}
              />
              {!playing && (
                <button
                  onClick={() => void videoRef.current?.play()}
                  aria-label={`Play ${current.title}`}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-brown/30 transition hover:bg-brown/20 focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold text-brown shadow-xl transition hover:scale-105">
                    <Play size={32} fill="currentColor" aria-hidden />
                  </span>
                </button>
              )}
            </div>
            <h3 className="mt-6 font-serif text-2xl">{current.title}</h3>
            {current.description && <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-brown-light">{current.description}</p>}
            {current.is_featured && <p className="mt-2 text-[11px] font-medium tracking-[0.25em] text-gold-dark">FEATURED FILM</p>}

            {published.length > 1 && (
              <div className="mt-8 flex flex-wrap justify-center gap-3" role="listbox" aria-label="Choose a film">
                {published.map((v) => (
                  <button
                    key={v.id}
                    role="option"
                    aria-selected={v.id === current.id}
                    onClick={() => { setSelectedId(v.id); setPlaying(false) }}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-gold ${
                      v.id === current.id ? 'border-gold bg-brown text-ivory' : 'border-gold/50 bg-white text-brown hover:border-gold'
                    }`}
                  >
                    <Play size={14} aria-hidden /> {v.title}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
