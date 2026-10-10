# AGENTS.md: project memory for AI coding tools

Read this first. It applies to every AI assistant (Claude Code, Cursor, Copilot, Codex, …) working on this repository.
The owner is a beginner developer. Explain changes in plain words and keep code easy to follow.

## What this project is
**Bluenova Creator Hub** is a managed marketplace between **brands** and **Instagram creators in Gujarat**.
- Bilingual: Gujarati (default) and English.
- **Creators:** sign up, choose "creator", fill a 5-step profile, and get reviewed by the Bluenova team. Once approved, they receive offers.
- **Brands:** sign up, choose "brand", add company details, and create campaigns. They receive a shortlist from the team, select creators, and offers go out.
- **Team (admins):** separate admin panel. Login is password + authenticator app. They review creators, build shortlists, start campaigns and manage users.

## Stack and layout (npm workspaces monorepo, TypeScript strict everywhere)
| Folder | What | Runs on |
|---|---|---|
| `apps/api` | Express 4 + Mongoose 8 + zod REST API (`/api/v1/*`) | Render (`bluenova-api.onrender.com`), local `:4000` |
| `apps/web` | React 18 + Vite + Tailwind + TanStack Query + react-i18next. Public site, creator area, brand area | Vercel, local `:5180` |
| `apps/admin` | React admin panel (English only) | Vercel, local `:5181` |
| `packages/shared` | zod schemas, enums, state machines, money/matching. **Used by API and frontends** | – |
| `packages/ui` | Design-system components + browser API client | – |
| `docs/` | All documentation (start at `docs/README.md`) | – |

## Commands (run from the repository root)
```bash
npm install             # once
npm run dev             # API + web + admin (needs apps/api/.env with a real MongoDB)
npm run dev:demo        # same, but an in-memory database with demo data (no setup needed)
npm test                # all tests (in-memory MongoDB, never sends real email)
npm run typecheck       # TypeScript for every package
npm run lint            # ESLint for every package (must show 0 errors)
npm run build           # production builds
```
**Before saying a change is done:** run `npm run typecheck`, `npm run lint` and `npm test`. All must pass (lint: 0 errors).

## Non-negotiable rules
1. **Never print, log, commit or paste secrets.**
   - Secrets include `.env` values, `ADMIN_SECRET.txt`, passwords, tokens, API keys and the MongoDB URI.
   - `.env` and `ADMIN_SECRET.txt` are git-ignored; keep it that way.
