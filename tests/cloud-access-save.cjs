const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const text=fs.readFileSync(require('node:path').join(__dirname,'../euroscout-access.js'),'utf8');
const source=text.slice(text.indexOf('function saveState(next,'),text.indexOf('\nasync function authenticate'));
function setup(){const writes=[],heads=[],initial={schema:1,records:{p:{report:'Old note'}},appData:{sessions:['Keep']},seeds:{fixture:true},core:{fixture:true}},api={owner:true,state:initial};
 const context={api,seedSnapshot:'existing-seed',saveQueue:Promise.resolve(),version:'previous-version',crypto:{randomUUID:()=>String(writes.length+1)},writePayload:async(root,id,value)=>writes.push({root,id,value}),commit:async(path,value,condition)=>{heads.push({path,value,condition});return{json:async()=>({writeResults:[{updateTime:'confirmed-version'}]})};},get:()=>{throw Error('Save confirmation must not require a second head read');}};
 vm.createContext(context);vm.runInContext(source,context);return{context,writes,heads,api};}
(async()=>{const f=setup();await f.context.saveState(f.api.state);assert.equal(f.writes.length,0);
 const next={...f.api.state,records:{p:{report:'New note'}}};await f.context.saveState(next);
 assert.equal(f.writes.length,1);assert.equal(f.heads.length,1);assert.equal(f.heads[0].condition.updateTime,'previous-version');assert.equal(f.context.version,'confirmed-version');assert.equal(f.writes[0].value.seedSnapshot,'existing-seed');assert(!('seeds'in f.writes[0].value)&&!('core'in f.writes[0].value));assert.equal(f.api.state.records.p.report,'New note');
 f.api.owner=false;await assert.rejects(()=>f.context.saveState({...next,records:{}}),e=>e.status===403);assert.equal(f.writes.length,1);
 const race=setup();race.context.commit=async()=>{const error=Error('FAILED_PRECONDITION');error.status=409;throw error;};await assert.rejects(()=>race.context.saveState(next),e=>e.status===409);assert.equal(race.api.state.records.p.report,'Old note');assert.equal(race.context.version,'previous-version');
 const ambiguous=setup();ambiguous.context.commit=async()=>({json:async()=>({})});await assert.rejects(()=>ambiguous.context.saveState(next),/confirmation unavailable/);assert.equal(ambiguous.context.version,'previous-version');
 const barrier=setup();await barrier.context.saveState(barrier.api.state,{force:true});assert.equal(barrier.writes.length,1,'An uncertain in-flight undo can establish a new conditional cloud head even if its data equals the previous baseline');
 console.log('PASS cloud access: unchanged states skip writes; full schema-1 snapshots retain seed reference; head precondition and commit response protect versions; denied and unconfirmed writes do not acknowledge data.');
})().catch(e=>{console.error(e);process.exitCode=1;});
