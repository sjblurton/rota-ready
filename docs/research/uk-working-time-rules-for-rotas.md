# UK working-time rules a Rota can be checked against

Research for [#178](https://github.com/sjblurton/rota-ready/issues/178), part of the map [#176](https://github.com/sjblurton/rota-ready/issues/176) (AI drafts the Week's Rota). Sources checked on 28 November 2026.

This is a product research note, not legal advice. It summarises the rules so we can decide what Rota Ready checks; a Venue stays responsible for complying with them.

## The question

Which UK working-time rules apply to a hospitality Venue's Rota, and which can Rota Ready check from Shift data alone (start and end instants, one Staff Member, one Role, per Week)? For each: what a checker could enforce or warn about, what it can't know, and what extra data it would need.

## Short answer

- **Hard checks on AI-drafted Shifts, from Shift data alone:** daily rest (11 hours) and weekly rest (24 hours in the Week). Both are worked out from a Staff Member's other Shifts, including the neighbouring Weeks.
- **Hard checks that need a date of birth:** every young-worker rule (8 hours a day, 40 hours a Week, 12 hours' daily rest, 48 hours' weekly rest, no work between midnight and 4am). Without a date of birth, Rota Ready can't apply them at all.
- **Warnings, not checks:** the average 48-hour week (needs 17 weeks of history, leave, other jobs and the opt-out), young workers between 10pm and 6am, and adult daily or weekly rest on Shifts the Owner enters by hand (lawful exceptions exist that Rota Ready can't see).
- **Leave out:** rest breaks within a Shift (Rota Ready doesn't model breaks or whether they were taken), night-worker averages, and record-keeping (planned Shifts aren't a record of hours worked).

The rule of thumb behind this: the AI should never propose a Shift that would need a legal exception to be lawful, so the AI gets strict checks. The Owner may know an exception applies (a collective agreement, a shift changeover, compensatory rest), so the Owner's own Shifts get warnings.

## Summary table

"Hard check" means Rota Ready's code skips an AI-proposed Shift that breaks the rule, with a reason. "Warning" means the Shift is saved and the grid flags it.

| Rule | What it says | Checkable from Shift data? | Data it would need | Suggested treatment |
| --- | --- | --- | --- | --- |
| Daily rest, adults ([WTR reg 10(1)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/10)) | 11 consecutive hours' rest in each 24-hour period worked | Yes, from the Staff Member's Shifts at this Venue, including the previous and next Week | None (other employers' hours aren't counted, as the rule is per employer) | Hard check for AI Shifts; warning for the Owner's Shifts |
| Weekly rest, adults ([WTR reg 11(1)-(2)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)) | 24 hours uninterrupted in each 7 days, or (employer's choice) two 24-hour or one 48-hour rest in each 14 days | Yes for the 7-day rule; partly for the 14-day option | Whether the Venue uses the 14-day option (a Venue setting) | Hard check (24 hours in the Week) for AI Shifts; warning for the Owner's Shifts |
| Average 48-hour week ([WTR reg 4](https://www.legislation.gov.uk/uksi/1998/1833/regulation/4)) and opt-out ([reg 5](https://www.legislation.gov.uk/uksi/1998/1833/regulation/5)) | Average of 48 hours a week over 17 weeks, unless the worker has opted out in writing | Partly: Rota Ready has its own past Shifts, but not hours actually worked, leave and sickness days in full, other jobs, or the opt-out | Opt-out flag, 17 weeks of Shift history, holidays and sickness | Warning only, and only when no opt-out is recorded. The Staff Member's weekly maximum (already in scope on #176) is the practical hard limit |
| Rest breaks, adults ([WTR reg 12(1)-(3)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/12)) | 20 minutes uninterrupted when daily working time is over 6 hours | Partly: Rota Ready can see that a break is due, not whether one is planned or taken | Break times within a Shift | Out (could become an informational note later) |
| Young workers: 8 hours a day, 40 a week ([WTR reg 5A](https://www.legislation.gov.uk/uksi/1998/1833/regulation/5A)) | No more than 8 hours a day or 40 a week, no averaging, week starts Monday 00:00 | Yes, once age is known | Date of birth | Hard check |
| Young workers: daily rest ([WTR reg 10(2)-(3)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/10)) | 12 consecutive hours in each 24-hour period worked | Yes, once age is known | Date of birth | Hard check |
| Young workers: weekly rest ([WTR reg 11(3), (8)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)) | 48 hours in each 7 days, reducible to 36 for technical or organisation reasons | Yes, once age is known | Date of birth | Hard check at 48 hours for AI Shifts; warning below 48 and hard stop below 36 for the Owner's |
| Young workers: night work ([WTR reg 6A](https://www.legislation.gov.uk/uksi/1998/1833/regulation/6A), [reg 27A(3)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/27A)) | No work 10pm to 6am (11pm to 7am if the contract allows work after 10pm). Hospitality may use an exception, but never between midnight and 4am | Yes, once age is known | Date of birth; which restricted period the contract uses | Hard check for midnight to 4am; hard check for AI Shifts in 10pm to 6am, warning for the Owner's |
| Young workers: rest break ([WTR reg 12(4)-(5)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/12)) | 30 minutes when daily working time is over 4.5 hours | Partly, as for adults | Date of birth, break times | Out (informational at most) |
| Night workers, adults ([WTR reg 6](https://www.legislation.gov.uk/uksi/1998/1833/regulation/6)) | Normal hours average no more than 8 in 24, over 17 weeks | Partly | Who is a night worker, 17 weeks of history | Out |
| Records ([WTR reg 9](https://www.legislation.gov.uk/uksi/1998/1833/regulation/9)) | Keep records adequate to show compliance, for 2 years | No: planned Shifts aren't hours worked | Actual hours | Out (Rota Ready isn't a working-time record) |

## The rules in detail

### Who the rules cover

The Working Time Regulations 1998 (WTR) apply to "workers", which covers most hospitality staff, including those on zero-hours contracts. "Working time" is time spent working, at the employer's disposal and carrying out duties, plus relevant training ([reg 2](https://www.legislation.gov.uk/uksi/1998/1833/regulation/2)). A Rota Ready Shift is planned working time; breaks inside it are not working time ([gov.uk: calculating your working hours](https://www.gov.uk/maximum-weekly-working-hours/calculating-your-working-hours)).

A "young worker" is at least 15 but under 18 and over compulsory school age ([reg 2](https://www.legislation.gov.uk/uksi/1998/1833/regulation/2)). Children under school-leaving age fall under separate child-employment law and local byelaws, which this note doesn't cover; a checker would need a date of birth to tell them apart too.

### Daily rest

- Adults: "a rest period of not less than eleven consecutive hours in each 24-hour period during which he works for his employer" ([reg 10(1)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/10)). gov.uk's example: finish at 8pm, don't start again before 7am ([gov.uk: rest breaks at work](https://www.gov.uk/rest-breaks-work)).
- Young workers: 12 consecutive hours, which "may be interrupted" for work split up over the day or of short duration ([reg 10(2)-(3)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/10)).

**Lawful exceptions for adults**, which is why a hard check on the Owner's Shifts would be wrong:

- Shift workers changing shift, and work "split up over the day" ([reg 22](https://www.legislation.gov.uk/uksi/1998/1833/regulation/22)).
- Special cases including a "foreseeable surge of activity" in tourism, and continuity of service ([reg 21(c)-(d)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/21)).
- A collective or workforce agreement can modify or exclude it ([reg 23](https://www.legislation.gov.uk/uksi/1998/1833/regulation/23)).
- In each case the worker must get equivalent compensatory rest ([reg 24](https://www.legislation.gov.uk/uksi/1998/1833/regulation/24); [gov.uk: compensatory rest](https://www.gov.uk/rest-breaks-work/compensatory-rest)).

**How to check it.** A simple "gap between consecutive Shifts is at least 11 hours" rule is wrong both ways: it blocks a lawful split day (10:00 to 14:00, then 18:00 to 23:00) and says nothing about the 24-hour window. A closer reading of "11 consecutive hours in each 24-hour period" is: for each of the Staff Member's Shifts, the 24 hours from that Shift's start must contain 11 consecutive hours with no Shift. The split day passes (23:00 to 10:00 is 11 hours). A close then open (17:00 to 01:00, then 10:00 to 18:00) fails (the longest gap in the 24 hours from 17:00 is 9 hours). Use 12 hours for young workers.

**What it can't know.** Hours at another employer (not counted: the rule is per employer); the same person at another Rota Ready Venue (a different Staff Member by design, see `GLOSSARY.md`); whether a Venue relies on an exception. The check must read the neighbouring Weeks, because Sunday night and Monday morning straddle a Week boundary.

### Weekly rest

- Adults: "an uninterrupted rest period of not less than 24 hours in each seven-day period", or, if the employer chooses, two 24-hour periods or one 48-hour period in each 14 days ([reg 11(1)-(2)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)).
- Young workers: 48 hours in each 7 days, which may be interrupted for split or short work and reduced to no less than 36 consecutive hours for technical or organisation reasons ([reg 11(3), (8)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)). gov.uk and nidirect say a young worker's weekly rest can't be averaged over two weeks ([nidirect: working hours and young workers](https://www.nidirect.gov.uk/articles/working-hours-and-young-workers)).
- Unless an agreement says otherwise, the 7-day periods start "at midnight between Sunday and Monday" ([reg 11(6)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)). That matches Rota Ready's Week (Monday 00:00 to Sunday 23:59 in the Venue's timezone), so the check can run per Week.
- Weekly rest shouldn't include the daily rest unless objective, technical or organisational reasons justify it ([reg 11(7)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/11)). Strictly, that makes the adult minimum gap about 35 hours (24 plus 11).
- The same adult exceptions as daily rest apply ([regs 21-24](https://www.legislation.gov.uk/uksi/1998/1833/regulation/21)).

**How to check it.** Within the Week window, find the Staff Member's longest stretch with no Shift, counting from Monday 00:00 to the first Shift and from the last Shift's end to the end of Sunday, and clipping an Overnight Shift from the previous Week. Adults need 24 hours (a warning below 35 is reasonable); young workers need 48. The 14-day option would need a Venue setting and the next or previous Week; leave it out for now and treat the 7-day rule as the stricter default.

### The average 48-hour week and the opt-out

- Working time "shall not exceed an average of 48 hours for each seven days", over a 17-week reference period (or the time since starting, if shorter), unless the employer "has first obtained the worker's agreement in writing" ([reg 4(1)-(5)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/4)). The average excludes days of annual leave, sick leave and family leave, and makes them up from the weeks that follow ([reg 4(6)-(7)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/4)).
- The opt-out is voluntary, written, and the worker can cancel it with at least 7 days' notice (up to 3 months if the agreement says so) ([reg 5](https://www.legislation.gov.uk/uksi/1998/1833/regulation/5); [gov.uk: opting out](https://www.gov.uk/maximum-weekly-working-hours/weekly-maximum-working-hours-and-opting-out)). Under-18s can't opt out.
- With more than one job, combined hours should average no more than 48 ([gov.uk: calculating your working hours](https://www.gov.uk/maximum-weekly-working-hours/calculating-your-working-hours)).

**What a checker can and can't do.** A single Week over 48 hours is lawful, so a per-Week check would be wrong. A rolling 17-week average from Rota Ready's own Shifts is possible but approximate: planned Shifts aren't hours actually worked, Rota Ready doesn't fully know sickness, and it can't see other jobs or the opt-out. Recommendation: no legal check. The Staff Member's weekly maximum, already in scope on #176, is the Owner's own hard limit and covers the practical need. If wanted later, a warning when the 17-week average of planned hours passes 48 and no opt-out flag is set.

### Rest breaks within a Shift

- Adults: when daily working time is more than 6 hours, an uninterrupted break of at least 20 minutes, which they may spend away from their workstation; a collective or workforce agreement can set different terms ([reg 12(1)-(3)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/12)).
- Young workers: when daily working time is more than 4.5 hours, at least 30 minutes, consecutive if possible, with hours for different employers on the same day added together ([reg 12(4)-(5)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/12)).

A Shift is "one continuous stretch of time" (`GLOSSARY.md`) with no break modelled, so Rota Ready knows when a break is due but not when it is planned or whether it is taken. Note that "daily working time" adds up a day's Shifts, so two 3.5-hour Shifts give an adult a 7-hour day. Recommendation: out. A later version could show "break due" on long Shifts as information.

### Young workers (under 18)

All of these need a **date of birth** (age on the Shift's date, since a Staff Member can turn 18 mid-Week). An "under 18" checkbox would go stale.

- **8 hours a day, 40 a week**, no averaging, week starting Monday 00:00, hours for all employers added together ([reg 5A](https://www.legislation.gov.uk/uksi/1998/1833/regulation/5A); [gov.uk](https://www.gov.uk/maximum-weekly-working-hours)). An exception exists for continuity of service or a surge in demand when no adult is available and education isn't harmed ([reg 27A(1)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/27A)); the AI should never draft that exception.
- **12 hours' daily rest** and **48 hours' weekly rest**, as above.
- **Night work.** No work in the "restricted period": 10pm to 6am, or 11pm to 7am if the contract provides for work after 10pm ([reg 6A](https://www.legislation.gov.uk/uksi/1998/1833/regulation/6A), defined in [reg 2](https://www.legislation.gov.uk/uksi/1998/1833/regulation/2)). Catering, hotels, pubs, restaurants and bars may disapply this under the same three conditions, but never "in so far as it prohibits work between midnight and 4 a.m.", and the young worker then needs adult supervision where necessary and equivalent compensatory rest ([reg 27A(3)-(4)](https://www.legislation.gov.uk/uksi/1998/1833/regulation/27A); [gov.uk: night working hours](https://www.gov.uk/night-working-hours/young-workers)).
- **30-minute break** over 4.5 hours, as above.

What it can't know even with a date of birth: hours at other employers (which count for 8/40 and breaks), which restricted period the contract uses (default to 10pm to 6am, the stricter one), and whether the hospitality night-work exception's conditions hold.

### Adult night workers

A night worker (regularly at least 3 hours of work between 11pm and 6am by default) must average no more than 8 hours' normal work per 24 hours over 17 weeks, with a hard 8 hours for hazardous or strenuous work, and must be offered health assessments ([regs 2, 6, 7](https://www.legislation.gov.uk/uksi/1998/1833/regulation/6); [gov.uk: night working hours](https://www.gov.uk/night-working-hours)). Bar and kitchen staff closing late may qualify. This needs long history and a judgement on who counts; leave it out.

## Northern Ireland

Employment law is devolved. Northern Ireland has its own [Working Time Regulations (Northern Ireland) 2016](https://www.legislation.gov.uk/nisr/2016/49/contents), with the same substance under different numbers: 48-hour week reg 4, young workers' hours reg 6, records reg 11, young workers at night reg 8, daily rest reg 12, weekly rest reg 13, rest breaks reg 14. The restricted period for young workers is the same (10pm to 6am, or 11pm to 7am) ([NI reg 2](https://www.legislation.gov.uk/nisr/2016/49/regulation/2)), but "young worker" uses Northern Ireland's compulsory school age. nidirect gives the same limits ([nidirect: working hours and young workers](https://www.nidirect.gov.uk/articles/working-hours-and-young-workers); [nidirect: rest breaks](https://www.nidirect.gov.uk/articles/rest-breaks)).

The differences that matter are in records, not in the rules a Rota checker applies:

- The 2024 GB change saying employers "need not record each worker's daily working hours" if they can show compliance otherwise is not in the NI regulations ([NI reg 11](https://www.legislation.gov.uk/nisr/2016/49/regulation/11)).
- The Employment Rights Act 2025 holiday-records duty extends to England, Wales and Scotland only ([s.35](https://www.legislation.gov.uk/ukpga/2025/36/section/35)).

So the same checks can run for a Venue in Northern Ireland.

## Changes from 2024 to 2026

None of these changes the rest, hours or young-worker rules above.

- **Working-time records (GB, from 1 January 2024).** [WTR reg 9](https://www.legislation.gov.uk/uksi/1998/1833/regulation/9) now says records may be kept in any reasonable format, and daily hours need not be recorded if compliance can be shown another way (S.I. 2023/1426). Rota Ready's planned Shifts aren't a record of hours worked, so this doesn't change what we build, though it shouldn't be described as a compliance record.
- **Holiday records (GB, from 6 April 2026).** The Employment Rights Act 2025 inserts WTR reg 16B: records adequate to show compliance with annual leave and holiday pay, kept for 6 years ([s.35](https://www.legislation.gov.uk/ukpga/2025/36/section/35)). This touches the holidays input planned on #176, not the Rota checks.
- **Reasonable notice of Shifts (coming, GB).** The Employment Rights Act 2025 gives zero-hours and similar workers rights to reasonable notice of Shifts and of cancellations or changes, with payment for short-notice cancellations ([s.2](https://www.legislation.gov.uk/ukpga/2025/36/section/2), [s.3](https://www.legislation.gov.uk/ukpga/2025/36/section/3)). Section 2 is in force only for specified purposes (from 6 January 2026); the government roadmap puts the zero-hours measures in 2027, with the notice period still to be set by regulations ([gov.uk: Employment Rights Act roadmap](https://www.gov.uk/government/publications/implementing-the-plan-to-make-work-pay-and-employment-rights-act/implementing-the-employment-rights-bill-roadmap-web-version)). This is about when a Rota is Published or changed, not about Shift contents, so it isn't a drafting check. Worth a future ticket once the notice period is known.

## Recommendation for #176

1. **Hard checks with no new data:** adult daily rest (11 hours in each 24-hour window) and adult weekly rest (24 hours within the Week), reading the neighbouring Weeks' Shifts. The AI's skipped-Shift reasons can name the rule ("less than 11 hours' rest after Saturday's close").
2. **Warnings for the Owner's own Shifts** on the same two rules, since lawful exceptions exist that Rota Ready can't see. This fits the "settings without AI" open question on the map.
3. **Add an optional date of birth** to the Staff Member if young workers are in scope. It unlocks hard checks for 8/40 hours, 12 and 48 hours' rest and no work between midnight and 4am, plus a hard check for AI Shifts (warning for the Owner's) between 10pm and 6am. If no date of birth is given, say plainly in the UI that young-worker rules aren't checked.
4. **Don't add an opt-out flag yet.** Use the Staff Member's weekly maximum as the hours limit. An opt-out flag only earns its place with a 17-week average warning, which can come later.
5. **Leave out** rest breaks, night-worker averages, and anything that implies Rota Ready is a working-time or holiday record.
