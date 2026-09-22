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
let serial=0;
const context={
  console,structuredClone,crypto:{randomUUID:()=>`merge-${++serial}`},Date,Set,Map,JSON,
  localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
  document:{getElementById:()=>({}),querySelectorAll:()=>[]},
  Store:{canEdit:()=>true,get:id=>records.get(id)||{report:'{}'},save:async(id,value)=>{records.set(id,value);return true;},pushAppKey:async()=>true,user:{email:'admin@example.test'}},
  STATE:{view:'other',_extraDone:true},allPlayersEvery:()=>rows,gid:player=>context.window.EuroScoutMergeCenter?.canonicalPlayer([player.id])||player.id,
  photoOf:()=>'',allClubs:()=>[],agentList:()=>[],assignPool:()=>[],agencyForAgent:()=>'',clubLogo:()=>'',
  player:id=>rows.find(row=>row.id===id),window:{confirm:()=>true},Sync:{stampKey:()=>{}},toast:()=>{},
  ovrLocal:()=>JSON.parse(local.get('euroscout:overrides')||'{"links":[],"bio":{},"ext":{}}'),
  ovrMerged:()=>JSON.parse(local.get('euroscout:overrides')||'{"links":[],"bio":{},"ext":{}}'),
  rebuildLinks:()=>{},applyOverrides:()=>{},OVR:{},goView:()=>{}
};
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

(async()=>{
  await api.autoMergeBatch(api.automaticPlan());
  await api.autoMergeBatch(api.automaticPlan());
  const survivor=api.canonicalPlayer(['a','b','c']);
  assert(survivor);
  assert.equal(api.canonicalPlayer(['a']),survivor);
  assert.equal(api.canonicalPlayer(['b']),survivor);
  assert.equal(api.canonicalPlayer(['c']),survivor);
  const saved=records.get(survivor);
  assert(saved.report.includes('First note')&&saved.report.includes('Second note')&&saved.report.includes('Third note'));
  assert.equal(saved.watch,true);
  assert(!api.automaticPlan().some(item=>['d','e','f','g'].includes(item.source)));
  console.log('Automatic duplicate grouping, conflicts, notes, and chained identity checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
