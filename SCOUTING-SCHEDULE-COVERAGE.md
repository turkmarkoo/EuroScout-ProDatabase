# Private scouting-log schedule expansion — 8 November 2026

The Pro Database now combines its existing accepted-statistics fixture feed with the existing admin-only Scout Board calendar. The supplement is read in memory by the signed-in owner only. No player statistics, source payloads, notes or sessions are published in the static application.

## Added coverage

22 additional calendars: Bulgaria, Finland, Switzerland, France, France Élite 2, Denmark, Slovakia, Serbia KLS, Bosnia and Herzegovina, Romania, Australia, Croatia, Italy Serie A2, Austria, Cyprus, China, Canada CEBL, Portugal, Montenegro, Great Britain, Kosovo and Iceland. This increases connected competitions from 27 to 49, including the existing US schedules.

Official newly verified sources:
- Bulgaria: https://nbl.basketball.bg/games — 182 fixtures, 34 final scores, 14 teams. The public results-tab request supplements the future calendar; restricted match-detail pages are not fetched.
- Finland: https://basket.fi/sarjat/sarjat/korisliiga/tilastot/ — 204 fixtures, 57 final scores, 10 dates pending. Uses the federation public PENA games endpoint and stable team IDs from the existing roster pack.
- Switzerland: https://swiss.basketball/national-competitions/sbl/men/schedule — 84 fixtures, 39 final scores; official season 31 / league holding 11321.

## Limits

This is schedule/result coverage, not a new player box-score import. Several feeds are partial. Undated Serbian, Romanian, Montenegrin and Bosnian pairings remain undated, appear only in the full-season upcoming list, and cannot start a dated scouting session. Failed refreshes preserve the last good calendar. Turkey currently refuses access; Latvia/Estonia and ProA remain restricted. Other catalogue competitions with no verified current schedule are explicitly marked as not connected.

Current accepted-statistics competitions take precedence over the supplementary calendar. Club matching reuses explicit source IDs, existing keys, or a unique exact full name plus country. It does not merge player identities. Private calendar payloads are never cached in browser storage or added to saved core data.

## Validation

65 collector tests pass, including Bulgaria, Finland and Switzerland parsing, season checks and rejection of incomplete final scores. Pro Database checks cover owner access, private-payload validation, team-key reuse, last-good retention, regular-feed priority, fixtures, BBL Cup and competition coverage. An isolated browser test checks real private feeds without writing user notes or sessions.
