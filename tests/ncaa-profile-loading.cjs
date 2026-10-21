/* Regression checks against the production loader and route functions. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('src='))new vm.Script(m[2]);
const loader=html.slice(html.indexOf('async function loadRemainingCore('),html.indexOf('async function loadCurrentStatsThenFullCore('));
const route=html.slice(html.indexOf('function parsePlayerHash('),html.indexOf('\nfunction goHome()',html.indexOf('function parsePlayerHash(')));
const league=(id,player)=>({meta:{id},players:player?[{id:player}]:[]});
(async()=>{
 const handlers={},college=league('ncaam','ncaam-3106'),extra=league('nba','nba-1');
 let release;const fullReady=new Promise(resolve=>release=resolve),full={leagues:[league('euroleague','el-current'),league('aba','aba-4300')]};
 const c={console,Event:class{constructor(type){this.type=type}},CORE_UPGRADE_STARTED:false,CORE_FULL_PROMISE:null,STATE:{data:{leagues:[league('euroleague','el-old')]},league:{meta:{id:'euroleague'}}},CURRENT:'ncaam-3106',setCoreLoadStage(){},clearCoreLoadStage(){},loadCoreEnrichmentScripts:async()=>{},fetchCoreFile:()=>fullReady,prepareCoreData:async x=>x,ovrMerged:()=>({}),applyOverrides(){},rebuildLinks(){},mergeGroupRecords(){},wireLeagueSelector(){},render(){},renderProfile(){assert.ok(c.STATE.data.leagues.some(L=>L.players.some(p=>p.id===c.CURRENT)),'open college profile must remain present')},window:{dispatchEvent(e){handlers[e.type]?.()}}};
 vm.createContext(c);vm.runInContext(loader,c);
 const loading=c.loadRemainingCore();await Promise.resolve();
 // Both optional packs arrive while the slow core request is outstanding.
 c.STATE.data.leagues.push(college,extra);release(full);await loading;
 assert.equal(c.STATE.data.leagues.find(L=>L.meta.id==='ncaam'),college);
 assert.equal(c.STATE.data.leagues.find(L=>L.meta.id==='nba'),extra);
 assert.equal(c.STATE.data.leagues.find(L=>L.meta.id==='euroleague').players[0].id,'el-current');
 assert.equal(new Set(c.STATE.data.leagues.map(L=>L.meta.id)).size,4);
 console.log('Delayed full catalogue retains college/pro players and refreshes core: passed');
 const players=new Map(),opened=[],scopes=[];
 const r={console,location:{hash:'#p=aba-4300'},CURRENT:null,DRAWER_OPEN:false,STATE:{},window:{addEventListener(type,fn){handlers[type]=fn}},player:id=>players.get(id),openProfile:(id,fromHist)=>opened.push({id,fromHist}),loadExtraLeagues:async scope=>{scopes.push(scope);players.set('ncaam-3106',{id:'ncaam-3106'})},toast:msg=>{throw Error(msg)}};
 vm.createContext(r);vm.runInContext(route,r);
 r.openFromHash(r.location.hash);assert.equal(opened.length,0);
 players.set('aba-4300',{id:'aba-4300'});handlers['euroscout:catalogue-ready']();assert.equal(opened[0].id,'aba-4300');
 r.location.hash='#p=ncaam-3106';r.openFromHash(r.location.hash,true);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(scopes,['ncaa']);assert.deepEqual(opened[1],{id:'ncaam-3106',fromHist:true});
 r.location.hash='#p=aba-missing';r.openFromHash(r.location.hash);r.location.hash='#p=aba-other';players.set('aba-missing',{id:'aba-missing'});handlers['euroscout:catalogue-ready']();assert.equal(opened.length,2);
 console.log('Deferred European/college links open when available; stale routes stay closed: passed');
 const prefix=html.slice(html.indexOf('function renderProfile(){'),html.indexOf('  const L=STATE.league,rec=recOf(p);',html.indexOf('function renderProfile(){')));
 const stable={id:'canonical',league:'ncaam'},available=new Map();
 const guard={CURRENT:'old-id',CURRENT_PROFILE_IDS:['old-id','canonical'],DRAWER_OPEN:true,STATE:{league:{}},player:id=>available.get(id),leagueOf:p=>({meta:{id:p.league}}),closeDrawer:()=>{throw Error('Refresh closed the profile')}};
 vm.createContext(guard);vm.runInContext(prefix+'return p;}',guard);
 guard.renderProfile();assert.equal(guard.DRAWER_OPEN,true);assert.equal(guard.CURRENT,'old-id');
 available.set('canonical',stable);assert.equal(guard.renderProfile(),stable);assert.equal(guard.CURRENT,'canonical');
 console.log('Temporary catalogue gaps keep the open profile; stable merged IDs recover: passed');

})().catch(e=>{console.error(e);process.exitCode=1});
