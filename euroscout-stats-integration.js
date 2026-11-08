/* Feature-gated server-query workspace. The existing tools/profiles remain the renderers. */
(function(){'use strict';
const endpoint=window.EUROSCOUT_CONFIG?.statsEndpoint;if(!endpoint)return;
let context=null,rows=[],loading=null;
let resumeJob=null;
async function resume(){if(!window.ES_QUERY_MODE)return;return resumeJob||(resumeJob=(async()=>{window.ES_QUERY_MODE=false;await ESAccess.ensureWorkspace();await boot();if(!window.EuroScoutCatalogueReady)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Player detail is delayed. Please retry.')),90000);window.addEventListener('euroscout:catalogue-ready',()=>{clearTimeout(timer);resolve();},{once:true});});})().catch(error=>{resumeJob=null;throw error;}));}
window.ESStatsEntry={start:async()=>{await ESAccess.ready;if(!ESAccess.internal){document.querySelector('#app').textContent='Open statistics from DragonsHub to sign in.';return;}STATE.view='players';document.querySelectorAll('#tabs [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='players'));const auth=document.querySelector('#authBtn');if(auth){auth.textContent='Internal';auth.title=ESAccess.user.email;}await ESStats.mount(document.querySelector('#app'),{navigate:tools,view:'players'});document.querySelector('#tabs').addEventListener('click',async e=>{const b=e.target.closest('[data-view]');if(!b||!window.ES_QUERY_MODE)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.view==='players'){STATE.view='players';renderPlayers();return;}await resume();STATE.view=b.dataset.view;render();},true);}};
const active=()=>context&&['compare','charts','fit'].includes(STATE.view)&&!DRAWER_OPEN;
const nativePlayer=player,nativeFlat=allPlayersFlat,nativeScout=scoutPool,nativeCharts=chartPool,nativeOpen=openProfile;
openProfile=async function(id,...args){id=rows.find(p=>p.id===id)?._nativeProfileId||id;if(window.ES_QUERY_MODE){try{await resume();}catch(e){alert(e.message);return;}}return nativeOpen(id,...args);};
function scopeHeader(){if(!active())return;const app=document.querySelector('#app');app.querySelector('.st-tool-scope')?.remove();app.insertAdjacentHTML('afterbegin','<p class="hint st-tool-scope">Season '+esc(context.season)+' · '+rows.length+' selected player/competition records · <button class="btn" id="stBackToStats">Back to Stats</button></p>');document.querySelector('#stBackToStats').onclick=()=>{STATE.view='players';render();};}
for(const [name,original] of [['renderCompare',renderCompare],['renderCharts',renderCharts],['renderFitFinder',renderFitFinder]])window[name]=function(...args){original(...args);scopeHeader();};
player=function(id){return active()&&rows.find(p=>p.id===id)||nativePlayer(id);};
allPlayersFlat=function(){return active()?rows:nativeFlat();};
scoutPool=function(){return active()?rows:nativeScout();};
chartPool=function(){if(!active())return nativeCharts();const c=STATE.charts;return rows.filter(p=>(!c.fLeague||c.fLeague==='all'||p.league===c.fLeague)&&(!c.fTeam||p.team===c.fTeam)&&(!c.fCountry||p.country===c.fCountry)&&(!c.fRole||p.role===c.fRole));};
window.EUROSCOUT_STATS_CONFIG={endpoint,fetch:async(url,options)=>{
 const target=new URL(url,location.href),allowed=new URL(endpoint,location.href);
 if(target.origin!==allowed.origin||!target.pathname.startsWith(allowed.pathname.replace(/\/$/,'')+'/'))throw Error('Invalid statistics endpoint');
 return ESAccess.authorizedFetch(url,options);
},openProfile:async id=>{try{const progress=document.querySelector('.st-notice');if(progress)progress.textContent='Opening player profile…';await resume();STATE.view='players';render();openProfile(id);}catch(e){alert(e.message);}}};
async function tools(view,scope){
 const progress=document.querySelector('#stResults');if(progress)progress.innerHTML='<div class="st-loading" role="status">Preparing the selected season for '+view+'…</div>';
 loading?.abort();loading=new AbortController();const signal=loading.signal;
 const app=document.querySelector('#app');app.innerHTML='<section class="es-stats"><div class="st-loading" role="status">Loading the selected season for '+({compare:'Compare',charts:'Charts',fit:'Fit Finder'}[view])+ '…</div></section>';
 try{
  // Only fetch analytics fields once the user explicitly requests a tool.
  const fields='g,mpg,ppg,rpg,apg,spg,bpg,topg,drpg,fgp,f2p,f3p,ftp,ts,efg,pir,usg,pts40,reb40,ast40,stl40,blk40,tov40,astto';
  const params=new URLSearchParams({season:scope.season,qualified:scope.qualified?'1':'0',q:scope.q,sort:scope.sort,direction:scope.direction,size:100,fields});
  for(const key of ['competitions','teams','positions','countries'])for(const v of scope[key])params.append(key,v);
  const get=async page=>{params.set('page',page);const r=await EUROSCOUT_STATS_CONFIG.fetch(endpoint+'/query?'+params,{signal});if(!r.ok)throw Error('Could not load the selected statistics');return r.json();};
  const first=await get(1),records=[...first.rows];
  for(let page=2;records.length<first.total;page++){const next=await get(page);if(next.version!==first.version)throw Error('Statistics changed during loading. Please retry.');if(!next.rows.length)break;records.push(...next.rows);}
  if(signal.aborted)return;
  rows=records.map(r=>({...(STATE.data?.leagues?nativePlayer(r.profileId):{}),...r.metrics,id:'stats:'+r.id,_nativeProfileId:r.profileId,name:r.name,league:r.sourceLeagueId,team:r.teamCode,teamName:r.team,img:r.photo,born:r.born,height:r.height,role:r.role,country:r.countries.map(c=>window.EuroScoutCountries?.names?.find(n=>EuroScoutCountries.iso(n)===c)||c).join(' / '),qualified:r.qualified,pct:{},z:{},arch:[],_grp:null,_statRecord:true,_statsRecordId:r.id}));
  if(window.ES_QUERY_MODE){const leagues=new Map();for(const r of records){if(!leagues.has(r.sourceLeagueId))leagues.set(r.sourceLeagueId,{meta:{id:r.sourceLeagueId,name:r.competitionName,season:r.season,playerCount:0,minGames:0,minMpg:0},players:[],teams:[],statMeta:{}});const l=leagues.get(r.sourceLeagueId);l.players.push(rows.find(p=>p._statsRecordId===r.id));if(!l.teams.some(t=>t.code===r.teamCode))l.teams.push({code:r.teamCode,name:r.team,logo:r.teamLogo});l.meta.playerCount=l.players.length;}STATE.data={leagues:[...leagues.values()]};STATE.league=STATE.data.leagues[0];}
  context=scope;STATE.view=view;STATE.charts.fLeague='all';STATE.charts.fTeam='';STATE.charts.fCountry='';STATE.charts.fRole='';STATE.compare.slots=[null,null,null,null];render();
  scopeHeader();
 }catch(e){if(e.name!=='AbortError'){app.innerHTML='<section class="empty">'+esc(e.message)+' <button class="btn" id="stToolBack">Back to Stats</button></section>';document.querySelector('#stToolBack').onclick=()=>{STATE.view='players';render();};}}
}
renderPlayers=function(){loading?.abort();context=null;ESStats.mount(document.querySelector('#app'),{navigate:tools,view:'players'});};
})();
