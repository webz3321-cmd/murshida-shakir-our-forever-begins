-- Supabase Storage buckets for Murshida & Shakir.
-- Run in the Supabase SQL editor after migrations 001, 002 and 003.
-- Safe to re-run: bucket inserts use ON CONFLICT DO NOTHING and every
-- policy is dropped before it is re-created.
--
-- Current buckets (used by the app):
--   wedding-audio   — background music and sound effects (MP3 / WAV)
--   wedding-videos  — wedding videos (MP4 / WebM)
--   wedding-images  — poster / thumbnail images (JPG / PNG / WebP)
-- Legacy buckets (kept so older deployments do not break; the app no
-- longer uploads to them): gallery, audio, videos.
--
-- All buckets are PUBLIC for reading (guests must be able to see, hear
-- and play the media), but only signed-in admins may upload, update or
-- delete. Validate file type and size in the upload UI as well; Storage
-- policies alone do not check MIME types.

insert into storage.buckets (id, name, public)
values ('wedding-audio', 'wedding-audio', true),
       ('wedding-videos', 'wedding-videos', true),
       ('wedding-images', 'wedding-images', true),
       ('gallery', 'gallery', true),
       ('audio', 'audio', true),
       ('videos', 'videos', true)
on conflict (id) do nothing;

-- Drop every policy this file manages first, so re-running it never
-- fails with "policy already exists".
drop policy if exists "public read wedding-audio files" on storage.objects;
drop policy if exists "public read wedding-videos files" on storage.objects;
drop policy if exists "public read wedding-images files" on storage.objects;
drop policy if exists "public read gallery files" on storage.objects;
drop policy if exists "public read audio files" on storage.objects;
drop policy if exists "public read video files" on storage.objects;
drop policy if exists "admin upload wedding-audio" on storage.objects;
drop policy if exists "admin update wedding-audio" on storage.objects;
drop policy if exists "admin delete wedding-audio" on storage.objects;
drop policy if exists "admin upload wedding-videos" on storage.objects;
drop policy if exists "admin update wedding-videos" on storage.objects;
drop policy if exists "admin delete wedding-videos" on storage.objects;
drop policy if exists "admin upload wedding-images" on storage.objects;
drop policy if exists "admin update wedding-images" on storage.objects;
drop policy if exists "admin delete wedding-images" on storage.objects;
drop policy if exists "admin upload gallery" on storage.objects;
drop policy if exists "admin update gallery" on storage.objects;
drop policy if exists "admin delete gallery" on storage.objects;
drop policy if exists "admin upload audio" on storage.objects;
drop policy if exists "admin update audio" on storage.objects;
drop policy if exists "admin delete audio" on storage.objects;
drop policy if exists "admin upload videos" on storage.objects;
drop policy if exists "admin update videos" on storage.objects;
drop policy if exists "admin delete videos" on storage.objects;

-- Public read (guests can play / view the media).
create policy "public read wedding-audio files" on storage.objects
  for select using (bucket_id = 'wedding-audio');
create policy "public read wedding-videos files" on storage.objects
  for select using (bucket_id = 'wedding-videos');
create policy "public read wedding-images files" on storage.objects
  for select using (bucket_id = 'wedding-images');
create policy "public read gallery files" on storage.objects
  for select using (bucket_id = 'gallery');
create policy "public read audio files" on storage.objects
  for select using (bucket_id = 'audio');
create policy "public read video files" on storage.objects
  for select using (bucket_id = 'videos');

-- Admin-only upload / update / delete.
-- (Uses the same public.is_admin() helper from the migrations.)
create policy "admin upload wedding-audio" on storage.objects
  for insert with check (bucket_id = 'wedding-audio' and public.is_admin());
create policy "admin update wedding-audio" on storage.objects
  for update using (bucket_id = 'wedding-audio' and public.is_admin());
create policy "admin delete wedding-audio" on storage.objects
  for delete using (bucket_id = 'wedding-audio' and public.is_admin());

create policy "admin upload wedding-videos" on storage.objects
  for insert with check (bucket_id = 'wedding-videos' and public.is_admin());
create policy "admin update wedding-videos" on storage.objects
  for update using (bucket_id = 'wedding-videos' and public.is_admin());
create policy "admin delete wedding-videos" on storage.objects
  for delete using (bucket_id = 'wedding-videos' and public.is_admin());

create policy "admin upload wedding-images" on storage.objects
  for insert with check (bucket_id = 'wedding-images' and public.is_admin());
create policy "admin update wedding-images" on storage.objects
  for update using (bucket_id = 'wedding-images' and public.is_admin());
create policy "admin delete wedding-images" on storage.objects
  for delete using (bucket_id = 'wedding-images' and public.is_admin());

-- Legacy buckets: same admin-only rules, kept for older deployments.
create policy "admin upload gallery" on storage.objects
  for insert with check (bucket_id = 'gallery' and public.is_admin());
create policy "admin update gallery" on storage.objects
  for update using (bucket_id = 'gallery' and public.is_admin());
create policy "admin delete gallery" on storage.objects
  for delete using (bucket_id = 'gallery' and public.is_admin());

create policy "admin upload audio" on storage.objects
  for insert with check (bucket_id = 'audio' and public.is_admin());
create policy "admin update audio" on storage.objects
  for update using (bucket_id = 'audio' and public.is_admin());
create policy "admin delete audio" on storage.objects
  for delete using (bucket_id = 'audio' and public.is_admin());

create policy "admin upload videos" on storage.objects
  for insert with check (bucket_id = 'videos' and public.is_admin());
create policy "admin update videos" on storage.objects
  for update using (bucket_id = 'videos' and public.is_admin());
create policy "admin delete videos" on storage.objects
  for delete using (bucket_id = 'videos' and public.is_admin());

-- Recommended upload limits (enforce in the Admin upload UI):
--   images: jpg / png / webp only, max 5 MB, compress before upload
--   audio:  mp3 / wav only,   max 15 MB
--   videos: mp4 / webm only,  max 25 MB — compress larger videos to
--           720p first (e.g. HandBrake) rather than failing silently
