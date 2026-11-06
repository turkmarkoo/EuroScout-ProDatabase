/* Protected 2026/27 rosters from the Swedish and Finnish federations. */
(function(){
'use strict';
const season='2026/27', leagueIds={sbl:'dragons-swe-',fin:'dragons-fin-'};
let directories=[], players=new Map(), registrations=new Map();

function apply(raw,packs){
 const leagues=new Map(raw.leagues.map(l=>[l.meta.id,l]));
 const names=new Map();
 directories=[];players=new Map();registrations=new Map();
 if(!packs?.length)return;
 for(const league of raw.leagues){
  league.players=league.players.filter(p=>!p._nordicRosterOnly);
  if(league.meta.privateOwnerFeed)continue;
  for(const p of league.players){
   const name=normName(p.name);
   if(!names.has(name))names.set(name,[]);
   names.get(name).push(p);
  }
 }
 const domestic={...raw.domestic2627?.leagues};
 const addRegistration=(id,row)=>{
  if(!registrations.has(id))registrations.set(id,[]);
  registrations.get(id).push(row);
 };
 for(const pack of packs||[]){
  const league=leagues.get(pack.id);
  if(!Object.hasOwn(leagueIds,pack.id)||!league||pack.season!==season)continue;
  const oldTeams=new Map(league.teams.map(team=>[team.code,team]));
  const teams=new Map(pack.teams.map(team=>{
   const old=oldTeams.get(team.code);
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
  for(const stat of pack.stats||[])if(!data.has(stat.nordicPlayerId)){
   data.set(stat.nordicPlayerId,[{id:stat.nordicPlayerId,name:stat.name,source:pack.source,active:false}]);
  }
  for(const [officialId,records] of data){
   const active=records.filter(r=>r.active);
   const source=active.length===1?active[0]:records[0];
   const team=teams.get(source.teamId);
   const id=pack.id+'-official-'+officialId;
   const exact=names.get(normName(source.name))||[];
   const compatible=exact.filter(p=>!source.birthDate||!(p.birthDate||p.dob)||(p.birthDate||p.dob)===source.birthDate);
   const sameYear=compatible.filter(p=>source.born&&Number(p.born)===Number(source.born));
   // An older Finnish row may lack a birth year. Require the same full name
   // and the previous official season club for that exact federation person ID.
   const prior=compatible.filter(p=>!p.born&&p.league===pack.id&&source.priorClubs?.includes(p.team));
   const matches=sameYear.length?sameYear:prior.length===1?prior:[];
   const ids=[...matches.map(p=>p.id),id];
   const record={...source,ids,teamKey:team?.key,teamName:team?.name};
   league.players.push({id,code:id,name:source.name,league:pack.id,team:team?.code||'',teamName:team?.name,
    born:source.born,birthDate:source.birthDate,height:source.height,country:source.country,pos:source.pos,role:source.role,
    img:source.img,jersey:active.length===1?source.number:null,_nordicRosterOnly:true,_nordicIdentity:true,
    _rosterOnly:true,_strictIdentity:true,statsScope:season,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[],
    currentRosterSeason:active.length===1?season:null,currentRosterSource:source.source,currentRosterProfile:source.profile});
   players.set(pack.id+'|'+officialId,record);
   if(active.length===1&&team){
    roster.push(record);
    for(const id of ids)addRegistration(id,record);
   }
  }
  league.meta.playerCount=league.players.length;
  directories.push({...pack,teams:[...teams.values()],roster});
  domestic[pack.id]={id:pack.id,name:pack.name,season,confirmed:true,complete:true,
    checked:pack.checked?.slice(0,10),source:pack.source,teams:[...teams.values()].map(({key,name})=>({key,name}))};
 }
 if(directories.length)raw.domestic2627={...raw.domestic2627,season,leagues:domestic};
}
function current(p){
 if(!p)return null;
 let active=null;
 for(const id of [p.id,p.linkedEuroScoutId,...(p._grp||[]).map(r=>r.id)]){
  for(const row of registrations.get(id)||[]){
   if(active&&row.teamKey!==active.teamKey)return null;
   active=row;
  }
 }
 return active;
}
function key(p){const team=current(p)?.teamKey;return team?canonKey(team):null;}
function resolve(league,id){
 const code=Object.keys(leagueIds).find(key=>league.startsWith(leagueIds[key]));
 return players.get(code+'|'+id)||null;
}
function link(uni){for(const row of players.values())for(const id of row.ids.slice(1))uni(row.ids[0],id);}
function statLeagues(){
 return directories.filter(pack=>pack.stats?.length).map(pack=>({
  meta:{id:leagueIds[pack.id]+'2026',name:pack.name,season,privateOwnerFeed:true,
   source:'Basketball Finland · official season statistics',dragonsCompetition:'FIN',playerCount:pack.stats.length},
  players:pack.stats,teams:pack.teams,statMeta:{},games:[],
 }));
}
window.EuroScoutNordic={apply,current,key,resolve,link,statLeagues,directories:()=>directories,
 checked:()=>directories.map(p=>p.checked).join('|')};
})();

