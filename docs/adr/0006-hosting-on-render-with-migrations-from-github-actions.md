# Host the web app and API on Render, run migrations from GitHub Actions, and serve both from one origin

Production runs on a hosted Supabase project (Auth and Postgres) plus two Render services described in `render.yaml`: the API as a Node web service (`rota-ready-api`) and the web app as a static site (`rota-ready`). Both are on Render's free plan for the MVP.

## Migrations run before the deploy, from CI

Render's pre-deploy command is only on paid plans, so neither service deploys itself (`autoDeployTrigger: off`). When CI passes on `main`, a `deploy` job runs `prisma migrate deploy` against production and then calls each service's deploy hook with `ref=<commit SHA>`, so Render builds exactly the commit that was tested and migrated. The job runs in a GitHub `production` environment that holds the secrets, and runs on `main` are never cancelled part-way.

Because migrations land before the new API is live, every migration must work with the API version that's already running: add first, remove in a later deploy.

## One origin, no CORS

The static site rewrites `/api/*` to the API service, so the browser only ever talks to `https://rota-ready.onrender.com`, just as it talks to the Vite proxy in development. The API needs no CORS configuration and `VITE_API_URL` stays empty.

## Database connection

Both the CI migrations and the API use Supabase's **session pooler** connection string (port 5432, user `postgres.<project-ref>`). The direct connection is IPv6-only without a paid add-on, and neither GitHub's runners nor Render can rely on IPv6. The transaction pooler is meant for serverless functions and doesn't support prepared statements.

## Considered Options

- **Render pre-deploy command for migrations**: simpler, but paid only. Revisit if the API moves to a paid plan.
- **Running migrations when the API starts**: every instance would race to migrate, and a failed migration would take the API down instead of failing the deploy. Rejected.
- **Vercel for the web app and Fly.io for the API**: faster static hosting, but two providers and a Dockerfile to maintain. Rejected for the MVP.
- **CORS between two origins**: works, but adds a config surface the development setup doesn't have. Rejected while the static site can proxy.

## Consequences

The free API spins down after 15 minutes without traffic and takes about a minute to wake, so the first request after a quiet spell is slow. Moving off Render means replacing `render.yaml`, the `/api/*` rewrite and the two deploy-hook steps in `ci.yml`; the app code has no Render-specific parts. `pnpm --filter @rota-ready/api check:production` checks the live setup from outside (see the README).
