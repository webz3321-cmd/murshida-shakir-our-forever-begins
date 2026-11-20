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
} as const

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

export interface GalleryImage {
  id: string
  image_url: string
  storage_path: string | null
  image_order: number
  is_hero: boolean
  is_placeholder?: boolean
}

export interface AudioTrack {
  id: string
  title: string
  file_url: string
  audio_type: 'background' | 'opening' | 'envelope' | 'button' | 'notification'
  file_size: number | null
  created_at: string
}

export interface SiteSettings {
  published: boolean
  gallery_visible: boolean
  countdown_visible: boolean
  rsvp_visible: boolean
  music_enabled: boolean
  music_loop: boolean
  music_volume: number
}

export const DEFAULT_SETTINGS: SiteSettings = {
  published: true,
  gallery_visible: true,
  countdown_visible: true,
  rsvp_visible: true,
  music_enabled: true,
  music_loop: true,
  music_volume: 0.6,
}

// Placeholder gallery art. These are floral SVG-style panels, clearly
// labelled as placeholders in the UI. They are NOT wedding photographs
// and must never be presented as such.
export const PLACEHOLDER_GALLERY: GalleryImage[] = Array.from(
  { length: 6 },
  (_, i) => ({
    id: `placeholder-${i + 1}`,
    image_url: '',
    storage_path: null,
    image_order: i,
    is_hero: i === 0,
    is_placeholder: true,
  }),
)
