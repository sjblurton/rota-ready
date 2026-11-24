# Building UI

The web app's components are based on [shadcn/ui](https://ui.shadcn.com) and built on [Radix](https://www.radix-ui.com). This page explains where files go, when to wrap components, and how to change how they look.

## Where files go

Code is grouped by glossary term into feature folders (ADR-0008):

```
apps/web/src/
├── components/            app-wide UI with no glossary concept
│   ├── ui/                shadcn components
│   ├── health-status.tsx
│   ├── page-load-error.tsx
│   └── page-loading.tsx
├── features/
│   ├── venues/            Venue, Venue Member, Owner, Member Role
│   │   ├── venue-queries.ts
│   │   ├── venue-mutations.ts
│   │   ├── venue-name-field.tsx
│   │   ├── create-venue-form.tsx
│   │   └── rename-venue-form.tsx
│   ├── staff-members/     Staff Member, Role, Archive
│   ├── rota/              Week, Rota, Shift, Overnight Shift, Draft, Published,
│   │                      Publish, Copy Last Week, Changed Shift, Removed Shift,
│   │                      Send Updates
│   ├── staff-links/       the Staff Link page, Shift Response, Decline Reason
│   ├── plans/             Plan, Free, Pro and the landing page that shows them
│   └── users/             logging in, signing up, the current User and the header
├── i18n/                  translations, shared by every feature
├── lib/                   infrastructure: the API client, Supabase, cn
└── routes/                route config and page layout only
```

