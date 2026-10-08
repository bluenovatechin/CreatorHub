# BUILD SPEC: Bluenova Creator Hub (MERN, TypeScript)

You are a senior full-stack engineer and security engineer. Build the complete, production-ready web platform described below. This document is the single source of truth. Read all of it before writing any code.

---

## 0. Working rules (follow strictly)

1. **Build in the phase order in §33.** Finish each phase completely (code, tests, docs) before starting the next. At the end of each phase, run lint, type-check and all tests, and report the results.
2. **Never weaken security to make something work.** No `TODO: add auth later`. No disabled validation, `cors('*')`, logged secrets, or skipped tests. Every security rule in this spec is a requirement, not a suggestion.
3. **No real secrets in code.** Everything comes from environment variables, validated at boot (§8). Commit `.env.example` only.
4. **Every external service goes behind an adapter interface** with a real implementation and a dev/fake implementation (§6.2), so the whole app runs locally without third-party credentials. Dev/fake providers **must refuse to start when `NODE_ENV=production`**.
5. **Where something is ambiguous, use the defaults in §35** and record every assumption in `docs/DECISIONS.md`. Don't stop to ask unless something is truly blocking.
6. **Use only the dependencies listed in §6.** If you need another one, justify it in `docs/DECISIONS.md` (maintained, widely used, no known high CVEs).
7. **Write tests alongside features**, not at the end (§30).
8. **Keep `README.md` current:** setup, scripts, env vars, architecture overview, and how to run each app.
9. **TypeScript `strict: true` everywhere.** No `any` unless justified in a comment. ESLint + Prettier.
10. **Show money as Indian Rupees and store it as integer paise.** Never use floats for money. Store dates in UTC and display them in `Asia/Kolkata`.
11. **All UI text goes through i18n** (Gujarati + English). Never hard-code user-facing strings in components.

---

## 1. Product summary

**Bluenova Creator Hub** is a managed marketplace that connects **brands** with **content creators (Instagram influencers)**, mainly in Gujarat, India, for paid promotional content (reels, posts, stories).

- **Creators** apply, get reviewed by the Bluenova team, become "Official Creator Partners", receive collaboration offers, deliver content and get paid.
- **Brands** post a requirement describing the kind of creators they want, receive a curated shortlist from Bluenova, select creators, pay securely, approve content and see results.
- **Bluenova (admin team)** reviews creators, matches them to brands, sets prices, moderates content, holds brand payments until delivery, and releases creator payouts.

**Business model (default):** the brand pays one all-inclusive **brand price** per creator deal. The creator sees only their **creator payout**. **Margin = brand price − creator payout** is internal and visible only to admins. GST is added on top of the brand price.

**Managed model:** brands and creators **never** see each other's phone numbers or emails. All communication goes through the platform, and payments always go through Bluenova.

Contact details shown on the site: **📞 +91 76002 36644 · 🌐 bluenovatech.in**

---

## 2. Users and roles

| Role | Sub-role | Description |
|---|---|---|
| `creator` | — | Content creator / influencer |
| `brand` | — | Business promoting a brand or product |
| `admin` | `super_admin` | Everything, including team, settings, CMS and audit logs |
| `admin` | `reviewer` | Reviews creator applications and profile changes |
| `admin` | `campaign_manager` | Campaigns, matching, shortlists, offers, deals, content moderation, disputes |
| `admin` | `finance` | Payments, invoices, refunds, payouts, KYC reveal, tax exports |

One user has exactly one role. Admin accounts can **only** be created by invitation from a `super_admin`. The first super admin is created with a CLI seed script (`pnpm --filter api seed:superadmin`).

---

## 3. Source content (use verbatim in the UI and seed data)

### 3.1 About and joining process (public site, "For Creators" page)

```
Bluenova Creator Hub brands અને creators વચ્ચે collaboration માટેનું platform છે. 🤝

જો તમે Creator છો અને તમારા content ને showcase કરવા તથા future brand collaborations મેળવવા માંગો છો, તો તમે અમારી સાથે connect કરી શકો છો.

Collaboration માટે Process 👇
1. તમારી Instagram Profile મોકલો
2. તમારી Category જણાવો
3. તમારી Best 2–3 Reels મોકલો
4. અમે તમારું Content & Profile Review કરીશું
5. Suitable લાગશે તો અમારી Page સાથે Collab કરીશું અને future brand requirements સાથે match થશે ત્યારે તમને contact કરીશું. 🚀

અમારી મુખ્ય Categories:
Business • Marketing • Tech • Finance • Real Estate • Food • Fashion • Beauty • Health • Fitness • Travel • Education • Automobile • Home & Interior • Local Business • Entertainment

તમારી category પ્રમાણે તમારી best Reels મોકલી શકો છો. 😊
```

### 3.2 Intro reel brief (shown in the creator's "Intro Reel" task, editable from the admin CMS)

```
Hi! 👋
અમે તમને Bluenova Creator Hub સાથે Official Creator Partner તરીકે introduce કરવા માટે એક short introduction reel બનાવડાવવા માંગીએ છીએ. 🎥✨

🎬 Reel Concept
આ reelમાં તમારે તમારા audience ને naturally જણાવવાનું છે કે તમે હવે Bluenova Creator Hub સાથે જોડાયા છો અને હવે brands સાથે collaboration opportunities માટે તમે Creator Hubના networkનો ભાગ છો.

🗣️ Script
"Hi everyone! હું છું {{name}} 👋
અને હવે હું officially Bluenova Creator Hub સાથે Creator Partner તરીકે જોડાઈ {{joinedVerb}} છું. ✨
હવે brands અને creators વચ્ચે meaningful collaborations માટે હું Bluenova Creator Hub સાથે કામ કરીશ.
જો તમે પણ તમારા brand સાથે collaboration કરવા માંગતા હો, તો stay connected with Bluenova Creator Hub. 🚀"

📱 Shooting Instructions
* Reel vertical 9:16 માં shoot કરવી
* Video clean અને well-lit રાખવો
* Background simple અને professional રાખવો
* Cameraમાં જોઈને naturally બોલવું
* વધારે formal અથવા scripted feel ન આવે
* Video approximately 10–15 seconds રાખવો
* જો તમારા content મુજબ કોઈ creative style હોય તો એ પણ use કરી શકો છો

🎯 Important
આ reelનો purpose માત્ર announcement નથી.
અમે audienceને gradually સમજાવવા માંગીએ છીએ કે Bluenova Creator Hub is a platform connecting brands with creators for collaborations.
એટલે તમારી personality અને content style maintain રાખીને reel બનાવવી. ❤️

Caption/Posting:
Reel ready થયા પછી અમે તમને posting/collab માટે આગળની details આપીશું.
```

Template variables:
- `{{name}}` is the creator's display name.
- `{{joinedVerb}}` is `ગયો` (masculine) or `ગઈ` (feminine), chosen by the creator on the task page. Default to showing `ગયો/ગઈ`.
- Show the 7 shooting instructions as an interactive checklist. The creator must tick them all before uploading a draft.

### 3.3 Categories (seed; admin-editable)

| key | en | gu |
|---|---|---|
| business | Business | બિઝનેસ |
| marketing | Marketing | માર્કેટિંગ |
| tech | Tech | ટેક |
| finance | Finance | ફાઇનાન્સ |
| real_estate | Real Estate | રિયલ એસ્ટેટ |
| food | Food | ફૂડ |
| fashion | Fashion | ફેશન |
| beauty | Beauty | બ્યુટી |
| health | Health | હેલ્થ |
| fitness | Fitness | ફિટનેસ |
| travel | Travel | ટ્રાવેલ |
| education | Education | એજ્યુકેશન |
| automobile | Automobile | ઓટોમોબાઇલ |
| home_interior | Home & Interior | હોમ & ઇન્ટિરિયર |
| local_business | Local Business | લોકલ બિઝનેસ |
| entertainment | Entertainment | એન્ટરટેઇનમેન્ટ |

### 3.4 Cities (seed; admin-editable)

Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar, Bhavnagar, Jamnagar, Junagadh, Anand, Nadiad, Mehsana, Bharuch, Navsari, Valsad, Vapi, Morbi, Porbandar, Bhuj, Other (Gujarat), Mumbai, Other (India). Store as `{ key, name: { en, gu }, active, order }`.

---

## 4. Glossary

- **Campaign:** a brand's requirement (what kind of creators and content they want).
- **Shortlist item:** a creator proposed by an admin for a campaign, with a brand price and creator payout.
- **Offer:** a proposal sent to a creator after the brand selects them.
- **Deal:** one creator × one campaign collaboration after the offer is accepted. Also used for the creator's Intro Reel (`type: INTRO_REEL`, no brand, no money).
- **Draft:** a content version the creator uploads for review.
- **Payout:** money owed to the creator for a verified deal.
- **Ledger entry:** an immutable accounting record of every money movement.

---

## 5. User journeys (end to end)

### 5.1 Creator
1. Lands on `/for-creators` and taps "Collab માટે Apply કરો". Enters a mobile number, verifies the OTP, then picks a role (creator).
2. **Onboarding wizard (5 steps, progress saved after each):**
   1. **Profile:** name, display name, Instagram handle, city, languages, gender (optional), age group (optional), short bio, consent checkboxes.
   2. **Categories:** choose 1–3 category chips.
   3. **Best reels:** paste 2–3 Instagram reel/post URLs, with previews shown.
   4. **Stats & rate card:** followers, average views, engagement rate (optional, manual entry plus an optional screenshot), expected prices per content type, "accept barter deals" toggle.
   5. **Review & submit:** a summary of all steps with edit links, then "Submit for review".
3. **Status page:** a timeline showing Submitted → Under review → Approved / Changes needed / Not approved, with the reason shown in the user's language.
4. On approval:
   - The profile gets the "Official Creator Partner" badge.
   - An **INTRO_REEL deal** is created automatically.
   - The creator gets a WhatsApp and in-app notification.
5. **Intro reel:**
   - The creator reads the script and ticks the checklist, then uploads a draft.
   - An admin approves or requests changes, then sends caption and collab details through the deal chat.
   - The creator posts the reel and submits the live link. An admin verifies it and the deal is COMPLETED.
6. **Opportunities feed:** campaigns that match the creator's categories and city (with no brand contact details). The creator can mark "Interested", which is a signal to admins.
7. **Receives an offer** (payout, deliverables, deadlines, brief) and can Accept, Decline (with a reason) or Counter (amount plus note).
8. **On first accepted paid offer:** if KYC isn't complete, the creator is prompted to complete it (PAN plus bank or UPI), with a step-up OTP.
9. **Deal workspace:** brief, then draft upload, then revisions with timestamped comments, then approval, then live link plus metrics screenshot, then verification, then payout.
10. **Earnings:** wallet showing pending (in progress), on hold, approved, and paid amounts, plus statements.
11. **Rating:** the creator sees the rating given by the brand. The creator score updates.

### 5.2 Brand
1. Lands on `/for-brands`, verifies a mobile OTP, picks a role (brand), then does brand onboarding (company details, optional GSTIN, verified email).
2. **Campaign wizard (6 steps, saved as a draft):**
   1. Basics: title, goal, description.
   2. Creator filters: categories, cities, languages, follower bands, gender, age groups, minimum engagement.
   3. Deliverables: types and quantities, number of creators, collab type (paid, barter, or paid + product), product details.
   4. Timeline: start and end dates, plus do's, don'ts, references, hashtags and mentions. The mandatory disclosure `#ad` is auto-added and can't be removed.
   5. Budget: min/max total, "Let Bluenova suggest", or a package (Starter, Growth or Launch); usage rights add-on.
   6. Review & submit.
3. **Status:** Submitted → In review → **Shortlist ready** (WhatsApp + email notification).
4. **Shortlist page:** creator preview cards with display name, city, categories, follower band, engagement, creator score, sample reels and **brand price**. The brand selects creators.
5. Offers go to the selected creators automatically. As creators accept, the deals appear in the checkout.
6. **Checkout:** a server-calculated summary (deals × brand price + GST), paid through Razorpay Checkout. The payment is held, a GST invoice is generated, and the deals move to IN_PRODUCTION.
7. **Content review:** the brand watches drafts (already pre-approved by an admin), comments at specific timestamps, then approves or requests a revision (limited by `maxRevisions`).
8. **Results:** live links and metrics per deal, campaign totals, and a downloadable PDF report.
9. **Rate** each creator (1–5 stars, tags, comment). Optionally save creators to favourites.

### 5.3 Admin
- Review queue (creators, profile changes), matching and shortlist builder, offers, a deal Kanban board, draft pre-approval, live-link verification, payments, payouts (maker-checker), KYC (masked, with audited reveal), disputes, broadcasts, CMS (website text, FAQ, case studies, scripts), categories and cities, packages, settings (margin, GST, TDS, holds, revision limits), team management, analytics and audit logs.

---

## 6. Tech stack (use exactly these)

