const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rows = [
  {id:'a',name:'Aatu Kivimäki',born:1997,country:'Finland',height:186,role:'Guard',teamName:'Patrioti Levice'},
  {id:'b',name:'Aatu Kivimaki',born:null,country:'Finland',height:186,role:'Guard',teamName:'Patrioti Levice'},
  {id:'c',name:'Aatu Kivimaki',born:1997,country:'Finland',height:186,role:'Guard',teamName:'Patrioti Levice'},
  {id:'d',name:'Common Name',born:2000,country:'Serbia',height:200,role:'Forward',teamName:'Club A'},
  {id:'e',name:'Common Name',born:2001,country:'Serbia',height:200,role:'Forward',teamName:'Club B'},
  {id:'f',name:'No Birth',born:null,country:'USA',height:190,role:'Guard',teamName:'Club C'},
  {id:'g',name:'No Birth',born:null,country:'USA',height:190,role:'Guard',teamName:'Club D'},
  {id:'h',name:'Shared Profile',born:null,country:'USA',height:null,role:'Guard',_ext:'12345'},
  {id:'i',name:'Shared Profile',born:null,country:'USA',height:null,role:'Guard',_ext:'12345'}
];
const local = new Map(),records = new Map([
  ['a',{report:JSON.stringify({nOff:'First note'}),rating:1,watch:false}],
  ['b',{report:JSON.stringify({nDef:'Second note'}),rating:3,watch:true}],
  ['c',{report:JSON.stringify({nIntel:'Third note'}),rating:2,watch:false}]
]);
let serial=0,bulkCalls=0;
const context={
  console,structuredClone,crypto:{randomUUID:()=>`merge-${++serial}`},Date,Set,Map,JSON,
  localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
  document:{getElementById:()=>({}),querySelectorAll:()=>[]},
  Store:{canEdit:()=>true,get:id=>records.get(id)||{report:'{}'},save:async(id,value)=>{records.set(id,value);return true;},bulkSet:async items=>{bulkCalls++;items.forEach(({id,rec})=>records.set(id,rec));return items.length;},pushAppKey:async()=>true,user:{email:'admin@example.test'}},
  STATE:{view:'other',_extraDone:true},allPlayersEvery:()=>rows,gid:player=>context.window.EuroScoutMergeCenter?.canonicalPlayer([player.id])||player.id,
  photoOf:()=>'',allClubs:()=>[],agentList:()=>[],assignPool:()=>[],agencyForAgent:()=>'',clubLogo:()=>'',
  player:id=>rows.find(row=>row.id===id),window:{confirm:()=>true},Sync:{stampKey:()=>{}},toast:()=>{},
  ovrLocal:()=>JSON.parse(local.get('euroscout:overrides')||'{"links":[],"bio":{},"ext":{}}'),
  ovrMerged:()=>JSON.parse(local.get('euroscout:overrides')||'{"links":[],"bio":{},"ext":{}}'),
  rebuildLinks:()=>{},applyOverrides:()=>{},OVR:{},goView:()=>{}
};
context.window.ESRecordMerge=require('../euroscout-record-merge.js');context.ESRecordMerge=context.window.ESRecordMerge;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../euroscout-merge-center.js'),'utf8'),context);
const api=context.window.EuroScoutMergeCenter;
const first=api.detect().player;
assert.equal(first.find(pair=>pair.id==='player:a|b').score,77);
const entity=row=>({...row,position:row.role,team:row.teamName,external:row._ext,player:row});
assert.equal(api.automaticPlayerMatch(entity(rows[0]),entity(rows[1])),true);
assert.equal(api.automaticPlayerMatch(
  entity({id:'ak1',name:'Akili Vining',born:1999,country:'USA',height:188,role:'Guard',teamName:'Hapoel Beer Sheva'}),
  entity({id:'ak2',name:'Akili Vining',born:null,country:'USA',height:188,role:'Guard',teamName:'Sloboda Tuzla'})
),true);
assert.equal(api.automaticPlayerMatch(entity(rows[3]),entity(rows[4])),false);
assert.equal(api.automaticPlayerMatch(entity(rows[5]),entity(rows[6])),false);
assert.equal(api.automaticPlayerMatch(entity(rows[7]),entity(rows[8])),true);
assert.equal(api.playerConfidence(
  {name:'Conflicting Profiles',external:'111',fiba:'same'},
  {name:'Conflicting Profiles',external:'222',fiba:'same'}
),0);
assert(api.automaticPlan(first).some(item=>item.candidate.id==='player:a|b'||item.candidate.id==='player:a|c'||item.candidate.id==='player:b|c'));
local.set('euroscout:mergeCenter:v1',JSON.stringify({merges:[],reviewed:{'player:a|b':'dismissed'},autoSkipped:{}}));
assert(!api.automaticPlan(first).some(item=>['a','b'].includes(item.source)||['a','b'].includes(item.survivor)));
local.delete('euroscout:mergeCenter:v1');

