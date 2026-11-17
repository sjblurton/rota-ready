## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on sjblurton/rota-ready, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## React

- The React Compiler is on (ADR-0004). Don't add `useMemo`, `useCallback` or `React.memo` by default. Only add one with a comment explaining why the compiler isn't enough.
- Follow the Rules of React: components and hooks are pure, so never mutate props, state or values used in render while rendering. `eslint-plugin-react-hooks` enforces this as errors; fix the code rather than disabling the rule.

## Testing

Every Vitest and Playwright test follows `.claude/skills/scenario-tests/SKILL.md`, including its *Rota Ready specifics* section (no fakes of our own system, a cross-venue 404 test for each venue route, real Postgres).
