# Bluenova Creator Hub

**A managed platform connecting brands with Instagram content creators in Gujarat.**
Creators apply and are reviewed by the Bluenova team. Brands post campaign requirements and receive a curated shortlist of verified creators. Bluenova manages every collaboration from brief to delivery. The whole site works in **Gujarati and English**.

> Status: **testing / pre-launch.** Not yet deployed.

---

## Features

### For creators
- Email + password sign-up with email verification, forgot/reset password
- 5-step onboarding: profile & WhatsApp number → categories (16) → best 2–3 reels → stats & prices → review & submit
- Application status timeline. On approval: **Official Creator Partner** badge and the **intro-reel brief** (Gujarati script with the creator's name filled in, plus a shooting checklist)
- Opportunities feed, offers (accept / decline), collaborations list, notifications

### For brands
- Company onboarding with real-world validation (GSTIN check digit, GSTIN state, PIN code ↔ state)
- 6-step campaign wizard: goal, creator filters (category, city, language, audience size…), content, timeline, budget
- Curated shortlist from Bluenova: creator cards with stats and reels, without contact details. Select creators and offers go out.

### For the Bluenova team (admin panel)
- Login with email + password **and** an authenticator-app code
- Work-queue dashboard, creator review (claim → scores → approve / request changes / reject)
- Campaign claiming, **match score** ranking, shortlist builder with automatic margin pricing
- "Start campaign" once creators accept. Payments are arranged outside the website while the payment feature is switched off.
- Read-only audit log of every admin action
- Feature switch: in-website manual payments (bank transfer / UPI with UTR verification) are built in but **off by default**

### Security highlights
- Passwords hashed with **argon2id**; login lockout after repeated failures; identical errors for unknown emails and wrong passwords
- Short-lived access tokens kept in memory and rotating refresh tokens in **httpOnly, SameSite=Strict** cookies, with reuse detection
- Role + ownership checks on every API route; role-specific responses (brands never receive creator phone numbers, emails or payouts)
- Server-side validation of every form (shared schemas with the browser), status-flow rules, rate limits, security headers, an append-only audit log
- See [docs/BLUENOVA_AI_BUILD_PROMPT.md](docs/BLUENOVA_AI_BUILD_PROMPT.md) for the full specification

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend (website + admin) | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, react-i18next |
| Backend | Node.js 20+, Express, TypeScript, Mongoose, zod |
| Database | MongoDB Atlas (free tier works for testing) |
| Monorepo | npm workspaces |
| Tests | Vitest, Supertest, mongodb-memory-server |

## Project structure

```
bluenova-creatorhub/
├── apps/
│   ├── api/        Express API (auth, creators, brands, campaigns, offers, deals, admin, payments)
│   ├── web/        Public website + creator area + brand area (Gujarati / English)
│   └── admin/      Bluenova team panel (separate app)
├── packages/
│   ├── shared/     Validation rules, statuses, money & matching logic — used by all apps
│   └── ui/         Shared React components, design tokens, browser API client
└── docs/           Specification, client proposal, decisions log
```

---

## Running it locally

**Requirements:** Node.js 20 or newer.

```bash
npm install
```

### Option A: demo mode (no database setup)
```bash
npm run dev:demo
```
- Uses a temporary in-memory database: **everything resets when you stop it**.
- Website: http://localhost:5180 · Admin: http://localhost:5181
- Admin login: `admin@bluenova.dev` / `Demo-Admin-2026`, then the authenticator code (the key is printed in the terminal).
- Email links (verification, password reset) are printed in the terminal.

### Option B: your MongoDB Atlas database
1. Copy `apps/api/.env.example` to `apps/api/.env` and fill in `MONGODB_URI` and the secrets (instructions are inside the file). **Never commit `.env`.**
2. In Atlas → **Network Access**, add your current IP address. Mobile internet changes it often; if the API can't connect, the terminal tells you.
3. Create your admin account (the login details are written to `ADMIN_SECRET.txt`; delete it after setup):
   ```bash
   npm run seed
   npm run seed:superadmin -- --email you@example.com --name "Your Name" --out ADMIN_SECRET.txt
   ```
4. Start everything:
   ```bash
   npm run dev
   ```

### Real emails (optional)
By default email links are printed in the terminal. To send real emails through Gmail, set in `apps/api/.env`:
```
EMAIL_PROVIDER=smtp
SMTP_USER=your.sender@gmail.com
SMTP_PASS=your 16-letter Google App password
```
Then test with `npm run email:test -- --to you@example.com`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + website + admin with hot reload |
| `npm run dev:demo` | Same, on a temporary in-memory database with demo data |
| `npm test` | All automated tests |
| `npm run typecheck` | TypeScript checks for every package |
| `npm run build` | Production builds of all apps |
| `npm run seed` | Creates default settings in the database |
| `npm run seed:superadmin -- --email … --name …` | Creates / resets a super admin |
| `npm run email:test -- --to …` | Sends one test email with the current settings |

---

## Hosting (later)

The structure is ready for **Render** (API) + **Vercel** (website and admin):

| App | Host | Root directory | Build command | Start / output |
|---|---|---|---|---|
| API | Render (Web Service) | repository root | `npm ci && npm run build -w @bluenova/api` | `npm run start -w @bluenova/api` |
| Website | Vercel | `apps/web` | `npm run build` | `dist` |
| Admin | Vercel | `apps/admin` | `npm run build` | `dist` |

Before going live:
- Point `/api` on both Vercel sites to the Render API (a rewrite in each app's `vercel.json`), so login cookies stay first-party.
- Set the production environment variables on Render (`NODE_ENV=production`, `COOKIE_SECURE=true`, `CORS_ORIGINS`, `APP_BASE_URL`, `ADMIN_BASE_URL`, real email settings).
- Add Render's outbound IP addresses in Atlas → Network Access.

The API refuses to start in production if any of these settings are unsafe.

---

## Documentation
- [docs/DECISIONS.md](docs/DECISIONS.md): decisions, simplifications and what's next
- [docs/BLUENOVA_AI_BUILD_PROMPT.md](docs/BLUENOVA_AI_BUILD_PROMPT.md): full product & security specification
- Privacy Policy and Terms of Use are on the website at `/privacy` and `/terms`

## Contact
**Bluenova Creator Hub** · 📞 +91 76002 36644 · 🌐 [bluenovatech.in](https://bluenovatech.in)

© 2026 Bluenova Creator Hub. All rights reserved. This is private, proprietary software.