const bioContext={window:{}};vm.createContext(bioContext);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../euroscout-identity-bio.js'),'utf8'),bioContext);
const bioRows=[{_nbaId:'1642045',name:'Devon Higgs',born:null},{_nbaId:'1642045',name:'Other Person',born:null},{_nbaId:'1642045',name:'Devon Higgs',born:2002},{_nbaId:'1642045',name:'Devon Higgs',birthDate:'2000-01-01'}];bioContext.window.EuroScoutIdentityBio.apply({leagues:[{players:bioRows}]});assert.equal(bioRows[0].born,2000);assert.equal(bioRows[0].birthDate,'2000-02-10');assert.equal(bioRows[1].born,null);assert.equal(bioRows[2].born,2002);assert.equal(bioRows[3].birthDate,'2000-01-01');
const bio={born:1998,country:'USA',height:190,position:'Guard'};
assert.equal(api.automaticPlayerMatch({id:'m1',name:'Alex John Smith',...bio},{id:'m2',name:'Alex James Smith',...bio}),false);
assert.equal(api.automaticPlayerMatch({id:'d1',name:'Alex Smith',birthDate:'1998-01-01',...bio},{id:'d2',name:'Alex Smith',birthDate:'1998-09-01',...bio}),false);
assert.equal(api.automaticPlayerMatch({id:'r1',name:'Alex Smith',player:{_rgm:'https://basketball.realgm.com/player/Alex-Smith/Summary/123'}},{id:'r2',name:'Alex Smith',player:{profile_url:'https://basketball.realgm.com/player/Alex-Smith/Summary/123'}}),true);
assert.equal(api.automaticPlayerMatch({id:'r1',name:'Alex Smith',player:{realgmId:'123'},...bio},{id:'r2',name:'Alex Smith',player:{realgmId:'456'},...bio}),false);
assert.equal(api.playerConfidence({name:'Alex Smith',player:{realgmId:'123'},...bio},{name:'Alex Smith',player:{realgmId:'456'},...bio}),0,'conflicting provider identities must not be offered as obvious duplicates');
assert.equal(api.automaticPlayerMatch({id:'r1',name:'Alex Smith',height:188,player:{realgmId:'123'}},{id:'r2',name:'Alex Smith',height:196,player:{realgmId:'123'}}),true,'verified shared identities tolerate source height differences');
assert.equal(api.automaticPlayerMatch({id:'r1',name:'Alex Smith',...bio,height:188},{id:'r2',name:'Alex Smith',...bio,height:210}),false);
assert.equal(api.automaticPlayerMatch({id:'r1',name:'Alex Smith',player:{_grp:[{realgmId:'123'},{realgmId:'456'}]},...bio},{id:'r2',name:'Alex Smith',player:{realgmId:'123'},...bio}),false);
assert.equal(api.automaticPlayerMatch({id:'f1',name:'Amin Adamu',fiba:'https://www.fiba.basketball/en/players/236706-amin-adamu'},{id:'f2',name:'Amin Adamu',fiba:'https://www.fiba.basketball/es/history/212/event/players/236706-amin-adamu'}),true,'FIBA language and event paths share the numeric person ID');
assert.equal(api.automaticPlayerMatch({id:'f1',name:'Amin Adamu',fiba:'https://www.fiba.basketball/en/players/236706-amin-adamu\nhttps://www.fiba.basketball/en/players/999999-amin-adamu'},{id:'f2',name:'Amin Adamu',fiba:'https://www.fiba.basketball/en/players/236706-amin-adamu'}),false);
assert.equal(api.playerConfidence({name:'Shared ID',born:1997,external:'12345'},{name:'Shared ID',born:2001,external:'12345'}),0);
const evidence=bioContext.window.EuroScoutIdentityBio;
assert.equal(evidence.resolve({name:'Kameron Hobbs',realgmId:'138860'}).birthDate,'2002-06-30');
assert.equal(evidence.resolve({name:'Other Person',realgmId:'138860'}),null);
assert.equal(evidence.resolve({name:'Kameron Hobbs',realgmId:'138860',born:2001}),null);
assert.equal(evidence.resolve({name:'Kameron Hobbs',realgmId:'138860',birthdate:'2001-06-30'}),null);
assert.equal(evidence.resolve({id:'eurocup-014096',name:'Amin Adamu'}).realgmId,'120144');
assert.equal(evidence.resolve({id:'someone-else',name:'Amin Adamu'}),null,'names alone must not attach verified identities');
assert.equal(evidence.resolve({name:'Curtis Jones',_nbaId:'1642938'}).birthDate,'2001-10-04');
assert.equal(evidence.resolve({name:'Curtis Jones',realgmId:'85951'}).birthDate,'1997-01-28');
bioContext.window.EUROSCOUT_REALGM_REPRESENTATION={records:[{name:'Source Person',names:['Source Person'],born:1999,ids:['source-person'],playerURLs:['https://basketball.realgm.com/player/Source-Person/Summary/98765'],representatives:[{birth:'Apr 5, 1999',checked:'2026-09-07'}]},{name:'Conflict Person',born:2000,identityConflict:true,ids:['conflict-person'],playerURLs:['https://basketball.realgm.com/player/Conflict-Person/Summary/98766'],representatives:[{birth:'Apr 5, 2000'}]}]};
assert.equal(evidence.resolve({id:'source-person',name:'Source Person'}).birthDate,'1999-04-05');
assert.equal(evidence.resolve({id:'conflict-person',name:'Conflict Person'}),null);
const originalPlayer=context.player,aliasHead={id:'alias-head',name:'Alias Player',height:null,born:null,country:'',role:'',pos:''};aliasHead._grp=[aliasHead,{id:'alias-bio',name:'Alias Player',height:208,born:1998,country:'United States',role:'Big'}];context.player=id=>id==='alias-head'?aliasHead:originalPlayer(id);
assert.equal(api.canonicalPlayerEntity('alias-head').height,208,'an empty canonical statistics row must not hide its alias bio');
assert.equal(api.canonicalPlayerEntity('alias-head').born,1998);
context.personBio=()=>({height:'',born:'',country:'',role:''});
const manuallyEmpty=api.canonicalPlayerEntity('alias-head');assert.equal(manuallyEmpty.height,'');assert.equal(manuallyEmpty.born,'');assert.equal(manuallyEmpty.country,'');assert.equal(manuallyEmpty.position,'');delete context.personBio;context.player=originalPlayer;
const bridgeA={id:'bridge-a',name:'Unique Person',...bio,born:1998},bridgeB={id:'bridge-b',name:'Unique Person',...bio,born:''},bridgeC={id:'bridge-c',name:'Unique Person',...bio,born:2001};
const bridgePlan=api.automaticPlan([{id:'player:bridge-a|bridge-b',a:bridgeA,b:bridgeB,score:90},{id:'player:bridge-b|bridge-c',a:bridgeB,b:bridgeC,score:80}]);
assert.equal(bridgePlan.length,1,'an unknown birth year must not bridge contradictory known identities');
context.STATE.data={leagues:[{meta:{id:'test'},players:rows}]};api.detect(false,'player');
rows.push({id:'late-a',name:'Late Loaded Person',born:2000,country:'USA',height:190,role:'Guard'},{id:'late-b',name:'Late Loaded Person',born:null,country:'USA',height:190,role:'Guard'});
assert.ok(api.detect(false,'player').player.some(c=>c.a.name==='Late Loaded Person'),'loaded players invalidate the cached queue');
const report=JSON.parse(api._test.mergeReport(JSON.stringify({_notesUpdated:'2026-10-06T10:00:00Z',_history:[{id:'a',savedAt:'2026-10-06'}]}),JSON.stringify({_notesUpdated:'2026-10-07T10:00:00Z',_history:[{id:'b',savedAt:'2026-10-07'}]}),{reports:true,notes:true,timeline:true}));
assert.equal(report._notesUpdated,'2026-10-07T10:00:00Z');assert.deepEqual(report._history.map(x=>x.id),['a','b']);

