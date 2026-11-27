---
name: scenario-tests
description: Scenario-based test structure (describe "when…" + beforeEach setup + focused it). Use whenever writing, updating or refactoring unit/integration tests (vitest, jest, testing-library), including refactoring an existing test file without losing coverage.
---

# Scenario-based tests

## Rules (apply to all new or updated tests)

- Isolate each situation in a `describe` block, usually named starting with `when` or `if`.
- Set up the scenario in that block's `beforeEach()`, including rendering, fixtures, and user interactions. Use async setup when needed.
- Nest scenario blocks when a situation builds on an earlier one; each nested block's `beforeEach()` sets up its additional conditions.
- Keep `it` or `test` blocks focused on asserting the outcome named in their description. Prefer one assertion per test; use only a handful when they express one inseparable outcome.
- Give separate outcomes separate tests, and keep each test independent with a fresh scenario and cleanup between tests where needed.
- Keep each test file self-contained (WET is fine): no shared `testUtils` file. Small local helpers inside the file are OK if the scenario stays clear in its `beforeEach()`. Rota Ready's API tests have one exception, described in *Rota Ready specifics*.
- Don't repeat the same setup in two `beforeEach` blocks (e.g. filling the same form twice). Nest the scenarios so the setup runs once, and hang the other outcomes off that one branch.

```ts
describe('when the submenu is reopened', () => {
  beforeEach(async () => {
    // Render the navigation, select a submenu item, and reopen the submenu.
  });
  it('keeps the current screen visible', () => {
    // Assert that the current screen is visible.
  });
  it('shows the current item as selected', () => {
    // Assert that the submenu item is selected.
  });
});
```

## Patterns (React + vitest + testing-library)

- **Shared `user`**: declare `let user: ReturnType<typeof userEvent.setup>;` in the outermost scenario that interacts, assign `user = userEvent.setup()` in its `beforeEach`. Nested blocks reuse it.
- **Fake timers + userEvent**: if the file uses `vi.useFakeTimers({ shouldAdvanceTime: true })`, set up the user with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Otherwise every keystroke waits for the fake clock to tick in real time (≈40% of runtime spent idle).
- **Timeouts**: each `beforeEach` gets its own `hookTimeout` (10s); only the `it` body counts toward `testTimeout` (5s). Putting the heavy interaction in `beforeEach` and keeping `it` to assertions keeps tests well clear of the timeout.
- **Settle before acting**: before clicking a button that re-enables asynchronously (e.g. Save after fixing validation), wait for it to be enabled; before a sync assertion, wait for the state it depends on (e.g. `await findByText(error)`). Faster runs expose races that slow runs hide.
- **Other shared handles** (e.g. a `setOpen` returned from a render helper) follow the same `let` + assign-in-`beforeEach` pattern.
- **Mocks**: Rota Ready doesn't mock its own code, the API, the database, or auth (see *Rota Ready specifics* below). If an external boundary really must be stubbed in a component test, `vi.mock(...)` is hoisted and must stay in each test file, with return values set in that file's top-level `beforeEach`.
- **Parameterised cases**: use `describe.each(...)('when …%s', …)` with a `beforeEach`, not `it.each` with setup in the body.
- **Intermediate assertions**: a check made mid-flow ("error shows, then fix, then error clears") becomes an `it` in the parent scenario plus a nested `describe('when … is fixed')` whose `it` checks the after-state.
- **Waiting**: settle async state in `beforeEach` (`await screen.findBy…`, `await waitFor(...)`) so `it` blocks can stay synchronous `getBy`/`queryBy` assertions where possible. 
- **Asserting removal**: use `waitForElementToBeRemoved`, which also proves the element was there first. It throws if the element is already gone when called, so start it *before* the interaction and await it *after*, then keep the `it` synchronous:
  ```ts
  beforeEach(async () => {
    const errorRemoved = waitForElementToBeRemoved(screen.getByText('Name is required'));
    await user.type(screen.getByLabelText('Name'), 'Alice');
    await errorRemoved;
  });
  it('removes the required error', () => {
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });
  ```
- **Don't re-assert the `beforeEach` wait**: an `it` that checks the same thing its `beforeEach` already awaited (e.g. `waitFor(() => expect(mutateAsync).toHaveBeenCalled())` then `it` → `toHaveBeenCalled()`) can never fail on its own. Assert something more specific (the payload) or drop it.
- **Don't repeat incidental assertions**: when many scenarios end with the same side effect (e.g. modal closes after save), assert it in one dedicated scenario and let the others assert only their distinguishing outcome.
- **Large files**: split by area into self-contained `Component.<area>.test.tsx` files, each with its own mocks and setup. Shared *data* (fixtures, base payloads) can live in `Component.fixtures.ts`. Separate files also run in parallel.
- Keep any global guards the file already has (e.g. `afterEach` asserting `console.error` was not called).
- Remove debugging leftovers (`screen.debug()`, `logTestingPlaygroundURL()`).

## Rota Ready specifics

