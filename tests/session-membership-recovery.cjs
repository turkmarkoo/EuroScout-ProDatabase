const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),sessions=fs.readFileSync('euroscout-sessions.js','utf8');
const read=f=>fs.readFileSync(f,'utf8');
const events=[],records=new Map();
const c={window:{addEventListener(){},dispatchEvent:e=>events.push(e.type)},STATE:{data:JSON.parse(read('data/data.json'))},structuredClone,
 searchFold:s=>String(s||'').toLowerCase(),ovrMerged:()=>({clubs:{}}),isStatus:()=>false,console,Promise,Map,Set,Event:class{constructor(type){this.type=type}},
 localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},document:{addEventListener(){}},setTimeout(){},clearTimeout(){},rebuildLinks(){},
 player:()=>null,parseReport:v=>typeof v==='string'?JSON.parse(v):v,effective26keys:()=>[],next26Get:()=>({}),next26bGet:()=>({})};
vm.createContext(c);
vm.runInContext(html.match(/const normClub=([^\n]+)/)[0],c);
vm.runInContext(html.slice(html.indexOf('let DBTEAM_LIST='),html.indexOf('function openTeamPickerProfile(')),c);
vm.runInContext(read('euroscout-clubs.js'),c);c.EuroScoutClubs=c.window.EuroScoutClubs;
// Build and cache the old map before the current roster modules arrive.
vm.runInContext('allClubs();nextCompMap();',c);
const oldGeneva=vm.runInContext("allClubs().find(c=>/Lions de Geneve/i.test(c.name))",c);
assert.ok(vm.runInContext('allClubs().length',c)>100);
const scripts=['eurocup-rosters-2026.js','euroscout-eurocup-rosters.js','official-rosters-2026.js','euroleague-rosters-2026.js','data/fiba-club-competitions-2026.js','euroscout-fiba-club-competitions.js','euroscout-official-rosters.js'];
for(const f of scripts)vm.runInContext(read(f),c,{filename:f});
assert.equal(c.window.EUROSCOUT_MEMBERSHIPS,undefined,'exercise roster loading before membership-data.js');
const loader=html.slice(html.indexOf('let CORE_FULL_PROMISE='),html.indexOf('window.loadMatchupRosterScripts='));
c.document.createElement=()=>({});c.document.head={appendChild:s=>queueMicrotask(()=>s.onload())};
vm.runInContext('let PLAYER_BY_NAME=null,seasonPoolCache=null;'+loader,c);
const sharedHelpers=sessions.slice(sessions.indexOf('function compsFor('),sessions.indexOf('/* ── dialogs'));
const fixtures=read('euroscout-fixtures.js');
(async()=>{
 await c.loadMatchupRosterScripts();
 vm.runInContext(read('data/fixtures-2627.js'),c);
 c.window.EuroScoutDragons={active:()=>true,fixtures:()=>[]};c.EuroScoutDragons=c.window.EuroScoutDragons;
 vm.runInContext(fixtures,c);
 vm.runInContext('function club(k){return clubByKey(canonKey(k));}'+sharedHelpers,c);
 const a=vm.runInContext("allClubs().find(c=>/LANDAU Lions/i.test(c.name)).key",c),b=vm.runInContext("allClubs().find(c=>/Lions de Geneve/i.test(c.name)).key",c);
 const comps=c.compsFor(a,b);assert.ok(comps.shared.includes('fec'));assert.ok(!comps.options.some(x=>x.id==='bcl'));
 const games=c.knownGames(a,b);assert.ok(games.some(g=>g.date==='2026-10-07'&&g.comp.id==='fec'&&g.scoreA==='83'&&g.scoreB==='105'&&g.round==='1'));
 const euro=c.compsFor('lba|BDBT','bcl|MSB');assert.ok(euro.shared.includes('eurocup'));assert.ok(!euro.options.some(x=>x.id==='bcl'));
 // Fixture lookups remain valid after a later canonical-key change.
 const before=c.window.ESFixtures.all().find(g=>g.comp==='fec'&&g.home.code==='LANL');
 const canonical=c.canonKey;c.canonKey=k=>k===before.home.key?'renamed|LANL':canonical(k);
 assert.ok(c.window.ESFixtures.between('renamed|LANL',b).length);c.canonKey=canonical;
 assert.ok(games.every(g=>g.date>='2026-07-01'),'previous-season games never enter current session choices');
 // Bundled games become usable even while the live schedule request is hung.
 const pendingContext={window:{EUROSCOUT_FIXTURES_2627:c.window.EUROSCOUT_FIXTURES_2627,addEventListener(){},dispatchEvent(){}},STATE:{data:{season2627:{comps:{}}}},canonKey:k=>k,clubByKey:()=>null,dbTeamByKey:()=>null,allClubs:()=>[],localStorage:{getItem:()=>null,setItem(){}},fetch:()=>new Promise(()=>{}),setTimeout(){},console,Event:c.Event};
 vm.createContext(pendingContext);vm.runInContext(fixtures,pendingContext);
 pendingContext.allClubs=()=>[{key:'fec26|LANL',name:'LANDAU Lions'},{key:'fec26|LION',name:'Lions de Geneve'}];
 pendingContext.STATE.data.season2627.comps.fec={teams:pendingContext.allClubs()};
 pendingContext.window.ESFixtures.refresh(false);
 assert.equal(pendingContext.window.ESFixtures.between('fec26|LANL','fec26|LION').length,1,'bundled game must not wait for a pending live API');
 // Orphan September viewings are exposed read-only, preserving existing sessions and notes.
 const original={p1:{report:JSON.stringify({nOff:'Newer notes retained',_workflow:{viewings:[
 {id:'v1',sessionId:'lost-september',event:'LANDAU Lions vs Lions de Geneve',gameDate:'2026-09-23',date:'2026-09-25',competition:'BCL Qualifiers',status:'up'},
 {id:'v2',sessionId:'removed',source:'session',event:'LANDAU Lions vs Lions de Geneve',date:'2026-09-24'},
 {id:'v3',sessionId:'existing',source:'session',event:'LANDAU Lions vs Lions de Geneve',date:'2026-10-07'},
 {id:'v4',sessionId:'active',source:'session',event:'LANDAU Lions vs Lions de Geneve',date:'2026-10-08'}]}})}};
 records.set('euroscout:records',JSON.stringify(original));records.set('euroscout:sessions:v1',JSON.stringify({sessions:[{id:'removed',removed:true},{id:'existing'}]}));
 c.KEY='euroscout:sessions:v1';c.RECORDS='euroscout:records';c.readJSON=(k,d)=>JSON.parse(records.get(k)||'null')||d;
 c.active=()=>({id:'active'});c.hash=s=>String(s).length+'-'+String(s).slice(-30);
 vm.runInContext('const cache={stamp:"",legacy:[],reports:null};'+sessions.slice(sessions.indexOf('const HAS_NOTES'),sessions.indexOf('/* One snapshot')),c);
 const recovered=c.legacy();assert.equal(recovered.length,1);assert.equal(recovered[0].recoveredSessionId,'lost-september');assert.equal(recovered[0].competition.name,'BCL Qualifiers');assert.equal(recovered[0].players[0].status,'up');
 assert.equal(records.get('euroscout:records'),JSON.stringify(original),'recovery must never rewrite player reports');
 vm.runInContext(sessions.slice(sessions.indexOf('function viewingsOf('),sessions.indexOf('/* Rewrites the viewings')),c);
 assert.equal(c.viewingsOf(recovered[0],JSON.parse(original.p1.report)).length,1);
 console.log('PASS real packs: late-loading FEC/EuroCup memberships, Round 1 fixture, alias transitions, read-only September orphan recovery and deletion protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
