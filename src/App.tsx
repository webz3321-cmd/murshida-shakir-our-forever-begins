import { useEffect, useState } from 'react'
import Envelope from './components/Envelope'
import Hero from './components/Hero'
import Details from './components/Details'
import Countdown from './components/Countdown'
import Venue from './components/Venue'
import Gallery from './components/Gallery'
import Timeline from './components/Timeline'
import IslamicBlessing from './components/IslamicBlessing'
import RsvpForm from './components/RsvpForm'
import FloatingMusicPlayer from './components/FloatingMusicPlayer'
import Admin from './components/Admin'
import { DEFAULT_SETTINGS, WEDDING, type GalleryImage, type SiteSettings, type WeddingEvent } from './lib/config'
import { recordAnalyticsEvent, supabase } from './lib/supabase'

export default function App() {
  const isAdmin = window.location.pathname === '/admin' || window.location.pathname === '/admin/'
  const [opened, setOpened] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [events, setEvents] = useState<WeddingEvent[]>([])
  const [gallery, setGallery] = useState<GalleryImage[] | undefined>(undefined)
  const [trackUrl, setTrackUrl] = useState<string | undefined>(undefined)
  const [trackTitle, setTrackTitle] = useState<string | undefined>(undefined)

  useEffect(() => {
    void recordAnalyticsEvent('visit')
    if (!supabase) return
    void (async () => {
      const [{ data: s }, { data: e }, { data: g }, { data: a }] = await Promise.all([
        supabase.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('wedding_events').select('*').order('event_order'),
        supabase.from('gallery').select('*').order('image_order'),
        supabase.from('audio_settings').select('*, background_music:audio_library!audio_settings_background_music_id_fkey(file_url,title)').eq('id', 1).maybeSingle(),
      ])
      if (s) {
        setSettings({
          published: s.published ?? true,
          gallery_visible: s.gallery_visible ?? true,
          countdown_visible: s.countdown_visible ?? true,
          rsvp_visible: s.rsvp_visible ?? true,
          music_enabled: s.music_enabled ?? true,
          music_loop: s.loop_enabled ?? true,
          music_volume: typeof s.music_volume === 'number' ? s.music_volume : 0.6,
        })
      }
      if (e) setEvents(e as WeddingEvent[])
      if (g && g.length > 0) setGallery(g as GalleryImage[])
      const bg = (a as unknown as { background_music?: { file_url: string; title: string } } | null)?.background_music
      if (bg) { setTrackUrl(bg.file_url); setTrackTitle(bg.title) }
    })()
  }, [])

  if (isAdmin) return <Admin />

  if (!opened) {
    return <Envelope soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)} onOpened={() => setOpened(true)} />
  }

  if (!settings.published) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-5 text-center">
        <div>
          <p className="font-script text-4xl text-gold-dark">Murshida &amp; Shakir</p>
          <p className="mt-3 text-brown-light">This invitation is currently unpublished. Please check back soon.</p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-ivory">
      <Hero />
      <Details />
      {settings.countdown_visible && <Countdown />}
      <Venue />
      {settings.gallery_visible && <Gallery images={gallery} />}
      <Timeline events={events} />
      <IslamicBlessing />
      {settings.rsvp_visible && <RsvpForm />}
      <footer className="px-5 py-12 text-center">
        <p className="font-script text-4xl text-gold-dark">Murshida &amp; Shakir</p>
        <p className="mt-2 text-sm text-brown-light">{WEDDING.weddingDateDisplay} · {WEDDING.venueName}</p>
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
    </div>
  )
}
