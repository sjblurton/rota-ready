# Forms use React Hook Form with the shared Zod schemas, shadcn `Field` components, and translated validation messages

Every form in `apps/web` is built with **React Hook Form** and validated through `zodResolver` by a Zod schema from `packages/shared`: the same one the API uses, or for login and signup (which go to Supabase Auth) the shared `credentialsSchema`. Required fields, lengths and formats live in the schema, not in hand-written checks or `required` and `maxLength` attributes, so the browser and the API can't disagree. Default values come from shared constants such as `DEFAULT_TIME_ZONE`. Forms set `noValidate` so the browser's own English bubbles never show. Each input sits in shadcn's `Field` (label, control and `FieldError`), composed where it's used rather than wrapped (see `docs/building-ui.md`), with the error tied to its input by `aria-describedby`. Form-level and API errors show in an `Alert`, and confirmations use `AlertDialog` rather than `window.confirm`.

The shared schemas stay free of user-facing text, because the API never sends messages (ADR-0005). The web app's `formResolver` passes Zod a per-parse error map that turns each issue into a translated message (`validation.*` keys), using the issue's code and details such as the maximum length. Several shared schemas trim or normalise input, so their input and output types differ. `useForm` takes both from the resolver, and submit handlers receive the parsed output.

## Considered Options

- **Uncontrolled forms with `FormData` and hand-written checks**: what the first forms did. Validation drifted from the API's schema, and every form re-implemented error display. Rejected.
- **TanStack Form**: fits the rest of the TanStack stack, but React Hook Form is what shadcn's form guidance is built around and has the more established Zod resolver. Rejected for now.
- **Messages in the shared schemas**: simpler wiring, but the API would carry English strings and the schemas would depend on i18next. Rejected.
