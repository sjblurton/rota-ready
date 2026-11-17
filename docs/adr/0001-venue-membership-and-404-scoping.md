# Venue access goes through a Venue Member table, and anything outside your Venues is a 404

The previous version treated any valid login as permission to read any Venue's data. To make that impossible, access goes through a `VenueMember (user_id, venue_id, role)` table, even though the MVP has only the `owner` role and one Venue per signup. Every venue-owned API route lives under `/api/venues/:venueId/...`, and a single middleware checks that the logged-in user is a member of `:venueId`. If they aren't, it returns **404**, not 403, so the response doesn't reveal that the Venue exists. Data access below the middleware always filters by `venueId`, and each such route has an integration test against real Postgres in which a member of Venue A asks for Venue B's resource and gets a 404.

## Considered Options

- **`venue.owner_id` column (one owner, many Venues)**: simpler now, but managers and co-owners would later mean a migration plus rewriting every access check. Rejected.
- **One Venue per account, with the Venue implied by the session**: no `:venueId` in URLs, but the scoping rule is invisible and easy to forget in a new query, which is exactly how the old bug happened. Rejected.

## Consequences

The MVP UI hides all of this: onboarding creates one Venue, and there is no venue switcher and no invites. Adding managers later means a new Member Role, not a new data model.
