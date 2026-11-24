import { WEDDING } from '../lib/config'

/**
 * Green Qubba-minar ring — the first ornament after the envelope opens.
 * A deep emerald onion dome with a gold crescent finial, a gold band and
 * an arched doorway, flanked by two slender minarets with their own
 * little emerald domes, all inside the rotating gold-and-green star
 * ring. The names sit in emerald script beneath the dome.
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
      <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Green Qubba minaret ornament with emerald dome and twin minarets">
        <defs>
          <linearGradient id="qubba-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8D5A8" />
            <stop offset="50%" stopColor="#D6B56D" />
            <stop offset="100%" stopColor="#A8873F" />
          </linearGradient>
          <linearGradient id="qubba-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B7A4D" />
            <stop offset="55%" stopColor="#0F5132" />
            <stop offset="100%" stopColor="#0A3D24" />
          </linearGradient>
        </defs>

        {/* Outer and inner rings — gold outside, emerald inside */}
        <circle cx="200" cy="200" r="196" fill="none" stroke="url(#qubba-gold)" strokeWidth="1.5" opacity="0.9" />
        <circle cx="200" cy="200" r="188" fill="none" stroke="url(#qubba-gold)" strokeWidth="0.75" opacity="0.6" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="url(#qubba-emerald)" strokeWidth="1" opacity="0.8" />
        <circle cx="200" cy="200" r="142" fill="none" stroke="url(#qubba-gold)" strokeWidth="0.5" opacity="0.5" />

        {/* Rotating geometric star ring — alternating gold and emerald stars */}
        <g className="qubba-spin-slow" style={{ transformOrigin: '200px 200px' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180
            const x = 200 + 169 * Math.cos(a)
            const y = 200 + 169 * Math.sin(a)
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${i * 30})`}>
                <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill={i % 2 === 0 ? '#D6B56D' : '#0F5132'} opacity="0.85" />
              </g>
            )
          })}
        </g>
        <g className="qubba-spin-reverse" style={{ transformOrigin: '200px 200px' }} opacity="0.6">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * 45 * Math.PI) / 180 + Math.PI / 8
            const x = 200 + 120 * Math.cos(a)
            const y = 200 + 120 * Math.sin(a)
            return <circle key={i} cx={x} cy={y} r="2.5" fill={i % 2 === 0 ? '#D6B56D' : '#1B7A4D'} />
          })}
        </g>

        {/* Twin minarets — slender emerald shafts with gold balconies
            and little emerald onion domes */}
        {[
          { x: 96 },
          { x: 304 },
        ].map(({ x }) => (
          <g key={x}>
            {/* shaft */}
            <rect x={x - 7} y="168" width="14" height="92" rx="3" fill="url(#qubba-emerald)" stroke="url(#qubba-gold)" strokeWidth="1" />
            {/* gold balcony bands */}
            <rect x={x - 11} y="188" width="22" height="5" rx="2" fill="url(#qubba-gold)" />
            <rect x={x - 11} y="224" width="22" height="5" rx="2" fill="url(#qubba-gold)" />
            {/* little emerald onion dome */}
            <path d={`M ${x - 12} 168 C ${x - 12} 152, ${x - 6} 144, ${x} 136 C ${x + 6} 144, ${x + 12} 152, ${x + 12} 168 Z`} fill="url(#qubba-emerald)" stroke="url(#qubba-gold)" strokeWidth="1" />
            <line x1={x} y1="136" x2={x} y2="128" stroke="url(#qubba-gold)" strokeWidth="1.5" />
            <circle cx={x} cy="125" r="2.5" fill="#D6B56D" />
            {/* base */}
            <rect x={x - 10} y="258" width="20" height="6" rx="2" fill="url(#qubba-gold)" />
          </g>
        ))}

        {/* Central emerald onion dome */}
        <path
          d="M138 218 C138 168, 162 142, 200 108 C238 142, 262 168, 262 218 Z"
          fill="url(#qubba-emerald)"
          stroke="url(#qubba-gold)"
          strokeWidth="1.5"
        />
        {/* Gold crescent finial above the dome */}
        <line x1="200" y1="108" x2="200" y2="92" stroke="url(#qubba-gold)" strokeWidth="2" />
        <path d="M206 62 A13 13 0 1 0 206 88 A10.5 10.5 0 1 1 206 62 Z" fill="#D6B56D" />
        <circle cx="200" cy="56" r="2.5" fill="#D6B56D" />
        {/* Gold band across the dome base */}
        <rect x="136" y="212" width="128" height="7" rx="3" fill="url(#qubba-gold)" />
        {/* Arched doorway in the dome */}
        <path
          d="M182 212 L182 178 Q200 158 218 178 L218 212 Z"
          fill="#F2F8F1"
          stroke="url(#qubba-gold)"
          strokeWidth="1.5"
        />
        <path d="M191 212 L191 184 Q200 174 209 184 L209 212" fill="none" stroke="#0F5132" strokeWidth="1" opacity="0.5" />
        {/* Dome base line joining the minarets */}
        <line x1="86" y1="264" x2="314" y2="264" stroke="url(#qubba-gold)" strokeWidth="1" opacity="0.7" />

        {/* Travelling golden light: a bright point orbiting the border */}
        <g className="qubba-orbit" style={{ transformOrigin: '200px 200px' }}>
          <circle cx="200" cy="4" r="5" fill="#F4E3B0" />
          <circle cx="200" cy="4" r="9" fill="#D6B56D" opacity="0.35" />
        </g>
      </svg>

      {showNames && (
        <div className="absolute inset-0 flex flex-col items-center justify-end px-10 pb-8 text-center">
          <p className="font-script text-4xl leading-tight text-emerald-dark sm:text-5xl">Murshida</p>
          <p className="my-1 font-serif text-2xl text-gold">&amp;</p>
          <p className="font-script text-4xl leading-tight text-emerald-dark sm:text-5xl">Shakir</p>
          <p className="mt-3 text-[11px] font-medium tracking-[0.3em] text-sage-dark">27 DECEMBER 2026</p>
          <p className="mt-1 text-[10px] tracking-[0.25em] text-gold-dark">{WEDDING.dateShort}</p>
        </div>
      )}
    </div>
  )
}
