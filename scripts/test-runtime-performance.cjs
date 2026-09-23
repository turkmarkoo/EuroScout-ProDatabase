const fs=require('fs'),assert=require('assert/strict');

const html=fs.readFileSync('index.html','utf8');
const notes=fs.readFileSync('euroscout-live-notes.js','utf8');

assert(!/focusin[^\n]+loadExtraLeagues/.test(html),'focusing search must not load every extra league');
assert(!/backgroundLeagues\(\)/.test(notes),'Scouting Matchup must not load NBA/NCAA packs in the background');
assert.match(html,/for\(const label of labels\)[\s\S]{0,500}await EXTRA_JOBS\.get\(label\)/,
  'extra league packs should load sequentially');
assert(!/Promise\.all\(labels\.map/.test(html),'extra league packs must not load concurrently');
assert.match(html,/const cached=window\.ESAccess\?true:local\.set\(cache\)/,
  'protected record saves must avoid full-cache localStorage serialization');
assert.match(html,/try\{localStorage\.removeItem\(LKEY\);\}catch\(e\)\{\}/,
  'obsolete protected browser cache should be cleared');
assert.match(html,/STATE\?\.view==='scouting'\|\|document\.querySelector\('\.liveScouting'\)/,
  'protected-state refreshes must pause while the live matchup is open');
assert.match(html,/canEdit, initSB, load, get, stage, save/,
  'live note drafts need an in-memory staging path');
assert.match(notes,/Store\.stage\(id,\{report:payload\}\)/,
  'note edits must become readable immediately without waiting for cloud persistence');
assert.match(notes,/setTimeout\(flushNoteSaves,1200\)/,
  'live note cloud writes must be batched after typing settles');
assert.match(notes,/queueNoteSave\(p,r\);[\s\S]{0,80}counts\(\);refreshMarks\(\)/,
  'the bullet editor must queue a batched save rather than persist every keystroke');

console.log('Runtime performance guards passed.');
