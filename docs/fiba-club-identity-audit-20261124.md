# BCL and FIBA Europe Cup club identity audit — 24 November 2026

Audited all 82 club entries in the available 2026/27 source data: 32 Basketball Champions League and 50 FIBA Europe Cup entries, including qualifying participants. The private statistics snapshot was generated **22 November 2026, 15:25:54 UTC**. This is an identity/linkage correction, not a claim of new game coverage after that snapshot. Existing official roster snapshots and biographies retain their source dates.

Each source club was checked against competition-scoped codes in its official FIBA/BCL game URLs and its existing official team/roster identity. Every source club had one consistent official destination, and each had at least eight exact player-name overlaps with its official roster as corroboration. No club was matched by city alone. AEK Athens and Petrolina AEK Larnaca remain distinct despite sharing the code AEK in different competitions. Nymburk's current identity was independently checked against the [official NBL merger announcement](https://nbl.basketball/fuze-nymburka-a-slavie-potvrzena-cil-nej-klub-stredni-evropy-usilujici-i-o-nba-europe/22714).

The fix resolves provider team IDs to official club IDs, joins those entries in the club registry, and applies the same identity to rosters, saved source team keys, fixture labels and statistics. Official BCL fixture URLs now take precedence over stale stored club keys, as FIBA Europe Cup URLs already did. Changed verified aliases invalidate the club cache when the feed refreshes. Untrusted hosts and conflicting official codes cannot establish a verified merge.

Browser validation found 82 distinct canonical clubs, 342 displayed fixtures with correct official club destinations, and 1,059 imported player-stat lines with the correct club scope. All clubs had roster coverage. Existing statistics deduplication selects the more complete same-season sample without adding overlapping imports; domestic leagues, qualifiers, different clubs and different seasons retain separate statistical lines. No forced player identity merges, source totals, private notes, ratings, assignments, or saved sessions were rewritten.

The browser also opened the actual Matchup rosters for Slavia Praha, Rytas, Bilbao, Korfez, Levice and Benfica. All had at least ten displayed roster entries. Previous Girona and Porto regression tests pass.

Passed: fiba-source-identities, fiba-club-competitions-2026, dragons-fixtures, quickstats-duplicates, french-rosters, girona-club-stats and porto-club-roster tests, plus the full two-competition browser audit. The pre-existing matchup-identity-audit test fails identically on the unchanged parent commit because its VM lacks manual26Key; no production file loaded by that failure was changed in this release.

## Club checklist

Roster counts include retained user assignments and existing registration evidence; absence from this checklist is not a player departure.