### 6.1 Core
- **Monorepo:** pnpm workspaces + Turborepo.
- **Language:** TypeScript (strict) in every package.
- **Frontend (web + admin):** React 18, Vite, React Router v6 (data routers), TanStack Query v5, React Hook Form with `@hookform/resolvers/zod`, Tailwind CSS, shadcn/ui (Radix primitives), lucide-react icons, react-i18next, `@fontsource/noto-sans-gujarati` and `@fontsource/inter` (self-hosted fonts, no Google Fonts CDN), DOMPurify only where a rich preview is unavoidable (otherwise plain text), date-fns + date-fns-tz.
- **Public pages SEO:** pre-render public marketing routes at build time with `vite-react-ssg` or an equivalent prerender plugin. Include meta tags, Open Graph tags, `hreflang` gu/en, `sitemap.xml` and `robots.txt`. `/creator`, `/brand` and the whole admin app are `noindex`.
- **Backend:** Node.js 20 LTS, Express 4, Mongoose 8, zod, `zod-to-openapi` (OpenAPI docs served only when not in production), pino + pino-http, helmet, cors, cookie-parser, express-rate-limit with `rate-limit-redis`, `express-mongo-sanitize`, hpp, jsonwebtoken, argon2, otplib (TOTP), `@aws-sdk/client-s3` + `@aws-sdk/s3-presigned-post`, file-type (magic-byte sniffing), sharp (strip EXIF and create thumbnails), razorpay, socket.io, bullmq + ioredis, pdfkit (invoices and reports), Sentry SDK.
- **Database:** MongoDB 7. **A replica set is required, even locally (single-node), because money flows use multi-document transactions.**
- **Cache/queue:** Redis 7.
- **Testing:** Vitest, Supertest, mongodb-memory-server (replica set mode), Playwright (E2E), MSW for frontend tests.
- **Infra:** Docker Compose for local development (mongo replica set, redis, minio as a stand-in for S3, mailpit for email). GitHub Actions for CI.

### 6.2 Provider adapters (interfaces in `api/src/providers`)

| Interface | Real implementation | Dev/fake implementation |
|---|---|---|
| `SmsProvider` (OTP) | MSG91 | `ConsoleSmsProvider` (logs the OTP; **production boot fails if selected**) |
| `WhatsAppProvider` | Meta WhatsApp Cloud API (template messages) | `ConsoleWhatsAppProvider` |
| `EmailProvider` | Resend (or SES) | SMTP to Mailpit |
| `StorageProvider` | AWS S3 | MinIO (S3-compatible) |
| `PaymentProvider` | Razorpay Orders + Checkout + Webhooks | `FakePaymentProvider` (simulates capture through a dev-only endpoint) |
| `PayoutProvider` | `ManualPayoutProvider` (finance enters UTR) **default**; `RazorpayXPayoutProvider` (later) | Manual |
| `BankVerificationProvider` | RazorpayX Fund Account Validation (penny drop) | `FakeBankVerification` |
| `InstagramProvider` | Instagram Graph API (oEmbed for previews; Business/Creator insights in Phase 3) | Fake returning a placeholder preview |
| `CaptchaProvider` | Cloudflare Turnstile | Always-pass in dev |

---

## 7. Repository structure

```
bluenova-creatorhub/
├── apps/
│   ├── web/                      # public site + creator area + brand area
│   │   └── src/
│   │       ├── app/              # router, providers, layouts
│   │       ├── features/
│   │       │   ├── public/       # home, for-creators, for-brands, about, faq, case studies, contact, legal
│   │       │   ├── auth/         # login, otp, role select
│   │       │   ├── creator/      # onboarding, dashboard, intro-reel, opportunities, offers, deals, earnings, kyc, profile, settings
│   │       │   ├── brand/        # onboarding, dashboard, campaigns (wizard), shortlist, checkout, deals, reports, invoices, favourites, settings
│   │       │   └── shared/       # deal workspace, chat, notifications, file upload, video review
│   │       ├── components/       # ui (shadcn), StatusTimeline, StatusBadge, Money, EmptyState, OtpInput, ChipSelect, Stepper...
│   │       ├── lib/              # apiClient, auth store (memory), queryClient, i18n, format (money/date), safeRedirect
│   │       └── i18n/{gu,en}/*.json
│   ├── admin/                    # admin panel (separate build, separate subdomain)
│   │   └── src/{app,features/{dashboard,creators,brands,campaigns,deals,payments,payouts,kyc,disputes,broadcasts,content,settings,team,audit},components,lib,i18n}
│   ├── api/
│   │   └── src/
│   │       ├── app.ts            # express app + middleware order (§13.1)
│   │       ├── server.ts         # http + socket.io bootstrap
│   │       ├── config/           # env schema (zod), constants
│   │       ├── middleware/       # authenticate, authorize, requireAdminRole, validate, rateLimit, idempotency, requireStepUp, errorHandler, requestId, noStore
│   │       ├── modules/          # one folder per domain (§13.2)
│   │       │   ├── auth/ users/ creators/ kyc/ brands/ campaigns/ shortlists/ offers/ deals/ drafts/
│   │       │   ├── uploads/ payments/ invoices/ payouts/ ledger/ messages/ notifications/ reviews/
│   │       │   ├── disputes/ referrals/ content/ catalog/ (categories, cities, packages) settings/
│   │       │   ├── reports/ analytics/ broadcasts/ audit/ account/ (export/delete) public/ webhooks/
│   │       ├── providers/        # adapters (§6.2)
│   │       ├── realtime/         # socket.io auth + rooms
│   │       ├── utils/            # crypto (encrypt/decrypt/blindIndex), mask, money, phone, safeUrl, piiRedact, stateMachine
│   │       ├── jobs/             # queue producers (consumers live in worker)
│   │       └── scripts/          # seed, seed:superadmin, rotate-keys
│   └── worker/
│       └── src/{queues,processors,cron}/
├── packages/
│   ├── shared/                   # zod schemas, enums, state machines, types, permission matrix, i18n key types
│   ├── ui/ (optional)            # shared React components between web and admin
│   └── config/                   # eslint, tsconfig, tailwind preset (design tokens)
├── infra/
│   ├── docker-compose.yml        # mongo (rs), redis, minio, mailpit
│   └── github/workflows/ci.yml
└── docs/
    ├── DECISIONS.md  ARCHITECTURE.md  SECURITY.md  API.md (generated)  RUNBOOK.md  INCIDENT_RESPONSE.md
```

---

## 8. Environment variables

Validate them with zod at boot. **If anything required is missing or invalid, exit immediately with a clear error.** In production, refuse to boot if any fake/console provider is selected, if `COOKIE_SECURE` is false, or if `CORS_ORIGINS` contains `*` or `localhost`.

```
NODE_ENV, PORT, APP_BASE_URL, ADMIN_BASE_URL, API_BASE_URL, CORS_ORIGINS (comma list), COOKIE_DOMAIN (.bluenovatech.in), COOKIE_SECURE
MONGODB_URI, REDIS_URL
JWT_ACCESS_SECRET (≥64 chars), JWT_ACCESS_TTL=15m, REFRESH_TTL_USER_DAYS=30, REFRESH_TTL_ADMIN_HOURS=12
DATA_ENCRYPTION_KEYS (JSON: {"v1":"base64-32-bytes", ...}), DATA_ENCRYPTION_ACTIVE_VERSION=v1, BLIND_INDEX_KEY (base64-32)
OTP_PEPPER, TOTP_ENCRYPTION_KEY_VERSION
SMS_PROVIDER=msg91|console, MSG91_AUTH_KEY, MSG91_TEMPLATE_ID
WHATSAPP_PROVIDER=meta|console, WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN
EMAIL_PROVIDER=resend|smtp, RESEND_API_KEY, SMTP_URL, EMAIL_FROM
STORAGE_PROVIDER=s3|minio, S3_REGION=ap-south-1, S3_BUCKET_FILES, S3_BUCKET_KYC, S3_ENDPOINT (minio), S3_ACCESS_KEY, S3_SECRET_KEY
PAYMENT_PROVIDER=razorpay|fake, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
PAYOUT_PROVIDER=manual|razorpayx, RAZORPAYX_ACCOUNT_NUMBER
CAPTCHA_PROVIDER=turnstile|none, TURNSTILE_SECRET, VITE_TURNSTILE_SITE_KEY
INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (Phase 3)
SENTRY_DSN, LOG_LEVEL
```

---

## 9. Shared package (`packages/shared`)

This package holds every enum, every zod input schema (§24), state machine definitions (§11), the permission matrix (§15), money and phone helpers, and response types. **The web, admin and API apps all import from here. Validation must never be duplicated.**

Key enums:
```ts
Role = 'creator' | 'brand' | 'admin'
AdminRole = 'super_admin' | 'reviewer' | 'campaign_manager' | 'finance'
Language = 'gu' | 'hi' | 'en'
Gender = 'male' | 'female' | 'other' | 'prefer_not_say'
AgeGroup = '18_24' | '25_34' | '35_44' | '45_plus'
FollowerBand = 'NANO' (1k–10k) | 'MICRO' (10k–100k) | 'MID' (100k–500k) | 'MACRO' (500k–1M) | 'MEGA' (1M+)
DeliverableType = 'REEL' | 'POST' | 'STORY' | 'STORY_WITH_LINK' | 'CAROUSEL'
CampaignGoal = 'AWARENESS' | 'STORE_VISITS' | 'SALES' | 'APP_INSTALLS' | 'LAUNCH' | 'OTHER'
CollabType = 'PAID' | 'BARTER' | 'PAID_PLUS_PRODUCT'
Package = 'STARTER' | 'GROWTH' | 'LAUNCH' | 'CUSTOM'
FilePurpose = 'DEAL_DRAFT' | 'LIVE_SCREENSHOT' | 'STATS_SCREENSHOT' | 'KYC_DOC' | 'BRAND_LOGO' | 'INVOICE_PDF' | 'REPORT_PDF' | 'CMS_IMAGE' | 'DISPUTE_EVIDENCE'
```

---

## 10. Data models (Mongoose)

General rules:
- `timestamps: true` on every model, and `strictQuery: true` globally.
- Fields marked 🔒 use `select: false` and are only returned by explicit admin serializers.
- Fields marked 🔐 are **encrypted at the application level** (§27.4).
- Every reference is indexed.

**User**
`role`, `adminRole?`, `phone` (E.164, unique), `phoneVerifiedAt`, `email?` (lowercase, unique sparse), `emailVerifiedAt?`, `passwordHash?` 🔒, `totpSecret?` 🔒🔐, `totpEnabled`, `status: active|suspended|deletion_pending|deleted`, `tokenVersion` (number), `preferredLanguage: gu|en`, `consents[{ type: privacy|terms|creator_agreement|brand_agreement|marketing, version, acceptedAt, ip }]`, `lastLoginAt`, `failedOtpCount`, `lockedUntil?`, `deletionRequestedAt?`.

**RefreshToken**
`userId`, `tokenHash` (sha256, unique), `familyId`, `expiresAt` (TTL index), `revokedAt?`, `replacedByHash?`, `ip`, `userAgent`.

**Otp**
`phone`, `purpose: login|step_up|phone_change`, `codeHash` (HMAC with `OTP_PEPPER`), `attempts`, `expiresAt` (TTL, 5 min), `consumedAt?`.

**AdminInvite**
`email`, `adminRole`, `tokenHash`, `invitedBy`, `expiresAt` (48h), `acceptedAt?`.

**CreatorProfile**
- Identity:
  - `userId` (unique), `fullName`, `displayName`, `slug` (unique, random suffix)
  - `gender?`, `ageGroup?`, `city` (city key), `languages[]`, `bio` (≤300)
- `categories[]`: 1–3 category keys
- `instagram`:
  - `handle`, `followers`, `avgViews`, `engagementRate` (basis points)
  - `followerBand` (derived), `statsSource: manual|screenshot|api`, `statsUpdatedAt`, `statsScreenshotFileId?`
  - `igUserId?`, `accessToken?` 🔒🔐, `connected`
- `reels[{ url, shortcode, addedAt }]`: 2–3
- `rateCard`: `{ REEL, POST, STORY, STORY_WITH_LINK, CAROUSEL }` in paise, all optional; `acceptsBarter`
- `availability: { open: boolean, blocked: [{ from, to }] }`
- `status: DRAFT|SUBMITTED|UNDER_REVIEW|CHANGES_REQUESTED|APPROVED|REJECTED|SUSPENDED`
- `statusHistory[{ from, to, by, reasonCode?, reasonText?, at }]`
- `onboardingStep` (1–5)
- `review`: `{ scores: { quality, consistency, audienceFit, engagement } (1–5), reasonCode, reasonText, reviewedBy, reviewedAt }` 🔒 except `reasonCode`/`reasonText`
- `pendingChanges?`: edits to categories, IG handle or reels by an APPROVED creator, which wait for re-review
- `internalTags[]` 🔒, `internalNotes` 🔒
- `isPartner`, `partnerSince?`, `introReelDealId?`
- Scores and stats: `creatorScore` (0–100, default 60), `ratingAvg`, `ratingCount`, `completedDeals`, `onTimeDeliveries`
- `publicProfileEnabled` (default false)
- Referrals: `referralCode` (unique), `referredByUserId?`
- `reapplyAfter?` (set when REJECTED)

**KycRecord**
- `creatorId` (unique)
- PAN: `pan` 🔒🔐, `panLast4`, `panBlindIndex` (HMAC, unique sparse), `panName`
- `payoutMethod: BANK|UPI`
- `bank`: `{ account 🔒🔐, accountLast4, ifsc, holderName }`
- `upi`: `{ vpa 🔒🔐, masked }`
- `verification`: `{ status: NOT_STARTED|PENDING|VERIFIED|FAILED, providerRef?, verifiedAt?, failureReason? }`
- `keyVersion`, `lastChangedAt`, `payoutHoldUntil?`, `documentFileIds[]`

