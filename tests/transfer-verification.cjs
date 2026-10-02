const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'euroscout-transfer-verification.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.includes('euroscout-transfer-verification.js?v=20261002-official-signings'));
const player = { id: 'player-1', name: 'Player One', _grp: [] };
const team = { key: 'league|TEAM', name: 'Team One' };
const context = {
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  pendingTransfers: () => [],
  dbTeamForClub: () => null,
  trHandledGet: () => ({}),
  trHandledSet: () => {},
  set26: () => {},
  Sync: { stampKey: () => {}, pushAppKey: () => {} },
  Store: { user: { email: 'admin@example.com' } },
  trRow: () => '<div></div>',
  approveTransfer: () => {},
  rejectTransfer: () => {},
  esc: String,
  escAttr: String,
  showModal: () => {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'euroscout-transfer-verification.js' });

const verify = context.EuroScoutTransferVerification.verify;
const base = {
  id: 'official-signing',
  playerId: player.id,
  player: player.name,
  to: team.name,
  status: 'signed',
  autoApply: true,
  source_name: 'Official club announcement 2026/27',
  source_url: 'https://club.example/signing'
};

const official = verify({ tr: base, p: player, team });
assert.strictEqual(official.score, 80, 'missing origin and corroboration should remain visible in the evidence score');
assert.strictEqual(official.status, 'auto_approved', 'exact official signings should not wait for duplicate evidence');

assert.strictEqual(
  verify({ tr: { ...base, id: 'extension', status: 'extended' }, p: player, team }).status,
  'auto_approved'
);
assert.strictEqual(
  verify({ tr: { ...base, id: 'media', source_name: 'Sportando', source_url: 'https://media.example/report' }, p: player, team }).status,
  'rejected',
  'a single media report is not automatically confirmed'
);
assert.strictEqual(
  verify({ tr: { ...base, id: 'rumor', status: 'rumor' }, p: player, team }).status,
  'needs_review',
  'rumors are never automatically confirmed'
);
assert.strictEqual(
  verify({ tr: { ...base, id: 'ambiguous', playerId: '' }, p: player, team }).status,
  'needs_review',
  'a possible name match is not enough'
);
assert.strictEqual(
  verify({ tr: { ...base, id: 'missing-team' }, p: player, team: null }).status,
  'needs_review',
  'the destination must resolve to a database club'
);

const database = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'data.json'), 'utf8'));
const visiblePlayers = new Set([
  'Fabio Kasteiner', 'Austen Awosika', 'Trevon Allen', 'Trey Edmonds III',
  'Brendan Bailey', 'Javonte Johnson', 'Savvas Foullidis'
]);
const visibleTransfers = database.transfers.filter((transfer) => visiblePlayers.has(transfer.player));
assert.strictEqual(visibleTransfers.length, visiblePlayers.size);
visibleTransfers.forEach((transfer) => {
  assert.strictEqual(
    verify({ tr: transfer, p: { id: transfer.playerId, name: transfer.player, _grp: [] }, team }).status,
    'auto_approved',
    `${transfer.player} should be confirmed from the stored official announcement`
  );
});

console.log('transfer-verification: ok');
