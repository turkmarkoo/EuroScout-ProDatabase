const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('euroscout-ui.js','utf8'),sessions=fs.readFileSync('euroscout-sessions.js','utf8');
test('metadata-only private core loads a public catalogue in parallel, preserves metadata, and does not wait for live fixtures',async()=>{
let enrichDone,fetchCount=0,rendered=0;const enrichment=new Promise(resolve=>enrichDone=resolve),seed={core:{season2627:{comps:{}},rumors:{manual:'preserved'}},seeds:{}};
const state={data:{leagues:[{meta:{id:'first'},players:[]}]},league:{meta:{id:'first'}}},access={internal:true,seedReady:Promise.resolve(seed)};
const c={Event,window:{dispatchEvent(){},ESAccess:access,ESFixtures:{refresh:()=>new Promise(()=>{})}},ESAccess:access,STATE:state,Promise,console,CORE_UPGRADE_STARTED:false,CORE_FULL_PROMISE:null,CURRENT:null,
setCoreLoadStage(){},clearCoreLoadStage(){},loadCoreEnrichmentScripts:()=>enrichment,fetchCoreFile:async()=>{fetchCount++;enrichDone();return{leagues:[{meta:{id:'first'},players:[]},{meta:{id:'rest'},players:[]}]};},prepareCoreData:async raw=>raw,applyEuroScoutSeed(){},ovrMerged:()=>({}),applyOverrides(){},rebuildLinks(){},mergeGroupRecords(){},wireLeagueSelector(){},render:()=>rendered++,renderProfile(){}};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('async function loadRemainingCore()'),html.indexOf('async function loadCurrentStatsThenFullCore(')),c);
await c.loadRemainingCore();assert.equal(fetchCount,1);assert.equal(state.data.leagues.length,2);assert.equal(state.data.rumors.manual,'preserved');assert.equal(rendered,1);
});
test('linked IDs and note-status sessions determine recency; reviews and record migrations do not',()=>{
const reports=[{report:JSON.stringify({nOff:'kept',_notesUpdated:'2026-10-02T08:00:00Z'}),updated_at:'2026-10-08T18:00:00Z'},{report:JSON.stringify({nOff:'alias',_notesUpdated:'2026-10-03T08:00:00Z'})}];
const c={window:{ESSessions:{everything:()=>[{endedAt:'2026-10-07T10:00:00Z',watchedOn:['2026-10-07'],players:[{id:'alias',status:'notes'}]},{endedAt:'2026-10-08T10:00:00Z',players:[{id:'canonical',status:'none'}]}]}},reportRecords:()=>reports,parseReport:raw=>JSON.parse(raw||'{}'),recordIds:()=>['canonical','alias']};
vm.createContext(c);vm.runInContext(ui.slice(ui.indexOf('function esNoteSessionDates('),ui.indexOf('function esStars(')),c);
assert.equal(c.esNoteDate({}),'2026-10-07T10:00:00Z');assert.doesNotMatch(fs.readFileSync('euroscout-workflow.js','utf8'),/esNoteDate\s*=\s*function/,'workflow must not replace the shared evidence calculation');
});
test('coverage unifies ID/name aliases and counts only current field members without changing history',()=>{
const history=[{competition:{id:'',name:'EuroCup'},a:{key:'old|A',name:'A'},b:{key:'old|B',name:'B'},gameDate:'2026-09-10',watchedOn:['2026-10-07'],players:[{id:'alias'}]},
{competition:{id:'current-euro',name:'EuroCup'},a:{key:'eurocup|A',name:'A'},b:{key:'historical|X',name:'X'},gameDate:'2026-09-11',watchedOn:['2026-10-08'],players:[{id:'canonical'}]}];
const raw=JSON.stringify(history),player={id:'canonical'},c={STATE:{data:{season2627:{comps:{eurocup:{name:'EuroCup',teams:[{key:'eurocup|A',name:'A'},{key:'eurocup|B',name:'B'},{key:'eurocup|C',name:'C'}]}}},leagues:[{meta:{id:'current-euro',name:'EuroCup',season:'2026/27'},teams:[{code:'A'}]}]}},canonKey:k=>k?.replace('old|','eurocup|'),allClubs:()=>[],everything:()=>history,P:id=>['alias','canonical'].includes(id)?player:null,gid:p=>p.id,isWatched:()=>true};
vm.createContext(c);vm.runInContext(sessions.slice(sessions.indexOf('function competitionNameKey('),sessions.indexOf('/* ── competition + known-game choices')),c);
const rows=c.coverage();assert.equal(rows.length,1);assert.equal(rows[0].total,3);assert.equal(rows[0].teams,3);assert.equal(rows[0].covered,2);assert.equal(rows[0].pct,67);assert.equal(rows[0].players,1);assert.equal(rows[0].last,'2026-10-08');assert.equal(JSON.stringify(history),raw);
});
