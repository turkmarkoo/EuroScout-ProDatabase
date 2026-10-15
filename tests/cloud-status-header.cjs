const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),head=html.slice(0,html.indexOf('</head>'));
const inline=[...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const styles=['euroscout-ui.css','euroscout-live-notes.css','euroscout-profile-controls.css','euroscout-cloud-sync.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const access=fs.readFileSync(path.join(root,'euroscout-access.js'),'utf8'),badge=access.slice(access.indexOf('function badge(){'),access.indexOf('\nfunction lock('));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 try{
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><style>'+inline+'\n'+styles+'</style><body class="es-redesign es-nav-collapsed"><header><div class="hwrap"><button id="esMenu">☰</button><div class="gsearch"><input id="globalSearch" placeholder="Search players…"></div><button id="authBtn">Internal Marko Turk</button></div></header><main id="app"><section class="panel" style="height:65vh;padding:20px">Scouting Matchup · Player notes</section></main>');
  await page.addScriptTag({path:path.join(root,'euroscout-cloud-sync.js')});
  await page.evaluate(badge=>{window.api={internal:true};window.drawBadge=new Function(badge+';badge();');drawBadge();window.fixture={state:{kind:'synced',message:'Saved to cloud'},tab:'fixture',backup:async()=>({journals:[]}),retry(){window.retried=true;}};ESCloudSync.mount(fixture);},badge);
  for(const width of [1519,1024,768,390,320]){await page.setViewportSize({width,height:900});for(const kind of ['synced','recovery','pending','saving','offline','retry','conflict','blocked','storage-error']){
   await page.evaluate(kind=>{fixture.state={kind,message:kind==='conflict'?'Saved locally · review conflicting changes':'Full save status for '+kind};dispatchEvent(new Event('euroscout:cloud-status'));},kind);
   const boxes=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,height:r.height};},button=document.querySelector('#esCloudSyncStatus [data-review]'),access=document.querySelector('#esAccessBadge');return{button:rect(button),access:rect(access),header:rect(document.querySelector('body > header')),main:rect(document.querySelector('#app')),label:button.textContent,clip:button.scrollWidth>button.clientWidth,inHeader:!!button.closest('body > header')};});
   assert(boxes.inHeader);assert.equal(boxes.button.height,26);assert.equal(boxes.access.height,26);assert(boxes.button.left>=0&&boxes.access.right<=width);assert(boxes.button.right<=boxes.access.left);assert(boxes.button.bottom<=boxes.header.bottom);assert(boxes.header.bottom<=boxes.main.top+1);assert(!boxes.clip);assert(!boxes.label.includes('review conflicting changes'));checks.push({width,kind,passed:true});
  }
   if(width===1519||width===390)await page.screenshot({path:path.join(root,'../header-'+width+'.png')});
  }
  await page.getByRole('button',{name:/Recovery/}).click();await page.getByRole('heading',{name:'Saving & recovery'}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>{fixture.state={kind:'retry',message:'Saved locally · cloud busy; retrying shortly'};dispatchEvent(new Event('euroscout:cloud-status'));});await page.getByRole('button',{name:/Recovery/}).click();await page.getByRole('button',{name:'Retry sync',exact:true}).click();assert(await page.evaluate(()=>retried));
  await page.evaluate(()=>{document.querySelector('#esCloudSyncStatus').remove();api.internal=false;drawBadge();});assert.equal(await page.locator('#esAccessBadge').textContent(),'🔒 External View');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'../header-validation.json'),JSON.stringify({passed:true,checks,actualGlobalStyles:true,recoveryAndRetryWorking:true,externalBadgeWorking:true,errors},null,2));console.log('PASS 45 header layouts with actual global page styles: equal 26px controls, no content overlap, complete labels, recovery and retry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