| Competition | Official club | Imported name | Roster entries | Imported stat lines |
| --- | --- | --- | ---: | ---: |
| BCL | [AEK BC](https://www.championsleague.basketball/en/teams/aek-bc) | AEK | 16 | 14 |
| BCL | [ALBA BERLIN](https://www.championsleague.basketball/en/teams/alba-berlin) | ALBA Berlin Basketballteam e.V. | 17 | 15 |
| BCL | [Asisa Joventut](https://www.championsleague.basketball/en/teams/asisa-joventut) | Club Joventut Badalona SAD | 16 | 15 |
| BCL | [BC Juventus Utena](https://www.championsleague.basketball/en/teams/bc-juventus-utena) | BC Juventus Utena | 13 | 13 |
| BCL | [BK KVIS Pardubice](https://www.championsleague.basketball/en/teams/bk-kvis-pardubice) | BK KVIS Pardubice | 17 | 14 |
| BCL | [BMA365 Bamberg Baskets](https://www.championsleague.basketball/en/teams/bma365-bamberg-baskets) | BMA365 Bamberg Baskets | 16 | 13 |
| BCL | [Bnei Penlink Herzliya](https://www.championsleague.basketball/en/teams/bnei-penlink-herzliya) | Bnei Penlink Herzliya | 17 | 9 |
| BCL | [Cholet Basket](https://www.championsleague.basketball/en/teams/cholet-basket) | Cholet Basket | 15 | 14 |
| BCL | [Cibona](https://www.championsleague.basketball/en/teams/cibona) | Košarkaški klub Cibona | 18 | 13 |
| BCL | [Falco-Vulcano Szombathely](https://www.championsleague.basketball/en/teams/falco-vulcano-szombathely) | Falco KC Szombathely | 13 | 10 |
| BCL | [FC Porto](https://www.championsleague.basketball/en/teams/fc-porto) | Futebol Clube do Porto | 14 | 11 |
| BCL | [Galatasaray MCT Technic](https://www.championsleague.basketball/en/teams/galatasaray-mct-technic) | Galatasaray Spor Kulübü Dernegi | 16 | 12 |
| BCL | [Hapoel Maoz Daniel Holon](https://www.championsleague.basketball/en/teams/hapoel-maoz-daniel-holon) | Hapoel Maoz Daniel Holon | 18 | 14 |
| BCL | [Igokea m:tel](https://www.championsleague.basketball/en/teams/igokea-mtel) | Igokea m:tel | 19 | 14 |
| BCL | [Itelyum Varese](https://www.championsleague.basketball/en/teams/itelyum-varese) | Pallacanestro Varese | 16 | 14 |
| BCL | [Legia Warszawa](https://www.championsleague.basketball/en/teams/legia-warszawa) | Legia Warszawa | 16 | 12 |
| BCL | [Nanterre 92](https://www.championsleague.basketball/en/teams/nanterre-92) | Nanterre 92 | 13 | 10 |
| BCL | [Pallacanestro Reggiana](https://www.championsleague.basketball/en/teams/pallacanestro-reggiana) | Pallacanestro Reggiana | 14 | 14 |
| BCL | [Peristeri Betsson](https://www.championsleague.basketball/en/teams/peristeri-betsson) | G.S. Peristeriou 1971 S.A. | 16 | 12 |
| BCL | [RASTA Vechta](https://www.championsleague.basketball/en/teams/rasta-vechta) | RASTA Vechta Sport-Marketing GmbH | 19 | 17 |
| BCL | [Rytas Vilnius](https://www.championsleague.basketball/en/teams/rytas-vilnius) | BC Rytas | 12 | 12 |
| BCL | [Sabah BC](https://www.championsleague.basketball/en/teams/sabah-bc) | Sabah BC | 15 | 12 |
| BCL | [Salon Vilpas](https://www.championsleague.basketball/en/teams/salon-vilpas) | Salon Vilpas | 12 | 12 |
| BCL | [SIG Strasbourg](https://www.championsleague.basketball/en/teams/sig-strasbourg) | SIG Strasbourg | 13 | 13 |
| BCL | [SK Slavia Praha ERA NBK](https://www.championsleague.basketball/en/teams/sk-slavia-praha-era-nbk) | ERA Basketball Nymburk | 14 | 12 |
| BCL | [Spartak Office Shoes](https://www.championsleague.basketball/en/teams/spartak-office-shoes) | KK Spartak Subotica | 17 | 12 |
| BCL | [Surne Bilbao](https://www.championsleague.basketball/en/teams/surne-bilbao) | C.D. Basket Bilbao Berri S.A.D. | 17 | 13 |
| BCL | [Telekom Baskets Bonn](https://www.championsleague.basketball/en/teams/telekom-baskets-bonn) | Telekom Baskets Bonn | 24 | 11 |
| BCL | [Trabzonspor](https://www.championsleague.basketball/en/teams/trabzonspor) | Trabzonspor Basketball Club | 16 | 14 |
| BCL | [UCAM Murcia](https://www.championsleague.basketball/en/teams/ucam-murcia) | UCAM Murcia | 17 | 15 |
| BCL | [Unicaja](https://www.championsleague.basketball/en/teams/unicaja) | Unicaja | 17 | 14 |
| BCL | [Windrose Giants Antwerp](https://www.championsleague.basketball/en/teams/windrose-giants-antwerp) | Windrose Giants Antwerp | 16 | 11 |
| FEC | [Bakken Bears](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bakken-bears) | Bakken Bears Aarhus | 18 | 13 |
| FEC | [BC Bashkimi](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-bashkimi) | Basketball Club Bashkimi | 14 | 13 |
| FEC | [BC Batumi 2010](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-batumi-2010) | BC Batumi 2010 | 14 | 12 |
| FEC | [BC Parnu](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-parnu) | BC Pärnu | 16 | 12 |
| FEC | [BC Prievidza](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-prievidza) | BC Prievidza | 15 | 14 |
| FEC | [BC Split](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-split) | Basketball Club Split | 15 | 11 |
| FEC | [BC Vienna](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bc-vienna) | BC Vienna | 17 | 13 |
| FEC | [Bigbank/Kalev](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bigbankkalev) | Bigbank/Kalev | 15 | 12 |
| FEC | [Biotekno Korfez Basket](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/biotekno-korfez-basket) | Biotekno Korfez Basket | 12 | 12 |
| FEC | [BK Opava](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/bk-opava) | BK Opava | 14 | 12 |
| FEC | [Coretec Oostende](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/coretec-oostende) | Coretec Oostende | 16 | 12 |
| FEC | [CSM CSU Raiffeisen Oradea](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/csm-csu-raiffeisen-oradea) | CSM CSU Raiffeisen Oradea | 13 | 12 |
| FEC | [Dinamo Bucharest](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/dinamo-bucharest) | Dinamo Bucharest Sports Club | 13 | 12 |
| FEC | [Dziki Warszawa](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/dziki-warszawa) | Dziki Warszawa | 14 | 13 |
| FEC | [Elan Chalon](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/elan-chalon) | Elan Chalon | 16 | 13 |
| FEC | [Esenler Erokspor](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/esenler-erokspor) | Esenler Erokspor | 15 | 14 |
| FEC | [FIATC Girona](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/fiatc-girona) | Club Basquet Girona | 18 | 16 |
| FEC | [Fitness First Wurzburg Baskets](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/fitness-first-wurzburg-baskets) | Sport und Event Würzburg Baskets GmbH | 16 | 13 |
| FEC | [Fribourg Olympic Basket](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/fribourg-olympic-basket) | Fribourg Olympic Basket | 14 | 14 |
| FEC | [Gence BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/gence-bc) | Gence BC | 14 | 13 |
| FEC | [Iraklis BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/iraklis-bc) | Gymnastikos Syllogos Agias Iraklis KAE | 16 | 14 |
| FEC | [KB Peja](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/kb-peja) | KB Peja | 15 | 12 |
| FEC | [Keravnos BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/keravnos-bc) | Keravnos BC | 18 | 14 |
| FEC | [King Szczecin](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/king-szczecin) | King Szczecin | 13 | 12 |
| FEC | [KK Samobor](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/kk-samobor) | Kosarkaski Klub Samobor | 12 | 11 |
| FEC | [Kolossos H Hotels BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/kolossos-h-hotels-bc) | Kolossos H Hotels BC | 13 | 13 |
| FEC | [LANDAU Lions](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/landau-lions) | LANDAU Lions | 13 | 10 |
| FEC | [Lions de Geneve](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/lions-de-geneve) | Lions de Geneve | 16 | 14 |
| FEC | [Lokomotiv Plovdiv](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/lokomotiv-plovdiv) | "Basketball Club Lokomotiv Plovdiv" Association | 14 | 11 |
| FEC | [Manchester Basketball](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/manchester-basketball) | Manchester Basketball Club | 21 | 13 |
| FEC | [Mykonos Betsson BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/mykonos-betsson-bc) | Athilitikos Omilos Mykonoy KAE | 15 | 16 |
| FEC | [MZT Skopje Aerodrom](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/mzt-skopje-aerodrom) | KK MZT Skopje Aerodrom | 14 | 14 |
| FEC | [Neftchi SC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/neftchi-sc) | Neftchi Sports Club Public Union | 13 | 14 |
| FEC | [NHSZ-Szolnoki Olajbanyasz](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/nhsz-szolnoki-olajbanyasz) | NHSZ-Szolnoki Olajbányász | 12 | 14 |
| FEC | [Nitra Blue Wings](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/nitra-blue-wings) | Nitra Blue Wings | 17 | 15 |
| FEC | [Patrioti Levice](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/patrioti-levice) | BK Patrioti Levice | 17 | 13 |
| FEC | [Petrolina AEK](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/petrolina-aek) | Petrolina AEK Larnaca Basketball Club | 18 | 12 |
| FEC | [Promitheas Patras BC](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/promitheas-patras-bc) | Promitheas Patras BC | 17 | 14 |
| FEC | [Rilski Sportist](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/rilski-sportist) | BC Rilski Sportist | 13 | 14 |
| FEC | [SCM Universitatea Craiova](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/scm-universitatea-craiova) | Sport Club Municipal Craiova | 13 | 13 |
| FEC | [SL Benfica](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/sl-benfica) | Sport Lisboa e Benfica | 14 | 12 |
| FEC | [SLUC Nancy Basket](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/sluc-nancy-basket) | SASP SLUC Nancy Basket | 14 | 13 |
| FEC | [Sporting CP](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/sporting-cp) | Sporting Clube de Portugal | 17 | 14 |
| FEC | [Tartu Ulikool Maks & Moorits](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/tartu-ulikool-maks-moorits) | Tartu Ülikool Maks & Moorits | 19 | 12 |
| FEC | [Trepca](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/trepca) | BC Trepca | 18 | 13 |
| FEC | [Valmiera Glass VIA](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/valmiera-glass-via) | Valmiera Glass VIA | 14 | 14 |
| FEC | [VEF Riga](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/vef-riga) | VEF RIGA | 17 | 12 |
| FEC | [VET-CONCEPT Gladiators Trier](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/vet-concept-gladiators-trier) | VET-CONCEPT Gladiators Trier | 20 | 13 |
| FEC | [Yukatel Denizli Basket](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/yukatel-denizli-basket) | Yukatel Denizli Basket | 16 | 14 |
| FEC | [Zastal Zielona Gora](https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/teams/zastal-zielona-gora) | Grono Sportowa Spolka Akcyjna W Restrukturyzacji | 13 | 12 |
