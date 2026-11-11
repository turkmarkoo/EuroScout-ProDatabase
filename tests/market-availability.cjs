const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('euroscout-market.js', 'utf8');
let review;
let news = [];
const assignments = {};
const context = vm.createContext({
  window: {},
  URL,
  SEASON: '2026/27',
  START: '2026-05-01',
  Date: class extends Date {constructor(...args) {super(...(args.length ? args : ['2026-11-11']));}},
  STATUS_FREE: 'free',
  STATUS_RETIRED: 'retired',
  next26Get: () => assignments,
  next26bGet: () => ({}),
  effective26: (player, map) => map[player.id],
  effective26keys: (player, map, secondary, key) => key && !['free', 'retired'].includes(key) ? [key] : [],
  exactNews: () => news,
  auditFor: () => review,
  clubByKey: key => key === 'league|club' ? {name: 'Current Club'} : null,
  scoutSeason: row => row.season,
  EuroScoutMarketRecords: {get: () => ({})},
});
const definitions = source.slice(source.indexOf('const day='), source.indexOf('const read='));
const evidence = source.slice(source.indexOf('function currentSeasonAppearance'), source.indexOf('function center'));
vm.runInContext(definitions + evidence, context);

const p = {id: 'p', season: '2026/27'};
const current = {...p, league: 'league', team: 'club', g: 1, gameLog: [null, ['2026-09-20']]};
assert.equal(context.evidence(p).status, 'unknown');
assert.equal(context.evidence({...current, season: '2025/26'}).status, 'unknown');
assert.equal(context.evidence({...current, _rosterOnly: true}).status, 'unknown');
assert.equal(context.evidence(current).status, 'signed');
assert.equal(context.evidence({...p, _grp: [current]}).club, 'Current Club');

news = [{status: 'left', date: '2026-09-25', to: 'Free agent'}];
assert.equal(context.evidence(current).status, 'departed');
news = [{status: 'left', date: '2026-09-25', to: 'Unknown'}];
assert.equal(context.evidence(p).status, 'departed');
news = [];

review = {status: 'available', date: '2026-09-01', url: 'https://example.test/availability'};
assert.equal(context.evidence(p).status, 'available');
assert.equal(context.evidence(current).status, 'signed');
review = undefined;

assignments[p.id] = 'free';
assert.equal(context.evidence(p).status, 'available');
context.window.EuroScoutUSARosters = {key: () => 'league|club'};
assert.equal(context.evidence(p).club, 'Current Club');
assert.equal(assignments[p.id], 'free', 'availability review leaves the manual assignment intact');

const html = fs.readFileSync('index.html', 'utf8');
const clubs = vm.createContext({
  window: {},
  STATE: {data: {}},
  normClub: value => String(value || '').toLowerCase(),
  separateFrankfurtSquads: () => false,
  clubMatchIndex: () => () => false,
  DBTEAM_LIST: [
    ['lba|BDBT', 'Bertram Derthona Tortona', 'lba'],
    ['eurocup|TRT', 'Baglietto Derthona Tortona', 'eurocup'],
    ['eurocup|DER', 'Bertram Derthona Tortona', 'eurocup'],
    ['dragons-ec-97|dragons-team-186', 'Baglietto Derthona Tortona', 'dragons-ec-97'],
    ['dragons-ita-3|dragons-team-25', 'Bertram Derthona Tortona', 'dragons-ita-3'],
    ['lba|YOUTH', 'Derthona Basket U19', 'lba'],
  ].map(([key, name, lg]) => ({key, name, lg, country: 'Italy'})),
});
vm.runInContext(html.match(/^const CLUB_CODE_ALIAS_GROUPS=.*$/m)[0] +
  html.slice(html.indexOf('function buildClubs('), html.indexOf('function allClubs(')), clubs);
clubs.buildClubs();
const club = clubs.CLUB_BY_TEAMKEY.get('lba|BDBT');
assert.equal(club.name, 'Bertram Derthona Tortona');
assert.equal(club.teams.length, 5);
for (const team of clubs.DBTEAM_LIST.slice(0, -1)) assert.equal(clubs.CLUB_BY_TEAMKEY.get(team.key), club);
assert.notEqual(clubs.CLUB_BY_TEAMKEY.get('lba|YOUTH'), club);
console.log('Tortona aliases and market availability evidence passed.');
