(function(){
'use strict';
const data=window.EUROSCOUT_KZS_PRO_2026;if(!data)return;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const identity=(name,born)=>norm(name)+'|'+String(born||'').slice(0,4);
const dbId=r=>'slo-'+String(r.id);
const teamById=new Map(data.teams.map(t=>[t.id,t]));
const rosterById=new Map();
let links=[];
function record(r,t){return {id:dbId(r),code:String(r.id).replace(/^kzs-/,''),name:r.name,league:'slo',team:t.code,teamName:t.name,
  born:r.born||null,height:r.height||null,pos:r.position||'',role:r.position||'',img:r.img||null,season:data.season,statsSeason:data.season,
  _rosterOnly:true,_strictIdentity:true,_kzsPro:true,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[],
  _officialKzsRoster:{season:data.season,teamId:t.id,teamKey:t.key,teamName:t.name,source:r.source,profile:r.profile,checked:r.checked||data.checked}};}
function current(p){return p&&(rosterById.get(p.id)||(p._grp||[]).map(x=>rosterById.get(x.id)).find(Boolean))||null;}
function key(p){const r=current(p);return r?r._officialKzsRoster.teamKey:null;}
function apply(raw){if(!raw?.leagues)return;links=[];rosterById.clear();
 const existingByIdentity=new Map();
 for(const L of raw.leagues)for(const p of L.players||[]){if(p._kzsPro)continue;const k=identity(p.name,p.born);if(!p.born)continue;if(!existingByIdentity.has(k))existingByIdentity.set(k,[]);existingByIdentity.get(k).push(p.id);}
 let L=raw.leagues.find(l=>l.meta.id==='slo');if(!L){L={meta:{id:'slo',name:'Liga OTP banka',season:'2025-26'},teams:[],players:[]};raw.leagues.push(L);}
 L.meta.currentRosterSeason=data.season;L.meta.currentRosterSource=data.source;L.meta.currentRosterChecked=data.checked;
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
window.EuroScoutKzsPro={apply,current,key,link,decorate,data};
})();
