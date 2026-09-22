const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../euroscout-ui.js'), 'utf8');
const start = source.indexOf('function esStatsSeasonChoices(p){');
const end = source.indexOf('function esDossierStats(p){', start);
assert.ok(start >= 0 && end > start);
const context = { scoutSeason: player => player.season };
vm.runInNewContext(source.slice(start, end), context);

const orlen = { id: 'kirkwood-orlen-25', season: '2025/26', league: 'Orlen Basket Liga' };
const eurocup = { id: 'kirkwood-eurocup-25', season: '2025/26', league: 'EuroCup' };
const aba = { id: 'kirkwood-aba-26', season: '2026/27', league: 'ABA League' };
const group = [orlen, eurocup, aba];
group.forEach(player => { player._grp = group; });

const previous = context.esStatsSeasonChoices(orlen);
assert.deepEqual(Array.from(previous.seasons), ['2026/27', '2025/26']);
assert.deepEqual(Array.from(previous.competitions, player => player.league), ['Orlen Basket Liga', 'EuroCup']);
const current = context.esStatsSeasonChoices(aba);
assert.deepEqual(Array.from(current.competitions, player => player.league), ['ABA League']);
console.log('Player profile competition seasons stay separate.');
