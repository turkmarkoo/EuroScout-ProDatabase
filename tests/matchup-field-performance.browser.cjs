const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseline=process.argv.includes('--baseline'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'),headless:true});
 const context=await browser.newContext({viewport:{width:1500,height:850}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>{
  const u=new URL(r.request().url());if(u.hostname!=='euro.test')return r.abort();
  if(u.pathname==='/euroscout-access.js')return r.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{uid:'field-perf',email:'test@example.invalid'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve({core:{season2627:{comps:{}},rumors:{fieldPerf:true}},seeds:{}}),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
  const file=path.resolve(root,u.pathname.slice(1)||'index.html');
  if(u.pathname==='/euroscout-live-notes.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(file,'utf8').replace('function buildClubIndex(){','function buildClubIndex(){window.__rosterBuilds=(window.__rosterBuilds||0)+1;')});
  return file.startsWith(root)&&fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});
 });
 try{
  await page.goto('https://euro.test/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data?.rumors?.fieldPerf&&!document.querySelector('#coreLoadStatus'),{},{timeout:90000});
  console.log('Catalogue ready');
  await page.evaluate(()=>{document.activeElement?.blur();STATE.view='scout';});
  await page.evaluate(()=>loadMatchupRosterScripts());console.log('Rosters ready');
  await page.evaluate(()=>loadExtraLeagues());console.log('Extra leagues ready');
  await page.waitForFunction(()=>!EuroScoutMergeCenter.automaticStatus().running,{},{timeout:90000});
  const setup=await page.evaluate(async()=>{
   const cs=allClubs();STATE.scouting.a=cs.find(c=>/NINERS Chemnitz/.test(c.name)).key;STATE.scouting.b=cs.find(c=>/Budu.*nost/.test(c.name)).key;STATE.view='scouting';render();
   const row=[...document.querySelectorAll('.rosterRow')].find(r=>/Ben Burnham/.test(r.title));if(!row)throw Error('Burnham fixture missing');row.click();
   const p=player(row.dataset.id);window.__editedId=p.id;
   await saveRec(p,{report:JSON.stringify({nOff:'Keep the scouting note',_history:[{id:'preserved',report:{nOff:'Earlier'}}]}),rating:4,jerseyNumbers:{['2026/27|'+STATE.scouting.a]:'25'}});
   renderScouting(true);window.__rebuilds=0;const base=rebuildLinks;rebuildLinks=function(...a){window.__rebuilds++;return base(...a);};
   return {players:allPlayersEvery().length,id:p.id};
  });
  console.log('Matchup ready',setup);
  await page.waitForTimeout(800);
  const initial=await page.evaluate(()=>{window.__notebook=document.querySelector('#liveBullets');window.__left=document.querySelector('.rosterList');window.__rosterBefore=window.__rosterBuilds;return {report:recOf(player(__editedId)).report,selected:document.querySelector('.rosterRow.liveSelected').dataset.id};});
  const times=[];
  async function choose(select,value){const t=Date.now();await page.locator(select).click();await page.locator('.es-option-popover [role=option]').filter({hasText:new RegExp('^'+value+'$')}).click();await page.waitForFunction(({select,value})=>document.querySelector(select)?.value===value&&!document.querySelector(select)?.disabled,{select,value});times.push({field:select,ms:Date.now()-t});}
  await choose('#mxHand','Left');
  const t=Date.now();await page.getByRole('button',{name:'Edit Primary Role',exact:true}).click();await page.getByRole('option',{name:'Stretch Forward',exact:true}).click();await page.waitForFunction(()=>ESPlayerScouting.values(player(__editedId)).primaryRole==='Stretch Forward'&&!document.querySelector('.dq-popover'));times.push({field:'primaryRole',ms:Date.now()-t});
  await page.locator('#mxLevel').selectOption('0');await page.waitForFunction(()=>document.querySelector('#mxLevel')?.value==='0'&&document.querySelector('#liveStatus')?.textContent==='Estimated level saved.');
  const result=await page.evaluate(()=>({rosterBuilds:__rosterBuilds-__rosterBefore,identityBuilds:__rebuilds,sameNotes:document.querySelector('#liveBullets')===__notebook,sameRoster:document.querySelector('.rosterList')===__left,notes:parseReport(recOf(player(__editedId)).report).nOff,history:parseReport(recOf(player(__editedId)).report)._history,jerseys:recOf(player(__editedId)).jerseyNumbers,rating:recOf(player(__editedId)).rating,hand:player(__editedId).hand,role:ESPlayerScouting.values(player(__editedId)).primaryRole}));
  console.log(JSON.stringify({setup,times,result}));
  if(baseline)return;
  assert.equal(result.rosterBuilds,0,'Personal field edits must reuse the team index');assert.equal(result.identityBuilds,0,'Personal field edits must not relink the catalogue');assert.ok(result.sameNotes&&result.sameRoster,'Metadata edits must preserve notes and roster DOM');
  assert.equal(result.notes,'Keep the scouting note');assert.deepEqual(result.history,JSON.parse(initial.report)._history);assert.equal(result.rating,4);assert.ok(Object.values(result.jerseys).includes('25'));
  // Background catalogue events cannot replace a field menu while it is open.
  await page.getByRole('button',{name:'Edit Secondary Role',exact:true}).click();await page.locator('.dq-popover').waitFor();
  await page.evaluate(()=>{window.__openMenu=document.querySelector('.dq-popover');window.__beforeMenuBuilds=__rosterBuilds;window.dispatchEvent(new Event('euroscout:rosters-ready'));});
  await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>document.querySelector('.dq-popover')===__openMenu&&ESMatchupBusy()&&__rosterBuilds===__beforeMenuBuilds));
  await page.locator('.dq-popover input').press('Escape');await page.evaluate(()=>document.activeElement?.blur());
  await page.waitForFunction(()=>__rosterBuilds===__beforeMenuBuilds+1,{},{timeout:90000});
  // A slow save for A must not replace B's notebook or remove B's menu.
  const race=await page.evaluate(async()=>{document.querySelector('#liveSearch').blur();const a=player(__editedId),other=[...document.querySelectorAll('.rosterRow')].find(r=>r.dataset.id!==a.id);window.__saveFlush=ESStorage.flush;window.__saveResolvers=[];ESStorage.flush=()=>new Promise(resolve=>__saveResolvers.push(resolve));window.__lateSave=ESPlayerScouting.save(a,{hand:'Right'});await Promise.resolve();await Promise.resolve();other.click();window.__otherEditor=document.querySelector('#liveBullets');return other.dataset.id;});
  await page.getByRole('button',{name:'Edit Primary Role',exact:true}).click();
  await page.evaluate(async()=>{ESStorage.flush=window.__saveFlush;window.__saveResolvers.forEach(resolve=>resolve());await window.__lateSave;ESMatchupProfile.refresh({playerId:__editedId,rosterChanged:false});});
  assert.equal(await page.locator('.rosterRow.liveSelected').getAttribute('data-id'),race);assert.ok(await page.evaluate(()=>document.querySelector('#liveBullets')===__otherEditor));assert.ok(await page.locator('.dq-popover').isVisible());
  await page.locator('.dq-popover input').press('Escape');assert.deepEqual(errors,[]);
  await page.screenshot({path:path.resolve(root,'../performance-20261103/matchup-preview.png')});
  console.log('PASS full catalogue field edits, preserved notebook/roster/history, open-menu protection and delayed-save navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
