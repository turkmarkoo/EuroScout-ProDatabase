/* DragonsHub statistics. Never cache or copy this feed into scouting snapshots. */
(function(){'use strict';
let feed=null,problem='',links=[];
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
function teamMatch(source,directory){
 const code=clean(source.team),name=clean(source.teamName),queries=[code,name].filter(Boolean);
 const cacheKey=code+'|'+name;if(directory.teamCache?.has(cacheKey))return directory.teamCache.get(cacheKey);
 let matches=directory.teams.filter(team=>[team.code,team.name,...team.aliases].some(alias=>queries.includes(clean(alias))));
 if(matches.length===1){directory.teamCache?.set(cacheKey,matches[0]);return matches[0];}
 matches=directory.teams.filter(team=>[team.name,...team.aliases].some(alias=>queries.some(query=>{
  const candidate=clean(alias);return query.length>=6&&candidate.length>=6&&(candidate.startsWith(query+' ')||query.startsWith(candidate+' '));
 })));
 const match=matches.length===1?matches[0]:null;directory.teamCache?.set(cacheKey,match);return match;
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
 const team=teamMatch(source,directory);if(!team)return null;
 const roster=directory.playersByTeam.get(team)||[];
 let candidates=roster.filter(item=>abbreviationMatches(source.name,item.name));
 if(!candidates.length){
  const words=clean(source.name).split(' ').filter(Boolean),surname=(words[0]?.length===1?words.slice(1):words.slice(-1)).join(' ');
  if(surname)candidates=roster.filter(item=>{const full=clean(item.name).split(' ');return full.slice(1).join(' ')===surname||full[full.length-1]===surname;});
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
 feed=data;feed.resolvedPlayers=resolved.length;return result;
}
async function apply(raw){
 if(!reader())return raw;
 try{
  const head=await ESAccess.get('dragonsDataState/current');if(!head)return raw;
  const id=ESAccess.field(head,'snapshot');if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid statistics snapshot pointer.');
  const data=JSON.parse(await ESAccess.readPayload('dragonsDataSnapshots',id));
  if(data.schema!==1||data.quality_policy!=='accepted_live_boxscores_only'||!Array.isArray(data.leagues)||!Array.isArray(data.fixtures))throw Error('Invalid Dragons Data feed.');
  if(data.leagues.some(league=>!league.meta?.privateOwnerFeed||!league.meta.id?.startsWith('dragons-')||!Array.isArray(league.players)))throw Error('Invalid owner-only league.');
  return reader()?connectData(raw,data):raw;
 }catch(error){problem='Dragons Data could not load. Existing EuroScout data is unchanged.';console.warn(problem,error);return raw;}
}
function link(unite){for(const [left,right] of links)unite(left,right);}
function finish(raw){
 if(!reader())return;
 for(const league of raw.leagues||[])if(league.meta.privateOwnerFeed)for(const player of league.players||[])for(const [key,value] of Object.entries(player.dragonsTotals||{}))player['t_'+({p3m:'f3m',p3a:'f3a'}[key]||key)]=value;
 const badge=document.createElement('div');badge.id='dragonsDataStatus';badge.setAttribute('role','status');badge.style.cssText='padding:8px 16px;background:#edf8ee;color:#23462b;font:13px system-ui';
 badge.textContent=feed?'Dragons Data · updated '+new Date(feed.generated).toLocaleString()+' · '+feed.resolvedPlayers+' player lines linked.':problem||'Dragons Data is not synced yet.';
 document.querySelector('header')?.after(badge);
}
window.EuroScoutDragons={apply,link,finish,connectData,resolve,fixtures(){return reader()&&feed?feed.fixtures:[];},active(){return !!(reader()&&feed);}};
})();
