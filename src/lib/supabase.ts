import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Only the anon key is ever used in the browser. Never add a
// service-role key here — admin writes go through Supabase Auth + RLS.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null

/** Anonymous, privacy-conscious visitor id (random UUID, no personal data). */
export function getVisitorId(): string {
  const key = 'ms-visitor-id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch {
    return 'anonymous'
  }
}

export async function recordAnalyticsEvent(eventType: 'visit' | 'invitation_open') {
  if (!supabase) return
  try {
    // Deduplication is enforced server-side by the unique index on
    // (visitor_id, event_type) in the migration; repeat inserts are ignored.
    await supabase
      .from('analytics_events')
      .insert({ visitor_id: getVisitorId(), event_type: eventType })
  } catch {
    // Analytics must never block rendering.
  }
}
