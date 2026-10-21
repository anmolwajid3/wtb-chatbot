# Deploy Opas on Fly.io (first-time guide)

This repo deploys as **three small containers**:

| App | Folder | What users open |
|-----|--------|-----------------|
| `opas-api` | `backend/` | API used by the chat widget |
| `opas-admin` | `admin-panel/` | Admin / company workspace |
| `opas-widget` | `widget/` | Visitor chat page |

Your **Postgres stays on Supabase** (already set up). Fly only runs the apps.

Default region in the configs is `ams` (Amsterdam, EU). Change it if you prefer another Fly region.

---

## 0. What you need before starting

1. A [Fly.io](https://fly.io) account (sign up with GitHub or email)
2. A credit card on Fly (required for paid machines; cost is usually low — see costs below)
3. Your **Supabase** `DATABASE_URL`
4. Your **OpenRouter** API key and model id
5. A computer with a terminal (Mac Terminal is fine)

Optional later: a custom domain from Cloudflare (~$10/year). You can use free `*.fly.dev` URLs first.

---

## 1. Install the Fly CLI (one time)

### Mac

```bash
brew install flyctl
```

If you do not use Homebrew:

```bash
curl -L https://fly.io/install.sh | sh
```

Then open a **new** terminal tab so `fly` is on your PATH.

### Log in

```bash
fly auth login
```

A browser window opens — approve it.

Check:

```bash
fly version
fly auth whoami
```

---

## 2. Deploy the API (`opas-api`)

```bash
cd backend
```

### First time only — create the Fly app

```bash
fly launch --copy-config --name opas-api --no-deploy
```

- Use the existing `fly.toml` when asked
- Say **No** to Postgres / Redis (you already use Supabase)
- `--no-deploy` means “create the app, don’t build yet”

If `opas-api` is taken, pick another name (e.g. `opas-api-anmol`) and use that name everywhere below.

### Set secrets (your real values)

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
  OPENROUTER_API_KEY="sk-or-..." \
  OPENROUTER_MODEL="anthropic/claude-3.7-sonnet" \
  OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
```

Optional Langfuse:

```bash
fly secrets set \
  LANGFUSE_PUBLIC_KEY="..." \
  LANGFUSE_SECRET_KEY="..." \
  LANGFUSE_HOST="https://cloud.langfuse.com"
```

### Deploy

```bash
fly deploy
```

Wait for the build. When it finishes:

```bash
fly status
fly open
curl https://opas-api.fly.dev/health
```

You want: `{"status":"ok"}`.

Your API base URL is:

```text
https://opas-api.fly.dev
```

(Replace with your app name if different.)

---

## 3. Point the widget at the live API

Edit `widget/config.js`:

```js
window.OPAS_API_URL = "https://opas-api.fly.dev";
window.OPAS_ADMIN_URL = "https://opas-admin.fly.dev";
```

Use **your** hostnames. No trailing slash.

You can also override per visit without editing the file:

```text
https://opas-widget.fly.dev/?company=your-slug&api=https://opas-api.fly.dev
```

---

## 4. Deploy the visitor widget (`opas-widget`)

```bash
cd ../widget
fly launch --copy-config --name opas-widget --no-deploy
fly deploy
```

Test:

```text
https://opas-widget.fly.dev/?company=YOUR_COMPANY_SLUG
```

The company slug is the one you set in the admin panel under Companies.

---

## 5. Deploy the admin panel (`opas-admin`)

```bash
cd ../admin-panel
fly launch --copy-config --name opas-admin --no-deploy
```

### Secrets

Use the **same** `DATABASE_URL` as the API. Pick a long random `SESSION_SECRET` (password manager or `openssl rand -hex 32`).

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
  SESSION_SECRET="paste-a-long-random-string-here" \
  SUPER_ADMIN_EMAIL="admin@gptlab.dev" \
  SUPER_ADMIN_PASSWORD="choose-a-strong-password" \
  BACKEND_URL="https://opas-api.fly.dev"
```

Optional — email login invites when an admin creates a staff user or coach portal account ([Resend](https://resend.com)):

```bash
fly secrets set \
  RESEND_API_KEY="re_..." \
  EMAIL_FROM="WTB <onboarding@your-verified-domain.com>" \
  APP_BASE_URL="https://opas-admin.fly.dev" \
  -a opas-admin
```

Required for company logos and coach image uploads (Supabase Storage):

1. In Supabase → **Storage** → create a **public** bucket named `company-logos`
   (and `coach-images` if you upload coach photos).
2. Project Settings → **API** → copy **Project URL** and **service_role** key.
3. Set them on Fly:

```bash
fly secrets set \
  SUPABASE_URL="https://YOUR_REF.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  -a opas-admin
```

### Deploy

```bash
fly deploy
```

Open:

```text
https://opas-admin.fly.dev/admin
```

Sign in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.

---

## 6. End-to-end smoke test

1. Admin → create/open a company → note its **slug**
2. Admin → Matching → set minimum match % if you want
3. Open widget: `https://opas-widget.fly.dev/?company=that-slug`
4. Send a short chat message
5. Admin → open that company → **Conversations / Logs** → you should see the chat

If logs are empty: the widget URL must include `?company=exact-slug`.

---

## 7. How you ship updates (“live in seconds/minutes”)

After you change code:

```bash
# API
cd backend && fly deploy

# Admin
cd admin-panel && fly deploy

# Widget (only if widget files / config.js changed)
cd widget && fly deploy
```

Fly builds a new container image and swaps it in. Typical time: about 1–3 minutes per app.

You can also install the [Fly GitHub Action](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/) later so every push to `main` deploys automatically.

---

## 8. Custom domain (optional)

Example: `api.yourdomain.com`, `app.yourdomain.com`, `chat.yourdomain.com`.

1. Buy a domain (Cloudflare Registrar is cheap)
2. For each Fly app:

```bash
cd backend
fly certs add api.yourdomain.com
```

3. Fly prints DNS records (usually a CNAME). Add them in Cloudflare DNS.
4. Wait until:

```bash
fly certs show api.yourdomain.com
```

shows the cert as ready.

5. Update `widget/config.js` to `https://api.yourdomain.com` and redeploy the widget.

Repeat `fly certs add` for admin and widget hostnames.

---

## 9. Costs (rough)

With the `fly.toml` defaults (`shared-cpu-1x`, auto-stop when idle):

| Piece | Typical |
|-------|---------|
| Three small Fly apps | often **~$5–15 / month** if they sleep when idle |
| Supabase | free tier or your existing plan |
| OpenRouter | pay per chat token (usually the largest variable) |
| Domain | ~$10 / year |

`min_machines_running = 0` means machines can stop when idle (first request after idle may take a few extra seconds to wake).

To keep the API always warm (slightly more cost):

```toml
# in backend/fly.toml
min_machines_running = 1
```

then `fly deploy` again.

---

## 10. Useful commands

```bash
fly apps list
fly status -a opas-api
fly logs -a opas-api
fly secrets list -a opas-api
fly ssh console -a opas-api
fly scale show -a opas-api
```

---

## 11. Common problems

**`/health` fails**  
Check `fly logs -a opas-api`. Usually a bad `DATABASE_URL` or missing OpenRouter key (key is only needed on `/chat`, not `/health`).

**Admin says database error**  
`DATABASE_URL` secret missing or different from the API’s. Supabase password special characters must be URL-encoded in the URI.

**Widget cannot reach API**  
- `config.js` still points at localhost or wrong host  
- Browser mixed content: page is `https` but API is `http` — always use `https` Fly URLs  
- Test override: `?api=https://opas-api.fly.dev`

**CORS**  
The API already allows all origins for the pilot. No extra CORS setup needed on Fly.

**App name already taken**  
Change `app = "..."` in that folder’s `fly.toml` and use the new name in `fly` commands.

**Deploy from wrong folder**  
Always `cd` into `backend`, `admin-panel`, or `widget` before `fly deploy` for that app.

---

## 12. Security checklist before sharing with real users

- [ ] Strong `SUPER_ADMIN_PASSWORD` and `SESSION_SECRET`
- [ ] Do not commit `.env` files
- [ ] Rotate OpenRouter key if it was ever pasted into chat/email
- [ ] Prefer custom domains + HTTPS (Fly provides HTTPS on `*.fly.dev` already)
- [ ] Confirm company status/credits so a public widget cannot run unbounded spend

---

## Quick reference — your URLs after deploy

```text
API:    https://opas-api.fly.dev
Admin:  https://opas-admin.fly.dev/admin
Widget: https://opas-widget.fly.dev/?company=YOUR_SLUG
```
