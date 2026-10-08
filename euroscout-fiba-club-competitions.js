(function(){
'use strict';
const data=window.EUROSCOUT_FIBA_CLUB_2026;if(!data)return;
if(data.format==='compact-v1'){
 const teamById=new Map(data.teams.map(team=>[team.id,team]));
 for(const team of data.teams){team.canonicalKey=team.key;team.currentKey=team.competition+'26|'+team.officialCode;}
 data.roster=data.roster.map(row=>{const [competition,fibaId,ids,name,teamId,born,dob,height,number,img,finalRoster,position,country]=row,team=teamById.get(teamId),league=competition+'26';
  return{id:`fiba-${competition}-${fibaId}`,ids,name,teamId,teamName:team.name,league,born,dob,height,number,img,source:team.source,profile:team.source,existing:ids.length>1,fibaId,competition,competitionId:team.competitionId,finalRoster,position,country};});
 data.players=data.roster.map(row=>{const team=teamById.get(row.teamId),code=team.officialCode,role=/center|centre/i.test(row.position)?'Big':/forward/i.test(row.position)?'Forward':'Guard';
  return{id:row.id,code:String(row.fibaId),fibaId:row.fibaId,name:row.name,league:row.league,team:code,teamName:row.teamName,born:row.born,dob:row.dob,height:row.height,country:row.country,pos:row.position||'',role,jersey:row.number,img:row.img,_rosterOnly:true,_strictIdentity:true,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[]};});
 const rosterByCompetitionId=new Map(data.roster.map(row=>[row.competition+'|'+row.fibaId,row]));
 for(const competition of Object.values(data.competitions)){
  competition.teams=competition.teamIds.map(id=>teamById.get(id));delete competition.teamIds;
  competition.statsPlayers=competition.stats.map(values=>{const [fibaId,g,min,mpg,pts,ppg,reb,rpg,ast,apg,stl,spg,blk,bpg,tov,topg,eff,fgm,fga,f2m,f2a,f3m,f3a,ftm,fta,fgp,f2p,f3p,ftp,plusMinus]=values,row=rosterByCompetitionId.get(competition.id+'|'+fibaId),team=teamById.get(row.teamId);
   return{id:`fiba-stat-${competition.id}-${fibaId}`,primary:row.id,fibaId,name:row.name,teamCode:team.officialCode,teamName:team.name,teamId:team.fibaTeamId,born:row.dob,height:row.height,jersey:row.number,nationality:row.country,position:row.position,img:row.img,source:team.source,g,min,mpg,pts,ppg,reb,rpg,ast,apg,stl,spg,blk,bpg,tov,topg,eff,fgm,fga,f2m,f2a,f3m,f3a,ftm,fta,fgp,f2p,f3p,ftp,plusMinus,finalRoster:row.finalRoster};});
  delete competition.stats;
 }
 delete data.format;
}
const base=window.EUROSCOUT_OFFICIAL_ROSTERS;if(!base)return;
const merge=(target,rows,key)=>{const seen=new Set(target.map(key));for(const row of rows||[]){const id=key(row);if(!seen.has(id)){target.push(row);seen.add(id);}}};
base.teams=base.teams||[];base.roster=base.roster||[];base.players=base.players||[];
merge(base.teams,data.teams,t=>t.id);merge(base.roster,data.roster,r=>r.id);merge(base.players,data.players,p=>p.id);
base.identityPairs=base.identityPairs||[];
for(const team of data.teams){
 const pair=[team.currentKey,team.canonicalKey];
 if(pair[0]!==pair[1]&&!base.identityPairs.some(row=>pair.every(key=>row.includes(key))))base.identityPairs.push(pair);
}
if(!base.checked||String(base.checked)<String(data.checked))base.checked=data.checked;

const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);
for(const team of data.teams.filter(t=>t.key.startsWith('directory|'))){
 const id=team.key.slice('directory|'.length),existing=directory.find(x=>x.id===id);
 const row={id,name:team.name,country:team.country,league:team.competition==='bcl'?'Basketball Champions League':'FIBA Europe Cup',aliases:team.aliases,source:team.source,checked:data.checked};
 if(existing)Object.assign(existing,row);else directory.push(row);
}
const memberships=window.EUROSCOUT_MEMBERSHIPS?.leagues;
if(memberships)for(const [id,competition] of Object.entries(data.competitions)){
 const previous=memberships[id]||{};
 memberships[id]={...previous,id,name:competition.name,season:data.season,checked:String(data.checked).slice(0,10),confirmed:true,complete:true,international:true,source:competition.source,
  note:'Current official competition field and team registrations from FIBA team pages.',teams:competition.teams.map(team=>({key:team.currentKey,name:team.name,stage:'RS'}))};
}

const posMap={'Point Guard':['PG','Guard'],'Shooting Guard':['SG','Guard'],'Guard':['G','Guard'],'Small Forward':['SF','Forward'],'Power Forward':['PF','Forward'],'Forward':['F','Forward'],'Center':['C','Big'],'Centre':['C','Big'],'Big':['C','Big']};
const round=(n,d=1)=>n==null?null:Number(Number(n).toFixed(d));
const bioName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const verifiedCountryByFibaId=new Map(Object.entries({
 389876:'United States',323950:'United States',238002:'Hungary',220769:'United States',399164:'United States',198132:'Hungary',204851:'Hungary',423674:'Hungary',217602:'Hungary',342379:'Hungary',423673:'Hungary',189591:'Finland',
 325199:'United States',346133:'Poland',231269:'Poland',346231:'Poland',156476:'Poland',175845:'Poland',204509:'France',400910:'United States',221183:'Serbia',258124:'United States',218279:'Poland'
}).map(([id,country])=>[Number(id),country]));
function enrichPlayerNationalities(raw){
 const byName=new Map();
 for(const league of raw?.leagues||[])for(const player of league.players||[]){
  if(player._fibaCurrent||String(player.id||'').startsWith('fiba-fec-')||String(player.id||'').startsWith('fiba-bcl-'))continue;
  const country=window.EuroScoutCountries?.canonical(player.country||player.nationality)||player.country||player.nationality||null;
  if(!country)continue;
  const key=bioName(player.name);if(!key)continue;
  const born=Number(player.born||String(player.dob||player.birthdate||'').slice(0,4))||null;
  if(!byName.has(key))byName.set(key,[]);byName.get(key).push({country,born});
 }
 const resolve=player=>{
  const verified=verifiedCountryByFibaId.get(Number(player.fibaId));if(verified)return verified;
  const candidates=byName.get(bioName(player.name))||[];if(!candidates.length)return null;
  const born=Number(player.born||String(player.dob||'').slice(0,4))||null;
  const yearMatches=born?candidates.filter(item=>item.born===born):[];
  const pool=yearMatches.length?yearMatches:candidates;
  const countries=[...new Set(pool.map(item=>item.country).filter(Boolean))];
  return countries.length===1?countries[0]:null;
 };
 for(const player of data.roster){const country=resolve(player);player.country=country||null;}
 const rosterById=new Map(data.roster.map(row=>[row.id,row]));
 for(const player of data.players){const source=rosterById.get(player.id);player.country=source?.country||null;}
 for(const competition of Object.values(data.competitions))for(const player of competition.statsPlayers){
  const source=rosterById.get(player.primary);player.nationality=source?.country||null;
 }
}
function record(raw,competition){
 const [pos,role]=posMap[raw.position]||[raw.position||'',raw.position||''];
 const country=window.EuroScoutCountries?.canonical(raw.nationality)||raw.nationality||null,g=raw.g||0,min=raw.min??null;
 const fgm=raw.fgm,fga=raw.fga,f3m=raw.f3m,f3a=raw.f3a,ftm=raw.ftm,fta=raw.fta;
 return {id:raw.id,code:String(raw.fibaId),fibaId:raw.fibaId,name:raw.name,league:competition.id+'26',team:raw.teamCode,teamName:raw.teamName,
  competitionId:competition.id,statsSeason:data.season,season:data.season,_fibaCurrent:true,_strictIdentity:true,
  born:raw.born?Number(String(raw.born).slice(0,4)):null,dob:raw.born||null,age:raw.born?2026-Number(String(raw.born).slice(0,4)):null,
  height:raw.height||null,jersey:raw.jersey||'',country,nationalities:country?[country]:[],pos,role,officialPosition:raw.position||null,img:raw.img||null,
  qualified:!!g,g,min,mpg:raw.mpg??null,ppg:raw.ppg??null,rpg:raw.rpg??null,apg:raw.apg??null,spg:raw.spg??null,bpg:raw.bpg??null,topg:raw.topg??null,
  eff:raw.eff??null,pir:null,fgp:raw.fgp??null,f2p:raw.f2p??null,f3p:raw.f3p??null,ftp:raw.ftp??null,
  efg:fga?round(100*(fgm+0.5*f3m)/fga):null,ts:(fga+0.44*fta)?round(100*raw.pts/(2*(fga+0.44*fta))):null,
  fgma:fga!=null?fgm+'-'+fga:null,f3ma:f3a!=null?f3m+'-'+f3a:null,ftma:fta!=null?ftm+'-'+fta:null,
  t_pts:raw.pts??null,t_reb:raw.reb??null,t_ast:raw.ast??null,t_stl:raw.stl??null,t_blk:raw.blk??null,t_tov:raw.tov??null,
  t_fgm:fgm??null,t_fga:fga??null,t_f3m:f3m??null,t_f3a:f3a??null,t_ftm:ftm??null,t_fta:fta??null,
  pts40:g&&min?round(40*raw.pts/min):null,reb40:g&&min?round(40*raw.reb/min):null,ast40:g&&min?round(40*raw.ast/min):null,
  stl40:g&&min?round(40*raw.stl/min):null,blk40:g&&min?round(40*raw.blk/min):null,tov40:g&&min?round(40*raw.tov/min):null,
  gameLog:[],pct:{},z:{},arch:[],_officialFIBA:{source:raw.source,checked:data.checked,personId:raw.fibaId,teamId:raw.teamId,number:raw.jersey,position:raw.position,games:g,plusMinus:raw.plusMinus??null,finalRoster:raw.finalRoster}};
}
function apply(raw){
 if(!raw?.leagues)return;
 enrichPlayerNationalities(raw);
 for(const competition of Object.values(data.competitions)){
  raw.season2627=raw.season2627||{};raw.season2627.comps=raw.season2627.comps||{};
  // This pack can load before membership-data.js. Its verified entries must
  // replace stale private-core membership without depending on script order.
  raw.season2627.comps[competition.id]={id:competition.id,name:competition.name,season:data.season,checked:data.checked,confirmed:true,complete:true,international:true,source:competition.source,
   teams:competition.teams.map(team=>({key:team.currentKey,name:team.name,stage:'RS'}))};
  const leagueId=competition.id+'26',teams=competition.teams.map(team=>({code:team.officialCode,name:team.name,source:team.source,logo:team.logo||null,country:team.country||'',canonicalKey:team.canonicalKey}));
  let league=raw.leagues.find(item=>item.meta.id===leagueId);
  if(!league){league={meta:{id:leagueId,name:competition.name+' 2026/27',season:data.season,source:competition.source,checked:data.checked,current:true},teams,players:[]};raw.leagues.push(league);}
  Object.assign(league.meta,{id:leagueId,name:competition.name+' 2026/27',season:data.season,source:competition.source,checked:data.checked,current:true});
  league.teams=teams;
  const existing=new Map(league.players.map(player=>[player.id,player]));
  for(const row of competition.statsPlayers){const fresh=record(row,competition),current=existing.get(fresh.id);if(current)Object.assign(current,fresh);else{league.players.push(fresh);existing.set(fresh.id,fresh);}}
  league.meta.playerCount=league.players.length;
 }
}
function link(uni){for(const competition of Object.values(data.competitions))for(const player of competition.statsPlayers)uni(player.id,player.primary);}
window.EuroScoutFIBAClub={apply,link,data};
})();
