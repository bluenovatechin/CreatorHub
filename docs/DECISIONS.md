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
