const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('const Store = (()=>{'),end=html.indexOf('\n})();',start)+'\n})();'.length;
const store=html.slice(start,end)+'\nwindow.Store=Store;window.saveCloudConfirmed=(id,rec)=>Store["save"](id,rec,{waitForCloud:true});';
const original={schema:1,records:{p:{report:JSON.stringify({nOff:'Original shooting note',nDef:'Keep defense',_history:[{id:'September',report:'Earlier report'}]}),rating:3,hand:'Right',jerseyNumbers:{'2026/27|club':'00'}},other:{report:'Keep second player'}},appData:{'euroscout:sessions:v1':{v:1,sessions:[{id:'September-game',note:'Keep finished history'}]},'euroscout:next26:v1':{p:'Manual club'}},seeds:{}};
const clone=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});let server=clone(original),mode='429',writes=0;const context=await browser.newContext(),errors=[];
 await context.route('https://sync.test/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/cloud'){
   if(route.request().method()==='POST'){writes++;if(mode==='429')return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({message:'maximum bandwidth for writes'})});server=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:'{}'});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(server)});
  }
  if(u.pathname==='/fixture.html')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/euroscout-cloud-sync.css"><div id="liveStatus"></div><script src="/euroscout-storage.js"></script><script src="/euroscout-cloud-sync.js"></script><script>window.STATE={view:'scouting'};window.toast=console.log;window.OVR={};window.ESAccess={internal:true,owner:true,user:{uid:'owner-a',email:'fixture@example.invalid'},state:${JSON.stringify(server)},saveState:async function(next){const r=await fetch('/cloud',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)});if(!r.ok){const e=Error((await r.json()).message);e.status=r.status;throw e;}this.state=next;return true;},refresh:async function(){const s=await(await fetch('/cloud')).json(),changed=JSON.stringify(s)!==JSON.stringify(this.state);this.state=s;return changed;}};ESAccess.ready=Promise.resolve(ESAccess);</script><script>${store}</script><script>Store.initSB().then(()=>window.ready=true).catch(e=>window.initError=e.message);</script>`});
  const file=path.join(root,u.pathname.slice(1));return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('https://sync.test/fixture.html');await page.waitForFunction(()=>window.ready||window.initError);assert.equal(await page.evaluate(()=>window.initError),undefined);
  const localSave=await page.evaluate(async()=>{const t=performance.now(),ok=await Store.save('p',{hand:'Left'});return{ok,ms:performance.now()-t,state:EuroScoutCloudSync.state.kind};});assert.equal(localSave.ok,true);assert(localSave.ms<1000);assert.equal(localSave.state,'pending');assert.equal(writes,0,'A local acknowledgement does not claim or require cloud confirmation');
  await page.evaluate(()=>{window.result=undefined;saveCloudConfirmed('p',{report:JSON.stringify({...JSON.parse(Store.get('p').report),nOff:'New unsynced shooting observation'})}).then(v=>window.result=v);});
  await page.waitForFunction(()=>window.result===false);assert.equal(writes,1);assert.match(await page.locator('#esCloudSyncStatus').textContent(),/Saved locally/);
  const raw=await page.evaluate(()=>localStorage.getItem('euroscout:records'));assert(raw.includes('New unsynced shooting observation'));
  await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>JSON.parse(Store.get('p').report).nOff),'New unsynced shooting observation');
  assert.equal(await page.evaluate(()=>Store.get('p').jerseyNumbers['2026/27|club']),'00');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('euroscout:sessions:v1')).sessions[0].id),'September-game');
  mode='ok';await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='synced',{},{timeout:20000});assert(server.records.p.report.includes('New unsynced shooting observation'));
  const duplicate=await context.newPage(),originalTab=await page.evaluate(()=>EuroScoutCloudSync.tab);await duplicate.addInitScript(id=>sessionStorage.setItem('euroscout:cloud-tab:v1',id),originalTab);await duplicate.goto('https://sync.test/fixture.html');await duplicate.waitForFunction(()=>window.ready);assert.notEqual(await duplicate.evaluate(()=>EuroScoutCloudSync.tab),originalTab,'Duplicated browser tabs require separate recovery journals');await duplicate.close();
  // An unchanged request does not write. A burst produces one latest upload.
  const count=writes;await page.evaluate(async()=>{await saveCloudConfirmed('p',{rating:3});});assert.equal(writes,count);
  await page.evaluate(()=>{window.pending=Promise.all(Array.from({length:20},(_,i)=>saveCloudConfirmed('p',{rating:i})));});
  await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='synced'&&Store.get('p').rating===19,{},{timeout:20000});assert.equal(writes,count+1);assert.equal(server.records.p.rating,19);
  // Separate changes from another device are retained on the next merge.
  server.records.other.report='Changed on another device';
  await page.evaluate(()=>saveCloudConfirmed('p',{hand:'Left'}));assert.equal(server.records.other.report,'Changed on another device');
  // A same-field conflict remains local. Native recovery controls resolve it
  // only after preserving both copies in the durable journal.
  server.records.p.rating=22;
  await page.evaluate(()=>{saveCloudConfirmed('p',{rating:21});});await page.waitForFunction(()=>EuroScoutCloudSync.state.kind==='conflict',{},{timeout:20000});assert.equal(server.records.p.rating,22);
  await page.getByRole('button',{name:'Recovery',exact:true}).click();await page.getByRole('button',{name:'Use cloud’s conflicting values'}).click();await page.waitForFunction(()=>!document.querySelector('dialog'));
  assert.equal(await page.evaluate(()=>Store.get('p').rating),22);const backup=await page.evaluate(()=>EuroScoutCloudSync.backup());assert(backup.journals.some(r=>r.recovery?.some(x=>x.reason==='Conflict review'&&x.local.records.p.rating===21)));
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Recovery',exact:true}).click();await page.getByRole('button',{name:'Download recovery copy'}).click();const file=await download;assert(file.suggestedFilename().includes('private-recovery'));await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.setViewportSize({width:390,height:844});const box=await page.locator('#esCloudSyncStatus').boundingBox();assert(box.x>=0&&box.x+box.width<=390);await page.screenshot({path:path.join(root,'../cloud-sync-mobile.png')});
  await page.setViewportSize({width:1366,height:900});await page.screenshot({path:path.join(root,'../cloud-sync-desktop.png')});
  // The IDB journal preserves pending data if ordinary localStorage is full.
  await page.evaluate(()=>{let low=0,high=6*1024*1024;while(low<high){const mid=Math.ceil((low+high)/2);try{localStorage.setItem('fixture-filler','x'.repeat(mid));low=mid;}catch{high=mid-1;}}});
  mode='429';await page.evaluate(()=>{window.result=undefined;saveCloudConfirmed('p',{report:JSON.stringify({...JSON.parse(Store.get('p').report),nOff:'Quota-safe note '.repeat(3000)})}).then(v=>window.result=v);});await page.waitForFunction(()=>window.result===false,{},{timeout:20000});await page.reload();await page.waitForFunction(()=>window.ready||window.initError);assert.equal(await page.evaluate(()=>window.initError),undefined);assert((await page.evaluate(()=>Store.get('p').report)).includes('Quota-safe note'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'../browser-validation.json'),JSON.stringify({passed:true,privateDataAccessed:false,realCloudRequests:0,writesToFixture:writes,checks:['429 retention','reload recovery','unchanged suppression','rapid edit coalescing','independent remote changes','conflict review','download','mobile layout','full localStorage recovery'],pageErrors:errors},null,2));
  const failureContext=await browser.newContext(),failurePage=await failureContext.newPage();
  await failureContext.route('https://failure.test/**',r=>{const u=new URL(r.request().url());if(u.pathname==='/fixture.html')return r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script>localStorage.setItem('euroscout:records',JSON.stringify({p:{report:'Legacy note must remain'}}));window.originalLocal=localStorage.getItem('euroscout:records');const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const t=transaction.apply(this,args);if(this.name==='euroscout-cloud-outbox'&&args[1]==='readwrite')queueMicrotask(()=>t.abort());return t;};</script><script src="/euroscout-storage.js"></script><script src="/euroscout-cloud-sync.js"></script><script>window.STATE={view:'scouting'};window.ESAccess={internal:true,owner:true,user:{uid:'failure-owner'},state:${JSON.stringify(original)}};ESAccess.ready=Promise.resolve(ESAccess);</script><script>${store}</script><script>Store.initSB().then(()=>window.ready=true).catch(e=>window.initError=e.message);</script>`});const f=path.join(root,u.pathname.slice(1));return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
  await failurePage.goto('https://failure.test/fixture.html');await failurePage.waitForFunction(()=>window.initError);assert.equal(await failurePage.evaluate(()=>Store.canEdit()),false);assert.equal(await failurePage.evaluate(()=>Store.localProtectionReady),false);assert.equal(await failurePage.evaluate(()=>localStorage.getItem('euroscout:records')),await failurePage.evaluate(()=>window.originalLocal));assert((await failurePage.evaluate(()=>EuroScoutCloudSync.backup())).current.recovery.some(r=>r.value.records.p.report==='Legacy note must remain'));await failureContext.close();
  console.log('PASS real Chrome: normal and full localStorage, IndexedDB reload recovery, actual Store integration, failed saves, coalescing, remote changes, conflict controls, recovery download and mobile layout.');
 }catch(error){console.error(JSON.stringify({pageErrors:errors,state:await page.evaluate(()=>window.EuroScoutCloudSync?.state),dialog:await page.locator('dialog').evaluateAll(nodes=>nodes.map(n=>n.outerHTML))}));throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
