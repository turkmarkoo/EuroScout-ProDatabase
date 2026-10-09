/* DragonsHub statistics. Never cache or copy this feed into scouting snapshots. */
(function(){'use strict';
let feed=null,problem='',links=[],registrations=new Map();
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
function uniqueTeam(matches){if(matches.length===1)return matches[0];if(matches.length&&new Set(matches.map(t=>clean(t.name))).size===1)return matches[0];return null;}
function directTeamMatch(source,directory){
 const code=clean(source.team),name=clean(source.teamName),queries=[code,name].filter(Boolean);
 const cacheKey=String(source.league||'')+'|'+code+'|'+name;if(directory.teamCache?.has(cacheKey))return directory.teamCache.get(cacheKey);
 let matches=directory.teams.filter(team=>[team.code,team.name,...team.aliases].some(alias=>queries.includes(clean(alias))));
 if(matches.length){const provider={ec:'eurocup',el:'euroleague',ita:'lba',otp:'slo',pol:'plk',gre:'gbl'}[String(source.league||'').split('-')[1]]||String(source.league||'').split('-')[1],preferred=matches.filter(t=>t.dbKey?.startsWith(provider+'|')),match=uniqueTeam(preferred)||uniqueTeam(matches);directory.teamCache?.set(cacheKey,match);return match;}
 matches=directory.teams.filter(team=>[team.name,...team.aliases].some(alias=>queries.some(query=>{
  const candidate=clean(alias);return query.length>=6&&candidate.length>=6&&(candidate.startsWith(query+' ')||query.startsWith(candidate+' '));
 })));
 const provider={ec:'eurocup',el:'euroleague',ita:'lba',otp:'slo',pol:'plk',gre:'gbl'}[String(source.league||'').split('-')[1]]||String(source.league||'').split('-')[1];
 const preferred=matches.filter(t=>t.dbKey?.startsWith(provider+'|'));let match=uniqueTeam(preferred)||uniqueTeam(matches);
 if(!match&&provider){const tail=name.split(' ').at(-1),local=directory.teams.filter(t=>t.dbKey?.startsWith(provider+'|')&&tail?.length>=5&&clean(t.name).split(' ').at(-1)===tail&&!['basket','basketball','lions','eagles','bears','dragons'].includes(tail));if(local.length===1)match=local[0];}
 directory.teamCache?.set(cacheKey,match);return match;
}
function teamMatch(source,directory){
 const code=clean(source.team),name=clean(source.teamName);
 const mapped=directory.feedTeams?.get(code)||directory.feedTeams?.get(name);return mapped||directTeamMatch(source,directory);
}
function feedTeamDirectory(data,directory){
 const mapped=new Map();
 const add=(side,officialCode,league)=>{
  if(!side)return;
  if(typeof side==='string')side={name:side};
  const code=side.code??side.id??side.key??side.teamId??side.team, name=side.name??side.teamName??side.clubName??side.label;
  const hinted=officialCode&&directory.teams.filter(team=>clean(team.officialCode)===clean(officialCode));
  const match=hinted?.length===1?hinted[0]:directTeamMatch({team:code,teamName:name,league},directory);if(!match)return;
  for(const value of [code,name])if(clean(value))mapped.set(clean(value),match);
 };
 for(const fixture of data.fixtures||[]){
  const slug=String(fixture.source_url||'').split('/').filter(Boolean).pop()||'',codes=/^\d+-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(slug);
  add(fixture.home,codes?.[1],fixture.league_id);add(fixture.away,codes?.[2],fixture.league_id);
  for(const key of ['homeTeam','awayTeam','teamA','teamB','a','b'])add(fixture?.[key]);
  for(const side of fixture?.teams||fixture?.participants||[])add(side);
 }
 for(const league of data.leagues||[])for(const team of league.teams||[])add(team,null,league.meta.id);
 return mapped;
}
function nameTokens(value){return clean(value).replace(/\s+(jr|sr|ii|iii|iv)$/,'').split(' ').filter(Boolean);}
function abbreviationMatches(shortName,fullName){
 const a=nameTokens(shortName),b=nameTokens(fullName);if(a.join(' ')===b.join(' '))return true;if(a.length<2||b.length<2)return false;
 const first=a[0].length===1?a[0]===b[0][0]:a[0]===b[0];
 return first&&(a.slice(1).join(' ')===b.slice(1).join(' ')||a.slice(1).join(' ')===b.at(-1));
}
function nameKeys(value){const parts=nameTokens(value);if(parts.length<2)return[];return [...new Set([parts[0][0]+'|'+parts.slice(1).join(' '),parts[0][0]+'|'+parts.at(-1)])];}
function prepareDirectory(directory,raw){
 directory.byId=new Map(allPlayers(raw).filter(p=>!p._dragonsData).map(p=>[p.id,p]));directory.teamCache=new Map();
 for(const league of raw.leagues||[]){if(league.meta?.privateOwnerFeed||league.meta?.exhibition)continue;for(const team of league.teams||[]){
  const existing=directory.teams.find(t=>t.dbKey===league.meta.id+'|'+team.code);if(existing)continue;
  directory.teams.push({key:league.meta.id+':'+team.code,dbKey:league.meta.id+'|'+team.code,code:team.code,name:team.name,aliases:team.aliases||[],catalogue:true});
 }}
 const items=[...directory.players,...[...directory.byId.values()].filter(p=>!/^sl$/.test(p.league)&&nameTokens(p.name)[0]?.length>1).map(p=>({name:p.name,ids:[p.id],row:p,player:p,team:{name:p.teamName,dbKey:p.league+'|'+p.team}}))],years=new Map(),groups=new Map();
 for(const item of items){const name=clean(item.name),year=Number(item.row?.born||0);if(year){if(!years.has(name))years.set(name,new Set());years.get(name).add(year);}}
 for(const item of items){const name=clean(item.name),known=years.get(name),year=Number(item.row?.born||0)||(known?.size===1?[...known][0]:0),key=name+'|'+year;let group=groups.get(key);if(!group){group={key,name:item.name,ids:[],rows:[],teams:[],born:year};groups.set(key,group);}group.ids.push(...item.ids.filter(Boolean));group.rows.push(item.row);if(item.team)group.teams.push(item.team);}
 directory.nameIndex=new Map();for(const group of groups.values()){group.ids=[...new Set(group.ids)];for(const key of nameKeys(group.name)){if(!directory.nameIndex.has(key))directory.nameIndex.set(key,[]);directory.nameIndex.get(key).push(group);}}
 directory.groups=groups;
}
function verifiedProfile(source,directory){
 if(!/^dragons-acb-/.test(source.league||'')||!/2026\D+(?:20)?27/.test(source._sourceSeason||source.statsSeason||''))return null;
 const row=(window.EUROSCOUT_ACB_IDENTITY_FIXES||[]).find(r=>r.feedAliases.some(alias=>clean(alias)===clean(source.name))&&clean(r.feedTeam)===clean(source.teamName));if(!row)return null;
 const born=Number(source.born||source.birthYear||0);if(born&&born!==row.born||source.height&&Math.abs(Number(source.height)-row.height)>5)return null;
 let base=directory.byId.get('acb-'+row.code);
 if(base?.born&&Number(base.born)!==row.born)base=null;
 if(!base){const matches=[...directory.groups.values()].filter(item=>Number(item.born)===row.born&&clean(item.name)===clean(row.name));if(matches.length===1)base=directory.byId.get(matches[0].ids.find(id=>directory.byId.has(id)));}
 // Retain an existing nationality (including dual citizenship). ACB metadata
 // supplies nationality only when the catalogue has no value for this person.
 return {id:base?.id,player:base,row:{...row,country:base?.country||row.country},team:teamMatch(source,directory),officialId:'acb:'+row.code,source:row.source};
}
function resolve(source,directory,raw){
 if(!directory.nameIndex)prepareDirectory(directory,raw);
 const verified=verifiedProfile(source,directory);if(verified)return verified;
 const byId=directory.byId,born=Number(source.born||source.birthYear||0),compatible=row=>!born||!row?.born||Number(row.born)===born;
 if(source.linkedEuroScoutId&&byId.has(source.linkedEuroScoutId)){const player=byId.get(source.linkedEuroScoutId);if(compatible(player)&&abbreviationMatches(source.name,player.name))return{id:player.id,player,team:teamMatch(source,directory)};return null;}
 const team=teamMatch(source,directory),found=new Map();for(const key of nameKeys(source.name))for(const item of directory.nameIndex.get(key)||[])if(abbreviationMatches(source.name,item.name)&&(!born||!item.born||born===item.born))found.set(item.key,item);
 let candidates=[...found.values()];
 const sameTeam=item=>item.teams.some(t=>team&&t.dbKey===team.dbKey||[t.name,...(t.aliases||[])].some(name=>clean(name)===clean(source.teamName)));
 const local=candidates.filter(sameTeam);if(local.length===1)candidates=local;
 // A lone initial is never sufficient when several full identities fit.
 if(candidates.length!==1)return null;const item=candidates[0];if(nameTokens(source.name)[0]?.length===1&&!team&&!item.born)return null;
 const rows=item.rows.filter(Boolean),height=Number(source.height||0);if(height&&rows.some(row=>row.height&&Math.abs(Number(row.height)-height)>5))return null;
 const row={};for(const field of ['name','born','birthDate','height','weight','age','country','nationality','img','role','position','pos']){const value=rows.map(r=>r[field]).find(v=>v!=null&&v!==''&&v!=='Unknown');if(value!=null)row[field]=value;}
 row.name=item.name;const id=item.ids.find(id=>byId.has(id))||item.ids[0];return id?{id,ids:item.ids,player:byId.get(id),row,team}:null;
}
function connectData(raw,data){
 // Copy the data shell and league arrays so adding private lines cannot leak
 // into the saved core. Player records are read-only here, so cloning millions
 // of nested stat values only delays startup and wastes memory.
 const result={...raw,leagues:(raw.leagues||[]).map(league=>({...league,players:[...(league.players||[])],teams:[...(league.teams||[])]}))};
 if(raw.notes&&typeof raw.notes==='object')result.notes=structuredClone(raw.notes);
 const directory=officialDirectory(),resolved=[];links=[];registrations=new Map();
 prepareDirectory(directory,result);
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
   player.league=league.meta.id;player.statsSeason='2026/27';player._dragonsData=true;player._verifiedExternal=true;player._sourceSeason=league.meta.season;
   player._sourceTeamKey=teamMatch(player,directory)?.dbKey||null;
   const identity=resolve(player,directory,result);if(!identity)continue;
   if(identity.id){player.linkedEuroScoutId=identity.id;for(const id of identity.ids||[identity.id])links.push([player.id,id]);resolved.push(player.id);}
   if(identity.officialId){player._sourcePlayerId=identity.officialId;player._identitySource=identity.source;}
   if(identity.team?.dbKey&&/2026\D+(?:20)?27/.test(league.meta.season)){const date=(player.gameLog||[]).map(game=>String(game[0]||'')).sort().at(-1)||'';for(const id of [player.id,...(identity.ids||[identity.id])].filter(Boolean)){const old=registrations.get(id);if(!old||date>old.date)registrations.set(id,{key:identity.team.dbKey,date});}}
   const row=identity.row||{},base=identity.player||{};
   player.name=row.name||base.name||player.name;player.born=row.born||base.born||player.born;
   player.weight=row.weight||base.weight||player.weight;player.age=row.age??base.age??(player.born?new Date().getFullYear()-Number(player.born):player.age);player.birthDate=row.birthDate||base.birthDate||player.birthDate;
   player.height=row.height||base.height||player.height;player.country=row.nationality||row.country||base.country||player.country;
   player.img=row.img||base.img||player.img;player.role=row.role||row.position||base.role||player.role;player.pos=row.pos||row.position||base.pos||player.pos;
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
function key(player){const ids=[player.id,player.linkedEuroScoutId,...(player._grp||[]).map(p=>p.id)].filter(Boolean);return ids.map(id=>registrations.get(id)).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date))[0]?.key||null;}
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
window.EuroScoutDragons={apply,link,key,recordLinks:()=>links.filter(([source])=>source.startsWith('dragons-')),finish,connectData,resolve,fetchLocal,fixtures(){return reader()&&feed?feed.fixtures:[];},active(){return !!(reader()&&feed);}};
})();
