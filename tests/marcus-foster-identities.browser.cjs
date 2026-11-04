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

  const result=await page.evaluate(async()=>{
   const raw={schema:1,quality_policy:'accepted_live_boxscores_only',generated:'2026-11-04T10:12:12Z',fixtures:[],leagues:[
    {meta:{id:'dragons-bbl-329',name:'German BBL',season:'2026/27',privateOwnerFeed:true},teams:[{code:'dragons-team-247',name:'Telekom Baskets Bonn'}],players:[{id:'dragons-bbl-329-player-1116',code:'dragons-player-1116',name:'Marcus Foster',team:'dragons-team-247',teamName:'Telekom Baskets Bonn',born:1995,height:191,g:7,ppg:8.86,gameLog:[['2026-11-01','ALBA','H',1,95,88,22,10]]}]},
    {meta:{id:'dragons-ec-97',name:'EuroCup',season:'2026/27',privateOwnerFeed:true},teams:[{code:'dragons-team-204',name:'PAOK Thessaloniki'}],players:[{id:'dragons-ec-97-player-1116',code:'dragons-player-1116',name:'Marcus Foster',team:'dragons-team-204',teamName:'PAOK Thessaloniki',born:1995,height:191,g:6,ppg:15,gameLog:[['2026-11-03','ROMA','H',1,80,75,23,15]]}]}]};
   const stats=rows=>JSON.stringify(rows.map(p=>({id:p.id,g:p.g,ppg:p.ppg,gameLog:p.gameLog}))),beforeStats=stats(raw.leagues.flatMap(l=>l.players));
   STATE.data=EuroScoutDragons.connectData(STATE.data,structuredClone(raw));rebuildLinks();applyOverrides();
   const bonn=allPlayersEvery().find(p=>p.id==='bbl-2001733'),paok=allPlayersEvery().find(p=>p.id==='eurocup-010386');if(!bonn||!paok)throw Error('Missing Foster fixture identities');
   await Store.save(bonn.id,{report:JSON.stringify({nOff:'Bonn note written during the ALBA game',_history:[{id:'bonn-history',report:{nOff:'Earlier Bonn note'}}]}),rating:3},{waitForCloud:false});await Store.save(paok.id,{report:JSON.stringify({nOff:'Separate PAOK scouting note'}),rating:4},{waitForCloud:false});
   const recordsBefore=JSON.stringify([Store.get(bonn.id),Store.get(paok.id)]);
   // Old cloud links, including an indirect chain, must not defeat separation.
   OVR.links.push([bonn.id,paok.id],[bonn.id,'enbl-97'],['enbl-97','jbl-31']);localStorage.setItem('euroscout:mergeCenter:v1',JSON.stringify({merges:[{id:'legacy-bad-foster',type:'player',source:paok.id,survivor:bonn.id,at:'2026-10-15T10:00:00Z'}],batches:[]}));
   rebuildLinks();applyOverrides();rebuildLinks();
   const B=allPlayersEvery().find(p=>p.id==='dragons-bbl-329-player-1116'),P=allPlayersEvery().find(p=>p.id==='dragons-ec-97-player-1116');
   const result={bonn:{gid:gid(B),born:B.born,date:B.birthDate,height:B.height,img:B.img,lines:personLines(B).map(p=>p.id),notes:reportRecords(B).map(r=>r.report).filter(Boolean)},paok:{gid:gid(P),born:P.born,date:P.birthDate,lines:personLines(P).map(p=>p.id),notes:reportRecords(P).map(r=>r.report).filter(Boolean)},statsPreserved:stats([B,P])===beforeStats,notesPreserved:JSON.stringify([Store.get(bonn.id),Store.get(paok.id)])===recordsBefore,automaticMatch:EuroScoutMergeCenter.automaticPlayerMatch({name:B.name,born:B.born,player:B},{name:P.name,born:P.born,player:P})};
   STATE.view='scouting';STATE.scouting.a=allClubs().find(c=>c.name==='Telekom Baskets Bonn').key;STATE.scouting.b=allClubs().find(c=>c.name==='ALBA BERLIN').key;render();ESQuickStats.open(B);return result;
  });
  assert.notEqual(result.bonn.gid,result.paok.gid);assert.equal(result.bonn.born,2002);assert.equal(result.bonn.date,'2002-01-06');assert.equal(result.bonn.height,196);assert(result.bonn.img.includes('2004437'));assert.equal(result.paok.born,1995);assert.equal(result.paok.date,'1995-06-03');assert(!result.bonn.lines.includes('eurocup-010386'));assert(!result.paok.lines.includes('bbl-2001733'));assert(!result.bonn.lines.some(id=>result.paok.lines.includes(id)));assert(result.statsPreserved&&result.notesPreserved);assert(!result.automaticMatch);assert(result.bonn.notes.some(n=>n.includes('Bonn note'))&&!result.bonn.notes.some(n=>n.includes('Separate PAOK')));assert(result.paok.notes.some(n=>n.includes('Separate PAOK'))&&!result.paok.notes.some(n=>n.includes('Bonn note')));
  const shown=await page.locator('#qsPanel .qs-filters').innerText();assert(shown.includes('Telekom Baskets Bonn'));assert(!shown.includes('PAOK'));assert(shown.includes('7 g'));assert.deepEqual(errors,[]);await page.locator('#qsLine').selectOption({label:'German BBL · Telekom Baskets Bonn · 7 g'});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.resolve(root,'../marcus-foster-separated.png')});console.log(JSON.stringify({passed:true,...result,quickStats:shown,realCloudRequests:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
