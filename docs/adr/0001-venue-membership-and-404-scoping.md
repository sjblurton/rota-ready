# Venue access goes through a Venue Member table, and anything outside your Venues is a 404

The previous version treated any valid login as permission to read any Venue's data. To make that impossible, access goes through a `VenueMember (user_id, venue_id, role)` table, even though the MVP has only the `owner` role and one Venue per signup. Every venue-owned API route lives under `/api/venues/:venueId/...`, and a single middleware checks that the logged-in user is a member of `:venueId`. If they aren't, it returns **404**, not 403, so the response doesn't reveal that the Venue exists. Data access below the middleware always filters by `venueId`, and each such route has an integration test against real Postgres in which a member of Venue A asks for Venue B's resource and gets a 404.

## The API is the only way into the data

That check only protects anything if there's no way round it. Supabase's **Data API (PostgREST) is turned off** and `supabase-js` is used **only for Auth**, never `supabase.from(...)`. All reads and writes go browser → Express API → Prisma → Postgres. As a safety net:
- tables in `public` are **not granted** to the `anon` and `authenticated` roles
- **RLS is enabled on every table** with no policies, so those roles can read nothing even if the Data API is switched back on

Prisma connects as the role that owns the tables, which skips RLS.

## Considered Options

- **`venue.owner_id` column (one owner, many Venues)**: simpler now, but managers and co-owners would later mean a migration plus rewriting every access check. Rejected.
- **`supabase-js` queries with RLS policies (no custom API for data)**: less code, but the tenancy rule would live in SQL policies spread across tables, tested apart from the app, and one missing policy exposes a table to anyone holding the public key that ships in the web app. Rejected.
- **One Venue per account, with the Venue implied by the session**: no `:venueId` in URLs, but the scoping rule is invisible and easy to forget in a new query, which is exactly how the old bug happened. Rejected.

## Consequences

Anyone reaching for `supabase.from(...)` will find it fails. That's deliberate: add an Express route behind the membership middleware instead. The MVP UI hides all of this: onboarding creates one Venue, and there is no venue switcher and no invites. Adding managers later means a new Member Role, not a new data model.
