# Security

This document covers how Bluenova protects accounts **and** the data inside them, where each protection lives in the code, and what is still to do before real users join.

> **Golden rules**
> 1. **Never trust the browser.** Every rule is checked again on the server.
> 2. **Store as little as possible,** and never in readable form when we don't need to read it back.
> 3. **Show each person only what they need.**
> 4. **Record who did what.**

---

## 1. Accounts and login

| Threat | Protection | Where |
|---|---|---|
| Stolen database reveals passwords | Passwords are hashed with **argon2id** (OWASP settings: 19 MB memory, 2 passes). A hash can't be reversed, so **nobody can see a password, not even admins.** | `auth.service.ts` → `hashPassword` |
| Weak passwords | 8+ characters, letters **and** numbers, not a common password, not containing your name or email. The same rules apply in the browser and on the server. | `packages/shared/src/validators.ts` → `passwordProblem` |
| Guessing passwords | 5 wrong attempts per email in 15 min locks that email for 15 min (also for emails that don't exist, so lockouts reveal nothing). Plus per-network rate limits. | `auth.service.ts` → `registerLoginFailure`; `middleware/security.ts` |
| Finding out who has an account | Login says "incorrect email or password" for both cases. Signup and forgot-password reply identically whether or not the email exists. Unknown emails still take the time of a real password check (dummy hash). | `auth.routes.ts`, `verifyPassword` |
| Fake email addresses | Signup must be confirmed with a **6-digit code** sent to the inbox. Codes: random, valid 10 minutes, max 5 tries, single use, stored only as an HMAC, compared in constant time. Disposable email domains are refused. | `createEmailOtp` / `checkEmailOtp`; `isDisposableEmail` |
| Account pre-registration (someone signs up with *your* email first) | The account stays unverified and unusable. If you then sign up, a fresh code goes to **your** inbox, and **your** new password replaces theirs only after you enter it. | `POST /auth/signup` + `pending` on the ticket |
| Making yourself an admin | Signup has no role field; unknown fields are dropped. `/auth/role` only accepts `creator` or `brand`, and only once. Team accounts are created only by `seed:superadmin`. | `middleware/validate.ts`, `POST /auth/role` |
| Fake Google logins | Full-page redirect sign-in with a random **state** (checked by the returning tab, so nobody can push their sign-in into your tab) and **nonce** (inside the signed token, checked by the API, so old or stolen tokens can't be replayed). The token is verified with Google's keys: signature, expiry, and issued for **our** client id. Unverified Google emails are refused. Team emails can't use Google. Linking Google to an account whose email was never verified removes the password set before verification (it was never proven to belong to the owner) and ends other sessions. | `GoogleButton` / `GoogleCallbackPage`, `providers/google.ts`, `POST /auth/google` |
| Team account takeover | Team login is password **plus** an authenticator-app code (TOTP). Each code works once (replay blocked). The authenticator key is encrypted with AES-256-GCM. Admin sessions last 12 h. **Currently OFF for testing:** the code step runs only with `ADMIN_TOTP_REQUIRED=true` (default `false`; red warning bar, every password-only login audited). Set it to `true` before real use. | `/auth/admin/*`, `verifyTotp` |
| Lost authenticator phone | 10 one-time **recovery codes** (60 bits each, only SHA-256 fingerprints stored). Using one is audited and emailed. Making new codes or moving the authenticator to a new phone asks for the password again; a new authenticator only replaces the old one after a correct code from it, and logs out other devices. | `POST /auth/admin/recovery`, `admin/security.routes.ts` |
| Double clicks / retries doing money actions twice | `Idempotency-Key` replays the first answer; database unique rules (one deal per offer, one waiting payment per campaign, one application per campaign, one open dispute per deal) stop races even without a key. | `middleware/idempotency.ts`, `models/*` |
| Going around the platform (swapping phone numbers) | Creators and brands never message each other; each talks to the team only. Notes the other side can read (draft feedback) have phone numbers, emails and @handles hidden. The team reading a conversation is audited. | `modules/messages`, `maskContactDetails`, `serializers.ts` |
| Reset link abuse | Link valid 1 hour, works once, only the newest link works. The token sits in the `#` part of the URL (never sent to servers or logs). A rejected weak password doesn't burn the link. A reset logs out every device and emails the owner. | `password/forgot`, `password/reset`, `setPassword` |

## 2. Sessions (staying logged in)

| Threat | Protection |
|---|---|
| Malicious script steals the login | The **access token is kept only in memory** (never localStorage) and lasts 15 minutes. The **refresh token** is an **httpOnly** cookie (JavaScript can't read it), **Secure** (HTTPS only), **SameSite=Strict**, and limited to path `/api/v1/auth`. |
| Stolen refresh cookie | Rotated on every use. If an already-used cookie comes back (outside a 10-second window for parallel tabs), the whole login family is revoked: the thief and the victim are both logged out, and the victim logs in again. |
| Logged-out or suspended person keeps access | Every request re-checks the user's status and `tokenVersion` (cached up to 60 s). "Log out everywhere", password changes and suspension raise `tokenVersion`, so old tokens die immediately. |
| CSRF (another site making requests as you) | SameSite=Strict cookies, an exact-match CORS allow-list, and an **Origin check** on every state-changing request (required on cookie routes). |
| Token mix-ups | Separate JWT audiences for website, admin and the admin MFA step; HS256 only; issuer checked. |

## 3. Data protection

### 3.1 Who can see what (least privilege)
- **Replies are built from allow-lists** (`apps/api/src/modules/serializers.ts`, `users.routes.ts` → `accountView`). Raw database documents never reach a browser, so new secret fields can't leak by accident.
- **Brands never see** a creator's phone, email, payout or internal notes.
- **Creators never see** a brand's phone or Bluenova's margin.
- **Ownership checks:** creators and brands can only load **their own** profile, campaigns, offers, deals and notifications. Someone else's id returns **404** (not 403), so ids can't be probed.
- **Team roles:**
  - reviewer: creator reviews;
  - campaign_manager: campaigns and shortlists;
  - finance: payments;
  - super_admin: everything, including **Users** and the audit log.
  - The API enforces these (`requireAdmin`); the admin menu only hides buttons.
- **Admin → Users** (personal data of every account) is **super_admin only**. Opening an account is recorded in the audit log (`user.view`). Passwords are never shown; admins can only *set* a new one (audited, the user is logged out everywhere and emailed).

### 3.2 Data at rest
| Data | How it's stored |
|---|---|
| Passwords | argon2id hash (irreversible) |
| Refresh tokens, reset links, signup tickets | SHA-256 fingerprint only |
| 6-digit codes | HMAC fingerprint only |
| Admin authenticator keys | AES-256-GCM encrypted (`lib/crypto.ts`, keys in `DATA_ENCRYPTION_KEY(S)`, key rotation supported) |
| Everything else | MongoDB Atlas encrypts disks at rest; connections use TLS |
| Expired login data | Auto-deleted by MongoDB TTL indexes (refresh tokens at expiry, email tokens 1 h after, login counters after 2 h) |

### 3.3 Data in transit and in logs
- HTTPS everywhere in production. The API **refuses to start** with http URLs, `COOKIE_SECURE=false`, `*` or localhost CORS (`config/env.ts`).
- HSTS (2 years, preload), plus a strict Content-Security-Policy on both websites (`vercel.json`) and the API (`helmet`).
- **Logs never contain secrets.** `lib/logger.ts` → `REDACT_PATHS` blanks out passwords, hashes, tokens, codes, tickets, Google credentials, cookies, authorization headers and phone numbers. Error replies never include stack traces.
- Emails contain no personal details beyond what's needed (the code email holds only the code).

### 3.4 Input safety
- Every input is validated with zod (`validate()`): types, lengths, formats, and real-world checks (GSTIN check digit, PIN code ↔ state, plausible names and phone numbers, https-only links, Instagram URL formats).
- `express-mongo-sanitize` removes `$` operators (blocks NoSQL injection); `hpp` blocks duplicated query parameters; JSON bodies are limited to 100 kb.
- Search text is escaped before being used in a database search (`containsText` / regex escaping).
- React escapes everything it displays. Email HTML escapes user text (`renderHtml`, tested).
- External links open only if they are `https:`, with `noopener noreferrer` (`ExternalLink`).

### 3.5 Integrity of business data
- Status changes only through the state machines (`applyTransition`); invalid moves return 409.
- Multi-step changes (accept offer + create deal, choose role + create profile, verify payment + start deals) run in **database transactions**: all or nothing.
- Money is integer paise (no floating-point errors) and always calculated on the server.
- **Audit log:** admin decisions, shortlists, campaign starts, payments, settings, and user views, password sets and suspensions. It is append-only (edits and deletes blocked in code).

## 4. Secrets and configuration
- **Never commit or share:** `apps/api/.env`, `ADMIN_SECRET.txt` (git-ignored), the MongoDB URI, `JWT_ACCESS_SECRET`, `DATA_ENCRYPTION_KEY(S)`, SMTP, Brevo or Resend keys.
- `DATA_ENCRYPTION_KEY(S)` must be **identical** locally and on Render, and must be backed up somewhere safe. If it's lost, admin authenticators must be re-created with `seed:superadmin`.
- **If a secret leaks:**
  1. Rotate it (generate a new one, update `.env` and Render).
  2. For `JWT_ACCESS_SECRET`, rotating logs everyone out, which is fine.
  3. For a Gmail App password, revoke it in the Google account.
- **Atlas:** use a database user with readWrite on this database only, and keep Network Access to known IPs.

## 5. Before real users join (checklist)
- [ ] `TEST_MODE=false` on Render and a real email provider (`EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` + a verified `EMAIL_FROM`).
- [ ] Rotate every secret that was ever pasted into a chat or screenshot (Gmail App password, Resend key, admin password).
- [ ] Delete every `ADMIN_SECRET.txt` file.
- [ ] Atlas: paid tier or regular exports for **backups** (the free tier has none), and restrict Network Access.
- [ ] Own domain (`bluenovatech.in`) with `COOKIE_DOMAIN` set; the Google OAuth app moved to "In production".
- [ ] Move rate limits and the user cache to Redis before running more than one API instance.
- [ ] Consider field-level encryption for phone numbers and GSTIN (today they are protected by access rules and Atlas disk encryption, not encrypted per field).
- [ ] Error monitoring (e.g. Sentry) and log retention; a penetration test.

## 6. Reporting a problem
Found a security issue? Don't post it publicly. Tell the Bluenova team directly (+91 76002 36644), including the `requestId` from the error if there is one.
