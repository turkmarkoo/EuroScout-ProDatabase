const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const window={};const ctx={window,structuredClone,console,Event:class{},setTimeout,clearTimeout};vm.createContext(ctx);
for(const f of ['eurocup-rosters-2026.js','official-rosters-2026.js','euroscout-dragons.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const fixtures=[
 {comp:'eurocup',compName:'EuroCup',league_id:'dragons-ec-26',date:'2026-10-14',round:'Round 3',home:{code:'dd-tofas',name:'Tofas Bursa',key:'eurocup|BUR'},away:{code:'dd-bud',name:'Buducnost VOLI Podgorica'},hs:90,as:85,played:true,venue:'TOFAS SPOR SALONU'},
 {comp:'eurocup',compName:'EuroCup',league_id:'dragons-ec-26',date:'2026-10-14',round:'Round 3',home:{code:'dd-burgos',name:'Recoletas Salud San Pablo Burgos'},away:{code:'dd-hapoel',name:'Hapoel Midtown Jerusalem'},hs:84,as:85,played:true,venue:'COLISEUM BURGOS'}
];
const raw={leagues:[{meta:{id:'eurocup'},teams:[{code:'BUR',name:'Historical Burgos'}],players:[]}],notes:{private:'Preserve this note'}};
const before=JSON.stringify(raw),feed={fixtures:structuredClone(fixtures),leagues:[]};
window.EuroScoutDragons.connectData(raw,feed);
assert.equal(feed.fixtures[0].home.key,'bcl|TOF');assert.equal(feed.fixtures[1].home.key,'acb|BUR');assert.equal(JSON.stringify(raw),before);
const clubs=window.EUROSCOUT_EUROCUP_ROSTERS.teams.map(t=>({key:t.key,name:t.name}));clubs.push({key:'eurocup|BUR',name:'Recoletas Salud San Pablo Burgos'});
Object.assign(ctx,{STATE:{data:{season2627:{comps:{eurocup:{teams:clubs}}}}},allClubs:()=>clubs,clubByKey:k=>clubs.find(t=>t.key===k),canonKey:k=>k,dbTeamByKey:k=>clubs.find(t=>t.key===k),localStorage:{getItem:()=>null,setItem:()=>assert.fail('No private snapshot should be cached')},EuroScoutDragons:{active:()=>true,fixtures:()=>fixtures}});
Object.assign(window,{EuroScoutDragons:ctx.EuroScoutDragons,dispatchEvent(){},addEventListener(){}});
vm.runInContext(fs.readFileSync('euroscout-fixtures.js','utf8'),ctx);
const resolved=window.ESFixtures.all();assert.equal(resolved[0].home.key,'bcl|TOF','Current registrations supersede a stale Burgos key');assert.equal(resolved[0].home.name,'Tofas Bursa');assert.equal(resolved[1].home.key,'acb|BUR');assert.notEqual(resolved[0].home.key,resolved[1].home.key);assert.equal(resolved[0].hs,90);assert.equal(resolved[1].hs,84);
assert.equal(fixtures[0].home.key,'eurocup|BUR','Display resolution does not rewrite source fixtures');
const sessions=fs.readFileSync('euroscout-sessions.js','utf8');vm.runInContext(sessions.slice(sessions.indexOf('function roundLabel'),sessions.indexOf('function fmtDur')),ctx);
for(const value of [3,'3','R3','Round 3','round3'])assert.equal(ctx.roundLabel(value),'Round 3');
for(const value of ['Regular Season','Quarterfinals','Qualifying Round 1',''])assert.equal(ctx.roundLabel(value),value);
assert.equal(ctx.roundLabel(null),'');assert.doesNotMatch(sessions,/<span class="sx-hint">R' \+ esc\(g\.round\)/);
console.log('PASS reused BUR code: Tofas and Burgos stay distinct, stale keys corrected, source notes/history unchanged, round and stage labels formatted once.');
