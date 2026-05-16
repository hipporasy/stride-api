# Developer Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

## First-time setup

```bash
npm install
cp .env.example .env   # fill in values — see Required Environment Variables below
npm run migrate        # creates all tables on first run
npm run dev
```

### Required environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stride
REDIS_URL=redis://localhost:6379
SESSION_SECRET=any-long-random-string
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
MINTER_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
PORT=3001
```

---

## Daily commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run typecheck` | Type-check without emitting — run before pushing |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format all source files with Prettier |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |

---

## Project structure

```
src/
├── db/
│   ├── schema.ts          # Single source of truth for all table shapes and types
│   ├── index.ts           # Drizzle client (wraps pg Pool)
│   ├── migrator.ts        # Runs pending migrations on startup
│   ├── users.ts           # User/identity queries
│   ├── mints.ts           # Mint record queries
│   └── redis.ts           # ioredis client + connect-redis adapter
├── routes/                # One file per resource
├── services/
│   ├── strava.ts          # Passport strategy, token refresh, Strava API calls
│   └── contract.ts        # viem wallet client + on-chain calls
├── middleware/
│   └── requireAuth.ts     # Session guard
└── types/
    ├── index.d.ts         # SessionUser + Express.User augmentation
    └── strava.ts          # Strava API response shapes
drizzle/                   # Generated SQL migration files — commit these
drizzle.config.ts          # drizzle-kit config
```

---

## TypeScript rules

**Always define types.** No `any` unless unavoidable — even then it should be a `warn`, not silenced.

**Where types live:**

- **DB row types** — do not write these manually. They are inferred from `src/db/schema.ts`:
  ```ts
  type MintRow = typeof mints.$inferSelect;
  type NewMint = typeof mints.$inferInsert;
  ```
- **API response shapes** — add to `src/types/strava.ts` (or a new file per external service).
- **Shared app types** — add to `src/types/index.d.ts`.

**Path aliases** — always use `@/` for cross-directory imports, never `../../`:
  ```ts
  // good
  import { db } from '@/db/index';
  import { SessionUser } from '@/types';

  // bad
  import { db } from '../../db/index';
  ```

---

## Database migrations

The schema lives in `src/db/schema.ts`. Drizzle-kit diffs the schema against the last snapshot to generate SQL.

### Changing the schema (typical workflow)

1. Edit `src/db/schema.ts`
2. Generate a migration:
   ```bash
   npm run migrate:generate
   ```
   This creates a new SQL file in `drizzle/`. Review it before running.
3. Apply it:
   ```bash
   npm run migrate
   ```
   On app startup `migrate()` also runs automatically, so in dev you can just restart the server.

### Adding a table

```ts
// src/db/schema.ts
export const widgets = pgTable('widgets', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Then run `npm run migrate:generate` and `npm run migrate`.

### Adding a column

Add the column to the table definition in `schema.ts`. If it's `notNull()`, provide a `.default(...)` so the migration doesn't fail on existing rows:

```ts
score: integer('score').notNull().default(0),
```

### Rolling back

Drizzle does not auto-generate rollback SQL. To undo a migration:
1. Write and run the inverse SQL manually (e.g. `DROP COLUMN`, `DROP TABLE`).
2. Delete the corresponding snapshot entry from `drizzle/meta/` if needed.

For destructive changes in production, always take a DB snapshot first.

### Drizzle Studio

```bash
npm run studio
```

Opens a visual database browser at `http://localhost:4983`. Useful for inspecting rows during development.

---

## Route rules

Every route must follow this structure — no exceptions.

### 1. Validate all input with Zod

Define a schema at the top of the route file and pass it through `validateBody`. Never trust `req.body` without a schema.

```ts
import { z } from 'zod';
import { validateBody } from '@/middleware/validate';

const createWidgetSchema = z.object({
  name: z.string().min(1).max(100),
  score: z.number().int().nonnegative(),
});

router.post('/', requireAuth, validateBody(createWidgetSchema), async (req, res, next) => {
  const { name, score } = req.body as z.infer<typeof createWidgetSchema>;
  // ...
});
```

On failure, `validateBody` automatically returns:
```json
{ "error": "Validation failed", "details": { "fieldErrors": { "name": ["Required"] } } }
```

### 2. Use `AppError` for business logic errors

Import `AppError` from `@/middleware/errors`. Never call `res.status(xxx).json(...)` directly inside a handler — throw instead.

```ts
import { AppError } from '@/middleware/errors';

if (alreadyMinted) {
  throw new AppError(409, 'Activity already minted');
}
```

Standard status codes used in this project:

| Code | Meaning |
|---|---|
| 400 | Bad request / wrong owner |
| 401 | Not authenticated (handled by `requireAuth`) |
| 404 | Resource not found |
| 409 | Conflict (already exists / already minted) |
| 422 | Unprocessable (e.g. activity is not a run) |
| 500 | Unexpected server error (let `errorHandler` format this) |

### 3. Always use `asyncRoute` — never swallow errors

Wrap every async handler with `asyncRoute` from `@/middleware/validate`. It forwards any uncaught error to the centralized `errorHandler` automatically — no try/catch needed.

```ts
router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const data = await someQuery();
  res.json(data);
}));
```

### 4. Keep business logic out of routes

Routes handle HTTP concerns: parsing input, calling services, returning responses. Business logic belongs in `src/services/`. DB queries belong in `src/db/`.

```ts
// bad — logic in route
const now = Math.floor(Date.now() / 1000);
if (user.tokenExpiresAt < now) { ... }

// good — route calls a service
const accessToken = await getValidToken(user);
```

### 5. Template for a new route

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '@/middleware/requireAuth';
import { validateBody, asyncRoute } from '@/middleware/validate';
import { AppError } from '@/middleware/errors';
import { SessionUser } from '@/types';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
});

router.post('/', requireAuth, validateBody(createSchema), asyncRoute(async (req, res) => {
  const { name } = req.body as z.infer<typeof createSchema>;
  const user = req.user as SessionUser;

  // call services/db here — throw AppError for business logic errors,
  // any uncaught error is forwarded to errorHandler automatically
  res.status(201).json({ name });
}));

export default router;
```

### 6. Mounting a new route

Add to `src/index.ts` before `app.use(errorHandler)`:
```ts
import widgetsRouter from '@/routes/widgets';
app.use('/widgets', widgetsRouter);
```

`errorHandler` must always be the last `app.use()` call.

---

## Code style

- **Linting**: `eslint` with `typescript-eslint` recommended rules + Prettier conflict suppression.
- **Formatting**: Prettier (single quotes, 100 char width, trailing commas).
- **No `any`**: Use `unknown` and narrow with type guards. If you must use `any`, leave a comment explaining why.
- **No raw SQL strings** outside of `src/db/`. All queries go through Drizzle.
- **Error handling**: Return typed errors at the route level. Don't `throw` from DB functions — let the route catch and map to HTTP status codes.

Run before every push:
```bash
npm run typecheck && npm run lint
```
