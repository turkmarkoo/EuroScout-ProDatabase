/* DragonsHub statistics. Never cache or copy this feed into scouting snapshots. */
(function(){'use strict';
let feed=null,problem='',links=[],syncing=null,lastSynced='';
const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const reader=()=>window.ESAccess?.internal&&!!ESAccess.user;
const allPlayers=raw=>(raw.leagues||[]).flatMap(league=>league.players||[]);

function officialDirectory(){
 const teams=[],players=[];
 const euro=window.EUROSCOUT_EUROCUP_ROSTERS;
 if(euro)for(const team of euro.teams||[]){
  const entry={key:'eurocup:'+team.code,code:team.code,name:team.name,aliases:team.aliases||[]};teams.push(entry);
  for(const row of (euro.roster||[]).filter(player=>player.teamCode===team.code))players.push({team:entry,name:row.name,ids:row.ids||[],row});
 }
 const official=window.EUROSCOUT_OFFICIAL_ROSTERS;
 if(official)for(const team of official.teams||[]){
  const entry={key:'official:'+team.id,code:team.code||team.id,name:team.name,aliases:team.aliases||[]};teams.push(entry);
  for(const row of (official.roster||[]).filter(player=>player.teamId===team.id))players.push({team:entry,name:row.name,ids:row.ids||[row.id],row});
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
 const add=side=>{
  if(!side)return;
  if(typeof side==='string')side={name:side};
  const code=side.code??side.id??side.key??side.teamId??side.team, name=side.name??side.teamName??side.clubName??side.label;
  const match=directTeamMatch({team:code,teamName:name},directory);if(!match)return;
  for(const value of [code,name])if(clean(value))mapped.set(clean(value),match);
 };
 for(const fixture of data.fixtures||[]){
  for(const key of ['home','away','homeTeam','awayTeam','teamA','teamB','a','b'])add(fixture?.[key]);
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
 feed=data;feed.resolvedPlayers=resolved.length;feed.unresolvedPlayers=(data.leagues||[]).reduce((n,league)=>n+(league.players||[]).length,0)-resolved.length;return result;
}
async function apply(raw){
 if(!reader())return raw;
 const valid=data=>{
  if(data.schema!==1||data.quality_policy!=='accepted_live_boxscores_only'||!Array.isArray(data.leagues)||!Array.isArray(data.fixtures))throw Error('Invalid Dragons Data feed.');
  if(data.leagues.some(league=>!league.meta?.privateOwnerFeed||!league.meta.id?.startsWith('dragons-')||!Array.isArray(league.players)))throw Error('Invalid owner-only league.');
  return data;
 };
 const local=async()=>{if(typeof fetch!=='function')return null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);try{const response=await fetch('http://127.0.0.1:8767/api/v1/euroscout-feed',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Local Dragons Data returned '+response.status);return Object.assign(valid(await response.json()),{_sourceLabel:'fresh private page'});}finally{clearTimeout(timer);}};
 const cloud=async()=>{const head=await ESAccess.get('dragonsDataState/current');if(!head)return null;const id=ESAccess.field(head,'snapshot');if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid statistics snapshot pointer.');return Object.assign(valid(JSON.parse(await ESAccess.readPayload('dragonsDataSnapshots',id))),{_sourceLabel:'cloud snapshot'});};
 const settled=await Promise.allSettled([local(),cloud()]),candidates=settled.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>new Date(b.generated||0)-new Date(a.generated||0));
 const localData=settled[0].status==='fulfilled'?settled[0].value:null,cloudData=settled[1].status==='fulfilled'?settled[1].value:null;
 if(localData&&window.ESAccess?.owner&&new Date(localData.generated||0)>new Date(cloudData?.generated||0))syncNewestLocal(localData);
 if(candidates.length)return reader()?connectData(raw,candidates[0]):raw;
 const error=settled.find(x=>x.status==='rejected')?.reason;problem='Dragons Data could not load. Existing EuroScout data is unchanged.';if(error)console.warn(problem,error);return raw;
}
function syncNewestLocal(data){
 if(syncing||lastSynced===data.generated)return syncing;
 lastSynced=data.generated;syncing=(async()=>{
  const payload={...data};delete payload._sourceLabel;delete payload.resolvedPlayers;delete payload.unresolvedPlayers;
  const id=crypto.randomUUID().replaceAll('-','');
  await ESAccess.writePayload('dragonsDataSnapshots',id,payload);
  const head=await ESAccess.get('dragonsDataState/current');
  await ESAccess.commit('dragonsDataState/current',{snapshot:id},head?.updateTime?{updateTime:head.updateTime}:{exists:false});
 })().catch(error=>{lastSynced='';console.warn('Fresh Dragons Data stayed local; cloud sync is delayed.',error);}).finally(()=>{syncing=null;});
 return syncing;
}
function link(unite){for(const [left,right] of links)unite(left,right);}
function finish(raw){
 if(!reader())return;
 for(const league of raw.leagues||[])if(league.meta.privateOwnerFeed)for(const player of league.players||[])for(const [key,value] of Object.entries(player.dragonsTotals||{}))player['t_'+({p3m:'f3m',p3a:'f3a'}[key]||key)]=value;
 const badge=document.createElement('div');badge.id='dragonsDataStatus';badge.setAttribute('role','status');badge.style.cssText='padding:8px 16px;background:#edf8ee;color:#23462b;font:13px system-ui';
 badge.textContent=feed?'Dragons Data · '+(feed._sourceLabel||'private feed')+' · updated '+new Date(feed.generated).toLocaleString()+' · '+feed.resolvedPlayers+' player lines linked.':problem||'Dragons Data is not synced yet.';
 document.querySelector('header')?.after(badge);
}
window.EuroScoutDragons={apply,link,finish,connectData,resolve,fixtures(){return reader()&&feed?feed.fixtures:[];},active(){return !!(reader()&&feed);}};
})();
