-- Murshida & Shakir — Our Forever Begins
-- Supabase migration 004: passcode-only admin access.
--
-- Run AFTER migrations 001, 002 and 003, then storage.sql if you have not
-- already run it. Do NOT edit 001, 002 or 003 history. This file is safe
-- to re-run: it uses CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE
-- FUNCTION throughout.
--
-- What changes: admin sign-in no longer uses Supabase Auth (email +
-- password). The gold admin dot asks for a passcode ONLY. The passcode
-- is stored ONLY as a bcrypt hash (pgcrypto crypt() with gen_salt('bf'), called as extensions.crypt / extensions.gen_salt)
-- in public.admin_credentials. There is NO passcode value in this file,
-- in the code, or in any seed data — the owner sets their own passcode
-- on first use through the admin modal. Never put a passcode value here.
--
-- How it works:
-- * admin_has_passcode() — true once a passcode has been set.
-- * setup_admin_passcode(p_new) — sets the passcode, but ONLY when no
--   passcode exists yet. After that it always returns false.
-- * verify_admin_passcode(p_passcode) — on success returns a random
--   session token (uuid text) and stores only its SHA-256 hash in
--   admin_sessions (12-hour expiry). On failure returns NULL. Five
--   wrong attempts lock verification for 5 minutes.
-- * admin_session_valid(p_token) — true only for a live, unexpired token.
-- * admin_auth_status() — public status only: whether a passcode exists
--   and when a lockout ends. It never reveals the hash or the passcode.
-- * set_admin_passcode(p_current, p_new) — changes the passcode only
--   when the current one verifies; revokes all sessions on success.
-- * revoke_admin_session(p_token) — sign-out.
-- * admin_passcode_info(p_token) — last-change date, token-checked.
-- * admin_* RPCs below — every admin database read/write the panel
--   needs (RSVP list/delete, all videos, video/audio metadata CRUD,
--   events CRUD, settings upserts, analytics list). Each one checks the
--   session token server-side first and does nothing when it is invalid.
--
-- All functions are SECURITY DEFINER with a fixed search_path. They are
-- created by the postgres role in the SQL editor, so they run with the
-- owner's privileges and bypass Row Level Security on the tables they
-- touch — that is exactly what lets a passcode session (which has no
-- Supabase Auth JWT, so auth.uid() is null) perform admin writes that
-- the is_admin() RLS policies would otherwise block. The token check
-- inside each function is the authorisation; without a valid token the
-- function returns false / NULL / an empty set and changes nothing.
-- EXECUTE is granted to anon and authenticated so the browser (anon
-- key) can call the RPCs through PostgREST.
--
-- What this does NOT cover: binary file uploads to Supabase Storage.
-- Storage bucket policies check public.is_admin(), which needs a
-- Supabase Auth JWT, so a passcode-only browser session cannot upload
-- a file directly to a bucket. The metadata rows for videos/audio are
-- fully protected by the token-checked RPCs in this file, but the file
-- upload itself is the one operation that still depends on Supabase
-- Auth in this pass. See SUPABASE_SETUP.md ("Storage uploads") for the
-- honest options — do not weaken the bucket policies silently, and do
-- not claim uploads work in passcode-only mode until that is fixed
-- with a server-side upload proxy or Edge Function.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.admin_credentials (
  id bigint primary key default 1,
  passcode_hash text,
  passcode_changed_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_credentials_single_row check (id = 1)
);

create table if not exists public.admin_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.admin_credentials enable row level security;
alter table public.admin_sessions enable row level security;
-- Deliberately NO policies on either table: nobody — not anon, not an
-- authenticated Supabase Auth user — can read the hash or the session
-- tokens through the API. Only the SECURITY DEFINER functions below
-- touch these tables.

-- ---------------------------------------------------------------- helpers
-- Hash a raw session token the same way everywhere (never store the
-- token itself).
create or replace function public.admin_token_hash(p_token text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- Drop expired sessions; called inside the token checks.
create or replace function public.admin_prune_sessions()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.admin_sessions where expires_at <= now();
$$;

create or replace function public.admin_session_valid(p_token text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_sessions
    where token_hash = public.admin_token_hash(p_token)
      and expires_at > now()
  )
$$;

create or replace function public.admin_has_passcode()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_credentials
    where id = 1 and passcode_hash is not null
  )
$$;

-- Public status only: does a passcode exist, and is verification
-- currently locked (and until when)? Never reveals the hash.
create or replace function public.admin_auth_status()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'has_passcode', exists (
      select 1 from public.admin_credentials
      where id = 1 and passcode_hash is not null
    ),
    'locked_until', (
      select locked_until from public.admin_credentials where id = 1
    )
  )
