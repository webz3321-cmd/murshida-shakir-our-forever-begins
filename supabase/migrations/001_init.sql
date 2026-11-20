-- Murshida & Shakir — Our Forever Begins
-- Supabase migration 001: core tables + Row Level Security.
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Never put a service-role key in the frontend; all browser access
-- uses the anon key and is limited by the policies below.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'guest' check (role in ('admin', 'guest')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- wedding_settings
create table if not exists public.wedding_settings (
  id bigint primary key,
  bride_name text not null default 'Murshida',
  groom_name text not null default 'Shakir',
  wedding_date timestamptz not null default '2026-12-27 00:00:00+05:30',
  venue_name text not null default 'Janapriya Garden Hall, Mani',
  venue_address text,
  maps_url text,
  invitation_heading text not null default 'Two Souls, One Beautiful Journey',
  invitation_message text not null default 'With the blessings of Allah and our beloved families, we invite you to celebrate the beginning of our forever.',
  button_text text not null default 'OPEN INVITATION',
  published boolean not null default true,
  gallery_visible boolean not null default true,
  countdown_visible boolean not null default true,
  rsvp_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.wedding_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- rsvps
create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(trim(guest_name)) >= 2),
  phone_number text not null,
  guest_count int not null check (guest_count between 1 and 10),
  attendance_status text not null check (attendance_status in ('attending', 'not_attending')),
  message text,
  -- Only the SHA-256 hash of the guest's edit token is stored.
  -- The token itself is shown to the guest once, at submission time.
  edit_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One response per phone number: a repeat submission updates, never duplicates.
create unique index if not exists rsvps_phone_unique on public.rsvps (phone_number);
create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);
create index if not exists rsvps_status_idx on public.rsvps (attendance_status);

-- ---------------------------------------------------------------- gallery
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  image_order int not null default 0,
  is_hero boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gallery_order_idx on public.gallery (image_order);

-- ---------------------------------------------------------------- audio_library
create table if not exists public.audio_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  storage_path text,
  audio_type text not null check (audio_type in ('background', 'opening', 'envelope', 'button', 'notification')),
  file_size bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audio_settings
create table if not exists public.audio_settings (
  id bigint primary key,
  background_music_id uuid references public.audio_library (id) on delete set null,
  opening_sound_id uuid references public.audio_library (id) on delete set null,
  envelope_sound_id uuid references public.audio_library (id) on delete set null,
  button_sound_id uuid references public.audio_library (id) on delete set null,
  music_enabled boolean not null default true,
  effects_enabled boolean not null default true,
  volume numeric not null default 0.6 check (volume between 0 and 1),
  loop_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.audio_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- wedding_events
create table if not exists public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_time text not null,
  location text,
  event_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists wedding_events_order_idx on public.wedding_events (event_order);
-- Starts empty on purpose: no timings are invented here.

-- ---------------------------------------------------------------- analytics_events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event_type text not null check (event_type in ('visit', 'invitation_open')),
  created_at timestamptz not null default now()
);
-- Deduplication: one 'visit' / one 'invitation_open' per anonymous visitor.
create unique index if not exists analytics_visitor_event_unique
  on public.analytics_events (visitor_id, event_type);
create index if not exists analytics_created_at_idx on public.analytics_events (created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.wedding_settings enable row level security;
alter table public.rsvps enable row level security;
alter table public.gallery enable row level security;
alter table public.audio_library enable row level security;
alter table public.audio_settings enable row level security;
alter table public.wedding_events enable row level security;
alter table public.analytics_events enable row level security;

-- Helper: is the signed-in user an admin? (reads profiles; admins are
-- created in Supabase Auth and given role='admin' in this table.)
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Public reads: settings, gallery, events, audio catalogue/settings.
create policy "public read settings" on public.wedding_settings
  for select using (true);
create policy "public read gallery" on public.gallery
  for select using (true);
create policy "public read events" on public.wedding_events
  for select using (true);
create policy "public read audio library" on public.audio_library
  for select using (true);
create policy "public read audio settings" on public.audio_settings
  for select using (true);

-- RSVPs: anyone may INSERT (one per phone, upsert in the app); only
-- admins may SELECT / UPDATE / DELETE. Phone numbers are never public.
create policy "anon insert rsvp" on public.rsvps
  for insert with check (true);
create policy "admin read rsvps" on public.rsvps
  for select using (public.is_admin());
create policy "admin update rsvps" on public.rsvps
  for update using (public.is_admin());
create policy "admin delete rsvps" on public.rsvps
  for delete using (public.is_admin());

-- Analytics: anyone may insert their own anonymous event; only admins read.
create policy "anon insert analytics" on public.analytics_events
  for insert with check (true);
create policy "admin read analytics" on public.analytics_events
  for select using (public.is_admin());

-- Admin-only writes for everything else.
create policy "admin write settings" on public.wedding_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write gallery" on public.gallery
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write audio library" on public.audio_library
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write audio settings" on public.audio_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write events" on public.wedding_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: users read their own row; admins read all.
create policy "own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "admin write profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
