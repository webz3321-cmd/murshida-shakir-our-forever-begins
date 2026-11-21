import { WEDDING } from '../lib/config'

/**
 * Qubba-inspired ornamental ring — luxury Islamic architectural
 * ornamentation, not a cartoon mosque: concentric champagne-gold rings,
 * rotating eight-pointed geometric stars, a dome arc with a finial, and
 * a golden light travelling around the border. The names sit inside.
 * `variant="intro"` is the full-screen moment after the envelope opens;
 * `variant="hero"` is the quiet ring resting behind the hero names.
 */
export default function QubbaRing({
  variant = 'hero',
  showNames = true,
}: {
  variant?: 'intro' | 'hero'
  showNames?: boolean
}) {
  const size = variant === 'intro' ? 'min(88vw, 520px)' : 'min(92vw, 640px)'
  return (
    <div
      aria-hidden={!showNames}
      className={`relative mx-auto ${variant === 'intro' ? 'qubba-intro' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Islamic geometric ornamental ring">
        <defs>
          <linearGradient id="qubba-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8D5A8" />
            <stop offset="50%" stopColor="#D6B56D" />
            <stop offset="100%" stopColor="#A8873F" />
          </linearGradient>
        </defs>

        {/* Outer and inner rings */}
        <circle cx="200" cy="200" r="196" fill="none" stroke="url(#qubba-gold)" strokeWidth="1.5" opacity="0.9" />
        <circle cx="200" cy="200" r="188" fill="none" stroke="url(#qubba-gold)" strokeWidth="0.75" opacity="0.6" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="url(#qubba-gold)" strokeWidth="1" opacity="0.7" />
        <circle cx="200" cy="200" r="142" fill="none" stroke="url(#qubba-gold)" strokeWidth="0.5" opacity="0.5" />

        {/* Rotating geometric star ring */}
        <g className="qubba-spin-slow" style={{ transformOrigin: '200px 200px' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180
            const x = 200 + 169 * Math.cos(a)
            const y = 200 + 169 * Math.sin(a)
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${i * 30})`}>
                <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#D6B56D" opacity="0.85" />
              </g>
            )
          })}
        </g>
        <g className="qubba-spin-reverse" style={{ transformOrigin: '200px 200px' }} opacity="0.55">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * 45 * Math.PI) / 180 + Math.PI / 8
            const x = 200 + 120 * Math.cos(a)
            const y = 200 + 120 * Math.sin(a)
            return <circle key={i} cx={x} cy={y} r="2.5" fill="#D6B56D" />
          })}
        </g>

        {/* Dome arc with finial, crowning the inner circle */}
        <g fill="none" stroke="url(#qubba-gold)" strokeWidth="1.5">
          <path d="M140 165 Q200 78 260 165" />
          <path d="M152 165 Q200 100 248 165" opacity="0.6" />
          <line x1="200" y1="76" x2="200" y2="58" />
          <circle cx="200" cy="54" r="4" fill="#D6B56D" stroke="none" />
          <line x1="140" y1="165" x2="260" y2="165" opacity="0.7" />
        </g>

        {/* Travelling golden light: a bright point orbiting the border */}
        <g className="qubba-orbit" style={{ transformOrigin: '200px 200px' }}>
          <circle cx="200" cy="4" r="5" fill="#F4E3B0" />
          <circle cx="200" cy="4" r="9" fill="#D6B56D" opacity="0.35" />
        </g>
      </svg>

      {showNames && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <p className="font-script text-4xl leading-tight text-gold-dark sm:text-5xl">Murshida</p>
          <p className="my-1 font-serif text-2xl text-gold">&amp;</p>
          <p className="font-script text-4xl leading-tight text-gold-dark sm:text-5xl">Shakir</p>
          <p className="mt-3 text-[11px] font-medium tracking-[0.3em] text-brown-light">27 DECEMBER 2026</p>
          <p className="mt-1 text-[10px] tracking-[0.25em] text-gold-dark">{WEDDING.dateShort}</p>
        </div>
      )}
    </div>
  )
}
