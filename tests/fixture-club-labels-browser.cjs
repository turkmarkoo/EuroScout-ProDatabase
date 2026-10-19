const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='euro.test')return route.abort();
  if(u.pathname==='/euroscout-access.js')return route.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{uid:'fixture-user',email:'fixture@example.invalid'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve({core:{season2627:{comps:{}},rumors:{labelsFixture:true}},seeds:{}}),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
  const f=path.resolve(root,u.pathname.slice(1)||'index.html');return fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({path:f}):route.fulfill({status:404,body:''});
 });
 await page.goto('https://euro.test/');await page.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data?.rumors?.labelsFixture&&!document.querySelector('#coreLoadStatus'),{},{timeout:90000});
 await page.evaluate(async()=>{
  await loadMatchupRosterScripts();
  const games=[
   {comp:'eurocup',compName:'EuroCup',league_id:'dragons-ec-26',date:'2026-10-14',time:'20:00',round:'Round 3',home:{code:'dd-tofas',name:'Tofas Bursa',key:'eurocup|BUR'},away:{code:'dd-bud',name:'Buducnost VOLI Podgorica'},hs:90,as:85,played:true,venue:'TOFAS SPOR SALONU'},
   {comp:'eurocup',compName:'EuroCup',league_id:'dragons-ec-26',date:'2026-10-14',time:'20:30',round:'Round 3',home:{code:'dd-burgos',name:'Recoletas Salud San Pablo Burgos'},away:{code:'dd-hapoel',name:'Hapoel Midtown Jerusalem'},hs:84,as:85,played:true,venue:'COLISEUM BURGOS'},
   {comp:'bcl',compName:'Basketball Champions League',date:'2026-10-14',round:'Regular Season',home:{code:'none-a',name:'Public team A'},away:{code:'none-b',name:'Public team B'},hs:97,as:86,played:true}
  ];
  window.__fixturesBefore=JSON.stringify(games);window.__fixtureRows=games;EuroScoutDragons.active=()=>true;EuroScoutDragons.fixtures=()=>games;await ESFixtures.refresh(true);
  const history=JSON.stringify({v:1,sessions:[{id:'preserved-history',gameDate:'2026-09-01',a:{key:'acb|BUR',name:'Burgos'},b:{key:'other',name:'Other'},competition:{id:'eurocup',name:'EuroCup'},players:[],note:'Keep old scouting history'}]});
  localStorage.setItem('euroscout:sessions:v1',history);window.__historyBefore=history;STATE.view='scoutlog';render();
 });
 await page.locator('[data-tab=upcoming]').click();await page.selectOption('#sxUpComp','eurocup');
 const tofas=page.locator('.sx-fixt tr').filter({hasText:'TOFAS SPOR SALONU'}),burgos=page.locator('.sx-fixt tr').filter({hasText:'COLISEUM BURGOS'});
 assert.match(await tofas.textContent(),/Tofas Bursa/);assert.doesNotMatch(await tofas.textContent(),/Burgos|RRound/);assert.match(await tofas.textContent(),/Round 3/);assert.match(await burgos.textContent(),/Recoletas Salud San Pablo Burgos/);
 await page.screenshot({path:path.resolve(root,'../fixtures-desktop.png')});
 await tofas.locator('[data-scout]').click();await page.locator('#sxStart').waitFor();
 const dialog=await page.locator('#sxStart').evaluate(f=>({home:f.elements.a.value,away:f.elements.b.value,stage:f.elements.stage.value,scoreA:f.elements.scoreA.value,scoreB:f.elements.scoreB.value,venue:f.elements.venue.value}));
 assert.equal(dialog.home,await page.evaluate(()=>canonKey('bcl|TOF')));assert.equal(dialog.stage,'Round 3');assert.equal(dialog.scoreA,'90');assert.equal(dialog.scoreB,'85');assert.equal(dialog.venue,'TOFAS SPOR SALONU');
 await page.locator('#sxStart [type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('.mx-col[data-slot=a] .rosterRow').length>5);
 assert.match(await page.locator('.mx-col[data-slot=a] .scoutTeamButton').textContent(),/Tofas/i);
 assert.equal(await page.evaluate(()=>localStorage.getItem('euroscout:sessions:v1')),await page.evaluate(()=>__historyBefore));
 assert.equal(await page.evaluate(()=>JSON.stringify(__fixtureRows)),await page.evaluate(()=>__fixturesBefore));
 await page.evaluate(()=>{STATE.view='scoutlog';render();});await page.selectOption('#sxUpComp','bcl');
 const stages=await page.locator('.sx-fixt .sx-fcomp').allTextContents();assert(stages.some(s=>/· Regular Season$/.test(s)));assert(stages.every(s=>!s.includes('RRegular')));
 await page.setViewportSize({width:390,height:844});await page.selectOption('#sxUpComp','eurocup');assert.match(await page.locator('.sx-fixt tr').filter({hasText:'TOFAS SPOR SALONU'}).textContent(),/Tofas Bursa/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,actualGameLogAndScoutButton:true,tofasRoster:true,burgosSeparate:true,roundLabels:true,regularSeason:true,desktopAndPhone:true,historyAndSourcePreserved:true,externalRequestsBlocked:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
