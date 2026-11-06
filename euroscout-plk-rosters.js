/* Current Polish league registrations from the protected Dragons Data feed. */
(function(){
'use strict';
let directory=null,byId=new Map(),teams=new Map();
const season='2026/27';
const recordId=row=>'plk-roster-'+row.id;
function apply(raw,pack){
 if(!pack||pack.season!==season||!Array.isArray(pack.roster)||!Array.isArray(pack.teams))return;
 const league=raw.leagues.find(l=>l.meta.id==='plk');if(!league)return;
 teams=new Map(pack.teams.map(team=>[team.id,team]));
 const leagueTeams=new Map(league.teams.map(team=>[team.code,team]));
 for(const team of teams.values())leagueTeams.set(team.code,{...leagueTeams.get(team.code),code:team.code,name:team.name,country:'Poland'});
 league.teams=[...leagueTeams.values()];
 league.meta={...league.meta,country:'Poland'};
 const existing=new Map(raw.leagues.flatMap(l=>l.players).map(p=>[p.id,p]));
 const oldCodes=new Map(league.players.filter(p=>!p._plkRosterOnly).map(p=>[String(p.code),p]));
 const roster=[],bios=new Map();byId=new Map();
 for(const source of pack.roster){
  const team=teams.get(source.teamId);if(!team)continue;
  const stable=oldCodes.get(source.id),newId=recordId(source);
  const ids=new Set(source.ids);
  const date=stable?.birthDate||stable?.dob;
  if(stable&&(!stable.born||Number(stable.born)===source.born)&&(!date||date===source.birthDate))ids.add(stable.id);
  if(existing.has(newId)||![...ids].some(id=>existing.has(id)))ids.add(newId);
  const row={...source,ids:[...ids]};
  if(ids.has(newId)&&!existing.has(newId)){
   const p={id:newId,code:'plk-player-'+source.id,name:source.name,league:'plk',team:team.code,teamName:team.name,born:source.born,birthDate:source.birthDate,
    height:source.height,country:source.country,pos:source.pos,role:source.role,img:source.img,jersey:source.number,
    _plkRosterOnly:true,_rosterOnly:true,_strictIdentity:true,statsScope:season,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[]};
   league.players.push(p);existing.set(newId,p);
  }
  for(const id of row.ids){byId.set(id,row);if(existing.has(id))bios.set(id,row);}
  roster.push(row);
 }
 for(const l of raw.leagues)l.players=l.players.map(p=>{
  const row=bios.get(p.id);if(!row)return p;
  return {...p,born:p.born||row.born,birthDate:p.birthDate||p.dob||row.birthDate,height:p.height||row.height,
   country:p.country||row.country,pos:p.pos||row.pos,role:p.role||row.role,img:p.img||row.img,
   currentRosterSeason:season,currentClub:row.teamName,currentRosterSource:row.source,currentRosterProfile:row.profile};
 });
 league.meta.playerCount=league.players.length;
 directory={...pack,roster};
 raw.domestic2627={...raw.domestic2627,season,leagues:{...raw.domestic2627?.leagues,plk:{
  id:'plk',name:'PGE Basket Liga',season,confirmed:true,complete:teams.size===16,checked:pack.checked?.slice(0,10),
  source:pack.source,teams:[...teams.values()].map(({key,name})=>({key,name}))
 }}};
}
function current(p){return p&&(byId.get(p.id)||(p._grp||[]).map(row=>byId.get(row.id)).find(Boolean))||null;}
function key(p){const team=teams.get(current(p)?.teamId);return team?canonKey(team.key):null;}
function link(uni){for(const row of directory?.roster||[])for(const id of row.ids.slice(1))uni(row.ids[0],id);}
window.EuroScoutPLK={apply,current,key,link,directory:()=>directory};
})();
