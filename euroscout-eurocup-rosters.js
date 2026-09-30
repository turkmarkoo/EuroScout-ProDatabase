/* Official 2026/27 EuroCup registrations and canonical identity links. */
(function(){
'use strict';
const data=window.EUROSCOUT_EUROCUP_ROSTERS;if(!data)return;
const byId=new Map();
for(const row of data.roster)for(const id of row.ids){
  if(byId.has(id)&&byId.get(id).id!==row.id)throw Error('Conflicting EuroCup identity '+id);
  byId.set(id,row);
}
function current(p){return p&&(byId.get(p.id)||(p._grp||[]).map(x=>byId.get(x.id)).find(Boolean))||null;}
function key(p){const row=current(p),team=row&&data.teams.find(t=>t.code===row.teamCode);return team?canonKey(team.key):null;}
function link(uni){for(const row of data.roster)for(let i=1;i<row.ids.length;i++)uni(row.ids[0],row.ids[i]);}
function apply(raw){
  if(!raw?.leagues)return;
  let league=raw.leagues.find(item=>item.meta.id==='eurocup');
  if(!league){league={meta:{id:'eurocup',name:'EuroCup',season:'2026/27',tier:'International',source:data.source},teams:[],players:[]};raw.leagues.push(league);}
  const playerIds=new Set(league.players.map(p=>p.id));
  for(const player of data.players)if(!playerIds.has(player.id)){league.players.push(structuredClone(player));playerIds.add(player.id);}
  const teamCodes=new Set((league.teams||[]).map(t=>t.code));
  for(const team of data.teams)if(!teamCodes.has(team.code)){
    league.teams.push({code:team.code,name:team.name,teamName:team.name,country:team.country,logo:team.logo});
    teamCodes.add(team.code);
  }
  league.meta.playerCount=league.players.length;
  for(const sourceLeague of raw.leagues)for(const player of sourceLeague.players){
    const row=byId.get(player.id);if(!row)continue;
    player._eurocupRoster={season:data.season,teamCode:row.teamCode,teamName:row.teamName,number:row.number,source:row.source,profile:row.profile,checked:data.checked};
    player.currentRosterSeason=data.season;player.currentClub=row.teamName;player.currentRosterSource=row.source;player.currentRosterProfile=row.profile;
    if(row.img)player.img=row.img;if(!player.born)player.born=row.born;if(!player.height)player.height=row.height;if(!player.weight)player.weight=row.weight;
    if(!player.country)player.country=row.nationality;if(!player.role)player.role=row.position;if(!player.pos)player.pos=row.position;
  }
  raw.season2627=raw.season2627||{};raw.season2627.comps=raw.season2627.comps||{};
  raw.season2627.comps.eurocup={name:'EuroCup',teams:data.teams.map(team=>({name:team.name,key:team.key,stage:null}))};
}
function decorate(clubs,byKey){for(const team of data.teams){const club=byKey.get(canonKey(team.key));if(!club)continue;club.name=team.name;club.country=team.country;if(team.logo)club.logo=team.logo;for(const row of club.teams)row.searchAliases=[...new Set([...(row.searchAliases||[]),team.name,...team.aliases])];}clubs.sort((a,b)=>a.name.localeCompare(b.name));}
window.EuroScoutEuroCup={apply,current,key,link,decorate,data};
})();