$$;

-- ---------------------------------------------------------------- passcode lifecycle
create or replace function public.setup_admin_passcode(p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_new is null or char_length(p_new) < 4 then
    return false;
  end if;
  -- Only when no passcode exists yet.
  if exists (
    select 1 from public.admin_credentials
    where id = 1 and passcode_hash is not null
  ) then
    return false;
  end if;
  insert into public.admin_credentials (id, passcode_hash, passcode_changed_at, updated_at)
  values (1, extensions.crypt(p_new, extensions.gen_salt('bf')), now(), now())
  on conflict (id) do update
    set passcode_hash = excluded.passcode_hash,
        passcode_changed_at = now(),
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();
  return true;
end;
$$;

create or replace function public.verify_admin_passcode(p_passcode text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_attempts int;
  v_locked timestamptz;
  v_token text;
begin
  if p_passcode is null or p_passcode = '' then
    return null;
  end if;
  select passcode_hash, failed_attempts, locked_until
    into v_hash, v_attempts, v_locked
    from public.admin_credentials where id = 1;
  if v_hash is null then
    return null;
  end if;
  -- Locked out after 5 wrong attempts: refuse until the lock expires.
  if v_locked is not null and v_locked > now() then
    return null;
  end if;
  if extensions.crypt(p_passcode, v_hash) = v_hash then
    update public.admin_credentials
      set failed_attempts = 0, locked_until = null, updated_at = now()
      where id = 1;
    v_token := gen_random_uuid()::text;
    insert into public.admin_sessions (token_hash, expires_at)
    values (public.admin_token_hash(v_token), now() + interval '12 hours');
    return v_token;
  end if;
  -- Wrong passcode: count it, and lock for 5 minutes at 5 attempts.
  update public.admin_credentials
    set failed_attempts = coalesce(failed_attempts, 0) + 1,
        locked_until = case
          when coalesce(failed_attempts, 0) + 1 >= 5 then now() + interval '5 minutes'
          else locked_until
        end,
        updated_at = now()
    where id = 1;
  -- Reset the counter once a lock has been applied, so the next window
  -- starts clean after the lock expires.
  update public.admin_credentials
    set failed_attempts = 0
    where id = 1 and locked_until is not null and locked_until > now()
      and failed_attempts >= 5;
  return null;
end;
$$;

create or replace function public.set_admin_passcode(p_current text, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_locked timestamptz;
begin
  if p_new is null or char_length(p_new) < 4 then
    return false;
  end if;
  select passcode_hash, locked_until into v_hash, v_locked
    from public.admin_credentials where id = 1;
  if v_hash is null then
    return false;
  end if;
  if v_locked is not null and v_locked > now() then
    return false;
  end if;
  if extensions.crypt(p_current, v_hash) <> v_hash then
    return false;
  end if;
  update public.admin_credentials
    set passcode_hash = extensions.crypt(p_new, extensions.gen_salt('bf')),
        passcode_changed_at = now(),
        failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where id = 1;
  -- Changing the passcode revokes every existing session.
  delete from public.admin_sessions;
  return true;
end;
$$;

create or replace function public.revoke_admin_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.admin_sessions
  where token_hash = public.admin_token_hash(p_token);
  return found;
end;
$$;

create or replace function public.admin_passcode_info(p_token text)
returns table (has_passcode boolean, passcode_changed_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.admin_credentials where id = 1 and passcode_hash is not null),
    (select passcode_changed_at from public.admin_credentials where id = 1)
  where public.admin_session_valid(p_token)
$$;

-- ---------------------------------------------------------------- admin reads (token-checked)
-- RSVPs and analytics have no public SELECT policy, so the panel reads
-- them only through these functions. They return nothing without a
-- valid token.
create or replace function public.admin_list_rsvps(p_token text)
returns setof public.rsvps
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.rsvps
  where public.admin_session_valid(p_token)
  order by created_at desc
$$;

create or replace function public.admin_list_analytics(p_token text)
returns table (visitor_id text, event_type text, created_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select visitor_id, event_type, created_at
  from public.analytics_events
  where public.admin_session_valid(p_token)
  order by created_at desc
  limit 1000
$$;

-- All videos, including unpublished ones (the public policy only
-- exposes published videos).
create or replace function public.admin_list_videos(p_token text)
returns setof public.wedding_videos
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.wedding_videos
  where public.admin_session_valid(p_token)
  order by video_order
$$;

-- ---------------------------------------------------------------- admin writes (token-checked)
create or replace function public.admin_delete_rsvp(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  delete from public.rsvps where id = p_id;
  return found;
end;
$$;

create or replace function public.admin_upsert_wedding_settings(p_token text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  insert into public.wedding_settings (id) values (1)
  on conflict (id) do nothing;
  update public.wedding_settings set
    bride_name = case when p_patch ? 'bride_name' then (p_patch ->> 'bride_name') else bride_name end,
    groom_name = case when p_patch ? 'groom_name' then (p_patch ->> 'groom_name') else groom_name end,
    wedding_date = case when p_patch ? 'wedding_date' then (p_patch ->> 'wedding_date')::timestamptz else wedding_date end,
    venue_name = case when p_patch ? 'venue_name' then (p_patch ->> 'venue_name') else venue_name end,
    venue_address = case when p_patch ? 'venue_address' then (p_patch ->> 'venue_address') else venue_address end,
    maps_url = case when p_patch ? 'maps_url' then (p_patch ->> 'maps_url') else maps_url end,
    invitation_heading = case when p_patch ? 'invitation_heading' then (p_patch ->> 'invitation_heading') else invitation_heading end,
    invitation_message = case when p_patch ? 'invitation_message' then (p_patch ->> 'invitation_message') else invitation_message end,
    button_text = case when p_patch ? 'button_text' then (p_patch ->> 'button_text') else button_text end,
    published = case when p_patch ? 'published' then (p_patch ->> 'published')::boolean else published end,
    videos_visible = case when p_patch ? 'videos_visible' then (p_patch ->> 'videos_visible')::boolean else videos_visible end,
    countdown_visible = case when p_patch ? 'countdown_visible' then (p_patch ->> 'countdown_visible')::boolean else countdown_visible end,
    rsvp_visible = case when p_patch ? 'rsvp_visible' then (p_patch ->> 'rsvp_visible')::boolean else rsvp_visible end,
    music_enabled = case when p_patch ? 'music_enabled' then (p_patch ->> 'music_enabled')::boolean else music_enabled end,
    loop_enabled = case when p_patch ? 'loop_enabled' then (p_patch ->> 'loop_enabled')::boolean else loop_enabled end,
    music_volume = case when p_patch ? 'music_volume' then (p_patch ->> 'music_volume')::numeric else music_volume end,
    animations_enabled = case when p_patch ? 'animations_enabled' then (p_patch ->> 'animations_enabled')::boolean else animations_enabled end,
    theme = case when p_patch ? 'theme' then (p_patch -> 'theme') else theme end,
    updated_at = now()
  where id = 1;
  return true;
end;
$$;

create or replace function public.admin_upsert_audio_settings(p_token text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  insert into public.audio_settings (id) values (1)
  on conflict (id) do nothing;
  update public.audio_settings set
    background_music_id = case when p_patch ? 'background_music_id' then nullif(p_patch ->> 'background_music_id', '')::uuid else background_music_id end,
    opening_sound_id = case when p_patch ? 'opening_sound_id' then nullif(p_patch ->> 'opening_sound_id', '')::uuid else opening_sound_id end,
    envelope_sound_id = case when p_patch ? 'envelope_sound_id' then nullif(p_patch ->> 'envelope_sound_id', '')::uuid else envelope_sound_id end,
    button_sound_id = case when p_patch ? 'button_sound_id' then nullif(p_patch ->> 'button_sound_id', '')::uuid else button_sound_id end,
    music_enabled = case when p_patch ? 'music_enabled' then (p_patch ->> 'music_enabled')::boolean else music_enabled end,
    effects_enabled = case when p_patch ? 'effects_enabled' then (p_patch ->> 'effects_enabled')::boolean else effects_enabled end,
    volume = case when p_patch ? 'volume' then (p_patch ->> 'volume')::numeric else volume end,
    loop_enabled = case when p_patch ? 'loop_enabled' then (p_patch ->> 'loop_enabled')::boolean else loop_enabled end,
    updated_at = now()
  where id = 1;
  return true;
end;
$$;

create or replace function public.admin_insert_event(
  p_token text, p_title text, p_event_time text, p_description text, p_location text, p_event_order int
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.admin_session_valid(p_token) then return null; end if;
  insert into public.wedding_events (title, event_time, description, location, event_order)
  values (p_title, p_event_time, nullif(p_description, ''), nullif(p_location, ''), p_event_order)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_delete_event(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  delete from public.wedding_events where id = p_id;
  return found;
end;
$$;

-- Video / audio metadata only. The binary file itself is uploaded to
-- Supabase Storage by the browser (see the Storage note at the top of
-- this file); these functions record / change / remove the row that
-- points at it.
create or replace function public.admin_insert_video(
  p_token text, p_title text, p_description text, p_video_url text, p_storage_path text,
  p_is_featured boolean, p_is_published boolean, p_video_order int, p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.admin_session_valid(p_token) then return null; end if;
  insert into public.wedding_videos
    (title, description, video_url, storage_path, is_featured, is_published, video_order, file_size)
  values (p_title, nullif(p_description, ''), p_video_url, p_storage_path, p_is_featured, p_is_published, p_video_order, p_file_size)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_update_video(p_token text, p_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  update public.wedding_videos set
    title = case when p_patch ? 'title' then (p_patch ->> 'title') else title end,
    description = case when p_patch ? 'description' then (p_patch ->> 'description') else description end,
    video_url = case when p_patch ? 'video_url' then (p_patch ->> 'video_url') else video_url end,
    storage_path = case when p_patch ? 'storage_path' then (p_patch ->> 'storage_path') else storage_path end,
    poster_url = case when p_patch ? 'poster_url' then (p_patch ->> 'poster_url') else poster_url end,
    poster_path = case when p_patch ? 'poster_path' then (p_patch ->> 'poster_path') else poster_path end,
    is_featured = case when p_patch ? 'is_featured' then (p_patch ->> 'is_featured')::boolean else is_featured end,
    is_published = case when p_patch ? 'is_published' then (p_patch ->> 'is_published')::boolean else is_published end,
    video_order = case when p_patch ? 'video_order' then (p_patch ->> 'video_order')::int else video_order end,
    file_size = case when p_patch ? 'file_size' then (p_patch ->> 'file_size')::bigint else file_size end,
    updated_at = now()
  where id = p_id;
  return found;
end;
$$;

create or replace function public.admin_delete_video(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  delete from public.wedding_videos where id = p_id;
  return found;
end;
$$;

create or replace function public.admin_insert_audio(
  p_token text, p_title text, p_file_url text, p_storage_path text, p_audio_type text, p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.admin_session_valid(p_token) then return null; end if;
  insert into public.audio_library (title, file_url, storage_path, audio_type, file_size)
  values (p_title, p_file_url, p_storage_path, p_audio_type, p_file_size)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_delete_audio(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_session_valid(p_token) then return false; end if;
  delete from public.audio_library where id = p_id;
  return found;
end;
$$;

-- ---------------------------------------------------------------- grants
-- The browser calls these through PostgREST with the anon key, so they
-- need EXECUTE for anon (and authenticated, for completeness). The
-- token check inside each function is what authorises the call — the
-- grant alone authorises nothing.
grant execute on function public.admin_token_hash(text) to anon, authenticated;
grant execute on function public.admin_prune_sessions() to anon, authenticated;
grant execute on function public.admin_session_valid(text) to anon, authenticated;
grant execute on function public.admin_has_passcode() to anon, authenticated;
grant execute on function public.admin_auth_status() to anon, authenticated;
grant execute on function public.setup_admin_passcode(text) to anon, authenticated;
grant execute on function public.verify_admin_passcode(text) to anon, authenticated;
grant execute on function public.set_admin_passcode(text, text) to anon, authenticated;
grant execute on function public.revoke_admin_session(text) to anon, authenticated;
grant execute on function public.admin_passcode_info(text) to anon, authenticated;
grant execute on function public.admin_list_rsvps(text) to anon, authenticated;
grant execute on function public.admin_list_analytics(text) to anon, authenticated;
grant execute on function public.admin_list_videos(text) to anon, authenticated;
grant execute on function public.admin_delete_rsvp(text, uuid) to anon, authenticated;
grant execute on function public.admin_upsert_wedding_settings(text, jsonb) to anon, authenticated;
grant execute on function public.admin_upsert_audio_settings(text, jsonb) to anon, authenticated;
grant execute on function public.admin_insert_event(text, text, text, text, text, int) to anon, authenticated;
grant execute on function public.admin_delete_event(text, uuid) to anon, authenticated;
grant execute on function public.admin_insert_video(text, text, text, text, text, boolean, boolean, int, bigint) to anon, authenticated;
grant execute on function public.admin_update_video(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_video(text, uuid) to anon, authenticated;
grant execute on function public.admin_insert_audio(text, text, text, text, text, bigint) to anon, authenticated;
grant execute on function public.admin_delete_audio(text, uuid) to anon, authenticated;
