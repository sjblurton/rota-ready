# Rota Ready

Weekly staff scheduling for UK bars and restaurants: an owner builds a week of shifts, publishes it, and each staff member confirms or declines their shifts from a private link.

## People and places

**Venue**:
A single bar or restaurant, with its own timezone, staff and rotas. The boundary nothing crosses: every other thing belongs to exactly one Venue.
_Avoid_: Business, site, location, tenant (in UI copy)

**User**:
A person with a login, keyed by their Supabase user ID. A User becomes a Venue Member when linked to a Venue; until then they can't see any Venue's data.
_Avoid_: Account, login (as a noun)

**Venue Member**:
A person who logs in and manages a Venue. Each has a Member Role; the MVP has only the `owner` Member Role.
_Avoid_: User (when you mean someone linked to a Venue), admin, account

**Owner**:
A Venue Member whose Member Role is `owner`.
_Avoid_: Manager (a different Member Role), boss

**Manager**:
A Venue Member whose Member Role is `manager`, on Pro. A Manager runs the Venue's Rotas and Staff Members, but not its Plan, billing, text costs or Venue Members, which stay with the Owner.
_Avoid_: Admin, supervisor

**Staff Member**:
A person who works shifts at a Venue. Staff Members never log in; they reach their shifts through their Staff Link. The same human working at two Venues is two Staff Members. On Pro, a Staff Member can turn texts off from their Staff Link, but not emails.
_Avoid_: Employee, worker, user, team member

**Archive**:
What the Owner does when a Staff Member stops working at the Venue. The Owner can archive someone only once none of their Shifts is still to come, so no Shift is left with a person who has gone. An archived Staff Member drops off the staff list and future Rotas, and their email address is removed, so the same person can be added again later.
_Avoid_: Delete, remove, deactivate

**Role**:
The job a Staff Member does, e.g. Bar, Floor, Kitchen. Not to be confused with Member Role.
_Avoid_: Position, job title, Member Role

**Member Role**:
What a Venue Member is allowed to do at a Venue. Not to be confused with Role.
_Avoid_: Role (on its own), permission, access level

## Scheduling

**Week**:
Monday 00:00 to Sunday 23:59 in the Venue's timezone.
_Avoid_: Period, cycle

**Rota**:
All of a Venue's Shifts for one Week. It is either Draft or Published.
_Avoid_: Schedule, roster, timetable

**Shift**:
One Staff Member working one continuous stretch of time at a Venue. A Shift belongs to the day and Week in which it starts, in the Venue's timezone.
_Avoid_: Slot, booking, session

**Overnight Shift**:
A Shift that ends on a later calendar day than it starts, e.g. 20:00–02:00 (+1).
_Avoid_: Late shift, split shift

**Draft**:
A Rota that staff cannot see yet.
_Avoid_: Unpublished, pending (Pending is a Shift Response)

**Published**:
A Rota whose Shifts staff can see and respond to. A Published Rota can still be edited.
_Avoid_: Live, sent, final

**Publish**:
Making a Draft Rota Published and emailing each Staff Member with Shifts that Week their Staff Link.
_Avoid_: Send, release

**Copy Last Week**:
Filling an empty Draft Rota with the previous Week's Shifts, moved forward by seven days.

## Staff responses

**Staff Link**:
A Staff Member's private, stable URL showing their own upcoming Shifts in Published Rotas. One live Staff Link per Staff Member; regenerating it revokes the old one.
_Avoid_: Magic link, invite, login link

**Shift Response**:
A Staff Member's answer to a Shift: Pending, Confirmed or Declined.
_Avoid_: Status (too broad), RSVP, acceptance

**Decline Reason**:
An optional note a Staff Member gives when Declining a Shift.

**No Reply**:
How a Shift shows once it has started while its Shift Response is still Pending. It is not a fourth Shift Response: the stored answer stays Pending, but the Staff Member can no longer answer.
_Avoid_: Missed, expired, no-show (it says nothing about whether they turned up)

**Changed Shift**:
A Shift in a Published Rota whose date, time or Staff Member has been changed since the affected staff were last notified. A change of this kind resets the Shift Response to Pending; changing notes or Role does not.
_Avoid_: Edited shift, dirty shift

**Removed Shift**:
What a Staff Member sees when a Shift they were notified about is deleted or reassigned to someone else.
_Avoid_: Cancelled shift

**Send Updates**:
Emailing only the Staff Members affected by Changed Shifts and Removed Shifts since they were last notified.
_Avoid_: Republish, notify all

## Plans

**Plan**:
What a Venue can use in Rota Ready: one of a fixed set, Free and Pro today. More Plans may join the set later.
_Avoid_: Tier, package, Subscription (that's how a Plan is paid for)

**Free**:
The Plan that costs nothing: one Venue and up to 15 Staff Members who aren't archived. A Venue with more keeps them all but can't add another. Rota Ready sends Staff Members nothing; the Owner shares each Staff Link.
_Avoid_: Basic, trial

**Pro**:
The paid Plan: Rota Ready emails Staff Members their Staff Link and changes, sends Reminders, and allows unlimited Staff Members. Texts are optional, billed per part up to the Text Cap.
_Avoid_: Premium, paid tier

**Subscription**:
The paid arrangement through which an Owner keeps one Venue on Pro. An Owner of several Pro Venues has one Subscription for each.
_Avoid_: Plan (that's what the Venue can use), membership, licence

**Reminder**:
An email, and a text if texts are on, sent to a Staff Member the day before one of their Shifts in a Published Rota.
_Avoid_: Alert, nudge

**Text Cap**:
The most an Owner lets a Venue spend on texts in a month. Texts are billed per part (a long text uses more than one) and pause when the cap is reached; emails carry on.
_Avoid_: Allowance, credits, quota, Extra Texts
