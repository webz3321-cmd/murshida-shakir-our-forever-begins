# Murshida & Shakir — Our Forever Begins

Luxury interactive digital wedding invitation for **Murshida & Shakir**.

- **Wedding:** Sunday, 27 December 2026
- **Venue:** Janapriya Garden Hall, Mani
- **Heading:** “Two Souls, One Beautiful Journey”
- **Invitation:** “With the blessings of Allah and our beloved families, we invite you to celebrate the beginning of our forever.”

## What’s in this repo

A standalone Vite + React + TypeScript + Tailwind CSS app with Supabase as the backend:

- Full-screen envelope opening — huge stacked **YOU ARE / INVITED** serif type, a blinking gold pointing finger above the **OPEN INVITATION** button, a 3D flap, sound only after the click
- **Qubba ring** — after the envelope opens, an Islamic-inspired ornamental ring (concentric champagne-gold rings, rotating geometric stars, a dome arc with finial, a golden light travelling the border) blooms full-screen with the couple’s names inside, then rests behind the hero names and fades with scroll parallax
- Premium scrolling — smooth scrolling, Intersection Observer section reveals, animated gold dividers, floating florals, reduced-motion support and an admin animations toggle
- Hero, wedding details, live countdown (Asia/Kolkata, updates every second)
- Venue section — name + Google Maps *search* link only
- **OUR BEAUTIFUL MOMENTS** — a cinematic gold-framed video section (play overlay, native controls with fullscreen/volume/progress, poster thumbnails, selectable film list), fed only by real admin uploads, with an elegant empty state when no video is published
- Wedding-day timeline (starts empty — no timings invented)
- Islamic blessing (a general blessing, not presented as a Quran verse or Hadith)
- RSVP form with validation, duplicate prevention by phone, and a hashed edit token
- Floating music player (play/pause, mute, volume, single audio instance)
- **Admin dot** — a tiny discreet champagne-gold dot, fixed at the bottom-right of every public page, opening a minimal ADMIN ACCESS modal. Sign-in is verified server-side by Supabase Auth; nothing about the passcode is stored in the code.
- Admin dashboard at `/admin` — sidebar with Dashboard (real stats incl. unique visitors and published videos), Invitation Editor, Wedding Details, Music Manager, Video Manager, RSVP Manager, Timeline, Countdown Settings, Theme & Design, Website Settings, Security & Passcode

> **The photo gallery has been completely removed** from this version and replaced by the video section. There is no gallery component, gallery route or gallery UI left in the code. The `gallery` table and bucket from migration 001 are kept only for backwards compatibility with older databases — nothing reads them.

> **This repo does NOT include the live Muse app’s RSVP data or uploaded media.** It is the standalone codebase only. Real videos, audio, RSVPs and analytics live in your own Supabase project once you connect it.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev            # http://localhost:5173
npm run build          # production build in dist/
```

Without Supabase configured, the site still renders: the video section shows its elegant empty state, the timeline says timings are being finalised, and RSVPs are saved locally in demo mode (labelled as such in the UI). Connect Supabase to make videos, RSVPs, admin and analytics real.

## Supabase setup

1. Create a project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/001_init.sql`, then `supabase/migrations/002_videos.sql`, then `supabase/storage.sql`.
3. In **Authentication → Users**, create an admin user, then in the SQL editor:
   ```sql
   insert into public.profiles (id, email, role)
   values ('<the-user-uuid>', 'you@example.com', 'admin');
   ```
4. Set the environment variables (never commit a real `.env`, never use a service-role key in the browser):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Upload wedding videos (MP4/WebM, max 25 MB) in Admin → Video Manager — or to the `videos` bucket in Supabase Storage and add rows to `wedding_videos`. Larger videos: compress to 720p first (e.g. HandBrake). Upload audio (MP3/WAV) to the `audio` bucket and point `audio_settings` at the tracks you want. Add real wedding-day events in Admin → Timeline.

Row Level Security is in the migrations: anonymous visitors can read public settings, published videos, events and audio and insert an RSVP or an anonymous analytics event; only admins can read RSVPs, analytics or write settings. Guest phone numbers are never exposed publicly.

### Admin access

- On the public site, tap the tiny gold dot at the bottom-right corner. It opens the ADMIN ACCESS modal; sign in with your Supabase Auth admin email and passcode. Supabase Auth verifies the credentials server-side and rate-limits repeated failed sign-ins.
- Or go straight to `/admin` and sign in there.
- Change your passcode in Admin → Security & Passcode (current passcode is verified server-side first). If you forget it, use Supabase Auth password recovery in the Supabase dashboard — there is no public reset link on this site. No passcode value is ever hardcoded or stored in this repo.

## Venue — please verify

The venue address has **not** been verified, so no address, coordinates or map pin are included anywhere in this repo. The Venue section shows “Janapriya Garden Hall, Mani” with a Google Maps search link, and an “address to be confirmed” note. Update `venue_address` in `wedding_settings` (and `src/lib/config.ts`) once the couple confirms it.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Import Project** → select the repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy. The admin route is `/admin` on the same deployment.

## Design

- Champagne Gold `#D6B56D`, Warm Ivory `#FFF9F0`, Cream `#F6EBDD`, Deep Brown `#49372F`, Soft Rose `#D9A6A0`
- Fonts: Cormorant Garamond (serif), Great Vibes (script), Jost (sans) via Google Fonts with `display=swap` and strong fallbacks, so the page paints even if fonts stall.
- Mobile-first, reduced-motion support, keyboard-accessible video controls and forms.
