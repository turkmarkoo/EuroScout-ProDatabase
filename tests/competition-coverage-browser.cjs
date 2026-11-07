const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const page=await b.newPage({viewport:{width:1600,height:900}}),errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='euro.test')return r.request().resourceType()==='image'?r.continue():r.abort();
 if(u.pathname==='/euroscout-access.js')return r.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{email:'test@example.com',uid:'test'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve(null),saveState:async function(s){this.state=s;return true;},refresh:async()=>false,get:async()=>null,field:()=>null};ESAccess.ready=Promise.resolve(ESAccess);`});
 const f=path.resolve(root,u.pathname.slice(1)||'index.html');return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});});

 try{
 await page.goto('https://euro.test/index.html#matchup',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof ESSessions!=='undefined'&&STATE.data?.leagues?.length,{},{timeout:60000});
 await page.evaluate(async()=>{await loadMatchupRosterScripts();await ESFixtures.refresh(false);
 const a=canonKey('bbl|BON'),b=canonKey('bbl|ALB');
 const cs=allClubs().filter(c=>(c.teams||[]).some(t=>t.lg==='bbl'));if(cs.length<2)throw Error('BBL teams missing');
 const A=cs[0],B=cs[1];window.testTeam=A.key;
 localStorage.setItem('euroscout:sessions:v1',JSON.stringify({sessions:[{id:'coverage-test',a:{key:A.key,name:A.name},b:{key:B.key,name:B.name},competition:{id:'bbl',name:'German BBL'},gameDate:'2026-10-01',watchedOn:['2026-11-07'],startedAt:'2026-11-07T10:00:00Z',endedAt:'2026-11-07T12:00:00Z',mode:'Video',players:[]}]}));
 STATE.view='scoutlog';render();});
 await page.locator('[data-tab="comps"]').click();
 const rows=await page.locator('[data-coverage]').count();assert.ok(rows>=1);
 await page.locator('[data-coverage="bbl"]').click();
 await page.locator('.sx-cov-table').waitFor();
 let detail=await page.evaluate(()=>({name:document.querySelector('h1.title')?.textContent,metrics:[...document.querySelectorAll('.sx-cov-metrics strong')].map(e=>+e.textContent),rows:document.querySelectorAll('[data-coverage-team]').length,logos:document.querySelectorAll('.sx-cov-table .clubBadge img').length}));
 console.log('BBL detail',detail);assert.ok(detail.rows===18);assert.equal((await page.evaluate(()=>ESSessions.coverageDetail('eurocup').current)),32);assert.ok(await page.evaluate(()=>ESSessions.coverageDetail('bbl').teams.filter(t=>t.club&&clubLogo(t.club)).length>=10));assert.ok(detail.metrics[1]>=2);
 await page.locator('#sxCoverageSearch').fill('Bonn');assert.ok(await page.locator('[data-coverage-team]').count()>=1);
 await page.locator('#sxCoverageRoster').click();await page.locator('.sx-cov-roster').waitFor();assert.ok(await page.locator('[data-coverage-player]').count()>=10);
 await page.locator('.sx-x').click();assert.equal(await page.locator('#sxCoverageSearch').inputValue(),'Bonn');
 await page.locator('#sxCoverageSearch').fill('');await page.locator('#sxCoverageSort').selectOption('recent');
 assert.ok((await page.locator('.sx-cov-table').innerText()).includes('07/11/2026'));
 await page.locator('[data-coverage-team]').first().click();await page.waitForFunction(()=>[...document.querySelectorAll('.sx-cov-table img')].every(i=>i.complete),null,{timeout:15000}).catch(()=>{});await page.waitForTimeout(600);assert.ok(await page.locator('.sx-cov-layout>.sx-tablewrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:path.resolve('../coverage-desktop.png'),fullPage:true});
 await page.locator('[data-coverage-team]').first().click();await page.locator('.sx-cov-session').first().click();await page.locator('.sx-dialog').waitFor();await page.locator('.sx-x').click();assert.equal(await page.locator('#sxCoverageSort').inputValue(),'recent');
 await page.locator('#sxCoverageFilter').selectOption('never');assert.ok(await page.locator('[data-coverage-team]').count()>0);
 await page.locator('#sxCoverageFilter').selectOption('all');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>MTSTheme.set('dark'));await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.resolve('../coverage-phone-dark.png'),fullPage:true});
 await page.locator('#sxCoverageBack').click();await page.locator('#sxUnscouted').check();
 const ids=await page.locator('[data-coverage]').evaluateAll(es=>es.map(e=>e.dataset.coverage));
 const audits=await page.evaluate(ids=>ids.map(id=>{const d=ESSessions.coverageDetail(id);return{id,teams:d?.teams.length,current:d?.current};}),ids);
 assert.ok(audits.every(x=>typeof x.teams==='number'));console.log('All competition detail models',JSON.stringify(audits));
 assert.deepEqual(errors,[]);console.log('PASS rendered app: competition navigation, logos, team search, current roster, return state, dates, filters, all competitions and phone width.');
 }catch(e){await page.screenshot({path:path.resolve('../coverage-failure.png')});console.log('Browser errors',errors,warnings.slice(-8));throw e;}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
