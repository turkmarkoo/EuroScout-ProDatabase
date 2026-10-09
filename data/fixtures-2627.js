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
window.EUROSCOUT_FIXTURES_2627={generated:'2026-10-09',season:'2026/27',comps:{
/* MZT–Iraklis verified against the official FIBA game 135784-MZT-IRA and the Iraklis match report. */
fec:{name:'FIBA Europe Cup',teams:{LANL:'LANDAU Lions',LION:'Lions de Geneve',MZT:'MZT Skopje Aerodrom',IRA:'Iraklis BC'},games:`
fec-rs1-mzt-ira|1|2026-10-06|MZT|59|IRA|64|19:00|Sports Centre Jane Sandanski
fec-rs1-lanl-lion|1|2026-10-07|LANL|83|LION|105
`}
}};
