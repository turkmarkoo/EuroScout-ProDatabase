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
   const targets=[{name:'Kovliar',ids:['aba-5072','eurocup-013247','montenegro-rg120866-rgteam-67']},{name:'Jovanovic',ids:['aba-3750','eurocup-010307','montenegro-rg152276-rgteam-67']},{name:'Roedl',ids:['bbl-2003893','eurocup-008216']}];
   const results=[];
   for(const target of targets){const rows=target.ids.map(id=>allPlayersEvery().find(p=>p.id===id));if(rows.some(p=>!p))throw Error('Missing fixture '+target.name);const statsBefore=JSON.stringify(rows.map(p=>({id:p.id,league:p.league,gameLog:p.gameLog,g:p.g,ppg:p.ppg})));for(const p of rows)await Store.save(p.id,{...Store.get(p.id),report:JSON.stringify({nOff:'Synthetic note on '+p.id}),rating:3},{waitForCloud:false});const ids=rows.map(p=>gid(p)),notes=reportRecords(rows[0]).map(r=>parseReport(r.report).nOff).filter(Boolean);if(!target.ids.every(id=>notes.some(n=>n.includes(id))))throw Error('Missing linked note '+target.name);if(statsBefore!==JSON.stringify(rows.map(p=>({id:p.id,league:p.league,gameLog:p.gameLog,g:p.g,ppg:p.ppg}))))throw Error('Changed stats '+target.name);results.push({name:target.name,sourceIds:target.ids,canonicalIds:[...new Set(ids)],linkedNotes:notes.length,sourceStatisticsPreserved:true});}
   const cs=allClubs();STATE.scouting.a=cs.find(c=>/Budu.*nost/.test(c.name)).key;STATE.scouting.b=cs.find(c=>/NINERS Chemnitz/.test(c.name)).key;STATE.view='scouting';render();
   const roster=[...document.querySelectorAll('.rosterRow')].map(r=>({id:r.dataset.id,text:r.textContent.trim(),title:r.title}));return {targets:results,roster,catalogueRows:allPlayersEvery().length};
  });
  for(const target of result.targets)assert.equal(target.canonicalIds.length,1,target.name+' identity');
  const patterns=[/Kovl|Kovly/i,/Djordije Jovan|Dordije Jovan|Đorđije Jovan/i,/Elias R[oö]/i];for(const pattern of patterns)assert.equal(result.roster.filter(r=>pattern.test(r.title)).length,1,'One roster row for '+pattern);
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
