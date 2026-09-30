const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('eurocup-rosters-2026.js', 'utf8'), context);

const data = context.window.EUROSCOUT_EUROCUP_ROSTERS;
const leagues = JSON.parse(fs.readFileSync('data/data.json', 'utf8')).leagues
  .concat(JSON.parse(fs.readFileSync('data.js', 'utf8')).leagues);
const existing = leagues.flatMap(league => league.players || []);
const byId = new Map(existing.filter(player => player.id).map(player => [player.id, player]));
const fold = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');
const byName = new Map();
for (const player of existing) {
  const key = fold(player.name);
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(player);
}

const reviewed = new Map([
  ['014872', ['lnb-9559', 'bcl-0327']], // Ugo Doumbia Niang / Ugo Doumbia
]);

const playerByCode = new Map(data.players.map(player => [player.code, player]));
for (const row of data.roster) {
  const exact = byName.get(fold(row.name)) || [];
  const aliases = (reviewed.get(row.id) || []).map(id => byId.get(id)).filter(Boolean);
  const matches = [...exact, ...aliases];
  row.ids = [...new Set([...row.ids, ...matches.map(player => player.id)])];
  if (!row.existing && matches.length) {
    row.name = matches[0].name || row.name;
    row.existing = true;
    row.match = aliases.length ? 'Reviewed identity alias' : 'Exact full name';
    const profile = playerByCode.get(row.id);
    if (profile) profile.name = row.name;
  }
}

fs.writeFileSync(
  'eurocup-rosters-2026.js',
  `window.EUROSCOUT_EUROCUP_ROSTERS=${JSON.stringify(data)};\n`,
  'utf8',
);

console.log(`Relinked ${data.roster.filter(row => row.ids.length > 1).length} official registrations.`);
