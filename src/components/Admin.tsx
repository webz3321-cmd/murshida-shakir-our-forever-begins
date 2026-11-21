import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  adminPasscodeInfo,
  adminRpc,
  adminSessionValid,
  changeAdminPasscode,
  clearAdminToken,
  getAdminToken,
  revokeAdminSession,
  verifyAdminPasscode,
  supabase,
  supabaseConfigured,
  testSupabaseConnection,
  type ConnectionStatus,
} from '../lib/supabase'
import {
  AUDIO_MAX_BYTES, AUDIO_TYPES, DEFAULT_SETTINGS, DEFAULT_THEME, POSTER_MAX_BYTES,
  VIDEO_MAX_BYTES, VIDEO_TYPES, WEDDING,
  type AudioTrack, type Rsvp, type SiteSettings, type ThemeSettings,
  type WeddingEvent, type WeddingVideo,
} from '../lib/config'

type Tab =
  | 'overview' | 'invitation' | 'details' | 'music' | 'videos' | 'rsvps'
  | 'timeline' | 'countdown' | 'theme' | 'settings' | 'security'

interface AnalyticsRow { visitor_id: string; event_type: string; created_at: string }

function toCsv(rows: Rsvp[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = 'guest_name,phone_number,guest_count,attendance_status,message,created_at'
  const body = rows.map((r) => [r.guest_name, r.phone_number, r.guest_count, r.attendance_status, r.message, r.created_at].map(esc).join(','))
  return [head, ...body].join('\n')
}

const fmtBytes = (n: number | null) =>
  n === null ? '—' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview')
  // Passcode-only admin: no email, no Supabase Auth sign-in anywhere.
  // Authorisation is the session token issued by verify_admin_passcode()
  // (migration 004), kept in sessionStorage only — never the passcode.
  const [passcode, setPasscode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authChecking, setAuthChecking] = useState(true)
  const [lastPassChange, setLastPassChange] = useState('')

  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [events, setEvents] = useState<WeddingEvent[]>([])
  const [videos, setVideos] = useState<WeddingVideo[]>([])
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([])
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [audioSettings, setAudioSettings] = useState({
    background_music_id: '', opening_sound_id: '', envelope_sound_id: '', button_sound_id: '',
    music_enabled: true, effects_enabled: true, volume: 0.6, loop_enabled: true,
  })
  const [invitation, setInvitation] = useState({
    bride_name: WEDDING.brideName, groom_name: WEDDING.groomName,
    invitation_heading: WEDDING.heading, invitation_message: WEDDING.invitationMessage,
    venue_name: WEDDING.venueName, venue_address: '', button_text: 'OPEN INVITATION',
    hero_message: WEDDING.heroMessage,
  })
  const [details, setDetails] = useState({
    wedding_date: '2026-12-27', venue_name: WEDDING.venueName, venue_address: '', maps_url: '',
  })
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'attending' | 'not_attending'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(0)
  const [newEvent, setNewEvent] = useState({ title: '', event_time: '', description: '', location: '' })

  // Video manager state
  const [newVideo, setNewVideo] = useState({ title: '', description: '' })
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [editingVideo, setEditingVideo] = useState<WeddingVideo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const posterInput = useRef<HTMLInputElement>(null)
  const [posterTarget, setPosterTarget] = useState<string | null>(null)

  // Music manager state
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioType, setAudioType] = useState<AudioTrack['audio_type']>('background')
  const [audioTitle, setAudioTitle] = useState('')
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioError, setAudioError] = useState('')

  // Security state
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [secError, setSecError] = useState('')
  const [secNotice, setSecNotice] = useState('')

  // Real Supabase connection status — measured by testSupabaseConnection(),
  // never assumed. 'not-configured' when no env vars are set.
  const [connStatus, setConnStatus] = useState<ConnectionStatus>({ state: 'not-configured' })
  const retestConnection = useCallback(() => {
    if (!supabaseConfigured) { setConnStatus({ state: 'not-configured' }); return }
    void testSupabaseConnection().then(setConnStatus)
  }, [])
  useEffect(() => { retestConnection() }, [retestConnection])

  const load = useCallback(async () => {
    if (!supabase || !getAdminToken()) return
    // Privileged reads go through token-checked RPCs (migration 004):
    // rsvps and analytics have no public SELECT policy, and the public
    // videos policy only exposes published videos — the panel needs all
    // of them. Settings, events and the audio library are public-read,
    // so those still use direct reads.
    const [rsvpsRes, eventsRes, videosRes, tracksRes, audioRes, settingsRes, analyticsRes] = await Promise.all([
      adminRpc<Rsvp[]>('admin_list_rsvps', {}),
      supabase.from('wedding_events').select('*').order('event_order'),
      adminRpc<WeddingVideo[]>('admin_list_videos', {}),
      supabase.from('audio_library').select('*').order('created_at', { ascending: false }),
      supabase.from('audio_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
      adminRpc<AnalyticsRow[]>('admin_list_analytics', {}),
    ])
    const r = rsvpsRes.data
    const e = eventsRes.data
    const v = videosRes.data
    const t = tracksRes.data
    const as = audioRes.data
    const s = settingsRes.data
    const an = analyticsRes.data
    if (rsvpsRes.error) setNotice(`Could not load RSVPs: ${rsvpsRes.error}`)
    if (analyticsRes.error) setNotice(`Could not load analytics: ${analyticsRes.error}`)
    setRsvps((r ?? []) as Rsvp[])
    setEvents((e ?? []) as WeddingEvent[])
    setVideos((v ?? []) as WeddingVideo[])
    setTracks((t ?? []) as AudioTrack[])
    setAnalytics((an ?? []) as AnalyticsRow[])
    if (as) {
      setAudioSettings({
        background_music_id: as.background_music_id ?? '', opening_sound_id: as.opening_sound_id ?? '',
        envelope_sound_id: as.envelope_sound_id ?? '', button_sound_id: as.button_sound_id ?? '',
        music_enabled: as.music_enabled ?? true, effects_enabled: as.effects_enabled ?? true,
        volume: typeof as.volume === 'number' ? as.volume : 0.6, loop_enabled: as.loop_enabled ?? true,
      })
    }
    if (s) {
      const th = (s.theme as ThemeSettings | null) ?? DEFAULT_THEME
      setTheme({ ...DEFAULT_THEME, ...th })
      setSettings({
        published: s.published ?? true,
        videos_visible: s.videos_visible ?? s.gallery_visible ?? true,
        countdown_visible: s.countdown_visible ?? true,
        rsvp_visible: s.rsvp_visible ?? true,
        music_enabled: s.music_enabled ?? true,
        music_loop: s.loop_enabled ?? true,
        music_volume: typeof s.music_volume === 'number' ? s.music_volume : 0.6,
        animations_enabled: s.animations_enabled ?? th.animationsEnabled ?? true,
        theme: { ...DEFAULT_THEME, ...th },
      })
      setInvitation({
        bride_name: s.bride_name ?? WEDDING.brideName, groom_name: s.groom_name ?? WEDDING.groomName,
        invitation_heading: s.invitation_heading ?? WEDDING.heading,
        invitation_message: s.invitation_message ?? WEDDING.invitationMessage,
        venue_name: s.venue_name ?? WEDDING.venueName, venue_address: s.venue_address ?? '',
        button_text: s.button_text ?? 'OPEN INVITATION', hero_message: WEDDING.heroMessage,
      })
      setDetails({
        wedding_date: s.wedding_date ? String(s.wedding_date).slice(0, 10) : '2026-12-27',
        venue_name: s.venue_name ?? WEDDING.venueName, venue_address: s.venue_address ?? '',
        maps_url: s.maps_url ?? '',
      })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    // Passcode session only: validate the token stored by the admin dot.
    // No Supabase Auth session is used anywhere in this panel.
    void (async () => {
      const valid = await adminSessionValid()
      setAuthChecking(false)
      if (valid) {
        setAuthed(true)
        const info = await adminPasscodeInfo()
        if (info?.passcode_changed_at) setLastPassChange(info.passcode_changed_at)
        await load()
      }
    })()
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    if (!supabase) return setAuthError('Supabase is not configured yet — see README.')
    if (passcode.length < 4) return setAuthError('The passcode must be at least 4 characters.')
    const token = await verifyAdminPasscode(passcode)
    if (!token) return setAuthError('That passcode is not correct. Please try again.')
    setPasscode('')
    setAuthed(true)
    const info = await adminPasscodeInfo()
    if (info?.passcode_changed_at) setLastPassChange(info.passcode_changed_at)
    await load()
  }

  async function logout() {
    await revokeAdminSession()
    clearAdminToken()
    setAuthed(false)
  }

  // ---- derived stats (real data only, never invented) ----
  const visits = analytics.filter((a) => a.event_type === 'visit')
  const uniqueVisitors = new Set(visits.map((a) => a.visitor_id)).size
  const opens = analytics.filter((a) => a.event_type === 'invitation_open').length
  const attending = rsvps.filter((r) => r.attendance_status === 'attending')
  const totalGuests = attending.reduce((s, r) => s + r.guest_count, 0)
  const publishedVideos = videos.filter((v) => v.is_published).length

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

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'rsvps.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function deleteRsvp(id: string) {
    if (!supabase || !window.confirm('Delete this RSVP?')) return
    const { data, error } = await adminRpc<boolean>('admin_delete_rsvp', { p_id: id })
    if (error || data !== true) return setNotice(error ?? 'Could not delete this RSVP — your admin session may have expired. Unlock the panel again.')
    await load()
  }

  async function saveWeddingSettings(patch: Record<string, unknown>) {
    if (!supabase) return setNotice('Supabase is not configured — settings are kept locally for this preview only.')
    const { data, error } = await adminRpc<boolean>('admin_upsert_wedding_settings', { p_patch: patch })
    if (error || data !== true) return setNotice(`Could not save: ${error ?? 'admin session expired'} — have you run migrations 001, 002, 003 and 004? See SUPABASE_SETUP.md.`)
    setDirty(false)
    setNotice('Saved and published.')
    await load()
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !newEvent.title || !newEvent.event_time) return
    const { data, error } = await adminRpc<string | null>('admin_insert_event', {
      p_title: newEvent.title, p_event_time: newEvent.event_time,
      p_description: newEvent.description || null, p_location: newEvent.location || null,
      p_event_order: events.length,
    })
    if (error || !data) return setNotice(error ?? 'Could not add the event — your admin session may have expired.')
    setNewEvent({ title: '', event_time: '', description: '', location: '' })
    setNotice('Event added.')
    await load()
  }

  async function deleteEvent(id: string) {
    if (!supabase) return
    const { data, error } = await adminRpc<boolean>('admin_delete_event', { p_id: id })
    if (error || data !== true) return setNotice(error ?? 'Could not delete the event.')
    await load()
  }

  // ---- Video Manager ----
  async function uploadVideo(e: React.FormEvent) {
    e.preventDefault()
    setVideoError('')
    if (!supabase) return setVideoError('Supabase is not configured.')
    if (!videoFile) return setVideoError('Choose an MP4 or WebM video first.')
    if (!(VIDEO_TYPES as readonly string[]).includes(videoFile.type)) {
      return setVideoError(`Unsupported format (${videoFile.type || 'unknown'}). Only MP4 and WebM are accepted.`)
    }
    if (videoFile.size > VIDEO_MAX_BYTES) {
      return setVideoError(
        `This video is ${fmtBytes(videoFile.size)} — over the 25 MB upload limit. ` +
        'Compress it first (for example, export at 720p with a free tool such as HandBrake or an online compressor), then upload the smaller file.',
      )
    }
    if (!newVideo.title.trim()) return setVideoError('Give the video a title first.')
    setVideoBusy(true)
    const path = `videos/${Date.now()}-${videoFile.name.replace(/\s+/g, '-')}`
    // Storage note (honest limitation, see README / SUPABASE_SETUP.md):
    // bucket policies still check Supabase Auth, so a passcode-only
    // session cannot upload a file directly. If this upload is rejected,
    // the error below says so plainly instead of failing silently.
    const { error: upErr } = await supabase.storage.from('wedding-videos').upload(path, videoFile, { contentType: videoFile.type })
    if (upErr) { setVideoBusy(false); return setVideoError(`Storage upload was blocked: ${upErr.message} — video/audio file uploads still need a Supabase Auth session (see SUPABASE_SETUP.md, "Storage uploads"). The video details were not saved.`) }
    const { data: pub } = supabase.storage.from('wedding-videos').getPublicUrl(path)
    const { data, error } = await adminRpc<string | null>('admin_insert_video', {
      p_title: newVideo.title.trim(), p_description: newVideo.description.trim() || null,
      p_video_url: pub.publicUrl, p_storage_path: path, p_is_featured: videos.length === 0,
      p_is_published: false, p_video_order: videos.length, p_file_size: videoFile.size,
    })
    setVideoBusy(false)
    if (error || !data) return setVideoError(error ?? 'Could not save the video details — your admin session may have expired.')
    setNewVideo({ title: '', description: '' })
    setVideoFile(null)
    setNotice('Video uploaded. Publish it below to show it on the public site.')
    await load()
  }

  async function updateVideo(id: string, patch: Partial<WeddingVideo>) {
    if (!supabase) return
    const { data, error } = await adminRpc<boolean>('admin_update_video', { p_id: id, p_patch: patch })
    if (error || data !== true) return setNotice(error ?? 'Could not save the video — your admin session may have expired.')
    await load()
  }

  async function setFeatured(id: string) {
    if (!supabase) return
    const others = videos.filter((v) => v.id !== id && v.is_featured)
    for (const o of others) {
      await adminRpc<boolean>('admin_update_video', { p_id: o.id, p_patch: { is_featured: false } })
    }
    await updateVideo(id, { is_featured: true })
    setNotice('Featured video updated.')
  }

  async function moveVideo(v: WeddingVideo, dir: -1 | 1) {
    const sorted = [...videos].sort((a, b) => a.video_order - b.video_order)
    const i = sorted.findIndex((x) => x.id === v.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length || !supabase) return
    const other = sorted[j]
    await adminRpc<boolean>('admin_update_video', { p_id: v.id, p_patch: { video_order: other.video_order } })
    await adminRpc<boolean>('admin_update_video', { p_id: other.id, p_patch: { video_order: v.video_order } })
    await load()
  }

  async function replaceVideoFile(v: WeddingVideo, file: File) {
    if (!supabase) return
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) return setVideoError('Only MP4 and WebM are accepted.')
    if (file.size > VIDEO_MAX_BYTES) return setVideoError('That file is over 25 MB — compress it to 720p first, then try again.')
    setVideoBusy(true)
    const path = `videos/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: upErr } = await supabase.storage.from('wedding-videos').upload(path, file, { contentType: file.type })
    if (upErr) { setVideoBusy(false); return setVideoError(`Storage upload was blocked: ${upErr.message} — video/audio file uploads still need a Supabase Auth session (see SUPABASE_SETUP.md, "Storage uploads").`) }
    const { data: pub } = supabase.storage.from('wedding-videos').getPublicUrl(path)
    const oldPath = v.storage_path
    await adminRpc<boolean>('admin_update_video', { p_id: v.id, p_patch: { video_url: pub.publicUrl, storage_path: path, file_size: file.size } })
    if (oldPath) await supabase.storage.from('wedding-videos').remove([oldPath])
    setVideoBusy(false)
    setNotice('Video file replaced.')
    await load()
  }

  async function uploadPoster(v: WeddingVideo, file: File) {
    if (!supabase) return
    if (!file.type.startsWith('image/')) return setVideoError('Poster must be an image (JPG, PNG or WebP).')
    if (file.size > POSTER_MAX_BYTES) return setVideoError('Poster must be under 5 MB.')
    const path = `posters/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: upErr } = await supabase.storage.from('wedding-images').upload(path, file, { contentType: file.type })
    if (upErr) return setVideoError(`Storage upload was blocked: ${upErr.message} — image uploads still need a Supabase Auth session (see SUPABASE_SETUP.md, "Storage uploads").`)
    const { data: pub } = supabase.storage.from('wedding-images').getPublicUrl(path)
    const oldPoster = v.poster_path
    await adminRpc<boolean>('admin_update_video', { p_id: v.id, p_patch: { poster_url: pub.publicUrl, poster_path: path } })
    if (oldPoster) await supabase.storage.from('wedding-images').remove([oldPoster])
    setNotice('Poster updated.')
    await load()
  }

  async function deleteVideo(v: WeddingVideo) {
    if (!supabase || !window.confirm(`Delete "${v.title}"?`)) return
    if (v.storage_path) await supabase.storage.from('wedding-videos').remove([v.storage_path])
    if (v.poster_path) await supabase.storage.from('wedding-images').remove([v.poster_path])
    const { data, error } = await adminRpc<boolean>('admin_delete_video', { p_id: v.id })
    if (error || data !== true) return setNotice(error ?? 'Could not delete the video.')
    await load()
  }

  // ---- Music Manager ----
  async function uploadAudio(e: React.FormEvent) {
    e.preventDefault()
    setAudioError('')
    if (!supabase) return setAudioError('Supabase is not configured.')
    if (!audioFile) return setAudioError('Choose an MP3 or WAV file first.')
    if (!(AUDIO_TYPES as readonly string[]).includes(audioFile.type)) {
      return setAudioError(`Unsupported format (${audioFile.type || 'unknown'}). Only MP3 and WAV are accepted.`)
    }
    if (audioFile.size > AUDIO_MAX_BYTES) return setAudioError('Audio must be under 15 MB.')
    setAudioBusy(true)
    const path = `audio/${Date.now()}-${audioFile.name.replace(/\s+/g, '-')}`
    const { error: upErr } = await supabase.storage.from('wedding-audio').upload(path, audioFile, { contentType: audioFile.type })
    if (upErr) { setAudioBusy(false); return setAudioError(`Storage upload was blocked: ${upErr.message} — audio file uploads still need a Supabase Auth session (see SUPABASE_SETUP.md, "Storage uploads").`) }
    const { data: pub } = supabase.storage.from('wedding-audio').getPublicUrl(path)
    const { data, error } = await adminRpc<string | null>('admin_insert_audio', {
      p_title: audioTitle.trim() || audioFile.name, p_file_url: pub.publicUrl,
      p_storage_path: path, p_audio_type: audioType, p_file_size: audioFile.size,
    })
    setAudioBusy(false)
    if (error || !data) return setAudioError(error ?? 'Could not save the audio details — your admin session may have expired.')
    setAudioFile(null); setAudioTitle('')
    setNotice('Audio uploaded.')
    await load()
  }

  async function saveAudioSettings() {
    if (!supabase) return setNotice('Supabase is not configured.')
    const toUuid = (s: string) => (s ? s : null)
    const { data, error } = await adminRpc<boolean>('admin_upsert_audio_settings', {
      p_patch: {
        background_music_id: toUuid(audioSettings.background_music_id),
        opening_sound_id: toUuid(audioSettings.opening_sound_id),
        envelope_sound_id: toUuid(audioSettings.envelope_sound_id),
        button_sound_id: toUuid(audioSettings.button_sound_id),
        music_enabled: audioSettings.music_enabled, effects_enabled: audioSettings.effects_enabled,
        volume: audioSettings.volume, loop_enabled: audioSettings.loop_enabled,
      },
    })
    if (error || data !== true) return setNotice(error ?? 'Could not save audio settings — your admin session may have expired.')
    setNotice('Audio settings published.')
    await load()
  }

  async function deleteTrack(t: AudioTrack) {
    if (!supabase || !window.confirm(`Delete "${t.title}"?`)) return
    if (t.storage_path) await supabase.storage.from('wedding-audio').remove([t.storage_path])
    const { data, error } = await adminRpc<boolean>('admin_delete_audio', { p_id: t.id })
    if (error || data !== true) return setNotice(error ?? 'Could not delete the audio track.')
    await load()
  }

  // ---- Security: change passcode (current verified server-side first) ----
  // The passcode is stored only as a bcrypt hash (migration 004). The
  // change is verified and applied by set_admin_passcode() on the
  // server; changing it revokes every existing admin session.
  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setSecError(''); setSecNotice('')
    if (newPass.length < 4) return setSecError('The new passcode must be at least 4 characters.')
    if (newPass !== confirmPass) return setSecError('The new passcode and its confirmation do not match.')
    if (!supabase) return setSecError('Supabase is not configured.')
    const ok = await changeAdminPasscode(currentPass, newPass)
    if (!ok) return setSecError('The current passcode is not correct, or the change was locked out after too many wrong attempts.')
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
    setSecNotice('Passcode changed. All other admin sessions were signed out — please sign in again with the new passcode.')
    const info = await adminPasscodeInfo()
    if (info?.passcode_changed_at) setLastPassChange(info.passcode_changed_at)
  }

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="font-serif text-3xl font-semibold">Admin — setup required</h1>
        <p className="mt-3 leading-relaxed text-brown-light">
          This standalone app needs a real Supabase project before the admin dashboard can show real data.
          The site is not broken — Supabase simply is not configured in this deployment yet. Follow{' '}
          <code>SUPABASE_SETUP.md</code> at the repo root, in order:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 leading-relaxed text-brown-light">
          <li>Create a free project at supabase.com.</li>
          <li>In the Supabase SQL editor, run <code>supabase/migrations/001_init.sql</code>, then <code>002_videos.sql</code>, then <code>003_complete.sql</code>, then <code>004_admin_passcode.sql</code>, then <code>supabase/storage.sql</code>.</li>
          <li>Copy <code>.env.example</code> to <code>.env</code> and add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Supabase Dashboard → Project Settings → API). In Vercel, add the same two variables under Settings → Environment Variables and redeploy.</li>
          <li>Come back here and tap the gold admin dot on the public site. The first time it opens, set your own admin passcode (at least 4 characters) — no admin passcode is hardcoded anywhere in this repo, and no email or Supabase Auth account is needed.</li>
        </ol>
        <a href="/" className="mt-6 inline-block rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">BACK TO INVITATION</a>
      </main>
    )
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-center font-serif text-3xl font-semibold">Admin Access</h1>
        <p className="mt-2 text-center text-sm text-brown-light">
          Enter your administrator passcode to continue. (The public site&rsquo;s gold admin dot opens this same passcode lock. No email, no Supabase Auth account.)
        </p>
        {authChecking ? (
          <p className="mt-6 text-center text-sm text-brown-light">Checking your admin session…</p>
        ) : (
          <form onSubmit={login} className="mt-6 space-y-4 rounded-2xl border border-gold/40 bg-white p-6 shadow-sm">
            <label className="block"><span className="text-sm font-medium">Passcode</span>
              <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoComplete="current-password" placeholder="••••" className="mt-1 w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold" /></label>
            {authError && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{authError}</p>}
            <button className="w-full rounded-full bg-brown py-3 text-sm tracking-widest text-ivory">UNLOCK ADMIN PANEL</button>
            <p className="text-center text-xs leading-relaxed text-brown-light">
              First time here? If no passcode has been set yet, use the gold admin dot on the public site to set one. If you forgot the passcode, see the recovery steps in Admin → Security &amp; Passcode (or SUPABASE_SETUP.md) — there is no public reset.
            </p>
          </form>
        )}
        <a href="/" className="mt-4 text-center text-sm text-brown-light underline">Back to invitation</a>
      </main>
    )
  }

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Dashboard'], ['invitation', 'Invitation Editor'], ['details', 'Wedding Details'],
    ['music', 'Music Manager'], ['videos', 'Video Manager'], ['rsvps', 'RSVP Manager'],
    ['timeline', 'Timeline'], ['countdown', 'Countdown Settings'], ['theme', 'Theme & Design'],
    ['settings', 'Website Settings'], ['security', 'Security & Passcode'],
  ]

  const inputCls = 'w-full rounded-lg border border-gold/50 bg-ivory px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold'

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-brown-light">Signed in with your admin passcode · Murshida &amp; Shakir</p>
        </div>
        <div className="flex gap-2">
          <a href="/" className="rounded-full border border-gold/60 px-4 py-2 text-sm">View site</a>
          <button onClick={logout} className="rounded-full bg-brown px-4 py-2 text-sm text-ivory">Log out</button>
        </div>
      </div>
      {notice && <p className="mt-4 rounded-lg bg-cream p-3 text-sm">{notice}</p>}

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <nav className="w-full shrink-0 md:w-56" aria-label="Admin sections">
          <div className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
            {tabs.map(([t, label]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setNotice('') }}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-left text-sm md:rounded-xl ${tab === t ? 'bg-brown text-ivory' : 'border border-gold/50 bg-white hover:border-gold'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === 'overview' && (
            <section>
              <div className="mb-4 rounded-2xl border border-gold/40 bg-white p-5" role="status">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">Supabase connection</h2>
                    {connStatus.state === 'connected' && (
                      <p className="mt-1 text-sm text-brown-light">Connected — the dashboard is reading live data from your Supabase project.</p>
                    )}
                    {connStatus.state === 'not-configured' && (
                      <p className="mt-1 text-sm text-brown-light">Not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy. See SUPABASE_SETUP.md.</p>
                    )}
                    {connStatus.state === 'failed' && (
                      <p className="mt-1 text-sm text-brown-light">Connection failed: {connStatus.error} Check the env vars and that migrations 001–004 ran.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${connStatus.state === 'connected' ? 'bg-green-100 text-green-800' : connStatus.state === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-cream text-brown'}`}>
                      {connStatus.state === 'connected' ? 'Connected' : connStatus.state === 'failed' ? 'Connection failed' : 'Not configured'}
                    </span>
                    <button onClick={retestConnection} className="rounded-full border border-gold/60 px-3 py-1 text-sm">Re-test</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  ['Total visitors', visits.length, 'All visits (deduped per visitor for unique)'],
                  ['Unique visitors', uniqueVisitors, 'Anonymous visitor IDs'],
                  ['Invitations opened', opens, 'Deduplicated per visitor'],
                  ['RSVP responses', rsvps.length, 'All submissions'],
                  ['Attending', attending.length, `${totalGuests} expected guests`],
                  ['Not attending', rsvps.length - attending.length, ''],
                  ['Expected guests', totalGuests, 'Attending guests only'],
                  ['Published videos', publishedVideos, `${videos.length} video(s) in total`],
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
                  <p className="mt-2 text-sm text-brown-light">{attending.length} of {rsvps.length} attending ({Math.round((attending.length / rsvps.length) * 100)}%) · {totalGuests} expected guests</p>
                  <h3 className="mt-5 font-medium">Latest RSVPs</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rsvps.slice(0, 5).map((r) => <li key={r.id}>{r.guest_name} — {r.attendance_status === 'attending' ? 'Attending' : 'Not attending'} ({r.guest_count})</li>)}
                  </ul>
                </div>
              )}
              {rsvps.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-gold/60 bg-white/70 p-6 text-center text-sm text-brown-light">No RSVPs yet — stats show a true zero, not sample data.</p>}
              <div className="mt-6 rounded-2xl border border-gold/40 bg-white p-5">
                <h2 className="font-medium">Latest activity</h2>
                {analytics.length === 0 ? (
                  <p className="mt-2 text-sm text-brown-light">No visits recorded yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {analytics.slice(0, 8).map((a, i) => (
                      <li key={i}>{a.event_type === 'visit' ? 'Website visit' : 'Invitation opened'} · {new Date(a.created_at).toLocaleString()}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setTab('videos')} className="rounded-full border border-gold/60 px-4 py-2 text-sm">Upload a video</button>
                  <button onClick={() => setTab('rsvps')} className="rounded-full border border-gold/60 px-4 py-2 text-sm">View RSVPs</button>
                  <button onClick={() => setTab('invitation')} className="rounded-full border border-gold/60 px-4 py-2 text-sm">Edit invitation</button>
                </div>
              </div>
            </section>
          )}

          {tab === 'invitation' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Invitation Editor</h2>
              <p className="mt-1 text-sm text-brown-light">Saved to <code>wedding_settings</code>. Changes show on the public site after saving.</p>
              <div className="mt-4 space-y-3">
                {([
                  ['bride_name', 'Bride name'], ['groom_name', 'Groom name'],
                  ['invitation_heading', 'Main heading'], ['button_text', 'Opening button text'],
                  ['venue_name', 'Venue name'], ['venue_address', 'Venue address'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-sm font-medium">{label}
                    <input value={invitation[key]} onChange={(e) => { setInvitation({ ...invitation, [key]: e.target.value }); setDirty(true) }} className={inputCls} />
                  </label>
                ))}
                <label className="block text-sm font-medium">Invitation message
                  <textarea value={invitation.invitation_message} rows={3} onChange={(e) => { setInvitation({ ...invitation, invitation_message: e.target.value }); setDirty(true) }} className={inputCls} />
                </label>
                <label className="block text-sm font-medium">Hero message
                  <textarea value={invitation.hero_message} rows={2} onChange={(e) => { setInvitation({ ...invitation, hero_message: e.target.value }); setDirty(true) }} className={inputCls} />
                </label>
              </div>
              {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => void saveWeddingSettings({ ...invitation, hero_message: undefined })} className="rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">SAVE &amp; PUBLISH</button>
                <a href="/" target="_blank" rel="noreferrer" className="rounded-full border border-gold/60 px-6 py-3 text-sm">PREVIEW SITE</a>
              </div>
              <p className="mt-3 text-xs text-brown-light">The hero message is edited in <code>src/lib/config.ts</code> in this standalone repo; the other fields above are stored in the database.</p>
            </section>
          )}

          {tab === 'details' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Wedding Details</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium">Wedding date
                  <input type="date" value={details.wedding_date} onChange={(e) => { setDetails({ ...details, wedding_date: e.target.value }); setDirty(true) }} className={inputCls} />
                </label>
                <label className="block text-sm font-medium">Venue name
                  <input value={details.venue_name} onChange={(e) => { setDetails({ ...details, venue_name: e.target.value }); setDirty(true) }} className={inputCls} />
                </label>
                <label className="block text-sm font-medium">Venue address (only once verified — never invent one)
                  <input value={details.venue_address} onChange={(e) => { setDetails({ ...details, venue_address: e.target.value }); setDirty(true) }} placeholder="Address to be confirmed" className={inputCls} />
                </label>
                <label className="block text-sm font-medium">Google Maps URL
                  <input value={details.maps_url} onChange={(e) => { setDetails({ ...details, maps_url: e.target.value }); setDirty(true) }} placeholder="https://www.google.com/maps/…" className={inputCls} />
                </label>
              </div>
              {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
              <button onClick={() => void saveWeddingSettings({ wedding_date: `${details.wedding_date}T00:00:00+05:30`, venue_name: details.venue_name, venue_address: details.venue_address || null, maps_url: details.maps_url || null })} className="mt-4 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">SAVE DETAILS</button>
            </section>
          )}

          {tab === 'music' && (
            <section>
              <div className="rounded-2xl border border-gold/40 bg-white p-6">
                <h2 className="font-serif text-2xl">Music Manager</h2>
                <form onSubmit={uploadAudio} className="mt-4 space-y-3">
                  <input type="file" accept="audio/mpeg,audio/wav" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} className={inputCls} aria-label="Choose an audio file" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">Title
                      <input value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)} placeholder="Track title" className={inputCls} />
                    </label>
                    <label className="block text-sm font-medium">Category
                      <select value={audioType} onChange={(e) => setAudioType(e.target.value as AudioTrack['audio_type'])} className={inputCls}>
                        <option value="background">Background music</option>
                        <option value="opening">Invitation opening sound</option>
                        <option value="envelope">Envelope opening sound</option>
                        <option value="button">Button click sound</option>
                        <option value="notification">Notification sound</option>
                      </select>
                    </label>
                  </div>
                  {audioError && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{audioError}</p>}
                  <button disabled={audioBusy} className="rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory disabled:opacity-70">
                    {audioBusy ? 'UPLOADING…' : 'UPLOAD AUDIO (MP3 / WAV, MAX 15 MB)'}
                  </button>
                </form>
              </div>
              <div className="mt-4 rounded-2xl border border-gold/40 bg-white p-6">
                <h3 className="font-medium">Audio library ({tracks.length})</h3>
                {tracks.length === 0 && <p className="mt-2 text-sm text-brown-light">No audio uploaded yet.</p>}
                <ul className="mt-3 space-y-4">
                  {tracks.map((t) => (
                    <li key={t.id} className="rounded-xl border border-cream p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{t.title} <span className="text-xs text-brown-light">· {t.audio_type} · {fmtBytes(t.file_size)} · {new Date(t.created_at).toLocaleDateString()}</span></span>
                        <button onClick={() => deleteTrack(t)} className="text-sm text-rose underline">Delete</button>
                      </div>
                      <audio controls preload="none" src={t.file_url} className="mt-2 w-full" />
                    </li>
                  ))}
                </ul>
                <h3 className="mt-6 font-medium">Assign sounds</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([
                    ['background_music_id', 'Background music'], ['opening_sound_id', 'Invitation opening sound'],
                    ['envelope_sound_id', 'Envelope opening sound'], ['button_sound_id', 'Button click sound'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block text-sm font-medium">{label}
                      <select value={audioSettings[key]} onChange={(e) => setAudioSettings({ ...audioSettings, [key]: e.target.value })} className={inputCls}>
                        <option value="">— None —</option>
                        {tracks.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.audio_type})</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {([
                    ['music_enabled', 'Background music enabled'], ['effects_enabled', 'Sound effects enabled'],
                    ['loop_enabled', 'Loop background music'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-4">
                      <span>{label}</span>
                      <input type="checkbox" checked={audioSettings[key]} onChange={(e) => setAudioSettings({ ...audioSettings, [key]: e.target.checked })} className="h-5 w-5 accent-[#D6B56D]" />
                    </label>
                  ))}
                  <label className="block">Volume ({Math.round(audioSettings.volume * 100)}%)
                    <input type="range" min={0} max={1} step={0.05} value={audioSettings.volume} onChange={(e) => setAudioSettings({ ...audioSettings, volume: Number(e.target.value) })} className="mt-1 w-full accent-[#D6B56D]" />
                  </label>
                </div>
                <button onClick={saveAudioSettings} className="mt-4 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">PUBLISH AUDIO SETTINGS</button>
                <p className="mt-2 text-xs text-brown-light">Only one background track plays at a time (single audio instance in the floating player).</p>
              </div>
            </section>
          )}

          {tab === 'videos' && (
            <section>
              <div className="rounded-2xl border border-gold/40 bg-white p-6">
                <h2 className="font-serif text-2xl">Video Manager</h2>
                <p className="mt-1 text-sm text-brown-light">MP4 / WebM only, max 25 MB per file. Larger videos: compress to 720p first (e.g. HandBrake) — the upload will not silently fail, it will tell you the file is too large.</p>
                <form onSubmit={uploadVideo} className="mt-4 space-y-3">
                  <input type="file" accept="video/mp4,video/webm" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} className={inputCls} aria-label="Choose a video file" />
                  {videoFile && <p className="text-sm text-brown-light">Selected: {videoFile.name} · {fmtBytes(videoFile.size)}</p>}
                  <label className="block text-sm font-medium">Title *
                    <input value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} required placeholder="e.g. Our Wedding Film" className={inputCls} />
                  </label>
                  <label className="block text-sm font-medium">Description
                    <textarea value={newVideo.description} rows={2} onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })} className={inputCls} />
                  </label>
                  {videoError && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{videoError}</p>}
                  <button disabled={videoBusy} className="rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory disabled:opacity-70">
                    {videoBusy ? 'UPLOADING…' : 'UPLOAD VIDEO'}
                  </button>
                </form>
                <input
                  ref={posterInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    const target = videos.find((v) => v.id === posterTarget)
                    if (f && target) void uploadPoster(target, f)
                    setPosterTarget(null)
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="mt-4 space-y-4">
                {videos.length === 0 && <p className="rounded-2xl border border-dashed border-gold/60 bg-white/70 p-6 text-center text-sm text-brown-light">No videos yet — the public video section shows an elegant empty state until you upload and publish one.</p>}
                {[...videos].sort((a, b) => a.video_order - b.video_order).map((v) => (
                  <article key={v.id} className="rounded-2xl border border-gold/40 bg-white p-5">
                    <video src={v.video_url} poster={v.poster_url ?? undefined} controls preload="metadata" className="aspect-video w-full rounded-xl bg-brown object-cover" />
                    {editingVideo?.id === v.id ? (
                      <div className="mt-3 space-y-2">
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} aria-label="Video title" />
                        <textarea value={editDesc} rows={2} onChange={(e) => setEditDesc(e.target.value)} className={inputCls} aria-label="Video description" />
                        <div className="flex gap-2">
                          <button onClick={() => { void updateVideo(v.id, { title: editTitle.trim() || v.title, description: editDesc.trim() || null }); setEditingVideo(null) }} className="rounded-full bg-brown px-4 py-2 text-sm text-ivory">Save</button>
                          <button onClick={() => setEditingVideo(null)} className="rounded-full border border-gold/60 px-4 py-2 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="mt-3 font-serif text-xl">{v.title}</h3>
                        {v.description && <p className="mt-1 text-sm text-brown-light">{v.description}</p>}
                        <p className="mt-1 text-xs text-brown-light">
                          {fmtBytes(v.file_size)} · {v.is_published ? 'Published' : 'Unpublished (hidden from guests)'} · {v.is_featured ? 'Featured' : 'Not featured'}
                        </p>
                      </>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <button onClick={() => { setEditingVideo(v); setEditTitle(v.title); setEditDesc(v.description ?? '') }} className="rounded-full border border-gold/60 px-3 py-1.5">Edit title / description</button>
                      <button onClick={() => updateVideo(v.id, { is_published: !v.is_published })} className="rounded-full border border-gold/60 px-3 py-1.5">{v.is_published ? 'Unpublish' : 'Publish'}</button>
                      <button onClick={() => setFeatured(v.id)} disabled={v.is_featured} className="rounded-full border border-gold/60 px-3 py-1.5 disabled:opacity-50">Set featured</button>
                      <button onClick={() => { setPosterTarget(v.id); posterInput.current?.click() }} className="rounded-full border border-gold/60 px-3 py-1.5">Upload poster</button>
                      <button onClick={() => moveVideo(v, -1)} className="rounded-full border border-gold/60 px-3 py-1.5">↑ Move up</button>
                      <button onClick={() => moveVideo(v, 1)} className="rounded-full border border-gold/60 px-3 py-1.5">↓ Move down</button>
                      <label className="cursor-pointer rounded-full border border-gold/60 px-3 py-1.5">
                        Replace file
                        <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceVideoFile(v, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => deleteVideo(v)} className="rounded-full border border-rose/60 px-3 py-1.5 text-rose">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === 'rsvps' && (
            <section>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Total responses', rsvps.length], ['Attending', attending.length],
                  ['Not attending', rsvps.length - attending.length], ['Expected guests', totalGuests],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-2xl border border-gold/40 bg-white p-4 text-center">
                    <p className="text-xs tracking-widest text-gold-dark">{(label as string).toUpperCase()}</p>
                    <p className="mt-1 font-serif text-3xl">{value as number}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="border-b border-gold/30"><th className="p-3">Guest</th><th className="p-3">Phone</th><th className="p-3">Guests</th><th className="p-3">Status</th><th className="p-3">Message</th><th className="p-3">Date</th><th className="p-3" /></tr></thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-b border-cream">
                        <td className="p-3">{r.guest_name}</td><td className="p-3">{r.phone_number}</td><td className="p-3">{r.guest_count}</td>
                        <td className="p-3">{r.attendance_status}</td><td className="p-3">{r.message ?? '—'}</td>
                        <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
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

          {tab === 'timeline' && (
            <section>
              <form onSubmit={addEvent} className="grid gap-3 rounded-2xl border border-gold/40 bg-white p-6 sm:grid-cols-2">
                <input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required placeholder="Event title *" className={inputCls} />
                <input value={newEvent.event_time} onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })} required placeholder="Time, e.g. 11:00 AM *" className={inputCls} />
                <input value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Description" className={inputCls} />
                <input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Location" className={inputCls} />
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

          {tab === 'countdown' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Countdown Settings</h2>
              <p className="mt-2 text-sm text-brown-light">
                The countdown targets <strong>{details.wedding_date}</strong> at the start of the day in Asia/Kolkata
                (set in Wedding Details). It ticks every second and shows a graceful message once the day has passed.
              </p>
              <label className="mt-4 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">Show countdown on the public site</span>
                <input type="checkbox" checked={settings.countdown_visible} onChange={(e) => { setSettings({ ...settings, countdown_visible: e.target.checked }); setDirty(true) }} className="h-5 w-5 accent-[#D6B56D]" />
              </label>
              {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
              <button onClick={() => void saveWeddingSettings({ countdown_visible: settings.countdown_visible })} className="mt-4 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">SAVE COUNTDOWN SETTINGS</button>
            </section>
          )}

          {tab === 'theme' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Theme &amp; Design</h2>
              <p className="mt-1 text-sm text-brown-light">Saved to <code>wedding_settings.theme</code> (migration 002). The public site applies these on load.</p>
              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between gap-4 text-sm font-medium">Background colour
                  <input type="color" value={theme.backgroundColor} onChange={(e) => { setTheme({ ...theme, backgroundColor: e.target.value }); setDirty(true) }} />
                </label>
                <label className="flex items-center justify-between gap-4 text-sm font-medium">Gold accent colour
                  <input type="color" value={theme.goldAccent} onChange={(e) => { setTheme({ ...theme, goldAccent: e.target.value }); setDirty(true) }} />
                </label>
                <label className="block text-sm font-medium">Heading font
                  <select value={theme.headingFont} onChange={(e) => { setTheme({ ...theme, headingFont: e.target.value as ThemeSettings['headingFont'] }); setDirty(true) }} className={inputCls}>
                    <option value="serif">Elegant serif (Cormorant Garamond)</option>
                    <option value="script">Script (Great Vibes)</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-4 text-sm font-medium">Animations enabled
                  <input type="checkbox" checked={theme.animationsEnabled} onChange={(e) => { setTheme({ ...theme, animationsEnabled: e.target.checked }); setDirty(true) }} className="h-5 w-5 accent-[#D6B56D]" />
                </label>
              </div>
              {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
              <button onClick={() => void saveWeddingSettings({ theme, animations_enabled: theme.animationsEnabled })} className="mt-4 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">SAVE THEME</button>
            </section>
          )}

          {tab === 'settings' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Website Settings</h2>
              {([
                ['videos_visible', 'Video section visible'], ['countdown_visible', 'Countdown visible'],
                ['rsvp_visible', 'RSVP visible'], ['music_enabled', 'Background music enabled'],
                ['music_loop', 'Music loop'], ['published', 'Website published'],
              ] as const).map(([key, label]) => (
                <label key={key} className="mt-4 flex items-center justify-between gap-4 border-b border-cream pb-3 text-sm">
                  <span className="font-medium">{label}</span>
                  <input type="checkbox" checked={settings[key]} onChange={(e) => { setSettings({ ...settings, [key]: e.target.checked }); setDirty(true) }} className="h-5 w-5 accent-[#D6B56D]" />
                </label>
              ))}
              <label className="mt-4 block text-sm font-medium">Music volume ({Math.round(settings.music_volume * 100)}%)
                <input type="range" min={0} max={1} step={0.05} value={settings.music_volume} onChange={(e) => { setSettings({ ...settings, music_volume: Number(e.target.value) }); setDirty(true) }} className="mt-2 w-full accent-[#D6B56D]" />
              </label>
              {dirty && <p className="mt-3 text-sm text-gold-dark">You have unsaved changes.</p>}
              <button
                onClick={() => void saveWeddingSettings({
                  published: settings.published, videos_visible: settings.videos_visible,
                  countdown_visible: settings.countdown_visible, rsvp_visible: settings.rsvp_visible,
                  music_enabled: settings.music_enabled, loop_enabled: settings.music_loop,
                  music_volume: settings.music_volume,
                })}
                className="mt-5 rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory"
              >
                SAVE &amp; PUBLISH SETTINGS
              </button>
            </section>
          )}

          {tab === 'security' && (
            <section className="rounded-2xl border border-gold/40 bg-white p-6">
              <h2 className="font-serif text-2xl">Security &amp; Passcode</h2>
              <p className="mt-2 text-sm leading-relaxed text-brown-light">
                Signed in with your admin passcode. The passcode is stored server-side only as a
                bcrypt hash (migration 004) — it is never displayed here, never stored in the code,
                and never readable through the API. Changing it requires your current passcode first,
                and changing it signs out every other admin session. Five wrong attempts lock
                verification for 5 minutes.
              </p>
              <p className="mt-3 text-sm text-brown-light">
                Last passcode change: <strong>{lastPassChange ? new Date(lastPassChange).toLocaleString() : 'Unknown'}</strong>{' '}
                (from the server).
              </p>
              <form onSubmit={changePassword} className="mt-5 space-y-3">
                <label className="block text-sm font-medium">Current passcode
                  <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} required autoComplete="current-password" className={inputCls} />
                </label>
                <label className="block text-sm font-medium">New passcode (at least 4 characters)
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required autoComplete="new-password" className={inputCls} />
                </label>
                <label className="block text-sm font-medium">Confirm new passcode
                  <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required autoComplete="new-password" className={inputCls} />
                </label>
                {secError && <p role="alert" className="rounded-lg bg-rose-light p-3 text-sm">{secError}</p>}
                {secNotice && <p className="rounded-lg bg-cream p-3 text-sm">{secNotice}</p>}
                <button className="rounded-full bg-brown px-6 py-3 text-sm tracking-widest text-ivory">CHANGE PASSCODE</button>
              </form>
              <div className="mt-6 rounded-xl border border-gold/40 bg-cream p-4">
                <h3 className="font-medium">Forgot your passcode?</h3>
                <p className="mt-1 text-sm leading-relaxed text-brown-light">
                  There is no public reset — anyone could use it. Only you, in the Supabase dashboard,
                  can reset it. Run this in the Supabase SQL Editor, then open the gold admin dot on
                  the public site and set a new passcode when it asks:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs">delete from public.admin_credentials where id = 1;</pre>
                <p className="mt-2 text-xs text-brown-light">
                  That deletes only the stored hash (and lets the setup form appear again). It does not
                  delete any RSVPs, videos, audio or settings. Full steps: SUPABASE_SETUP.md.
                </p>
              </div>
              <button onClick={logout} className="mt-6 rounded-full border border-gold/60 px-6 py-3 text-sm">SIGN OUT</button>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
