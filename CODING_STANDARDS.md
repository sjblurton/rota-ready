# Coding standards

The judgement calls a reviewer checks in every diff. Each one comes from review comments that kept coming back. `AGENTS.md`, `docs/building-ui.md`, `docs/adr/` and `.claude/skills/scenario-tests/SKILL.md` also apply, and a rule that a lint or CI check enforces isn't repeated here.

## Fixed sets use named values

A value from a fixed set comes from the thing that defines the set:

- **A Prisma enum:** `ShiftResponse.pending`, `RotaStatus.draft`.
- **A shared zod enum:** `apiErrorCode.not_found`, which is `apiErrorCodeSchema.enum`.
- **A `const` object** for a set that exists only in one place, such as the variants of a badge.

A string literal is still fine in a test assertion, because there it checks what goes over the wire. It is also fine in a type position such as `Refused<'not_found'>`, where `typeof apiErrorCode.not_found` would only add noise.

## Use the library's own setup

Before writing glue, use the library's documented integration:

- `pino-http` for request logging
- `zodResolver` and the shared schemas for form validation
- shadcn components for UI
- Prisma for queries. Raw SQL is only for what Prisma can't express, such as row locks or copying one column into another. Name the function for what it does, and say in the PR what Prisma couldn't do.

Flag custom wrappers, scripts or helpers that redo what a dependency already does, and tests of a library's own behaviour.

## Build what the ticket uses

Every helper, option, script and config line in the diff is used by the ticket's behaviour or its tests. Flag anything a reviewer would ask "do we need this?" about: speculative parameters, unused exports, a dependency nothing imports, or a check script for something CI or Playwright already covers.

## Where code lives

- **Private until shared.** A component, hook or helper that one file uses stays in that file, unexported. It moves to its own file when a second file needs it.
- **Thin routes.** A route file holds its config and lays out feature components (ADR-0008). Forms, mutations and dialogs live in features.
- **Hooks for wiring.** Pull a component's mutation and cache wiring into a custom hook (`useShiftMutation`) when two components repeat it, or when it is most of the component's body.
- **Wrappers that decide.** A local field component earns its place when the fields it covers are the same field with a different label, like Start and End. If it would need to switch on its props to choose the control, placeholder or layout, compose the shadcn parts inline instead (`docs/building-ui.md`).
- **No barrel files.** Import each file directly. The only `index.ts` is `packages/shared`'s package entry.
