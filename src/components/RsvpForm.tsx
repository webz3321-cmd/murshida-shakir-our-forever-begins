import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { AttendanceStatus } from '../lib/config'

const PHONE_RE = /^[+0-9][0-9\s-]{6,14}$/

export default function RsvpForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  const [status, setStatus] = useState<AttendanceStatus>('attending')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const cleanName = name.trim()
    const cleanPhone = phone.replace(/[\s-]/g, '')
    if (cleanName.length < 2) return setError('Please enter your full name.')
    if (!PHONE_RE.test(phone.trim())) return setError('Please enter a valid phone number.')
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
      return setError('Guest count must be between 1 and 10.')
    }
    setLoading(true)
    try {
      // Edit token: a random, unpredictable token returned to the guest.
      // Only its hash is stored (edit_token_hash); the guest can later
      // update their own response with it, without seeing anyone else's.
      const editToken = crypto.randomUUID()
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editToken))
      const editTokenHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')

      if (supabase) {
        const { error: dbError } = await supabase.from('rsvps').upsert(
          {
            guest_name: cleanName,
            phone_number: cleanPhone,
            guest_count: guestCount,
            attendance_status: status,
            message: message.trim() || null,
            edit_token_hash: editTokenHash,
          },
          { onConflict: 'phone_number' },
        )
        if (dbError) throw new Error(dbError.message)
      } else {
        // Demo mode (no Supabase configured): keep the response locally
        // and label it clearly. This is not a substitute for the database.
        const demo = JSON.parse(localStorage.getItem('ms-rsvps-demo') ?? '[]') as unknown[]
        localStorage.setItem('ms-rsvps-demo', JSON.stringify([...demo, { guest_name: cleanName, phone_number: cleanPhone, guest_count: guestCount, attendance_status: status, message, created_at: new Date().toISOString() }]))
        localStorage.setItem('ms-edit-token-demo', editToken)
      }
      try { localStorage.setItem('ms-my-edit-token', editToken) } catch { /* ignore */ }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <section id="rsvp" className="px-5 py-16 text-center">
        <CheckCircle2 className="mx-auto text-gold" size={48} aria-hidden />
        <h2 className="mt-4 font-serif text-3xl font-semibold">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-brown-light">
          Your response has been saved. We can&rsquo;t wait to celebrate with you on 27 December 2026.
        </p>
        {!supabaseConfigured && (
          <p className="mt-3 text-xs text-brown-light">Demo mode: Supabase is not configured, so this was saved locally only.</p>
        )}
      </section>
    )
  }

  return (
    <section id="rsvp" className="bg-cream/60 px-5 py-16">
      <div className="mx-auto max-w-xl">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">RSVP</h2>
        <p className="mt-2 text-center text-sm text-brown-light">Please let us know if you can join us.</p>
        {!supabaseConfigured && (
          <p className="mt-4 rounded-lg border border-gold/50 bg-white/80 p-3 text-center text-xs text-brown-light">
            Demo mode — connect Supabase (see README) to save RSVPs to the shared database.
          </p>
        )}
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-gold/40 bg-white/90 p-6 shadow-sm">
          <label className="block text-left">
            <span className="text-sm font-medium">Guest name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" placeholder="Your full name" />
          </label>
          <label className="block text-left">
            <span className="text-sm font-medium">Phone number *</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" placeholder="+91 98765 43210" />
          </label>
          <label className="block text-left">
            <span className="text-sm font-medium">Number of guests (1–10) *</span>
            <input type="number" value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} required min={1} max={10} className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Will you be attending? *</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(['attending', 'not_attending'] as const).map((v) => (
                <label key={v} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm ${status === v ? 'border-gold bg-cream font-medium' : 'border-gold/40'}`}>
                  <input type="radio" name="attendance" value={v} checked={status === v} onChange={() => setStatus(v)} className="sr-only" />
                  {v === 'attending' ? 'Attending' : 'Not attending'}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-left">
            <span className="text-sm font-medium">Personal message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" placeholder="A few kind words…" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm text-brown">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-brown px-8 py-3.5 text-sm font-medium tracking-[0.2em] text-ivory shadow-lg transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:opacity-70">
            {loading ? 'SAVING…' : 'CONFIRM MY PRESENCE'}
          </button>
          <p className="text-center text-xs text-brown-light">
            Submitting again with the same phone number updates your existing response instead of creating a duplicate.
          </p>
        </form>
      </div>
    </section>
  )
}
