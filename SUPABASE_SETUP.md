# Supabase setup — Murshida & Shakir wedding site

This is the complete, exact procedure to give the standalone wedding site a
real, working backend. **Nothing in this repo can do these steps for you:**
there is no Supabase project, URL or key in the code, and no credentials are
included anywhere. Until you complete the steps below, the site keeps
showing its honest "Supabase is not configured in this deployment yet"
message — that message is correct, not a bug, and it must never be hidden
by pretending a connection exists.

Total time: about 20 minutes. You need a free Supabase account and a free
Vercel account (only if you are deploying to Vercel).

## 1. Create a free Supabase project

1. Go to https://supabase.com and sign in (or create a free account).
2. Click **New project**.
3. Pick an organisation, give the project a name (for example
   `murshida-shakir-wedding`), set a strong database password (save it in
   your password manager — this is the Postgres password, not the admin
   sign-in), choose the region closest to your guests (for example
   Singapore / Mumbai), and click **Create new project**.
4. Wait for the project to finish provisioning (about 1–2 minutes).

## 2. Copy the two values the app needs

In the Supabase dashboard, open **Project Settings** (gear icon, bottom
left) → **API**.

Copy these two values — and only these two:

| Variable | Where it is in Supabase |
| --- | --- |
| `VITE_SUPABASE_URL` | Project Settings → API → **Project URL** (looks like `https://abcdefghijklm.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → **Project API keys** → **anon `public`** key (a long `eyJ…` token) |

Do **not** copy the `service_role` key. It must never be used in a browser
app and must never be committed to this repo. The app only ever uses the
anon key, and Row Level Security (below) limits what it can do.

## 3. Run the SQL files, in this exact order

In the Supabase dashboard, open the **SQL Editor** (left sidebar) →
**New query**, then paste the contents of each file and click **Run**.
Do them one at a time, in this order:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_videos.sql`
3. `supabase/migrations/003_complete.sql` — the consolidated migration.
   It is idempotent: it creates anything missing and is safe to re-run, and
   it also works on its own on a fresh project. Running all the files in
   order is still the recommended path.
4. `supabase/migrations/004_admin_passcode.sql` — passcode-only admin
   access (tables `admin_credentials` / `admin_sessions` and the
   token-checked `admin_*` functions). Safe to re-run.
5. `supabase/storage.sql` — creates the Storage buckets.

What these create:

- **Tables:** `profiles`, `wedding_settings` (single row, id = 1),
  `rsvps`, `gallery` (legacy only — the site no longer uses a gallery),
  `audio_library`, `audio_settings` (single row, id = 1), `wedding_videos`,
  `wedding_events`, `analytics_events`.
- **Storage buckets:** `wedding-audio`, `wedding-videos`,
  `wedding-images` (the ones the app uses), plus legacy `gallery`,
  `audio`, `videos` buckets kept for older deployments.
- **Row Level Security** on every table. Guests can read public settings,
  events, audio and *published* videos, and can insert an RSVP or an
  anonymous analytics event. Only admins can read RSVPs or analytics, or
  write settings, audio, videos or events. Guests can never read other
  guests' phone numbers or messages — there is no public SELECT policy on
  `rsvps`.

If a run reports an error, read it before re-running: the most common
cause is running a file twice without the `IF NOT EXISTS` guards (only
003, 004 and `storage.sql` are fully re-runnable) or running
`storage.sql` before the migrations (it needs the `public.is_admin()`
helper from the migrations).

## 4. Set your admin passcode — passcode only, no email, no Auth account

Admin access is a **passcode lock, not an email/password login**. There
is no Supabase Auth admin user to create, and no passcode value is
written anywhere in this repo — you choose your own passcode on first
use, and it is stored server-side only as a bcrypt hash
(`admin_credentials.passcode_hash`, migration 004).

1. Finish step 5 below first (env vars + redeploy), then open the live
   site and tap the **tiny gold dot** at the bottom-right corner.
2. The ADMIN ACCESS modal will say no passcode is set yet and show a
   **setup form**: enter your passcode (at least 4 characters) and
   confirm it, then tap **SET PASSCODE & UNLOCK**. That passcode is now
   the only way in — keep it private and do not share it.
3. From then on, the same gold dot (or going straight to `/admin`)
   asks only for that passcode: **"Enter your administrator passcode
   to continue."** A correct passcode issues a 12-hour session token;
   five wrong attempts lock verification for 5 minutes.
4. Change the passcode any time in **Admin → Security & Passcode**
   (current passcode first — changing it signs out every other admin
   session).

### If you forget the passcode

There is **no public reset** — anyone could use it. Only you, in the
Supabase dashboard, can reset it. Run this in the **SQL Editor**:

```sql
delete from public.admin_credentials where id = 1;
```

That deletes only the stored hash (not RSVPs, videos, audio or
settings). Then open the gold admin dot again: because no passcode
exists now, the setup form appears and you set a new passcode.

### Storage uploads — one honest limitation

All admin **database** reads and writes (settings, RSVP list/delete,
video/audio metadata, events, analytics) are protected by the
passcode session token, checked inside server-side functions
(migration 004). **Binary file uploads to Supabase Storage are the
exception in this pass:** the Storage bucket policies check
`public.is_admin()`, which needs a Supabase Auth JWT, so a
passcode-only browser session cannot upload a file directly to a
bucket. If a video/audio/poster upload is rejected, the Admin panel
says so plainly instead of failing silently. Do not relax the bucket
policies to "allow anyone to upload" to work around this — that would
let anyone fill your Storage. The proper fix is a server-side upload
proxy or Edge Function; until that exists, upload files through the
Supabase dashboard (Storage → the bucket → Upload) and then add the
video/audio row in the Admin panel with the file's public URL, or
keep a Supabase Auth admin account solely for uploads (it is never
used for the admin login UI).

## 5. Set the environment variables

### Local development

```bash
cp .env.example .env   # then fill in the two real values
npm install
npm run dev            # http://localhost:5173
```

Never commit the real `.env` (it is in `.gitignore`).

### Vercel (production)

1. In the Vercel dashboard, open your project → **Settings** →
   **Environment Variables**.
2. Add **both** variables, for the **Production** environment (tick
   Production; you can also tick Preview if you want preview deployments
   to connect):
   - Name: `VITE_SUPABASE_URL`, Value: the Project URL from step 2.
   - Name: `VITE_SUPABASE_ANON_KEY`, Value: the anon `public` key from
     step 2.
3. Go to **Deployments**, open the latest deployment's menu (⋯) and click
   **Redeploy**. Environment variables only take effect on a new
   deployment — changing them without redeploying changes nothing.
   (Vite bakes `VITE_*` variables into the build, so a redeploy is
   required, not just a restart.)

## 6. Verification checklist

After the redeploy, check each item on the live site. Do not call the
backend "done" until every item passes:

- [ ] The admin **Dashboard** shows **Supabase: Connected** (Admin →
      Dashboard, top card). "Not configured" means the env vars are not
      in the deployment; "Connection failed" shows the exact error.
- [ ] Admin sign-in works at `/admin` (or via the gold dot on the public
      site) with the passcode you set in step 4 — passcode only, no email.
      The first open shows the setup form; later opens ask only for the
      passcode.
- [ ] A test RSVP submitted on the public site appears in Admin → RSVP
      Manager, and the Dashboard counts move.
- [ ] Uploading a video in Admin → Video Manager (MP4/WebM, max 25 MB;
      compress larger videos to 720p first) and publishing it makes it
      appear in the public **OUR BEAUTIFUL MOMENTS** section and play.
- [ ] Uploading audio in Admin → Music Manager (MP3/WAV, max 15 MB) and
      selecting it as background music plays on the public site after
      opening the invitation.
- [ ] Editing the invitation in Admin → Invitation Editor and saving
      changes the public site after a refresh.
- [ ] **RLS blocks anonymous RSVP reads.** Test it in the Supabase SQL
      editor (this runs as the anonymous role, the same role the public
      site uses without a sign-in):
  ```sql
  -- As the anon role there is no SELECT policy on rsvps, so this must
  -- FAIL with "permission denied for table rsvps" even though RSVPs exist.
  -- That error is the proof: anonymous reads are blocked.
  set role anon;
  select count(*) from public.rsvps;  -- expect: permission denied
  reset role;
  -- And the public settings row must still be readable:
  set role anon;
  select bride_name, groom_name from public.wedding_settings where id = 1;
  reset role;
  ```
  If the first query ever returns a count or guest data instead of the
  permission-denied error, stop: RLS is not applied correctly and the
  migrations must be re-checked before sharing the site.

## If something still fails

| Symptom | Most likely cause |
| --- | --- |
| "Supabase is not configured" on the live site | Env vars are missing in Vercel, or you did not redeploy after adding them. |
| Admin Dashboard says "Connection failed" | Wrong Project URL / anon key, or the project is paused. The card shows the exact error. |
| Sign-in fails with "That passcode is not correct" | Wrong passcode, or migration 004 has not run. After 5 wrong attempts verification locks for 5 minutes — wait, then try again. |
| Admin unlocks but sees no data / cannot save | A migration was skipped (run 001–004 in order), or the admin session expired — unlock the panel again from the gold dot. |
| "Could not save — have you run migrations 001, 002, 003 and 004?" | A migration was skipped. Run them in order (step 3). |
| Video/audio upload fails | Bucket missing (run `storage.sql`), file over the size cap, or wrong format — or the Storage limitation in step 4: binary uploads still need a Supabase Auth session in this pass. The Admin error message says which. |
| Forgot the passcode | No public reset. Run `delete from public.admin_credentials where id = 1;` in the SQL Editor, then set a new passcode from the gold dot (step 4). |
