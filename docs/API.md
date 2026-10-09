# API reference

- **Base URL:** `/api/v1`. Locally: `http://localhost:4000/api/v1`, but the dev websites proxy `/api` for you. Live: `https://bluenova-api.onrender.com/api/v1`, reached through each Vercel site's `/api` rewrite.
- **Format:** JSON in and out. All routes are in `apps/api/src/modules/**`. For the step-by-step journeys, see [FLOWS.md](FLOWS.md).

## Conventions (the same for every endpoint)

**Success reply**
```json
{ "data": { ... }, "meta": { "nextCursor": "..." } }   // meta only on lists
```

**Error reply**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "errors.VALIDATION_ERROR",
             "fields": { "password": "errors.passwordShort" }, "requestId": "6cae…" } }
```
- `message` and `fields` values are **translation keys**. The website shows them in English or Gujarati (`apps/web/src/i18n/*.json`).
- `requestId` is also in the `X-Request-Id` header. Quote it when debugging; it appears in the server logs.

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input failed the rules (see `fields`) |
| `INVALID_OTP` | 400 | Wrong authenticator code (admin) |
| `UNAUTHENTICATED` | 401 | Not logged in, session expired, or wrong email/password |
| `FORBIDDEN` | 403 | Logged in but not allowed (wrong role or team role, suspended, …) |
| `NOT_FOUND` | 404 | Doesn't exist **or isn't yours** (we never confirm that someone else's item exists) |
| `INVALID_STATE` / `CONFLICT` | 409 | Not allowed in the current status, or already done |
| `RATE_LIMITED` | 429 | Too many requests (`Retry-After` header says how long to wait) |
| `INTERNAL` | 500 | Unexpected server problem (details only in the server log) |

**Authentication**
- Website and admin calls send `Authorization: Bearer <accessToken>`. The client in `packages/ui/src/api.ts` does it automatically.
- `/auth/refresh` and `/auth/logout` use the httpOnly cookie instead. They also require an allowed `Origin` header (CSRF protection).

**Access legend**
- 🌐 public
- 🔑 any logged-in website user (creator, brand, or no role yet)
- 🎨 creator
- 🏢 brand
- 🛡️ admin, with the team roles that may call it (`super_admin` may always)

**Rate limits** (per network, or per user when logged in)
- Global: 300/min.
- Signup: 10/hour.
- Login: 30 per 15 min.
- Email-sending routes: 20/hour.
- Code checks: 30 per 15 min.
- Refresh: 30/min.
- Logged-in routes: 120/min.

---

## System
| Method & path | Access | Purpose | Called from |
|---|---|---|---|
| `GET /healthz` (no `/api/v1`) | 🌐 | "Is the server up?" (Render health check) | Render |
| `GET /readyz` | 🌐 | "Is the database connected?" | monitoring |
| `GET /config` | 🌐 | `{ paymentsEnabled, testMode, googleClientId }` | web `lib/config.ts` (test banner, Google button, payment pages) |

## Auth: website (`modules/auth/auth.routes.ts`)
| Method & path | Access | Body → reply | Called from |
|---|---|---|---|
| `POST /auth/signup` | 🌐 | `{name,email,password,confirmPassword,acceptTerms}` → `{otpSent,ticket}` (TEST_MODE: `{accessToken,user}`) | `SignupPage` |
| `POST /auth/signup/verify-otp` | 🌐 | `{ticket,code}` → `{accessToken,user}` + cookie | `OtpStep` |
| `POST /auth/signup/resend-otp` | 🌐 | `{ticket}` → `{sent:true}` (1 per minute) | `OtpStep` "Resend code" |
| `POST /auth/google` | 🌐 | `{credential}` → `{accessToken,user}` + cookie | `GoogleButton` |
| `POST /auth/login` | 🌐 | `{email,password}` → `{accessToken,user}` or `{needsVerification,ticket,email}` | `LoginPage` |
| `POST /auth/refresh` | cookie | → `{accessToken,user}` + new cookie | `AuthProvider` (page load) and the API client after a 401 |
| `POST /auth/logout` | cookie | → `{loggedOut:true}` | menu → Log out |
| `POST /auth/logout-all` | 🔑 | → all sessions revoked | `SettingsPage` |
| `POST /auth/password/forgot` | 🌐 | `{email}` → `{sent:true}` (always) | `ForgotPasswordPage` |
| `POST /auth/password/reset` | 🌐 | `{token,password,confirmPassword}` → `{done,area}` | `ResetPasswordPage` |
| `POST /auth/password/change` | 🔑 | `{currentPassword,password,confirmPassword}` → `{accessToken}` | `SettingsPage` |
| `POST /auth/role` | 🔑 (no role yet) | `{role:'creator'\|'brand'}` → `{user}`; 409 if already set | `RoleSelectPage` (`/welcome/role`) |
| `GET /me` | 🔑 | → `{id, role, name, email, preferredLanguage, creator?, brand?}` | `AuthProvider.reloadMe` |
| `PATCH /me/preferences` | 🔑 | `{preferredLanguage:'gu'\|'en'}` | language switch (`layout.tsx`) |

## Auth: admin panel
| Method & path | Access | Body → reply | Called from |
|---|---|---|---|
| `POST /auth/admin/login` | 🌐 | `{email,password}` → `{mfaToken}` (5 min) | admin `LoginPage` step 1 |
| `POST /auth/admin/totp/verify` | mfaToken | `{mfaToken,code}` → `{accessToken,user}` + cookie `bn_admin_rt` | admin `LoginPage` step 2 |
| `POST /auth/admin/refresh` | admin cookie | → `{accessToken,user}` | admin `AdminAuthProvider` |
| `POST /auth/admin/logout` | admin cookie | | admin menu |
| `POST /auth/admin/password/change` | 🛡️ any | `{currentPassword,password,confirmPassword}` | admin Settings |

## Creators (`modules/creators/creators.routes.ts`): 🎨 only
| Method & path | Purpose | Called from |
|---|---|---|
| `GET /creators/me` | Own profile | Onboarding, status, dashboard |
| `PUT /creators/me/onboarding/:step` (1–4) | Save one onboarding step | `CreatorOnboarding` |
| `POST /creators/me/submit` | Submit for review (re-validates everything) | Onboarding step 5 |
| `POST /creators/me/reapply` | Start again after rejection (after the waiting period) | `CreatorStatusPage` |
| `GET /opportunities` | Open campaigns in their categories (approved creators only) | `OpportunitiesPage` |
| `POST /opportunities/:id/interest` | `{interested:boolean}` | `OpportunitiesPage` |
| `GET /offers`, `GET /offers/:id` | Own offers | `OffersPage`, `OfferDetailPage` |
| `POST /offers/:id/accept` | Accept → creates a Deal | `OfferDetailPage` (dialog) |
| `POST /offers/:id/decline` | `{reason, note?}` | `OfferDetailPage` (dialog) |

## Brands and campaigns (`modules/brands/brands.routes.ts`): 🏢 only
| Method & path | Purpose | Called from |
|---|---|---|
| `GET /brands/me`, `PUT /brands/me` | Company profile (the first save makes it ACTIVE) | `BrandOnboardingPage` |
| `GET /campaigns` | Own campaigns | `CampaignsPage`, `BrandDashboard` |
| `POST /campaigns` | Create a draft (wizard step 1) | `CampaignWizard` |
| `GET /campaigns/:id` | One own campaign | `CampaignDetailPage`, wizard |
| `PUT /campaigns/:id/wizard/:step` (1–5) | Save a wizard step (DRAFT only) | `CampaignWizard` |
| `POST /campaigns/:id/submit` | Submit to the team | `CampaignWizard` (last step) |
| `POST /campaigns/:id/cancel` | `{reason}` | `CampaignDetailPage` (dialog) |
| `GET /campaigns/:id/shortlist` | The team's proposed creators (after it's sent) | `CampaignDetailPage` |
| `POST /campaigns/:id/shortlist/select` | `{itemIds}` → offers sent | `CampaignDetailPage` |
| `GET /campaigns/:id/checkout` | Amount due + bank details (**payments ON only**) | `PaymentPage`, `CampaignDetailPage` |
| `POST /campaigns/:id/payments` | Report a transfer (**payments ON only**) | `PaymentPage` |

## Deals and notifications (`modules/deals/deals.routes.ts`)
| Method & path | Access | Purpose | Called from |
|---|---|---|---|
| `GET /deals`, `GET /deals/:id` | 🎨 🏢 (own only) | Deals list and detail | `CreatorDealsPage`, `BrandDealsPage` |
| `GET /notifications` | 🔑 | Latest 30 + unread count | bell icon (`layout.tsx`), `NotificationsPage` |
| `POST /notifications/read` | 🔑 | `{all:true}` or `{ids:[…]}` | `NotificationsPage` |

## Admin (`modules/admin/*.ts`, `modules/payments/payments.routes.ts`): 🛡️
| Method & path | Team roles | Purpose | Admin page |
|---|---|---|---|
| `GET /admin/me` | any | Own admin profile | – |
| `GET /admin/dashboard` | any | Work-queue counts | `DashboardPage` |
| `GET /admin/creators?status=&q=` | reviewer, campaign_manager | Creator list | `CreatorsPage` |
| `GET /admin/creators/:id` | reviewer, campaign_manager | Full creator file | `CreatorDetailPage` |
| `POST /admin/creators/:id/claim` | reviewer | Start reviewing | `CreatorDetailPage` |
| `POST /admin/creators/:id/decision` | reviewer | Approve / request changes / reject | `CreatorDetailPage` |
| `GET /admin/brands` | campaign_manager | Brand list | – |
| `GET /admin/campaigns?status=` | campaign_manager | Campaign list | `CampaignsPage` |
| `GET /admin/campaigns/:id` | campaign_manager | Campaign + brand + shortlist + offers + deals | `CampaignDetailPage` |
| `POST /admin/campaigns/:id/claim` | campaign_manager | Take ownership | `CampaignDetailPage` |
| `GET /admin/campaigns/:id/matches` | campaign_manager | Ranked creators | `CampaignDetailPage` |
| `POST /admin/campaigns/:id/shortlist` | campaign_manager | Add creators with prices | `CampaignDetailPage` |
| `POST /admin/shortlist-items/:id/withdraw` | campaign_manager | Remove a proposal | `CampaignDetailPage` |
| `POST /admin/campaigns/:id/shortlist/send` | campaign_manager | Send to the brand | `CampaignDetailPage` |
| `POST /admin/campaigns/:id/start` | campaign_manager | Start work (payments OFF) | `CampaignDetailPage` |
| `GET /admin/users?role=&q=` | **super_admin** | Every account + profile summary + counts | `UsersPage` |
| `GET /admin/users/:id` | **super_admin** | One account in full (audited) | `UserDetailPage` |
| `POST /admin/users/:id/password` | **super_admin** | `{password, reason}`: set a new password, log out everywhere | "Set new password" dialog |
| `POST /admin/users/:id/status` | **super_admin** | `{status:'active'\|'suspended', reason}` | "Suspend / Re-activate" dialog |
| `GET /admin/audit-logs` | **super_admin** | Audit trail | `AuditLogPage` |
| `GET /admin/settings/features` | any | Is payments ON? | menu, Settings |
| `PUT /admin/settings/features` | **super_admin** | `{paymentsEnabled}` | `SettingsPage` (Finance.tsx) |
| `GET /admin/payments?status=` | finance, campaign_manager (payments ON) | Payments list | `PaymentsPage` |
| `POST /admin/payments/:id/review` | finance (payments ON) | `{decision:'VERIFIED'\|'REJECTED', reason?}` | `PaymentsPage` (dialog) |
| `GET /admin/settings/payment` | finance (payments ON) | Bank/UPI details | `SettingsPage` |
| `PUT /admin/settings/payment` | **super_admin** (payments ON) | Save bank/UPI details | `SettingsPage` |
| `GET /admin/notifications`, `POST /admin/notifications/read` | any | Team notifications | – |
