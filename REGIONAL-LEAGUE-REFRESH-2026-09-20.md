# Regional league refresh — BNXT, Lithuania LKL, VTB United League, Poland PLK

Date: 2026-09-20
Scope: current 2026/27 team membership and player-roster coverage in EuroScout.

## Verified current competition membership

| League | Season | Teams | Current source | Result |
|---|---:|---:|---|---|
| BNXT League | 2026/27 | 16 | https://en.wikipedia.org/wiki/2026%E2%80%9327_BNXT_League | Membership already present; source remains secondary and needs official league/club confirmation before a full player import. |
| Lietuvos LKL | 2026/27 | 10 | https://lkl.lt/komandos | Membership already present. LKL team pages expose player profiles, birthdates, nationality, position and height; a complete stable-ID export is still needed before importing all ten rosters. |
| VTB United League | 2026/27 | 12 | https://vtb-league.com/en/news/astana-and-dynamo-vladivostok-to-join-the-vtb-league-from-the-2026-27-season/ | Membership already present. The official statistics widget exposes 2026/27 player/team views, but no complete stable-ID roster payload was available for a safe import in this pass. |
| Orlen Basket Liga (Poland PLK) | 2026/27 | 16 | https://plk.pl/druzyny | Membership already present. The official player directory is live at https://plk.pl/zawodnicy and lists the 2026/27 season, but its rendered data is not yet available as a stable local ID export. |

## What was changed

- No existing player statistics, manual assignments, ratings, notes or photos were overwritten.
- No duplicate player records were created from name-only matches.
- Existing current-roster overlays for the PLK Dziki Warszawa and BNXT Landstede Hammers BCL qualifier records remain active.
- The four leagues remain in the current-membership registry and are queued for player-level imports once a complete stable-ID feed is available.

## Follow-up queue

1. Build a small importer for the official PLK and LKL player-directory responses, preserving database IDs and existing manual fields.
2. Locate an official BNXT roster endpoint or club-level roster feeds before replacing the secondary membership source.
3. Resolve the VTB 2026/27 player directory/API behind the official statistics widget, then reconcile identities against the existing database.
4. Run duplicate checks by stable ID first, then full name + birth year + club context.

This pass is a coverage verification, not a claim that all four player rosters have been imported.
