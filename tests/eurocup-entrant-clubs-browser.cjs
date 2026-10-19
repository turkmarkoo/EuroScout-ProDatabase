const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='euro.test')return route.abort();
  if(u.pathname==='/euroscout-access.js')return route.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{uid:'fixture-user',email:'fixture@example.invalid'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve({core:{season2627:{comps:{}},rumors:{entrantFixture:true}},seeds:{}}),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
  const f=path.resolve(root,u.pathname.slice(1)||'index.html');return fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({path:f}):route.fulfill({status:404,body:''});
 });
 await page.goto('https://euro.test/');await page.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data?.rumors?.entrantFixture&&!document.querySelector('#coreLoadStatus'),{},{timeout:90000});
 await page.evaluate(async()=>{await loadMatchupRosterScripts();STATE.view='scouting';STATE.scouting.a=canonKey('n2627|MR');STATE.scouting.b=canonKey('n2627|RS1');render();});
 const data=await page.evaluate(()=>EUROSCOUT_EUROCUP_ROSTERS.roster.filter(r=>r.teamCode==='MRO').map(row=>{const p=row.ids.map(id=>player(id)).find(Boolean),e=EuroScoutMarket.evidence(p,next26Get());return{id:p.id,name:p.name,key:effective26(p),club:ESPlayerScouting.values(p).club,status:e.status,availability:EuroScoutMarketRecords.view(p,e).availability,until:p.contractUntil};}));
 assert.equal(data.length,14);for(const row of data){assert.equal(row.club,'Maxima Roma');assert.equal(row.status,'signed');assert.equal(row.availability,'Under Contract');assert(!row.until,'No contract expiry should be invented');}
 const clubs=await page.evaluate(()=>['n2627|MR','eurocup|MRO','n2627|RS1','eurocup|BCR','n2627|BB9'].map(k=>({key:k,canonical:canonKey(k),name:clubByKey(k)?.name})));
 assert(clubs.every(c=>c.name));assert.equal(clubs[0].canonical,clubs[1].canonical);assert.equal(clubs[2].canonical,clubs[3].canonical);assert.notEqual(clubs[0].canonical,clubs[2].canonical);
 const awaitGid=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,gid(player(id))])),data.map(p=>p.id));const roster=await page.evaluate(()=>[...document.querySelectorAll('.mx-col[data-slot=a] .rosterRow')].map(r=>({id:r.dataset.id,gid:gid(player(r.dataset.id))})));for(const p of data)assert(roster.some(r=>r.gid===awaitGid[p.id]),p.name+' should be on the roster');
 const person=data.find(p=>/Lemar/.test(p.name)),lemar={...person,id:roster.find(r=>r.gid===awaitGid[person.id]).id};await page.locator('.mx-col[data-slot=a] .rosterRow[data-id="'+lemar.id+'"]').click();
 const header=await page.locator('.mx-player .mx-club').evaluate(e=>({text:e.textContent,missing:e.classList.contains('dq-missing'),title:e.title}));assert.match(header.text,/Maxima Roma/);assert.equal(header.missing,false);assert(!/missing/i.test(header.title));
 assert.equal(await page.locator('#liveNumber').textContent(),'Jersey #11');
 const preserved=await page.evaluate(async id=>{const p=player(id);await saveRec(p,{report:JSON.stringify({nOff:'Keep this private scouting note'}),rating:4});return JSON.stringify(recOf(p));},lemar.id);
 await page.evaluate(()=>renderScouting(true));assert.equal(await page.evaluate(id=>JSON.stringify(recOf(player(id))),lemar.id),preserved);
 assert.equal(await page.locator('.mx-player .mx-club').evaluate(e=>e.classList.contains('dq-missing')),false);
 await page.screenshot({path:path.resolve(root,'../roma-desktop.png'),animations:'disabled'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.mx-player .mx-club').evaluate(e=>e.classList.contains('dq-missing')),false);
 await page.evaluate(id=>{openEditModal(id);},lemar.id);await page.locator('#ep2Status').waitFor();assert.equal(await page.locator('#ep2Status').inputValue(),'Under contract');assert.equal(await page.locator('#ep2ClubSearch').inputValue(),'Maxima Roma');await page.locator('#ep2Cancel').click();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,romaPlayers:data.length,allSignedUnderContract:true,noFalseYellowClubWarning:true,lemarJersey11:true,clubsResolveAcrossViews:true,romaClubsSeparate:true,notesAndRatingsPreserved:true,noExpiryInvented:true,desktopAndPhone:true,externalRequestsBlocked:true}));
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
