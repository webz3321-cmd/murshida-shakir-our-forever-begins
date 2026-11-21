import { useEffect, useRef, useState } from 'react'
import { useNavigate } from './useNavigate'
import { supabase, supabaseConfigured } from '../lib/supabase'

/**
 * Discreet admin entry point: a tiny champagne-gold dot, fixed at the
 * bottom-right of every public page. It opens a minimal ADMIN ACCESS
 * modal. There is NO passcode stored or checked in this component —
 * authentication is verified server-side by Supabase Auth (email +
 * password) when the form is submitted, and Supabase Auth enforces its
 * own rate limiting / lockout on repeated failed sign-ins. On success
 * the administrator is taken to /admin. The dot is only an entry
 * point; it grants nothing by itself, and every admin operation is
 * protected by Row Level Security on the server.
 *
 * If Supabase is not configured, the modal says so instead of
 * pretending a sign-in is possible.
 */
export default function AdminDot() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [open ])

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!supabase) return setError('Supabase is not configured yet — see the README setup steps.')
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: passcode })
    setLoading(false)
    if (authError) return setError('That passcode is not correct. Please try again.')
    setOpen(false)
    navigate('/admin')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Admin access"
        title="Admin access"
        className="fixed bottom-4 right-4 z-40 h-4 w-4 rounded-full border border-gold-dark/60 bg-gold shadow-md transition hover:scale-125 hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 sm:bottom-5 sm:right-5"
      />
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin access"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown/70 p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-gold/50 bg-ivory p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-script text-3xl text-gold-dark">Admin Access</p>
            <p className="mt-2 text-sm text-brown-light">Enter your administrator passcode to continue.</p>
            <form onSubmit={unlock} className="mt-5 space-y-3 text-left">
              <label className="block">
                <span className="text-xs font-medium tracking-widest text-brown-light">ADMIN EMAIL</span>
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-gold/50 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium tracking-widest text-brown-light">PASSCODE</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-gold/50 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </label>
              {error && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{error}</p>}
              {!supabaseConfigured && (
                <p className="rounded-lg bg-cream p-3 text-xs leading-relaxed text-brown-light">
                  Supabase is not configured in this deployment yet. Set VITE_SUPABASE_URL and
                  VITE_SUPABASE_ANON_KEY, run migrations 001, 002 and 003 plus storage.sql, and create an admin
                  user first. Full steps: SUPABASE_SETUP.md in the repo.
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-brown py-3 text-sm font-medium tracking-[0.2em] text-ivory transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-70"
              >
                {loading ? 'CHECKING…' : 'UNLOCK ADMIN PANEL'}
              </button>
            </form>
            <button onClick={() => setOpen(false)} className="mt-4 text-sm text-brown-light underline">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
