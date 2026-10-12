/* Current official Israeli registrations and statistics, separate from historical lines. */
(function(){
'use strict';
const data=window.EUROSCOUT_ISRAEL_2026;if(!data)return;
const teams=new Map(data.teams.map(t=>[t.id,t])),byId=new Map();
for(const row of data.roster)for(const id of row.ids){if(byId.has(id)&&byId.get(id)!==row)throw Error('Conflicting Israeli identity '+id);byId.set(id,row);}
const round=(n,d=1)=>n==null?null:Number(Number(n).toFixed(d));
const percent=(m,a)=>a?round(100*m/a):null;
const role=position=>/C/.test(position)?'Big':/F/.test(position)?'Forward':/G/.test(position)?'Guard':'';
const cols=['date','opp','ha','win','teamPts','oppPts','min','pts','fgm','fga','fg3m','fg3a','ftm','fta','reb','ast','stl','blk','tov','pir','pm'];
function record(row){const t=teams.get(row.teamId),s=row.stats;
 const p={id:row.id,code:row.sourcePlayerId,name:row.name,league:'il',team:t.code,teamName:t.name,season:data.season,statsSeason:data.season,
  competitionId:'il',born:row.born,dob:row.dob,birthDate:row.dob,age:2026-row.born,height:row.height,country:row.country,nationalities:row.nationalities,pos:row.position,role:role(row.position),officialPosition:row.position,jersey:row.number,img:row.img,
  _israelCurrent:true,_strictIdentity:true,_rosterOnly:!s,qualified:!!s&&s.g>=5&&s.mpg>=10,g:s?.g??null,gameLog:[],pct:{},z:{},arch:[],
  currentRosterSeason:data.season,currentClub:t.name,currentRosterSource:row.source,currentRosterProfile:row.profile,
  _israelRoster:{season:data.season,teamKey:t.key,teamId:t.id,teamName:t.name,source:row.source,profile:row.profile,checked:data.checked}};
 if(!s)return p;
 Object.assign(p,s,{eff:s.pir,fgp:percent(s.fgm,s.fga),f2p:percent(s.f2m,s.f2a),f3p:percent(s.f3m,s.f3a),ftp:percent(s.ftm,s.fta),
  efg:s.fga?round(100*(s.fgm+.5*s.f3m)/s.fga):null,ts:s.fga+.44*s.fta?round(100*s.pts/(2*(s.fga+.44*s.fta))):null,
  fgma:s.fgm+'-'+s.fga,f3ma:s.f3m+'-'+s.f3a,ftma:s.ftm+'-'+s.fta,
  t_pts:s.pts,t_reb:s.reb,t_ast:s.ast,t_stl:s.stl,t_blk:s.blk,t_tov:s.tov,t_fgm:s.fgm,t_fga:s.fga,t_f3m:s.f3m,t_f3a:s.f3a,t_ftm:s.ftm,t_fta:s.fta,
  pts40:s.min?round(40*s.pts/s.min):null,reb40:s.min?round(40*s.reb/s.min):null,ast40:s.min?round(40*s.ast/s.min):null,
  stl40:s.min?round(40*s.stl/s.min):null,blk40:s.min?round(40*s.blk/s.min):null,tov40:s.min?round(40*s.tov/s.min):null,
  ftr:s.fga?round(s.fta/s.fga,3):null,r3a:percent(s.f3a,s.fga),pps:s.fga?round(s.pts/s.fga,2):null});
 p.gameLog=row.games.map(g=>[g.date||'',g.opp,g.ha,g.win,g.teamPts??null,g.oppPts??null,g.min,g.pts,g.fgm,g.fga,g.fg3m,g.fg3a,g.ftm,g.fta,g.reb,g.ast,g.stl,g.blk,g.tov,g.pir,null]);
 return p;
}
function current(p){return p&&(byId.get(p.id)||(p._grp||[]).map(x=>byId.get(x.id)).find(Boolean))||null;}
function key(p){const r=current(p);return r?canonKey(teams.get(r.teamId).key):null;}
function link(uni){for(const r of data.roster)for(const id of r.ids.slice(1))uni(r.id,id);}
function apply(raw){if(!raw?.leagues)return;
 let L=raw.leagues.find(l=>l.meta.id==='il');if(!L){L={meta:{id:'il',name:'Israeli Super League',season:'2025-26'},teams:[],players:[]};raw.leagues.push(L);}
 // Do not relabel the historical league or overwrite any historical statistics.
 Object.assign(L.meta,{currentRosterSeason:data.season,currentRosterSource:data.source,currentRosterChecked:data.checked,gameLogCols:cols});
 const existingTeams=new Map(L.teams.map(t=>[t.code,t]));for(const t of data.teams){const fresh={code:t.code,name:t.name,country:'Israel',logo:t.logo,rosterSeason:data.season,source:t.source,searchAliases:t.aliases};const old=existingTeams.get(t.code);if(old)Object.assign(old,fresh);else L.teams.push(fresh);}
 const existing=new Map(L.players.map(p=>[p.id,p]));for(const r of data.roster){const fresh=record(r),old=existing.get(r.id);if(old)Object.assign(old,fresh);else{L.players.push(fresh);existing.set(r.id,fresh);}}
 for(const league of raw.leagues)for(const p of league.players){const r=byId.get(p.id);if(!r)continue;const t=teams.get(r.teamId);
  Object.assign(p,{currentRosterSeason:data.season,currentClub:t.name,currentRosterSource:r.source,currentRosterProfile:r.profile,_israelRoster:{season:data.season,teamKey:t.key,teamId:t.id,teamName:t.name,source:r.source,profile:r.profile,checked:data.checked}});
  // Verified public bio fields; saved player overrides are applied by the app afterwards.
  Object.assign(p,{born:r.born,dob:r.dob,birthDate:r.dob,height:r.height,country:r.country,nationalities:r.nationalities,pos:r.position,role:role(r.position),jersey:r.number});if(r.img)p.img=r.img;
 }
 L.meta.playerCount=L.players.length;
 raw.domestic2627=raw.domestic2627||{season:data.season,leagues:{}};raw.domestic2627.leagues=raw.domestic2627.leagues||{};
 raw.domestic2627.leagues.il={id:'il',name:'Israeli Super League',season:data.season,confirmed:true,complete:true,checked:data.checked,source:data.source,teams:data.teams.map(t=>({key:t.key,name:t.name})),note:'All officially listed 2026/27 club rosters and player profiles; league statistics where published.'};
}
function decorate(clubs,byKey){for(const t of data.teams){const c=byKey.get(t.key);if(!c)continue;c.name=t.name;c.country='Israel';if(t.logo)c.logo=t.logo;for(const row of c.teams||[])row.searchAliases=[...new Set([...(row.searchAliases||[]),t.name,...t.aliases])];}clubs.sort((a,b)=>a.name.localeCompare(b.name));}
window.EuroScoutIsrael={apply,current,key,link,decorate,data,record};
})();
