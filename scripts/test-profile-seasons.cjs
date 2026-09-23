const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const uiSource = fs.readFileSync(path.resolve(__dirname, '../euroscout-ui.js'), 'utf8');
const seasonStart = indexSource.indexOf('function scoutSeason(p){');
const seasonEnd = indexSource.indexOf('let seasonPoolCache', seasonStart);
const choicesStart = uiSource.indexOf('function esStatsSeasonChoices(p){');
const choicesEnd = uiSource.indexOf('function esDossierStats(p){', choicesStart);
assert.ok(seasonStart >= 0 && seasonEnd > seasonStart);
assert.ok(choicesStart >= 0 && choicesEnd > choicesStart);
const leagueMeta = {
  bbl: { meta: { season: '2025/26' } },
  fec: { meta: { season: '2025/26' } },
  acb: { meta: { season: '2025/26' } },
  bcl: { meta: { season: '2025/26' } },
  aba: { meta: { season: '2026/27' } },
  orlen: { meta: { season: '2025/26' } },
  eurocup: { meta: { season: '2025/26' } }
};
const context = { leagueOf: player => leagueMeta[player.league] || { meta: {} } };
vm.runInNewContext(indexSource.slice(seasonStart, seasonEnd), context);
vm.runInNewContext(uiSource.slice(choicesStart, choicesEnd), context);

const orlen = { id: 'kirkwood-orlen-25', league: 'orlen' };
const eurocup = { id: 'kirkwood-eurocup-25', league: 'eurocup' };
const aba = { id: 'kirkwood-aba-26', season: '2026/27', league: 'aba' };
const group = [orlen, eurocup, aba];
group.forEach(player => { player._grp = group; });

const previous = context.esStatsSeasonChoices(orlen);
assert.deepEqual(Array.from(previous.seasons), ['2026/27', '2025/26']);
assert.deepEqual(Array.from(previous.competitions, player => player.league), ['orlen', 'eurocup']);
const current = context.esStatsSeasonChoices(aba);
assert.deepEqual(Array.from(current.competitions, player => player.league), ['aba']);

const bbl = { id: 'bbl-2001687', league: 'bbl', g: 39 };
const fec = { id: 'fec-382', league: 'fec', g: 4 };
const acb = { id: 'acb-30005411', league: 'acb', g: null, _rosterOnly: true };
const bcl = { id: 'bclq-340312', league: 'bcl', g: null, _rosterOnly: true };
const tevinGroup = [bbl, fec, acb, bcl];
tevinGroup.forEach(player => { player._grp = tevinGroup; });

const tevinPrevious = context.esStatsSeasonChoices(bbl);
assert.equal(tevinPrevious.selectedSeason, '2025/26');
assert.deepEqual(Array.from(tevinPrevious.competitions, player => player.id), ['bbl-2001687', 'fec-382']);
const tevinCurrent = context.esStatsSeasonChoices(acb);
assert.equal(tevinCurrent.selectedSeason, '2026/27');
assert.deepEqual(Array.from(tevinCurrent.competitions, player => player.id), ['acb-30005411', 'bclq-340312']);
console.log('Player profile competition seasons stay separate.');
