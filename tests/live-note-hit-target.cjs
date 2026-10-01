const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const toastRule = html.match(/\.toast\{([^}]*)\}/)?.[1] || '';

assert.match(toastRule, /pointer-events\s*:\s*none/,
  'The invisible toast must not cover editable matchup notes near the bottom of the viewport.');

console.log('Invisible toast does not block bottom scouting-note rows.');
