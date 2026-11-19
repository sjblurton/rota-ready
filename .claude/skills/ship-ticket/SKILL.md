---
name: ship-ticket
description: Pick the highest-value unblocked ticket (or the one named) and ship it end to end - build, review, fix, commit, push, PR.
disable-model-invocation: true
---

# Ship a ticket

Run the whole loop without pausing between steps. Stop to ask only for a genuine product decision, a ticket split (step 2), a destructive action, or work outside the ticket. Report once, at the end.

## 1. Pick the ticket

If a ticket number was given, use it. Otherwise list open issues (commands in `docs/agents/issue-tracker.md`) and keep the **startable** ones: labelled `ready-for-agent`, unassigned, and with zero open blockers. This repo's `gh` predates `--json blockedBy`, so count blockers with the REST call in the tracker doc's **Count open blockers** line.

A ticket with open sub-issues (`sub_issues_summary` in the same REST call) is a parent: skip it and consider its sub-issues instead.

Rank by **critical path**: the ticket whose completion unblocks the most other open tickets, counted transitively, comes first. Break ties by the lower issue number.

Done when you can name the ticket, and say what it unblocks and why it beat the runner-up.

## 2. Size it

One ticket ships as one PR the user can review in a sitting and check in the browser. When a ticket is too big for that, propose splitting it into sub-issues, each its own PR. Split into vertical slices: each sub-issue delivers something a human can test in the browser, so a backend change ships with the UI that shows it. A sub-issue that only touches `packages/shared` or `apps/api` has nothing to test, so fold it into the slice that first uses it.

To split:

1. Ask the user, showing the proposed sub-issues and the browser check each one adds.
2. On a yes, create them with the parent's acceptance criteria shared out between them. Link each one to the parent as a sub-issue, and chain them with blocked-by so they ship in order (commands in `docs/agents/issue-tracker.md`).
3. Ship only the first sub-issue through the rest of this loop. The others wait for their own run.

Done when the ticket fits one PR, or the user has chosen a split and you're shipping its first sub-issue.

## 3. Set up a worktree

The user may be working in the main checkout, so never switch its branch.

```bash
git fetch -q
git worktree add -b <type>/<issue>-<slug> <scratchpad>/<slug>-wt origin/main
cp .env <scratchpad>/<slug>-wt/.env   # git-ignored; tests and dev need it
cd <scratchpad>/<slug>-wt && pnpm install --frozen-lockfile
```

Branch from `origin/main`, because local `main` is often stale. Use the session's scratchpad directory for the worktree.

Done when `pnpm typecheck` passes in the worktree.

## 4. Build it

Read the ticket, its parent spec (#1), and every ADR and glossary term it touches. Follow `AGENTS.md` and `.claude/skills/scenario-tests/SKILL.md`. Write each test so it fails without the change. For any test that could pass by accident, prove it: break the code, watch the test go red, then restore the code.

- **Shared test database:** API tests drop and recreate `rota_ready_test`, so two checkouts running `pnpm test` at once will collide.
- **Busy ports:** Playwright reuses whatever is already serving `:3000` and `:5173`, which may be the user's dev servers on another branch. When `ss -ltn` shows those ports in use, run the journey from a temporary `apps/web/playwright.alt.config.ts`: a copy of `playwright.config.ts` with `baseURL` `http://localhost:5273`, the API server given `env: { PORT: '3200' }`, the web server running `vite --port 5273 --strictPort` with `env: { API_PROXY_TARGET: 'http://localhost:3200' }`, and `reuseExistingServer: false`. Delete the file afterwards.

Done when every acceptance criterion in the ticket is met, and lint, typecheck, `pnpm test`, build and the Playwright journey all pass.

## 5. Review and fix

Run the `code-review` skill against `origin/main`. Changes are uncommitted, so diff the working tree and mark new files with `git add -N` first. Fix every documented-standard breach and every spec gap. Fix the smells that are cheap and clear. Leave the rest, with a one-line reason each. Re-run the checks from step 4 after fixing.

Done when every finding is either fixed or listed with a reason it stays.

## 6. Commit, push, PR

- **Commit** with a conventional message ending `(#<issue>)` and the attribution trailer.
- **Push** with `git push -u origin <branch>`.
- **Write the PR body** with the `pr` skill. Start it with `Closes #<issue>` and include the manual browser steps the ticket asks for.
- **Check every claim in the body against the code or a command's output before publishing it.** Edit the body afterwards if one turns out wrong.
- **Name any conflict with other open PRs** that touch the same files (`gh pr list`, then `gh pr diff <n> --name-only`). Say which PR needs the follow-up edit.

Done when the PR is open, and its body contains only claims you checked.

## 7. Hand back

Remove the worktree (`git worktree remove <path>`) so the user can check out the branch. Report:
- the PR link
- what was built
- what the review found, and what was fixed versus left
- anything not run, and why

Done when the worktree is gone and the report covers each of those points.
