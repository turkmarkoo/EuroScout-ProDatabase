/* Local-first private sync. Cloud snapshots stay schema 1 for existing readers.
   Pending edits and recovery copies belong to a verified account and browser tab. */
(function(root){'use strict';
const copy=v=>v===undefined?undefined:typeof root.structuredClone==='function'?root.structuredClone(v):JSON.parse(JSON.stringify(v));
const equal=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const data=s=>({records:copy(s.records||{}),appData:copy(s.appData||{})});
const NOTE_FIELDS=new Set(['nStrengths','nImprove','nAth','nOff','nDef','nIntel','nProj','nRecommend','overall']);
function appendedNotes(base,local,remote){
 if(base!==undefined&&typeof base!=='string'||typeof local!=='string'||typeof remote!=='string')return;
 const lines=s=>String(s||'').split(/\r?\n/).filter(s=>s.trim()),b=lines(base),l=lines(local),r=lines(remote);
 // Only combine additions. A changed/deleted/reordered existing observation
 // still requires review; timestamps never decide which scouting text wins.
 if(![l,r].every(a=>b.every((s,i)=>a[i]===s)))return;
 const out=[...b];for(const line of [...r.slice(b.length),...l.slice(b.length)])if(!out.includes(line))out.push(line);
 return out.join('\n');
}
function merge(base,local,remote,choice,where=[],conflicts=[],flight,details=[]){
 const undone=flight!==undefined&&!equal(local,flight)&&equal(local,base);
 if(equal(local,base)&&(!undone||equal(remote,base)))return copy(remote);
 if(equal(remote,base)||equal(local,remote))return copy(local);
 if(undone&&equal(remote,flight))return copy(local);
 if(['updated_at','updatedAt','_notesUpdated'].includes(where.at(-1))&&typeof local==='string'&&typeof remote==='string'&&Number.isFinite(Date.parse(local))&&Number.isFinite(Date.parse(remote)))return Date.parse(local)>=Date.parse(remote)?local:remote;
 if(where.at(-2)==='report'&&NOTE_FIELDS.has(where.at(-1))){const added=appendedNotes(base,local,remote);if(added!==undefined)return added;}
 // Reports contain structured note categories and history inside a JSON string.
 if(where.at(-1)==='report'&&[base,local,remote].every(v=>typeof v==='string')){
  try{const values=[base,local,remote].map(JSON.parse),prior=typeof flight==='string'?JSON.parse(flight):undefined;if(values.every(object))return JSON.stringify(merge(...values,choice,where,conflicts,prior,details));}catch{}
 }
 if(object(local)&&object(remote)&&(object(base)||base===undefined)){
  const out={};for(const k of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
   const value=merge(base?.[k],local[k],remote[k],choice,[...where,k],conflicts,flight?.[k],details);if(value!==undefined)out[k]=value;
  }return out;
 }
 // Independently added sessions/history entries can coexist. Never guess order or
 // merge conflicting text, ratings, deletions, or arrays without stable entry IDs.
 if([base,local,remote].every(Array.isArray)&&[base,local,remote].every(a=>a.every(v=>object(v)&&typeof v.id==='string')&&new Set(a.map(v=>v.id)).size===a.length)){
  const maps=[base,local,remote].map(a=>Object.fromEntries(a.map(v=>[v.id,v]))),prior=Array.isArray(flight)?Object.fromEntries(flight.map(v=>[v.id,v])):undefined,out=merge(...maps,choice,where,conflicts,prior,details);
  return [...new Set([...remote,...local].map(v=>v.id))].filter(id=>out[id]!==undefined).map(id=>out[id]);
 }
 if(where.at(-1)==='_history'&&[base,local,remote].every(Array.isArray)&&[local,remote].every(a=>base.every((v,i)=>equal(v,a[i])))){
  const out=copy(base);for(const item of [...remote.slice(base.length),...local.slice(base.length)])if(!out.some(v=>equal(v,item)))out.push(copy(item));return out;
 }
 conflicts.push(where.join('.'));details.push({path:[...where],base:copy(base),local:copy(local),remote:copy(remote)});return copy(choice==='remote'?remote:local);
}
function reconcile(base,local,remote,choice,flight){const conflicts=[],details=[];return{value:merge(base,local,remote,choice,[],conflicts,flight,details),conflicts,details};}
async function tabId(account){
 let candidate;try{candidate=root.sessionStorage.getItem('euroscout:cloud-tab:v1');}catch{}
 candidate=candidate||root.crypto.randomUUID();
 // Duplicating a browser tab copies sessionStorage. An active-document lock
 // prevents both copies from overwriting the same recovery journal.
 if(root.navigator?.locks){
  const claim=id=>new Promise((resolve,reject)=>root.navigator.locks.request('euroscout-tab:'+account+':'+id,{ifAvailable:true},async lock=>{
   resolve(!!lock);if(lock)await new Promise(()=>{}); // Released when this document is destroyed.
  }).catch(reject));
  while(!await claim(candidate))candidate=root.crypto.randomUUID();
 }
 try{root.sessionStorage.setItem('euroscout:cloud-tab:v1',candidate);}catch{}
 return candidate;
}
function journal(account,tab){
 const fallback='euroscout:cloud-outbox:v1:'+account+':'+tab;
 let db,fallbackOnly=false;const issues=[];const ready=new Promise(resolve=>{
  if(!root.indexedDB)return resolve();const r=root.indexedDB.open('euroscout-cloud-outbox',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('journals',{keyPath:'id'});
  r.onerror=r.onblocked=()=>{fallbackOnly=true;resolve();};r.onsuccess=()=>{if(fallbackOnly){r.result.close();return;}db=r.result;resolve();};
 });
 async function all(){await ready;const saved=[],keys=new Set(root.ESStorage?.usage?.().map(r=>r.key)||[]);for(let i=0;i<root.localStorage.length;i++)keys.add(root.localStorage.key(i));
  issues.length=0;
  for(const k of keys)if(k?.startsWith('euroscout:cloud-outbox:v1:'+account+':')){
   const raw=root.localStorage.getItem(k);if(raw==null)continue; // Overflow tombstones are removed entries, not journals.
   try{const row=JSON.parse(raw);if(row==null)continue;if(!object(row)||row.account!==account||typeof row.id!=='string'||typeof row.tab!=='string')throw Error('Invalid recovery entry');saved.push(row);}
   catch(error){issues.push({key:k,message:error.message,raw});} // Preserve unreadable bytes in the private export.
  }
  if(db)saved.push(...await new Promise((resolve,reject)=>{const t=db.transaction('journals'),r=t.objectStore('journals').getAll();r.onsuccess=()=>resolve(r.result.filter(v=>v.account===account));r.onerror=()=>reject(r.error);}));
  const latest=new Map();for(const row of saved){if(!row||row.account!==account||typeof row.id!=='string')continue;const old=latest.get(row.id);if(!old||row.at>old.at||row.at===old.at&&row.revision>=old.revision)latest.set(row.id,row);}return [...latest.values()];}
 async function put(value){await ready;const row={...value,id:account+':'+tab,account,tab};if(!db){root.localStorage.setItem(fallback,JSON.stringify(row));await root.ESStorage?.flush();return;}
  await new Promise((resolve,reject)=>{const t=db.transaction('journals','readwrite');t.objectStore('journals').put(row);t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>reject(t.error||Error('Could not protect pending edits on this device.'));});}
 return{all,put,get issues(){return copy(issues);}};
}
function create(options){
 const timers=options.timers||root,now=options.now||Date.now,random=options.random||Math.random;
 const storage=options.journal||journal(options.account,options.tab);
 let base=data(options.initial),local=copy(base),front=copy(base),flight,row,revision=0,queue=Promise.resolve(),timer,inflight=false,dirty=false,blocked=false,failures=0,nextAttempt=0,lastStart=-Infinity,waiters=[];
 const MIN_INTERVAL=10000,DEBOUNCE=1200;
 let savingLocal=0,state={kind:'synced',message:'Saved to cloud'};
 const drafts=new Map(),draftPrefix='euroscout:cloud-outbox:v1:'+options.account+':typing:'+options.tab+':';let draftTimer=null;
 const draftKey=id=>draftPrefix+encodeURIComponent(id);
 function writeDraft(entry){root.localStorage.setItem(draftKey(entry.playerId),JSON.stringify(entry));}
 function storageError(error){blocked=true;status('storage-error','Local protection failed · keep this tab open and download a recovery copy');options.onError?.(error);}
 function status(kind,message){if(state.kind===kind&&state.message===message)return;state={kind,message};options.onStatus?.(state);}
 function schedule(){if(timer||inflight||blocked||!dirty)return;timer=timers.setTimeout(()=>{timer=null;run();},Math.max(DEBOUNCE,nextAttempt-now(),MIN_INTERVAL-(now()-lastStart)));}
 async function persist(){row={...row,base,local,flight,dirty,revision,failures,nextAttempt,lastStart:Number.isFinite(lastStart)?lastStart:null,at:now()};await storage.put(row);}
 function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 async function init(legacy,legacyPending=false){
  const rows=await storage.all(),own=rows.find(r=>r.tab===options.tab);
  row=own||{recovery:[]};
  if(own){failures=own.failures||0;nextAttempt=own.nextAttempt||0;lastStart=own.lastStart??-Infinity;flight=own.flight;}
  // Keep pre-update local bytes before any cloud hydration. They may be stale;
  // preserve them as a recovery copy rather than silently replacing cloud edits.
  if(legacy&&!equal(data(legacy),own?.local||base)&&(Object.keys(legacy.records||{}).length||Object.values(legacy.appData||{}).some(v=>v!=null))&&!(row.recovery||[]).some(r=>equal(r.value,data(legacy))))row.recovery=[...(row.recovery||[]),{reason:'Before cloud hydration',at:now(),value:data(legacy)}];
  if(own?.dirty){const result=reconcile(own.reviewBase||own.base,own.local,base,undefined,flight);local=result.value;blocked=result.conflicts.length>0;row.conflicts=result.conflicts;if(blocked)row.reviewBase=copy(own.reviewBase||own.base);dirty=!equal(local,base)||!!flight&&!equal(local,flight);}
  else if(legacy&&legacyPending){
   // A newly opened tab shares the browser cache, but not its predecessor's
   // tab ID. Reuse a proven, identical pending journal's baseline; comparing
   // that entire cache with an empty baseline manufactures false conflicts.
   const known=rows.filter(r=>r.dirty&&!r.tab.startsWith('typing:')&&equal(data(r.local||{}),data(legacy))).sort((a,b)=>b.at-a.at)[0];
   const prior=known?(known.reviewBase||known.base):{records:{},appData:{}};
   const result=reconcile(prior,data(legacy),base,undefined,known?.flight);local=result.value;blocked=result.conflicts.length>0;row.conflicts=result.conflicts;if(blocked)row.reviewBase=copy(prior);dirty=!equal(local,base);if(known)row.recoveredBaselineFrom=known.id;
  }
  // Small typing journals survive a reload even before a full snapshot is built.
  const typed=rows.filter(r=>r.tab?.startsWith('typing:'+options.tab+':')&&r.dirty);
  for(const draft of typed){const result=reconcile(draft.base,draft.local,local,undefined,draft.flight);local=result.value;
   if(result.conflicts.length){row.conflicts=[...(row.conflicts||[]),...result.conflicts];blocked=true;if(!row.reviewBase){row.reviewBase=copy(base);for(const id of Object.keys(draft.local.records)){
    if(Object.hasOwn(draft.base.records,id))row.reviewBase.records[id]=copy(draft.base.records[id]);else delete row.reviewBase.records[id];}}}
   dirty=!equal(local,base)||!!flight&&!equal(local,flight);
  }
  // Other tabs are not consumed or acknowledged by this tab. Their copies stay
  // recoverable if a tab was closed while it still had unsynced work.
  row.otherPending=rows.filter(r=>r.tab!==options.tab&&r.dirty&&!typed.includes(r)).map(r=>({id:r.id,at:r.at}));
  if(!blocked){delete row.reviewBase;row.conflicts=[];} // An already-synced old tab must not reuse its obsolete conflict baseline after its next edit/reload.
  await persist();front=copy(local);options.applyLocal(copy(front));
  for(const draft of typed)root.localStorage.removeItem(draftKey(draft.playerId));
  if(typed.length)await options.flushLocal?.();
  if(!dirty&&!blocked)await options.ackLocal?.(local);
  if(blocked)status('conflict','Saved locally · another device changed the same information');
  else if(dirty){status('pending','Saved locally · waiting to sync');schedule();}
  else if(row.otherPending.length||row.recovery?.length)status('recovery','Saved to cloud · recovery copies available');
  else status('synced','Saved to cloud');
  return copy(local);
 }
 function save(snapshot,waitForCloud=true){
  flushDrafts().catch(storageError);
  snapshot=data(snapshot);const observed=front;front=snapshot;savingLocal++;
  return new Promise((resolve,reject)=>serial(async()=>{
   // A captured UI snapshot may precede a cloud rebase. Apply only the edits
   // relative to the view the user actually edited, keeping unrelated remote
   // fields and preserving intentional local undo/revert operations.
   local=reconcile(observed,snapshot,local,'local').value;revision++;dirty=!equal(local,base)||!!flight&&!equal(local,flight);
   await options.flushLocal?.();await persist();savingLocal--;
   if(!dirty){if(!inflight){if(timer){timers.clearTimeout(timer);timer=null;}waiters.splice(0).forEach(r=>r(true));}resolve(true);return;}
   if(waitForCloud)waiters.push(resolve);else resolve(true);
   status(blocked?'conflict':'pending',blocked?'Saved locally · review conflicting changes':'Saved locally · waiting to sync');schedule();
   if(blocked||root.navigator?.onLine===false){waiters.splice(0).forEach(r=>r(false));if(!blocked)status('offline','Saved locally · offline');}
  }).catch(error=>{savingLocal=Math.max(0,savingLocal-1);blocked=true;status('storage-error','Local protection failed · keep this tab open and download a recovery copy');reject(error);}));
 }
 function stageRecord(id,record){
  const value=copy(record),observed=copy(front.records[id]),old=drafts.get(id),entry=old?{...old}:{id:options.account+':typing:'+options.tab+':'+encodeURIComponent(id),account:options.account,tab:'typing:'+options.tab+':'+encodeURIComponent(id),playerId:id,base:{records:observed===undefined?{}:{[id]:observed},appData:{}},dirty:true,revision:0};
  entry.local={records:{[id]:value},appData:{}};entry.at=now();entry.revision++;
  // This tiny write is synchronous; no whole-dataset cloning or IDB snapshot
  // runs in the input handler. The overflow adapter supplies durable IDB if full.
  try{writeDraft(entry);}catch(error){storageError(error);return Promise.reject(error);}
  drafts.set(id,entry);front.records[id]=copy(value);savingLocal++;dirty=true;
  const applied=serial(async()=>{const result=reconcile({records:observed===undefined?{}:{[id]:observed},appData:{}},entry.local,{records:{[id]:local.records[id]},appData:{}},'local');local.records[id]=result.value.records[id];revision++;});
  if(draftTimer)timers.clearTimeout(draftTimer);draftTimer=timers.setTimeout(()=>{draftTimer=null;flushDrafts().catch(storageError);},1200);
  if(!blocked)status('pending','Saved locally · waiting to sync');
  return applied.then(()=>options.flushLocal?.()).then(()=>true).catch(error=>{storageError(error);throw error;}).finally(()=>{savingLocal--;});
 }
 function flushDrafts(){
  if(draftTimer){timers.clearTimeout(draftTimer);draftTimer=null;}
  if(!drafts.size)return Promise.resolve();
  // Capture before joining the queue: a later input can arrive before this
  // task starts, but must never be acknowledged by an older local snapshot.
  const captured=[...drafts.values()];
  try{for(const entry of captured){entry.flight=entry.flight||copy(entry.local);writeDraft(entry);}}catch(error){return Promise.reject(error);}
  return serial(async()=>{
   // Keep the version that may be committed, including intentional undo, until
   // the complete durable journal has acknowledged that exact revision.
   await options.flushLocal?.();await persist();
   for(const entry of captured)if(drafts.get(entry.playerId)?.revision===entry.revision){root.localStorage.removeItem(draftKey(entry.playerId));drafts.delete(entry.playerId);}
   await options.flushLocal?.();schedule();
  });
 }
 async function typingPause(){while(draftTimer)await new Promise(resolve=>timers.setTimeout(resolve,100));}
 async function run(){
  if(draftTimer){schedule();return;}
  if(inflight||blocked||!dirty)return;
  if(options.canSync&&!options.canSync()){blocked=true;status('blocked','Saved locally · an authorized editor must sign in to sync');waiters.splice(0).forEach(r=>r(false));return;}
  if(root.navigator?.onLine===false){status('offline','Saved locally · offline');waiters.splice(0).forEach(r=>r(false));return;}
  inflight=true;lastStart=now();const batch=waiters;waiters=[];let sent,force;
  try{
   const remote=data(await options.refreshCloud());
   await typingPause();
   await serial(async()=>{
    const previous=local,result=reconcile(base,local,remote,undefined,flight);local=result.value;row.conflicts=result.conflicts;blocked=result.conflicts.length>0;if(!blocked)base=remote;dirty=!equal(local,base);force=!dirty&&!!flight&&!equal(local,flight);dirty=dirty||force;
    await persist();front=reconcile(previous,front,local,'local').value;options.applyLocal(copy(front));sent=copy(local);
   });
   if(blocked){status('conflict','Saved locally · another device changed the same information');batch.forEach(r=>r(false));return;}
   status('saving','Saved locally · syncing…');
   if(dirty||force){await serial(async()=>{if(!force)flight=sent;dirty=true;await persist();});await options.saveCloud(sent,{force:!!force});}
   await typingPause();
   await serial(async()=>{
    // Acknowledgement belongs only to the uploaded version. Newer local edits
    // remain pending and cannot be cleared by an older network response.
    base=sent;flight=undefined;dirty=!equal(local,base);await persist();await options.ackLocal?.(sent);
   });
   failures=0;nextAttempt=0;batch.forEach(r=>r(true));
   if(!dirty){waiters.splice(0).forEach(r=>r(true));status('synced','Saved to cloud');}else status('pending','Saved locally · waiting to sync');
  }catch(error){
   const retryable=!error.status||[408,409,429,500,502,503,504].includes(error.status)||/FAILED_PRECONDITION|bandwidth|timed out|network|fetch/i.test(error.message);
   failures++;nextAttempt=now()+Math.min(300000,10000*2**Math.min(failures-1,5))*(1+random()*0.25);
   blocked=!retryable;
   try{await serial(persist);}catch{blocked=true;status('storage-error','Local protection failed · keep this tab open and download a recovery copy');}
   if(state.kind!=='storage-error')status(blocked?'blocked':'retry',blocked?'Saved locally · cloud access needs attention':'Saved locally · cloud busy; retrying shortly');
   batch.forEach(r=>r(false));waiters.splice(0).forEach(r=>r(false));options.onError?.(error);
  }finally{inflight=false;schedule();}
 }
 async function resolve(choice){
  if(!['local','remote'].includes(choice))throw Error('Choose which conflicting values to retain.');
  const remote=data(await options.refreshCloud());
  await serial(async()=>{
   row.recovery=[...(row.recovery||[]),{reason:'Conflict review',at:now(),base:copy(base),local:copy(local),remote:copy(remote)}];
   local=reconcile(row.reviewBase||base,local,remote,choice,flight).value;base=remote;blocked=false;row.conflicts=[];delete row.reviewBase;dirty=!equal(local,base)||!!flight&&!equal(local,flight);revision++;
   await persist();front=copy(local);options.applyLocal(copy(front));
  });status(dirty?'pending':'synced',dirty?'Saved locally · waiting to sync':'Saved to cloud');schedule();
 }
 async function recover(id){
  const entries=await storage.all(),found=entries.find(r=>r.id===id&&r.dirty);if(!found)throw Error('Recovery copy unavailable.');
  await serial(async()=>{
   row.recovery=[...(row.recovery||[]),{reason:'Recovered closed tab',at:now(),value:copy(found)}];
   const result=reconcile(found.base,found.local,local,undefined,found.flight);local=result.value;row.conflicts=result.conflicts;blocked=result.conflicts.length>0;if(blocked)row.reviewBase=copy(found.base);flight=found.flight;dirty=!equal(local,base)||!!flight&&!equal(local,flight);revision++;await persist();front=copy(local);options.applyLocal(copy(front));
  });status(blocked?'conflict':'pending',blocked?'Saved locally · review recovered changes':'Saved locally · waiting to sync');schedule();
 }
 async function backup(){await queue;let journals=[],journalReadError=null;try{journals=await storage.all();}catch(error){journalReadError=error.message;}return{format:'euroscout-private-recovery-v1',account:options.account,exportedAt:new Date().toISOString(),state:copy(state),current:{base:copy(base),local:copy(local),flight:copy(flight),reviewBase:copy(row?.reviewBase),conflicts:copy(row?.conflicts||[]),recovery:copy(row?.recovery||[])},deviceOnly:options.backupExtras?.()||{},journals,journalReadError,journalIssues:storage.issues||[]};}
 async function previewRecovery(index){await queue;const value=row.recovery?.[index]?.value;if(!value?.records)throw Error('Recovery copy unavailable.');return{at:row.recovery[index].at,records:Object.keys(value.records).length,changedPlayers:[...new Set([...Object.keys(value.records),...Object.keys(local.records)])].filter(id=>!equal(value.records[id],local.records[id])),changedAppKeys:[...new Set([...Object.keys(value.appData||{}),...Object.keys(local.appData)])].filter(k=>!equal(value.appData?.[k],local.appData[k]))};}
 async function reviewConflicts(){const remote=data(await options.refreshCloud());await queue;return{checkedAt:now(),details:reconcile(row.reviewBase||base,local,remote,undefined,flight).details};}
 async function restoreLegacy(index){
  await serial(async()=>{const value=row.recovery?.[index]?.value;if(!value?.records)throw Error('Recovery copy unavailable.');
   row.recovery=[...(row.recovery||[]),{reason:'Before restoring recovery',at:now(),value:copy(local)}];
   const empty={records:{},appData:{}},result=reconcile(empty,value,local);local=result.value;row.conflicts=result.conflicts;blocked=result.conflicts.length>0;if(blocked)row.reviewBase=empty;dirty=!equal(local,base);revision++;await persist();front=copy(local);options.applyLocal(copy(front));
  });status(blocked?'conflict':'pending',blocked?'Saved locally · review recovered changes':'Saved locally · waiting to sync');schedule();
 }
 async function acceptRemote(snapshot){return serial(async()=>{if(dirty)return false;const previous=local;base=data(snapshot);local=copy(base);await persist();front=reconcile(previous,front,local,'local').value;options.applyLocal(copy(front));await options.ackLocal?.(local);return true;});}
 function retry(){if(inflight||row.conflicts?.length)return;blocked=false;failures=0;nextAttempt=Math.max(nextAttempt,now());schedule();}
 function resume(){if(!blocked&&dirty)schedule();}
 return{init,save,stageRecord,flushDrafts,resolve,recover,previewRecovery,reviewConflicts,restoreLegacy,acceptRemote,backup,retry,resume,run,tab:options.tab,get state(){return state;},get dirty(){return dirty;},get blocked(){return blocked;},get savingLocal(){return savingLocal>0;},get local(){return copy(local);}};
}
function statusDock(){
 const doc=root.document;let dock=doc.getElementById('esStatusDock');
 if(!dock){dock=doc.createElement('div');dock.id='esStatusDock';dock.className='es-status-dock';const header=doc.querySelector('body > header .hwrap');if(header)header.appendChild(dock);else doc.body.prepend(dock);const badge=doc.getElementById('esAccessBadge');if(badge)dock.appendChild(badge);}
 return dock;
}
function mount(sync){
 const doc=root.document,bar=doc.createElement('div');bar.id='esCloudSyncStatus';bar.className='es-cloud-sync';bar.innerHTML='<button type="button" data-review><i class="es-sync-dot" aria-hidden="true"></i><span data-label></span></button><span class="es-sync-sr" role="status" aria-live="polite"></span>';statusDock().prepend(bar);
 const paint=()=>{const {kind,message}=sync.state;bar.dataset.kind=kind;const button=bar.querySelector('[data-review]'),text=({synced:'Saved',recovery:'Saved',pending:'Saved locally',saving:'Syncing',offline:'Offline',retry:'Sync pending',conflict:'Needs review',blocked:'Sync paused','storage-error':'Save needs attention'})[kind]||'Saving';bar.querySelector('[data-label]').textContent=text;button.title=message+'\nClick for saving and recovery.';button.setAttribute('aria-label',text+' · Recovery');bar.querySelector('[role=status]').textContent=message;for(const id of ['liveStatus','saveState']){const label=doc.getElementById(id);if(label&&label.textContent!==message)label.textContent=message;}};
 root.addEventListener('euroscout:cloud-status',paint);paint();
 async function download(){const backup=await sync.backup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download='EuroScout-private-recovery-'+new Date().toISOString().slice(0,10)+'.json';a.click();root.setTimeout(()=>URL.revokeObjectURL(url),60000);}
 bar.querySelector('[data-review]').onclick=async()=>{
  const backup=await sync.backup(),dialog=doc.createElement('dialog');dialog.className='es-sync-dialog';
  dialog.innerHTML='<h3>Saving & recovery</h3><p class="es-sync-message"></p><p>Your pending edits and recovery copies are stored on this device. The download contains private scouting information.</p><div class="es-sync-actions"><button type="button" data-download>Download recovery copy</button><button type="button" data-retry hidden>Retry sync</button><button type="button" data-local hidden>Keep this device’s conflicting values</button><button type="button" data-cloud hidden>Use cloud’s conflicting values</button><button type="button" data-close>Close</button></div><div class="es-sync-recover"></div><p role="status"></p>';
  dialog.querySelector('.es-sync-message').textContent=sync.state.message;
  dialog.querySelector('[data-download]').onclick=download;
  const act=fn=>async()=>{try{await fn();dialog.close();dialog.remove();paint();}catch(e){dialog.querySelector('[role=status]').textContent=e.message;}};
  const retry=dialog.querySelector('[data-retry]');retry.hidden=!['retry','offline','blocked'].includes(sync.state.kind);retry.onclick=act(()=>sync.retry());
  for(const [name,choice]of [['local','local'],['cloud','remote']]){const button=dialog.querySelector('[data-'+name+']');button.hidden=sync.state.kind!=='conflict';button.onclick=act(()=>sync.resolve(choice));}
  if(sync.state.kind==='conflict'&&sync.reviewConflicts){
   const review=doc.createElement('button');review.type='button';review.textContent='Show conflicting fields';dialog.querySelector('.es-sync-actions').prepend(review);
   review.onclick=async()=>{review.disabled=true;try{const current=await sync.reviewConflicts(),panel=doc.createElement('section');panel.className='es-sync-conflicts';const heading=doc.createElement('h4');heading.textContent=current.details.length+' conflicting fields';panel.appendChild(heading);
    const names=new Map();if(typeof STATE!=='undefined')for(const league of STATE.data?.leagues||[])for(const p of league.players||[])for(const id of [p.id,...(p._grp||[]).map(x=>x.id)])names.set(id,p.name);
    const fields={nAth:'Athleticism notes',nOff:'Offense notes',nDef:'Defense notes',nIntel:'Intel notes',nProj:'Projection notes',rating:'Rating',jerseyNumbers:'Jersey number'};
    for(const item of current.details){const section=doc.createElement('details'),title=doc.createElement('summary'),path=item.path;title.textContent=(path[0]==='records'?(names.get(path[1])||path[1])+' · ':'')+(fields[path.at(-1)]||path.slice(path[0]==='records'?2:1).join(' · '));section.appendChild(title);
     for(const [label,value]of [['This device',item.local],['Cloud',item.remote]]){const strong=doc.createElement('strong'),pre=doc.createElement('pre');strong.textContent=label;pre.textContent=value===undefined?'Not set / removed':typeof value==='string'?value:JSON.stringify(value,null,2);section.append(strong,pre);}panel.appendChild(section);}
    if(!current.details.length){const message=doc.createElement('p');message.textContent='No conflicting values remain. Keep this device’s values to merge the independent changes and resume syncing.';panel.appendChild(message);}dialog.querySelector('.es-sync-conflicts')?.remove();dialog.appendChild(panel);
   }catch(error){dialog.querySelector('[role=status]').textContent=error.message;}finally{review.disabled=false;}};
  }
  for(const row of backup.journals.filter(r=>r.dirty&&r.tab!==sync.tab)){const button=doc.createElement('button');button.type='button';button.textContent='Recover pending edits from '+new Date(row.at).toLocaleString();button.onclick=act(()=>sync.recover(row.id));dialog.querySelector('.es-sync-recover').appendChild(button);}
  const own=backup.journals.find(r=>r.tab===sync.tab);for(const [i,entry]of (own?.recovery||backup.current?.recovery||[]).entries()){if(!entry.value?.records)continue;const button=doc.createElement('button');button.type='button';button.textContent='Review recovery copy from '+new Date(entry.at).toLocaleString();button.onclick=async()=>{try{const info=await sync.previewRecovery(i),panel=doc.createElement('section');panel.className='es-sync-preview';const heading=doc.createElement('h4');heading.textContent='Recovery preview';const summary=doc.createElement('p');summary.textContent=info.records+' saved player records · '+info.changedPlayers.length+' players and '+info.changedAppKeys.length+' settings differ from the current version. Reviewing this copy has not changed your data.';const restore=doc.createElement('button');restore.type='button';restore.textContent='Restore this recovery copy';restore.onclick=act(()=>sync.restoreLegacy(i));panel.append(heading,summary,restore);dialog.querySelector('.es-sync-preview')?.remove();dialog.appendChild(panel);}catch(e){dialog.querySelector('[role=status]').textContent=e.message;}};dialog.querySelector('.es-sync-recover').appendChild(button);}
  if(backup.journalReadError||backup.journalIssues?.length){const warning=doc.createElement('p');warning.textContent='Some recovery entries could not be read. Download a recovery copy before proceeding; their original bytes are retained.';dialog.appendChild(warning);}
  dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());doc.body.appendChild(dialog);dialog.showModal();
 };
 return paint;
}
const api={create,reconcile,journal,mount,tabId,statusDock};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ESCloudSync=api;
})(typeof window==='undefined'?globalThis:window);
