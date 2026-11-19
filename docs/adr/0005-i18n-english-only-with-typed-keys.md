# All UI text goes through typed i18next keys, dates through shared Intl helpers, and API errors carry a code instead of a message

The MVP ships in English only, but adding translation later means finding every hard-coded string, date format and server message across the app. So from the start, every string the user sees in `apps/web` comes from `t()` with **react-i18next**. Keys are typed from `en.json`, so a missing or misspelt key fails `pnpm typecheck`, and `eslint-plugin-i18next`'s `no-literal-string` rule fails `pnpm lint` on plain text or attribute strings in JSX. Dates and times are formatted by the helpers in `packages/shared` (`formatTime`, `formatDate`, `formatShiftTimes`), built on `Intl.DateTimeFormat` with `en-GB` and a 24-hour clock by default. The IANA timezone is a required argument with no default, so a forgotten Venue timezone (ADR-0003) is a type error rather than silently showing UK time. The API never sends user-facing English. Error responses are `{ code }`, using a shared Zod schema, and the web app maps each code to a translated message, falling back to a generic one for any code it doesn't recognise. Each app owns its own translations: `apps/web` holds the UI text and the error-code messages, and the API keeps its own for the text it sends in emails. `packages/shared` holds only what both sides must agree on, such as error codes and validation message keys.

A dev-only pseudo-locale (`?lng=pseudo`) shows every string accented, padded about 30% longer and in brackets, so untranslated text and layouts that will overflow in longer languages stand out in the browser. It sits behind `import.meta.env.DEV`, so tree-shaking leaves it out of the production bundle.

## Considered Options

- **Add i18n when the second language arrives**: cheaper now, but retrofitting means touching every screen and every API error. Rejected.
- **Untyped keys**: simpler to set up, but a typo shows the raw key in production instead of failing the build. Rejected.
- **Server-provided error messages, translated on the server**: the server would need to know the viewer's language, and every client would depend on the wording. Rejected.
- **A date library (date-fns, Luxon)**: `Intl` already covers formatting and timezones in every supported browser and in Node. Revisit if date arithmetic gets complicated.
