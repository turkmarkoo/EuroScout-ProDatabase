/* DragonsHub statistics. Never cache or copy this feed into scouting snapshots. */
(function(){'use strict';
let feed=null,problem='',links=[];
const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const reader=()=>window.ESAccess?.internal&&!!ESAccess.user;
const allPlayers=raw=>(raw.leagues||[]).flatMap(league=>league.players||[]);

function valid(data){
 if(data.schema!==1||data.quality_policy!=='accepted_live_boxscores_only'||!Array.isArray(data.leagues)||!Array.isArray(data.fixtures))throw Error('Invalid Dragons Data feed.');
 if(data.leagues.some(league=>!league.meta?.privateOwnerFeed||!league.meta.id?.startsWith('dragons-')||!Array.isArray(league.players)))throw Error('Invalid owner-only league.');
 return data;
}
async function fetchLocal(timeout=12000){
 if(typeof fetch!=='function')return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch('http://127.0.0.1:8767/api/v1/euroscout-feed',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Local Dragons Data returned '+response.status);return Object.assign(valid(await response.json()),{_sourceLabel:'local snapshot'});}
 finally{clearTimeout(timer);}
}
function officialDirectory(){
 const teams=[],players=[];
 const euro=window.EUROSCOUT_EUROCUP_ROSTERS;
 if(euro)for(const team of euro.teams||[]){
  const entry={key:'eurocup:'+team.code,dbKey:'eurocup|'+team.code,code:team.code,officialCode:team.code,name:team.name,aliases:team.aliases||[]};teams.push(entry);
  for(const row of (euro.roster||[]).filter(player=>player.teamCode===team.code))players.push({team:entry,name:row.name,ids:row.ids||[],row});
 }
 const official=window.EUROSCOUT_OFFICIAL_ROSTERS;
 if(official)for(const team of official.teams||[]){
  const entry={key:'official:'+team.id,dbKey:team.currentKey||team.key||'',code:team.code||team.id,officialCode:team.code||'',name:team.name,aliases:team.aliases||[]};teams.push(entry);
  for(const row of (official.roster||[]).filter(player=>player.teamId===team.id))players.push({team:entry,name:row.name,ids:row.ids||[row.id],row});
 }
 const fiba=window.EUROSCOUT_FIBA_CLUB_2026;
 if(fiba)for(const team of fiba.teams||[]){
  const entry={key:'fiba:'+team.id,dbKey:team.currentKey||team.key||'',code:team.code||team.id,officialCode:team.officialCode||team.code||'',name:team.name,aliases:team.aliases||[]};teams.push(entry);
  for(const row of (fiba.roster||[]).filter(player=>player.teamId===team.id))players.push({team:entry,name:row.name,ids:row.ids||[row.id],row});
 }
 return {teams,players};
}
function directTeamMatch(source,directory){
 const code=clean(source.team),name=clean(source.teamName),queries=[code,name].filter(Boolean);
 const cacheKey=code+'|'+name;if(directory.teamCache?.has(cacheKey))return directory.teamCache.get(cacheKey);
 let matches=directory.teams.filter(team=>[team.code,team.name,...team.aliases].some(alias=>queries.includes(clean(alias))));
 if(matches.length===1){directory.teamCache?.set(cacheKey,matches[0]);return matches[0];}
 matches=directory.teams.filter(team=>[team.name,...team.aliases].some(alias=>queries.some(query=>{
  const candidate=clean(alias);return query.length>=6&&candidate.length>=6&&(candidate.startsWith(query+' ')||query.startsWith(candidate+' '));
 })));
 const match=matches.length===1?matches[0]:null;directory.teamCache?.set(cacheKey,match);return match;
}
function teamMatch(source,directory){
 const code=clean(source.team),name=clean(source.teamName);
 const mapped=directory.feedTeams?.get(code)||directory.feedTeams?.get(name);return mapped||directTeamMatch(source,directory);
}
function feedTeamDirectory(data,directory){
 const mapped=new Map();
 const add=(side,officialCode)=>{
  if(!side)return;
  if(typeof side==='string')side={name:side};
  const code=side.code??side.id??side.key??side.teamId??side.team, name=side.name??side.teamName??side.clubName??side.label;
  const hinted=officialCode&&directory.teams.filter(team=>clean(team.officialCode)===clean(officialCode));
  const match=hinted?.length===1?hinted[0]:directTeamMatch({team:code,teamName:name},directory);if(!match)return;
  for(const value of [code,name])if(clean(value))mapped.set(clean(value),match);
 };
 for(const fixture of data.fixtures||[]){
  const slug=String(fixture.source_url||'').split('/').filter(Boolean).pop()||'',codes=/^\d+-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(slug);
  add(fixture.home,codes?.[1]);add(fixture.away,codes?.[2]);
  for(const key of ['homeTeam','awayTeam','teamA','teamB','a','b'])add(fixture?.[key]);
  for(const side of fixture?.teams||fixture?.participants||[])add(side);
 }
 for(const league of data.leagues||[])for(const team of league.teams||[])add(team);
 return mapped;
}
function abbreviationMatches(shortName,fullName){
 const a=clean(shortName).split(' ').filter(Boolean),b=clean(fullName).split(' ').filter(Boolean);
 if(!a.length||!b.length)return false;if(a.join(' ')===b.join(' '))return true;if(a.length<2||b.length<2)return false;
 return a[0][0]===b[0][0]&&(a.slice(1).join(' ')===b.slice(1).join(' ')||a.slice(1).join(' ')===b[b.length-1]);
}
function resolve(source,directory,raw){
 const byId=directory.byId||(directory.byId=new Map(allPlayers(raw).map(player=>[player.id,player])));
 if(!directory.playersByTeam){directory.playersByTeam=new Map();for(const item of directory.players){const roster=directory.playersByTeam.get(item.team)||[];roster.push(item);directory.playersByTeam.set(item.team,roster);}}
 if(source.linkedEuroScoutId&&byId.has(source.linkedEuroScoutId))return {id:source.linkedEuroScoutId,player:byId.get(source.linkedEuroScoutId)};
 const team=teamMatch(source,directory),roster=team?(directory.playersByTeam.get(team)||[]):directory.players;
 const born=Number(source.born||source.birthYear||0);
 let candidates=roster.filter(item=>abbreviationMatches(source.name,item.name)&&(!born||!item.row?.born||Number(item.row.born)===born));
 if(!candidates.length){
  const words=clean(source.name).split(' ').filter(Boolean),surname=(words[0]?.length===1?words.slice(1):words.slice(-1)).join(' ');
  if(surname)candidates=roster.filter(item=>{const full=clean(item.name).split(' '),sameBirth=!born||!item.row?.born||Number(item.row.born)===born;return sameBirth&&(full.slice(1).join(' ')===surname||full[full.length-1]===surname);});
 }
 if(candidates.length!==1&&team?.dbKey){
  const [league,code]=String(team.dbKey).split('|');
  const core=(raw.leagues||[]).filter(item=>item.meta?.id===league).flatMap(item=>item.players||[])
   .filter(player=>String(player.team)===String(code)&&abbreviationMatches(source.name,player.name)&&(!born||!player.born||Number(player.born)===born));
  const people=new Map(core.map(player=>[player.id,player]));
  if(people.size===1){const player=[...people.values()][0];return{id:player.id,player,team};}
 }
 if(candidates.length!==1)return null;
 const item=candidates[0],id=item.ids.find(value=>byId.has(value))||item.ids[0];
 return id?{id,player:byId.get(id),row:item.row,team}:null;
}
function connectData(raw,data){
 // Copy the data shell and league arrays so adding private lines cannot leak
 // into the saved core. Player records are read-only here, so cloning millions
 // of nested stat values only delays startup and wastes memory.
 const result={...raw,leagues:(raw.leagues||[]).map(league=>({...league,players:[...(league.players||[])],teams:[...(league.teams||[])]}))};
 if(raw.notes&&typeof raw.notes==='object')result.notes=structuredClone(raw.notes);
 const directory=officialDirectory(),resolved=[];links=[];
 directory.byId=new Map(allPlayers(result).map(player=>[player.id,player]));directory.teamCache=new Map();
 directory.playersByTeam=new Map();for(const item of directory.players){const roster=directory.playersByTeam.get(item.team)||[];roster.push(item);directory.playersByTeam.set(item.team,roster);}
 directory.feedTeams=feedTeamDirectory(data,directory);
 for(const fixture of data.fixtures||[])for(const key of ['home','away','homeTeam','awayTeam','teamA','teamB','a','b']){
  const side=fixture?.[key];if(!side||typeof side==='string')continue;const code=side.code??side.id??side.key??side.teamId??side.team,name=side.name??side.teamName??side.clubName??side.label;
  const team=directory.feedTeams.get(clean(code))||directory.feedTeams.get(clean(name));if(team?.dbKey)side.key=team.dbKey;
 }
 const ids=new Set(data.leagues.map(league=>league.meta.id));
 result.leagues=result.leagues.filter(league=>!ids.has(league.meta.id));
 for(const sourceLeague of data.leagues){
  const league=structuredClone(sourceLeague);league.meta={...league.meta,season:league.meta.season||'2026/27',statsSeason:'2026/27',privateOwnerFeed:true};
  for(const player of league.players||[]){
   player.league=league.meta.id;player.statsSeason='2026/27';player._dragonsData=true;player._verifiedExternal=true;
   const identity=resolve(player,directory,result);if(!identity)continue;
   player.linkedEuroScoutId=identity.id;links.push([player.id,identity.id]);resolved.push(player.id);
   const row=identity.row||{},base=identity.player||{};
   player.name=row.name||base.name||player.name;player.born=row.born||base.born||player.born;
   player.height=row.height||base.height||player.height;player.country=row.nationality||row.country||base.country||player.country;
   player.img=row.img||base.img||player.img;player.role=row.position||base.role||player.role;player.pos=row.position||base.pos||player.pos;
  }
  result.leagues.push(league);
 }
 feed=data;feed.resolvedPlayers=resolved.length;feed.unresolvedPlayers=(data.leagues||[]).reduce((n,league)=>n+(league.players||[]).length,0)-resolved.length;
 window.dispatchEvent?.(new Event('euroscout-dragons'));
 return result;
}
async function apply(raw){
 if(!reader())return raw;
 if(feed)return connectData(raw,feed);
 const cloud=async()=>{const head=await ESAccess.get('dragonsDataState/current');if(!head)return null;const id=ESAccess.field(head,'snapshot');if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid statistics snapshot pointer.');return Object.assign(valid(JSON.parse(await ESAccess.readPayload('dragonsDataSnapshots',id))),{_sourceLabel:'cloud snapshot'});};
 try{const data=await cloud();if(data)return reader()?connectData(raw,data):raw;}
 catch(error){problem='Dragons Data could not load. Existing EuroScout data is unchanged.';console.warn(problem,error);}
 return raw;
}
function link(unite){for(const [left,right] of links)unite(left,right);}
function renderBadge(){
 if(!reader())return;
 const badge=document.createElement('div');badge.id='dragonsDataStatus';badge.setAttribute('role','status');badge.style.cssText='padding:8px 16px;background:#edf8ee;color:#23462b;font:13px system-ui;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
 const message=feed?'Dragons Data · '+(feed._sourceLabel||'private feed')+' · updated '+new Date(feed.generated).toLocaleString()+' · '+feed.resolvedPlayers+' player lines linked.':problem||'Dragons Data is not synced yet.';
 badge.innerHTML='<span style="flex:1">'+message+'</span><a href="http://127.0.0.1:8767/" target="_blank" rel="noopener" style="color:#176d3a">Update stats ↗</a><a href="http://127.0.0.1:8767/firebase" target="_blank" rel="noopener" style="color:#176d3a">Cloud sync ↗</a>';
 document.getElementById('dragonsDataStatus')?.remove();
 const header=document.querySelector('header'),app=document.getElementById('app');if(header)header.after(badge);else if(app)app.before(badge);
}
function finish(raw){
 if(!reader())return;
 for(const league of raw.leagues||[])if(league.meta.privateOwnerFeed)for(const player of league.players||[])for(const [key,value] of Object.entries(player.dragonsTotals||{}))player['t_'+({p3m:'f3m',p3a:'f3a'}[key]||key)]=value;
 renderBadge();
}
window.EuroScoutDragons={apply,link,finish,connectData,resolve,fetchLocal,fixtures(){return reader()&&feed?feed.fixtures:[];},active(){return !!(reader()&&feed);}};
})();
