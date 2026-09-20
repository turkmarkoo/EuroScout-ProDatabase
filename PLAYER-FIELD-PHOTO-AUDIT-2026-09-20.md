# Player field and photo refresh audit — 20 September 2026

This pass inspected the local player payloads for missing profile fields and images. No existing player, note, rating or approved transfer was overwritten.

## Findings

- **Primera FEB:** 448 local players. The imported 2025/26 FEB records have profile images and birth dates for all 448; only four lack height. The data is still explicitly **2025/26**, so it must not be relabelled as current 2026/27 statistics. Current 2026/27 roster pages are now available for clubs such as Movistar Estudiantes, and a current league roster directory exists, but the official FEB player feed was not yet available as one complete, stable-ID 2026/27 snapshot at this check.
- **ABA official-roster overlay:** 145 players; 145 have no image URL in the local overlay. Birth years and countries are present. Images need provider-level verification before adding URLs.
- **ACB official-roster overlay:** 106 players; 76 have no image URL. Countries and birth years are present.
- **Lega A official-roster overlay:** 92 players; 92 have no image URL and one lacks country.
- **BCL / qualifier overlay:** 326 players; 193 have no image URL and country is not supplied in this overlay. Many have stable FIBA person codes, so FIBA headshots can be tested and added only when the asset resolves.

## Why I did not bulk-write images or 2026/27 assignments

A missing image in the overlay does not prove that the player has no photo, and a current 2026/27 club page does not automatically replace the player's 2025/26 statistical stint. Bulk-writing these fields from guessed URL patterns could create broken photos, duplicate identities or false transfers. The safe merge rule remains: stable provider ID first; otherwise full name plus birth date/year and current club context, with a review flag.

## Refresh queue

1. Refresh Primera FEB club-by-club from official FEB/club pages and store current roster membership separately from 2025/26 stats.
2. Test the FIBA headshot pattern for BCL players with stable person codes, then fill only confirmed URLs.
3. Pull official ABA, ACB and Lega A roster images where their provider pages expose stable image links.
4. Repeat the same field/photo check for the expansion leagues and Finland/Sweden once their current club rosters are imported.

Sources checked:

- [Movistar Estudiantes official 2026/27 roster](https://www.movistarestudiantes.com/plantilla-masculina/)
- [Primera FEB 2026/27 roster directory](https://primera-feb.netlify.app/)
- [ACB 2026/27 market and roster pages](https://acb.com/es/liga/tabla-mercado/2026-27)
- [ABA official player directory](https://www.aba-liga.com/players/)
- [easyCredit BBL 2026/27 transfer market](https://www.easycredit-bbl.de/wechselboerse?mdrv=www.easycredit-bbl.de)

## Refresh completed in this batch

- Added the official Movistar Estudiantes 2026/27 Primera FEB roster layer: 13 players, current birth dates/heights/positions/jerseys, club profile links and provider photo URLs where available. This layer is roster-only and does not replace 2025/26 statistics.
