const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const normal = value => String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
const c = vm.createContext({
  window: {}, STATE: {data: {}},
  normClub: normal, normName: normal,
  canonKey: key => c.CLUB_BY_TEAMKEY.get(key)?.key || key,
  separateFrankfurtSquads: () => false, clubMatchIndex: () => () => false,
  DBTEAM_LIST: [
    ['lnb|VIL', 'LDLC ASVEL'], ['lnb|1866', 'Lyon-Villeurbanne'],
    ['lnb|dragons-team-450', 'Lyon-Villeurbanne'], ['euroleague|ASV', 'LDLC ASVEL'],
    ['dragons-el-69|dragons-team-175', 'LDLC ASVEL Villeurbanne'],
    ['lnb|PAB', 'Paris Basketball'], ['euroleague|PRS', 'Paris Basketball'],
    ['lnb|U21', 'ASVEL U21'],
  ].map(([key, name]) => ({key, name, lg: key.split('|')[0], country: 'France'})),
});
vm.runInContext(html.slice(html.indexOf('const FRENCH_CLUB_KEYS'), html.indexOf('const FRANKFURT_SENIOR_KEYS')) +
  html.slice(html.indexOf('function buildClubs('), html.indexOf('function allClubs(')), c);
c.buildClubs();
for (const key of ['lnb|1866', 'lnb|dragons-team-450', 'euroleague|ASV', 'dragons-el-69|dragons-team-175']) {
  assert.equal(c.canonKey(key), 'lnb|VIL');
}
assert.equal(c.canonKey('euroleague|PRS'), 'lnb|PAB');
assert.equal(c.canonKey('dragons-fra-917|dragons-team-450'), 'lnb|VIL');
assert.notEqual(c.canonKey('lnb|U21'), 'lnb|VIL');

vm.runInContext(fs.readFileSync('euroscout-league-rosters.js', 'utf8'), c);
const rosters = c.window.EuroScoutLeagueRosters;
const player = {id: 'lnb-123', name: 'Player One', born: 2003, league: 'lnb'};
const namesake = {id: 'other-123', name: 'Player One', born: 1990, league: 'lnb'};
const active = {id: '123', name: 'Player One', born: 2003, birthDate: '2003-01-01', teamId: '1866',
  number: '6', active: true, verifiedClubSource: 'https://example.test/team',
  supersededUSRosterId: 'gl-old', observedAt: '2026-11-11T08:00:00Z'};
const left = {id: '124', name: 'Previous Player', born: 1999, active: false, teamId: '1866'};
const raw = {leagues: [{meta: {id: 'lnb'}, players: [player, namesake], teams: []}]};
const pack = {id: 'lnb', provider: 'lnb', season: '2026/27', country: 'France', complete: true,
  teams: [{id: '1866', key: 'lnb|VIL', code: 'VIL', name: 'LDLC ASVEL'}], roster: [active, left],
  stats: [{id: 'lnb-season-124', rosterPlayerId: '124', name: 'Previous Player', teamId: '1866', g: 2}]};
rosters.apply(raw, [pack]);
assert.equal(rosters.key(player), 'lnb|VIL');
assert.equal(rosters.current(player, 'euroleague|ASV').number, '6');
assert.equal(rosters.key(namesake), null);
assert.equal(rosters.key({id: 'lnb-official-124'}), null);
assert.equal(rosters.statLeagues()[0].players[0].g, 2);
assert.equal(rosters.supersededUSRoster(player, {id: 'gl-old', checkedAt: '2026-11-05T08:00:00Z'}), true);
assert.equal(rosters.supersededUSRoster(player, {id: 'gl-old', checkedAt: '2026-11-12T08:00:00Z'}), false);
assert.equal(rosters.supersededUSRoster(player, {id: 'gl-other', checkedAt: '2026-11-05T08:00:00Z'}), false);
console.log('French clubs, player identity, stats preservation and stale-roster handling passed.');