(async()=>{
  await api.autoMergeBatch(api.automaticPlan());
  await api.autoMergeBatch(api.automaticPlan());
  assert.ok(bulkCalls>0&&bulkCalls<=2,'records are written once per batch');
  const survivor=api.canonicalPlayer(['a','b','c']);
  assert(survivor);
  assert.equal(api.canonicalPlayer(['a']),survivor);
  assert.equal(api.canonicalPlayer(['b']),survivor);
  assert.equal(api.canonicalPlayer(['c']),survivor);
  const saved=records.get(survivor);
  assert(saved.report.includes('First note')&&saved.report.includes('Second note')&&saved.report.includes('Third note'));
  assert.equal(saved.watch,true);
  assert(!api.automaticPlan().some(item=>['d','e','f','g'].includes(item.source)));
  const mergedState=JSON.parse(local.get('euroscout:mergeCenter:v1')),batch=mergedState.batches[0],entry=mergedState.merges.find(m=>m.batchId===batch.id);
  const laterSessions=JSON.stringify({sessions:[{id:'original'},{id:'later-session'}]});local.set('euroscout:sessions:v1',laterSessions);records.set('unrelated',{report:JSON.stringify({nOff:'Newer unrelated work'})});
  await api.undo(entry.id);assert.equal(local.get('euroscout:sessions:v1'),laterSessions);assert.equal(JSON.parse(records.get('unrelated').report).nOff,'Newer unrelated work');assert.equal(records.get(survivor).report,JSON.stringify({nOff:'First note'}));assert.equal(api.canonicalPlayer(['b']),null);
  assert.ok(!api.automaticPlan().some(x=>['a','b','c'].includes(x.source)),'an undone batch must not be silently reapplied');
  records.set('chain-source',{report:JSON.stringify({nOff:'Source chain note'}),rating:5,board:'Synthetic recruitment board'});records.set('chain-middle',{report:JSON.stringify({nOff:'Middle chain note'}),watch:true,jerseyNumbers:{club:'24'}});records.set('chain-final',{report:JSON.stringify({nOff:'Final chain note'})});
  const chainBefore=JSON.stringify(records.get('chain-source'));await api.autoMergeBatch([{candidate:{id:'player:chain-middle|chain-source'},survivor:'chain-middle',source:'chain-source'},{candidate:{id:'player:chain-final|chain-middle'},survivor:'chain-final',source:'chain-middle'}]);
  const chain=records.get('chain-final');assert.ok(['Source chain note','Middle chain note','Final chain note'].every(n=>chain.report.includes(n)));assert.equal(chain.rating,5);assert.equal(chain.board,'Synthetic recruitment board');assert.ok(chain.watch);assert.equal(chain.jerseyNumbers.club,'24');assert.equal(api.canonicalPlayer(['chain-source']),'chain-final');assert.equal(JSON.stringify(records.get('chain-source')),chainBefore);
  const chainBatch=JSON.parse(local.get('euroscout:mergeCenter:v1')).batches.at(-1);await api.undo(JSON.parse(local.get('euroscout:mergeCenter:v1')).merges.find(m=>m.batchId===chainBatch.id).id);assert.equal(records.get('chain-final').report,JSON.stringify({nOff:'Final chain note'}));assert.equal(JSON.stringify(records.get('chain-source')),chainBefore);
  const snapshot=local.get('euroscout:mergeCenter:v1'),overrides=local.get('euroscout:overrides'),before=JSON.stringify(records.get('a'));context.Store.pushAppKey=async()=>false;
  await assert.rejects(api.autoMergeBatch([{candidate:{id:'player:a|b',type:'player',a:entity(rows[0]),b:entity(rows[1])},survivor:'a',source:'b'}]),/could not be saved/);
  assert.equal(local.get('euroscout:mergeCenter:v1'),snapshot);assert.equal(local.get('euroscout:overrides'),overrides);assert.equal(JSON.stringify(records.get('a')),before);assert.equal(local.get('euroscout:sessions:v1'),laterSessions);
  // A batch can finish its durable save after the scout starts typing. Its
  // identity index must wait; the merged notes remain protected meanwhile.
  let busy=false,rebuilds=0;const timers=[];context.setTimeout=fn=>{timers.push(fn);return timers.length;};context.clearTimeout=()=>{};context.rebuildLinks=()=>{rebuilds++;};context.window.ESMatchupBusy=()=>busy;context.Store.pushAppKey=async(key,options)=>{assert.equal(options.waitForCloud,false);return true;};const bulk=context.Store.bulkSet;context.Store.bulkSet=async items=>{const result=await bulk(items);busy=true;return result;};
  records.set('idle-source',{report:JSON.stringify({nOff:'Source note stays safe'})});records.set('idle-target',{report:JSON.stringify({nDef:'Target note stays safe'})});
  await api.autoMergeBatch([{candidate:{id:'player:idle-source|idle-target'},survivor:'idle-target',source:'idle-source'}]);assert.equal(rebuilds,0);assert.equal(timers.length,1);assert(records.get('idle-target').report.includes('Source note stays safe'));assert(records.get('idle-target').report.includes('Target note stays safe'));
  busy=false;timers.shift()();assert.equal(rebuilds,1,'deferred catalogue refresh runs once when scouting is idle');
  console.log('PASS automatic identity matching, cache refresh, hard conflicts, note dates, revisions, additive merge, undo and save-failure rollback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
