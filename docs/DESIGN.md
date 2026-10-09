# Design system & UX rules

The website (`apps/web`) and the admin panel (`apps/admin`) share one design system:
- **Tokens** (colours, fonts, radius, shadows): `packages/ui/tailwind-preset.cjs`.
- **Components:** `packages/ui/src/components.tsx`, imported as `import { Button } from '@bluenova/ui'`.

Styling is **Tailwind CSS** utility classes. Always use the named tokens (e.g. `bg-primary`, `text-ink-muted`), not raw hex colours.

## 1. Principles
1. **Simple first.** Ask only what's needed now. Signup is just name, email and password. The creator/brand choice comes on the next screen, and details come in onboarding.
2. **One clear action per screen,** with a big primary button.
3. **Say what happened and what's next.** Every error explains how to fix it. Every success says where you are going.
4. **Gujarati first, English always available.** The language switch is in every header.
5. **Mobile first.** Most creators use phones. Pop-ups slide up from the bottom on small screens.
6. **Accessible by default.** Labels are linked to inputs, errors are announced (`role="alert"`), there is a visible focus ring, and touch targets are at least 44 px.

## 2. Tokens

| Token | Value | Use |
|---|---|---|
| `primary` | `#1647D8` (hover `#0F37AE`, soft `#EAF0FE`) | Main buttons, links, active states |
| `navy` | `#0B1F4D` | Headings, admin sidebar |
| `accent` | `#00A99D` | Secondary highlights (teal) |
| `sun` | `#F5A524` | Warm highlights |
| `bg` / `surface` | `#F6F8FC` / `#FFFFFF` | Page background / cards |
| `ink` / `ink-muted` / `ink-faint` | `#0F172A` / `#5B6476` / `#94A0B4` | Text levels |
| `line` / `line-strong` | `#E3E8F0` / `#CBD3E1` | Borders |
| `success` / `warning` / `danger` / `info` | green / amber / red / blue (+ `-soft` backgrounds) | Status and alerts |
| Fonts | **Inter** (text), **Plus Jakarta Sans** (`font-display`, headings), **Noto Sans Gujarati** (Gujarati script) | Self-hosted via @fontsource (no Google Fonts request) |
| Radius | `rounded-card` 18 px, `rounded-ctl` 12 px | Cards / inputs and buttons |
| Shadows | `shadow-card`, `shadow-lift`, `shadow-btn` | Depth |
| Gradient | `bg-brand-gradient`, `bg-hero-glow` | Hero areas, admin login |

## 3. Components (`@bluenova/ui`)

| Component | Use it for | Notes |
|---|---|---|
| `Button` | Every action | `variant`: primary · secondary · ghost · accent · danger · white. `size`: sm/md/lg. `loading` shows a spinner and blocks double clicks. `block` makes it full width. |
| `Field` | Wraps an input with a label, hint and error | Render-prop `{(id, describedBy) => <Input id={id} … />}` links the label and error text |
| `Input`, `PasswordInput`, `Textarea`, `Select`, `Checkbox` | Form controls | `invalid` turns them red; `PasswordInput` has show/hide |
| `PasswordStrength` | Meter under new-password fields | Display only; the rules are enforced by the schema |
| `ChoiceCards` | Big selectable cards (e.g. creator vs brand) | Radio-group semantics |
| `ChipSelect` | Pick several (categories, languages) | |
| `Card`, `CardHeader`, `PageHeader`, `StatCard` | Layout blocks | |
| `Badge` + `tone` | Status pills | Status → colour mapping: `statusTone()` (web `lib/format.ts`), `tone()` (admin `lib.tsx`) |
| `Alert` | Messages | `tone="red"` errors, `green` success, `amber` warnings, `blue` info |
| `EmptyState`, `Loading`, `Skeleton` | Empty lists / loading | |
| `Stepper`, `Timeline` | Onboarding steps, status history | |
| **`Dialog`** | **Pop-ups (modals)** | Esc closes it, focus moves inside, a click outside closes it, and it's a bottom sheet on mobile. Where it's used: [FLOWS.md §5](FLOWS.md#5-pop-up-windows-dialogs--modals). |
| `CopyButton` | Copy bank details, keys | |
| `ExternalLink` | Links to Instagram etc. | Only `https:`, opens with `noopener noreferrer` |
| `Avatar`, `Tag`, `Spinner` | Small bits | |

**Layouts** (`apps/web/src/components/layout.tsx`):
- `PublicLayout`: marketing header and footer.
- `AuthLayout`: split screen with a brand panel and the form.
- `AppLayout`: logged-in sidebar or top bar with a bell icon, language switch and logout.

The admin panel uses `AdminLayout` (`apps/admin/src/pages/Shell.tsx`).

## 4. Patterns

**Forms**
- Use react-hook-form with `zodResolver(schemaFromShared)`.
- Pass errors through `useFieldError()` so translation keys become text.
- On submit failure, call `applyServerErrors(e, setError)` and fall back to a red `Alert` with `errorText(t, e)`.

**Multi-step flows:**
- Each step saves to the server (`PUT …/step/:n`), so progress is never lost.
- The final step re-validates everything on the server.

**Loading and errors in pages:** use `QueryState` (web) or `QState` (admin). They show a spinner, or the error with a Retry button.

**Destructive actions** (cancel campaign, decline offer, suspend user):
- always open a `Dialog`;
- ask for a reason;
- use a `danger` button.

**One-time codes:**
- the input is numeric only, 6 characters, `autoComplete="one-time-code"` (phones can auto-fill);
- the button stays disabled until 6 digits are typed;
- the resend timer is visible.

**Status words:** show translated, human labels (never raw `UNDER_REVIEW`), each with its colour tone.

## 5. Texts and languages
- All website texts live in `apps/web/src/i18n/gu.json` and `en.json`. **Both files must have exactly the same keys.**
- Groups: `nav`, `home`, `auth`, `errors`, `notif`, …
- Error keys from the API (`errors.xxx`) must exist in both files.
- Write short, friendly sentences. In Gujarati, keep common English product words (email, password, code, brand, creator); people already use them.
- The admin panel is English only. Its error texts are in `apps/admin/src/lib.tsx` → `MESSAGES`.

## 6. Adding a new screen (checklist)
1. Build it from `@bluenova/ui` components. Don't create one-off styles if a component exists.
2. Add every text to **both** language files.
3. Handle all the states: loading, error (with retry), empty, and success.
4. Check it at 360 px width (phone) and with keyboard only (Tab, Enter, Esc).
5. Add it to [FLOWS.md](FLOWS.md): which API it calls, and where success and failure lead.
