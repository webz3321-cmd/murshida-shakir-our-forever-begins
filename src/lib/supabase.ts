import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WeddingVideo } from './config'

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

export type ConnectionStatus =
  | { state: 'not-configured' }
  | { state: 'connected' }
  | { state: 'failed'; error: string }

/**
 * Test the live Supabase connection with a lightweight read of the
 * single wedding_settings row. Never throws. Callers must use the
 * returned state — never show a "connected" tick without calling this.
 * Times out after 8 seconds so a stalled network cannot hang the page.
 */
export async function testSupabaseConnection(): Promise<ConnectionStatus> {
  if (!supabase) return { state: 'not-configured' }
  try {
    const query = supabase
      .from('wedding_settings')
      .select('id')
      .eq('id', 1)
      .maybeSingle()
    const result = await Promise.race([
      query,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 8 seconds.')), 8000),
      ),
    ])
    if (result.error) return { state: 'failed', error: result.error.message }
    return { state: 'connected' }
  } catch (e) {
    return { state: 'failed', error: e instanceof Error ? e.message : 'Connection failed.' }
  }
}

/** Published videos only — the public site never sees unpublished videos. */
export async function getPublishedVideos(): Promise<WeddingVideo[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('wedding_videos')
    .select('*')
    .eq('is_published', true)
    .order('video_order')
  return (data ?? []) as WeddingVideo[]
}
