const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='euro.test')return r.abort();
 if(u.pathname==='/euroscout-access.js')return r.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{email:'test@example.com',uid:'test'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve(null),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
 const f=path.resolve(root,u.pathname.slice(1)||'index.html');return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
 try{
 await page.goto('https://euro.test/index.html#matchup',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof STATE!=='undefined'&&STATE.data?.leagues.some(l=>l.meta.id==='fec26')&&typeof ESSessions!=='undefined'&&typeof allClubs==='function',{},{timeout:60000});
 await page.evaluate(async()=>{await loadMatchupRosterScripts();await ESFixtures.refresh(false);STATE.view='scouting';STATE.scouting.a=canonKey('fec26|LANL');STATE.scouting.b=canonKey('fec26|LION');render();});
 await page.getByRole('button',{name:'Start session',exact:true}).click();
 await page.locator('#sxStart').waitFor();
 await page.waitForFunction(()=>document.querySelector('#sxStart')?.elements.comp.value==='fec');
 const dialog=await page.evaluate(()=>{const e=document.querySelector('#sxStart').elements;return{a:e.a.value,b:e.b.value,competition:e.comp.value,date:e.gameDate.value,scoreA:e.scoreA.value,scoreB:e.scoreB.value,round:e.stage.value,games:e.known.options.length};});
 assert.equal(dialog.date,'2026-10-07');assert.equal(dialog.scoreA,'83');assert.equal(dialog.scoreB,'105');assert.equal(dialog.round,'Round 1');assert.ok(dialog.games>=2);
 console.log('FEC rendered dialog:',JSON.stringify(dialog));
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{STATE.scouting.a=canonKey('lba|BDBT');STATE.scouting.b=canonKey('lnb|LEM');render();});
 const rosters=await page.locator('.mx-col').evaluateAll(cols=>cols.map(c=>({team:c.querySelector('.scoutTeamButton').textContent.trim(),count:c.querySelectorAll('.rosterRow').length})));
 assert.ok(rosters.length===2&&rosters.every(r=>r.count>=12));console.log('EuroCup visible rosters:',JSON.stringify(rosters));
 await page.getByRole('button',{name:'Start session',exact:true}).click();
 await page.locator('#sxStart').waitFor();
 const euro=await page.evaluate(()=>{const e=document.querySelector('#sxStart').elements;return{a:e.a.value,b:e.b.value,competition:e.comp.value,options:[...e.comp.options].map(o=>o.value)};});
 assert.equal(euro.competition,'eurocup');assert.ok(!euro.options.includes('bcl'));console.log('EuroCup rendered dialog:',JSON.stringify(euro));
 await page.screenshot({path:path.resolve('../session-dialog-browser-20261008.png')});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const target=await page.locator('.mx-col[data-slot="b"] .rosterRow').first().getAttribute('data-id');
 await page.evaluate(async id=>{const p=player(id);await saveRec(p,{report:JSON.stringify({nOff:Array.from({length:55},(_,i)=>'Browser test observation '+i).join('\n'),_workflow:{viewings:[{id:'sept-test',sessionId:'lost-september',source:'session',event:'Baglietto Derthona Tortona vs Le Mans Sarthe Basket',date:'2026-09-25',gameDate:'2026-09-24',competition:'BCL Qualifiers',status:'notes'}]}})});render();},target);
 await page.locator('.mx-col[data-slot="b"] .rosterRow').first().click();
 for(const selector of ['.mx-col[data-slot="a"] .rosterList','.mx-col[data-slot="b"] .rosterList','#liveBullets']){
  const el=page.locator(selector);await el.evaluate(e=>e.scrollTop=0);const box=await el.boundingBox();assert.ok(box);
  console.log('Scroll target',selector,box,await el.evaluate(e=>({h:e.clientHeight,s:e.scrollHeight,overflow:getComputedStyle(e).overflowY,hit:document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2)?.className})));
  await page.mouse.move(box.x+box.width/2,Math.min(700,box.y+box.height/2));await page.mouse.wheel(0,600);
  await page.waitForFunction(selector=>document.querySelector(selector)?.scrollTop>0,selector,{timeout:3000});
  console.log('Wheel scrolling:',selector,await el.evaluate(e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight})));
 }
 const preserved=await page.evaluate(async id=>{const p=player(id),r=parseReport(recOf(p).report),oldNotes=r.nOff;
  localStorage.setItem('euroscout:sessions:v1',JSON.stringify({v:1,sessions:[{id:'newer-test',gameDate:'2026-10-08',startedAt:'2026-10-08',a:{key:'lba|BDBT',name:'Tortona'},b:{key:'lnb|LEM',name:'Le Mans'},players:[]}]}));
  const old=ESSessions.everything().find(s=>s.recoveredSessionId==='lost-september');if(!old)throw Error('Orphan missing from rendered app history');
  await ESSessions.adopt(old);const records=JSON.parse(localStorage.getItem('euroscout:records')),report=parseReport(records[gid(p)]?.report||records[p.id]?.report);
  return{retainedNewer:ESSessions.all().some(s=>s.id==='newer-test'),notesUnchanged:report.nOff===oldNotes,historyLinked:report._workflow.viewings.some(v=>v.id==='sept-test'&&v.sessionId!=='lost-september'),backup:JSON.parse(localStorage.getItem('euroscout:sessions:v1:last-good')).sessions.some(s=>s.id==='newer-test')};},target);
 assert.ok(Object.values(preserved).every(Boolean));console.log('Additive recovery preservation:',JSON.stringify(preserved));
 assert.deepEqual(errors,[]);console.log('PASS actual Chromium app: both current competition dialogs, FEC game details, both EuroCup rosters, no application errors.');
 }catch(e){await page.screenshot({path:path.resolve('../session-failure-20261008.png')});console.log('Diagnostics:',await page.evaluate(()=>({ready:typeof STATE!=='undefined'&&!!STATE.data,leagues:typeof STATE!=='undefined'&&STATE.data?.leagues.map(l=>l.meta.id),body:document.body.innerText.slice(-1200)})),errors,warnings.slice(-5));throw e;}
 finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
