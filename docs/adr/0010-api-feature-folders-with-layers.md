# apps/api groups code into feature folders, each split into router, controller, service and data

`apps/api/src/features/` holds one folder per area of the glossary, matching `apps/web` (ADR-0008): `venues/`, `staff-members/`, `rota/`, `staff-links/` and `users/`. Inside a feature, each glossary concept gets up to four files, named `<concept>-<layer>.ts`. A feature has one router, which mounts its paths and middleware.

- **Router** (`rota-router.ts`): paths, middleware and param checks. Nothing else.
- **Controller** (`shift-controller.ts`): parses the body and params, calls a service, and turns its result into a status and a body. It builds the response through the shared schemas (for example `toShift`, which needs the clock for `started`), and sends refusals as `{ code }` (ADR-0005).
- **Service** (`shift-service.ts`): the business rules, such as Shift overlap, Week bounds and Archive needing no upcoming Shifts. A service opens its own `db.$transaction` and takes any row locks. A service that can refuse returns `{ ok: true, … } | { ok: false, code }`, with `code` narrowed to the `ApiErrorCode`s that service can produce. It never throws for a refusal the Owner should see.
- **Data** (`shift-data.ts`): Prisma queries. Each function takes the Prisma client or a transaction client, so the service decides what runs together. It returns Prisma rows. The Staff Member row lock is raw `SELECT … FOR UPDATE`, because Prisma Client can't take row locks.

Infrastructure with no domain concept lives in `lib/`: the database client, the clock, `http-errors` and JWT verification. The Venue Member check, which is ADR-0001's 404 scoping, lives in `features/venues/` because it names a glossary concept, and every venue router imports it. `app.ts` (the `createApp` factory and `/api/health`) and `server.ts` stay at the root. A feature imports any file from another feature directly, with no barrel files.

ESLint (`no-restricted-imports`) enforces these import rules:

| Files | May not import |
|---|---|
| routers, controllers | the Prisma client, `lib/db`, data files |
| services | `express`, controllers, routers |
| data | `express`, services, controllers, routers |
| `lib/` | `features/` |

API tests through HTTP stay the default. Each route has its own `<concept>.<action>.test.ts` next to the code, covering auth, the 404 for another venue's resource, statuses and `{ code }`. A service may also get a `<concept>-service.test.ts` that calls it directly, but only when a rule has more combinations than the HTTP tests can cover comfortably. It runs against real Postgres with the shared seed and clock helpers, and never fakes our own code.

## Considered Options

- **Top-level layer folders (`routes/`, `controllers/`, `services/`, `data/`)**: each layer is easy to see at a glance. But every feature change touches four folders, and the backend would read differently from `apps/web`. Rejected.
- **One file per resource, as before**: no ceremony. But Express wiring, parsing, rules and Prisma calls were mixed in one file, and `rotas.ts` was growing with every Rota ticket. Rejected.
- **Controllers or data functions owning transactions**: in a controller, the HTTP layer would have to know about locking. In data functions, a rule spanning several queries couldn't share one lock, which is the case the lock exists for. Rejected.
- **Services throwing a typed error that middleware turns into `{ code }`**: thinner controllers. But the possible refusals disappear from the signature, so nothing makes anyone handle or test them. Rejected.
- **Services returning the API shape**: one-line controllers. But services would depend on the HTTP contract, and service tests would assert on JSON instead of domain values. Rejected.
- **Unit tests for services with a faked data layer**: fast. But they break the rule against faking our own system and the real-Postgres requirement. Rejected.
