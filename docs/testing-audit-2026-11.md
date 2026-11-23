# Testing audit, November 2026

Audited on 23 November 2026, against `main` at `efbcded` (#92). This is the dated evidence. The lasting conclusions live in the README's "Testing approach" table and in `.claude/skills/scenario-tests/SKILL.md`.

## The answer

**Mostly yes.** The approach does what it's for on five of the six goals. The gaps are specific and each has a ticket:

- **Concurrency (goal 3) is the weak spot.** Removing the Staff Member row lock turned no test red. Removing the Rota row lock from Copy Last Week, or from deleting a Shift, turned no test red either. #82 (PR #111) fixes the first; #113 covers the second.
- **"Deployable" (goal 1) stops at the database.** Migrations are checked (the lint now, the compatibility check once #104 merges), but nothing checks that an API change still works with the web app already running (#115), and the journey never runs the production builds (#114).
- **CI time (goal 5) is under budget but has no margin against a slow browser download.** The median run takes 2m48s on `main` and 3m12s on pull requests, but an uncached Chromium download pushed one PR to 7m31s (#112).
- **The Staff Link page is only ever seen at desktop width (goal 4),** though Staff Members open it on their phones (#116).

Nothing in the audit argues for more unit tests, component tests, mocks or a coverage gate.

## The six goals

1. **Keep `main` deployable.** Merging deploys straight away, so anything that would break users, including migrations and deploy-time compatibility, fails CI first.
2. **Make refactoring safe.** Tests check behaviour, not internals, so refactors pass with the tests unchanged.
3. **Protect the risky domain rules:** tenancy (cross-venue 404s), time and the March and October clock changes, who is and isn't emailed, and concurrency and row locks.
4. **Show what the user sees.** The journey proves the real stack end to end, and its screenshots let a reviewer see each screen.
5. **Stay fast and deterministic.** No flaky tests, no dependence on the day the tests run, and CI under 5 minutes.
6. **Make the conventions easy to follow.** An agent can find the right layer and pattern for a new test without asking.

## The layers

| Layer | What it tests | Goals | Speed (local) | What it fakes | Where its time comes from |
| --- | --- | --- | --- | --- | --- |
| API HTTP tests (`apps/api/src/**/*.test.ts`, 26 files, 508 tests) | Every route's behaviour through `createApp`: status, body, stored rows, the email outbox, auth failures, cross-venue 404s, clock changes, a few races | 1, 2, 3, 5 | ~40s, one worker, real Postgres (`rota_ready_test`) | Only outside boundaries: email outbox, clock, JWT signing key, Staff Link key | A fixed default instant (`DEFAULT_NOW`, 2026-01-05 12:00 UTC); a scenario sets its own with `app.setClock` |
| Shared unit tests (`packages/shared`, 3 files, 75 tests) | Week attribution, Shift times across clock changes, date formatting | 3, 5 | under 1s | Nothing | Instants passed in as input |
| Web unit tests (`apps/web`, 4 files, 23 tests) | Logic that is hard to check by hand: grid layout, "No reply", error-message mapping | 3, 5 | under 1s | Nothing | Instants passed in as input |
| Playwright journey (`apps/web/e2e/journey.e2e.ts`, 91 serial steps) | The Owner's and a Staff Member's whole MVP journey through the real stack: Supabase Auth, the API, real SMTP into Mailpit, the browser; a full-page screenshot per step | 1, 2, 4 | ~40s, plus server start-up | Nothing. Three steps intercept a request on purpose: two fail a save before it reaches the API, one slows the API down | Real time. Shifts sit two Weeks ahead, so none starts during a run; "No reply" uses last Week |
| CI checks (`ci.yml`) | shadcn components untouched; ESLint; typecheck; migrations atomic and squawk-clean (`lint:migrations`, PRs only); `pnpm build` | 1, 6 | seconds | — | — |

The compatibility check from #96 (PR #104) adds one more CI layer once merged: the base branch's API tests run against the PR's migrations.

## Measurements

### CI time (goal 5)

How: `gh api repos/sjblurton/rota-ready/actions/runs/<run>/jobs`, taking the "Lint, typecheck, test, build, e2e" job's `started_at` to `completed_at`, and each step's own times, for the last 10 CI runs on `main` and the last 16 completed pull request runs.

| Last 10 runs on `main` | |
| --- | --- |
| Median | 2m48s |
| Range | 2m04s to 4m37s |
| Over 5 minutes | 0 of 10 |

| Step | Oldest 3 runs | Newest 3 runs |
| --- | --- | --- |
| `pnpm test` | 23–27s | 33–52s |
| Journey | 33–36s | 45–58s |
| Start local Supabase | 27–28s | 21–60s |
| Install Chromium | 13–21s | 17–145s |

Pull requests: median 3m12s over 16 runs, and one over budget, PR #111 at 7m31s. Its Chromium install took 281s. It wasn't the only slow download, but they are rare: across all 26 runs the Chromium step took 13–46s except twice, 145s (`main`, run 45184963694) and 281s (#111, run 45222148580). Nothing caches the browser (#112).

The trend is up: the newest three runs took 3m14s to 4m37s against 2m04s to 2m13s for the oldest three, as the API suite and the journey grew with each ticket. Two unmerged PRs add more: #106 runs tests with coverage on PRs (its own runs took 3m17s to 3m43s), and #104 runs the base branch's API tests again on PRs that change migrations (not measured; roughly one more API suite, ~40s locally, plus an install). Still inside 5 minutes once Chromium is cached, but the margin is under two minutes.

### Flakiness (goal 5)

How: in a worktree at `efbcded`, with local Supabase running.

- API suite: `npx vitest run --reporter=json` in `apps/api`, three times in a row. Then compared every test's status across the three JSON reports.
- Journey: `pnpm --filter @rota-ready/web e2e:isolated --reporter=json`, three times in a row.

| Suite | Run 1 | Run 2 | Run 3 | Tests that differed |
| --- | --- | --- | --- | --- |
| API (508 tests) | 508 passed, 41s | 508 passed, 40s | 508 passed, 42s | none |
| Journey (91 steps) | 91 passed, 45s | 91 passed, 38s | 91 passed, 39s | none, no retries |

CI history agrees. In the last 30 completed CI runs, no journey step passed only on its retry. The retries that happened were both real failures: a probe that fails on purpose in #106, and the Sunday-evening failure on `main` at `71a1378`, when the journey's Sunday 20:00 Shift had already started. #90 fixed that one by moving the journey's Shifts two Weeks ahead and giving API tests a fixed default clock.

CI retries a failed journey once (`retries: 1`). The GitHub reporter still annotates a step that passed only on its retry, so a flake isn't silent, but it shows on the run's summary page rather than on the PR. #106's CI report comment is the natural place to surface it later. No ticket proposed now, since none has happened.

The only real-time reads in tests are the ones the skill allows: JWT expiry in `test-app.ts`, and the journey's sign-up email and Mailpit timestamps.

### Coverage, for information only

How: `@vitest/coverage-v8@5.1.0` installed for the run and removed afterwards (package files restored with `git checkout`). Each package ran `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.include='src/**/*.{ts,tsx}'`, excluding test files, `src/generated/**` (the Prisma client), `routeTree.gen.ts` and `*.d.ts`. Every other `src` file counts, including ones no test loads. Each package is measured on its own tests.

| Package | Files | Lines | Branches | Functions | Files at 0% |
| --- | --- | --- | --- | --- | --- |
| `apps/api` | 36 | 94.1% (538/572) | 88.8% (221/249) | 96.2% (201/209) | 2: `server.ts`, `lib/email-sender.ts` |
| `packages/shared` | 11 | 72.1% (88/122) | 83.0% (39/47) | 85.4% (35/41) | 5, all Zod schemas and their helpers |
| `apps/web` | 76 | 5.1% (30/594) | 5.9% (20/337) | 2.5% (8/315) | 67 |

What the numbers mean:

- **API:** the two 0% files are production wiring (`server.ts`) and the real SMTP adapter. The journey runs both, through Mailpit.
- **Shared:** the 0% files are schemas the API tests use heavily, but a per-package run only counts the package's own tests.
- **Web:** low by design. React components are tested by the journey, not by Vitest. 16 of the 76 files are shadcn components, which CI keeps as untouched CLI output; without them it's 6.0% (30/503). #103 is the backlog ticket for journey coverage.

No coverage gate is proposed. #102 (PR #106) adds coverage to every PR's CI report comment, for information.

### Mutation sample (goal 3)

How: one deliberate break at a time in the worktree, then the API suite (and the shared suite for the break in `packages/shared`). Races aren't deterministic, so each race break ran three times. Every break was restored with `git checkout <file>`, and `git status` was clean afterwards.

| # | Rule | Break | Result |
| --- | --- | --- | --- |
| 1 | Tenancy | `findVenueMembership` finds any membership of the Venue, ignoring the User (the "any login sees any venue" bug from the first attempt) | **Red:** 36 tests, all in "when a member of another venue requests it" blocks |
| 2 | Clock changes | `shiftTimesOneWeekLater` adds 7 × 24 hours in UTC instead of keeping the local times | **Red:** 5 shared tests and 3 API Copy Last Week tests (March, October, and the Overnight Shift on the October night) |
| 3 | Who is emailed | Send Updates stops telling the old Staff Member when a Shift is reassigned | **Red:** 6 Send Updates tests |
| 4 | Row locks | `lockActiveStaffMemberUntilCommit` without `FOR UPDATE` | **Survived**, 3 runs out of 3. The "four overlapping Shifts at once" test fires requests together and doesn't force the race. #82, fixed by PR #111 once merged |
| 5 | Row locks | `lockRotaUntilCommit` without `FOR NO KEY UPDATE` | **Red**, 3 out of 3: one test, Send Updates "from two tabs at once" |
| 6 | Row locks | Copy Last Week no longer takes the Rota lock (the others keep it) | **Survived**, 3 runs out of 3. #113 |
| 7 | Row locks | Deleting a Shift no longer takes the Rota lock (the others keep it) | **Survived**, 3 runs out of 3. #113 |

Breaks 6 and 7 were added after break 5, to see which uses of the Rota lock that one red test actually protects. For races, the rota tests (`src/features/rota`) ran instead of the whole suite.

### Overlap spot-check

How: for five behaviours, compared the `it` and `test` titles and assertions in the API tests with the journey's steps.

| Behaviour | API tests assert | The journey asserts | Verdict |
| --- | --- | --- | --- |
| Overlapping Shifts refused | `shift_overlaps` for an overlap, none when touching at 17:00, none for another Staff Member, the previous Week's Overnight Shift, four at once, and edits | The same message in three steps: same day, last Week's Overnight Shift, and moving a Shift onto a busy time | **Overlap.** Steps two and three re-test rule variants through the same message. A few seconds each, so not worth a ticket; the skill now says one journey step per message, with variants in API tests |
| Archive refused with an upcoming Shift | The 409 code, partway through a Shift, a published Shift that was deleted, Shifts that have ended | The toast's text, the dialog staying open, the list unchanged | Complementary: the journey checks the wiring the API can't |
| Who Send Updates emails | Who is and isn't emailed, an archived Staff Member, a failed send, two tabs, each email's lines | The result dialog lists Jo and Sam; Mailpit gets one email each, with "was", "removed" and "new" lines | Mostly complementary. The email lines are asserted in both, but only the journey runs the real SMTP adapter (0% in API coverage) |
| Copy Last Week | Clock changes, skipped Shifts, refusals, Shifts already in the Week | Times, Role and notes copied; the button goes | Complementary |
| Saved after a reload | Stored rows and a follow-up GET | Seven "keeps … after a reload" steps | Light overlap, kept on purpose: it shows the screen reads from the server and not only from the cache |

## Holes

Risks no layer covers today, each with a concrete example:

| Hole | Example | Goal | Ticket |
| --- | --- | --- | --- |
| Staff Member row lock unproven | Break 4 above survived | 3 | #82, PR #111 |
| Rota row lock unproven for Copy Last Week and deleting a Shift | Breaks 6 and 7 survived; two Copy Last Week requests at once could store every Shift twice | 3 | #113 |
| Migrations against the running API | squawk reads statements, not behaviour: a new constraint that the running API's writes break passes it | 1 | #96, PR #104 |
| API changes against the running web app | A PR that renames a response field passes CI, then breaks every Owner's open browser tab after the deploy | 1 | #115 |
| Production builds never exercised | The journey runs `tsx watch` and `vite` dev; a bug only in `tsdown`'s bundle or `vite build` output deploys | 1, 4 | #114 (#28 later, on a paid plan) |
| Staff Link page at phone width | The PRD's Staff Members use phones; every journey screenshot is Desktop Chrome | 4 | #116 |
| Slow browser download | 281s Chromium download on #111 | 5 | #112 |

Risks considered and left, with the reason:

- **A migration that rewrites data.** #104 runs the base branch's tests on an empty database, so it proves the schema, not the data. Data changes so far (such as #105's sync trigger) get their own tests in `database-constraints.test.ts`, which is the right place. No ticket.
- **A new venue route outside the membership middleware.** Tenancy is structural: every venue route mounts under `requireVenueMember`, and all 15 venue-scoped routes have a cross-venue 404 test. Break 1 turned 36 tests red. The skill rule is enough.

## The goals, one by one

1. **Keep `main` deployable: partly.** Lint, typecheck, tests, build, journey and the migration lint all gate the deploy job. The migration compatibility check arrives with #104. API-to-web compatibility (#115) and the production builds (#114) are unchecked.
2. **Make refactoring safe: yes.** API tests go through HTTP only. When #76 moved Rota and Shift into a feature folder, the publish, edit and delete test files moved unchanged (0 lines changed), and the other files only split. The one coupling is tests that check bookkeeping columns directly: 22 `told*` field references in 3 test files, which is part of why #105's rename touches 7 test files. The skill now prefers the response or a follow-up request, and a row only when the outcome isn't visible through the API.
3. **Protect the risky rules: yes for tenancy, time and email; no for locks.** Breaks 1 to 3 went red at once. Three of four lock breaks survived (#82, #113).
4. **Show what the user sees: yes, at desktop width.** 91 steps through the real stack, a screenshot each, uploaded on every PR. Phone width is #116.
5. **Fast and deterministic: yes.** No flaky tests in three runs each or in 30 CI runs, no day dependence since #90, and a median well under 5 minutes. The one over-budget run was a download, not the tests (#112).
6. **Easy to follow: mostly.** The skill and the README covered the HTTP, time and email patterns well. Nothing said where a race test goes or how it must force the interleaving, or that migration safety is a CI check, not a test. This audit adds both to the skill and the README.

## Follow-ups

New, all `needs-triage`:

- #112 CI caches Playwright's Chromium, so a slow download can't push a run past 5 minutes
- #113 Tests that go red when the Rota row lock is removed from Copy Last Week or Delete Shift
- #114 The journey runs in CI against the production builds, not the dev servers
- #115 Prove each PR's API works with the web app already running in production
- #116 The journey shows the Staff Link page at phone width

Already covered:

- #82: Staff Member row-lock races (PR #111)
- #96: migrations against the running API (PR #104)
- #102: coverage in every PR's CI report, for information (PR #106)
- #103: coverage from the journey (backlog)
- #28: smoke-test each PR on a Render preview (paid plan)
