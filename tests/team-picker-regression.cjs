const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'euroscout-live-notes.js'), 'utf8');
const picker = fs.readFileSync(path.join(root, 'team-selection-workspace.js'), 'utf8');

assert.match(html, /team-selection-workspace\.css\?v=20260930-1/);
assert.match(html, /team-selection-workspace\.js\?v=20260930-1/);
assert.match(html, /euroscout-live-notes\.js\?v=20260930-team-picker/);
assert.ok(html.indexOf('team-selection-workspace.js') < html.indexOf('euroscout-live-notes.js'));
assert.match(notes, /class="scoutTeamButton"/);
assert.match(notes, /ESTeamSelection\.open\(\{slot,currentKey:s\[slot\]/);
assert.doesNotMatch(notes, /class="scoutTeamSel"/);
assert.match(picker, /1\. Select Competition/);
assert.match(picker, /2\. Select Team/);
assert.match(picker, /selectedComp\.teams\.filter/);

new vm.Script(notes);
new vm.Script(picker);
console.log('Competition-first scouting matchup team picker checks passed.');
