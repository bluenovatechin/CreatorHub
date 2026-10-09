# Testing

## 1. Automated tests

```bash
npm test                      # everything (shared rules + API)
npm test -w @bluenova/api     # API only
npm test -w @bluenova/shared  # shared rules only
npm run typecheck             # TypeScript errors anywhere
```

- **API tests** start their **own in-memory MongoDB** (`apps/api/tests/global-setup.ts`). They never touch Atlas.
- `tests/setup-env.ts` forces safe fake settings. `EMAIL_PROVIDER=console` means **no real emails are ever sent**; "sent" emails are kept in memory, and tests read the 6-digit code from there.
- Rate limits are off in tests unless `TEST_RATE_LIMITS=1`.

### What is covered
| File | Covers |
|---|---|
| `packages/shared/src/shared.test.ts` | GSTIN check digit, PIN code ↔ state, names, phone numbers, disposable emails, password rules, signup and payment schemas, money maths, state machines |
| `apps/api/tests/auth.test.ts` | **Signup:** every field rule; the code is stored hashed; wrong code, 5 tries, resend cooldown; a second tab doesn't break the first; repeated unfinished signup; a role sent in signup is ignored. **Role choice:** once only. **Google:** new and existing accounts, unverified email, admins refused. **Login:** same error for unknown and wrong, lockout. **Reset links:** single use, a rejected password doesn't burn the link, older links replaced. **Sessions:** refresh rotation, theft detection. **Role separation, admin login** (password + authenticator, replay blocked), **append-only audit log.** **Admin → Users:** list and detail never contain hashes; set password logs the user out; suspend and re-activate; super admin only. |
| `apps/api/tests/flows.test.ts` | Creator onboarding and review, brand campaign → shortlist → offer → deal, ownership (404 for other people's data), payments ON and OFF |
| `apps/api/tests/email.test.ts` | Email HTML escapes user text; the code email holds only the code |

### Writing a new API test
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, signup, loginAdmin, useDatabase } from './helpers';

useDatabase(); // fresh in-memory database for this file

describe('my feature', () => {
  it('does the right thing', async () => {
    const creator = await signup('creator');            // full real signup: form → code → role
    await request(app).get('/api/v1/creators/me').set(bearer(creator.token)).expect(200);
  });
});
```

Useful helpers (`apps/api/tests/helpers.ts`):
- `signup(role)`: a full real signup.
- `loginAdmin(teamRole)`: password + authenticator.
- `lastEmailCode(email)`, `lastEmailToken(email)`: read what was "emailed".
- `nextEmail()`: a unique test address.
- `bearer(token)`: the Authorization header.

**Always test the "not allowed" cases too:** the wrong role, someone else's id (expect 404), bad input (400), the wrong status (409).

## 2. Manual test checklist (before each deploy)

Run `npm run dev` (real Atlas + Gmail) or `npm run dev:demo` (codes printed in the terminal).

**Accounts**
- [ ] Sign up with a new email: the code arrives, typing it takes you to "What brings you to Bluenova?".
- [ ] Choose creator → onboarding step 1. (With another account, choose brand → company details.)
- [ ] A wrong code shows "Incorrect code". After 60 s, "Resend code" works.
- [ ] Log out, log in again: no code is asked, you land in your area.
- [ ] Reload the page while logged in: you are still logged in.
- [ ] Forgot password → the email link → a weak password shows an error (the link still works) → a good password → log in.
- [ ] Continue with Google (needs `GOOGLE_CLIENT_ID` and your Google account added as a test user) → role page → area.
- [ ] Sign up again with an already-registered email: the page looks normal, and the inbox gets "you already have an account".

**Creator and brand:** onboarding submit → admin review → approve → the creator dashboard shows the partner badge.

**Admin panel**
- [ ] Login with password + authenticator code.
- [ ] Users: the tabs show counts; open an account; "Set new password" logs that user out and they can log in with the new one; Suspend blocks login; Re-activate restores it.
- [ ] A non-super-admin team member doesn't see "Users" (and the API returns 403).

**Both languages:** switch to ગુજરાતી on the login, signup and role pages; no English keys like `auth.xxx` should show.

## 3. Trying the live site
- **The first request may take ~1 minute:** the free Render server is waking up.
- **Live emails need** `EMAIL_PROVIDER=brevo` (+ key) on Render, or `TEST_MODE=true` (no codes; a banner says "test version").
- **API health:** `https://bluenova-api.onrender.com/healthz` should show `{"ok":true}`.
