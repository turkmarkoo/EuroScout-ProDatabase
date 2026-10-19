const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='euro.test')return route.abort();
  if(u.pathname==='/euroscout-access.js')return route.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{uid:'fixture-user',email:'fixture@example.invalid'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve({core:{season2627:{comps:{}},rumors:{skylinersFixture:true}},seeds:{}}),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
  const f=path.resolve(root,u.pathname.slice(1)||'index.html');return fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({path:f}):route.fulfill({status:404,body:''});
 });
 await page.goto('https://euro.test/');await page.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data?.rumors?.skylinersFixture&&!document.querySelector('#coreLoadStatus'),{},{timeout:90000});
 await page.evaluate(async()=>{
  await loadMatchupRosterScripts();const london=allClubs().find(c=>c.name==='London Lions');
  const game={id:'public-london-frankfurt',date:'2026-10-15',time:'19:30',comp:'eurocup',compName:'EuroCup',round:3,venue:'COPPER BOX ARENA',home:{key:london.key,name:london.name},away:{key:'eurocup|FRA',name:'Skyliners Frankfurt'},hs:76,as:81,played:true};
  ESFixtures.all=()=>[game];ESFixtures.recent=()=>[game];ESFixtures.upcoming=()=>[game];ESFixtures.competitions=()=>[{id:'eurocup',name:'EuroCup',games:1,played:1}];ESFixtures.between=()=>[game];ESFixtures.refresh=async()=>[];
  const history=JSON.stringify({v:1,sessions:[{id:'preserved-history',gameDate:'2026-09-01',a:{key:london.key,name:london.name},b:{key:'eurocup|FRK',name:'Skyliners Frankfurt'},competition:{id:'eurocup',name:'EuroCup'},players:[],note:'Keep this old session'}]});
  localStorage.setItem('euroscout:sessions:v1',history);window.__historyBefore=history;STATE.view='scoutlog';render();
 });
 await page.locator('[data-tab=upcoming]').click();await page.locator('[data-scout]').click();await page.locator('#sxStart').waitFor();
 assert.equal(await page.locator('#sxStart input[name=gameDate]').inputValue(),'2026-10-15');await page.locator('#sxStart [type=submit]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.mx-col[data-slot=b] .rosterRow').length===24);
 const publicProof=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.mx-col[data-slot=b] .rosterRow')],players=rows.map(r=>player(r.dataset.id)),expected=EuroScoutBBL.data.roster.filter(r=>r.teamId==='426');return{count:rows.length,missing:expected.filter(r=>!players.some(p=>[p.id,...(p._grp||[]).map(x=>x.id)].some(id=>r.ids.includes(id)))).map(r=>r.name),moses:players.filter(p=>/Moses/.test(p.name)).length,keys:['bbl|FRS','eurocup|FRK','eurocup|FRA'].map(canonKey),junior:canonKey('directory|germany-skyliners-juniors')};});
 assert.equal(publicProof.count,24);assert.deepEqual(publicProof.missing,[]);assert.equal(publicProof.moses,1);assert.equal(new Set(publicProof.keys).size,1);assert.notEqual(publicProof.junior,publicProof.keys[0]);
 const moses=await page.evaluate(()=>[...document.querySelectorAll('.mx-col[data-slot=b] .rosterRow')].find(r=>/Moses/.test(player(r.dataset.id).name)).dataset.id);
 await page.locator(`.mx-col[data-slot=b] .rosterRow[data-id="${moses}"]`).click();
 const saved=await page.evaluate(async id=>{const p=player(id);await saveRec(p,{report:JSON.stringify({nOff:'Keep my Frankfurt scouting note',_history:[{id:'keep-revision',report:{nOff:'Original note'}}]}),jerseyNumbers:{'2026/27|eurocup|FRA':'00'},rating:4});renderScouting(true);return JSON.stringify(recOf(p));},moses);
 assert.equal(await page.locator('#liveNumber').textContent(),'Jersey #00');
 for(const key of ['eurocup|FRK','eurocup|FRA','bbl|FRS']){
  await page.evaluate(key=>{ESSessions.update({b:{key,name:'Skyliners Frankfurt'}});renderScouting();},key);
  assert.equal(await page.locator('.mx-col[data-slot=b] .rosterRow').count(),24);
 }
 const preserved=await page.evaluate(id=>({record:JSON.stringify(recOf(player(id))),history:localStorage.getItem('euroscout:sessions:v1'),active:ESSessions.active()}),moses);
 assert.equal(preserved.record,saved);assert.equal(preserved.history,await page.evaluate(()=>__historyBefore));assert.equal(preserved.active.gameDate,'2026-10-15');assert.equal(preserved.active.scoreA,'76');assert.equal(preserved.active.scoreB,'81');
 assert.deepEqual(errors,[]);await page.screenshot({path:path.resolve(root,'../matchup-desktop.png')});
 await page.setViewportSize({width:768,height:900});assert.equal(await page.locator('.mx-col[data-slot=b] .rosterRow').count(),24);
 console.log(JSON.stringify({passed:true,scoutGameFromLog:true,players:24,mosesRows:1,allSourceKeysResolve:true,juniorsSeparate:true,notesRatingsJerseysAndHistoryPreserved:true,desktopAndTablet:true,externalRequestsBlocked:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
