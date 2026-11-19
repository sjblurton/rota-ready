# Stack: pnpm monorepo, Vite single-page app with React Compiler, Express 5 + Prisma on Supabase, email over SMTP

The MVP is a pnpm monorepo: `apps/web`, `apps/api` and `packages/shared` (Zod schemas plus pure week and time logic, used by both apps). TypeScript strict, with Node 26 and pnpm pinned in `mise.toml`. TypeScript stays on 6.0.x, because typescript-eslint doesn't yet support TypeScript 7.

- **Web:** Vite + React 19 single-page app with TanStack Router and TanStack Query, Tailwind and shadcn/ui, and React Hook Form for forms (ADR-0007). Not TanStack Start or another SSR framework: the app sits behind a login apart from the public Staff Link page, and a separate API keeps the tenancy checks in one Express middleware (ADR-0001) rather than spread between server functions and loaders.
- **React Compiler:** the Babel-based `babel-plugin-react-compiler`, enabled through `@rolldown/plugin-babel` with `reactCompilerPreset()` from `@vitejs/plugin-react`. Since `@vitejs/plugin-react` 6 (Vite 8), this is the documented Babel route; the plugin no longer has its own `babel` option. Not SWC, and not plugin-react's experimental Rust `compiler: true` option. `eslint-plugin-react-hooks` runs with its recommended config, including the compiler's rule checks, as errors. Because the compiler memoises for us, `useMemo`, `useCallback` and `React.memo` are not added by default; any manual use carries a comment explaining why.
- **API:** Express 5 built by a `createApp({ db, clock, emailSender, authConfig })` factory, so tests and production go through the same code, with no `NODE_ENV` checks in application code. Prisma on Supabase Postgres. Supabase Auth for Venue Members, with JWTs checked against Supabase's signing keys.
- **Email:** a single nodemailer SMTP adapter behind `EmailSender`, pointed at local Supabase's mail inbox in development and Playwright, and at Resend's SMTP endpoint in production. Integration tests use an in-memory outbox. If SMTP can't report per-recipient results cleanly, we fall back to a Resend API adapter behind the same interface.

## Considered Options

- **TanStack Start / Next.js:** server-side rendering adds no value behind a login, and spreads access checks across more places. Rejected.
- **SWC React plugin:** faster, but the React Compiler needs the Babel pipeline. Rejected.
- **plugin-react's Rust compiler (`compiler: true`):** marked experimental in plugin-react 6. Revisit once it's stable. Rejected for now.
- **Versioned API paths (`/api/v1/...`):** the web app is the API's only client and they're deployed together, so a version number protects nothing yet. Routes stay under `/api/...`; if an outside client ever needs a stable contract, `/api/v2` (or a versioned client-specific prefix) can be added without breaking anything. Rejected for now.
- **Resend SDK as the only adapter:** needs a Resend key for local development and Playwright, and email can't be checked against the local inbox. Kept only as the fallback.
