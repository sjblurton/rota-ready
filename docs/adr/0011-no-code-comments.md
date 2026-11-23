# Code carries no comments, and lint enforces it

The old guidance was "keep comments rare, and write one only when the *why* isn't obvious". It was a judgement call, and it kept producing comments that reviewers didn't want (#87). Now TypeScript and JavaScript carry no comments at all. A local ESLint rule, `code-style/no-comments` in `eslint.config.js`, rejects every comment except `/// <reference>` directives. It skips generated code and shadcn's `components/ui/`. `noInlineConfig` was already on, so `eslint-disable` directives don't work either.

When code seems to need a comment, make the code say it instead:

- **A name** that states what a function does, such as `lockActiveStaffMemberUntilCommit`, or `markShiftsOfRotaNotified` for raw SQL.
- **A smaller function, or a structure that makes the constraint impossible to get wrong.** For example, the Shift delete used to rely on running a hard delete before a soft delete. It now locks the Rota row, so the order no longer matters.
- **A test** that goes red when someone "simplifies" the code. For example, the journey step showing the Removed marker straight after a reassignment fails if the Rota refetch is swapped for `refetchQueries`, which skips static queries.
- **The PR description or `docs/`**, for the reason behind a choice that the code can't hold.

## The comments it removed (#88)

Every comment block on `main` when this was decided, and what replaced it:

| Comment | Verdict |
|---|---|
| `rota-data.ts`: why `markShiftsOfRotaNotified` is raw SQL | Deleted. The function name, plus `CODING_STANDARDS.md` ("raw SQL only for what Prisma can't express"), cover it. |
| `staff-member-data.ts`: why the row lock is raw SQL | Deleted, for the same reason. |
| `shift-data.ts`: hard delete must run before soft delete | Rewrote the code. The service locks the Rota row (`FOR NO KEY UPDATE`) for the delete. Publish's `UPDATE rotas` waits on that lock, so the notified snapshot can't change mid-delete, while adding Shifts to the Week isn't blocked. |
| `rota-queries.ts`: why `refetchRota` uses `query({ staleTime: 0 })`, and that a failed refetch waits for the next poll | Deleted. Swapping in `refetchQueries` turns the journey's Removed-marker step red. A failed refetch is ignored because a Published Rota refreshes every 30 seconds anyway (`refetchInterval` in `rotaQuery`). |
| `_authenticated.tsx`: child routes 403 until the User is stored | Deleted. `bootstrapCurrentUserQuery` in `beforeLoad` already says it runs first. |
| `tsdown.config.ts`: why workspace packages are bundled | Deleted. `alwaysBundle: [/^@rota-ready\//]` says what it does. `packages/shared/package.json` exports `./src/index.ts`, which shows why. |
| `vite.config.ts`: the router plugin comes before the React plugin | Deleted. TanStack Router's setup docs require this order. Nothing in the repo catches a reorder, which is an accepted loss. |

In total, 4 of the 7 explained a workaround for a library limit: the two raw-SQL functions, the delete ordering and the refetch. Only the delete ordering could be designed away, and it was. None needed moving to `docs/`: each reason was already given by a name, a test, a config value, `CODING_STANDARDS.md` or a library's own docs.

## Outside TypeScript and JavaScript

- **Migrations:** applied migrations stay exactly as they are. Prisma checksums them, so editing one makes `prisma migrate dev` demand a reset of every developer's database. New migrations keep Prisma's generated headers (`-- AlterTable`) but add no comments of their own. A reason behind a data change, such as a backfill, goes in the PR.
- **Shell scripts, CI YAML, TOML and SQL:** these are out of scope and unchanged, because the lint rule only reads TypeScript and JavaScript. TypeScript and JavaScript config files, such as `vite.config.ts`, are covered.

## Considered Options

- **Keep the judgement call and tighten the wording**: no tooling needed. But the old wording was already tight, and comments still got through review. Rejected.
- **Ban comments, but allow a marked `Why:` comment** for ordering and concurrency constraints: this keeps the rare real reason next to the code. But every comment would argue it was the exception, and the one real case, the delete ordering, turned out better as a code change. Rejected.
- **A published plugin** (`eslint-plugin-no-comments`): no local code. But it adds a dependency to do what a dozen local lines do, and we'd want to control the allowlist ourselves anyway. Rejected.
- **`no-restricted-syntax`**: comments aren't AST nodes, so it can't see them. Not possible.
