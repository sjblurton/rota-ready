# Shifts store UTC instants; the day and Week come from the start time in the Venue's timezone

Shifts store `starts_at` and `ends_at` as UTC `timestamptz`. A Shift's day and Week (Monday to Sunday) are worked out from `starts_at` in the Venue's IANA timezone, so an Overnight Shift such as Sunday 20:00 to Monday 02:00 belongs to the Week it starts in and shows as "20:00–02:00 (+1)" on its start day. Validation: `ends_at > starts_at` and the length is at most 16h. Tests cover the last Sunday in March and the last Sunday in October, when UK clocks change, including Shifts that span the change.

## Considered Options

- **Local date + local times without a timezone**: simpler grid code, but lengths across the clock change come out wrong and there's no unambiguous instant for "upcoming". Rejected.
- **Open (unassigned) Shifts**: deferred. Every Shift has exactly one Staff Member in the MVP. Open Shifts can come later by making `staff_member_id` nullable, without changing this time model.