These follow from the spec (#1) and ADRs, and take precedence over the generic patterns above.

- **Which layer a new test goes in:**
  - A rule the API enforces (a status, a response body, an email, a 404): an API HTTP test next to the route. This is the default.
  - A pure calculation in `packages/shared`: a Vitest unit test with its instants passed in. Web logic follows **Front-end tests** below.
  - What the user sees, and the wiring between screens, real email and Supabase Auth: journey steps, as **Playwright, where it fits** describes.
  - A race on a row lock: an API test, written as described under *Race scenarios* below.
  - Migration safety: the CI checks in ADR-0006, not a test.
  - Coverage is reported for information only; it isn't a target.
- **No fakes of our own system.** No MSW, no mocked API client, no mocked Prisma, and no mocked auth or venue-membership checks. The only fakes are at outside boundaries passed into `createApp({ db, clock, emailSender, authConfig, staffLinkKey, answerModel })`: the in-memory email outbox, a fixed `clock`, a test signing key in `authConfig`, and a scripted `answerModel` standing in for Anthropic (ADR-0012).
- **API integration tests** (Vitest, real Postgres, single worker, truncate before each test): the outer `beforeEach` builds the app and seeds the scenario through HTTP or the database; nested `describe('when …')` blocks make the request; `it` blocks assert the status, the body, the database row or the outbox. Prefer the response or a follow-up request. Check a row only when the outcome isn't visible through the API, such as nothing being stored, so a schema change or rename doesn't force test edits. Global migrate and truncate setup lives in Vitest config, which doesn't count as a shared `testUtils` file.
- **Service tests** (ADR-0010): HTTP tests are the default, one `<concept>.<action>.test.ts` per route next to the code. A `<concept>-service.test.ts` that calls a service directly is allowed only when a rule has more combinations than the HTTP tests cover comfortably. It runs against real Postgres with the same seed and clock helpers, and never fakes our own code.
- **Shared API test infrastructure**: API tests share two files, and nothing else.
  - `apps/api/test/test-app.ts` starts the app with the outside-boundary fakes (a test signing key, a random Staff Link key, and a logger that records to memory so a test can check what was logged), and signs tokens and sends requests against it. It also holds the `clock`: a fixed instant (`DEFAULT_NOW`) unless a test sets its own with `app.setClock(...)`. Later fakes, such as the email outbox, belong here too.
  - `apps/api/test/seed.ts` holds seed factories such as `createUser`, `createVenueFor` and `createActiveStaffMember`, with defaults each test can override.

  Every scenario's data is still created by explicit calls in its own `beforeEach` (`await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' })`), so the scenario reads from the test file alone. Pass every value a test asserts on; never assert on a value a factory defaulted. Shared fixtures that create data without being called, such as a global `beforeEach` or a factory that seeds more than it says, are not allowed.
- **Tenancy scenarios**: every venue-scoped route gets a `describe('when a member of another venue requests it')` block that asserts 404.
- **Email scenarios** check both who received an email and who did not, in separate `it` blocks.
- **Race scenarios** force the interleaving. Hold the row lock from a second database connection, wait until the request is blocked on it, commit the competing change, then await the response. For the Staff Member row, use `holdStaffMemberLock` from `apps/api/test/test-app.ts`, and for the Venue row, `holdVenueLock`. Requests fired together with `Promise.all` may not interleave, so they can pass without the lock. Check that the test goes red when the lock is removed.
- **Time scenarios** set the injected clock in `beforeEach`; use `describe.each` for the March and October clock-change cases.
- **No result depends on the day a test runs.**
  - API tests run on the fixed default clock, and a test that depends on time sets its own.
  - React and shared tests never read the clock. Pass in the instants a test needs.
  - The Playwright journey runs on real time. It plans its Shifts two Weeks ahead of today, so none starts during a run. When a step needs a Shift that has started, it uses last Week, where every Shift has.
  - Rules about the moment a Shift starts and clock changes are tested in API, React or shared tests at fixed instants. A daylight saving bug gets its test there.
  - Only JWT expiry and unique values (such as the journey's sign-up email) read real time.
- **Front-end tests** only for logic that's hard to check by hand (e.g. grid layout) or that depends on time passing (e.g. "No reply"). Everything else is covered by API tests and Playwright.
- **Playwright, where it fits**: the MVP journey spec grows with each ticket, adding steps for the screens and messages it changes. Rule variants that show the same message belong in API tests. Use `test.describe('when …')` with setup in `test.beforeEach` for scenarios that can run independently; when steps must happen in order through one journey, use `test.describe.serial` with each `test` named after the outcome it checks. Always run against the real stack (local Supabase), with no auth bypass.

## Refactoring an existing test file without losing coverage

1. **Baseline coverage** – run only the target tests with coverage scoped to the component folder, saving the report:
   `npx vitest run <dir> --testTimeout=30000 --coverage --coverage.include='<dir>/**' --coverage.exclude='**/*.test.tsx' --coverage.exclude='**/*.stories.tsx' --coverage.reporter=text --coverage.reporter=json-summary --coverage.reportsDirectory=<scratchpad>/baseline`
   (Coverage slows tests; raise the timeout so slow tests don't fail spuriously.) Also add an extra `--coverage.include` for each component the tests drive that lives outside `<dir>` (check the imports), and use `--coverage.reporter=json` so you can compare per-statement hits afterwards.
2. **Behaviour inventory** – list every assertion in the old file (including mid-test ones) with an ID, e.g. `B12: EVERY_MONTH default day shows 1`. Coverage numbers alone don't detect a dropped assertion.
3. **Refactor** into scenarios following the rules above.
4. **Verify** – all tests pass; rerun coverage into `<scratchpad>/after` and compare per file (lines and branches must be >= baseline; better still, diff the statement/branch/function hit maps in `coverage-final.json` so nothing that was covered becomes uncovered); map every inventory ID to the new test(s) that cover it. Report the before/after table and the mapping. Note any deliberate de-duplications (rule: "don't repeat incidental assertions").
