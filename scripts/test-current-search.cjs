const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const seasons = {
  aba: { meta: { id: 'aba', name: 'ABA League', season: '2025/26' } },
  bcl: { meta: { id: 'bcl', name: 'Basketball Champions League', season: '2024/25' } },
  tur: { meta: { id: 'tur', name: 'Turkish BSL', season: '2023/24' } },
  current: { meta: { id: 'current', name: 'ABA League', season: '2026/27' } }
};
const old = { id: 'cowan-old', name: 'Anthony Cowan', league: 'aba', teamName: 'Galatasaray', ppg: 8.5, pir: 8, g: 20 };
const historical = [{ ...old, id: 'cowan-bcl', league: 'bcl' }, { ...old, id: 'cowan-tur', league: 'tur' }];
const group = [old, ...historical];
old._grp = group;
let assignment = 'cedevita';
const indexed = [{ p: old, L: seasons.aba }, ...Array.from({ length: 2000 }, (_, i) => ({
  p: { ...old, id: 'other-' + i, name: 'Other Cowan prospect ' + i, _grp: [] }, L: seasons.aba
}))];
const context = {
  console,
  setTimeout: () => 0,
  window: { GlobalCommandPalette: { fold: x => String(x).toLowerCase(), score: (q, title) => title.toLowerCase().includes(q.toLowerCase()) ? 1 : -1 }, EuroScoutMergeCenter: { detect: () => { throw new Error('Full duplicate detection must not run while typing'); } } },
  STATE: { data: { leagues: Object.values(seasons) } },
  allPlayersIndexed: () => indexed,
  allClubs: () => [],
  Store: { get: () => ({ report: '{}' }) },
  gid: p => p.id,
  leagueOf: p => seasons[p.league],
  effective26: () => assignment,
  isStatus: x => x === '__free_agent' || x === '__retired',
  STATUS_FREE: '__free_agent', STATUS_RETIRED: '__retired',
  clubByKey: () => ({ name: 'Cedevita Olimpija', teams: [] }),
  domCompsOf: () => [{ name: 'ABA League' }],
  nextCompsOf: () => [{ name: 'EuroCup' }],
  photoOf: () => '', dbPositionGroup: () => 'Guard', countryLabel: () => 'United States',
  fmt: n => String(n), isWatched: () => false, toggleWatch: () => {},
  openGlobal: () => {}, goView: () => {},
  document: { getElementById: () => null }
};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../euroscout-command-palette.js'), 'utf8'), context);
const result = () => context.window.EuroScoutCommandPalette.search('Cowan').Players.items[0];
assert.deepEqual(Array.from(result().chips), ['ABA League', 'EuroCup']);
assert.equal(result().club, 'Cedevita Olimpija');
assert.equal(result().season, '2026/27');
assert.deepEqual(Array.from(result().stats, x => x.value), ['—', '—']);
assert.equal(context.window.EuroScoutCommandPalette.search('Cowan').Players.total, 2001);
assert.equal(context.window.EuroScoutCommandPalette.search('Cowan').Players.items.length, 5);

const current = { ...old, id: 'cowan-current', league: 'current', ppg: 12.3, pir: 14.1, g: 3 };
group.push(current);
assert.deepEqual(Array.from(result().stats, x => x.value), ['12.3', '14.1']);

group.pop();
assignment = '__free_agent';
assert.equal(result().club, 'Free Agent · Last club: Galatasaray');
assert.deepEqual(Array.from(result().chips), ['ABA League']);
assert.equal(result().season, '2025/26');
console.log('Current-season search identity checks passed.');
