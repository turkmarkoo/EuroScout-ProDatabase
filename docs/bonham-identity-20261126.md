# Bonham profile and competition link repair — 26 November 2026

The database already contained Robert Lee Bonham III's FIBA profile (398976), portrait and BCL statistics. The accepted collector sample used the nickname Trey Bonham and was correctly linked to that FIBA profile. The Czech season roster (federation person 138828) used Robert Lee Bonham and had its own private notes. The older native `cze-9` row also had an incorrect imported 2001 birth year. These yielded three distinct identities, so a Czech roster entry opened from a BCL session could not find the BCL sample.

Official identity evidence:

- [NBL profile 138828](https://www.nbl.basketball/hrac/138828): 14 April 2002, USA, 180 cm, previous club Chattanooga.
- [FIBA person 398976](https://www.fiba.basketball/en/players/398976-robert-lee-bonham-iii): same full DOB and Pardubice identity; indexed official evidence. The requested BCL player page refused direct access during this check; no access workaround was used.
- [Chattanooga biography](https://gomocs.com/sports/mens-basketball/roster/trey-bonham/13612): Trey Bonham, 14 April 2002, Florida/VMI history, son of Robert Bonham Jr.
- Existing accepted official BCL box scores retain FIBA person 398976; game 136278-UNI-PCE on 18 November contains his eight-point appearance.

The existing reviewed identity module now corrects that exact imported biography and links the six known native/official/collector IDs. Name matching alone cannot create this link. No source IDs or statistics are removed. The links sit outside refreshed roster packs so an automatic stats import cannot discard the reviewed crosswalk. Later manual biography overrides continue through the existing override path.

Validation: regression tests for official IDs, conflicting identities, duplicate competition samples and scoped stats; isolated browser with actual Bonham catalogue/rosters/accepted feeds, desktop and iPad viewport. The browser changes no real account and sends no external traffic. It verifies one identity, all six saved aliases, photo fallback, four BCL log rows (14.75 PPG), the separate fifteen-game Czech sample (17.27 PPG), preserved synthetic notes from two aliases and rating. Raw feed statistics and real private notes were not changed. A physical iPad was not tested.
