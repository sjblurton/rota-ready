# Host the web app and API on Render, run migrations from GitHub Actions, and serve both from one origin

Production runs on a hosted Supabase project (Auth and Postgres, in `eu-west-1`) plus two Render services described in `render.yaml`: the API as a Node web service (`rota-ready-api`) and the web app as a static site (`rota-ready`). Both are on Render's free plan for the MVP, tracking `main`. The API runs in Frankfurt, Render's closest region to Ireland, which adds a few tens of milliseconds to each database round trip.

## Migrations run before the deploy, from CI

Render's pre-deploy command is only on paid plans, so neither service deploys itself (`autoDeployTrigger: off`). When CI passes on `main`, a `deploy` job runs `prisma migrate deploy` against production, then deploys the API and waits for it to go live, then does the same for the web app. Each deploy goes through the service's deploy hook with `ref=<commit SHA>`, so Render builds exactly the commit that was tested and migrated, and `.github/scripts/render-deploy.sh` polls Render's API until that deploy is `live`, failing the job if it fails or times out. The job runs in a GitHub `production` environment that holds the secrets, and runs on `main` are never cancelled part-way.

That order means each layer briefly runs against the newer layer beneath it, so changes must be backwards compatible in two places: every migration must work with the API that's already running, and every API change must work with the web app that's already running. Add first; remove in a later deploy.

Prisma reads every column its model declares, even ones the code never uses. So the PR that stops the code using a column also removes it from `schema.prisma`, with no migration, and a later PR drops it once that's live.

## Migrations are atomic and linted

Prisma runs a migration's statements one at a time, not in a transaction, so a migration that fails part-way would leave production half-applied and block every later migration until someone repaired it by hand. So every new migration is wrapped:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
-- the statements Prisma generated
COMMIT;
```

A failed migration then rolls back completely and the deploy stops. The lock timeout makes a migration that's waiting behind a long-running query give up after five seconds, instead of holding up every request that touches the table while it waits. Prisma generates migrations without the wrapper, so it's added by hand after `prisma migrate dev --create-only`.

On every pull request, `pnpm lint:migrations` checks the migrations the PR adds or changes, never the ones already on `main`. It fails a migration that isn't wrapped or that edits one already on `main`, and runs squawk, which flags statements that break the running API or lock busy tables: dropping or renaming a column or table, adding a required column, adding a constraint to an existing table without `NOT VALID`, and the like. `.squawk.toml` turns off two of squawk's default rules:

- **`require-concurrent-index-creation`**: `CREATE INDEX CONCURRENTLY` can't run inside a transaction. At today's table sizes a plain index build locks a table for milliseconds.
- **`require-statement-timeout`**: a slow but legitimate data backfill shouldn't be failed. The lock timeout covers the danger to the running app.

When a statement has to break a rule on purpose, such as the final drop of expand-then-contract, put `-- squawk-ignore <rule>` on the line above that one statement, naming only the rules it needs. `squawk-ignore-file` isn't allowed. The PR description must link the earlier, already-deployed PR that stopped the app using what's being dropped or renamed.

A linter only reads the SQL, so on pull requests that add or change a migration, CI also runs `pnpm test:migrations`: it checks out the base branch in a temporary folder, swaps in the PR's migrations folder, and runs the base branch's API tests against the result. That's the API still running in production while the new migrations apply, so a failing base test means the migration would break production for the length of the deploy. It catches schema changes squawk can't judge, such as a `squawk-ignore`d drop of a column the old API still reads. The tests run on an empty database, so it proves the old code works with the new schema, not with data a migration rewrote. A PR with no migration changes skips it in seconds. It adds about a minute to a PR that has migrations, and needs the local Supabase stack, like `pnpm test`.

## One origin, no CORS

The static site rewrites `/api/*` to the API service, so the browser only ever talks to `https://rota-ready.onrender.com`, just as it talks to the Vite proxy in development. The API needs no CORS configuration and `VITE_API_URL` stays empty.

## Database connection

Both the CI migrations and the API use Supabase's **session pooler** connection string (port 5432, user `postgres.<project-ref>`). The direct connection is IPv6-only without a paid add-on, and neither GitHub's runners nor Render can rely on IPv6. The transaction pooler is meant for serverless functions and doesn't support prepared statements.

## Considered Options

- **Render pre-deploy command for migrations**: simpler, but paid only. Revisit if the API moves to a paid plan. It wouldn't remove the need for backwards-compatible migrations, since the old API keeps serving until the new one is healthy, so the linter stays either way.
- **Migrations in their own PRs**: makes "add first" the default, but splits every feature in two, and the journey can't test a migration on its own. Rejected.
- **Concurrent index builds**: once tables are large enough for an index build to matter, allow an unwrapped migration that contains only `CREATE INDEX CONCURRENTLY` or `DROP INDEX CONCURRENTLY`, with the concurrent rule on for it. Not needed yet.
- **Running migrations when the API starts**: every instance would race to migrate, and a failed migration would take the API down instead of failing the deploy. Rejected.
- **Vercel for the web app and Fly.io for the API**: faster static hosting, but two providers and a Dockerfile to maintain. Rejected for the MVP.
- **CORS between two origins**: works, but adds a config surface the development setup doesn't have. Rejected while the static site can proxy.
- **Fire-and-forget deploy hooks**: simpler, but the job would go green while a Render build was still failing, and the web app could go live before the API it needs. Rejected.

## Consequences

The free API spins down after 15 minutes without traffic and takes about a minute to wake, so the first request after a quiet spell is slow. Moving off Render means replacing `render.yaml`, the `/api/*` rewrite and the two deploy-hook steps in `ci.yml`; the app code has no Render-specific parts.
