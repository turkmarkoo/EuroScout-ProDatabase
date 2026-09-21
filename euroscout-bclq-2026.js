(function(){
'use strict';
const data=window.EUROSCOUT_BCLQ_2026;if(!data)return;
const byId=new Map(data.players.map(p=>[p.id,p]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
const key=(name,born)=>norm(name)+'|'+String(born||'').slice(0,4);
const official=window.EUROSCOUT_OFFICIAL_ROSTERS;
const rosterByIdentity=new Map((official?.roster||[]).map(r=>[key(r.name,r.born),r]));
const posMap={'Point Guard':['PG','Guard'],'Shooting Guard':['SG','Guard'],'Guard':['G','Guard'],'Small Forward':['SF','Forward'],'Power Forward':['PF','Forward'],'Forward':['F','Forward'],'Center':['C','Big'],'Centre':['C','Big'],'Big':['C','Big']};
function record(r){
 const [pos,role]=posMap[r.position]||[r.position||'',r.position||''];
 const country=window.EuroScoutCountries?.canonical(r.nationality)||null;
 const p={id:'bclq-'+r.id,code:String(r.id),fibaId:r.id,name:r.name,league:'bclq',team:r.teamCode,teamName:r.teamName,
  competitionId:'bclq',stage:'Q',statsSeason:'2026/27',season:'2026/27',_qualifier:true,_strictIdentity:true,
  born:r.born?Number(r.born.slice(0,4)):null,dob:r.born||null,age:r.born?2026-Number(r.born.slice(0,4)):null,
  height:r.height||null,jersey:r.jersey||'',country,nationalities:(r.nationalities||[]).map(n=>window.EuroScoutCountries?.canonical(n)||n),pos,role,officialPosition:r.position||null,
  img:r.img||null,qualified:!!r.g,g:r.g||0,min:r.min??null,mpg:r.mpg??null,ppg:r.ppg??null,rpg:r.rpg??null,apg:r.apg??null,
  spg:r.spg??null,bpg:r.bpg??null,topg:r.topg??null,eff:r.eff??null,pir:null,fgp:r.fgp??null,
  f2p:r.f2p??null,f3p:r.f3p??null,ftp:r.ftp??null,efg:r.efg??null,ts:r.ts??null,
  fgma:r.fga!=null?r.fgm+'-'+r.fga:null,f3ma:r.f3a!=null?r.f3m+'-'+r.f3a:null,ftma:r.fta!=null?r.ftm+'-'+r.fta:null,
  t_pts:r.pts??null,t_reb:r.reb??null,t_ast:r.ast??null,t_stl:r.stl??null,t_blk:r.blk??null,t_tov:r.tov??null,
  t_fgm:r.fgm??null,t_fga:r.fga??null,t_f3m:r.f3m??null,t_f3a:r.f3a??null,t_ftm:r.ftm??null,t_fta:r.fta??null,
  pts40:r.g&&r.min?Math.round(40*r.pts/r.min*10)/10:null,reb40:r.g&&r.min?Math.round(40*r.reb/r.min*10)/10:null,
  ast40:r.g&&r.min?Math.round(40*r.ast/r.min*10)/10:null,stl40:r.g&&r.min?Math.round(40*r.stl/r.min*10)/10:null,
  blk40:r.g&&r.min?Math.round(40*r.blk/r.min*10)/10:null,tov40:r.g&&r.min?Math.round(40*r.tov/r.min*10)/10:null,
  gameLog:[],pct:{},z:{},arch:[],_officialBCLQ:{source:r.source,checked:data.checked,personId:r.id,teamId:r.teamId,number:r.jersey,position:r.position,nationality:r.nationality,nationalities:r.nationalities,games:r.g||0,plusMinus:r.plusMinus??null}};
 return p;
}
function apply(raw){
 if(!raw?.leagues)return;
 const teams=data.teams.map(t=>({code:t.code,name:t.name,source:t.source}));
 let L=raw.leagues.find(l=>l.meta.id==='bclq');
 if(!L){L={meta:{id:'bclq',name:'BCL Qualifiers',season:'2026/27',qualifier:true,source:data.source,checked:data.checked},teams,players:[]};raw.leagues.push(L);}
 const have=new Set(L.players.map(p=>p.id));for(const r of data.players)if(!have.has('bclq-'+r.id))L.players.push(record(r));
 L.meta.playerCount=L.players.length;
 // The existing 2026/27 official roster layer already holds all 326 identities.
 // Update stable biographical details, but keep each historical league's jersey and club intact.
 const all=new Map(raw.leagues.flatMap(l=>l.players).filter(p=>p.league!=='bclq').map(p=>[p.id,p]));
 for(const r of data.players){const match=rosterByIdentity.get(key(r.name,r.born));if(!match)continue;
  // A qualifier jersey is a 2026/27 registration, not a historical league jersey.
  if(r.jersey!==null&&r.jersey!==undefined&&r.jersey!=='')match.number=String(r.jersey);
  for(const id of match.ids||[]){const p=all.get(id);if(!p)continue;
   if(r.height)p.height=r.height;if(r.born)p.born=Number(r.born.slice(0,4));
   const country=window.EuroScoutCountries?.canonical(r.nationality);if(country)p.country=country;
   if(r.jersey!==null&&r.jersey!==undefined&&r.jersey!==''&&p._officialRoster?.teamId===r.teamId){p.currentJersey=String(r.jersey);p._officialRoster.number=String(r.jersey);}
   p._officialBCLQ={source:r.source,checked:data.checked,personId:r.id,teamId:r.teamId,number:r.jersey,position:r.position,nationality:r.nationality,games:r.g||0};
  }
 }
}
function link(uni){for(const r of data.players){const match=rosterByIdentity.get(key(r.name,r.born));if(!match)continue;for(const id of match.ids||[])uni('bclq-'+r.id,id);}}
window.EuroScoutBCLQ={apply,link,data,byId};
})();
