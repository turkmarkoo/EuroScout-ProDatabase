# USA roster snapshot — 5 November 2026

The combined Players database and Other Leagues include the 2026/27 men's NCAA Division I, NBA and NBA G League roster snapshot. Open Players and select a League, or browse the dedicated Other Leagues view. The College year column and filter use Freshman, Sophomore, Junior, Senior, Graduate and Fifth year in school order. Fifth year is not assumed to mean graduate study.

| Competition | Teams | Roster memberships | Distinct people within competition |
| --- | ---: | ---: | ---: |
| NBA | 30 | 521 | 521 |
| NBA G League | 31 | 506 | 505 |
| NCAA men's Division I | 362 | 5,529 | 5,529 |

The import creates 2,533 missing source records and links verified existing identities. Original record IDs, historical statistics and game logs remain intact. Imported bio fields can still be overridden by private manual edits. New records without statistics show blanks rather than borrowed or zero-filled current-season numbers. European percentile/statistical scopes remain separate from the combined roster search.

## Sources and limits

Season-specific ESPN public team roster responses (`season=2027`, provider season `2026-27`) supplied the snapshot. The official G League team directory was used to check the 31 current franchises; retired G League Ignite, exhibition G League United and MEGA MIS were excluded. Official NBA/G League roster pages returned HTTP 403 to the collection client; no access restriction was bypassed.

Mercer's ESPN roster returned 404. Its [official 2026/27 school roster](https://mercerbears.com/sports/mens-basketball/roster/2026-27) supplied 16 players instead. Seven missing academic years were checked against official school rosters; the evidence and coverage counts are in `us-rosters-2026-11-05.json`. The remaining unpublished years are Mantas Rubštavičius (Auburn) and Jalen Johnson (UIC).

One person, Jamal Bieniemy, has two current G League memberships and two ESPN IDs in the provider snapshot. Corroborating NBA identity and birth data connect them to the existing person. Membership is not evidence of a standard or two-way contract, or a guaranteed final opening roster. Birthplace is not used to invent nationality. Fifty uncertain legacy identity candidates were not forcibly linked by this import and remain subject to identity review.

This is a dated roster import, not a new statistics refresh service. Previously available statistics retain their original season (currently 2025/26 in the USA source packs). Current roster clubs and academic years are shown independently.

## Validation

- `node tests/us-current-rosters.cjs`: schema, counts, idempotence, 6,677 original source rows preserved, draft-year/birth-year correction, private bio edits and manual assignments.
- `node tests/us-current-rosters.browser.cjs`: combined NBA/G League search, all 1,395 freshmen reachable, academic-year filters, current roster clubs, saved notes/ratings, desktop and phone layout. Uses isolated access fixtures and makes no real cloud requests.
- `node tests/ncaa-profile-loading.cjs`: optional roster packs survive catalogue replacement and internal profile navigation.
- `node tests/distinct-person-notes-recovery.cjs` and `node tests/marcus-foster-identities.browser.cjs`: distinct-person separation and preserved notes/ratings.
