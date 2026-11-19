# Forms use React Hook Form with the shared Zod schemas, shadcn `Field` components, and translated validation messages

Every form in `apps/web` is built with **React Hook Form** and validated through `zodResolver` by a Zod schema from `packages/shared`: the same one the API uses, or for login and signup (which go to Supabase Auth) the shared `credentialsSchema`. Required fields, lengths and formats live in the schema, not in hand-written checks or `required` and `maxLength` attributes, so the browser and the API can't disagree. Default values come from shared constants such as `DEFAULT_TIME_ZONE`. Forms set `noValidate` so the browser's own English bubbles never show. Each input sits in shadcn's `Field` (label, control and `FieldError`), composed where it's used rather than wrapped (see `docs/building-ui.md`), with the error tied to its input by `aria-describedby`. Form-level and API errors show in a `FieldError` at the bottom of the form's `FieldGroup`, and confirmations use `AlertDialog` rather than `window.confirm`.

Each rule in a shared schema carries a translation key as its message, such as `.min(1, 'validation.required')`, and `FieldError` passes field errors through `t()`. The schemas hold keys, not English, and the API never sends them anyway (ADR-0005). A message that needs a limit, such as the Venue name's maximum length, reads it from an i18next default variable set from the shared constant. Several shared schemas trim or normalise input, so their input and output types differ. `useForm` takes both from the resolver, and submit handlers receive the parsed output.

## Considered Options

- **Uncontrolled forms with `FormData` and hand-written checks**: what the first forms did. Validation drifted from the API's schema, and every form re-implemented error display. Rejected.
- **TanStack Form**: fits the rest of the TanStack stack, but React Hook Form is what shadcn's form guidance is built around and has the more established Zod resolver. Rejected for now.
- **English messages in the shared schemas**: the schemas would carry English the API must never send. Rejected.
- **A web-side Zod error map** that turns each issue's code into a translated message: needs no keys in the schemas, but it's a second, generic mapping that has to guess which message fits each issue. Rejected.
