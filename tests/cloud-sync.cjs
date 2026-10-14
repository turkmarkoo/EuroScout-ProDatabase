const assert=require('node:assert/strict');
const {create,reconcile}=require('../euroscout-cloud-sync.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const watchdog=setTimeout(()=>{throw Error('A sync test did not settle its save promise.');},10000);
const settle=async()=>{for(let i=0;i<8;i++)await tick();};
const initial={records:{p:{report:JSON.stringify({nOff:'Original offense',nDef:'Original defense',_workflow:{viewings:[{id:'September',event:'Keep history'}]}}),rating:3,hand:'Right'},other:{report:'Other player',watch:true}},appData:{sessions:{sessions:[{id:'old-game',note:'Keep game'}]},assignments:{p:'Original club'}}};
function setup(options={}){
 const rows=options.rows||new Map(),calls=[],status=[],clock={time:0,id:0,timers:new Map()};
 const timers={setTimeout:(fn,ms)=>{const id=++clock.id;clock.timers.set(id,{fn,at:clock.time+ms});return id;},clearTimeout:id=>clock.timers.delete(id)};
 const account=options.account||'owner-a',tab=options.tab||'tab-a';let remote=clone(options.remote||initial),applied;
 const journal={all:async()=>[...rows.values()].filter(r=>r.account===account).map(clone),put:async row=>{if(options.failLocal)throw Error('Disk unavailable');await options.beforePersist?.(row);rows.set(account+':'+tab,{...clone(row),account,tab,id:account+':'+tab});}};
 const sync=create({account,tab,initial:remote,journal,timers,now:()=>clock.time,random:()=>0,
  refreshCloud:async()=>clone(remote),saveCloud:async value=>{calls.push(clone(value));if(options.upload)await options.upload(value,calls.length);remote=clone(value);},
  applyLocal:value=>applied=value,onStatus:value=>status.push(value),...options.extra});
 return{sync,rows,calls,status,clock,get remote(){return remote;},set remote(v){remote=clone(v);},get applied(){return applied;},
  advance:async ms=>{clock.time+=ms;for(const[id,t]of [...clock.timers])if(t.at<=clock.time){clock.timers.delete(id);t.fn();}await settle();}};
}
(async()=>{
 // Rapid edits share one immutable upload. No part of the other player's record,
 // assignments, session history or manual bio is dropped.
 const rapid=setup();await rapid.sync.init();const promises=[];
 for(let i=0;i<30;i++){const next=clone(initial);next.records.p.rating=i;promises.push(rapid.sync.save(next));}
 await settle();assert.equal(rapid.calls.length,0);await rapid.advance(1200);assert.equal(rapid.calls.length,1);
 await Promise.all(promises);assert.equal(rapid.remote.records.p.rating,29);assert.deepEqual(rapid.remote.records.other,initial.records.other);assert.deepEqual(rapid.remote.appData,initial.appData);
 await rapid.sync.save(rapid.remote);await rapid.advance(20000);assert.equal(rapid.calls.length,1,'Unchanged saves have no cloud writes');
 // An upload acknowledgement must never clear an edit made while it was flying.
 let release;const slow=setup({upload:(_,n)=>n===1?new Promise(r=>release=r):Promise.resolve()});await slow.sync.init();
 const first=clone(initial);first.records.p.rating=4;const a=slow.sync.save(first);await settle();await slow.advance(1200);
 const second=clone(first);second.records.p.hand='Left';const b=slow.sync.save(second);await settle();await slow.advance(1000);
 assert.equal(slow.calls.length,1);release();await settle();await a;assert(slow.sync.dirty);assert.equal(slow.rows.get('owner-a:tab-a').local.records.p.hand,'Left');
 await slow.advance(9000);await b;assert.equal(slow.calls.length,2);assert.equal(slow.remote.records.p.hand,'Left');
 // Reload during a rejected write retains notes and retries the latest pending
 // version, with increasing delay. New typing cannot bypass that delay.
 let failing=true;const throttled=setup({upload:async()=>{if(failing){const e=Error('maximum bandwidth for writes');e.status=429;throw e;}}});await throttled.sync.init();
 const note=clone(initial);note.records.p.report=JSON.stringify({...JSON.parse(note.records.p.report),nOff:'Unsynced scouting note'});
 const c=throttled.sync.save(note);await settle();await throttled.advance(1200);assert.equal(await c,false);assert.equal(throttled.sync.state.kind,'retry');
 const reload=setup({rows:throttled.rows});await reload.sync.init();assert.equal(JSON.parse(reload.applied.records.p.report).nOff,'Unsynced scouting note');assert(reload.sync.dirty);
 const changed=clone(note);changed.records.p.rating=5;const d=throttled.sync.save(changed);await settle();await throttled.advance(1000);assert.equal(throttled.calls.length,1);
 await throttled.advance(9000);assert.equal(await d,false);assert.equal(throttled.calls.length,2);
 const delay=[...throttled.clock.timers.values()][0].at-throttled.clock.time;assert.equal(delay,20000);
 failing=false;await throttled.advance(19999);assert.equal(throttled.calls.length,2);await throttled.advance(1);assert.equal(throttled.calls.length,3);assert.equal(throttled.remote.records.p.rating,5);assert.equal(throttled.sync.state.kind,'synced');
 // Independent fields and independent report categories combine. Same-field
 // disagreements halt writes and both full copies remain recoverable.
 const independent=setup();await independent.sync.init();const mine=clone(initial);mine.records.p.hand='Left';mine.records.p.report=JSON.stringify({...JSON.parse(mine.records.p.report),nOff:'My offense'});
 const theirs=clone(initial);theirs.records.p.rating=5;theirs.records.p.report=JSON.stringify({...JSON.parse(theirs.records.p.report),nDef:'Their defense'});independent.remote=theirs;
 const e=independent.sync.save(mine);await settle();await independent.advance(1200);await e;
 assert.equal(independent.remote.records.p.rating,5);assert.equal(independent.remote.records.p.hand,'Left');assert.equal(JSON.parse(independent.remote.records.p.report).nDef,'Their defense');
 const conflict=setup();await conflict.sync.init();const ours=clone(initial);ours.records.p.rating=4;const other=clone(initial);other.records.p.rating=5;conflict.remote=other;
 const f=conflict.sync.save(ours);await settle();await conflict.advance(1200);assert.equal(await f,false);assert.equal(conflict.calls.length,0);assert.equal(conflict.sync.state.kind,'conflict');
 conflict.sync.retry();await conflict.advance(40000);assert.equal(conflict.calls.length,0,'Retry cannot bypass a conflict');
 const restarted=setup({rows:conflict.rows,remote:other});await restarted.sync.init();assert.equal(restarted.sync.state.kind,'conflict');await restarted.sync.resolve('remote');assert.equal(restarted.sync.local.records.p.rating,5);
 assert((await restarted.sync.backup()).journals[0].recovery.some(r=>r.reason==='Conflict review'&&r.local.records.p.rating===4));
 await conflict.sync.resolve('local');await conflict.advance(1200);assert.equal(conflict.remote.records.p.rating,4);assert.deepEqual(conflict.remote.records.other,initial.records.other);
 // A server commit whose response was lost is detected on refresh; the same
 // snapshot is not uploaded twice and the pending copy can be acknowledged.
 const uncertain=setup({upload:async value=>{uncertain.remote=value;throw Error('Connection closed after commit');}});await uncertain.sync.init();const g=uncertain.sync.save(ours);await settle();await uncertain.advance(1200);assert.equal(await g,false);await uncertain.advance(10000);assert.equal(uncertain.calls.length,1);assert.equal(uncertain.sync.state.kind,'synced');
 // Pre-update bytes and another closed tab's pending edits remain recoverable;
 // another signed-in account cannot see or upload their journal.
 const legacy=setup();await legacy.sync.init(ours);assert.equal((await legacy.sync.backup()).journals[0].recovery[0].value.records.p.rating,4);
 await legacy.sync.restoreLegacy(0);assert.equal(legacy.sync.state.kind,'conflict');await legacy.sync.resolve('local');await legacy.advance(1200);assert.equal(legacy.remote.records.p.rating,4);
 const otherTab=setup({rows:throttled.rows,tab:'new-tab'});await otherTab.sync.init();assert((await otherTab.sync.backup()).journals.some(r=>r.tab==='tab-a'));
 const isolated=setup({rows:throttled.rows,account:'owner-b'});await isolated.sync.init();assert((await isolated.sync.backup()).journals.every(r=>r.account==='owner-b'));
 const closed=setup();await closed.sync.init();closed.sync.save(ours);await settle();const recover=setup({rows:closed.rows,tab:'reopened'});await recover.sync.init();await recover.sync.recover('owner-a:tab-a');await recover.advance(1200);assert.equal(recover.remote.records.p.rating,4);
 const disk=setup({failLocal:true});await assert.rejects(()=>disk.sync.init(),/Disk unavailable/);
 const sessionsBase={sessions:[{id:'one',note:'Old'}]},sessionsLocal={sessions:[{id:'one',note:'Old'},{id:'two',note:'Local'}]},sessionsRemote={sessions:[{id:'one',note:'Old'},{id:'three',note:'Remote'}]};
 assert.equal(reconcile(sessionsBase,sessionsLocal,sessionsRemote).value.sessions.length,3);
 assert(reconcile({p:{rating:3}},{},{p:{rating:5}}).conflicts.length,'Delete versus change requires review');
 // A new keystroke can arrive while the merged snapshot is being protected.
 // Its captured, older view must not undo the unrelated remote update.
 let unblock,hold=false;const race=setup({beforePersist:async row=>{if(hold&&row.local.records.other.report==='Remote update'){hold=false;await new Promise(r=>unblock=r);}}});await race.sync.init();
 const r1=clone(initial);r1.records.p.rating=4;const r2=clone(r1);r2.records.p.hand='Left';race.remote={...clone(initial),records:{...clone(initial.records),other:{report:'Remote update'}}};
 const h=race.sync.save(r1);await settle();hold=true;await race.advance(1200);assert(unblock);const i=race.sync.save(r2);await settle();unblock();await settle();await h;await race.advance(10000);await i;assert.equal(race.remote.records.other.report,'Remote update');assert.equal(race.remote.records.p.hand,'Left');
 const undo=setup();await undo.sync.init();await undo.sync.save(r1,false);await undo.sync.save(initial,false);await undo.advance(1200);assert.equal(undo.calls.length,0,'A deliberate undo before upload returns to the known cloud baseline');
 // Undo during an upload must remain pending until the old write can no longer
 // arrive later. Reload either before or after that old commit keeps the undo.
 let finishFlight;const undoFlight=setup({upload:(_,n)=>n===1?new Promise(r=>finishFlight=r):Promise.resolve()});await undoFlight.sync.init();const firstFlight=undoFlight.sync.save(r1);await settle();await undoFlight.advance(1200);await undoFlight.sync.save(initial,false);
 assert(undoFlight.rows.get('owner-a:tab-a').dirty,'A revert during an unconfirmed upload is not already cloud-saved');
 const beforeCommit=setup({rows:undoFlight.rows});await beforeCommit.sync.init();assert.equal(beforeCommit.sync.local.records.p.rating,3);assert(beforeCommit.sync.dirty);
 const afterCommit=setup({rows:undoFlight.rows,remote:r1});await afterCommit.sync.init();assert.equal(afterCommit.sync.local.records.p.rating,3);assert(afterCommit.sync.dirty);
 let forced=false;const safeBarrier=setup({rows:new Map([...beforeCommit.rows].map(([k,v])=>[k,clone(v)])),extra:{saveCloud:async(_,o)=>{forced=o.force;}}});await safeBarrier.sync.init();await safeBarrier.advance(12000);assert(forced,'A conditional replacement closes the uncertain old-write window');
 finishFlight();await settle();await firstFlight;await undoFlight.advance(10000);assert.equal(undoFlight.remote.records.p.rating,3,'The latest explicit undo replaces the completed older upload');
 const revertWait=setup();await revertWait.sync.init();const earlier=revertWait.sync.save(r1);await settle();await revertWait.sync.save(initial,false);assert.equal(await earlier,true,'Superseded waiters settle when the latest edit returns to the cloud baseline');
 console.log('PASS: coalescing, unchanged-write suppression, stale acknowledgements, bandwidth backoff, reload recovery, independent changes, conflicting values, uncertain commits, legacy recovery, closed tabs, account isolation, local write failures and stable-ID session merging.');
 clearTimeout(watchdog);
})().catch(error=>{clearTimeout(watchdog);console.error(error);process.exitCode=1;});
