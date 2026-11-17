# Stack: pnpm monorepo, Vite single-page app with React Compiler, Express 5 + Prisma on Supabase, email over SMTP

The MVP is a pnpm monorepo: `apps/web`, `apps/api` and `packages/shared` (Zod schemas plus pure week and time logic, used by both apps). TypeScript strict, Node 24 pinned in `mise.toml`.

- **Web:** Vite + React 19 single-page app with TanStack Router and TanStack Query, Tailwind and shadcn/ui. Not TanStack Start or another SSR framework: the app sits behind a login apart from the public Staff Link page, and a separate API keeps the tenancy checks in one Express middleware (ADR-0001) rather than spread between server functions and loaders.
- **React Compiler:** enabled through `babel-plugin-react-compiler` in `@vitejs/plugin-react` (the Babel-based plugin, not SWC). `eslint-plugin-react-hooks` runs with its recommended config, including the compiler's rule checks, as errors. Because the compiler memoises for us, `useMemo`, `useCallback` and `React.memo` are not added by default; any manual use carries a comment explaining why.
- **API:** Express 5 built by a `createApp({ db, clock, emailSender, authConfig })` factory, so tests and production go through the same code, with no `NODE_ENV` checks in application code. Prisma on Supabase Postgres. Supabase Auth for Venue Members, with JWTs checked against Supabase's signing keys.
- **Email:** a single nodemailer SMTP adapter behind `EmailSender`, pointed at local Supabase's mail inbox in development and Playwright, and at Resend's SMTP endpoint in production. Integration tests use an in-memory outbox. If SMTP can't report per-recipient results cleanly, we fall back to a Resend API adapter behind the same interface.

## Considered Options

- **TanStack Start / Next.js:** server-side rendering adds no value behind a login, and spreads access checks across more places. Rejected.
- **SWC React plugin:** faster, but the React Compiler needs the Babel pipeline. Rejected.
- **Resend SDK as the only adapter:** needs a Resend key for local development and Playwright, and email can't be checked against the local inbox. Kept only as the fallback.
