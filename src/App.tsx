import { useEffect, useState } from 'react'
import Envelope from './components/Envelope'
import Hero from './components/Hero'
import Details from './components/Details'
import Countdown from './components/Countdown'
import Venue from './components/Venue'
import VideoSection from './components/VideoSection'
import Timeline from './components/Timeline'
import IslamicBlessing from './components/IslamicBlessing'
import RsvpForm from './components/RsvpForm'
import FloatingMusicPlayer from './components/FloatingMusicPlayer'
import Admin from './components/Admin'
import AdminDot from './components/AdminDot'
import Reveal from './components/Reveal'
import { DEFAULT_SETTINGS, DEFAULT_THEME, type SiteSettings, type WeddingEvent, type WeddingVideo } from './lib/config'
import { getPublishedVideos, recordAnalyticsEvent, supabase } from './lib/supabase'

export default function App() {
  const isAdmin = window.location.pathname === '/admin' || window.location.pathname === '/admin/'
  const [opened, setOpened] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [events, setEvents] = useState<WeddingEvent[]>([])
  const [videos, setVideos] = useState<WeddingVideo[]>([])
  const [trackUrl, setTrackUrl] = useState<string | undefined>(undefined)
  const [trackTitle, setTrackTitle] = useState<string | undefined>(undefined)

  useEffect(() => {
    void recordAnalyticsEvent('visit')
    if (!supabase) return
    void (async () => {
      const [{ data: s }, { data: e }, { data: a }] = await Promise.all([
        supabase.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('wedding_events').select('*').order('event_order'),
        supabase.from('audio_settings').select('*, background_music:audio_library!audio_settings_background_music_id_fkey(file_url,title)').eq('id', 1).maybeSingle(),
      ])
      if (s) {
        // videos_visible / animations_enabled / theme were added by
        // migration 002; fall back to the older gallery_visible column
        // for projects that only ran migration 001.
        const theme = (s.theme as SiteSettings['theme'] | null) ?? DEFAULT_THEME
        setSettings({
          published: s.published ?? true,
          videos_visible: s.videos_visible ?? s.gallery_visible ?? true,
          countdown_visible: s.countdown_visible ?? true,
          rsvp_visible: s.rsvp_visible ?? true,
          music_enabled: s.music_enabled ?? true,
          music_loop: s.loop_enabled ?? true,
          music_volume: typeof s.music_volume === 'number' ? s.music_volume : 0.6,
          animations_enabled: s.animations_enabled ?? theme.animationsEnabled ?? true,
          theme: { ...DEFAULT_THEME, ...theme },
        })
      }
      if (e) setEvents(e as WeddingEvent[])
      const bg = (a as unknown as { background_music?: { file_url: string; title: string } } | null)?.background_music
      if (bg) { setTrackUrl(bg.file_url); setTrackTitle(bg.title) }
    })()
    void getPublishedVideos().then(setVideos)
  }, [])

  if (isAdmin) return <Admin />

  if (!opened) {
    return (
      <>
        <Envelope soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)} onOpened={() => setOpened(true)} />
        <AdminDot />
      </>
    )
  }

  if (!settings.published) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-5 text-center">
        <div>
          <p className="font-script text-4xl text-gold-dark">Murshida &amp; Shakir</p>
          <p className="mt-3 text-brown-light">This invitation is currently unpublished. Please check back soon.</p>
        </div>
        <AdminDot />
      </main>
    )
  }

  const anim = settings.animations_enabled

  return (
    <div className="min-h-dvh bg-ivory" style={{ backgroundColor: settings.theme.backgroundColor }}>
      <Hero animationsEnabled={anim} />
      <Reveal enabled={anim}><Details /></Reveal>
      {settings.countdown_visible && <Reveal enabled={anim}><Countdown /></Reveal>}
      <Reveal enabled={anim}><Venue /></Reveal>
      {settings.videos_visible && <Reveal enabled={anim}><VideoSection videos={videos} /></Reveal>}
      <Reveal enabled={anim}><Timeline events={events} /></Reveal>
      <Reveal enabled={anim}><IslamicBlessing /></Reveal>
      {settings.rsvp_visible && <Reveal enabled={anim}><RsvpForm /></Reveal>}
      <footer className="px-5 py-12 text-center">
        <p className="font-script text-4xl text-gold-dark">Murshida &amp; Shakir</p>
        <p className="mt-2 text-sm text-brown-light">Sunday, 27 December 2026 · Janapriya Garden Hall, Mani</p>
        <p className="mt-1 text-xs text-brown-light">Made with love · 27 | 12 | 2026</p>
      </footer>
      <FloatingMusicPlayer
        trackUrl={trackUrl}
        trackTitle={trackTitle}
        enabled={settings.music_enabled}
        loop={settings.music_loop}
        defaultVolume={settings.music_volume}
        autoStart={opened}
      />
      <AdminDot />
    </div>
  )
}
