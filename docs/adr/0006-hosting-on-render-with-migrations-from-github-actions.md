# Host the web app and API on Render, run migrations from GitHub Actions, and serve both from one origin

Production runs on a hosted Supabase project (Auth and Postgres, in `eu-west-1`) plus two Render services described in `render.yaml`: the API as a Node web service (`rota-ready-api`) and the web app as a static site (`rota-ready`). Both are on Render's free plan for the MVP, tracking `main`. The API runs in Frankfurt, Render's closest region to Ireland, which adds a few tens of milliseconds to each database round trip.

## Migrations run before the deploy, from CI

Render's pre-deploy command is only on paid plans, so neither service deploys itself (`autoDeployTrigger: off`). When CI passes on `main`, a `deploy` job runs `prisma migrate deploy` against production, then deploys the API and waits for it to go live, then does the same for the web app. Each deploy goes through the service's deploy hook with `ref=<commit SHA>`, so Render builds exactly the commit that was tested and migrated, and `.github/scripts/render-deploy.sh` polls Render's API until that deploy is `live`, failing the job if it fails or times out. The job runs in a GitHub `production` environment that holds the secrets, and runs on `main` are never cancelled part-way.

That order means each layer briefly runs against the newer layer beneath it, so changes must be backwards compatible in two places: every migration must work with the API that's already running, and every API change must work with the web app that's already running. Add first; remove in a later deploy.

## One origin, no CORS

The static site rewrites `/api/*` to the API service, so the browser only ever talks to `https://rota-ready.onrender.com`, just as it talks to the Vite proxy in development. The API needs no CORS configuration and `VITE_API_URL` stays empty.

## Database connection

Both the CI migrations and the API use Supabase's **session pooler** connection string (port 5432, user `postgres.<project-ref>`). The direct connection is IPv6-only without a paid add-on, and neither GitHub's runners nor Render can rely on IPv6. The transaction pooler is meant for serverless functions and doesn't support prepared statements.

## Considered Options

- **Render pre-deploy command for migrations**: simpler, but paid only. Revisit if the API moves to a paid plan.
- **Running migrations when the API starts**: every instance would race to migrate, and a failed migration would take the API down instead of failing the deploy. Rejected.
- **Vercel for the web app and Fly.io for the API**: faster static hosting, but two providers and a Dockerfile to maintain. Rejected for the MVP.
- **CORS between two origins**: works, but adds a config surface the development setup doesn't have. Rejected while the static site can proxy.
- **Fire-and-forget deploy hooks**: simpler, but the job would go green while a Render build was still failing, and the web app could go live before the API it needs. Rejected.

## Consequences

The free API spins down after 15 minutes without traffic and takes about a minute to wake, so the first request after a quiet spell is slow. Moving off Render means replacing `render.yaml`, the `/api/*` rewrite and the two deploy-hook steps in `ci.yml`; the app code has no Render-specific parts.
