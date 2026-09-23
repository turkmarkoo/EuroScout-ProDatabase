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

console.log('Runtime performance guards passed.');
