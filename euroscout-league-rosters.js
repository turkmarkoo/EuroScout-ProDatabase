/* Protected 2026/27 rosters from league and federation sources. */
(function(){
'use strict';
const season='2026/27', leagueIds={lba:'dragons-ita-',sbl:'dragons-swe-',fin:'dragons-fin-',hun:'dragons-hun-',bnxt:'dragons-bnxt-',enbl:'dragons-enbl-',aba2:'dragons-aba2-',denmark:'dragons-den-',slovakia:'dragons-svk-',nbl:'dragons-aus-',britain:'dragons-gbr-',cebl:'dragons-cebl-',bul:'dragons-bul-',lnb:'dragons-fra-',elite2:'dragons-fra2-',swiss:'dragons-sui-',cze:'dragons-cze-'};
const secondary=new Set(['enbl','aba2']);
let directories=[], players=new Map(), registrations=new Map();

function apply(raw,packs){
 const leagues=new Map(raw.leagues.map(l=>[l.meta.id,l]));
 const original=new Map(raw.leagues.flatMap(l=>l.players).map(p=>[p.id,p]));
 const names=new Map(),biographies=new Map();
 directories=[];players=new Map();registrations=new Map();
 if(!packs?.length)return;
 for(const league of raw.leagues){
  league.players=league.players.filter(p=>!p._leagueRosterOnly);
  if(league.meta.privateOwnerFeed)continue;
  for(const p of league.players){
   const name=normName(p.name);
   if(!name)continue;
   if(!names.has(name))names.set(name,[]);
   names.get(name).push(p);
  }
 }
 const domestic={...raw.domestic2627?.leagues};
 const addRegistration=(id,row)=>{
  if(!registrations.has(id))registrations.set(id,[]);
  registrations.get(id).push(row);
 };
 for(const input of packs||[]){
  const pack=window.EuroScoutBulgarian?.pack(input)||input;
  if(!Object.hasOwn(leagueIds,pack.id)||(pack.season!==season&&!(pack.id==='cebl'&&pack.season==='2026')))continue;
  const packSeason=pack.season;
  let league=leagues.get(pack.id);
  if(!league){league={meta:{id:pack.id,name:pack.name,country:pack.country,season:packSeason,rosterOnly:true},teams:[],players:[]};raw.leagues.push(league);leagues.set(pack.id,league);}
  const oldTeams=new Map(league.teams.map(team=>[team.code,team]));
  const teams=new Map(pack.teams.map(team=>{
   const nameMatches=[...oldTeams.values()].filter(t=>[t.name,t.city,...t.aliases||[]].some(n=>n&&normName(n)===normName(team.name)));
   const old=oldTeams.get(team.code)||(nameMatches.length===1?nameMatches[0]:null);
   const code=old?.code||team.code;
   team={...team,code,key:team.key||pack.id+'|'+code};
   const aliases=[...new Set([old?.name,...old?.aliases||[],...team.aliases||[]].filter(n=>n&&n!==team.name))];
   oldTeams.set(team.code,{...old,...team,aliases,country:pack.country,league:pack.id});
   return [team.id,{...team,aliases}];
  }));
  league.teams=[...oldTeams.values()];
  league.meta={...league.meta,country:pack.country};
  const roster=[];
  const data=new Map();
  for(const row of pack.roster){
   if(!teams.has(row.teamId))continue;
   if(!data.has(row.id))data.set(row.id,[]);
   data.get(row.id).push(row);
  }
  for(const row of pack.pastPlayers||[])if(!data.has(row.id))data.set(row.id,[row]);
  for(const stat of pack.stats||[])if((stat.rosterPlayerId||stat.nordicPlayerId)&&!data.has(stat.rosterPlayerId||stat.nordicPlayerId)){
   data.set(stat.rosterPlayerId||stat.nordicPlayerId,[{id:stat.rosterPlayerId||stat.nordicPlayerId,name:stat.name,source:pack.source,active:false}]);
  }
  for(const [officialId,records] of data){
   const active=records.filter(r=>r.active);
   const source=active.length===1?active[0]:records[0];
   const team=teams.get(source.teamId);
   const id=pack.id+'-official-'+officialId;
   const providerMatches=pack.id==='bul'?[...original.values()].filter(p=>p.league==='bul'&&String(p.code)===String(officialId)):pack.provider==='lba'?[...original.values()].filter(p=>p.id==='lba-'+officialId):pack.provider==='lnb'?[...original.values()].filter(p=>p.id==='lnb-'+officialId||new RegExp('^elite2-'+String(officialId).replace(/\D/g,'')+'-\\d+$').test(p.id)):[];
   const reviewed=(source.catalogueLinks||[]).flatMap(link=>{
    const p=original.get(link.id);
    return p&&normName(p.name)===normName(link.name)&&normName(p.teamName)===normName(link.priorClub)?[p]:[];
   });
   const direct=source.linkedEuroScoutId?original.get(source.linkedEuroScoutId):pack.id==='aba2'?original.get('aba-'+officialId):providerMatches[0]||reviewed[0]||null;
   const compatibleDirect=direct&&(!source.born||!direct.born||Number(direct.born)===Number(source.born))&&(!source.birthDate||!(direct.birthDate||direct.dob)||(direct.birthDate||direct.dob)===source.birthDate);
   const exact=[...new Map([source.name,...source.nameAliases||[]].map(normName).filter(Boolean).flatMap(name=>names.get(name)||[]).map(p=>[p.id,p])).values()];
   const compatible=exact.filter(p=>!source.birthDate||!(p.birthDate||p.dob)||(p.birthDate||p.dob)===source.birthDate);
   const sameYear=compatible.filter(p=>source.born&&Number(p.born)===Number(source.born));
   // An older Finnish row may lack a birth year. Require the same full name
   // and the previous official season club for that exact federation person ID.
   const prior=compatible.filter(p=>!p.born&&p.league===pack.id&&source.priorClubs?.includes(p.team));
   let matches=sameYear.length?sameYear:prior.length===1?prior:[];
   // A conflicting source DOB is not permission to join a same-year namesake.
   // Stable federation IDs can still attach the historical Bulgarian record.
   if(pack.id==='bul'&&source.identityReview)matches=[];
   const possibleMatches=matches.map(p=>p.id);
   if(pack._privateSupplement&&matches.length>1&&new Set(matches.map(p=>typeof gid==='function'?gid(p):p.id)).size>1){
    const exactDates=matches.filter(p=>source.birthDate&&(p.birthDate||p.dob)===source.birthDate);
    matches=exactDates.length===1?exactDates:[];
   }
   const providerIds=providerMatches.filter(p=>(!source.born||!p.born||Number(source.born)===Number(p.born))&&(!source.birthDate||!(p.birthDate||p.dob)||(p.birthDate||p.dob)===source.birthDate)).map(p=>p.id);
   const ids=[...new Set([...(compatibleDirect?[direct.id]:[]),...providerIds,...matches.map(p=>p.id),id])];
   if(pack.id==='bul')for(const linkedId of ids){
    const base=original.get(linkedId);if(!base)continue;
    const updated={...base,...biographies.get(linkedId)};
    // Linking an older catalogue ID must not discard a published birth date
    // or portrait. Fill gaps on a copy; later manual overrides retain priority.
    for(const field of ['born','birthDate','height','weight','country','img','role','pos']){
     if((updated[field]==null||updated[field]===''||updated[field]==='Unknown')&&source[field]!=null)updated[field]=source[field];
    }
    if(/[\u0400-\u04ff]/.test(updated.name||''))updated.name=source.name;
    updated.nativeName=source.nativeName;updated.nameAliases=source.nameAliases;
    biographies.set(linkedId,updated);
   }
   const record={...source,ids,possibleMatches:matches.length?[]:possibleMatches,teamKey:team?.key,teamName:team?.name,league:pack.id};
   league.players.push({id,code:id,name:source.name,league:pack.id,team:team?.code||'',teamName:team?.name,
    born:source.born,birthDate:source.birthDate,height:source.height,weight:source.weight,country:source.country,pos:source.pos,role:source.role,
    nativeName:source.nativeName,nameAliases:source.nameAliases,nameSource:source.nameSource,
    img:source.img,jersey:active.length===1?source.number:null,_leagueRosterOnly:true,_leagueRosterIdentity:true,
    _rosterOnly:true,_strictIdentity:true,statsScope:packSeason,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[],
    currentRosterSeason:active.length===1?packSeason:null,currentRosterSource:source.source,currentRosterProfile:source.profile});
   players.set(pack.id+'|'+officialId,record);
   if(active.length===1&&team){
    roster.push(record);
    if(packSeason===season)for(const id of ids)addRegistration(id,record);
   }
  }
  league.meta.playerCount=league.players.length;
  directories.push({...pack,teams:[...teams.values()],roster});
  if(packSeason===season)domestic[pack.id]={id:pack.id,name:pack.name,season,confirmed:!pack.membershipEvidence||pack.membershipEvidence==='official_roster',complete:pack.complete!==false,membershipEvidence:pack.membershipEvidence||'official_roster',
    checked:pack.checked?.slice(0,10),source:pack.source,teams:[...teams.values()].map(({key,name})=>({key,name}))};
 }
 if(biographies.size)for(const league of raw.leagues)league.players=league.players.map(p=>biographies.get(p.id)||p);
 if(directories.length)raw.domestic2627={...raw.domestic2627,season,leagues:domestic};
}
function currentRows(p){
 if(!p)return [];
 const rows=new Set();
 for(const id of [p.id,p.linkedEuroScoutId,...(p._grp||[]).map(r=>r.id)])for(const row of registrations.get(id)||[])rows.add(row);
 return [...rows];
}
function current(p,club){
 const rows=currentRows(p);
 if(club)return rows.find(row=>canonKey(row.teamKey)===canonKey(club))||null;
 const primary=rows.filter(row=>!secondary.has(row.league));
 const clubs=new Map(primary.map(row=>[canonKey(row.teamKey),row]));
 return clubs.size===1?[...clubs.values()][0]:null;
}
function key(p){const team=current(p)?.teamKey;return team?canonKey(team):null;}
function supersededUSRoster(p,usRow){
 return currentRows(p).some(row=>row.league==='lnb'&&row.verifiedClubSource&&
  row.supersededUSRosterId===usRow.id&&row.observedAt&&usRow.checkedAt&&row.observedAt>=usRow.checkedAt);
}
function keys(p){return [...new Set(currentRows(p).map(row=>canonKey(row.teamKey)))];}
function resolve(league,id){
 const code=Object.keys(leagueIds).find(key=>league.startsWith(leagueIds[key]));
 return players.get(code+'|'+id)||null;
}
function link(uni){for(const row of players.values())for(const id of row.ids.slice(1))uni(row.ids[0],id);}
function statLeagues(){
 return directories.filter(pack=>pack.stats?.length).map(pack=>({
  meta:{id:leagueIds[pack.id]+'2026',name:pack.name,season,privateOwnerFeed:true,
   source:pack.source||'Official league season statistics',dragonsCompetition:leagueIds[pack.id].split('-')[1].toUpperCase(),playerCount:pack.stats.length},
  players:pack.stats.map(p=>({...p,team:pack.teams.find(t=>t.id===p.teamId||t.id===p.team)?.code||p.team})),teams:pack.teams,statMeta:{},games:[],
 }));
}
window.EuroScoutLeagueRosters={apply,current,key,keys,supersededUSRoster,resolve,link,statLeagues,directories:()=>directories,
 checked:()=>directories.map(p=>p.checked).join('|')};
})();

