const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clubs = [
  { key: 'hun|NHS', name: 'NHSZ-Szolnoki Olajbanyasz', teams: [] },
  { key: 'plk|OZZ', name: 'Zastal Zielona Gora', teams: [] },
];
const fixture = {
  comp: 'fec',
  compName: 'FIBA Europe Cup',
  league_id: 'dragons-fiba-europe-cup-26',
  round: 1,
  date: '2026-10-07',
  time: '18:00',
  home: { code: 'OLAJ', name: 'NHSZ-Szolnoki Olajbanyasz' },
  away: { code: 'ZIE', name: 'Zastal Zielona Gora' },
  hs: '',
  as: '',
  played: false,
  venue: 'Tiszaligeti Sportcsarnok',
};
const localStorage = { getItem: () => null, setItem() {} };
const context = {
  window: {
    EUROSCOUT_FIXTURES_2627: { comps: {} },
    EuroScoutDragons: { active: () => true, fixtures: () => [fixture] },
  },
  EuroScoutDragons: null,
  STATE: { data: { season2627: { comps: { fec: { teams: [
    { key: 'hun|NHS', name: clubs[0].name },
    { key: 'plk|OZZ', name: clubs[1].name },
  ] } } } } },
  allClubs: () => clubs,
  clubByKey: key => clubs.find(club => club.key === key) || null,
  dbTeamByKey: () => null,
  canonKey: key => key,
  localStorage,
  fetch: async () => { throw new Error('DragonsData path should not fetch EuroLeague'); },
  setTimeout,
  clearTimeout,
  console,
  Event: class Event { constructor(type) { this.type = type; } },
};
context.window.dispatchEvent = () => {};
context.window.addEventListener = () => {};
context.EuroScoutDragons = context.window.EuroScoutDragons;
vm.createContext(context);
vm.runInContext(fs.readFileSync('euroscout-fixtures.js', 'utf8'), context, { filename: 'euroscout-fixtures.js' });

const games = context.window.ESFixtures.between('hun|NHS', 'plk|OZZ');
assert.equal(games.length, 1);
assert.equal(games[0].home.key, 'hun|NHS');
assert.equal(games[0].away.key, 'plk|OZZ');
assert.equal(games[0].compName, 'FIBA Europe Cup');
assert.equal(games[0].venue, 'Tiszaligeti Sportcsarnok');

const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /euroscout-fixtures\.js\?v=20261007-dragons-club-ids/);
console.log('DragonsData FIBA Europe Cup fixtures resolve to canonical club IDs.');
