const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = {
  window: {},
  structuredClone,
  canonKey: key => key,
  searchFold: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
};
vm.createContext(context);
for (const file of ['official-rosters-2026.js', 'current-contract-updates-2026.js', 'euroscout-official-rosters.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const updates = context.window.EUROSCOUT_CURRENT_CONTRACT_UPDATES;
assert.equal(updates.season, '2026/27');
assert.equal(updates.roster.length, 68);
assert.equal(updates.roster.filter(row => row.league === 'vtb').length, 67);
assert.equal(context.window.EuroScoutOfficialRosters.key({ id: 'vtb-0145' }), 'vtb|UNI');
assert.equal(context.window.EuroScoutOfficialRosters.key({ id: 'euroleague-013378' }), 'vtb|UNI');
assert.equal(context.window.EuroScoutOfficialRosters.key({ id: 'eurocup-013910' }), 'bsl|BUR');

const teams = updates.teams;
assert(teams.some(team => team.key === 'bsl|BUR' && team.name === 'Bursaspor Basketball'));
assert(teams.some(team => team.key === 'vtb|ZEN' && team.aliases.includes('Zenit Saint Petersburg')));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const picker = fs.readFileSync(path.join(root, 'euroscout-edit-player-v2.js'), 'utf8');
assert.match(html, /if\(long===short\+"spor"\)return false/);
assert.match(html, /if\(k===STATUS_FREE&&registered\)return canonKey\(registered\)/);
assert.match(html, /current-contract-updates-2026\.js\?v=20261007-vtb-bursa/);
assert.match(picker, /const score=c=>/);
assert.match(picker, /const key=searchFold\(c\.name\)\.replace/);

console.log('Current VTB contracts, Bursaspor identity, and picker deduplication checks passed.');
