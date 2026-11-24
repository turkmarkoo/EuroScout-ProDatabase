# FC Porto club identity correction — 24 November 2026

The BCL feed uses `Futebol Clube do Porto`, while the official current roster and domestic club use `FC Porto`. An exact alias scoped to the official men's BCL team (284946, FCP) now links these references. The correction persists independently of future statistics-pack refreshes. It does not match Porto B or other clubs by city alone.

Official identity sources: https://www.fpb.pt/equipas/clube_120/ and https://www.championsleague.basketball/en/teams/fc-porto . Official BCL participation: https://about.fiba.basketball/en/news/basketball-champions-league-season-11-lineup-announced .

The browser check used the existing private snapshot generated 22 November at 15:25:54 UTC, including the 17 November Asisa Joventut 74–70 FC Porto fixture (`dragons-game-1906`, official source https://www.championsleague.basketball/en/games/136314-AJB-FCP). It confirmed the Scouting Log labels FC Porto, its Scout this game action selects the canonical club, and Scouting Matchup displays all fourteen current roster entries. Names checked include James Woodard and Miguel Queiroz. Reopening via the old provider key also resolves correctly.

`por|FCP`, `bcl26|FCP` and `dragons-bcl-123|dragons-team-248` now share the existing FC Porto club. Player IDs and source statistics remain intact. No private notes, ratings, assignments or saved sessions are rewritten. Raw fixture labels remain available as source history; displayed fixtures use the canonical club name.

Passed: `tests/porto-club-roster.cjs`, `tests/girona-club-stats.cjs`, `tests/quickstats-duplicates.cjs`, `tests/fiba-club-competitions-2026.cjs`, and the actual fixture-to-matchup browser check. The unrelated Tofas/Burgos test (`tests/fixture-club-labels.cjs`) fails identically on the unchanged parent commit; none of its loaded files changed in this release.
