/* 2026/27 fixtures for leagues that cannot be read live by the browser.
   EuroLeague and EuroCup are NOT kept here — the app reads them from the official API.

   One block per competition, keyed by the league id used in the database
   (aba, acb, lba, bbl, lnb, bnxt, sbl, il, gbl, plk, bcl …). `games` uses the same
   pipe format the scrapers write to *_games.txt, with two optional columns:

     id|round|date|HOME|homeScore|AWAY|awayScore|time|venue

   Leave both scores empty for a game that has not been played. HOME / AWAY are the
   team codes of that league in the database. `teams` is only needed for codes the
   database does not know yet (code → full club name).

   Example:
   aba:{name:'ABA League',games:`
   1|1|2026-10-02|COL||PAR||19:00|Arena Stožice
   2|1|2026-10-03|IGO|88|BOS|79
   `} */
window.EUROSCOUT_FIXTURES_2627={generated:'2026-09-18',season:'2026/27',comps:{}};
