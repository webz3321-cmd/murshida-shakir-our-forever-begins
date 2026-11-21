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
   it also works on its own on a fresh project. Running all three in order
   is still the recommended path.
4. `supabase/storage.sql` — creates the Storage buckets.

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
003 and `storage.sql` are fully re-runnable) or running `storage.sql`
before the migrations (it needs the `public.is_admin()` helper from the
migrations).

## 4. Create the admin user and give them the admin role

The admin sign-in is Supabase Auth (email + password). **You choose the
password yourself in Supabase — no password is written in this repo, and
no initial password is set by the code.**

1. In the Supabase dashboard, open **Authentication → Users** → **Add user**
   → **Create new user**.
2. Enter the admin email address and choose a strong password. Leave
   **Auto Confirm User** on, and click **Create user**.
3. On the user row, copy the user's UUID (click the user to see it).
4. Open the **SQL Editor** → **New query** and run, replacing the
   placeholders with the real values from step 3:
   ```sql
   insert into public.profiles (id, email, role)
   values ('<the-user-uuid-from-step-3>', 'you@example.com', 'admin')
   on conflict (id) do update set role = 'admin';
   ```
5. That user — and only that user — can now sign in to `/admin` and manage
   the site. Anyone else who somehow signs in stays a `guest` and sees
   nothing admin-only.

If you forget the admin password later, use Supabase Auth password
recovery (Authentication → Users → the user → **Send password reset
email**). There is no public password-reset link on the wedding site.

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
      site) with the email and password from step 4.
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
| Sign-in fails with "Invalid login credentials" | Wrong email/password, or the user was not created / not confirmed in Supabase Auth. |
| Admin signs in but sees no data / cannot save | The `profiles` row is missing or its role is not `admin` (step 4). |
| "Could not save — have you run migrations 001–003?" | A migration was skipped. Run them in order (step 3). |
| Video/audio upload fails | Bucket missing (run `storage.sql`), file over the size cap, or wrong format — the Admin error message says which. |
