const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const matchup = fs.readFileSync(path.join(root, 'euroscout-live-notes.js'), 'utf8');

assert.match(html, /function addToScoutBoard\(id\)/);
assert.match(html, /dragonshub:list-boards/);
assert.match(html, /dragonshub:board-options/);
assert.match(html, /dragonshub:add-to-board-result/);
assert.match(html, /class="es-board-pick"/);
assert.match(html, /＋ Add to board/);
assert.match(matchup, /id="mxBoard"/);
assert.match(matchup, /addToScoutBoard\(p\.id\)/);
assert.doesNotMatch(matchup, /HUB_EMBED\?'<button type="button" class="btn primary sm" id="mxBoard"/);

new vm.Script(matchup, {filename: 'euroscout-live-notes.js'});
for (const [i, m] of [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
  new vm.Script(m[1], {filename: `inline-${i}.js`});
}
console.log('Direct in-place Scout Board add checks passed.');
