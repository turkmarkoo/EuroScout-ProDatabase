# Player statistics identity and scope repair — 25 November 2026

The accepted private feed contained Boum’s three BCL appearances but did not export his FIBA person ID. “Souley Boum Jr” therefore remained separate from “Souleymane Boum Jr”. FIBA person 377361 now links that sample through the existing verified roster IDs. ACB source person IDs likewise survive export. Known conflicting birth years or FIBA IDs reject automatic links. Tavares’s verified ACB and EuroLeague aliases remain linked so older scouting records stay accessible.

Quick Stats and the Matchup strip now require the selected club, season and competition. Missing BCL statistics display as unavailable instead of silently substituting domestic figures. A transfer’s previous and current club have separate samples and game logs. Latest-stint feed IDs remain unchanged; additional former-club IDs share the same verified person. The private search projection preserves the current row ID and exposes former club samples separately.

The shared-feed audit covered 14,441 player/competition records. Their exported averages matched their game logs, but 17 records mixed club stints. The rebuilt feed has 14,459 rows, preserving all 67,123 accepted appearances and all prior row IDs. This checks internal arithmetic and identity/scoping; it does not certify completeness of every upstream source.

The source-ID browser comparison added 42 previously missing competition links across BCL, qualifiers, FEC and ACB. Later club-stint samples are additional rows. Source data, scouting notes, ratings, private records, user assignments and saved sessions are not rewritten by the consumer fix. The collector rebuild changes statistics samples only, with local backups retained outside this repository.

Validated: collector export tests; official-ID and conflicting-identity regressions; Quick Stats competition, club and season scope; empty requested-competition view; actual Boum BCL/ACB samples and game logs; actual Caupain current-club sample; desktop and iPad viewport; all 82 BCL/FEC club identities and roster coverage; Girona/Porto and overlapping-import regressions; private query projection tests.

References: [Boum BCL profile](https://www.championsleague.basketball/en/teams/ucam-murcia/377361-souley-boum-jr), [ACB Tavares profile](https://acb.com/es/liga/jugadores/walter-tavares-20209407), [EuroLeague Tavares identity](https://admin.euroleague.net/competition/players/showplayer?pcode=005791&seasoncode=E2021).
