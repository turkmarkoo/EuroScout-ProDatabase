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
const optionSearch=fs.readFileSync('euroscout-option-search.js','utf8');
for(const selector of ['#mxLevel','#esLevel','#eProj','.es-blueprint-level','.es-level-picker']){
 assert(optionSearch.includes(selector),`${selector} must remain a native dropdown`);
}
const ui=fs.readFileSync('euroscout-ui.js','utf8');
assert(ui.includes("LEVEL_BANDS.map((name,i)=>({name,i})).reverse()"),'profile levels must be ordered highest first');
const view = source.slice(source.indexOf('const SCOUT_ROSTER_COMPETITIONS='),source.indexOf('function currentViewState()'));
const sorter = source.slice(source.indexOf('function sortPoolForTable('),source.indexOf('// inline SVG sparkline'));
const scout = {levelBand:p=>p.band==null?null:{i:p.band}};
vm.runInNewContext(bands[0]+'\n'+view+'\n'+sorter,scout);
const legacy = scout.normalizeScoutView({competition:'bclq',leagues:[],level:3,sort:'grade',tsort:{key:'grade',dir:-1}});
assert.equal(legacy.competition,'all');
assert.deepEqual(Array.from(legacy.leagues),['bclq']);
assert.deepEqual(Array.from(legacy.levels),[3]);
assert.equal(legacy.tsort.key,'level');
const college = scout.normalizeScoutView({leagues:['ncaam'],levels:[2,3],sort:'grade',tsort:{key:'reb',dir:-1}});
assert.equal(college.competition,'ncaam');
assert.equal(college.leagues.length,0);
assert.deepEqual(Array.from(college.levels),[2,3]);
assert.equal(college.tsort.key,'reb');
assert.equal(college.sort,'grade');
const pool = [{name:'No estimate'},{name:'Top',band:2},{name:'EuroCup',band:3},{name:'Low',band:0}];
assert.deepEqual(Array.from(scout.sortPoolForTable(pool,{key:'level',dir:-1}),p=>p.name),['EuroCup','Top','Low','No estimate']);
assert.deepEqual(Array.from(scout.sortPoolForTable(pool,{key:'level',dir:1}),p=>p.name),['Low','Top','EuroCup','No estimate']);
console.log('level band and saved-view regression checks passed.');
