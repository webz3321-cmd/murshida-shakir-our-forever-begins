import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WeddingVideo } from './config'

// Only the anon key is ever used in the browser. Never add a
// service-role key here. Admin access is passcode-only (migration 004):
// the passcode is stored server-side only as a bcrypt hash, the browser
// never sees it, and admin operations are authorised by a short-lived
// session token issued by verify_admin_passcode() and checked inside
// SECURITY DEFINER functions. No email / Supabase Auth sign-in is used
// anywhere in the admin flow.
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

/* ------------------------------------------------------------------ */
/* Passcode-only admin access (migration 004).                        */
/*                                                                    */
/* The passcode itself is NEVER stored, sent back, or kept in the     */
/* browser. Only the session token returned by                        */
/* verify_admin_passcode() is kept, in sessionStorage (cleared when  */
/* the tab closes), together with its expiry. Every admin RPC takes  */
/* that token and checks it server-side first.                        */
/* ------------------------------------------------------------------ */

const ADMIN_TOKEN_KEY = 'ms-admin-token'
const ADMIN_TOKEN_EXPIRY_KEY = 'ms-admin-token-expires'

export function getAdminToken(): string | null {
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    const expiry = Number(sessionStorage.getItem(ADMIN_TOKEN_EXPIRY_KEY) ?? '0')
    if (!token || !expiry || Date.now() > expiry) {
      clearAdminToken()
      return null
    }
    return token
  } catch {
    return null
  }
}

export function setAdminToken(token: string, validHours = 12): void {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    sessionStorage.setItem(ADMIN_TOKEN_EXPIRY_KEY, String(Date.now() + validHours * 60 * 60 * 1000))
  } catch {
    /* Storage unavailable — the admin will simply need to sign in again. */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    sessionStorage.removeItem(ADMIN_TOKEN_EXPIRY_KEY)
  } catch {
    /* ignore */
  }
}

export interface AdminAuthStatus {
  has_passcode: boolean
  locked_until: string | null
}

async function callAdminRpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' }
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { data: null, error: error.message }
  return { data: data as T, error: null }
}

export async function adminAuthStatus(): Promise<AdminAuthStatus | null> {
  const { data } = await callAdminRpc<AdminAuthStatus>('admin_auth_status', {})
  return data
}

export async function adminHasPasscode(): Promise<boolean> {
  const { data } = await callAdminRpc<boolean>('admin_has_passcode', {})
  return data === true
}

export async function adminSessionValid(): Promise<boolean> {
  const token = getAdminToken()
  if (!token) return false
  const { data } = await callAdminRpc<boolean>('admin_session_valid', { p_token: token })
  if (data !== true) clearAdminToken()
  return data === true
}

/** Returns the session token on success, or null when the passcode is wrong or locked. */
export async function verifyAdminPasscode(passcode: string): Promise<string | null> {
  const { data, error } = await callAdminRpc<string | null>('verify_admin_passcode', { p_passcode: passcode })
  if (error || !data) return null
  setAdminToken(data)
  return data
}

export async function setupAdminPasscode(newPasscode: string): Promise<boolean> {
  const { data } = await callAdminRpc<boolean>('setup_admin_passcode', { p_new: newPasscode })
  return data === true
}

export async function changeAdminPasscode(current: string, next: string): Promise<boolean> {
  const { data } = await callAdminRpc<boolean>('set_admin_passcode', { p_current: current, p_new: next })
  return data === true
}

export async function adminPasscodeInfo(): Promise<{ has_passcode: boolean; passcode_changed_at: string | null } | null> {
  const token = getAdminToken()
  if (!token) return null
  const { data } = await callAdminRpc<Array<{ has_passcode: boolean; passcode_changed_at: string | null }>>('admin_passcode_info', { p_token: token })
  return data?.[0] ?? null
}

export async function revokeAdminSession(): Promise<void> {
  const token = getAdminToken()
  if (token) await callAdminRpc<boolean>('revoke_admin_session', { p_token: token })
  clearAdminToken()
}

/** Call a token-checked admin RPC. Returns null (and an error string) when the token is invalid. */
export async function adminRpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const token = getAdminToken()
  if (!token) return { data: null, error: 'Admin session has expired. Please unlock the admin panel again.' }
  return callAdminRpc<T>(name, { p_token: token, ...args })
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