2. **Every API input goes through `validate()`** with a zod schema. Put form schemas in `packages/shared/src/schemas.ts` so the browser and the API use the same rules. Read input with `input(req)`, never `req.body`.
3. **Every protected route has three checks:**
   - `authenticate('app' | 'admin')` (logged in?)
   - `authorize(role)` or `requireAdmin(teamRole)` (allowed?)
   - an ownership filter (the logged-in user's own data only; anything else returns **404**).
4. **Never send raw database documents to the browser.** Build replies in `apps/api/src/modules/serializers.ts` (or a local `xxxView()` function) from an explicit list of fields.
   - Brands never see creator phone numbers or emails, or payouts and margins.
   - Creators never see brand phone numbers or margins.
5. **Status changes only through `applyTransition()`** (state machines in `packages/shared/src/stateMachines.ts`).
6. **Money is integer paise.** ₹1 = 100 paise. Convert with `rupeesToPaise` and `paiseToRupees`.
7. **Errors:** `throw new AppError('CODE', 'errors.someKey')`. The key must exist in `apps/web/src/i18n/en.json` **and** `gu.json` (same keys in both). Admin panel messages live in `apps/admin/src/lib.tsx` → `MESSAGES`.
8. **Admin actions and personal-data access** call `audit(req, 'thing.action', 'Entity', id, { reason })`. The audit log is append-only.
9. **Passwords:**
   - argon2id only. Never store, log or display a password or its hash.
   - Admins "set a new password"; they never "see" one.
10. **Tests must never send real emails.** `tests/setup-env.ts` forces `EMAIL_PROVIDER=console`.
11. **Don't weaken security to "make it work":**
    - no `*` CORS, no disabling rate limits or origin checks;
    - no tokens in localStorage (the access token stays in memory; the refresh token is an httpOnly cookie).

## Where things are (fast lookup)
- **Every endpoint:** `docs/API.md`. Every user flow with success and failure screens: `docs/FLOWS.md`.
- **Auth:** `apps/api/src/modules/auth/auth.routes.ts` (thin routes) and `auth.service.ts` (logic).
- **Admin user management:** `apps/api/src/modules/admin/users.routes.ts` with `apps/admin/src/pages/users/`.
- **Deal work (drafts → live posts):** `apps/api/src/modules/deals/deals.service.ts`; team queue `modules/admin/deals.routes.ts`.
- **Applications, messages, disputes/reports/ratings:** `modules/admin/applications.routes.ts`, `modules/messages/`, `modules/trust/` (+ `modules/admin/trust.routes.ts`).
- **Doing actions once:** `middleware/idempotency.ts` (server) and `useIdempotencyKey()` in `packages/ui` (browser).
- **Website routes:** `apps/web/src/App.tsx`. "Where does this user go?" is `homePathFor()` / `postLoginPath()` in `apps/web/src/lib/auth.tsx`.
- **Database collections:** `apps/api/src/models/*`, explained in `docs/DATA_MODELS.md`.
- **Environment variables:** `apps/api/src/config/env.ts` (validated at startup), explained in `docs/DEPLOYMENT.md`.

## Current product decisions (don't undo without asking)
- **Signup** asks only for name, email, password and acceptance of the terms, plus "Continue with Google".
  - Email signups verify a 6-digit code on the same page.
  - The **creator/brand choice comes after the first login** (`/welcome/role`, `POST /auth/role`). It is one-time.
- **Payments are switched off by default.** The team starts campaigns with "Start campaign" in the admin panel.
- **Email delivery:**
  - Locally it uses Gmail SMTP (Nodemailer).
  - Render's free plan blocks SMTP ports, so the live site needs `EMAIL_PROVIDER=brevo` (HTTPS API) or `TEST_MODE=true`.
- Admin accounts are created only with `npm run seed:superadmin`. There's no self-signup for the team.
- **Managed marketplace (decided 2026-10-10):**
  - Creators **apply** to campaigns; the **team** reviews applications and shortlists. Brands never see applications.
  - Creators and brands **never message each other**; each talks to the team only (`/conversations`).
  - Ratings are **team-only** for now (a creator sees their own average).
  - Resolving a dispute never moves money automatically; finance settles refunds/payouts outside the website.
  - **No public campaign list.** Campaigns are visible only to approved, logged-in creators.
  - **Pricing page shows no numbers.** Payments stay switched off; no payment gateway.
- **Formats (2026-10-10): Reel, Story and Collab only** (`DELIVERABLE_TYPES`). Collab = one post on both the creator's and the brand's account, only if both agree. Older formats (`LEGACY_DELIVERABLE_TYPES`) stay readable on old records but can't be chosen.
- **Cities:** `CITIES` in `packages/shared/src/catalog.ts` lists all Gujarat district HQs, municipal corporations and main towns. Never rename/remove a key (stored in the database). Creators and brands also choose several **areas**.
- **Terms:** signup and the creator/brand agreements use `TermsBox` (apps/web/src/components/TermsBox.tsx): the tick unlocks only after scrolling to the end. "Continue with Google" is always available on signup (the page states that continuing means accepting the Terms); the tick is only for the email + password form.

## Gotchas
- **Dev proxy:** the dev servers proxy `/api` to `http://localhost:4000`. To try the deployed API locally, set `API_PROXY_TARGET`.
- **Atlas access:** MongoDB Atlas blocks unknown IPs (Network Access). The API retries and prints how to fix it.
- **Encryption keys:** `DATA_ENCRYPTION_KEY(S)` must be identical locally and on Render, or admin authenticator keys can't be decrypted.
- **Caches:** the user cache (`lib/userCache.ts`) keeps role/status for 60 s. Call `invalidateUser(id)` after changing them.
- **`validate()`** can be used more than once on a route. Its results are merged.

## Writing style for this repo
- Every file starts with a header comment: what it is, who uses it, what it calls. Keep it accurate when you change the file.
- Comment the *why*, in plain English, for anything non-obvious.
- Follow `docs/CODING_STANDARDS.md` (naming, folder rules, how to add an endpoint or page).
- Record notable decisions in `docs/DECISIONS.md`.
