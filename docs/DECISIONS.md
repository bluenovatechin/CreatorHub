# Decisions log

Record every deviation from `BLUENOVA_AI_BUILD_PROMPT.md` and every assumption here.

## 2026-10-08: first build (Phase 0 + core of Phase 1)

### Tooling and infrastructure
- **npm workspaces instead of pnpm and Turborepo.** pnpm isn't installed on the development machine. The workspace layout is the same, so switching later is mechanical.
- **No Docker locally.** Docker isn't installed. Development uses MongoDB Atlas, or `npm run dev:demo`, which runs an in-memory replica set (mongodb-memory-server). Tests use the same in-memory replica set.
- **No Redis yet.**
  - Rate limits use the in-process memory store.
  - The user status cache is in-process, with a 60-second TTL.
  - Offer expiry runs on an in-process interval.
  - All three must move to Redis/BullMQ **before running more than one API instance** (spec §18).
- **Dev ports 5180 (web) and 5181 (admin)** instead of 5173 and 5174, because other apps on the development machine already use those ports.
- **The Vite dev proxy serves `/api`**, so in development the API is same-origin and the SameSite=Strict cookies behave as they will in production on `*.bluenovatech.in`.

### Product defaults (spec §35; client confirmation pending)
- Fully managed matching: brands only see Bluenova's shortlist.
- Hidden margin: the default margin is 25% (`Settings.defaultMarginBps`), and the suggested brand price is rounded up to ₹100.
- Offers expire after 48 hours.
- Offer deadlines:
  - The draft is due 7 days after the campaign start date, or on the end date if that comes sooner.
  - The live post is due on the campaign end date.
- Rejected creators can reapply after 90 days.
- The intro reel deal is created automatically on approval. Its draft is due in 7 days and the live post in 14 days.
- Barter deals currently also wait in `AWAITING_PAYMENT`. The "product shipped, skip payment" path comes with Phase 2 payments.

### Simplifications for now (planned work, not shortcuts on security)
- **Catalog:** categories and cities are constants in `packages/shared`, not admin-editable DB collections yet.
- **Admin UI language:** the admin panel is English only for now.
- **Idempotency:** the `Idempotency-Key` header isn't implemented yet. Duplicate actions are currently prevented by the state machines: a second accept or submit returns 409.
- **Email:** brand email verification links aren't built yet (`emailVerified` stays false).
- **Captcha:** Turnstile isn't wired yet. OTP abuse is limited by per-phone and per-IP limits, a 30-second cooldown and phone lockout.
- **Messaging:** WhatsApp, SMS and email delivery isn't wired yet; notifications are in-app only. In development, OTPs print to the console. The console provider is refused in production.
- **Admin team:** admin invites aren't built yet. Admins are created with `npm run seed:superadmin`.
- **Approved creators:** they can't edit their profile yet. The `pendingChanges` re-review flow is still to come.
- **Intro reel drafts:** uploads aren't built yet. The brief page tells creators to share drafts on WhatsApp for now.

### Security fixes found by tests
- **Refresh tokens:**
  - The parallel-tab grace window originally applied to tokens revoked for logout or theft.
  - Tokens now carry `revokedReason`, and only `rotated` tokens get the grace window.
  - A test covers "logged-out token can't be reused".

### Not yet done from the security checklist (spec §34)
- Cloudflare (WAF, Access in front of the admin app), the production CSP report-only trial, Sentry, log retention set-up, backups and a restore drill, and the penetration test. These are deployment-time tasks.

## 2026-10-08: email login, manual payments, redesign

### Login
- **Mobile OTP login replaced by email and password** (client request).
- Signup collects name, email, password and role (creator or brand), plus acceptance of the terms.
- Email verification is required before login. Links are single-use, put the token in the URL fragment, and expire after 24 hours.
- Forgot/reset password: single-use links that expire after 30 minutes. A reset logs out every device.
- Passwords use argon2id (OWASP parameters). Rules: 8+ characters, letters and numbers, not a common password, and not containing the user's name or email.
- Lockout: 5 failures per email in 15 minutes locks that email for 15 minutes (applies to unknown emails too, so lockouts reveal nothing). Error messages are identical for an unknown email and a wrong password.
- **Admins:** email and password, then an authenticator code. Created by `seed:superadmin --email`.
- **Phone numbers** are now contact fields only: creators give a WhatsApp number in onboarding and brands give a mobile number. Phones are never used for login and never shown to the other side.

