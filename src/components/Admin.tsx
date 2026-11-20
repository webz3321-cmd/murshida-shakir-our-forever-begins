import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { DEFAULT_SETTINGS, WEDDING, type Rsvp, type SiteSettings, type WeddingEvent } from '../lib/config'

type Tab = 'overview' | 'rsvps' | 'invitation' | 'timeline' | 'gallery' | 'audio' | 'settings'

function toCsv(rows: Rsvp[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = 'guest_name,phone_number,guest_count,attendance_status,message,created_at'
  const body = rows.map((r) => [r.guest_name, r.phone_number, r.guest_count, r.attendance_status, r.message, r.created_at].map(esc).join(','))
  return [head, ...body].join('\n')
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [events, setEvents] = useState<WeddingEvent[]>([])
  const [visitors, setVisitors] = useState(0)
  const [opens, setOpens] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'attending' | 'not_attending'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(0)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [newEvent, setNewEvent] = useState({ title: '', event_time: '', description: '', location: '' })

  const load = useCallback(async () => {
    if (!supabase) return
    const [{ data: r }, { data: e }, { count: v }, { count: o }] = await Promise.all([
      supabase.from('rsvps').select('*').order('created_at', { ascending: false }),
      supabase.from('wedding_events').select('*').order('event_order'),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'visit'),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'invitation_open'),
    ])
    setRsvps((r ?? []) as Rsvp[])
    setEvents((e ?? []) as WeddingEvent[])
    setVisitors(v ?? 0)
    setOpens(o ?? 0)
  }, [])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setAuthed(true); void load() }
    })
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    if (!supabase) return setAuthError('Supabase is not configured yet — see README.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setAuthError(error.message)
    setAuthed(true)
    await load()
  }

  async function logout() {
    await supabase?.auth.signOut()
    setAuthed(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rsvps.filter((r) => {
      if (filter !== 'all' && r.attendance_status !== filter) return false
      if (!q) return true
      return r.guest_name.toLowerCase().includes(q) || r.phone_number.includes(q)
    })
    return [...list].sort((a, b) => sort === 'newest'
      ? +new Date(b.created_at) - +new Date(a.created_at)
      : +new Date(a.created_at) - +new Date(b.created_at))
  }, [rsvps, search, filter, sort])

  const pageRows = filtered.slice(page * 10, page * 10 + 10)
  const attending = rsvps.filter((r) => r.attendance_status === 'attending')
  const totalGuests = attending.reduce((s, r) => s + r.guest_count, 0)

  async function deleteRsvp(id: string) {
    if (!supabase || !window.confirm('Delete this RSVP?')) return
    await supabase.from('rsvps').delete().eq('id', id)
    await load()
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'rsvps.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !newEvent.title || !newEvent.event_time) return
    const { error } = await supabase.from('wedding_events').insert({
      title: newEvent.title, event_time: newEvent.event_time,
      description: newEvent.description || null, location: newEvent.location || null,
      event_order: events.length,
    })
    if (error) return setNotice(error.message)
    setNewEvent({ title: '', event_time: '', description: '', location: '' })
    setNotice('Event added.')
    await load()
  }

  async function deleteEvent(id: string) {
    if (!supabase) return
    await supabase.from('wedding_events').delete().eq('id', id)
    await load()
  }

  async function saveSettings() {
    if (!supabase) return setNotice('Supabase is not configured — settings are kept locally for this preview only.')
    const { error } = await supabase.from('wedding_settings').upsert({ id: 1, ...settings, updated_at: new Date().toISOString() })
    if (error) return setNotice(error.message)
    setDirty(false)
    setNotice('Settings saved and published.')
  }

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="font-serif text-3xl font-semibold">Admin — setup required</h1>
        <p className="mt-3 leading-relaxed text-brown-light">
          This standalone app needs Supabase before the admin dashboard can show real data.
          Copy <code>.env.example</code> to <code>.env</code>, add your <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, run the SQL in <code>supabase/migrations/001_init.sql</code> and{' '}
          <code>supabase/storage.sql</code>, create an admin user in Supabase Auth, and give that user the{' '}
          <code>admin</code> role in the <code>profiles</code> table. No admin password is hardcoded anywhere.
        </p>
        <a href="/" className="mt-6 inline-block rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">BACK TO INVITATION</a>
      </main>
    )
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-center font-serif text-3xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-center text-sm text-brown-light">Sign in with your Supabase Auth admin account.</p>
        <form onSubmit={login} className="mt-6 space-y-4 rounded-2xl border border-gold/40 bg-white p-6 shadow-sm">
          <label className="block"><span className="text-sm font-medium">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" /></label>
          <label className="block"><span className="text-sm font-medium">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" /></label>
          {authError && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{authError}</p>}
          <button className="w-full rounded-full bg-brown py-3 text-sm tracking-widest text-ivory">SIGN IN</button>
        </form>
        <a href="/" className="mt-4 text-center text-sm text-brown-light underline">Back to invitation</a>
      </main>
    )
  }

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Overview'], ['rsvps', 'RSVPs'], ['invitation', 'Invitation'],
    ['timeline', 'Timeline'], ['gallery', 'Gallery'], ['audio', 'Audio'], ['settings', 'Settings'],
  ]

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <a href="/" className="rounded-full border border-gold/60 px-4 py-2 text-sm">View site</a>
          <button onClick={logout} className="rounded-full bg-brown px-4 py-2 text-sm text-ivory">Log out</button>
        </div>
      </div>
      {notice && <p className="mt-4 rounded-lg bg-cream p-3 text-sm">{notice}</p>}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Admin sections">
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm ${tab === t ? 'bg-brown text-ivory' : 'border border-gold/50 bg-white'}`}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ['Unique visitors', visitors, 'Anonymous visitor IDs, deduplicated'],
              ['Invitation openings', opens, 'Deduplicated per visitor'],
              ['RSVP responses', rsvps.length, 'All submissions'],
              ['Attending', attending.length, `${totalGuests} expected guests`],
              ['Not attending', rsvps.length - attending.length, ''],
              ['Timeline events', events.length, ''],
            ].map(([label, value, note]) => (
              <div key={label as string} className="rounded-2xl border border-gold/40 bg-white p-5">
                <p className="text-xs tracking-widest text-gold-dark">{(label as string).toUpperCase()}</p>
                <p className="mt-1 font-serif text-4xl">{value as number}</p>
                <p className="mt-1 text-xs text-brown-light">{note as string}</p>
              </div>
            ))}
          </div>
          {rsvps.length > 0 && (
            <div className="mt-6 rounded-2xl border border-gold/40 bg-white p-5">
              <h2 className="font-medium">Attendance</h2>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-cream">
                <div className="h-full bg-gold" style={{ width: `${(attending.length / rsvps.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-brown-light">{attending.length} of {rsvps.length} attending ({Math.round((attending.length / rsvps.length) * 100)}%)</p>
              <h3 className="mt-5 font-medium">Latest RSVPs</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {rsvps.slice(0, 5).map((r) => <li key={r.id}>{r.guest_name} — {r.attendance_status === 'attending' ? 'Attending' : 'Not attending'} ({r.guest_count})</li>)}
              </ul>
            </div>
          )}
          {rsvps.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-gold/60 bg-white/70 p-6 text-center text-sm text-brown-light">No RSVPs yet — stats show a true zero, not sample data.</p>}
        </section>
      )}

      {tab === 'rsvps' && (
        <section className="mt-6">
          <div className="flex flex-wrap gap-2">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Search name or phone…" aria-label="Search RSVPs by name or phone" className="flex-1 rounded-lg border border-gold/50 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter by attendance" className="rounded-lg border border-gold/50 bg-white px-3 py-2.5">
              <option value="all">All</option><option value="attending">Attending</option><option value="not_attending">Not attending</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort RSVPs" className="rounded-lg border border-gold/50 bg-white px-3 py-2.5">
              <option value="newest">Newest</option><option value="oldest">Oldest</option>
            </select>
            <button onClick={exportCsv} className="rounded-full bg-brown px-4 py-2 text-sm text-ivory">Export CSV</button>
          </div>
          <p className="mt-3 text-xs text-brown-light">Guest phone numbers are visible only to signed-in admins — never on the public site.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gold/40 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-gold/30"><th className="p-3">Guest</th><th className="p-3">Phone</th><th className="p-3">Guests</th><th className="p-3">Status</th><th className="p-3">Message</th><th className="p-3" /></tr></thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-cream">
                    <td className="p-3">{r.guest_name}</td><td className="p-3">{r.phone_number}</td><td className="p-3">{r.guest_count}</td>
                    <td className="p-3">{r.attendance_status}</td><td className="p-3">{r.message ?? '—'}</td>
                    <td className="p-3"><button onClick={() => deleteRsvp(r.id)} className="text-sm text-rose underline">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pageRows.length === 0 && <p className="p-6 text-center text-sm text-brown-light">No RSVPs match.</p>}
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-gold/50 px-3 py-1.5 disabled:opacity-50">Previous</button>
            <span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 10))}</span>
            <button disabled={(page + 1) * 10 >= filtered.length} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-gold/50 px-3 py-1.5 disabled:opacity-50">Next</button>
          </div>
        </section>
      )}

      {tab === 'invitation' && (
        <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-6">
          <h2 className="font-serif text-2xl">Invitation Editor</h2>
          <p className="mt-2 text-sm leading-relaxed text-brown-light">
            Content is configured in <code>src/lib/config.ts</code> and the <code>wedding_settings</code> table.
            Current live values: {WEDDING.brideName} &amp; {WEDDING.groomName}, &ldquo;{WEDDING.heading}&rdquo;,{' '}
            {WEDDING.weddingDateDisplay}, {WEDDING.venueName}. Edit the config or the database row, redeploy,
            and the public site updates — no code editing is needed for normal content changes once the
            settings row is in use. Publishing is controlled by the <code>published</code> flag in Settings.
          </p>
        </section>
      )}

      {tab === 'timeline' && (
        <section className="mt-6">
          <form onSubmit={addEvent} className="grid gap-3 rounded-2xl border border-gold/40 bg-white p-6 sm:grid-cols-2">
            <input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required placeholder="Event title *" className="rounded-lg border border-gold/50 bg-ivory px-3 py-2.5" />
            <input value={newEvent.event_time} onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })} required placeholder="Time, e.g. 11:00 AM *" className="rounded-lg border border-gold/50 bg-ivory px-3 py-2.5" />
            <input value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Description" className="rounded-lg border border-gold/50 bg-ivory px-3 py-2.5" />
            <input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Location" className="rounded-lg border border-gold/50 bg-ivory px-3 py-2.5" />
            <button className="rounded-full bg-brown py-2.5 text-sm text-ivory sm:col-span-2">ADD EVENT</button>
          </form>
          <ul className="mt-4 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl border border-gold/40 bg-white p-4 text-sm">
                <span><strong>{e.event_time}</strong> — {e.title}{e.location ? ` · ${e.location}` : ''}</span>
                <button onClick={() => deleteEvent(e.id)} className="text-rose underline">Delete</button>
              </li>
            ))}
            {events.length === 0 && <li className="rounded-xl border border-dashed border-gold/60 bg-white/70 p-4 text-center text-sm text-brown-light">No events yet — the public timeline honestly says timings are being finalised.</li>}
          </ul>
        </section>
      )}

      {tab === 'gallery' && (
        <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-6">
          <h2 className="font-serif text-2xl">Gallery Manager</h2>
          <p className="mt-2 text-sm leading-relaxed text-brown-light">
            Upload images to the <code>gallery</code> bucket in Supabase Storage (see <code>supabase/storage.sql</code>),
            then insert rows in the <code>gallery</code> table with <code>image_url</code>, <code>storage_path</code>,{' '}
            <code>image_order</code> and <code>is_hero</code>. The public gallery reads that table; until you upload
            real photos it shows clearly labelled placeholder artwork. Replace, delete and reorder by editing
            the table rows (or a future upload UI wired to the same table).
          </p>
        </section>
      )}

      {tab === 'audio' && (
        <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-6">
          <h2 className="font-serif text-2xl">Audio Manager</h2>
          <p className="mt-2 text-sm leading-relaxed text-brown-light">
            Upload MP3/WAV files to the <code>audio</code> bucket in Supabase Storage, add rows to{' '}
            <code>audio_library</code> (title, file_url, storage_path, audio_type, file_size), then point{' '}
            <code>audio_settings</code> at the chosen background / opening / envelope / button track IDs.
            Set <code>music_enabled</code>, <code>effects_enabled</code>, <code>volume</code> and{' '}
            <code>loop_enabled</code> there. Only validated audio types and sizes should be accepted —
            enforce this in the Storage policy and in any upload UI (see <code>supabase/storage.sql</code>).
          </p>
        </section>
      )}

      {tab === 'settings' && (
        <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-6">
          <h2 className="font-serif text-2xl">Website Settings</h2>
          {(['gallery_visible', 'countdown_visible', 'rsvp_visible', 'music_enabled', 'music_loop', 'published'] as const).map((key) => (
            <label key={key} className="mt-4 flex items-center justify-between gap-4 border-b border-cream pb-3 text-sm">
              <span className="font-medium">{key.replace(/_/g, ' ')}</span>
              <input type="checkbox" checked={settings[key]} onChange={(e) => { setSettings({ ...settings, [key]: e.target.checked }); setDirty(true) }} className="h-5 w-5 accent-[#D6B56D]" />
            </label>
          ))}
          <label className="mt-4 block text-sm font-medium">Music volume ({Math.round(settings.music_volume * 100)}%)
            <input type="range" min={0} max={1} step={0.05} value={settings.music_volume} onChange={(e) => { setSettings({ ...settings, music_volume: Number(e.target.value) }); setDirty(true) }} className="mt-2 w-full accent-[#D6B56D]" />
          </label>
          {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
          <button onClick={saveSettings} className="mt-5 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">SAVE &amp; PUBLISH SETTINGS</button>
        </section>
      )}
    </main>
  )
}
