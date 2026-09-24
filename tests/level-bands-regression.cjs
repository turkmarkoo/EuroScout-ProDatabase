const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('index.html','utf8');
const bands=source.match(/const LEVEL_BANDS=(\[[^;]+\]);/);
const indexer=source.match(/function bandIndexFromGrade\(g\)\{[\s\S]*?\n\}/);
assert(bands&&indexer,'level scale definitions must remain available');

const context={};
vm.runInNewContext(`${bands[0]}\n${indexer[0]}\nthis.result={LEVEL_BANDS,bandIndexFromGrade};`,context);
const {LEVEL_BANDS,bandIndexFromGrade}=context.result;
assert.equal(Array.from(LEVEL_BANDS).join('|'),'Low-Level|Mid-Level|Top Level|EuroCup|EuroLeague|NBA');
assert.equal(bandIndexFromGrade(9.49),4,'high European grade remains EuroLeague');
assert.equal(bandIndexFromGrade(9.5),5,'exceptional grade reaches NBA');

const matchup=fs.readFileSync('euroscout-live-notes.js','utf8');
assert(matchup.includes("LEVEL_BANDS.map((_,i)=>'<i class=\"'"),'matchup must render one segment per level');
console.log('level band regression checks passed');