**BrandProfile**
- `userId` (unique), `companyName`, `slug`, `contactName`, `designation?`, `email` (verified), `gstin?`, `industry` (category key), `city`, `website?` (https), `logoFileId?`
- `billingAddress`: `{ line1, line2?, city, state, pincode }`, `stateCode` (for GST CGST/SGST vs IGST)
- `status: INCOMPLETE|ACTIVE|SUSPENDED`
- `favouriteCreatorIds[]`, `internalNotes` 🔒

**Campaign**
- Ownership: `brandId`, `assignedManagerId?`
- Basics: `title` (≤100), `goal`, `description` (≤2000)
- `filters`: `{ categories[], cities[], languages[], followerBands[], genders[], ageGroups[], minEngagementBps? }`
- Deliverables and type: `deliverables[{ type, quantity }]`, `creatorsNeeded` (1–50), `collabType`
- `product?`: `{ name, valuePaise, shippingRequired }`
- `budget`: `{ minPaise?, maxPaise?, suggest: boolean }`, `package?`
- Dates: `startDate`, `endDate`
- `guidelines`: `{ dos[], donts[], referenceUrls[], hashtags[], mentions[], disclosure: '#ad' }` (fixed, always present)
- Limits and rights: `maxRevisions` (default from settings), `usageRights`: `{ required, durationDays? }`
- Status: `status` (§11.2), `statusHistory[]`, `wizardStep`

**ShortlistItem**
- `campaignId`, `creatorId`, `brandPricePaise`, `creatorPayoutPaise` 🔒, `matchScore`, `adminNote` 🔒
- `status: PROPOSED|SELECTED|REJECTED_BY_BRAND|WITHDRAWN|REPLACED`, `proposedBy`
- Unique index on (`campaignId`, `creatorId`)

**Offer**
- `campaignId`, `creatorId`, `shortlistItemId`, `payoutPaise`
- `deliverables[]`, `deadlines: { draftDue, liveDue }`, `briefSnapshot` (copy of the campaign guidelines at send time)
- `status` (§11.3), `counter?`: `{ amountPaise, note, at }`, `declineReason?`, `expiresAt`, `history[]`

**Deal**
- `type: BRAND|INTRO_REEL`, `campaignId?`, `brandId?`, `creatorId`, `offerId?`
- Money (BRAND type): `brandPricePaise`, `creatorPayoutPaise`, `marginPaise` 🔒, `gstRateBps`
- Work: `deliverables[]`, `deadlines: { draftDue, liveDue }`, `maxRevisions`, `brandRevisionsUsed`
- Status: `status` (§11.4), `statusHistory[]`
- `live?`:
  - `{ url, submittedAt, verifiedAt?, verifiedBy?, disclosureVerified, matchesApprovedDraft }`
  - `metrics: { views, likes, comments, shares, saves, reach, capturedAt, source }`, `screenshotFileIds[]`
- `paymentId?`, `payoutId?`, `disputeId?`, `chatEnabled`

**Draft**
- `dealId`, `version` (1..n), `fileIds[]`, `caption?` (≤2200), `creatorNote?` (≤500)
- `status: SUBMITTED|ADMIN_CHANGES_REQUESTED|SENT_TO_BRAND|BRAND_CHANGES_REQUESTED|APPROVED`
- `comments[{ authorId, authorRole, text (≤1000), timestampSec?, at, internal (admin-only) }]`

**Payment**
- `campaignId`, `brandId`, `dealIds[]`
- Amounts: `subtotalPaise`, `gst: { cgst, sgst, igst }`, `totalPaise`
- Razorpay: `razorpayOrderId` (unique), `razorpayPaymentId?`
- `status: CREATED|CAPTURED|FAILED|REFUNDED|PARTIALLY_REFUNDED`
- `invoiceId?`, `idempotencyKey`, `events[]`

**WebhookEvent**
`provider`, `eventId` (unique), `type`, `payloadHash`, `receivedAt`, `processedAt?`, `error?`.

**Invoice**
`number` (format `BN/2026-27/000123`, generated from an atomic counter per financial year), `brandId`, `paymentId`, `lines[]`, `subtotalPaise`, `gst`, `totalPaise`, `brandSnapshot` (name, GSTIN, address), `pdfFileId`, `issuedAt`.

**Payout**
- `dealId` (unique), `creatorId`
- Amounts: `grossPaise`, `tdsPaise`, `netPaise`
- `status` (§11.5)
- Approval and release: `approvedBy?`, `approvedAt?`, `releasedBy?`, `releasedAt?`, `method: MANUAL|RAZORPAYX`, `reference?` (UTR)
- `holdReason?`, `failureReason?`

**LedgerEntry** (append-only; never updated or deleted)
`entryType: BRAND_PAYMENT_RECEIVED|CREATOR_PAYABLE|PLATFORM_REVENUE|GST_PAYABLE|TDS_PAYABLE|PAYOUT_SENT|REFUND_ISSUED`, `amountPaise`, `direction: DEBIT|CREDIT`, `account`, `refs: { paymentId?, dealId?, payoutId?, refundId? }`, `createdBy`, `createdAt`. Write ledger entries inside the same transaction as the business change they record.

**Message**
`dealId`, `senderId`, `senderRole`, `body` (stored **after** PII masking), `wasMasked`, `createdAt`, `readBy[{ userId, at }]`. Index on (`dealId`, `createdAt`).

**Notification**
`userId`, `type`, `params` (object), `link` (internal path only), `readAt?`, `channels: { inApp, whatsapp, email, sms }` (each with a status). The text is rendered on the client from i18n keys + params.

**Review (rating)**
`dealId` (unique), `brandId`, `creatorId`, `rating` (1–5), `tags[]` (on_time, great_quality, professional, creative, needs_improvement), `comment` (≤500).

**Dispute**
`dealId`, `raisedBy`, `raisedByRole`, `reason` (enum + text ≤1000), `evidenceFileIds[]`, `status: OPEN|UNDER_REVIEW|RESOLVED|REJECTED`, `resolution?`, `refundPaise?`, `resolvedBy?`.

**Referral**
`referrerUserId`, `refereeUserId` (unique), `status: SIGNED_UP|APPROVED|FIRST_DEAL_COMPLETED|REWARDED`, `rewardPaise`.

**File**
`ownerId`, `purpose`, `bucket`, `key` (uuid-based), `declaredMime`, `detectedMime`, `size`, `status: PENDING|READY|REJECTED|DELETED`, `related: { type, id }`, `createdAt`. A TTL cleanup job handles PENDING files older than 24h.

**AuditLog** (append-only)
`actorId`, `actorRole`, `adminRole?`, `action` (e.g. `creator.approve`, `kyc.reveal`, `payout.release`, `settings.update`), `entityType`, `entityId`, `changes` (redacted diff), `reason?`, `ip`, `userAgent`, `requestId`, `createdAt`.

**Content and catalog**
- `ContentBlock`: `{ key, gu, en, format: text|list, version, updatedBy }`
- `Faq`: `{ audience: creator|brand|all, question{gu,en}, answer{gu,en}, order, published }`
- `CaseStudy`: `{ slug, title{gu,en}, summary{gu,en}, brandName, metrics[], imageFileIds[], published }`
- `Category`, `City`
- `PackageDef`: `{ key, name{gu,en}, description{gu,en}, creators, followerBand, deliverables[], pricePaise, active }`

**Broadcast**
`filters`, `channel: whatsapp|email|in_app`, `templateKey`, `params`, `createdBy`, `status`, `recipientCount`, `sentCount`, `failedCount`.

**IdempotencyKey**
`key`, `userId`, `route`, `statusCode`, `responseBody`, `expiresAt` (TTL 24h). Unique index on (`key`, `userId`, `route`).

**Counter**
`{ _id: name, seq }`.

