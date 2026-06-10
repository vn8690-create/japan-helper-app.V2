# Deployment Guide — Japan Helper

## Architecture overview

| Layer | Service | Notes |
|---|---|---|
| Frontend (SPA) | Vercel | React + Vite, static build |
| Database + Auth | Supabase | Already provisioned |
| AI document analysis | Supabase Edge Function | `analyze-document` — already deployed |
| AI model | Google Gemini 2.5 Flash | Key stored as Supabase secret |

The Supabase backend (database + edge function) is already live. Only the frontend needs to be deployed to Vercel.

---

## Step 1 — Push code to GitHub (via Bolt UI)

Bolt cannot push to GitHub programmatically — it must be done through the Bolt editor interface.

1. Open this project in Bolt.
2. Click the **GitHub** icon in the top-right toolbar.
3. If this is your first time: click **Connect GitHub** and authorise StackBlitz/Bolt to access your account.
4. Click **Create repository** (or choose an existing one).
5. Give the repo a name, e.g. `japan-helper`.
6. Choose **Public** or **Private**.
7. Click **Push** — Bolt commits and pushes all project files.

Your repository URL will be: `https://github.com/<your-username>/japan-helper`

---

## Step 2 — Deploy to Vercel

### Option A — Import from GitHub (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Click **Import Git Repository** and find `japan-helper`.
3. Vercel detects the Vite framework automatically. Keep all build settings as-is:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Under **Environment Variables**, add:

   | Name | Value | Where to find it |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://ekocnvvlgiropmhmwfvd.supabase.co` | `.env` file / Supabase dashboard |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | `.env` file / Supabase dashboard → Settings → API |

5. Click **Deploy**. Vercel builds and publishes the site (usually < 60 seconds).

### Option B — Deploy from the Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
# Answer the prompts, then set env vars:
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod  # redeploy with env vars applied
```

### Option C — Manual upload (no GitHub needed)

1. Run `npm run build` locally to produce the `dist/` folder.
2. Go to [vercel.com/new](https://vercel.com/new) → **Deploy without Git**.
3. Drag and drop the `dist/` folder.
4. Add the two environment variables above.

> **Note:** `vercel.json` is already included in the project. It configures SPA routing (all paths → `index.html`) and sets caching headers for static assets.

---

## Step 3 — Verify the deployment

After Vercel finishes, visit your deployment URL and check:

- [ ] App loads without a blank screen
- [ ] Bottom navigation works (all 5 tabs)
- [ ] Dark mode toggle works
- [ ] Language switcher (EN / JA / VI) works
- [ ] **Scan Letters** tab — upload an image → confirm Gemini analysis returns results
- [ ] **Action Checklist** tab — items load from Supabase
- [ ] **Dashboard** tab — stats load correctly

---

## Supabase edge function

The `analyze-document` edge function is already deployed to Supabase and is **not** part of the Vercel build. It runs at:

```
POST https://ekocnvvlgiropmhmwfvd.supabase.co/functions/v1/analyze-document
```

Health check (GET):

```
https://ekocnvvlgiropmhmwfvd.supabase.co/functions/v1/analyze-document
```

If you ever need to redeploy it (after modifying `supabase/functions/analyze-document/index.ts`), use the Supabase MCP tool inside Bolt — do **not** use the Supabase CLI.

---

## Environment variables reference

| Variable | Required for | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | All database + edge function calls | Vercel (build + runtime) |
| `VITE_SUPABASE_ANON_KEY` | All database + edge function calls | Vercel (build + runtime) |
| `GEMINI_API_KEY` | Document analysis | Supabase secret (already set) |

`GEMINI_API_KEY` lives in Supabase and never touches Vercel — it is only read by the edge function at runtime.

---

## Custom domain (optional)

1. In the Vercel dashboard, open your project → **Settings** → **Domains**.
2. Add your domain and follow the DNS instructions (CNAME or A record).
3. Vercel provisions a TLS certificate automatically.

---

## Continuous deployment

Once GitHub is connected to Vercel, every push to the `main` branch triggers an automatic redeploy. Pull request previews are also created automatically for every PR.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page after deploy | Missing env vars | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel |
| Navigation links 404 on refresh | SPA routing not configured | Confirm `vercel.json` is in the repo root |
| "GEMINI_API_KEY not configured" error | Secret not set in Supabase | Set it in Supabase Dashboard → Edge Functions → Secrets |
| "Quota exceeded" from Gemini | API key needs billing enabled | Enable billing in Google Cloud Console for the project linked to the key |
| Supabase queries fail | RLS policy issue | Check Supabase Dashboard → Authentication → Policies |
