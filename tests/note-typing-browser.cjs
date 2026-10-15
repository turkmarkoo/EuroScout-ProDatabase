const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('const Store = (()=>{'),end=html.indexOf('\n})();',start)+'\n})();'.length;
const store=html.slice(start,end)+'\nwindow.Store=Store;';
const saveRec=html.slice(html.indexOf('async function saveRec('),html.indexOf('\nfunction mergeGroupRecords('));
const copy=v=>JSON.parse(JSON.stringify(v));
const report={nOff:'Original offense',nDef:'Preserved defense',_history:[{id:'September',report:{nOff:'Earlier observation '.repeat(80)}}],_workflow:{viewings:[{id:'September-game',event:'Keep viewing'}]}};
const initial={schema:1,records:Object.fromEntries(Array.from({length:600},(_,i)=>['p'+i,{report:JSON.stringify(report),rating:3,hand:'Right',jerseyNumbers:{'2026/27|club':'00'}}])),appData:{'euroscout:sessions:v1':{sessions:[{id:'September',note:'Keep session'}]}},seeds:{}};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[];let server=copy(initial),mode='429',cloudWrites=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://typing.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/cloud'){if(route.request().method()==='POST'){cloudWrites++;if(mode==='429')return route.fulfill({status:429,body:'{}'});server=route.request().postDataJSON();return route.fulfill({body:'{}'});}return route.fulfill({contentType:'application/json',body:JSON.stringify(server)});}
  if(url.pathname==='/fixture.html')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><span id="note" contenteditable="true"></span><script src="/euroscout-storage.js"></script><script src="/euroscout-cloud-sync.js"></script><script src="/euroscout-record-merge.js"></script><script>
   window.STATE={view:'scouting'};window.OVR={};window.ESAccess={internal:true,owner:true,user:{uid:'typing-owner',email:'test@example.invalid'},state:${JSON.stringify(server)},saveState:async function(s){const r=await fetch('/cloud',{method:'POST',body:JSON.stringify(s)});if(!r.ok){const error=Error('bandwidth');error.status=r.status;throw error;}this.state=s;return true;},refresh:async function(){this.state=await(await fetch('/cloud')).json();return true;}};ESAccess.ready=Promise.resolve(ESAccess);
   ${store}
   function gid(p){return p.id;}function recOf(p){return Store.get(p.id);}function parseReport(v){return JSON.parse(v||'{}');}
   ${saveRec}
   window.writeNote=async(id,text)=>{const p={id},r=parseReport(recOf(p).report);r.nOff=text;return saveRec(p,{report:JSON.stringify(r)},{typing:true});};
   Store.initSB().then(()=>{const set=Storage.prototype.setItem;window.fullWrites=0;window.draftWrites=0;window.maxDraftBytes=0;Storage.prototype.setItem=function(k,v){if(k==='euroscout:records')fullWrites++;if(k.includes(':typing:')){draftWrites++;maxDraftBytes=Math.max(maxDraftBytes,v.length);}return set.call(this,k,v);};window.ready=true;});
   </script>`});
  const file=path.join(root,url.pathname.slice(1));return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 try{
  await page.goto('https://typing.test/fixture.html');await page.waitForFunction(()=>window.ready);
  const timing=await page.evaluate(async()=>{const times=[];for(let i=1;i<=120;i++){const t=performance.now(),result=writeNote('p0','Fast observation '+i);times.push(performance.now()-t);await result;}return{max:Math.max(...times),p95:times.sort((a,b)=>a-b)[Math.floor(times.length*.95)],fullWrites,draftWrites,maxDraftBytes,bytes:JSON.stringify(ESAccess.state).length};});
  assert.equal(timing.fullWrites,0,'Typing must not serialize the full local records cache');assert.equal(timing.draftWrites,120);assert(timing.maxDraftBytes<timing.bytes/20);assert(timing.p95<25,'Input-handler work must stay within 25 ms on the fixture');assert.equal(cloudWrites,0);
  // Simulate closing/reloading before the 350 ms quiet-period snapshot.
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p0').report).nOff.replace(/^• /,'')),'Fast observation 120');
  await page.evaluate(async()=>{await writeNote('p0','Player one final');await writeNote('p1','Player two final');});
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p0').report).nOff.replace(/^• /,'')),'Player one final');assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p1').report).nOff.replace(/^• /,'')),'Player two final');
  await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='retry',{},{timeout:15000});assert.equal(cloudWrites,1);const backup=await page.evaluate(()=>EuroScoutCloudSync.backup());assert.equal(JSON.parse(backup.current.local.records.p0.report).nOff.replace(/^• /,''),'Player one final');
  mode='ok';await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='synced',{},{timeout:20000});assert.equal(JSON.parse(server.records.p0.report).nOff.replace(/^• /,''),'Player one final');assert.equal(JSON.parse(server.records.p1.report).nOff.replace(/^• /,''),'Player two final');
  assert.equal(JSON.parse(server.records.p0.report).nDef.replace(/^• /,''),report.nDef);assert.deepEqual(JSON.parse(server.records.p0.report)._history,report._history);assert.deepEqual(JSON.parse(server.records.p0.report)._workflow.viewings,report._workflow.viewings);assert.deepEqual(server.records.p599,initial.records.p599);assert.deepEqual(server.appData['euroscout:sessions:v1'],initial.appData['euroscout:sessions:v1']);
  // An edit made while a previous local journal is committing must survive.
  await page.evaluate(async()=>{await writeNote('p0','Earlier local snapshot');const pending=EuroScoutCloudSync.flushDrafts();await writeNote('p0','Latest local snapshot');await pending;});
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p0').report).nOff.replace(/^• /,'')),'Latest local snapshot');
  await page.evaluate(async()=>{const original={...Store.get('p2')};await EuroScoutCloudSync.stageRecord('p2',{...original,hand:'Left'});const pending=EuroScoutCloudSync.flushDrafts();await EuroScoutCloudSync.stageRecord('p2',original);await pending;});
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>Store.get('p2').hand),'Right','An intentional undo must survive an older local commit');
  // The same-field edit on another device requires review, with both versions.
  await page.evaluate(()=>writeNote('p0','My new observation'));server.records.p0.report=JSON.stringify({...report,nOff:'Other device observation'});await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>EuroScoutCloudSync.state.kind),'conflict');assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p0').report).nOff.replace(/^• /,'')),'My new observation');assert.equal(JSON.parse(server.records.p0.report).nOff.replace(/^• /,''),'Other device observation');
  await page.evaluate(()=>EuroScoutCloudSync.resolve('local'));await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='synced',{},{timeout:20000});
  // Full localStorage still protects small typing journals in the overflow DB.
  await page.evaluate(()=>{let low=0,high=6*1024*1024;while(low<high){const mid=Math.ceil((low+high)/2);try{localStorage.setItem('filler','x'.repeat(mid));low=mid;}catch{high=mid-1;}}});
  await page.evaluate(()=>writeNote('p1','Quota-safe typed note '.repeat(400)));await page.reload();await page.waitForFunction(()=>window.ready);assert((await page.evaluate(()=>JSON.parse(Store.get('p1').report).nOff.replace(/^• /,''))).startsWith('Quota-safe typed note'));
  const failure=await page.evaluate(async()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes(':typing:'))throw Error('Synthetic unavailable storage');return set.call(this,k,v);};let rejected=false;try{await writeNote('p3','Keep in recovery download');}catch{rejected=true;}finally{Storage.prototype.setItem=set;}return{rejected,state:EuroScoutCloudSync.state.kind,backup:await EuroScoutCloudSync.backup()};});
  assert(failure.rejected);assert.equal(failure.state,'storage-error');assert(JSON.parse(failure.backup.deviceOnly.inMemoryRecords.p3.report).nOff.includes('Keep in recovery download'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'../typing-validation.json'),JSON.stringify({passed:true,timing,cloudRequests:'fixture only',privateDataAccessed:false,checks:['small draft per edit','no full cache writes while typing','reload before quiet-period save','two players','429 retains notes','retry sync','history and other fields retained','new edit during local commit','other-device conflict review','full localStorage recovery'],pageErrors:errors},null,2));console.log('PASS protected typing, reloads, offline/retry, overlapping local commits, same-field conflicts, full browser storage. Input timings:',timing);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
