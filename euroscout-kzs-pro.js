(function(){
'use strict';
const data=window.EUROSCOUT_KZS_PRO_2026;if(!data)return;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const identity=(name,born)=>norm(name)+'|'+String(born||'').slice(0,4);
const dbId=r=>'slo-'+String(r.id);
const teamById=new Map(data.teams.map(t=>[t.id,t]));
const rosterById=new Map();
const statsRequests=new Map();
let links=[];
function record(r,t){return {id:dbId(r),code:String(r.id).replace(/^kzs-/,''),name:r.name,league:'slo',team:t.code,teamName:t.name,
  born:r.born||null,height:r.height||null,pos:r.position||'',role:r.position||'',img:r.img||null,season:data.season,statsSeason:data.season,
  _rosterOnly:true,_strictIdentity:true,_kzsPro:true,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[],
  _officialKzsRoster:{season:data.season,competitionId:608,teamId:t.id,teamKey:t.key,teamName:t.name,source:r.source,profile:r.profile,checked:r.checked||data.checked}};}
function current(p){return p&&(rosterById.get(p.id)||(p._grp||[]).map(x=>rosterById.get(x.id)).find(Boolean))||null;}
function currentLine(p){return p&&(p._kzsPro?p:(p._grp||[]).find(x=>x._kzsPro))||null;}
function key(p){const r=current(p);return r?r._officialKzsRoster.teamKey:null;}
function round(value,digits=1){const factor=10**digits;return Math.round((Number(value)||0)*factor)/factor;}
function pct(value){return value==null?null:round(value,1);}
function hydrate(line,payload){
 const phases=payload?.data?.phases||[],matches=[...new Map(phases.flatMap(phase=>phase.matches||[]).filter(match=>match.played!==false).map(match=>[match.matchId||match.dateTime,match])).values()];
 if(!matches.length)return line;
 const sums=matches.reduce((out,match)=>{for(const key of ['minutes','points','totalRebounds','assists','steals','blocksInFavor','turnovers','fgM','fgA','twoPM','twoPA','threePM','threePA','fTM','fTA','efficiency'])out[key]=(out[key]||0)+(Number(match[key])||0);return out;},{});
 const games=matches.length,perGame=key=>round((sums[key]||0)/games,1),per40=key=>sums.minutes?round((sums[key]||0)*40/sums.minutes,1):null;
 Object.assign(line,{_rosterOnly:false,_verifiedExternal:true,qualified:games>=5&&perGame('minutes')>=10,g:games,min:round(sums.minutes,1),mpg:perGame('minutes'),ppg:perGame('points'),rpg:perGame('totalRebounds'),apg:perGame('assists'),spg:perGame('steals'),bpg:perGame('blocksInFavor'),topg:perGame('turnovers'),pir:perGame('efficiency'),eff:perGame('efficiency'),
  fgp:sums.fgA?pct(100*sums.fgM/sums.fgA):null,f2p:sums.twoPA?pct(100*sums.twoPM/sums.twoPA):null,f3p:sums.threePA?pct(100*sums.threePM/sums.threePA):null,ftp:sums.fTA?pct(100*sums.fTM/sums.fTA):null,efg:sums.fgA?pct(100*(sums.fgM+.5*sums.threePM)/sums.fgA):null,ts:(sums.fgA+.44*sums.fTA)?pct(100*sums.points/(2*(sums.fgA+.44*sums.fTA))):null,
  fgma:sums.fgM+'-'+sums.fgA,f3ma:sums.threePM+'-'+sums.threePA,ftma:sums.fTM+'-'+sums.fTA,pts40:per40('points'),reb40:per40('totalRebounds'),ast40:per40('assists'),stl40:per40('steals'),blk40:per40('blocksInFavor'),tov40:per40('turnovers'),ftr:sums.fgA?round(sums.fTA/sums.fgA,3):null,r3a:sums.fgA?pct(100*sums.threePA/sums.fgA):null,pps:sums.fgA?round(sums.points/sums.fgA,2):null,pct:{},z:{}});
 line.gameLog=matches.map(match=>{const home=Number(match.firstTeamId)===Number(line._officialKzsRoster?.teamId?.replace(/^kzs:/,'')),teamPts=home?match.firstTeamScore:match.secondTeamScore,oppPts=home?match.secondTeamScore:match.firstTeamScore;return [String(match.dateTime||'').slice(0,10),home?match.secondTeamName:match.firstTeamName,home?'H':'A',Number(teamPts)>Number(oppPts),teamPts,oppPts,round(match.minutes,1),match.points,match.fgM,match.fgA,match.threePM,match.threePA,match.fTM,match.fTA,match.totalRebounds,match.assists,match.steals,match.blocksInFavor,match.turnovers,match.efficiency,match.plusMinus];});
 return line;
}
function needsStats(p){const line=currentLine(p);return !!(line&&!Number(line.g));}
function loadStats(p,fetcher){const line=currentLine(p),roster=current(p);if(!line||!roster)return Promise.resolve(line);if(Number(line.g)>0)return Promise.resolve(line);const playerId=String(roster.id||'').replace(/^kzs-/,''),competitionId=String(roster._officialKzsRoster?.competitionId||'608'),cacheKey=playerId+'|'+competitionId;if(statsRequests.has(cacheKey))return statsRequests.get(cacheKey);fetcher=fetcher||fetch;const request=fetcher('https://api.kzs.si/api/v1/public/players/'+encodeURIComponent(playerId)+'/matches?competitionId='+encodeURIComponent(competitionId),{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('KZS statistics returned '+response.status);return response.json();}).then(payload=>{if(payload?.status!=='OK')throw Error('KZS statistics are unavailable');return hydrate(line,payload);}).finally(()=>statsRequests.delete(cacheKey));statsRequests.set(cacheKey,request);return request;}
function apply(raw){if(!raw?.leagues)return;links=[];rosterById.clear();
 const existingByIdentity=new Map();
 for(const L of raw.leagues)for(const p of L.players||[]){if(p._kzsPro)continue;const k=identity(p.name,p.born);if(!p.born)continue;if(!existingByIdentity.has(k))existingByIdentity.set(k,[]);existingByIdentity.get(k).push(p.id);}
 let L=raw.leagues.find(l=>l.meta.id==='slo');if(!L){L={meta:{id:'slo',name:'Liga OTP banka',season:'2025-26'},teams:[],players:[]};raw.leagues.push(L);}
 L.meta.currentRosterSeason=data.season;L.meta.currentRosterSource=data.source;L.meta.currentRosterChecked=data.checked;L.meta.gameLogCols=['date','opp','ha','win','teamPts','oppPts','min','pts','fgm','fga','fg3m','fg3a','ftm','fta','reb','ast','stl','blk','tov','pir','pm'];
 const haveTeams=new Map((L.teams||[]).map(t=>[t.code,t]));
 for(const t of data.teams){let row=haveTeams.get(t.code);if(!row){row={code:t.code,name:t.name,country:t.country||'Slovenia',league:'slo'};L.teams.push(row);haveTeams.set(t.code,row);}Object.assign(row,{name:t.name,country:t.country||'Slovenia',logo:t.logo||row.logo,rosterCount:t.rosterCount,rosterSeason:data.season,currentRosterSource:t.source});}
 const havePlayers=new Map((L.players||[]).map(p=>[p.id,p]));
 for(const r of data.roster){const t=teamById.get(r.teamId);if(!t)continue;const fresh=record(r,t),old=havePlayers.get(fresh.id);const p=old?Object.assign(old,fresh):fresh;if(!old){L.players.push(p);havePlayers.set(p.id,p);}rosterById.set(p.id,r);r._officialKzsRoster=fresh._officialKzsRoster;
  for(const id of existingByIdentity.get(identity(r.name,r.born))||[])links.push([p.id,id]);}
 L.meta.playerCount=L.players.length;
 raw.domestic2627=raw.domestic2627||{season:data.season,leagues:{}};raw.domestic2627.leagues.slo={id:'slo',name:'Liga OTP banka',season:data.season,confirmed:true,complete:true,checked:String(data.checked||'').slice(0,10),source:data.source,teams:data.teams.map(t=>({key:t.key,name:t.name}))};
}
function link(uni){for(const pair of links)uni(pair[0],pair[1]);}
function decorate(clubs,byKey){for(const t of data.teams){const c=byKey.get(t.key);if(!c)continue;c.name=t.name;c.country=t.country||'Slovenia';if(t.logo)c.logo=t.logo;for(const row of c.teams||[])row.searchAliases=[...new Set([...(row.searchAliases||[]),t.name,...(t.aliases||[])])];}}
window.EuroScoutKzsPro={apply,current,key,link,decorate,needsStats,loadStats,hydrate,data};
})();
