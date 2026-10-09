# Coding standards

The goal is code a beginner can follow: **the same pattern everywhere, small functions, plain-English comments.**

## 1. General
- **TypeScript strict** everywhere. Avoid `any` (if you truly need it, add a comment saying why).
- **File header:** every file starts with a `/** … */` comment saying what it is, who uses it and what it calls. Update it when the file changes.
- **Comments explain *why*,** not what. Example: `// same reply either way, so nobody can test which emails exist`.
- **Naming:**
  - `camelCase` for variables and functions.
  - `PascalCase` for components, types and models (`UserModel`).
  - `UPPER_SNAKE` for constants and enums.
  - Files: `area.routes.ts`, `area.service.ts`; React page files: `PascalCase.tsx`.
- **Quotes and semicolons:** single quotes, semicolons, 2-space indent, trailing commas (match the surrounding code).
- **Dead code:** no dead code or commented-out code. Delete it; git remembers.
- **Before you finish:** `npm run typecheck` and `npm test` must pass.

## 2. API (`apps/api`)

### Folder rules
| Put it in | When |
|---|---|
| `modules/<area>/<area>.routes.ts` | HTTP routes for one business area. Keep each route thin: validate, call logic, reply. |
| `modules/<area>/<area>.service.ts` | Logic used by several routes or too long for a route (see `auth.service.ts`) |
| `modules/serializers.ts` | What each role may see of a document |
| `models/` | Mongoose schemas only |
| `lib/` | Generic helpers with no business knowledge |
| `middleware/` | Things that run before routes |
| `providers/` | Talking to outside services (email, Google) |
| `packages/shared` | Rules or lists the **frontend also needs** (schemas, enums, state machines) |

### The standard route (copy this shape)
```ts
/** POST /things/:id/approve  { reason } → { thing }   (who calls it: admin ThingPage) */
thingsRouter.post('/things/:id/approve',
  requireAdmin('reviewer'),                                      // 1. who may call it
  validate({ params: z.object({ id: objectId }), body: reasonSchema }), // 2. check input
  h(async (req, res) => {
    const { id } = input<{ id: string }>(req, 'params');         // 3. read CHECKED input only
    const { reason } = input<{ reason: string }>(req);
    const thing = await ThingModel.findById(id);                 // 4. load (with an ownership filter for users!)
    if (!thing) throw notFound();
    applyTransition(thing, thingMachine, 'APPROVED', req.auth!.adminRole!, req.auth!.id, reason); // 5. status rules
    await thing.save();
    await audit(req, 'thing.approve', 'Thing', thing._id, { reason }); // 6. record admin actions
    ok(res, thingAdminView(thing.toObject()));                   // 7. reply through an allow-list view
  }),
);
```

### Rules
- **Input:** always `validate()` + `input(req)`. Never read `req.body` directly. Reuse schemas from `packages/shared`.
- **Errors:** `throw new AppError('CODE', 'errors.key', fields?)`. Never `res.status(400).json(...)` by hand. Add new keys to `apps/web/src/i18n/en.json` + `gu.json` (and admin `MESSAGES` if admins see them).
- **Ownership:** website users' queries always include *their* id (`{ _id: id, brandId: myBrand._id }`). Not found or not theirs means `notFound()` (404).
- **Several writes that belong together:** `withTransaction(async (session) => { ... })`, passing `{ session }` to every query.
- **Status changes:** only `applyTransition()`.
- **Money:** integer paise; convert at the edges with `rupeesToPaise` / `paiseToRupees`.
- **Emails:** `sendInBackground(emails.someTemplate(...))`. Never `await` email in a request.
- **Logging:** `logger.info({ ids }, 'message')`. Never log request bodies or secrets (redaction is a safety net, not permission).
- **Settings:** add to `config/env.ts` (validated), `.env.example` (explained) and `render.yaml` / `docs/DEPLOYMENT.md`.

## 3. Frontend (`apps/web`, `apps/admin`)
- **Pages** live in `pages/<area>/`; shared pieces go in `components/`; helpers go in `lib/`.
- **Data:** `useQuery({ queryKey: [...], queryFn: () => api.get(...) })` for reading. For actions, call `api.post` and then `queryClient.invalidateQueries` (admin: `useAction`).
- **Forms:** react-hook-form + `zodResolver(sharedSchema)`; show server field errors with `applyServerErrors`.
- **Texts:** no hard-coded words in the website. Use `t('area.key')` and add the key to **both** `gu.json` and `en.json`.
- **Security in the browser:**
  - never store tokens in localStorage or sessionStorage;
  - never use `dangerouslySetInnerHTML`;
  - use `ExternalLink` for outside links;
  - use `safeRedirect` for `?next=`.
- **Guards** (`RequireRole`, …) are for convenience only. The API must enforce the same rule.
- **Styling:** Tailwind + design tokens + `@bluenova/ui` components (see [DESIGN.md](DESIGN.md)).

## 4. How to… (step by step)

### Add an API endpoint
1. Add the input schema to `packages/shared/src/schemas.ts` (if the frontend sends it).
2. Add the route in the right `modules/<area>/<area>.routes.ts`, following the standard shape above.
3. Add a view function in `serializers.ts` if it returns a new kind of object.
4. Add a test in `apps/api/tests/` covering success **and** the forbidden, not-found and bad-input cases.
5. Document it in [API.md](API.md) (and [FLOWS.md](FLOWS.md) if it changes a journey).

### Add a website page
1. Create the component in `apps/web/src/pages/<area>/`.
2. Register the URL in `apps/web/src/App.tsx` inside the right guard.
3. Add the texts to both language files.
4. Add the navigation link (`components/layout.tsx`) if needed.
5. Document it in [FLOWS.md](FLOWS.md).

### Add a database field
1. Add it to the schema in `apps/api/src/models/…` (use `select: false` if it's sensitive).
2. Expose it only through a serializer, and only to the roles that need it.
3. Document it in [DATA_MODELS.md](DATA_MODELS.md).

## 5. Git
- **Branches:** small, focused commits with messages that say what changed for the user, e.g. `Ask creator/brand after first login`.
- **Never commit** `.env`, `ADMIN_SECRET.txt`, `node_modules`, `dist` (all in `.gitignore`).
- **Before pushing:** typecheck + tests. Render and Vercel deploy automatically from `main`.