### Payments
- **No payment gateway** (client request). Brands pay Bluenova by UPI, IMPS, NEFT, RTGS or cheque and submit the reference.
- Server-side checks:
  - the amount must exactly equal the server-computed total (subtotal + GST, CGST/SGST for Gujarat, IGST otherwise)
  - reference format per method
  - payment date not in the future and not older than 30 days
  - the same reference can't be reused
  - only one payment can be pending per campaign
- Finance verifies (deals move to IN_PRODUCTION, campaign to ACTIVE) or rejects with a reason (the brand can resubmit). All reviews are audited.
- Bank details are stored in Settings; only a super admin can edit them, and edits are audited. Brands can't submit payments until they are set.

### Validation of real-world details
- GSTIN check digit (mod-36), GSTIN state must match billing state, PIN code must belong to the billing state.
- Dummy phone numbers, placeholder names ("test", "asdf"), disposable email domains.
- Creator stats: at least 100 followers, engagement between 0.01% and 50%, average views at most 50× followers, at least one price or barter.

### Database migration
- The old unique `phone_1` index was dropped. Accounts created with phone OTP have no email and can't log in. Their test data was left in place.

### Email
- Development prints email links in the terminal. Production requires `EMAIL_PROVIDER=resend` (Resend API key, verified domain).

## 2026-10-08: payments switched off, legal pages, GitHub prep

- **Payments are hidden** (client request). There is a `Settings.paymentsEnabled` switch, **off by default**, toggled by a super admin in Admin → Settings and audited.
  - When off: all payment API routes return 404, the website shows nothing about payments, and status labels are neutral ("Starting soon", "Waiting to start").
  - After creators accept, a campaign manager presses **Start campaign** (`POST /admin/campaigns/:id/start`, audited). Deals move to IN_PRODUCTION and the campaign to ACTIVE.
  - When on: the manual bank/UPI payment flow from the previous entry applies, and "Start campaign" is refused.
- **Privacy Policy (`/privacy`) and Terms of Use (`/terms`)** were added, describing what the app actually collects and does.
  - English is the governing text; Gujarati readers see a plain-language summary.
  - The signup checkbox and footer link to them.
  - **The client's legal adviser should review them before launch.** A grievance officer name and email should be added once a business email exists.
- **Atlas free tier** is used for testing (client decision). It has no automatic backups, so revisit before real users.
- **API build** uses `tsup.config.ts` (bundles `@bluenova/shared`); `npm start` runs `dist/server.js`.
- `.gitignore` covers dependencies, builds, every `.env*` except `.env.example`, `ADMIN_SECRET.txt`, keys, logs and editor files.

