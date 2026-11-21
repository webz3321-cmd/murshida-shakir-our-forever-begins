import { useEffect, useRef, useState } from 'react'
import { useNavigate } from './useNavigate'
import {
  adminAuthStatus,
  adminSessionValid,
  setupAdminPasscode,
  supabaseConfigured,
  verifyAdminPasscode,
} from '../lib/supabase'

/**
 * Discreet admin entry point: a tiny champagne-gold dot, fixed at the
 * bottom-right of every public page. It opens a minimal ADMIN ACCESS
 * modal that asks for a PASSCODE ONLY — there is no email field and no
 * Supabase Auth sign-in anywhere in this flow.
 *
 * Security, in brief:
 * - No passcode value is stored or checked in this component (or
 *   anywhere in the frontend). The passcode lives server-side only as
 *   a bcrypt hash (migration 004).
 * - On first use, when no passcode exists yet, the modal shows a setup
 *   form ("Set your admin passcode" + confirm). The owner chooses the
 *   passcode there; setup only works while none exists.
 * - After that, the modal shows only "Enter your administrator
 *   passcode to continue." A correct passcode returns a short-lived
 *   session token, stored in sessionStorage only — never the passcode.
 * - Five wrong attempts lock verification for 5 minutes, server-side.
 * - The dot is only an entry point; it grants nothing by itself. Every
 *   admin operation checks the session token inside SECURITY DEFINER
 *   functions on the server.
 *
 * If Supabase is not configured, the modal says so instead of
 * pretending a sign-in is possible.
 */
export default function AdminDot() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'checking' | 'setup' | 'login' | 'locked'>('checking')
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  async function refreshStatus() {
    if (!supabaseConfigured) {
      // Show the login form (with the not-configured note) instead of
      // stalling on "Checking…" when there is no Supabase to check.
      setMode('login')
      return
    }
    // Already unlocked in this tab? Go straight to the panel.
    if (await adminSessionValid()) {
      setOpen(false)
      navigate('/admin')
      return
    }
    const status = await adminAuthStatus()
    if (!status) {
      setError('Could not reach Supabase — check the connection and that migration 004 has run.')
      setMode('login')
      return
    }
    if (status.locked_until && new Date(status.locked_until).getTime() > Date.now()) {
      setLockedUntil(status.locked_until)
      setMode('locked')
      return
    }
    setLockedUntil(null)
    setMode(status.has_passcode ? 'login' : 'setup')
  }

  useEffect(() => {
    if (open) {
      setError('')
      setPasscode('')
      setConfirm('')
      setMode('checking')
      void refreshStatus()
      const t = window.setTimeout(() => inputRef.current?.focus(), 80)
      return () => window.clearTimeout(t)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!supabaseConfigured) {
      return setError('Supabase is not configured yet — see the README setup steps.')
    }
    if (passcode.length < 4) return setError('The passcode must be at least 4 characters.')
    setLoading(true)
    try {
      if (mode === 'setup') {
        if (passcode !== confirm) {
          setLoading(false)
          return setError('The passcode and its confirmation do not match.')
        }
        const ok = await setupAdminPasscode(passcode)
        if (!ok) {
          setLoading(false)
          return setError('A passcode is already set — use the login form instead. If it is forgotten, see the recovery steps in SUPABASE_SETUP.md.')
        }
        // Fall through to verification so setup also signs the owner in.
      }
      const token = await verifyAdminPasscode(passcode)
      setLoading(false)
      if (!token) {
        // Re-check status so a lockout is reported accurately.
        const status = await adminAuthStatus()
        if (status?.locked_until && new Date(status.locked_until).getTime() > Date.now()) {
          setLockedUntil(status.locked_until)
          setMode('locked')
          return setError('')
        }
        return setError(mode === 'setup'
          ? 'The passcode could not be verified. Please try opening the admin panel again.'
          : 'That passcode is not correct. Please try again.')
      }
      setOpen(false)
      navigate('/admin')
    } catch {
      setLoading(false)
      setError('Something went wrong. Please try again.')
    }
  }

  const lockedText = lockedUntil
    ? `Too many wrong attempts. Verification is locked until ${new Date(lockedUntil).toLocaleTimeString()}. Please wait and try again.`
    : 'Too many wrong attempts. Please wait a few minutes and try again.'

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
            {mode === 'setup' ? (
              <p className="mt-2 text-sm text-brown-light">No admin passcode is set yet. Choose one now — only you will know it.</p>
            ) : (
              <p className="mt-2 text-sm text-brown-light">Enter your administrator passcode to continue.</p>
            )}
            {mode === 'checking' ? (
              <p className="mt-6 text-sm text-brown-light">Checking…</p>
            ) : mode === 'locked' ? (
              <div className="mt-5">
                <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{lockedText}</p>
                <button
                  onClick={() => void refreshStatus()}
                  className="mt-4 rounded-full border border-gold/60 px-5 py-2 text-sm"
                >
                  Check again
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3 text-left">
                <label className="block">
                  <span className="text-xs font-medium tracking-widest text-brown-light">
                    {mode === 'setup' ? 'SET YOUR ADMIN PASSCODE' : 'PASSCODE'}
                  </span>
                  <input
                    ref={inputRef}
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                    placeholder="••••"
                    className="mt-1 w-full rounded-lg border border-gold/50 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </label>
                {mode === 'setup' && (
                  <label className="block">
                    <span className="text-xs font-medium tracking-widest text-brown-light">CONFIRM PASSCODE</span>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••"
                      className="mt-1 w-full rounded-lg border border-gold/50 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                  </label>
                )}
                {error && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{error}</p>}
                {!supabaseConfigured && (
                  <p className="rounded-lg bg-cream p-3 text-xs leading-relaxed text-brown-light">
                    Supabase is not configured in this deployment yet. Set VITE_SUPABASE_URL and
                    VITE_SUPABASE_ANON_KEY, run migrations 001, 002, 003 and 004 plus storage.sql.
                    Full steps: SUPABASE_SETUP.md in the repo.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-brown py-3 text-sm font-medium tracking-[0.2em] text-ivory transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-70"
                >
                  {loading ? 'CHECKING…' : mode === 'setup' ? 'SET PASSCODE & UNLOCK' : 'UNLOCK ADMIN PANEL'}
                </button>
              </form>
            )}
            <button onClick={() => setOpen(false)} className="mt-4 text-sm text-brown-light underline">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