- **shadcn components**, in `components/ui/`: primitives such as a button, an input or a field. Add them with the shadcn CLI (`pnpm dlx shadcn@latest add <name>` from `apps/web`), never by hand. They're typechecked through `apps/web/tsconfig.ui.json`, which turns off `exactOptionalPropertyTypes`, so they compile as the CLI writes them. App code sees them through that project's declarations and stays strict.
- **Product components** compose shadcn components into a product concept, such as a delete dialog or the application header. Name each one for what it does. If it names a glossary concept, it goes in that feature's folder, however many features use it. If it doesn't, it goes in `components/`.
- **Queries and mutations** go in the feature they belong to (`venue-queries.ts`, `venue-mutations.ts`). See [Reading and changing data](#reading-and-changing-data).
- **Routes** hold their config (`beforeLoad`, `loader`, `errorComponent`) and a page component that lays out feature components. A route file has no `useForm` or `useMutation`.

Feature folders are flat, with tests next to the file they cover. A feature can import any file from another feature directly, without barrel files. ESLint stops `components/` and `lib/` importing from `features/`, and stops anything importing from `routes/`.

Give a product component a closed API. Its props describe the product concept, such as what is being deleted and what happens on confirm. The component decides everything else itself: which shadcn components to use, how to lay them out and which Radix options to set. Consumers cannot reach inside it.

The thing to avoid is a wrapper whose props pass Radix props straight through, renamed to look generic (`side`, `disabled`, `onValueChange`). It looks reusable, but:

- **It never covers enough.** Each new consumer needs one more option, so the wrapper gains another prop, until it mirrors the component it wraps.
- **Every prop has to keep working.** When shadcn or Radix changes, the wrapper has to keep every passed-through prop working for every consumer.

If a consumer needs that level of control, it does not need a wrapper. Use the shadcn components directly.

```tsx
// ❌ Bad: a generic wrapper. Its props only make sense if you know the select inside, and the next consumer will need `open` or a custom item renderer.
type SharedSelectProps = {
  items: string[];
  disabled?: boolean;
  side?: 'top' | 'bottom';
  onValueChange?: (value: string) => void;
};
```

```tsx
// ✅ Good: named for its one use. The props describe the filter, and the component picks the select's settings.
type ShiftRoleFilterProps = {
  value: RoleId | null;
  onChange: (role: RoleId | null) => void;
};
```

```tsx
// ✅ Good: a closed API that describes the product concept. The dialog owns its trigger, the confirmation and the archive request.
type ArchiveStaffMemberDialogProps = {
  venueId: string;
  staffMember: StaffMember;
};
```

## Reading and changing data

Three rules keep server data in TanStack Query's cache and out of props and state.

**Read cached data through a hook that takes IDs.** A component that needs data its route has already loaded takes the IDs (or the Staff Link token) as props and reads the data itself with `useSuspenseQuery`, directly or through a feature hook such as `useRotaWeek`. The route still loads every query in its `loader`, so nothing fetches on mount. A route may read a query for its own layout, such as a heading or an empty state, but not only to pass the data down.

```tsx
// ❌ Bad: the route reads the Venue only to hand it to the form.
const { data: venue } = useSuspenseQuery(venueQuery(venueId));
return <RenameVenueForm venue={venue} />;
```

```tsx
// ✅ Good: the form takes the ID and reads the Venue from the cache the route's loader filled.
export function RenameVenueForm({ venueId }: { venueId: string }) {
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
```

The exception is a list row handing its own object to a dialog or form for that row. The Staff page passes each `staffMember` into its edit form and its archive and Staff Link dialogs, because the row already has it.

**Put each mutation in a `use<Action>` hook in its feature.** The hook, such as `useArchiveStaffMember` or `useRenameVenue`, owns the request, the cache update and the error toast. The component renders and calls `mutate`. A form that puts API error codes on its fields passes its form into the hook, as `useAddStaffMember(venueId, { form, onSuccess })` does. Anything that is only the component's UI, such as closing a dialog or focusing a field, goes in an `onSuccess` option. Navigating to the result, as `useCreateVenue` does, stays in the hook, so the button stays disabled until the next page opens.

```tsx
// ❌ Bad: the dialog builds its own request, cache update and error handling.
const archive = useMutation({
  mutationFn: () => apiPost(`${staffMemberPath(venueId, staffMember.id)}/archive`, …),
  onSuccess: () => updateStaffMembers(queryClient, venueId, …),
  onError: (error) => toast.error(apiErrorMessage(t, error)),
});
```

```tsx
// ✅ Good: the hook does the work. The dialog only says what happens to its own UI.
const archive = useArchiveStaffMember(venueId, staffMember.id, {
  onSuccess: () => setOpen(false),
});
```

**Never copy query or mutation data into `useState`.** Read `query.data` or `mutation.data`, and call `mutation.reset()` to clear a result. `useState` is for UI state only, such as whether a dialog is open or which row is being edited.

```tsx
// ❌ Bad: a second copy of the result, which has to be cleared by hand.
const [result, setResult] = useState<SendUpdatesResult | null>(null);
const sendUpdates = useMutation({ mutationFn: …, onSuccess: setResult });
```

```tsx
// ✅ Good: the mutation already holds its result, and `reset()` clears it when the dialog reopens.
const sendUpdates = useSendUpdates(venueId, weekStart);
const result = sendUpdates.data;
```

## Composing instead of wrapping

Do not wrap shadcn components only to save markup.

```tsx
// ❌ Bad: a wrapper that only saves markup. It already needs an escape hatch (`inputProps`).
type TextFieldProps = {
  label: string;
  error?: string;
  description?: string;
  inputProps?: React.ComponentProps<typeof Input>;
};
```

```tsx
// ✅ Good: instead of `TextField`, compose the shadcn components where they are used. Every prop is available, including `ref`.
<Field data-invalid={!!errors.email}>
  <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
  <Input
    id="email"
    type="email"
    aria-invalid={!!errors.email}
    aria-describedby="email-error"
    {...form.register('email')}
  />
  <FieldError id="email-error" errors={[errors.email]} />
</Field>
```

Validation belongs to the form's Zod schema through React Hook Form (ADR-0007), so a field never sets `required`, `maxLength` or its own checks.

If the same field is repeated across forms, wrap it so the wrapper makes the decisions.

```tsx
// ✅ Good: the props describe what the field is for. The component sets the label, the show/hide toggle, `autoComplete` and error display, so every password field works the same way.
type PasswordFieldProps = {
  name: string; // reads the value and error from the form context
  purpose: 'sign-in' | 'new-password'; // sets `autoComplete` and the hint
};
```

```tsx
// ❌ Bad: props for changing what it renders. Callers still make every decision, and it is becoming `TextField`.
type PasswordFieldProps = {
  label?: string;
  showToggle?: boolean;
  autoComplete?: string;
  description?: string;
  error?: string;
  inputProps?: React.ComponentProps<typeof Input>;
};
```

If one form needs a different label or a description, compose `Field` there instead of adding a prop.

## Showing errors

Each mutation handles its own errors in `onError` (ADR-0009). Put a code the form can fix on its field or on `root` with `setError`. Send everything else to a toast with `toast.error(apiErrorMessage(t, error))` from `sonner`. Don't render a catch-all API error inside the form. `<Toaster />` is rendered once, in `routes/__root.tsx`.

When a route's data fails to load, its `errorComponent` replaces the page with `PageLoadError`, never a toast. Every route with a `loader` or a data-loading `beforeLoad` has one, or sits under a parent that has. `PageLoadError` shows the translated message and a **Try again** button that reloads the route, except for `not_found`, where retrying won't help. A route renders it in its own layout: inside a `<main>` when it replaces the whole page, on its own when a parent layout already has one.

Show a success toast (`toast.success`) only when nothing on the page changes to show the result, such as an email being sent. When the page updates, that is the confirmation.

## Customising a component

Use the first option that works. Each one costs more at upgrade time than the one before.

1. **The theme.** Colours, radius, fonts and spacing are design tokens in `apps/web/src/index.css`. Changing a token changes every component, and costs nothing at upgrade time.
2. **`className` where it is used.** Every component merges `className` with its own classes using `cn` (tailwind-merge), so a conflicting class wins. Use this for anything contextual, such as a width in one layout.
3. **Composition.** Build the behaviour from the component's parts where it is needed, for example `Field`, `FieldLabel`, `Input` and `FieldError` for a form field. See [Composing instead of wrapping](#composing-instead-of-wrapping).
4. **Add to the component file.** For example, a new `cva` variant or size.
5. **Change the component's existing code.** Avoid this.

Options 4 and 5 change generated shadcn code, which the CLI overwrites when a component is re-added or upgraded. CI fails a pull request that edits an existing file in `components/ui/`, so take option 4 or 5 only with the user's agreement. A pull request that upgrades components with the CLI carries the `shadcn-upgrade` label, which skips that check.