## 2026-10-08: reset-link bug fix
- **Bug:** the reset link was used up before the new password was checked, so a password rejected on the server (for example, one containing the user's name) left the user with an "expired" link. Fixed: the link is checked without being used, the password is validated, and only then is the link consumed (atomically, still single-use).
- Reset links now last **1 hour** (was 30 minutes). Errors now say whether a link was already used or replaced by a newer email (`errors.linkUsed`) or has expired (`errors.linkExpired`).

## 2026-10-09: simpler signup, admin Users screen, docs and code standards

### Accounts
- **Signup asks only for name, email and password** (plus acceptance of the terms), or "Continue with Google".
- **"Creator or brand?" moves to after the first login** (`/welcome/role`, `POST /auth/role`).
  - Why: Google signups were stuck on the role question, and a shorter form is easier.
  - The choice is one-time. It's saved in a transaction together with the empty profile.
- **The email-code flow was made robust:**
  - A second tab (or Log in before verifying) no longer breaks the first tab's code page.
  - Signing up again with an unverified email sends a fresh code. The new name and password apply only after that code is entered, which protects against someone pre-registering your email.
- **Local development now talks to the local API.** Before, it sent requests to the deployed Render API, which ran old code and can't send Gmail. Set `API_PROXY_TARGET` to use another API.

### Admin → Users (super admin only)
- Lists every account with its profile summary, and opens one account in full.
- Actions: **set a new password** and **suspend / re-activate**. Each needs a reason, is audited, and logs the user out everywhere.
- Viewing an account is also audited.
- **Passwords are never displayed:** they are stored as argon2id hashes, which can't be reversed. Admins set a new password instead.

### Code standards
- Every source file has a header comment (what it is, who uses it, what it calls).
- The trickiest logic (sessions, codes) has step-by-step comments.
- New docs: `docs/README.md` (index), ARCHITECTURE, FLOWS, API, DATA_MODELS, SECURITY, DESIGN, TESTING, CODING_STANDARDS, DEPLOYMENT. Root `AGENTS.md` / `CLAUDE.md` give AI tools the rules.
- Leftovers from phone-OTP login and verification links were removed.
- `sendInBackground()` moved to `providers/email.ts`, and `setPassword()` to `auth.service.ts`, so they can be reused.
- `validate()` now merges results when it's used twice on one route.
- More fields are redacted from logs: password hashes, tickets, Google credentials, code and token hashes.

## 2026-10-10: audit fixes (phases 1–4)

### Google sign-in on a never-verified account
- **Problem:** someone could sign up with another person's email and their own password, never verify it, and wait. When the real owner later used "Continue with Google", the account was linked and marked verified, and the stranger's password then opened it.
- **Fix:** when Google links to an account whose email was never verified, the API:
  - removes that password (the owner can set one with "Forgot password");
  - uses the name from Google;
  - cancels unused signup codes and tickets;
  - logs out every other session.
- Accounts that were already verified keep their password.
- Test: `auth.test.ts` → "a password set before the email was ever verified stops working…".

### Dependency fixes
- `npm audit fix` (no `--force`): updated `concurrently` and its `shell-quote` dependency (a critical advisory, dev tool only).
- **nodemailer 6 → 10** (high advisory). Only used for local Gmail SMTP. Our code needed no changes; the breaking changes (Node 20+, SES transport, error-code names, stricter TLS for remote attachments) don't affect us. `@types/nodemailer` was removed because nodemailer now ships its own types.
- Left for later, each needing its own phase:
  - vitest 2 → 5 (dev only)
  - tailwind 3 → 4 (build-time file matching only)
  - react-router 6 → 7 (open-redirect advisory, already blocked by `safeRedirect`)
  - `uuid` inside google-auth-library (only affects callers that pass a buffer; Google's library doesn't)

### Linting and formatting
- ESLint (flat config, `eslint.config.mjs`) with recommended JS + TypeScript rules and React Hooks rules. `npm run lint` must show **0 errors**; it is now part of "before saying a change is done".
- React Compiler hints (`static-components`, `set-state-in-effect`, `incompatible-library`) are warnings for now. Fixing them means restructuring pages, so they're fixed page by page.
- Prettier is configured to match the existing style (`.prettierrc.json`), but existing files were **not** reformatted, to avoid one huge diff. `npm run format:check` shows the difference.
- Small clean-ups the linter found: unused imports, a dead `|| ctx.defaultError`, starting values that were always overwritten, and explained `eslint-disable` lines where a rule is broken on purpose (control-character regexes).

### Database indexes in production
- Production connects with `autoIndex: false`, and nothing used to create indexes, so a fresh live database had no unique-email rule and no automatic clean-up of expired tokens.
- `ensureIndexes()` now runs once at production start-up. It only adds missing indexes and never drops anything. A collection whose data blocks an index (e.g. duplicate emails) is logged by name; the others are still built and the API keeps running.
- Test: `tests/indexes.test.ts`.

## 2026-10-10: phases 5–10

### Admin recovery codes (phase 5)
- 10 one-time codes per admin, `XXXX-XXXX-XXXX` from 32 unambiguous characters (60 bits). With that much randomness a plain SHA-256 fingerprint is safe to store, and the login check is one atomic database update (a code can't be used twice).
- `seed:superadmin` prints them. Settings → Security makes new ones or moves the authenticator to a new phone; both ask for the password again, are audited and emailed.
- Using a recovery code sends the admin to Settings → Security to set up the new phone.

### Doing important actions once (phase 6)
- Optional `Idempotency-Key` header on: submit payment, select shortlist, accept offer, start campaign, review payment. Same key + same body → the saved answer is replayed; different body → 409; failures are not saved.
- The browser makes the key from the page visit plus the request content, so a retry reuses it but a changed request gets a new one.
- New unique indexes with explicit names (an automatic name clashed with an existing index on payments): `one_deal_per_offer`, `one_submitted_payment_per_campaign`.

### Deliverables (phase 7)
- Links only (no file uploads): drafts are any safe https link, live posts must be Instagram post/reel links.
- Brand deals: creator → team (forward or send back) → brand (approve or ask for changes, limited by `maxRevisions`) → creator posts → team verifies → COMPLETED. Intro reels skip the brand.
- The brand only sees drafts the team forwarded and live posts the team verified. Notes between brand and creator have contact details hidden (`maskContactDetails`).
- A campaign becomes COMPLETED when no deal is still running and at least one was completed.

### Applications (phase 8): the team reviews them
- Creators apply with a pitch and optional price; campaign managers shortlist (creates the shortlist item, same price rules) or decline (the creator sees the note). Brands never see applications.

### Messages (phase 9): each side talks to the team only
- One conversation = one creator/brand + the team. Users see "Bluenova team"; the team sees which colleague replied. Reading a conversation is audited. 40 messages per 10 minutes.

### Disputes, reports, ratings (phase 10)
- Disputes pause a brand deal. Campaign managers resolve: CONTINUE (back to the exact earlier status) or CANCEL. The deal machine got these exits; because they would also allow the normal work routes to move a disputed deal, the work routes now refuse every action while a deal is DISPUTED (a test caught this).
- No money moves automatically on CANCEL (there is no payout system yet).
- Reports: only about things you actually deal with; one open report per target; the reporter is told it was reviewed, not what was done.
- Ratings: once per side after completion; team-only for now. The profiles' existing `ratingAvg`/`ratingCount` are updated in one atomic pipeline update; `completedDeals` now counts up.

### Translations
- New test `i18n.test.ts`: en/gu must have the same keys, and every error key the API sends must have a text (website or admin `MESSAGES`). Twelve missing website texts were added (including the older `errors.invalidJson`).

## 2026-10-10: upgrades, email outbox, lifecycle, public pages, cities, terms, formats

### Upgrades
- vitest 5, React Router 7, Express 5, google-auth-library 10, @vitejs/plugin-react 5, `npm dedupe`. Production dependencies: 0 known vulnerabilities. Left: Tailwind 3 build-time chain (fix needs Tailwind 4) and a low esbuild dev-server item.
- Express 5: `express-mongo-sanitize` and `hpp` (unmaintained) replaced by `middleware/sanitize.ts`, which **rejects** `$`/`.` keys, very deep JSON and repeated query parameters with 400 `errors.invalidInput`. Route paths can't use regex groups any more.
- Lesson: running dev servers must be restarted after `npm dedupe` (the admin panel showed a "Cannot find module …vite…" page until restarted; DEPLOYMENT §9).

### Notification emails (outbox)
- Important notifications are also emailed through an outbox (`models/emailJob.ts`, `jobs/emailOutbox.ts`): one email per notification (unique index), retries for temporary failures (1 min → 2 h, 5 tries), permanent failures recorded, daily cap `EMAIL_DAILY_LIMIT`. People can turn emails off (Settings). Super admins see an Email log.
- At-least-once: an email can repeat only if the server stops between the provider accepting it and it being marked sent.

### Collaboration lifecycle additions
- Deadline reminders (48 h before) and missed-deadline notices, each sent once; automatic brand-review approval after `brandReviewAutoApproveDays` (setting existed, now used).
- Team amendments to agreed terms are recorded on the deal (who, when, why, from → to); the team may cancel unfinished deals (new state-machine exit, campaign managers only).

### Creator, brand, public site
- Approved creators can update safe profile fields (identity stays locked) and see a completeness meter; stats are labelled self-reported everywhere.
- Brands: confirmation before sending offers and before submitting a campaign; copy campaign; paged list.
- Public: How it works, Pricing (no numbers), FAQ, Contact (stored for the team, spam trap, 5/hour); SEO basics; homepage numbers are counted from the catalog; the payment section is hidden while payments are off.

### Cities, areas, terms, formats (owner request)
- Full Gujarat city list (122 + "Other (Gujarat)", Mumbai, "Other (India)"), searchable pickers (`SearchSelect`, `SearchMultiSelect` in packages/ui) that highlight the typed text and work in English and Gujarati.
- Creators choose several areas they can make reels/stories in; brands choose several areas for promotions (default cities of new campaigns). Matching counts a creator's areas like their home city.
- Terms box: full terms (and the privacy policy on signup) in a scrollable box; the tick unlocks only after scrolling to the end. Terms updated (formats, messages/problems/ratings, automatic approval). `POLICY_VERSION` was not changed, so existing users are not asked to accept again; change it if you want everyone to re-accept.
- Formats: Reel, Story, Collab only. Collab = Instagram Collab post on both accounts, only with both sides' agreement. Older formats kept readable for existing data.

### Testing switches (owner request, 2026-10-10)
- `ADMIN_TOTP_REQUIRED=false` lets admins log in with the password alone while testing. Default stays `true`. While off: red warning bar in the admin panel, a warning in the server log at start, and an audit entry (`admin.login_without_totp`) for every such login. Password checks, lockouts and rate limits still apply. **Turn it back on before real use.**
- The admin panel reloads open pages every 15 s (only while the tab is visible) and when you return to the tab, so new user actions show up without pressing refresh. "Viewed" audit entries (conversation, enquiries, user page) are written at most once per 10 minutes per admin and record, so the auto-refresh doesn't flood the audit log.