**Settings** (singleton, editable by super_admin and audited)
`defaultMarginBps` (2500), `gstRateBps` (1800), `tdsRateBps` (0, configurable; **must be confirmed by the client's CA**), `payoutHoldHoursAfterBankChange` (48), `dualApprovalAlways` (true), `superAdminApprovalAbovePaise` (5000000 = ₹50,000), `defaultMaxRevisions` (2), `offerExpiryHours` (48), `brandReviewReminderHours` (48), `brandReviewAutoApproveDays` (5), `reapplyAfterDays` (90), `referralRewardPaise` (50000), `minPayoutPaise` (10000).

---

## 11. State machines

Implement these in `packages/shared/stateMachines.ts` as data: `{ from, to, actor, guard }`. Use one generic `transition(entity, to, actor, ctx)` helper on the server that:
- validates the move against the definition,
- runs inside a transaction when money is involved,
- appends to `statusHistory`,
- writes an AuditLog entry when the actor is an admin,
- emits domain events (for notifications).

Invalid transitions return **409 `INVALID_STATE`**.

### 11.1 CreatorProfile
| From | To | Actor | Guard / side effects |
|---|---|---|---|
| DRAFT, CHANGES_REQUESTED | SUBMITTED | creator | All 5 steps valid (re-validate everything on the server) |
| SUBMITTED | UNDER_REVIEW | reviewer | Reviewer claims the application |
| UNDER_REVIEW | APPROVED | reviewer | Scores required. Sets `isPartner`, creates the INTRO_REEL deal, notifies the creator. |
| UNDER_REVIEW | CHANGES_REQUESTED | reviewer | Reason code + text required |
| UNDER_REVIEW | REJECTED | reviewer | Reason required. Sets `reapplyAfter = now + reapplyAfterDays`. |
| REJECTED | DRAFT | creator | Only after `reapplyAfter` |
| APPROVED | SUSPENDED | super_admin | Reason required. Active deals are flagged for admin attention. |
| SUSPENDED | APPROVED | super_admin | Reason required |

When an APPROVED creator edits categories, IG handle or reels, the change is saved to `pendingChanges` and queued for a reviewer. The live profile keeps its old values until approved.

### 11.2 Campaign
`DRAFT → SUBMITTED (brand) → IN_REVIEW (campaign_manager) → SHORTLIST_SENT (cm; ≥1 PROPOSED item) → CREATORS_SELECTED (brand; ≥1 SELECTED; creates offers) → PAYMENT_PENDING (system; ≥1 deal AWAITING_PAYMENT) → ACTIVE (system; payment captured) → COMPLETED (system; all deals COMPLETED/CANCELLED)`

Other transitions:
- `CANCELLED` from DRAFT through PAYMENT_PENDING (brand or cm, with reason).
- `CREATORS_SELECTED` or `PAYMENT_PENDING` → `SHORTLIST_SENT` when the cm proposes replacements after a decline.
- The brand can edit the campaign only while it is `DRAFT`.

### 11.3 Offer
`SENT → ACCEPTED | DECLINED | COUNTERED | EXPIRED (cron at expiresAt) | WITHDRAWN (cm)`

`COUNTERED` → `SENT` (cm sends a revised offer) or `WITHDRAWN`.

If the cm accepts a counter, it may raise the creator payout only by **reducing the margin**. The brand price stays the same unless the brand explicitly re-confirms a new price.

`ACCEPTED` creates a Deal (`AWAITING_PAYMENT`).

### 11.4 Deal (type BRAND)
| From | To | Actor | Guard / side effects |
|---|---|---|---|
| AWAITING_PAYMENT | IN_PRODUCTION | system (webhook) | Payment captured. Ledger entries written. Notifies the creator and the brand. |
| AWAITING_PAYMENT | CANCELLED | brand, cm | Reason required |
| IN_PRODUCTION, REVISION_REQUESTED | DRAFT_SUBMITTED | creator | ≥1 READY file |
| DRAFT_SUBMITTED | BRAND_REVIEW | cm | Internal pre-approval |
| DRAFT_SUBMITTED | REVISION_REQUESTED | cm | Comment required. **Does not** use up a brand revision. |
| BRAND_REVIEW | APPROVED | brand | Also auto-approved by cron after `brandReviewAutoApproveDays`, with a reminder at 48h |
| BRAND_REVIEW | REVISION_REQUESTED | brand | Only if `brandRevisionsUsed < maxRevisions`; increments it. Otherwise the UI offers Approve or Raise dispute. |
| APPROVED | LIVE_SUBMITTED | creator | Valid Instagram URL plus optional metrics screenshot |
| LIVE_SUBMITTED | VERIFIED | cm | `disclosureVerified` and `matchesApprovedDraft` must both be true. Creates a Payout (ON_HOLD or PENDING_APPROVAL). |
| LIVE_SUBMITTED | APPROVED | cm | Live link rejected; reason required |
| VERIFIED | COMPLETED | system | Payout PAID. Updates creator stats and enables rating. |
| IN_PRODUCTION … LIVE_SUBMITTED | DISPUTED | brand, creator, cm | Reason required |
| DISPUTED | (previous state) or CANCELLED | cm / super_admin | Resolution text required; optional refund (finance) |

**INTRO_REEL deals** skip payment and brand review:

`IN_PRODUCTION → DRAFT_SUBMITTED → (admin) APPROVED | REVISION_REQUESTED → LIVE_SUBMITTED → VERIFIED → COMPLETED`

There is no payout, and the deal is completed immediately after VERIFIED.

### 11.5 Payout
| From | To | Actor | Guard |
|---|---|---|---|
| (created) | ON_HOLD | system | KYC not VERIFIED, or `now < kyc.payoutHoldUntil` |
| (created) / ON_HOLD | PENDING_APPROVAL | system/cron | Hold cleared and KYC VERIFIED |
| PENDING_APPROVAL | APPROVED | finance | Records `approvedBy` |
| APPROVED | PROCESSING / PAID | finance | **`releasedBy ≠ approvedBy`** (enforced on the server and in the DB check). Above `superAdminApprovalAbovePaise`, the releaser must be a super_admin. Manual: requires the UTR reference. |
| PROCESSING | PAID / FAILED | system (RazorpayX webhook) | |
| FAILED | PENDING_APPROVAL | finance | Reason required |
| any non-paid | ON_HOLD | finance, system | Reason required (for example, a bank change) |

---

## 12. Business rules and formulas

- **Pricing:** the admin enters `creatorPayoutPaise`. The suggested brand price is `ceil(payout / (1 − defaultMargin))`, rounded up to the nearest ₹100. Admins can override it. `margin = brandPrice − payout` must be ≥ 0.
- **GST:**
  - Rate is `gstRateBps` on the brand price.
  - If the brand's `stateCode` is the same as Bluenova's state (Gujarat, `24`), charge CGST and SGST at half each. Otherwise charge IGST.
  - Display: "GST treatment to be confirmed by CA". Keep it all configurable.
- **TDS:**
  - Rate is `tdsRateBps` (default 0).
  - `net = gross − tds`.
  - Finance can export TDS reports as CSV.
- **Follower band:** derived from the follower count using the thresholds in §9.
- **Match score (0–100)** for each creator against a campaign:
  - Categories overlap: 35
  - City in filters, or filters empty: 20
  - Language overlap: 15
  - Follower band in filters: 10
  - Rate card for the main deliverable is ≤ the campaign budget per creator: 10
  - `creatorScore / 10`: 10
  - **Exclude** creators who are not APPROVED, have `availability.open = false`, have blocked dates overlapping the campaign dates, are suspended, or already have an active deal on the same campaign.
- **Creator score (0–100):**
  - Calculated as `0.4 × onTimeRate×100 + 0.4 × (ratingAvg/5)×100 + 0.2 × revisionEfficiency×100`.
  - New creators start at 60.
  - Recalculated whenever a rating is given, and nightly.
  - `revisionEfficiency` = 1 − (average brand revisions used ÷ maxRevisions).
- **On time:** the draft was submitted on or before `draftDue` **and** the live link was submitted on or before `liveDue`.
- **Offer expiry:** `offerExpiryHours`. An hourly cron expires offers and notifies the creator and the cm.
- **Referral:** a creator shares `/join/creator?ref=CODE`. The reward is credited (as a manual payout line) when the referee completes their first BRAND deal.
- **Packages:** prices and contents come from `PackageDef`, managed by the admin. **Never hard-code package prices.**
- **Reapply:** a rejected creator can reapply after `reapplyAfterDays`.

---

## 13. Backend architecture

### 13.1 Middleware order (`app.ts`)
```
1.  app.set('trust proxy', 1)                 // behind Cloudflare/LB; needed for correct req.ip
2.  requestId (uuid, echoed in X-Request-Id)
3.  pino-http (with redaction, §29)
4.  helmet (CSP etc., §27.1)
5.  cors({ origin: exact allowlist, credentials: true })
6.  app.post('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), webhookHandler)  // BEFORE json parser
7.  express.json({ limit: '100kb' }), express.urlencoded({ extended: false, limit: '100kb' })
8.  cookieParser()
9.  mongoSanitize(), hpp()
10. globalRateLimit (Redis)
11. noStore (Cache-Control: no-store on all /api responses except public cached GETs)
12. routers under /api/v1
13. 404 handler
14. errorHandler (never leaks stack or internal messages in production)
```

### 13.2 Module pattern
Each module contains `*.routes.ts`, `*.controller.ts` (thin), `*.service.ts` (business logic), `*.model.ts`, `*.policy.ts` (ownership and permission predicates), `*.serializer.ts` (role-based output) and `*.test.ts`.

Every protected route follows this chain:
```ts
router.post('/deals/:dealId/drafts',
  authenticate,
  authorize('creator'),
  validate({ params: dealIdParams, body: submitDraftSchema }),
  loadOwned(Deal, 'dealId', { creator: 'creatorId' }),   // 404 if not found OR not owned
  requireState(dealMachine, ['IN_PRODUCTION', 'REVISION_REQUESTED']),
  idempotency(),
  controller.submitDraft);
```

### 13.3 API conventions
- **Base path:** `/api/v1`.
- **Success:** `{ "data": ..., "meta"?: { "nextCursor": "...", "count": n } }`.
- **Error:** `{ "error": { "code": "VALIDATION_ERROR", "message": "<i18n key>", "fields"?: { "phone": "errors.phone.invalid" }, "requestId": "..." } }`.
- **Error codes:**

  | Code | Status |
  |---|---|
  | `UNAUTHENTICATED` | 401 |
  | `FORBIDDEN` | 403 (only when the resource's existence is already known to the user, e.g. a role mismatch on a collection route) |
  | `NOT_FOUND` | 404 (also used for records the user doesn't own) |
  | `VALIDATION_ERROR` | 400 |
  | `INVALID_STATE` | 409 |
  | `CONFLICT` | 409 |
  | `RATE_LIMITED` | 429 |
  | `STEP_UP_REQUIRED` | 401 with code |
  | `INTERNAL` | 500 |

- **Pagination:** cursor-based (`?cursor=&limit=`; default 20, max 50) on `_id` desc.
- **Validation:** query, params and body are all validated with zod. Unknown keys are **stripped**. Object IDs are validated with a regex.
- **Idempotency:** the `Idempotency-Key` header (uuid) is **required** on payment order creation, offer actions, draft submit, live-link submit, payout approve/release, and creator submit.
- **OpenAPI:** generated from the zod schemas into `docs/API.md` and `/api/docs` (disabled in production).

---

## 14. Authentication and sessions

- **OTP login (all roles):**
  1. `POST /auth/otp/request { phone, purpose:'login', captchaToken? }`
     - Phone must match `^[6-9]\d{9}$` and is normalized to `+91…`. Only +91 numbers are accepted.
     - Always respond `200 { data: { sent: true } }`, whether or not the account exists.
     - The OTP is 6 random digits from `crypto.randomInt`. Store `HMAC(pepper, phone+code)`. It expires in 5 minutes.
     - Resend cooldown is 30 seconds. Limits: 5 per phone per hour, 20 per IP per hour. After 3 requests in an hour, a captcha is required.
  2. `POST /auth/otp/verify { phone, code }`
     - Max 5 attempts per OTP, then the OTP is invalidated. Compare in constant time.
     - On success, a user is created if new, with `role: null`. The client then shows role selection, which calls `POST /auth/role { role: creator|brand }` once only.
     - Issues tokens.
     - 10 failed verifications in an hour lock the phone for 30 minutes.
- **Admin login:**
  - Admins can only use `admin.bluenovatech.in`, which calls `/auth/admin/*`: OTP, then **TOTP** (required).
  - Admin accounts are created through an invite link (email): the invitee sets their phone, then TOTP enrollment, then backup codes (10, hashed).
  - Admin refresh lifetime is 12 hours, with no "remember me".
- **Access token:**
  - JWT HS256, 15 minutes.
  - Claims: `sub`, `role`, `adminRole?`, `tv` (tokenVersion), `typ:'access'`.
  - Verify `alg`, `iss`, `aud` and `exp`.
  - **The web client stores it in memory only** (a module variable or React context, never localStorage or sessionStorage).
- **Refresh token:**
  - 32 random bytes, base64url.
  - Cookie: `__Host-` prefix isn't possible with the domain attribute, so use cookie `bn_rt` with `HttpOnly; Secure; SameSite=Strict; Domain=.bluenovatech.in; Path=/api/v1/auth; Max-Age=…`. Use a separate cookie name `bn_admin_rt` for admin.
  - Only the sha256 hash is stored.
  - **Rotated on every refresh.** Reusing a revoked token revokes the whole `familyId` and logs a security event.
- **CSRF:** SameSite=Strict, plus a check that the `Origin` header is in the allowlist on `/auth/refresh`, `/auth/logout` and every state-changing request that carries cookies.
- **authenticate middleware:**
  - Verifies the JWT.
  - Loads `{ status, tokenVersion, role }` from Redis (cached for 60 seconds; the cache is busted on change).
  - Rejects if the user is suspended or deleted, or if `tv` doesn't match.
- **Logout:** revokes the current refresh token. "Log out of all devices" increments `tokenVersion` and revokes all refresh tokens.
- **Step-up:**
  - `POST /auth/step-up` with a fresh OTP (admins use TOTP) sets `stepUpUntil = now + 5min` in Redis for the session.
  - `requireStepUp` middleware is required on: KYC create/update, phone change, account deletion, data export, admin KYC reveal, payout release, and settings update.
- **Brand email:** verified with a link: a 32-byte token, stored hashed, single-use, expires in 30 minutes. After use, the frontend calls `history.replaceState` to remove the token from the URL.

---

## 15. Authorization

### 15.1 Permission matrix
Define it in shared code and use it in both the API and the UI:
- `can(role, adminRole, action)` handles role and admin sub-role checks.
- Ownership is checked in policies: **every** query for user-owned data includes the owner field (`creatorId`, `brandId` or `userId`).
- Admin routes require `role=admin` plus the right `adminRole`. `super_admin` passes every admin check.

### 15.2 Field visibility (serializers)
Never return Mongoose documents directly. Each module exports `toCreatorView`, `toBrandView`, `toAdminView` and `toPublicView`. Tests must assert that no restricted field leaks.

| Field | Creator | Brand | Admin | Public |
|---|---|---|---|---|
| Creator phone / email | own | ❌ | ✅ | ❌ |
| Creator full name | own | ❌ (display name only) | ✅ | ❌ |
| Creator IG handle and reels | own | ✅ (in shortlist / deals) | ✅ | only if `publicProfileEnabled` |
| KYC (PAN / bank / UPI) | own, masked | ❌ | masked; full only through the audited reveal | ❌ |
| Creator payout | own | ❌ | ✅ | ❌ |
| Brand price, GST, invoice | ❌ | own | ✅ | ❌ |
| Margin | ❌ | ❌ | ✅ | ❌ |
| Brand phone / email / contact name | ❌ | own | ✅ | ❌ |
| Brand company name | ✅ (in offers and deals) | own | ✅ | only in published case studies |
| Internal notes, tags, review scores, admin-only comments | ❌ | ❌ | ✅ | ❌ |

### 15.3 Mass assignment
Zod schemas list only the fields a user may set. **Never** do `Model.create(req.body)` or `Object.assign(doc, req.body)`. These fields can never be set from client input: `role`, `adminRole`, `status`, `isPartner`, any price or margin, `creatorScore`, review fields, or ledger fields.

---

## 16. API endpoints (complete list)

Rate limit keys:
- **S** = strict, 5/min per IP + identifier.
- **M** = 30/min per user.
- **D** = 120/min per user.
- **P** = public GET, 300/min per IP.

### 16.1 Auth and account
| Method | Path | Auth | Limit | Notes |
|---|---|---|---|---|
| POST | /auth/otp/request | public | S | Captcha after 3 per hour; identical response either way |
| POST | /auth/otp/verify | public | S | Sets cookie and returns `{ accessToken, user }` |
| POST | /auth/role | logged in, role null | S | One-time role choice: creator or brand |
| POST | /auth/refresh | cookie | M | Origin check; rotation |
| POST | /auth/logout | cookie | M | |
| POST | /auth/logout-all | logged in | S | |
| POST | /auth/step-up | logged in | S | OTP (users) or TOTP (admins) |
| POST | /auth/admin/otp/request, /auth/admin/otp/verify, /auth/admin/totp/verify | public (admin) | S | Two steps: OTP, then TOTP |
| POST | /auth/admin/invite/accept | invite token | S | Set phone, enroll TOTP |
| POST | /auth/email/verify/request, /auth/email/verify/confirm | logged in / token | S | |
| GET | /me | logged in | D | Role-specific summary |
| PATCH | /me/preferences | logged in | D | `preferredLanguage` |
| POST | /me/phone/change | step-up | S | OTP to the new phone |
| GET | /account/export | step-up | S | Queues a job; a download link is sent to the in-app notification (signed, 24h) |
| POST | /account/delete-request | step-up | S | 7-day grace period; cancelled by logging in |

### 16.2 Public and catalog
| Method | Path | Notes |
|---|---|---|
| GET | /public/content/:key | CMS blocks (P, cached for 5 minutes) |
| GET | /public/faqs?audience= | |
| GET | /public/case-studies, /public/case-studies/:slug | Published only |
| GET | /public/creators/:slug | Only if `publicProfileEnabled`; public view |
| GET | /catalog/categories, /catalog/cities, /catalog/packages | Active only |
| POST | /public/contact | Captcha + honeypot field + S limit; stored, and the team is emailed |

### 16.3 Creator
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | /creators/me | PATCH accepts only allowed fields for the current state. If APPROVED, key fields go to `pendingChanges`. |
| PUT | /creators/me/onboarding/:step | Saves a step (1–4) with that step's schema; updates `onboardingStep` |
| PUT | /creators/me/categories | 1–3 valid keys |
| POST | /creators/me/reels | URL validated; max 3 |
| DELETE | /creators/me/reels/:reelId | At least 2 must remain once submitted |
| POST | /creators/me/submit | Idempotent; full re-validation; DRAFT/CHANGES_REQUESTED → SUBMITTED |
| GET | /creators/me/status | Status, history and reason |
| PATCH | /creators/me/availability | |
| PATCH | /creators/me/public-profile | Toggle `publicProfileEnabled` |
| GET | /creators/me/intro-task | Returns the intro deal ID, the script with variables rendered, and the checklist |
| GET / PUT | /creators/me/kyc | GET is masked. PUT requires step-up, triggers penny-drop verification, and sets `payoutHoldUntil` if changed. |
| GET | /opportunities | Campaigns in SUBMITTED through ACTIVE that match the creator; no brand contacts |
| POST | /opportunities/:campaignId/interest | Toggle |
| GET | /offers, /offers/:offerId | Own only |
| POST | /offers/:offerId/accept, /decline, /counter | Idempotent; state checked; counter amount within ±50% of the offer |
| GET | /wallet | Totals by payout status |
| GET | /payouts, /payouts/:id/statement.pdf | Own only; the PDF comes as a signed link |
| GET | /referrals/me | Code, link and referral list (display names only) |

### 16.4 Brand
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | /brands/me | |
| PUT | /brands/me/logo | `fileId` of a READY BRAND_LOGO file |
| POST | /campaigns | Creates a DRAFT |
| GET | /campaigns, /campaigns/:id | Own only |
| PUT | /campaigns/:id/wizard/:step | DRAFT only |
| POST | /campaigns/:id/submit | Full validation; DRAFT → SUBMITTED |
| POST | /campaigns/:id/cancel | Allowed states only; reason required |
| GET | /campaigns/:id/shortlist | Brand view of the items (no payout, no notes) |
| POST | /campaigns/:id/shortlist/select | `{ itemIds[] }`; creates offers; moves to CREATORS_SELECTED |
| POST | /campaigns/:id/shortlist/:itemId/reject | Optional reason |
| GET | /campaigns/:id/checkout | Server-computed summary of AWAITING_PAYMENT deals |
| POST | /payments/orders | `{ campaignId }` + Idempotency-Key. The server computes the amount and creates the Razorpay order. Returns `{ orderId, amount, currency, keyId }`. |
| POST | /payments/verify | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` is HMAC-verified and marks the payment as "client confirmed". **Only the webhook moves deals forward.** |
| GET | /invoices, /invoices/:id/pdf | Own only; signed link |
| GET | /campaigns/:id/report, /campaigns/:id/report.pdf | ACTIVE or COMPLETED |
| GET / POST / DELETE | /brands/me/favourites[/:creatorId] | |

### 16.5 Deals, drafts, files, chat, notifications, ratings, disputes
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | /deals?status=&type= | creator / brand | Scoped to the user's own deals |
| GET | /deals/:id | parties | Role serializer |
| GET | /deals/:id/drafts | parties | Brand sees only drafts that were SENT_TO_BRAND or later; internal comments are hidden |
| POST | /deals/:id/drafts | creator | State: IN_PRODUCTION or REVISION_REQUESTED; `{ fileIds[], caption?, note? }` |
| POST | /deals/:id/drafts/:draftId/comments | brand (BRAND_REVIEW), admin | `{ text, timestampSec? }` |
| POST | /deals/:id/approve | brand | State: BRAND_REVIEW |
| POST | /deals/:id/request-revision | brand | Revision limit; comment required |
| POST | /deals/:id/live | creator | State: APPROVED; `{ url, screenshotFileIds?, metrics? }` |
| POST | /deals/:id/metrics | creator | Update metrics after going live (only while VERIFIED, within 14 days) |
| POST | /deals/:id/rating | brand | COMPLETED, once only |
| POST | /deals/:id/disputes | parties | Allowed states only |
| POST | /uploads/presign | logged in | `{ purpose, relatedId?, fileName, mime, size }`. Checks that the purpose is allowed for the role and the related entity is owned and in the right state. |
| POST | /uploads/:fileId/complete | uploader | Magic-byte check, size check, EXIF strip, thumbnail → READY or REJECTED |
| GET | /files/:fileId | authorized | Policy by purpose and related entity. Returns `{ url }` (signed GET, 5 min, `Content-Disposition` set). |
| GET | /deals/:id/messages | parties + admin | Cursor pagination |
| POST | /deals/:id/messages | parties + admin | Also sent over socket; masked; M limit |
| GET | /notifications | logged in | |
| POST | /notifications/read | logged in | `{ ids[] }` or `{ all: true }` |

### 16.6 Admin (`/admin/*`)
Every route here: `authenticate` → `role admin` → `adminRole` check → validate. **Every write creates an AuditLog entry.**

| Method | Path | Admin role | Notes |
|---|---|---|---|
| GET | /admin/dashboard | all | Counts, queues and alerts |
| GET | /admin/creators?status=&category=&city=&q=&band= | reviewer, cm | Filtering + cursor pagination |
| GET | /admin/creators/:id | reviewer, cm | Full admin view, with KYC masked |
| POST | /admin/creators/:id/claim | reviewer | SUBMITTED → UNDER_REVIEW |
| POST | /admin/creators/:id/decision | reviewer | `{ decision, scores, reasonCode, reasonText }` |
| POST | /admin/creators/:id/pending-changes/decision | reviewer | Approve or reject a profile edit |
| PATCH | /admin/creators/:id/tags, /notes | reviewer, cm | |
| POST | /admin/users/:id/suspend, /unsuspend | super_admin | Reason required; bumps tokenVersion |
| GET | /admin/brands, /admin/brands/:id | cm | |
| GET | /admin/campaigns?status= ; /admin/campaigns/:id | cm | |
| POST | /admin/campaigns/:id/claim | cm | → IN_REVIEW, sets `assignedManagerId` |
| GET | /admin/campaigns/:id/matches | cm | Ranked creators with the match score breakdown |
| POST | /admin/campaigns/:id/shortlist | cm | `{ items: [{ creatorId, creatorPayoutPaise, brandPricePaise?, note? }] }` |
| POST | /admin/campaigns/:id/shortlist/send | cm | → SHORTLIST_SENT; notifies the brand |
| PATCH | /admin/shortlist-items/:id | cm | Edit prices only while PROPOSED |
| POST | /admin/offers/:id/withdraw, /admin/offers/:id/resend | cm | Handles counters |
| GET | /admin/deals?status=&type= | cm | Kanban data |
| GET | /admin/deals/:id | cm, finance | |
| POST | /admin/deals/:id/drafts/:draftId/decision | cm | `{ decision: SEND_TO_BRAND|REQUEST_CHANGES (or APPROVE for INTRO_REEL), comment }` |
| POST | /admin/deals/:id/live/decision | cm | `{ decision: VERIFY|REJECT, disclosureVerified, matchesApprovedDraft, reason? }` |
| POST | /admin/deals/:id/cancel | cm | Reason required |
| GET | /admin/disputes ; POST /admin/disputes/:id/resolve | cm, super_admin | Refund amount → finance task |
| GET | /admin/payments ; POST /admin/payments/:id/refund | finance | Refund through the provider; ledger entries; step-up |
| GET | /admin/invoices ; GET /admin/exports/gst.csv, /admin/exports/tds.csv?from=&to= | finance | CSV injection-safe: prefix cells starting with `= + - @` with `'` |
| GET | /admin/payouts?status= | finance | |
| POST | /admin/payouts/:id/approve | finance | Records `approvedBy` |
| POST | /admin/payouts/:id/release | finance (+ super_admin above threshold) | Step-up; `releasedBy ≠ approvedBy`; manual: `{ reference }` |
| POST | /admin/payouts/:id/hold, /admin/payouts/:id/retry | finance | Reason required |
| POST | /admin/kyc/:creatorId/reveal | finance | Step-up + `{ reason }`. Returns the decrypted value once (not cached). Audited and alerted. |
| POST | /admin/kyc/:creatorId/verify | finance | Manual verification fallback |
| GET / POST / PATCH / DELETE | /admin/content, /admin/faqs, /admin/case-studies | super_admin | Plain text / structured only (no HTML) |
| CRUD | /admin/catalog/categories, /cities, /packages | super_admin | Soft-deactivate; never hard-delete a key in use |
| GET / PATCH | /admin/settings | super_admin | Step-up; audited diff |
| POST | /admin/broadcasts ; GET /admin/broadcasts | super_admin | Preview the recipient count before sending; rate-limited queue |
| GET | /admin/analytics?from=&to= | super_admin, finance | Revenue, margin, funnel, by category/city |
| GET | /admin/team ; POST /admin/team/invite ; PATCH /admin/team/:id ; POST /admin/team/:id/revoke | super_admin | A super_admin cannot demote themselves if they are the last one |
| GET | /admin/audit-logs?actor=&action=&entity=&from=&to= | super_admin | Read-only; no edit or delete endpoints exist |

### 16.7 Webhooks and dev
| Method | Path | Notes |
|---|---|---|
| POST | /webhooks/razorpay | Raw body; verify `X-Razorpay-Signature` = HMAC_SHA256(rawBody, webhookSecret) with a timing-safe compare; dedupe by event ID; handles `payment.captured`, `payment.failed`, `refund.processed`, and payout events. Responds 200 quickly; processes in a transaction or a queued job. |
| POST | /dev/fake-payments/:orderId/capture | **Registered only when `PAYMENT_PROVIDER=fake` and `NODE_ENV!=='production'`** |

---

## 17. Real-time (Socket.io)

- Path `/socket.io` on the API domain. CORS uses the same allowlist.
- **Handshake auth:** `auth: { token: accessToken }` is verified like `authenticate`. If invalid, disconnect.
- Each user automatically joins room `user:<id>` for notifications.
- `deal:join { dealId }`: the server checks the user is a party to the deal or an admin, then joins `deal:<id>`.
- `message:send { dealId, body }`: validated (1–1000 characters), rate limited (10 per 10 seconds), **PII-masked on the server**, saved, then emitted.
- **PII masking:** phone numbers (Indian 10-digit, with or without +91, spaces or dashes), emails, UPI IDs (`x@y`) and `@handles`. Replace them with `[hidden by Bluenova]`, set `wasMasked`, and show the sender a tip: "For your safety, contact details are hidden."
- Re-authenticate when the token expires. The client reconnects with a fresh token.

---

## 18. Background jobs (worker)

| Job | Trigger | Action |
|---|---|---|
| `notify` | Domain events | Fan out to in-app (socket + DB), WhatsApp template, email; retry with backoff |
| `otp.sms` | OTP request | Send through SmsProvider |
| `offers.expire` | Hourly cron | SENT offers past `expiresAt` → EXPIRED; notify |
| `deals.reminders` | Hourly cron | Draft due in 48h/24h, brand review pending 48h, live link due |
| `deals.autoApprove` | Hourly cron | BRAND_REVIEW older than `brandReviewAutoApproveDays` → APPROVED (actor: system) |
| `payouts.releaseHolds` | Hourly cron | ON_HOLD → PENDING_APPROVAL when the hold has passed and KYC is VERIFIED |
| `invoice.generate` | Payment captured | PDF (pdfkit) → private bucket → `Invoice.pdfFileId` |
| `report.generate` | On request | Campaign report PDF |
| `files.cleanup` | Daily | Delete PENDING files older than 24h and orphaned objects |
| `kyc.verifyBank` | KYC save | Penny drop through the provider |
| `creatorScore.recalc` | Rating + nightly | |
| `instagram.sync` | Daily (Phase 3) | Refresh stats for connected accounts |
| `account.export` | DPDP request | Build a JSON + files zip → signed link valid for 24h |
| `account.delete` | Grace period passed | Anonymize the user (phone/email hashed, names removed), delete KYC and files, keep ledger and invoices with pseudonymized refs, revoke sessions |
| `broadcast.send` | Admin | Throttled send to filtered recipients; record counts |
| `security.alerts` | Events | Email/WhatsApp to super_admins on KYC reveal, payout release, refresh-token reuse, webhook signature failure, OTP abuse spikes |

---

## 19. Notifications

Text uses i18n keys with params, sent in the user's `preferredLanguage`. WhatsApp uses **pre-approved templates**: create a `docs/WHATSAPP_TEMPLATES.md` listing each template's name, language and body for submission to Meta.

| Event | Recipient | Channels |
|---|---|---|
| OTP | user | SMS |
| Creator submitted | creator; reviewers | in-app + WA; in-app |
| Creator approved / changes requested / rejected | creator | in-app + WA + email |
| Intro reel draft decision / live verified | creator | in-app + WA |
| Campaign submitted | cms | in-app + email |
| Shortlist ready | brand | in-app + WA + email |
| New offer / offer expiring in 12h / offer expired | creator | in-app + WA |
| Offer accepted / declined / countered | cm (+ brand when accepted) | in-app |
| Payment captured | brand (invoice), creator (start work) | in-app + email / WA |
| Draft submitted | cm | in-app |
| Draft sent to brand / review reminder | brand | in-app + WA + email |
| Revision requested / approved | creator | in-app + WA |
| Live verified | creator, brand | in-app + WA |
| Payout on hold / approved / paid | creator | in-app + WA (paid: + email statement) |
| Bank details changed | creator | WA + SMS ("If this wasn't you, contact +91 76002 36644") |
| Dispute opened / resolved | parties, cm | in-app + email |
| New login on a new device (admin) | admin | email |

Every message that contains a link points only to an internal `bluenovatech.in` path and includes the line **"Bluenova will never ask for your OTP."**

---

## 20. File uploads

1. `POST /uploads/presign`:
   - The server checks the purpose is allowed for the role and the related entity is owned and in the right state.
   - It creates a `File{PENDING}` and returns an **S3 presigned POST** containing:
     - the exact key `purpose/yyyy/mm/<uuid>.<ext>`,
     - the `Content-Type` condition,
     - `content-length-range`,
     - a 10-minute expiry.
2. The browser uploads directly to the bucket and shows a progress bar.
3. `POST /uploads/:id/complete`:
   - The server reads the object head and the first bytes, detects the MIME type with the `file-type` library, and rejects it if it doesn't match the allowlist.
   - Images are re-encoded with sharp (EXIF stripped). A thumbnail is generated.
   - Status becomes READY, or REJECTED (and the object is deleted).
4. Allowlist by purpose:

| Purpose | Types | Max size |
|---|---|---|
| DEAL_DRAFT | mp4, mov, jpg, png, webp | 300 MB video, 10 MB image |
| LIVE_SCREENSHOT, STATS_SCREENSHOT | jpg, png, webp | 10 MB |
| KYC_DOC | jpg, png, pdf | 5 MB (**KYC bucket**) |
| BRAND_LOGO | png, jpg, webp | 2 MB |
| DISPUTE_EVIDENCE | jpg, png, pdf, mp4 | 50 MB |
| CMS_IMAGE | jpg, png, webp | 5 MB |

5. Both buckets block all public access and have SSE encryption on. The KYC bucket is only accessible by the API role. Files are served **only** through `GET /files/:id` (a policy check, then a 5-minute signed URL with `Content-Disposition: attachment` for PDFs).
6. Never use user-supplied file names in storage keys. Store the original name (sanitized) for display only.

---

## 21. Payments, invoices, payouts, ledger

1. **Checkout:**
   - The server loads AWAITING_PAYMENT deals for the campaign, sums the brand prices, and computes GST (CGST + SGST vs IGST by state).
   - It creates a Payment(CREATED) and a Razorpay order (`amount` in paise, `receipt = payment._id`, `notes: { campaignId }`).
   - It returns the order details for Razorpay Checkout. The amount is **never accepted from the client**.
2. **Client verify:** the server computes `HMAC_SHA256(order_id + '|' + payment_id, key_secret)` and compares with a timing-safe check. This only marks the payment as "client confirmed" for the UI.
3. **Webhook `payment.captured`** (signature verified, deduped), in a **Mongo transaction**:
   - Payment → CAPTURED
   - Deals → IN_PRODUCTION
   - Campaign → ACTIVE
   - Ledger entries: BRAND_PAYMENT_RECEIVED (total), GST_PAYABLE, CREATOR_PAYABLE (sum of payouts), PLATFORM_REVENUE (sum of margins)
   - Queue the invoice PDF and notifications
4. **Refund:** finance only, with step-up and a reason. Goes through the provider refund API, then ledger REFUND_ISSUED, deal CANCELLED, and the affected creator is notified.
5. **Payout:**
   - Created when a deal is VERIFIED.
   - `gross = creatorPayout`, `tds = gross × tdsRate`, `net = gross − tds`.
   - Follows the maker-checker flow (§11.5).
   - On PAID: ledger PAYOUT_SENT (+ TDS_PAYABLE), deal → COMPLETED.
6. **Invariant tests:**
   - For every payment, the ledger must balance: received = GST + creator payable + platform revenue.
   - The sum of payouts never exceeds creator payable.

---

## 22. Frontend architecture

### 22.1 Apps and domains
- `apps/web` serves `bluenovatech.in` (public) and `app.bluenovatech.in` (logged-in areas). The same build can be used for both, with routes under `/creator/*` and `/brand/*`.
- `apps/admin` serves `admin.bluenovatech.in`, as a separate build. Its code is never included in the web app.

### 22.2 Data and auth on the client
- **API client:** a fetch wrapper with `credentials: 'include'`.
  - Adds `Authorization: Bearer <memory token>` and a generated `Idempotency-Key` for mutations that need one.
  - On 401 `UNAUTHENTICATED`, calls `/auth/refresh` **once** (single-flight lock), then retries. If that fails, clear the user state and redirect to `/login?next=<safe current path>`.
- **On app boot:** call `/auth/refresh` silently to restore the session (the cookie is httpOnly).
- **TanStack Query** for server state, with query keys per resource. **Never put tokens or PII in query keys that are persisted.** No query persistence to localStorage.
- **Route guards (UX only):**
  - `RequireAuth`, `RequireRole('creator'|'brand')`, `GuestOnly`.
  - `RequireState`: reads status from the server and redirects to the correct step (for example, an unapproved creator opening `/creator/dashboard` is sent to `/creator/status`).
  - Admin: `RequireAdmin(adminRoles[])`.
- **`safeRedirect(next)`:** accept only values that start with `/`, do **not** start with `//` or `/\`, and contain no scheme. Otherwise use the role's dashboard.
- **Forms:** React Hook Form + the zod schemas from shared. Server field errors are mapped onto form fields. Submit buttons are disabled while pending. Multi-step wizards autosave on "Next" (server draft) and restore on reload.
- **External links:** a component `ExternalLink` that renders only `https:` URLs with `target="_blank" rel="noopener noreferrer nofollow"`. **Never render `javascript:` URLs.**
- **Instagram previews:** use oEmbed data fetched by the server. If the official embed script is used, load it lazily on demand and allow it in the CSP. Otherwise show a thumbnail card with an external link.
- **Code splitting:** lazy-load each area (`creator`, `brand`). Public pages are pre-rendered.

---

## 23. Pages (complete list, with content and behaviour)

Every logged-in page has:
- loading skeletons,
- an error state with a retry button,
- an empty state with guidance and a primary action,
- mobile layout first.

### 23.1 Public (bluenovatech.in) — `PublicLayout`
The header has the logo, nav (For Creators, For Brands, About, FAQ, Contact), a language switch (ગુ / EN) and a Login button. The footer has contact details (+91 76002 36644, bluenovatech.in), legal links, and social links.

| Path | Content |
|---|---|
| `/` | Hero: "Brands અને Creators ને જોડતું platform", with two CTAs (I'm a Creator / I'm a Brand). How it works (3 steps for each side), category grid (16), why Bluenova (verified creators, safe payments, managed content, reports), case-study teaser, FAQ teaser, CTA band. |
| `/for-creators` | Content from §3.1 with the 5-step visual timeline, categories, benefits, FAQ, and the CTA "Collab માટે Apply કરો" → `/join/creator` |
| `/for-brands` | Benefits, how it works (requirement → shortlist → content → results), packages (from the API), filters explained, FAQ, CTA → `/join/brand` |
| `/about` | CMS block |
| `/faq` | Tabs for Creators and Brands (from the API) |
| `/case-studies`, `/case-studies/:slug` | Published only |
| `/contact` | Form (§24), phone and WhatsApp click-to-chat link `https://wa.me/917600236644` |
| `/privacy`, `/terms`, `/creator-agreement`, `/brand-agreement`, `/refund-policy` | CMS-managed, versioned, gu/en |
| `/c/:slug` | Public creator media kit (only if opted in): display name, categories, city, follower band, reels. **No contacts.** CTA "Work with creators like this" → `/for-brands`. |
| `/login` | Phone input → `/login/verify` (OTP input, resend timer, "change number"). `?next=` goes through `safeRedirect`. |
| `/join/creator`, `/join/brand` | Same OTP flow, with the role preselected and consent checkboxes (links to the policies). `?ref=` is stored for referral. |
| `/welcome/role` | For new users with no role: two large cards (Creator / Brand) |
| `/verify-email` | Consumes the token, shows the result, and strips the token from the URL |
| `/404`, `/session-expired`, `/maintenance` | |

### 23.2 Creator area — `AppLayout(creator)`
Mobile bottom navigation: **Home · Opportunities · Deals · Earnings · Profile**. On desktop, these become a sidebar.

| Path | Guard | Content |
|---|---|---|
| `/creator/onboarding/1..5` | profile DRAFT / CHANGES_REQUESTED | Stepper with progress, one task per screen, autosave. A "Changes requested" banner shows the reviewer's reason. Step 5 is the summary with edit links and the Submit button. |
| `/creator/status` | role | StatusTimeline (Submitted → Under review → Decision), reason, next steps. If REJECTED, shows the reapply date. |
| `/creator/dashboard` | APPROVED | Partner badge, intro reel card (if not completed), active deals with the next action and deadline, new offers, earnings summary, profile completeness meter, tips |
| `/creator/intro-reel` | APPROVED | Brief (§3.2) with the name filled in, a gender form toggle for the verb, the 7-item checklist (all required before upload), FileUploader, draft history and comments, live link form, StatusTimeline |
| `/creator/opportunities` | APPROVED | Cards: brand company name, goal, deliverables, city, dates, collab type, budget band (never the exact brand price). "Interested" toggle. Filters. |
| `/creator/opportunities/:id` | APPROVED + match | Details (no brand contacts) |
| `/creator/offers`, `/creator/offers/:id` | own | Payout (big and clear), deliverables, deadlines, brief, guidelines including the **mandatory #ad**, expiry countdown, and Accept / Decline (reason) / Counter (amount + note) buttons. Accept opens a confirmation dialog that summarizes the obligations. |
| `/creator/deals` | own | Tabs: Active / Completed / All. Each DealCard shows status and the next action. |
| `/creator/deals/:id` | own | Deal workspace (§23.4) |
| `/creator/earnings` | own | Totals (On hold, Pending approval, Approved, Paid), payouts list, statement PDF download, KYC status banner |
| `/creator/kyc` | step-up to edit | Masked view. Edit form (PAN, payout method, bank or UPI, account number entered twice). Verification status. Notice explaining the 48-hour payout hold after changes. |
| `/creator/profile` | own | Media kit preview; edit (APPROVED creators see a "will be re-reviewed" note); availability; public profile toggle; rate card |
| `/creator/referrals` | APPROVED | Code, share buttons (WhatsApp), list |
| `/creator/notifications` | own | List, mark all read |
| `/creator/settings` | own | Language, phone change (step-up), log out of all devices, privacy: download my data, delete account (step-up + confirm, with grace-period explanation) |

### 23.3 Brand area — `AppLayout(brand)`
Mobile bottom navigation: **Home · Campaigns · Deals · Invoices · Account**.

| Path | Guard | Content |
|---|---|---|
| `/brand/onboarding` | INCOMPLETE | Company, contact, email (verify), GSTIN (optional, format check), industry, city, billing address, logo |
| `/brand/dashboard` | ACTIVE | Campaigns by status, actions needed (shortlist ready, drafts to review, payment pending), live results summary, CTA "New campaign" |
| `/brand/campaigns` | own | List with StatusBadge |
| `/brand/campaigns/new`, `/brand/campaigns/:id/edit/:step` | DRAFT | 6-step wizard (§5.2) with chip selectors, a package picker, autosave and a review step |
| `/brand/campaigns/:id` | own | Overview, StatusTimeline, deals table, actions by state |
| `/brand/campaigns/:id/shortlist` | SHORTLIST_SENT+ | CreatorCards: display name, city, categories, follower band, engagement, score, reel previews, brand price. Select with checkboxes, then a sticky footer with the count and total. Confirm dialog. |
| `/brand/campaigns/:id/checkout` | deals AWAITING_PAYMENT | Server summary (per-creator lines, subtotal, GST split, total), terms acceptance checkbox, Razorpay button. Post-payment screen: "Payment safely held by Bluenova" with a link to the invoice. |
| `/brand/deals`, `/brand/deals/:id` | own | Deal workspace (§23.4), brand view |
| `/brand/campaigns/:id/report` | ACTIVE / COMPLETED | Totals (views, likes, comments, reach, cost per view), per-creator table with live links, Download PDF |
| `/brand/invoices` | own | List, PDF download |
| `/brand/favourites` | own | Saved creators; "Request these creators" pre-fills a new campaign |
| `/brand/notifications`, `/brand/settings` | own | Same as the creator pages, plus company profile edit |

### 23.4 Deal workspace (shared component, role-aware)
- **Header:** campaign or intro title, the other party's display/company name (no contacts), a StatusBadge, a horizontal **StatusTimeline**, deadlines with countdowns, and the next-action callout ("Upload your draft by 12 Oct").
- **Brief tab:** deliverables, do's and don'ts, references (ExternalLink), hashtags and mentions, and a highlighted **disclosure requirement: "#ad / Paid partnership label ફરજિયાત છે"**.
- **Drafts tab:**
  - Version list. The video player supports **timestamp comments**: click on the timeline to comment at mm:ss, and clicking a comment seeks the video to that point.
  - Creator: upload a new version (enabled only in allowed states).
  - Brand: Approve, or Request revision (showing "revisions left: n").
  - Admin-only internal comments are never sent to the brand or creator API responses.
- **Live tab:** the creator submits the URL plus an optional metrics screenshot. Shows the verification result and metrics.
- **Chat tab:** real-time, masked contacts, safety tip banner.
- **Payment/Payout panel:** the brand sees price and invoice; the creator sees payout and its status.
- **Rating** (brand, when COMPLETED), and **Raise dispute** (with a reason form).

### 23.5 Admin app (admin.bluenovatech.in) — `AdminLayout`
Sidebar navigation. Menu items depend on the admin sub-role. Light, data-dense tables using shadcn `DataTable` with column filters, cursor pagination and CSV export where allowed.

| Path | Admin role | Content |
|---|---|---|
| `/login` → `/login/totp`, `/invite/:token` | public | OTP, then TOTP. The invite flow does TOTP enrollment (QR code) and backup codes. |
| `/` | all | Queues (pending creators, campaigns to shortlist, drafts to pre-approve, live links to verify, payouts awaiting approval/release, open disputes), today's alerts, KPIs |
| `/creators`, `/creators/:id` | reviewer, cm | Filters. Detail: profile, reels (embedded), stats + screenshot, review scorecard (4 × 1–5), decision form (reason templates in gu/en), pending changes diff, tags/notes, deals history, KYC status (masked) |
| `/brands`, `/brands/:id` | cm | Profile, campaigns, payments, notes |
| `/campaigns`, `/campaigns/:id` | cm | Requirement details, **Match tool**: ranked creators with the score breakdown, filters, and "Add to shortlist" with payout input that auto-suggests the brand price from the margin (editable, shows the margin). Shortlist builder, then Send. Offers status panel. |
| `/deals` | cm | **Kanban** by status (drag is disabled; moves only happen through actions, so state rules are enforced), filters by campaign, creator or type |
| `/deals/:id` | cm, finance | Full workspace including internal comments, draft decision, live verification checklist (link opens, matches the approved draft, disclosure present, posted from the correct account), cancel, dispute |
| `/payments`, `/payments/:id` | finance | List, details, refund (step-up) |
| `/payouts` | finance | Tabs: On hold / Pending approval / Approved / Paid / Failed. Approve; Release (shows "approved by X — you must be a different person"); UTR entry |
| `/kyc/:creatorId` | finance | Masked details, verification status, **Reveal** button (step-up + reason; the value auto-hides after 30 seconds) |
| `/disputes`, `/disputes/:id` | cm, super_admin | Evidence, resolution, refund request |
| `/invoices`, `/exports` | finance | GST and TDS CSV exports |
| `/broadcasts` | super_admin | Audience filter builder showing the recipient count, template picker, preview, send |
| `/content` | super_admin | Edit CMS blocks gu/en side by side, FAQs, case studies, intro reel script, legal pages (versioned) |
| `/catalog` | super_admin | Categories, cities, packages |
| `/settings` | super_admin | All Settings fields, with step-up and a diff preview before saving |
| `/team` | super_admin | Members, roles, invite, revoke, last login, 2FA status |
| `/audit-logs` | super_admin | Filterable, read-only, CSV export |
| `/analytics` | super_admin, finance | Revenue, GST, margin, payouts over time; funnel (applications → approved → first deal); creators by category and city; repeat brands |

---

## 24. Forms and validation (zod, in shared)

Common rules:
- Trim all strings.
- Collapse internal whitespace for names.
- Reject control characters.
- Allow Gujarati Unicode (`\p{Script=Gujarati}`) in names and free text.
- Free text is plain text only (no HTML, rendered escaped).
- Each field below lists its max length.

| Form | Fields and rules |
|---|---|
| Phone | `^[6-9]\d{9}$` (UI shows a fixed +91 prefix) |
| OTP | `^\d{6}$`; OtpInput with paste support and `autocomplete="one-time-code"` |
| Creator step 1 | fullName 2–60 (letters, spaces, `.`, `'`, Gujarati); displayName 2–40; igHandle `^[A-Za-z0-9._]{1,30}$` (strip a leading `@`, reject consecutive dots); city ∈ cities; languages 1–3 ∈ {gu,hi,en}; gender? ∈ enum; ageGroup? ∈ enum; bio ≤300; consents: privacy + terms + creator_agreement must be true (with version) |
| Creator step 2 | categories: 1–3 unique ∈ active categories |
| Creator step 3 | reels: 2–3 unique URLs matching `^https://(www\.)?instagram\.com/(reel|reels|p)/[A-Za-z0-9_-]{5,}/?(\?.*)?$`, normalized (query string stripped) |
| Creator step 4 | followers int 0–100,000,000; avgViews int ≥0; engagementRate 0–100 (2 decimals → bps); rateCard values in ₹ (int, 0–10,00,000) → paise; acceptsBarter bool; statsScreenshot optional fileId |
| Brand onboarding | companyName 2–100; contactName 2–60; designation ≤60; email (RFC, lowercase, ≤254); gstin? `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` (uppercase; the first 2 digits set stateCode); industry ∈ categories; city ∈ cities; website? https URL ≤200; address line1 ≤120, line2 ≤120, pincode `^[1-9]\d{5}$`, state ∈ Indian states list |
| Campaign | title 3–100; goal ∈ enum; description 20–2000; filters (arrays from enums, each ≤16); deliverables 1–5 rows (type ∈ enum, qty 1–10); creatorsNeeded 1–50; collabType; product (required unless PAID: name ≤100, value ₹ int); budget min ≤ max, or suggest=true, or package; startDate ≥ today (IST); endDate > startDate and ≤ start + 180 days; dos/donts ≤10 items × ≤200 characters; referenceUrls ≤5 https; hashtags ≤10 `^#[\p{L}\p{N}_]{1,50}$`; mentions ≤5 `^@[A-Za-z0-9._]{1,30}$`; maxRevisions 0–3; usageRights.durationDays 0–365 |
| Shortlist select | itemIds 1–50 ObjectIds belonging to this campaign |
| Offer counter | amount ₹ int within ±50% of the offer; note ≤300 |
| Decline offer | reason ∈ {busy, budget_low, category_mismatch, other} + text ≤300 |
| Draft submit | fileIds 1–10 READY files of purpose DEAL_DRAFT owned by the user; caption ≤2200; note ≤500 |
| Comment | text 1–1000; timestampSec 0–600 int optional |
| Live link | url (same Instagram regex); metrics ints ≥0; screenshotFileIds ≤5 |
| Rating | rating 1–5 int; tags ⊆ enum; comment ≤500 |
| Dispute | reason ∈ enum + text 20–1000; evidence ≤5 files |
| KYC | pan `^[A-Z]{5}[0-9]{4}[A-Z]$` (uppercase); panName 2–100; method; bank: holderName 2–100, account `^\d{9,18}$` + confirm equal, ifsc `^[A-Z]{4}0[A-Z0-9]{6}$`; or upi `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$` |
| Contact | name 2–60; phone or email (at least one); message 10–1000; hidden honeypot field `website` must be empty; captcha token |
| Admin decision | decision ∈ enum; reasonCode ∈ enum (required unless APPROVED); reasonText ≤1000; scores 1–5 each (required for APPROVED/REJECTED) |
| Pricing (admin) | creatorPayout ₹ int ≥0; brandPrice ₹ int ≥ creatorPayout |
| Settings (admin) | bps 0–10000; hours/days positive ints with sane max values |

Wizards:
- **Server-side drafts.** Each step is validated with its own schema on save.
- **Final submit re-validates the complete object.** The server ignores the client's claimed step order and current step.

---

## 25. UI/UX design system

### 25.1 Principles
1. **Clear for everyone:** one primary action per screen, plain words, no jargon. For example, say "Payment safely held", never "escrow".
2. **Mobile-first:** design at 360px width first. Tap targets ≥44px. Use a sticky bottom action bar for primary actions on mobile.
3. **Always show what's next:** StatusTimeline on every entity, and a "Next step" callout on dashboards and in the deal workspace.
4. **Bilingual:** Gujarati-first copy for creators, in the friendly Gujarati-English mix used in §3 (for example, "તમારી Profile Review માં છે ⏳"). The brand area defaults to English with Gujarati available. Show a language switch everywhere.
5. **Forgiving:** autosave, confirmation dialogs for irreversible actions, an undo toast where possible, and helpful error messages next to fields.
6. **Trust signals:** Partner badge, "Verified by Bluenova", "Payment safely held", a lock icon next to masked data.

### 25.2 Design tokens (Tailwind preset in `packages/config`; CSS variables)
```
--color-primary: #1647D8   (Bluenova blue)       --color-primary-hover: #0F37AE
--color-primary-soft: #E8EEFD                     --color-navy: #0B1F4D (headings, footer)
--color-accent: #00A99D   (teal, success CTAs)    --color-bg: #F7F9FC   --color-surface: #FFFFFF
--color-text: #0F172A     --color-text-muted: #5B6476   --color-border: #E2E8F0
--color-success: #16A34A  --color-warning: #D97706  --color-danger: #DC2626  --color-info: #0284C7
--radius: 12px (cards), 10px (inputs/buttons), 999px (chips)
--shadow-card: 0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.06)
Spacing: 4px base scale. Max content width 1200px. Page gutter 16px mobile / 24px desktop.
Typography: Inter (Latin) + Noto Sans Gujarati (Gujarati), self-hosted. Base 16px, line-height 1.6 (Gujarati needs extra height).
Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36. Headings 600–700 weight.
```
All text must meet WCAG AA contrast. Dark mode is out of scope for v1, but keep the tokens structured so it can be added later.

### 25.3 Status colours (StatusBadge, consistent everywhere)
- Grey: draft
- Blue: submitted / in review
- Amber: action needed (changes requested, revision requested, awaiting payment, on hold)
- Teal: in progress
- Green: approved / verified / paid / completed
- Red: rejected / cancelled / failed / disputed

Every badge has an icon and text, **never colour alone**.

### 25.4 Components to build
Button (primary/secondary/ghost/danger, loading state), Input, Textarea (with counter), Select, **ChipSelect** (multi, with max limit), **Stepper**, **StatusTimeline**, **StatusBadge**, Card, **CreatorCard**, **DealCard**, **CampaignCard**, **EmptyState** (illustration + text + action), **FileUploader** (drag/drop + camera on mobile, progress, retry, type/size hints), **VideoReview** (player + timestamp comments), **ReelPreview**, **Money** (`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`, e.g. ₹1,25,000), **DateTime** (IST, relative + absolute), **Countdown**, **OtpInput**, **MaskedValue** (lock icon), **ConfirmDialog**, Toast (`aria-live`), Skeletons, **LanguageSwitch**, **ExternalLink**, **DataTable** (admin), **KanbanBoard** (admin, action-driven), **Checklist**, **SafetyTip** banner.

### 25.5 Accessibility and performance
- **WCAG 2.1 AA:**
  - semantic HTML, a label on every input, `aria-describedby` for errors,
  - visible focus rings, full keyboard navigation (including OTP, dialogs and chips),
  - `prefers-reduced-motion` respected,
  - `lang` attribute switches between `gu` and `en`,
  - alt text on images.
- **Lighthouse (mobile) targets:** Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on public pages.
- Route-level code splitting, lazy images, and font subsetting (Gujarati + Latin). Under 200 KB JS gzipped for the public home page.

### 25.6 Sample i18n keys (provide full gu and en files)
```json
// gu/common.json
{ "cta.applyCreator": "Collab માટે Apply કરો", "cta.startCampaign": "Campaign શરૂ કરો",
  "status.creator.SUBMITTED": "Submit થઈ ગયું ✅", "status.creator.UNDER_REVIEW": "તમારી Profile Review માં છે ⏳",
  "status.creator.APPROVED": "Approved! તમે હવે Official Creator Partner છો 🎉",
  "status.creator.CHANGES_REQUESTED": "થોડા ફેરફાર જરૂરી છે", "payment.held": "Payment Bluenova પાસે સુરક્ષિત છે 🔒",
  "safety.otp": "Bluenova ક્યારેય તમારો OTP માંગશે નહીં.", "chat.masked": "તમારી સુરક્ષા માટે contact details છુપાવવામાં આવી છે.",
  "empty.offers": "હજુ કોઈ offer નથી. તમારી profile પૂર્ણ કરો અને વધુ offers મેળવો.",
  "deal.disclosure": "#ad / Paid partnership label ફરજિયાત છે" }
```
Every API error code and field error key must have gu and en translations. Add a CI check that fails if any key is missing in either language.

---

## 26. Public site and SEO
- Pre-rendered public routes. Unique `<title>` and meta description per page (gu and en). Open Graph image.
- `hreflang` alternates via a `?lang=` URL or path prefix (pick one and document it).
- JSON-LD `Organization` with contact point +91 76002 36644.
- `sitemap.xml` (public pages and published case studies), `robots.txt` (disallow `/creator`, `/brand`, `/login`, `/join`; the admin domain is entirely disallowed and sends `X-Robots-Tag: noindex`).

---

## 27. Security requirements (all mandatory)

### 27.1 HTTP headers (helmet + hosting)
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://checkout.razorpay.com https://challenges.cloudflare.com;
  frame-src https://api.razorpay.com https://checkout.razorpay.com https://challenges.cloudflare.com https://www.instagram.com;
  img-src 'self' data: blob: https://<files-cdn-or-bucket-host> https://*.cdninstagram.com;
  media-src 'self' blob: https://<files-bucket-host>;
  connect-src 'self' https://api.bluenovatech.in wss://api.bluenovatech.in https://<bucket-host> https://lumberjack.razorpay.com;
  style-src 'self' 'unsafe-inline';   (Tailwind/Radix runtime styles; avoid if possible with nonces)
  font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")
Cross-Origin-Opener-Policy: same-origin-allow-popups   (Razorpay popup)
```
Apply the same headers to the static frontends through hosting config (for example, Vercel `headers`). Test the CSP in report-only mode first in staging, then enforce it.

### 27.2 Input and output
- zod on every input (§24). `express-mongo-sanitize` and `hpp`. Reject request bodies larger than the limits.
- No `$where`, no string-built queries, and no user input in regexes unless escaped (use an `escapeRegex` helper for search).
- Output: React escapes by default. **`dangerouslySetInnerHTML` is forbidden** (lint rule). The CMS stores plain or structured text only.
- CSV exports are protected against formula injection.
- **SSRF:** the server only fetches allowlisted hosts (Instagram oEmbed and Graph API, provider APIs). There is no generic "fetch this URL" feature.

### 27.3 Rate limits (Redis-backed, keyed by IP and identifier/user)
| Scope | Limit |
|---|---|
| OTP request | 5/hour per phone, 20/hour per IP, 30-second cooldown |
| OTP verify | 5 attempts per OTP; 10 failures/hour, then a 30-minute lock |
| Auth refresh | 30/min per user |
| Public contact | 5/hour per IP |
| Chat | 10 per 10 seconds per user |
| Uploads presign | 30/hour per user |
| General authenticated | 120/min per user |
| Admin | 300/min per admin |
| Public GET | 300/min per IP |

Responses use status 429 with a `Retry-After` header.

### 27.4 Encryption of sensitive fields
- `utils/crypto.ts`:
  - **AES-256-GCM** with a random 12-byte IV per value.
  - Stored as `{ v: keyVersion, iv, tag, ct }` (base64).
  - Keys come from `DATA_ENCRYPTION_KEYS`.
  - `encrypt()` uses the active version. `decrypt()` uses the version stored in the record.
- **Blind index:** `HMAC-SHA256(BLIND_INDEX_KEY, normalizedValue)`, used for PAN uniqueness.
- A `scripts/rotate-keys.ts` script re-encrypts records to the new active version in batches.
- **Masking helpers:** `maskPan → XXXXXX123A`, `maskAccount → XXXXXXXX1234`, `maskUpi → ab***@okhdfc`, `maskPhone → +91 98XXXXXX10`.
- Decrypted values exist only in memory while a request is being handled. **Never log them, cache them, or return them** except through the audited reveal endpoint.

### 27.5 Account and fraud protections
- Bank or UPI change: step-up, notify on WhatsApp and SMS, set `payoutHoldUntil = now + 48h`, then penny-drop verification.
- One PAN per creator account (blind index uniqueness).
- Admin: TOTP required, invite-only accounts, 12-hour sessions, an email on login from a new device, at least two super_admins recommended (warn in the UI if there is only one).
- Suspended users lose access within 60 seconds (Redis status cache), and their sockets are disconnected.
- Payout maker-checker, enforced in code **and** covered by tests.

### 27.6 Links and navigation
- `safeRedirect` for `next=` parameters.
- `ExternalLink` only renders https links, with `noopener noreferrer`.
- Tokens in URLs (email verify, invite) are single-use, hashed and short-lived, removed from the URL after use, and kept out of logs (redact query strings on those routes).
- IDs in URLs are ObjectIds or random slugs, **never sequential**. Invoice numbers are sequential but appear only inside the documents.
- `Cache-Control: no-store` on authenticated API responses.
- Frontend 401/403/404 handling never reveals whether a resource exists.

### 27.7 Infrastructure
- MongoDB Atlas **ap-south-1 (Mumbai)**, IP allowlist or private endpoint, TLS, least-privilege users (api: readWrite on the app DB; worker: same; analytics: read), continuous backups, **quarterly restore drill** (document it in RUNBOOK).
- Redis requires a password and TLS in production.
- S3 has Block Public Access on, SSE enabled, a bucket policy that denies non-TLS requests, and lifecycle rules for temp files.
- Secrets live in the hosting secret manager. Rotation is documented, and done immediately when a person with access leaves.
- Cloudflare in front: WAF managed rules, bot fight mode, rate limiting on `/api/v1/auth/*`, **Cloudflare Access protecting `admin.bluenovatech.in`** (team emails only).
- Separate environments: local, staging (Razorpay test keys, no real PII) and production.

### 27.8 Dependency and code security
- `pnpm audit --audit-level=high`, gitleaks secret scanning and CodeQL in CI. Dependabot weekly. Lockfile committed. Pinned Node version.
- ESLint security plugins (`eslint-plugin-security`, a `react/no-danger` rule).

---

## 28. Compliance (build features for these)
- **DPDP Act 2023 (India):**
  - Explicit consent with versioning; a notice in gu and en; purpose limitation; data minimization (**no Aadhaar collection**; KYC is requested only at the first paid offer).
  - Rights: export, correction (profile edit) and deletion (grace period plus anonymization).
  - Breach response plan in `docs/INCIDENT_RESPONSE.md` (notify the Data Protection Board and affected users).
  - A grievance contact on the privacy page.
- **CERT-In:** keep logs for 180 days. The incident runbook must support reporting within 6 hours. Servers use NTP time sync.
- **ASCI influencer guidelines / CCPA endorsement guidelines:**
  - The disclosure label (#ad / Paid partnership) is mandatory in every brief.
  - It is checked during live verification (`disclosureVerified` is required to reach VERIFIED).
- **GST/TDS:** configurable rates and exports. The UI and docs say "confirm with CA".
- **Data retention:**
  - Financial records (payments, invoices, ledger) are kept for 8 years (configurable).
  - KYC documents are deleted after verification plus the retention window.
  - Chat is kept for 2 years.
  - Logs are kept for 180 days.

---

## 29. Logging, monitoring, audit
- **pino JSON logs** with `requestId`, `userId` (ID only), route, status and latency.
  - **Redact:** `req.headers.authorization`, `req.headers.cookie`, `*.otp`, `*.code`, `*.pan`, `*.account`, `*.vpa`, `*.password`, `*.token`, `*.accessToken`, `*.refreshToken`, the `phone` body field, and query strings on token routes.
- Sentry (API, web, admin) with `sendDefaultPii: false` and a scrubber for the same fields.
- **AuditLog** for every admin write, every KYC reveal, every money action, settings changes, and suspensions. It is append-only (no update or delete paths, enforced by Mongoose middleware that throws).
- **Alerts** (§18 `security.alerts`), plus uptime checks on `/healthz` (liveness) and `/readyz` (Mongo + Redis connectivity; never exposes internals).

---

## 30. Testing requirements
- **Unit tests (Vitest):**
  - state machines (every allowed and disallowed transition)
  - serializers (snapshot tests asserting forbidden fields are absent for each role)
  - money/GST/TDS/margin calculations
  - PII masking regexes
  - crypto encrypt/decrypt/rotate
  - safeRedirect
  - zod schemas (valid and invalid cases, including Gujarati text)
  - match score and creator score
- **API integration tests (Supertest + mongodb-memory-server replica set).** For **every** endpoint:
  - no token → 401
  - wrong role → 403/404
  - other user's resource → 404
  - wrong state → 409
  - invalid body → 400
  - happy path → 2xx with the correct serializer
  - Plus: refresh rotation and reuse detection, OTP limits, webhook signature (valid, invalid, duplicate), idempotency (same key returns the same response), maker-checker (same admin can't release), and the ledger balance invariant.
- **E2E (Playwright, against docker-compose with fake providers):**
  1. Creator signup → onboarding → admin approval → intro reel → completed
  2. Brand signup → campaign → admin shortlist → brand selects → creator accepts → fake payment → draft → admin pre-approve → brand revision → approve → live → verify → payout approve (admin A) → release (admin B) → completed → rating
  3. Language switch
  4. Mobile viewport run of flows 1 and 2
- **Security checks in CI:** OWASP ZAP baseline scan against staging, `pnpm audit`, gitleaks.
- **Coverage targets:** API ≥ 80% lines, and **100% of the policy, serializer, state machine and money modules**.

---

## 31. DevOps
- `infra/docker-compose.yml`: `mongo` (single-node replica set with an init script), `redis`, `minio` (+ bucket init), `mailpit`. The command `pnpm dev` runs api, worker, web and admin with hot reload.
- **Seed script:** categories, cities, packages, CMS blocks (§3 text), FAQs, settings defaults, 1 super_admin (from CLI args), and in development only: 20 sample creators across categories and cities, 3 brands, and campaigns in various states.
- **CI (GitHub Actions):** install → lint → type-check → unit and integration tests → build → audit/gitleaks/CodeQL → E2E (on main) → deploy to staging → manual approval → production.
- **Hosting:**
  - web and admin: Vercel (headers configured)
  - api and worker: Render, Railway or AWS (Mumbai), behind Cloudflare
  - Separate services for api and worker
  - Health checks
  - Zero-downtime deploys
- **Database migrations:** use `migrate-mongo` for index and data migrations. Indexes are defined in models and synced by migrations, **not** `autoIndex` in production.

---

## 32. Documentation to produce
`README.md`, `docs/ARCHITECTURE.md` (diagrams + module map), `docs/SECURITY.md` (all controls, mapped to the OWASP Top 10), `docs/API.md` (generated), `docs/DECISIONS.md`, `docs/RUNBOOK.md` (deploy, rollback, key rotation, restore drill, revoking all sessions), `docs/INCIDENT_RESPONSE.md`, `docs/WHATSAPP_TEMPLATES.md`, `docs/PRELAUNCH_CHECKLIST.md` (§34).

---

## 33. Build phases and acceptance criteria

**Phase 0: Foundation**
- **Build:** monorepo, tooling, docker-compose, env validation, shared package (enums, schemas, state machine engine), API skeleton with the full middleware order, error format, logging and redaction, provider adapters (fakes + real stubs), design tokens, UI component library, i18n setup, layouts, CI pipeline.
- **Accept when:** `pnpm dev` boots everything; healthz/readyz work; CI is green; Storybook-like preview page `/dev/ui` (dev only) shows all components in gu and en.

**Phase 1: Launch (MVP)**
- **Build:**
  - Auth (OTP, role selection, refresh rotation, step-up, admin OTP+TOTP+invites)
  - Public site with CMS
  - Creator onboarding (5 steps) and status page
  - Admin creator review (claim, scores, decisions, pending changes)
  - Partner badge
  - INTRO_REEL deal flow (drafts, uploads, admin decisions, live link, verification, chat)
  - Brand onboarding and campaign wizard
  - Admin campaign claim, match tool, shortlist builder, send
  - Brand shortlist view and selection, which creates offers
  - Creator offers (accept, decline, counter) and opportunities feed
  - Notifications (in-app + WhatsApp + email)
  - Audit log, settings, catalog, team management
  - DPDP export and delete
- **Accept when:** E2E flow 1 passes, plus flow 2 up to "creator accepts"; all security tests pass.

**Phase 2: Deals and payments**
- **Build:**
  - Checkout (Razorpay), webhook, transactions, ledger, GST invoices
  - Full BRAND deal workflow (admin pre-approval, brand review with revision limits, auto-approve, live verification with disclosure check)
  - KYC (encryption, penny drop, holds)
  - Payouts (manual provider, maker-checker)
  - Refunds and disputes
  - Creator wallet and statements
  - Ratings and creator score
  - Brand reports (in-app + PDF)
  - GST and TDS exports
- **Accept when:** full E2E flow 2 passes; ledger invariants hold; a penetration test checklist is prepared.

**Phase 3: Growth**
- **Build:** Instagram Graph API connect and stats sync, public creator media kits, favourites, packages purchase flow, referral program, broadcasts, analytics dashboards, case studies.
- **Accept when:** feature tests pass; Lighthouse targets are met.

**Phase 4: Scale**
- **Build:** RazorpayX automated payouts, usage-rights add-on, brand team members (invites with roles), performance tuning, multi-city expansion tooling.

---

## 34. Definition of done / pre-launch checklist
- [ ] All subdomains are under bluenovatech.in with HTTPS and HSTS. Admin is behind Cloudflare Access and TOTP is enforced.
- [ ] Every route has authenticate → authorize → validate → ownership → state → (idempotency), and is covered by tests.
- [ ] Serializers are used for every response. Leak tests pass for every role.
- [ ] OTP limits, captcha and +91-only are active. Identical responses are returned.
- [ ] Refresh rotation and reuse detection work. The access token is never in web storage.
- [ ] KYC is encrypted, masked and audited when revealed. Key rotation script tested.
- [ ] Buckets are private, presigned uploads have size limits, magic-byte checks are in place, and EXIF is stripped.
- [ ] Razorpay webhook: signature checked, deduplicated, transactional. Amounts are always computed on the server.
- [ ] Payout maker-checker is enforced and tested. Bank-change hold is active.
- [ ] CSP and all headers are verified (securityheaders.com A). No `dangerouslySetInnerHTML`.
- [ ] Logs are redacted and kept for 180 days. Sentry scrubbing is on. Alerts are configured.
- [ ] Backup restore drill has been done and documented.
- [ ] Privacy policy, terms, creator and brand agreements, and refund policy are live in gu and en. Consent versions are recorded.
- [ ] Every i18n key exists in gu and en. Accessibility AA checks pass. Lighthouse targets are met.
- [ ] The external penetration test is complete and its findings fixed (before Phase 2 goes live).

---

## 35. Default assumptions (client confirmation pending; keep configurable)
1. **Fully managed matching:** brands only see Bluenova's shortlist. There is no self-serve browsing in v1. Behind a feature flag: `BRAND_BROWSE_ENABLED=false`.
2. **Hidden margin model:** the brand sees one price.
3. **Manual payouts** in Phase 2. RazorpayX comes later through the adapter.
4. **GST 18%, TDS 0%** as placeholders, configurable in Settings, with a "confirm with CA" note.
5. **Subdomains** of bluenovatech.in.
6. **Barter deals supported** (`collabType`). Barter deals have no payment step: AWAITING_PAYMENT is skipped and the deal goes straight to IN_PRODUCTION once the cm confirms the product was shipped.
7. **Public creator profiles** are opt-in.
8. **Brand review auto-approves** after 5 days (configurable). Max revisions defaults to 2.
9. **Non-circumvention:** enforced by agreements and contact masking, not by hiding Instagram handles (handles are visible to brands in shortlists).

Record any change to these in `docs/DECISIONS.md`.

---

**Start now with Phase 0.** First output the planned file tree and the shared package (enums, zod schemas, state machines), then the API skeleton. After each phase, summarize what was built, the test results, and any decisions you recorded.
