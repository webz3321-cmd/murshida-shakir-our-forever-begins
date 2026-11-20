# Murshida & Shakir — Our Forever Begins

Luxury interactive digital wedding invitation for **Murshida & Shakir**.

- **Wedding:** Sunday, 27 December 2026
- **Venue:** Janapriya Garden Hall, Mani
- **Heading:** “Two Souls, One Beautiful Journey”
- **Invitation:** “With the blessings of Allah and our beloved families, we invite you to celebrate the beginning of our forever.”

## What’s in this repo

A standalone Vite + React + TypeScript + Tailwind CSS app with Supabase as the backend:

- Full-screen envelope opening (3D flap, **OPEN INVITATION** button, sound only after the click)
- Hero, wedding details, live countdown (Asia/Kolkata, updates every second)
- Venue section — name + Google Maps *search* link only
- Gallery with masonry grid, lightbox, keyboard + swipe navigation
- Wedding-day timeline (starts empty — no timings invented)
- Islamic blessing (a general blessing, not presented as a Quran verse or Hadith)
- RSVP form with validation, duplicate prevention by phone, and a hashed edit token
- Floating music player (play/pause, mute, volume, single audio instance)
- Admin dashboard at `/admin` — real stats, RSVP search/filter/sort/pagination/CSV export, invitation editor, timeline editor, gallery & audio managers, settings toggles

> **This repo does NOT include the live Muse app’s RSVP data or uploaded media.** It is the standalone codebase only. Real photos, audio, RSVPs and analytics live in your own Supabase project once you connect it.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev            # http://localhost:5173
npm run build          # production build in dist/
```

Without Supabase configured, the site still renders: the gallery shows clearly labelled placeholder artwork, the timeline says timings are being finalised, and RSVPs are saved locally in demo mode (labelled as such in the UI). Connect Supabase to make RSVPs, admin and analytics real.

## Supabase setup

1. Create a project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/001_init.sql`, then `supabase/storage.sql`.
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
5. Upload real photos to the `gallery` bucket and audio (MP3/WAV) to the `audio` bucket, add rows to `gallery` / `audio_library`, and point `audio_settings` at the tracks you want. Add real wedding-day events in Admin → Timeline.

Row Level Security is in the migration: anonymous visitors can read public settings/gallery/events and insert an RSVP or an anonymous analytics event; only admins can read RSVPs, analytics or write settings. Guest phone numbers are never exposed publicly.

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
- Mobile-first, reduced-motion support, keyboard-accessible lightbox and forms.
