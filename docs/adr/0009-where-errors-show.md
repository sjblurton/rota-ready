# Errors show where the user can fix them, and never reveal which accounts exist

An error shows wherever the user can fix it. If changing one field fixes it, it shows under that field, as validation does. If changing the form as a whole fixes it, it shows at the bottom of the form's `FieldGroup`. If nothing in the form can fix it, as with `internal_error`, a network failure or rate limiting, it shows as a toast (shadcn's Sonner).

Login and sign-up never reveal which accounts exist. A failed login always says "That email and password don't match an account." at the form level, never which one was wrong. Signing up with an email that already has an account looks exactly like signing up with a new one: the same "check your email" screen, with no "account already exists" message.

The API sends only `{ code }` (ADR-0005). Each mutation handles its own errors in its own `onError`. It places the codes its form can fix with `setError`, shows a toast for the rest, or deliberately shows nothing. Two cases are handled once for the whole app instead:

- **`unauthorized`** signs the User out and redirects to `/login`, which explains that the session has ended.
- **Page-load errors** replace the page, through the route's `errorComponent`, with a **Try again** button. There's no retry for `not_found`. A page that failed to load never shows as a toast over an empty page.

A success shows as a toast only when nothing on the page changes to show it, such as Publish or Send Updates emailing staff. Otherwise the change on the page is the confirmation: an added Shift appears in the grid, a renamed Venue's heading updates, an archived Staff Member leaves the list.

## Considered Options

- **A global `MutationCache.onError` that toasts any error a mutation doesn't list in `meta`**: guarantees no mutation forgets to show a failure. But it can't reach a form to call `setError`, it hides behaviour away from the mutation, and some actions shouldn't show a toast at all. Rejected.
- **The API returns the field an error belongs to (`{ code, field }`)**: forms could place server errors without mapping codes. But it ties the API to each form's input names, and a code like a duplicate email already implies its field. Rejected.
- **A toast for every success** ("Shift added", "Venue renamed"): consistent feedback. But it repeats what the page already shows, and toasts stack up when the Owner adds many Shifts in a row. Rejected.
- **Friendlier auth messages ("No account with that email", "Account already exists, log in instead")**: kinder to someone who mistypes, but they let anyone check which emails are registered. Rejected.
