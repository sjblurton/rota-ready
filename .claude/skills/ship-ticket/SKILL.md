---
name: ship-ticket
description: Pick the highest-value unblocked ticket (or the one named) and ship it end to end - build, review, fix, commit, push, PR.
disable-model-invocation: true
---

# Ship a ticket

Run the whole loop without pausing between steps. Stop to ask only for a genuine product decision, a ticket split (step 2), a destructive action, or work outside the ticket. Report once, at the end.

## 1. Pick the ticket

If a ticket number was given, use it. Otherwise list open issues (commands in `docs/agents/issue-tracker.md`) and keep the **startable** ones: labelled `ready-for-agent`, unassigned, and with zero open blockers. Count blockers with the REST call in the tracker doc's **Count open blockers** line: one call per ticket also returns its sub-issues.

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

Tests and the journey need local Supabase (`pnpm db:start`), which needs Docker Desktop. When `supabase start` can't reach Docker, run `systemctl --user start docker-desktop` and prefix the command with `DOCKER_HOST=unix://$HOME/.docker/desktop/docker.sock`.

Done when `pnpm typecheck` passes in the worktree.

## 4. Build it

Read the ticket, its parent spec (#1), and every ADR and glossary term it touches. Follow `AGENTS.md` and `.claude/skills/scenario-tests/SKILL.md`. Write each test so it fails without the change. For any test that could pass by accident, prove it: break the code, watch the test go red, then restore the code.

- **Shared test database:** API tests drop and recreate `rota_ready_test`, so two checkouts running `pnpm test` at once will collide.
- **The journey:** run it with `pnpm --filter @rota-ready/web e2e:isolated`. It starts its own servers on `:3200` and `:5273`, so it never tests the user's dev servers on `:3000` and `:5173`.
- **Look at the screens:** run the journey once with `E2E_SCREENSHOTS=<scratchpad>/shots`, which saves a full-page screenshot after every step, named `<line>-chromium-<step title>.png`. Read the screenshots of every step that shows a screen the ticket changed. Fix anything a person would notice in the browser: squashed or overflowing layout, missing labels or empty states, defaults that make them do extra work.

Done when every acceptance criterion in the ticket is met, the changed screens look right in their screenshots, and lint, typecheck, `pnpm test`, build and the journey all pass.

## 5. Review and fix

Run the `code-review` skill against `origin/main`. Changes are uncommitted, so diff the working tree and mark new files with `git add -N` first. Fix every documented-standard breach and every spec gap. Fix the smells that are cheap and clear. Leave the rest, with a one-line reason each. Re-run the checks from step 4 after fixing.

Done when every finding is either fixed or listed with a reason it stays.

## 6. Commit, push, PR

- **Commit** with a conventional message ending `(#<issue>)` and the attribution trailer.
- **Push** with `git push -u origin <branch>`.
- **Write the PR body** with the `pr` skill. Start it with `Closes #<issue>`, include the manual browser steps the ticket asks for, and say which screens you checked in screenshots. CI uploads a `journey-screenshots` artifact for every pull request, named by journey step, so the reviewer can see the same screens.
- **Check every claim in the body against the code or a command's output before publishing it.** Edit the body afterwards if one turns out wrong.
- **Name any conflict with other open PRs** that touch the same files (`gh pr list`, then `gh pr diff <n> --name-only`). Say which PR needs the follow-up edit.

- **Wait for CI** with `gh pr checks <n> --watch`. When it passes, add a link to the run's `journey-screenshots` artifact to the PR body: `https://github.com/<owner>/<repo>/actions/runs/<run>/artifacts/<id>`, with the run from `gh pr checks <n> --json link` and the id from `gh api repos/<owner>/<repo>/actions/runs/<run>/artifacts`. When CI fails, fix the cause and push again.

Done when the PR is open, CI passes, and its body links the screenshots and contains only claims you checked.

## 7. Hand back

Remove the worktree (`git worktree remove <path>`) so the user can check out the branch. Report:
- the PR link
- what was built
- what the review found, and what was fixed versus left
- anything not run, and why

Done when the worktree is gone and the report covers each of those points.
