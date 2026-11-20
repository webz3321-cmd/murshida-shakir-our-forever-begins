-- Supabase Storage buckets for Murshida & Shakir.
-- Run in the Supabase SQL editor after migration 001.
-- Buckets are PUBLIC for reading (gallery photos / audio are meant to be
-- seen/heard by guests), but only signed-in admins may upload or delete.
-- Validate file type and size in the upload UI as well; Storage policies
-- alone do not check MIME types.

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true),
       ('audio', 'audio', true)
on conflict (id) do nothing;

-- Public read
create policy "public read gallery files" on storage.objects
  for select using (bucket_id = 'gallery');
create policy "public read audio files" on storage.objects
  for select using (bucket_id = 'audio');

-- Admin-only upload / update / delete.
-- (Uses the same public.is_admin() helper from migration 001.)
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

-- Recommended upload limits (enforce in the Admin upload UI):
--   images: jpg / png / webp only, max 5 MB, compress before upload
--   audio:  mp3 / wav only,   max 15 MB
