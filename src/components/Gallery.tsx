import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PLACEHOLDER_GALLERY, type GalleryImage } from '../lib/config'

function PlaceholderArt({ index }: { index: number }) {
  const hues = ['#D6B56D', '#D9A6A0', '#A8873F', '#E8D5A8', '#C9A86A', '#D9A6A0']
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" role="img" aria-label={`Placeholder floral artwork ${index + 1}`}>
      <rect width="400" height="300" fill="#F6EBDD" />
      <circle cx="200" cy="150" r="90" fill={hues[index % hues.length]} opacity="0.35" />
      <circle cx="200" cy="150" r="55" fill="none" stroke="#D6B56D" strokeWidth="2" />
      <text x="200" y="158" textAnchor="middle" fontFamily="Georgia, serif" fontSize="28" fill="#49372F">M &amp; S</text>
      <text x="200" y="185" textAnchor="middle" fontFamily="Georgia, serif" fontSize="12" fill="#6B5348">27 · 12 · 2026</text>
      <path d="M40 260 Q200 220 360 260" fill="none" stroke="#D6B56D" strokeWidth="2" />
    </svg>
  )
}

export default function Gallery({ images = PLACEHOLDER_GALLERY }: { images?: GalleryImage[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const close = useCallback(() => setLightbox(null), [])
  const step = useCallback(
    (d: number) => setLightbox((i) => (i === null ? i : (i + d + images.length) % images.length)),
    [images.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, close, step])

  const [touchX, setTouchX] = useState<number | null>(null)

  return (
    <section id="gallery" className="bg-cream/60 px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">Our Gallery</h2>
        <p className="mt-3 text-center text-sm text-brown-light">
          These are placeholder floral panels until the couple uploads real photographs in Admin.
          They are not wedding photographs.
        </p>
        <div className="mt-8 columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setLightbox(i)}
              className="block w-full overflow-hidden rounded-2xl border border-gold/40 shadow-sm transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gold"
              aria-label={`Open gallery image ${i + 1}`}
            >
              {img.is_placeholder || !img.image_url ? (
                <div className="aspect-[4/3]"><PlaceholderArt index={i} /></div>
              ) : (
                <img src={img.image_url} alt={`Wedding photograph ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              )}
              <span className="block bg-white px-3 py-2 text-center text-[11px] tracking-widest text-gold-dark">
                {img.is_placeholder || !img.image_url ? 'PLACEHOLDER ARTWORK' : 'WEDDING PHOTO'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gallery lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown/90 p-4"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return
            const dx = e.changedTouches[0].clientX - touchX
            if (dx < -50) step(1)
            if (dx > 50) step(-1)
            setTouchX(null)
          }}
        >
          <button onClick={close} aria-label="Close lightbox" className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-brown focus:outline-none focus:ring-2 focus:ring-gold"><X /></button>
          <button onClick={() => step(-1)} aria-label="Previous image" className="absolute left-2 rounded-full bg-white/90 p-2 text-brown focus:outline-none focus:ring-2 focus:ring-gold sm:left-6"><ChevronLeft /></button>
          <div className="max-w-3xl">
            <PlaceholderArt index={lightbox} />
            <p className="mt-3 text-center text-sm text-ivory">
              {images[lightbox].is_placeholder ? 'Placeholder artwork — not a wedding photograph' : 'Wedding photograph'} · {lightbox + 1} of {images.length}
            </p>
          </div>
          <button onClick={() => step(1)} aria-label="Next image" className="absolute right-2 rounded-full bg-white/90 p-2 text-brown focus:outline-none focus:ring-2 focus:ring-gold sm:right-6"><ChevronRight /></button>
        </div>
      )}
    </section>
  )
}
