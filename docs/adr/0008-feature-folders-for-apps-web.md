# apps/web groups code into feature folders named after glossary terms

`apps/web/src/features/` holds one folder per area of the glossary: `venues/` (Venue, Venue Member, Owner, Member Role), `staff-members/` (Staff Member, Role, Archive), `rota/` (Week, Rota, Shift, Overnight Shift, Draft and Published, Publish, Copy Last Week, Changed Shift, Removed Shift, Send Updates), `staff-links/` (the Staff Link page, Shift Response, Decline Reason) and `users/` (logging in, signing up and the current User). A feature folder holds its components, queries and mutations together.

Anything that names a glossary concept lives in its feature, however many features use it. `components/` holds app-wide UI with no domain concept, such as `PageLoading` and the application header. `components/ui/` stays shadcn. `lib/` is infrastructure: the API client, Supabase and `cn`. `i18n/` stays app-wide.

Feature folders are flat. Each filename says what the file is (`venue-queries.ts`, `create-venue-form.tsx`), and tests sit next to the file they cover. Subfolders are added only when a feature gets hard to scan.

Route files stay thin. A route holds its config (`beforeLoad`, `loader`, `errorComponent`) and a page component that lays out feature components. Forms, mutations and dialogs live in features.

Imports follow three rules:

- A feature can import any file from another feature directly. There are no barrel files.
- `components/` and `lib/` never import from `features/`. ESLint enforces this.
- Nothing imports from `routes/`. ESLint enforces this.

## Considered Options

- **Components next to the routes that use them (`routes/**/-components/`)**: keeps a page's pieces beside it. But Staff Members, Shifts and Rotas appear on several routes, so most components would be pushed up to `_authenticated/-components/` and the folder would become a second `components/`. Rejected.
- **Domain subfolders under `components/` (`components/rota/`)**: groups the UI by concept. But queries and mutations would stay in `lib/`, so one concept would be split across two trees. Rejected.
- **One flat `components/` and `lib/`**: what the app started with. It mixes app-wide UI with components that one feature uses, and gets crowded as features land. Rejected.
