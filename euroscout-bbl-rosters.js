/* Official 2026/27 registrations; historical results and private assignments remain separate. */
(function(){
'use strict';
const data=window.EUROSCOUT_BBL_ROSTERS;if(!data)return;
const byId=new Map();for(const r of data.roster)for(const id of r.ids){if(byId.has(id)&&byId.get(id).id!==r.id)throw Error('Conflicting BBL identity '+id);byId.set(id,r);}
function current(p){return p&&(byId.get(p.id)||(p._grp||[]).map(x=>byId.get(x.id)).find(Boolean))||null;}
function key(p){const r=current(p),team=r&&data.teams.find(t=>t.id===r.teamId);return team?canonKey(team.key):null;}
function link(uni){for(const r of data.roster)for(let i=1;i<r.ids.length;i++)uni(r.ids[0],r.ids[i]);}
function apply(raw){
 if(!raw?.leagues)return;const L=raw.leagues.find(l=>l.meta.id==='bbl');if(!L)return;
 L.meta.name='Germany BBL';L.meta.country='Germany';
 const have=new Set(L.players.map(p=>p.id));for(const p of data.players)if(!have.has(p.id)){L.players.push(structuredClone(p));have.add(p.id);}
 L.meta.playerCount=L.players.length;
 const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);
 for(const t of data.teams){const id='bbl-2026-'+t.id;if(!directory.some(x=>x.id===id))directory.push({id,name:t.name,country:'Germany',league:'Germany BBL',aliases:t.aliases,source:t.url,checked:data.checked});}
 for(const league of raw.leagues)for(const p of league.players){const r=byId.get(p.id);if(!r)continue;
  p._bblRoster={season:data.season,teamId:r.teamId,teamName:r.teamName,number:r.number,source:r.source,profile:r.profile,checked:data.checked};
  p.currentRosterSeason=data.season;p.currentClub=r.teamName;p.currentRosterSource=r.source;p.currentRosterProfile=r.profile;
  if(r.img)p.img=r.img;
  if(!p.born||r.match==='Official BBL profile birth date and career history reviewed')p.born=r.born;
  if(!p.height)p.height=r.height;if(!p.weight)p.weight=r.weight;
 }
 raw.domestic2627=raw.domestic2627||{season:data.season,leagues:{}};raw.domestic2627.leagues=raw.domestic2627.leagues||{};
 raw.domestic2627.leagues.bbl={id:'bbl',name:'Germany BBL',season:data.season,confirmed:true,complete:true,checked:data.checked.slice(0,10),source:data.source,teams:data.teams.map(t=>({key:t.key,name:t.name})),note:'Official 2026/27 BBL team directory and player rosters.'};
}
function decorate(clubs,byKey){for(const t of data.teams){const club=byKey.get(t.key);if(!club)continue;club.name=t.name;for(const row of club.teams)row.searchAliases=[...new Set([...(row.searchAliases||[]),t.name,...t.aliases])];}clubs.sort((a,b)=>a.name.localeCompare(b.name));}
window.EuroScoutBBL={apply,current,key,link,decorate,data};
})();
