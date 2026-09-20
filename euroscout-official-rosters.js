(function(){
'use strict';const data=window.EUROSCOUT_OFFICIAL_ROSTERS;if(!data)return;const byId=new Map(data.roster.flatMap(r=>r.ids.map(id=>[id,r])));
function current(p){return p&&(byId.get(p.id)||(p._grp||[]).map(x=>byId.get(x.id)).find(Boolean))||null;}
function key(p){const r=current(p);return r?canonKey(data.teams.find(t=>t.id===r.teamId).key):null;}
function link(uni){for(const r of data.roster)for(let i=1;i<r.ids.length;i++)uni(r.ids[0],r.ids[i]);}
function apply(raw){if(!raw?.leagues)return;const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);
 for(const t of data.teams)if(t.key.startsWith('directory|')&&!directory.some(x=>'directory|'+x.id===t.key))directory.push({id:t.key.slice(10),name:t.name,country:t.country,league:t.id.startsWith('lba-')?'Italy Serie A':'ABA League',aliases:t.aliases,source:t.source,checked:data.checked});
 if(data.qualifiers&&!raw.leagues.some(l=>l.meta.id==='n2627'))raw.leagues.push({meta:{id:'n2627',name:'2026/27 entrants',teamsOnly:true},teams:[],players:[]});
 for(const t of data.qualifiers?.teams||[]){const [lg,code]=t.key.split('|'),L=raw.leagues.find(l=>l.meta.id===lg),meta=data.teams.find(x=>x.key===t.key);if(L&&!L.teams.some(x=>x.code===code))L.teams.push({code,name:t.name,country:meta?.country||''});}
 for(const L of raw.leagues){const have=new Set(L.players.map(p=>p.id));for(const p of data.players.filter(p=>p.league===L.meta.id))if(!have.has(p.id)){L.players.push(structuredClone(p));have.add(p.id);}L.meta.playerCount=L.players.length;
 for(const p of L.players){const r=byId.get(p.id);if(!r)continue;p._officialRoster={season:data.season,teamName:r.teamName,teamId:r.teamId,number:r.number,source:r.source,profile:r.profile,checked:data.checked};p.currentRosterSeason=data.season;p.currentClub=r.teamName;p.currentRosterSource=r.source;p.currentRosterProfile=r.profile;if(r.img)p.img=r.img;if(!p.born||p.born>2015)p.born=r.born;if(!p.height)p.height=r.height;if(!p.weight)p.weight=r.weight;}}
 if(data.qualifiers&&raw.season2627?.comps?.bcl){const c=raw.season2627.comps.bcl;c.teams=[...c.teams.filter(t=>t.stage!=='Q'),...data.qualifiers.teams];}
 raw.domestic2627=raw.domestic2627||{season:data.season,leagues:{}};for(const [id,name] of Object.entries({aba:'ABA League',acb:'Spain ACB',lba:'Italy Serie A'}))raw.domestic2627.leagues[id]={id,name,season:data.season,confirmed:true,complete:true,checked:data.checked.slice(0,10),source:data.teams.find(t=>t.id.startsWith(id+'-')).source,teams:data.teams.filter(t=>t.id.startsWith(id+'-')).map(t=>({key:t.key,name:t.name}))};
}
function decorate(clubs,byKey){for(const t of data.teams){const c=byKey.get(t.key);if(!c)continue;c.name=t.name;c.country=t.country;if(t.logo)c.logo=t.logo;for(const row of c.teams)row.searchAliases=[...new Set([...(row.searchAliases||[]),t.name,...t.aliases])];}clubs.sort((a,b)=>a.name.localeCompare(b.name));}
window.EuroScoutOfficialRosters={apply,current,key,link,decorate,data};
})();

