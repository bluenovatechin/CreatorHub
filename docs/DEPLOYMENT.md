# Setup & deployment

## 1. Run it on your computer
1. Install **Node.js 20+**, then run `npm install` in the project folder.
2. **Quickest (no database):** `npm run dev:demo`.
   - Website: http://localhost:5180 · Admin: http://localhost:5181.
   - Codes and links are printed in the terminal.
   - The demo admin login is printed too.
3. **With your Atlas database:**
   1. Copy `apps/api/.env.example` to `apps/api/.env` and fill it in (the table below explains each value).
   2. In Atlas → **Network Access**, add your current IP (mobile internet changes it often).
   3. Run `npm run dev`.
   4. If the terminal says it can't reach the database, fix Network Access. It retries by itself.

## 2. Environment variables (`apps/api/.env` locally, Render → Environment live)

| Variable | Example / default | What it does |
|---|---|---|
| `NODE_ENV` | `development` / `production` | Production turns on strict safety checks |
| `PORT` | `4000` | API port (Render sets it itself) |
| `MONGODB_URI` | `mongodb+srv://USER:PASS@…/bluenova_dev` | Database. **Secret.** |
| `CORS_ORIGINS` | `http://localhost:5180,http://localhost:5181` | Websites allowed to call the API (exact addresses) |
| `COOKIE_SECURE` | `false` locally, `true` live | HTTPS-only cookies |
| `COOKIE_DOMAIN` | empty (later `.bluenovatech.in`) | Cookie domain |
| `JWT_ACCESS_SECRET` | 64+ random characters | Signs login tokens. **Secret.** Changing it logs everyone out. |
| `DATA_ENCRYPTION_KEY` (or `DATA_ENCRYPTION_KEYS`) | base64 of 32 random bytes | Encrypts admin authenticator keys. **Secret, and must be the same locally and on Render.** |
| `APP_BASE_URL`, `ADMIN_BASE_URL` | `http://localhost:5180` / `:5181` | Used in email links |
| `EMAIL_PROVIDER` | `console` · `smtp` · `brevo` · `resend` | How emails are sent (see §4) |
| `ADMIN_TOTP_REQUIRED` | `true` (default) · `false` | `false` = admin login without the authenticator code. **Testing only**: a red bar warns in the admin panel and every such login is audited. Set back to `true` (or delete it) when testing is done. |
| `EMAIL_DAILY_LIMIT` | number, default `250` | Most notification emails per 24 h (Brevo free ≈ 300/day). Over the limit, emails wait. Codes and password emails are not counted. |
| `SMTP_USER`, `SMTP_PASS` | Gmail address + 16-letter App password | For `smtp`. **Secret.** |
| `BREVO_API_KEY` / `RESEND_API_KEY` | `xkeysib-…` / `re_…` | For `brevo` / `resend`. **Secret.** |
| `EMAIL_FROM` | `Bluenova Creator Hub <you@gmail.com>` | Sender (must be verified at Brevo/Resend) |
| `GOOGLE_CLIENT_ID` | `…apps.googleusercontent.com` | Shows "Continue with Google" (empty = hidden). Public value. |
| `TRUST_PROXY_HOPS` | `1` locally, `2` live | Number of proxies in front of the API (for correct visitor IPs) |
| `TEST_MODE` | `false` | `true` = live testing **without** email: accounts are auto-verified and a banner is shown |
| `LOG_LEVEL` | (unset) | `info` to see every request |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # DATA_ENCRYPTION_KEY
```

## 3. Hosting
| Part | Where | How it's configured |
|---|---|---|
| API | **Render**, free web service `bluenova-api` (Singapore) | `render.yaml` (Blueprint). Build: `npm ci --include=dev && npm run build -w @bluenova/api`; start: `npm run start -w @bluenova/api`; health check `/healthz`. Values marked `sync: false` are typed into the Render dashboard. |
| Website | **Vercel**, project root `apps/web` → `creator-hub-mu-five.vercel.app` | `apps/web/vercel.json`: install/build from the repo root, `/api/*` rewritten to Render, security headers |
| Admin | **Vercel**, project root `apps/admin` → `bluenova-admin.vercel.app` | `apps/admin/vercel.json` |
| Database | **MongoDB Atlas** free tier, database `bluenova_dev` | Network Access must allow Render (or 0.0.0.0/0 with a strong password while testing) |

**Database indexes:** locally (and in tests) Mongoose builds indexes automatically. On Render (`NODE_ENV=production`) that is switched off, so the API runs `ensureIndexes()` (`apps/api/src/db.ts`) once after connecting. It only **adds** missing indexes (unique email, unique tokens, automatic deletion of expired sessions, codes and login counters). It never deletes data or indexes. Render's log shows `database indexes checked` when all is well.

**Deploying:** push to `main` on GitHub, and Render and Vercel rebuild automatically.
```bash
npm run typecheck && npm run lint && npm test
git add . && git commit -m "Describe the change" && git push
```

## 4. Email on the live site
Render's **free plan blocks email ports**, so Gmail/Nodemailer (SMTP) works on your computer but **not** on Render. Choose one:
- **Brevo (recommended, free 300/day):**
  1. Create an account and verify your sender email.
  2. Create an API key.
  3. On Render set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY=…`, `EMAIL_FROM=Bluenova Creator Hub <your-verified@email>`, `TEST_MODE=false`.
- **Testing without email:** `TEST_MODE=true`, `EMAIL_PROVIDER=console`. Signup logs people straight in.
- **Paid Render plan:** then `EMAIL_PROVIDER=smtp` with Gmail works too.

Test locally with `npm run email:test -- --to you@example.com`.

**Checking the live site:** Admin panel → **Settings → Email delivery → Send test email**. It sends from the live server and shows Brevo's exact answer, plus how to fix it. Render's log also prints one `email settings` line at startup (provider, sender, test mode).

**Importing all settings at once:** `apps/api/.env.render` (git-ignored, secret) holds every production variable, built from your working local `.env`. In Render → Environment → **Add from .env**, paste its contents → **Save Changes**.

## 5. Continue with Google
1. In Google Cloud Console → **Google Auth Platform**:
   - set up the app (External);
   - while testing, keep it in **Testing** and add test users.
2. **Clients → Create client → Web application:**
   - **Authorized JavaScript origins:** `http://localhost:5180`, `https://creator-hub-mu-five.vercel.app`.
   - **Authorized redirect URIs:** `https://creator-hub-mu-five.vercel.app/auth/google/callback` and `http://localhost:5180/auth/google/callback`. Sign-in is a full-page redirect, not a pop-up, so blockers can't stop it.
3. Copy the Client ID into `GOOGLE_CLIENT_ID` in `apps/api/.env` **and** on Render.

## 6. Team (admin) accounts
```bash
npm run seed:superadmin -- --email you@example.com --name "Your Name" --out ADMIN_SECRET.txt
```
This creates or resets a super admin and writes the temporary password, the authenticator key and **10 one-time recovery codes** to the file.
1. Add the key to Google Authenticator.
2. Save the recovery codes somewhere safe that is NOT your phone (a password manager, or paper). Each one logs you in once if you lose the phone.
3. Log in, then change the password in admin Settings. (Settings → Security can make new recovery codes or move the authenticator to a new phone.)
4. **Delete `ADMIN_SECRET.txt`.**

On Render, use the Shell: `npm run seed:superadmin:prod -w @bluenova/api -- --email …`.

## 7. Troubleshooting
| Symptom | Likely cause → fix |
|---|---|
| "Can't reach the API server" | The API isn't running, or the database is blocked → check the terminal / Atlas Network Access |
| Live site: "Can't reach the Bluenova server" or the first click takes a minute | The free Render server slept after 15 min without visitors. `.github/workflows/keep-api-awake.yml` pings it every 10 min (GitHub → Actions shows the runs). The website also waits and retries page data while it wakes, and shows a "starting the server" note on login/signup. |
| Signup code never arrives (live) | Render blocks SMTP → use Brevo or `TEST_MODE` (§4) |
| 403 on every action (live) | `CORS_ORIGINS` on Render doesn't contain the exact Vercel address |
| Admin authenticator code always wrong | The phone's clock is off, or an old key is in the app → re-run `seed:superadmin` and re-add the key; `DATA_ENCRYPTION_KEY` must match |
| Google button missing | `GOOGLE_CLIENT_ID` is empty on the API |
| Render log: `some database indexes could not be created` | Existing data breaks a rule, usually two accounts with the same email. The log names the collection and reason. Fix the data in Atlas (ask before deleting anything); the index is built on the next restart. |

## 8. Search engines and the website address
- `apps/web/public/robots.txt` and `apps/web/public/sitemap.xml` contain the current website address (`creator-hub-mu-five.vercel.app`). **When the website moves to its own domain, change the address in both files.**
- Private areas (creator/brand dashboards, login screens) are marked `noindex` (`apps/web/src/lib/seo.ts`).

## 9. After updating packages: restart the dev servers
If `npm install` / `npm dedupe` ran while `npm run dev` was running, a dev server may keep pointing at files that moved (the admin panel then shows an error page like "Cannot find module …vite…"). Fix: stop it with **Ctrl + C** and run `npm run dev` again.

