import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scroll-triggered entrance reveal (Intersection Observer).
 * Sections fade and rise gently into view once, then stay visible.
 * Respects reduced-motion (content shows immediately) and the admin
 * animations toggle via the `enabled` prop.
 */
export default function Reveal({
  children,
  enabled = true,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  enabled?: boolean
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) { setVisible(true); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} reveal ${visible ? 'reveal-visible' : ''}`}
    >
      {children}
    </div>
  )
}
