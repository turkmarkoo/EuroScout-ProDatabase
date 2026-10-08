const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clubs = [
  { key: 'hun|NHS', name: 'NHSZ-Szolnoki Olajbanyasz', teams: [] },
  { key: 'plk|OZZ', name: 'Zastal Zielona Gora', teams: [] },
  { key: 'fec26|LANL', name: 'LANDAU Lions', teams: [] },
  { key: 'fec26|LION', name: 'Lions de Geneve', teams: [] },
];
const fixture = {
  comp: 'fec',
  compName: 'FIBA Europe Cup',
  league_id: 'dragons-fiba-europe-cup-26',
  round: 1,
  date: '2026-10-07',
  time: '18:00',
  home: { code: 'OLAJ', name: 'NHSZ-Szolnoki Olajbanyasz' },
  away: { key: 'plk|OZZ', code: 'dragons-team-262', name: 'Grono Sportowa Spolka Akcyjna W Restrukturyzacji' },
  hs: '',
  as: '',
  played: false,
  venue: 'Tiszaligeti Sportcsarnok',
};
const fallbackGame = 'fec-rs1-lanl-lion|1|2026-10-07|LANL|83|LION|105';
const localStorage = { getItem: () => null, setItem() {} };
const context = {
  window: {
    EUROSCOUT_FIXTURES_2627: { comps: { fec: { name: 'FIBA Europe Cup', teams: { LANL: 'LANDAU Lions', LION: 'Lions de Geneve' }, games: fallbackGame } } },
    EuroScoutDragons: { active: () => true, fixtures: () => [fixture] },
  },
  EuroScoutDragons: null,
  STATE: { data: { season2627: { comps: { fec: { teams: [
    { key: 'hun|NHS', name: clubs[0].name },
    { key: 'plk|OZZ', name: clubs[1].name },
    { key: 'fec26|LANL', name: clubs[2].name },
    { key: 'fec26|LION', name: clubs[3].name },
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

const landauGeneva = context.window.ESFixtures.between('fec26|LANL', 'fec26|LION');
assert.equal(landauGeneva.length, 1, 'an incomplete DragonsData competition must retain bundled official fixtures');
assert.equal(landauGeneva[0].round, '1');
assert.equal(landauGeneva[0].date, '2026-10-07');
assert.equal(landauGeneva[0].hs, '83');
assert.equal(landauGeneva[0].as, '105');

const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /data\/fixtures-2627\.js\?v=20261008-fec-round1/);
assert.match(html, /euroscout-fixtures\.js\?v=20261008-session-membership-v8/);
assert.match(html, /euroscout-sessions\.js\?v=20261008-dashboard-evidence-v9/);
console.log('DragonsData FIBA Europe Cup fixtures resolve to canonical club IDs.');
