-- Murshida & Shakir — Our Forever Begins
-- Supabase migration 002: wedding videos + settings additions.
-- Run AFTER migration 001. Do NOT edit 001_init.sql history.
-- The photo gallery is removed from the site; this migration adds the
-- video section that replaces it. Videos are stored as files in the
-- `videos` Storage bucket (see storage.sql) — never in this table.

-- ---------------------------------------------------------------- wedding_videos
create table if not exists public.wedding_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  video_url text not null,
  storage_path text,
  poster_url text,
  poster_path text,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  video_order int not null default 0,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wedding_videos_order_idx on public.wedding_videos (video_order);
create index if not exists wedding_videos_published_idx on public.wedding_videos (is_published);

-- ---------------------------------------------------------------- settings additions
-- Video-section visibility and the animations toggle, plus a theme
-- object, all on the single wedding_settings row (id = 1).
alter table public.wedding_settings
  add column if not exists videos_visible boolean not null default true,
  add column if not exists animations_enabled boolean not null default true,
  add column if not exists theme jsonb not null default '{}'::jsonb;

-- Keep the old gallery_visible column for backwards compatibility with
-- projects that only ran migration 001; the app reads videos_visible
-- first and falls back to gallery_visible. Do not add new gallery code.

-- ---------------------------------------------------------------- RLS
alter table public.wedding_videos enable row level security;

-- Guests may read PUBLISHED videos only; unpublished videos are invisible.
create policy "public read published videos" on public.wedding_videos
  for select using (is_published = true);

-- Only admins may insert / update / delete videos.
create policy "admin write videos" on public.wedding_videos
  for all using (public.is_admin()) with check (public.is_admin());
