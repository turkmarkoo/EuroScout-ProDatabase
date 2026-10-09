const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),ACTIVE='euroscout:session:active:v1',CACHE='euroscout:fixtures:v1';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1500,height:820}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='hub.test')return r.fulfill({contentType:'text/html',body:'<!doctype html><iframe src="https://euro.test/index.html#matchup" style="width:100%;height:780px;border:0"></iframe>'});
  if(u.hostname!=='euro.test')return r.abort();
  if(u.pathname==='/euroscout-access.js')return r.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{email:'test@example.invalid'},state:JSON.parse(localStorage.getItem('button-test-cloud-state')||'null')||{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve({core:{season2627:{comps:{}},rumors:{buttonsTestReady:true}},seeds:{}}),saveState:async function(s){this.state=s;localStorage.setItem('button-test-cloud-state',JSON.stringify(s));return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
  const f=path.resolve(root,u.pathname.slice(1)||'index.html');
  return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404,body:''});
 });
 const embedded=async()=>{const el=await page.locator('iframe').elementHandle(),f=await el.contentFrame();await f.waitForURL('https://euro.test/index.html#matchup');return f;};
 const ready=async target=>target.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data?.rumors?.buttonsTestReady&&!document.querySelector('#coreLoadStatus'),{},{timeout:90000});
 const setup=async target=>target.evaluate(async()=>{
  await loadMatchupRosterScripts();
  const clubs=allClubs(),a=clubs.find(c=>/Patrioti Levice/i.test(c.name)),b=clubs.find(c=>/Coretec Oostende/i.test(c.name));
  if(!a||!b)throw Error('Missing test clubs');
  // Screenshot-derived fixture exercises the real DragonsData fixture adapter, without accessing private cloud data.
  const fixture={comp:'fec',compName:'FIBA Europe Cup',league_id:'fec26',date:'2026-10-06',time:'19:00',round:'Regular Season',venue:'Haleon Arena',played:true,hs:69,as:76,home:{key:a.key,code:'LEV',name:a.name},away:{key:b.key,code:'BCO',name:b.name}};
  window.EuroScoutDragons={...window.EuroScoutDragons,active:()=>true,fixtures:()=>[fixture]};
  await ESFixtures.refresh(false);STATE.scouting.a=a.key;STATE.scouting.b=b.key;STATE.view='scouting';render();
 });
 const protectedKeys=['euroscout:sessions:v1','euroscout:sessions:v1:last-good','euroscout:records','euroscout:overrides'];
 const protect=async target=>target.evaluate(async()=>{
  const saved={v:1,sessions:[{id:'existing-history',gameDate:'2026-09-18',a:{key:'test-a',name:'Test A'},b:{key:'test-b',name:'Test B'},players:[]}]};
  const entries={'euroscout:sessions:v1':JSON.stringify(saved),'euroscout:sessions:v1:last-good':JSON.stringify(saved),'euroscout:records':JSON.stringify({'test-player':{report:JSON.stringify({nOff:'Keep private observations',_workflow:{viewings:[{id:'existing-viewing',sessionId:'existing-history'}]}}),jerseyNumbers:{'2026/27:test-club':'00'}}}),'euroscout:overrides':JSON.stringify({bio:{'test-player':{club:'manual-club',rating:5}}})};
  for(const [k,v]of Object.entries(entries))if(k!=='euroscout:records')localStorage.setItem(k,v);
  await Store.save('test-player',JSON.parse(entries['euroscout:records'])['test-player']);
  entries['euroscout:records']=JSON.stringify({'test-player':Store.get('test-player')});
  await Store.pushAppKey('euroscout:sessions:v1');
  return entries;
 });
 const unchanged=async(target,before)=>assert.deepEqual(await target.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,k==='euroscout:records'?JSON.stringify({'test-player':JSON.parse(localStorage.getItem(k))['test-player']}):k==='euroscout:overrides'?JSON.stringify({bio:{'test-player':JSON.parse(localStorage.getItem(k)).bio['test-player']}}):localStorage.getItem(k)])),protectedKeys),before,'Starting a session must preserve notes, jersey numbers, manual edits and previous history');
 const fill=async(target,cache)=>target.evaluate(({cache,CACHE})=>{
  localStorage.removeItem(CACHE);if(cache)localStorage.setItem(CACHE,'x'.repeat(350000));
  let i=0;for(const size of [1024,64,1])for(;;i++){try{localStorage.setItem('button-test-fill-'+i,'x'.repeat(size));}catch{break;}}
 },{cache,CACHE});
 const freeTestFill=async target=>target.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('button-test-fill-'))localStorage.removeItem(k);});
 const open=async target=>{await target.locator('#mxStart').click();await target.locator('#sxStart').waitFor();};
 const assertStarted=async target=>{
  await target.locator('#mxFinish').waitFor();assert.equal(await target.locator('#sxStart').count(),0);
  const a=await target.evaluate(()=>ESSessions.active());
  assert.equal(a.gameDate,'2026-10-06');assert.equal(a.competition.id,'fec');assert.equal(a.competition.name,'FIBA Europe Cup');assert.equal(a.stage,'Regular Season');assert.equal(a.scoreA,'69');assert.equal(a.scoreB,'76');assert.equal(a.venue,'Haleon Arena');return a;
 };
 try{
  await page.goto('https://hub.test/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('iframe'));
  const frame=await embedded();
  assert.ok(frame);await ready(frame);await setup(frame);const before=await protect(frame);
  // Both buttons through actual pointer clicks in an embedded page.
  await open(frame);assert.match(await frame.locator('[name=known]').inputValue(),/^\d+$/);
  const formValues=await frame.locator('#sxStart').evaluate(f=>({date:f.elements.gameDate.value,a:f.elements.a.value,b:f.elements.b.value}));
  assert.equal(formValues.date,'2026-10-06');assert.ok(formValues.a&&formValues.b);
  await frame.locator('#sxStart button[type=submit]').click();const started=await assertStarted(frame);await unchanged(frame,before);
  await frame.evaluate(()=>ESSessions.update({players:{'test-player':{pid:'test-player',ms:12000,stock:'up',before:'kept'}}}));
  const preserved=await frame.evaluate(()=>{
   const before=ESSessions.active();const repeated=ESSessions.start({gameDate:'2099-01-01',players:{}});let reopened;
   ESSessions.openStart({},a=>reopened=a);
   return{before,repeated,reopened,dialogs:document.querySelectorAll('#sxStart').length};
  });
  assert.equal(preserved.repeated.id,started.id);assert.deepEqual(preserved.repeated,preserved.before);assert.deepEqual(preserved.reopened,preserved.before);assert.equal(preserved.dialogs,0);
  await page.reload({waitUntil:'domcontentloaded'});const resumed=await embedded();await ready(resumed);await setup(resumed);
  assert.equal((await resumed.evaluate(()=>ESSessions.active())).id,started.id);assert.equal((await resumed.evaluate(()=>ESSessions.active())).players['test-player'].stock,'up');await unchanged(resumed,before);
  console.log('PASS embedded Chrome: both single-click buttons, Levice–Oostende fixture, duplicate-start protection, reload/resume and private data preservation');
  // Standalone, full browser storage: only the rebuildable public schedule cache is evicted.
  await page.goto('https://euro.test/index.html#matchup',{waitUntil:'domcontentloaded'});await ready(page);await page.evaluate(()=>ESSessions.discard());await setup(page);await fill(page,true);await open(page);
  await page.locator('#sxStart button[type=submit]').click();await assertStarted(page);assert.equal(await page.evaluate(CACHE=>localStorage.getItem(CACHE)===null,CACHE),true,'Recovery must remove the public fixture cache');await unchanged(page,before);await freeTestFill(page);
  console.log('PASS full-storage recovery clears only fixture cache and starts the session');
  // No disposable cache available: explain the failure, retain the form, then allow retry.
  await page.evaluate(()=>ESSessions.discard());await setup(page);await fill(page,false);await open(page);
  const button=page.locator('#sxStart button[type=submit]');await button.click();await page.locator('#sxStartStatus:not([hidden])').waitFor();
  assert.match(await page.locator('#sxStartStatus').innerText(),/no space left/);assert.equal(await button.isEnabled(),true);assert.equal(await page.evaluate(()=>ESSessions.active()),null);assert.equal(await page.locator('[name=gameDate]').inputValue(),'2026-10-06');await unchanged(page,before);
  await freeTestFill(page);await button.click();await assertStarted(page);await unchanged(page,before);
  console.log('PASS failed save shows a visible error, retains selections and allows successful retry');
  // Editing access can expire while the form is open: explain it and allow a retry.
  await page.evaluate(()=>ESSessions.discard());await setup(page);await open(page);
  await page.evaluate(()=>ESAccess.owner=false);await page.locator('#sxStart button[type=submit]').click();
  assert.match(await page.locator('#sxStartStatus').innerText(),/editing access is unavailable/);assert.equal(await page.evaluate(()=>ESSessions.active()),null);
  await page.evaluate(()=>ESAccess.owner=true);await page.locator('#sxStart button[type=submit]').click();await assertStarted(page);await unchanged(page,before);
  console.log('PASS expired editing access shows a recoverable error without dropping the form');
  // Rapid duplicate submits use a detached stale form only once.
  await page.evaluate(()=>ESSessions.discard());await setup(page);await open(page);
  const repeatedSubmit=await page.locator('#sxStart').evaluate(f=>{const e=()=>({preventDefault(){}});f.onsubmit(e());const first=ESSessions.active();f.onsubmit(e());return{first,second:ESSessions.active()};});
  assert.deepEqual(repeatedSubmit.second,repeatedSubmit.first);await assertStarted(page);await unchanged(page,before);
  assert.deepEqual(errors,[]);console.log('PASS repeated submit preserves the same active session; no unhandled application errors');
 }catch(e){await page.screenshot({path:path.resolve('../session-start-button-failure-20261009.png')});console.error('Browser errors:',errors);throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
