// Single source of truth for the wedding details.
// Edit these values (or the wedding_settings row in Supabase) —
// do not invent a venue address, coordinates or map pin here.
export const WEDDING = {
  brideName: 'Murshida',
  groomName: 'Shakir',
  heading: 'Two Souls, One Beautiful Journey',
  invitationMessage:
    'With the blessings of Allah and our beloved families, we invite you to celebrate the beginning of our forever.',
  heroMessage:
    'Together with our families, we invite you to join us as we begin our forever.',
  // Sunday, 27 December 2026, Asia/Kolkata. Time of day is not published
  // by the couple, so the countdown targets the start of the day in IST.
  weddingDateISO: '2026-12-27T00:00:00+05:30',
  weddingDateDisplay: 'Sunday, 27 December 2026',
  dateShort: '27 | 12 | 2026',
  venueName: 'Janapriya Garden Hall, Mani',
  // Address NOT verified. Leave empty until the couple confirms it.
  // The Venue section shows the name and a Google Maps *search* link only.
  venueAddress: '',
  mapsSearchUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Janapriya Garden Hall, Mani'),
}

export type AttendanceStatus = 'attending' | 'not_attending'

export interface Rsvp {
  id: string
  guest_name: string
  phone_number: string
  guest_count: number
  attendance_status: AttendanceStatus
  message: string | null
  created_at: string
}

export interface WeddingEvent {
  id: string
  title: string
  description: string | null
  event_time: string
  location: string | null
  event_order: number
}

export interface WeddingVideo {
  id: string
  title: string
  description: string | null
  video_url: string
  storage_path: string | null
  poster_url: string | null
  poster_path: string | null
  is_featured: boolean
  is_published: boolean
  video_order: number
  file_size: number | null
  created_at: string
  updated_at?: string
}

export interface AudioTrack {
  id: string
  title: string
  file_url: string
  storage_path: string | null
  audio_type: 'background' | 'opening' | 'envelope' | 'button' | 'notification'
  file_size: number | null
  created_at: string
}

export interface ThemeSettings {
  backgroundColor: string
  goldAccent: string
  headingFont: 'serif' | 'script'
  animationsEnabled: boolean
}

export const DEFAULT_THEME: ThemeSettings = {
  backgroundColor: '#F2F8F1',
  goldAccent: '#D6B56D',
  headingFont: 'serif',
  animationsEnabled: true,
}

export interface SiteSettings {
  published: boolean
  videos_visible: boolean
  countdown_visible: boolean
  rsvp_visible: boolean
  music_enabled: boolean
  music_loop: boolean
  music_volume: number
  animations_enabled: boolean
  theme: ThemeSettings
}

export const DEFAULT_SETTINGS: SiteSettings = {
  published: true,
  videos_visible: true,
  countdown_visible: true,
  rsvp_visible: true,
  music_enabled: true,
  music_loop: true,
  music_volume: 0.6,
  animations_enabled: true,
  theme: DEFAULT_THEME,
}

// Video upload limits (also enforced in the Admin Video Manager UI).
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024 // 25 MB
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const
export const AUDIO_MAX_BYTES = 15 * 1024 * 1024 // 15 MB
export const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav'] as const
export const POSTER_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
