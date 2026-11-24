# Girona club identity correction — 24 November 2026

The accepted private FIBA Europe Cup feed calls the men's club `Club Basquet Girona`; the official roster pack calls it `FIATC Girona`. Explicit legal-name aliases now resolve that feed to the existing official club identity. This also joins the ACB and FEC club references, without combining statistics across competitions or seasons. Aliases live outside the refreshed statistics pack so a future pack refresh retains the correction.

Official identity reference: https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/fiatc-girona (FIBA team 285107, GIR; existing verified roster source). Club reference: https://basquetgirona.com/es/noticia/cinco-jugadores-del-fiatc-girona-convocados-con-sus-selecciones-por-las-ventanas-fiba/ (23 November 2026).

Validation used the available DragonsData snapshot generated 22 November 2026 at 15:25:54 UTC. This correction does not claim newer game coverage. For David N'Guessan (FIBA person 345440), the seven-game feed contains the opening 6 October appearance already represented by the one-game official pack. Existing statistics deduplication now selects the seven-game line and its seven game logs rather than adding the overlapping aggregates. Totals/averages are unchanged: 74 points, 31 rebounds, 13 assists; 10.57 PPG, 4.43 RPG, 1.86 APG, 14.71 PIR. Nine ACB appearances remain a separate choice.

The browser check confirmed `acb|GIR`, `fec26|GIR`, `dragons-fec-127|dragons-team-265` and `dragons-acb-17|dragons-team-105` share one club. The stats selector has two played lines (ACB and FEC), and FEC has seven log rows. No private records, notes, ratings, manual assignments or source database rows are rewritten.

Passed: `tests/girona-club-stats.cjs`, `tests/quickstats-duplicates.cjs`, `tests/fiba-club-competitions-2026.cjs`, focused browser validation with actual snapshot data. The broader `tests/current-season-profile.cjs` has three pre-existing failures caused by obsolete script-version assertions; the unchanged parent commit reproduces the same failures.
