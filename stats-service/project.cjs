/* Materialize statistics through the existing native loader and identity logic.
   This isolated browser never uses the user's browser profile or sends HTTP traffic. */
const fs=require('node:fs'),path=require('node:path');
function stabilize(data,prior){const known=new Map((prior.leagues||[]).flatMap(l=>l.players||[]).map(p=>[p.id,p]));for(const l of data.leagues)for(const p of l.players){const old=known.get(p.id)||known.get(p.linkedEuroScoutId);if(old&&(!p.born||!old.born||Number(p.born)===Number(old.born)))p._canonicalPersonId=old._canonicalPersonId||old.linkedEuroScoutId||old.id;}return data;}
async function project(settings){
 const {chromium}=require(settings.playwrightModule||'playwright'),root=path.resolve(settings.appRoot),dir=path.resolve(settings.privateDir);
 const feed=fs.readFileSync(path.join(dir,'euroscout-feed.json'),'utf8'),board=fs.readFileSync(path.join(dir,'scout-board-feed.json'),'utf8');
 const browser=await chromium.launch({executablePath:settings.chromium,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='stats-projection.invalid')return route.abort();
   if(u.pathname==='/mock-stats.json')return route.fulfill({contentType:'application/json',body:feed});
   if(u.pathname==='/mock-board.json')return route.fulfill({contentType:'application/json',body:board});
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.EUROSCOUT_CONFIG={};'});
   if(u.pathname==='/data/data.json')return route.fulfill({contentType:'application/json',path:settings.baseFile});
   if(u.pathname==='/euroscout-access.js')return route.fulfill({contentType:'text/javascript',body:`window.ESAccess={internal:true,owner:true,user:{uid:'local-projection',email:'markoturk.scouting@gmail.com'},state:{schema:1,records:{},appData:{},seeds:{}},seedReady:Promise.resolve(null),saveState:async()=>false,refresh:async()=>false,get:async p=>({path:p}),field:o=>o.path.startsWith('dragonsBoard')?'b'.repeat(32):'a'.repeat(32),readPayload:async p=>fetch(p==='dragonsBoardSnapshots'?'/mock-board.json':'/mock-stats.json').then(r=>r.text())};ESAccess.ready=Promise.resolve(ESAccess);`});
   const f=path.resolve(root,u.pathname.slice(1)||'index.html');if(!f.startsWith(root+path.sep))return route.abort();
   return fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({path:f}):route.fulfill({status:404,body:''});
  });
  await page.goto('https://stats-projection.invalid/');await page.waitForFunction(()=>window.EuroScoutCatalogueReady&&STATE.data,{},{timeout:180000});
  await page.evaluate(async()=>{await loadExtraLeagues();rebuildLinks();applyOverrides();window.EuroScoutDragons?.finish(STATE.data);});
  if(errors.length)throw Error('Native projection failed: '+errors.join('; '));
  const data=await page.evaluate(()=>{const keep=['id','linkedEuroScoutId','_sourceTeamKey','name','team','teamName','league','born','birthDate','height','img','country','nationalities','role','pos','qualified','statsSeason','_sourceSeason','_rosterOnly','dragonsTotals','statisticsCoverage','fgma','f3ma','ftma','min','pct',...'g mpg ppg rpg apg spg bpg topg drpg fgp f2p f3p ftp ts efg pir eff usg pts40 reb40 ast40 stl40 blk40 tov40 astto ftr r3a pps astp tovp trbp stlp blkp t_min t_pts t_reb t_ast t_stl t_blk t_tov t_fgm t_fga t_f3m t_f3a t_ftm t_fta t_pir'.split(' ')];
   return {generated:EuroScoutDragons.generated(),leagues:STATE.data.leagues.map(l=>({meta:l.meta,teams:l.teams,players:l.players.map(p=>({...Object.fromEntries(keep.filter(k=>p[k]!=null).map(k=>[k,p[k]])),_canonicalPersonId:gid(p),_logCount:(p.gameLog||[]).length,_exactLogTotals:(()=>{const log=p.gameLog||[],cols=l.meta.gameLogCols||[],map={min:'min',pts:'pts',reb:'reb',ast:'ast',stl:'stl',blk:'blk',tov:'tov',pir:'pir',fgm:'fgm',fga:'fga',p3m:'fg3m',p3a:'fg3a',ftm:'ftm',fta:'fta'};return Object.fromEntries(Object.entries(map).flatMap(([key,col])=>{const i=cols.indexOf(col);return log.length===Number(p.g)&&log.length&&i>=0&&log.every(r=>typeof r[i]==='number'&&Number.isFinite(r[i]))?[[key,log.reduce((sum,r)=>sum+r[i],0)]]:[];}));})(),nationalities:(Array.isArray(p.nationalities||p.country)?(p.nationalities||p.country):String(p.nationalities||p.country||'').split(/[;|/]/)).map(c=>window.EuroScoutCountries?.iso(c)||c).filter(Boolean)}))}))};});
  // No notes, ratings, credentials, raw game logs, or private app records leave this loader.
  data.generated=[JSON.parse(feed).generated,JSON.parse(board).generated].filter(Boolean).sort().at(-1);
  if(settings.identitySnapshot&&fs.existsSync(settings.identitySnapshot))stabilize(data,JSON.parse(fs.readFileSync(settings.identitySnapshot,'utf8')));
  const output=path.resolve(settings.projection);if(output.startsWith(root+path.sep))throw Error('Private projections must stay outside the app repository');const temp=output+'.tmp';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(temp,JSON.stringify(data));fs.renameSync(temp,output);
  return {leagues:data.leagues.length,records:data.leagues.reduce((n,l)=>n+l.players.length,0)};
 }finally{await browser.close();}
}
module.exports={project,stabilize};
if(require.main===module)project(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
