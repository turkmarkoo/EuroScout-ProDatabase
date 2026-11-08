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
const scheduled = (id, comp, a, b, awayKey = true) => ({
  id, comp, compName: comp, date: '2027-01-03', time: '01:00', played: false,
  home: { key: comp + '|' + a, code: a, name: a },
  away: { key: awayKey ? comp + '|' + b : '', code: b, name: b }
});
const us = [
  scheduled('nba-fixture-1', 'nba', 'NY', 'BOS'),
  scheduled('gleague-fixture-2', 'gleague', 'WIS', 'AUS'),
  scheduled('ncaam-fixture-3', 'ncaam', 'DUKE', 'UNC'),
  scheduled('ncaam-fixture-4', 'ncaam', 'DUKE', 'UNC'),
  scheduled('ncaam-fixture-5', 'ncaam', 'DUKE', 'NON-D1', false)
];
const fallbackGame = 'fec-rs1-lanl-lion|1|2026-10-07|LANL|83|LION|105';
const localStorage = { getItem: () => null, setItem() {} };
const context = {
  window: {
    EUROSCOUT_FIXTURES_2627: { comps: { fec: { name: 'FIBA Europe Cup', teams: { LANL: 'LANDAU Lions', LION: 'Lions de Geneve' }, games: fallbackGame } } },
    EuroScoutDragons: { active: () => true, fixtures: () => [fixture, ...us] },
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

const fixtures = context.window.ESFixtures;
context.STATE.data.leagues=[{meta:{id:'bsl',name:'Turkish BSL'}},{meta:{id:'fec26',name:'FIBA Europe Cup 2026/27'}},{meta:{id:'n2627',name:'2026/27 new entrants',teamsOnly:true}},{meta:{id:'registry',name:'Manual Registry'}},{meta:{id:'aba26',name:'ABA League · 2026/27 rosters'}}];
assert(fixtures.competitions().some(c=>c.id==='bsl'&&c.unavailable));
assert(!fixtures.competitions().some(c=>['fec26','n2627','registry','aba26'].includes(c.id)),'roster packs are not separate schedule competitions');
assert.equal(fixtures.between('nba|NY', 'nba|BOS').length, 1, 'NBA links survive before team packs load');
assert.equal(fixtures.between('gleague|WIS', 'gleague|AUS').length, 1, 'G League links use current US keys');
assert.equal(fixtures.between('ncaam|DUKE', 'ncaam|UNC').length, 2, 'distinct provider IDs remain distinct');
assert.equal(fixtures.all().find(g => g.id === 'ncaam-fixture-5').away.key, '', 'do not guess an out-of-catalogue opponent');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /data\/fixtures-2627\.js\?v=20261009-matchup-safe-v12/);
assert.match(html, /euroscout-fixtures\.js\?v=20261108-all-leagues/);
assert.match(html, /euroscout-sessions\.js\?v=20261108-all-leagues/);
console.log('DragonsData FIBA Europe Cup fixtures resolve to canonical club IDs.');
