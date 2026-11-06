/* Current US rosters enrich existing people; source statistics and private edits stay intact. */
(function(){'use strict';
let data=null,pending=null;
const SUPPORTED=new Set(['nba','gleague','ncaam']),byId=new Map(),byEspn=new Map(),addedIds=new Set();
const rank={nba:0,gleague:1,ncaam:2};
async function enrich(raw){
 if(!data){pending=pending||fetch('data/us-rosters-2026.json?v=20261105',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Current US rosters could not load');return r.json();}).then(d=>{if(d.schemaVersion!==1||d.rosterSeason!=='2026-27'||!Array.isArray(d.players))throw Error('Invalid US roster data');data=d;index();return d;}).catch(e=>{pending=null;throw e;});await pending;}
 apply(raw);
}
function index(){byId.clear();byEspn.clear();addedIds.clear();for(const id of data.newPlayerIds||[])addedIds.add(id);for(const r of data.players){for(const id of r.ids){if(!byId.has(id))byId.set(id,[]);byId.get(id).push(r);}if(r.espnId){if(!byEspn.has(r.espnId))byEspn.set(r.espnId,[]);byEspn.get(r.espnId).push(r);}}}
function records(p){if(!data||!p)return[];const found=new Set(),rows=[],people=[p,...(p._grp||[])],ids=typeof recordIds==='function'?recordIds(p):people.map(p=>p.id);
 const add=r=>{const key=r.league+'|'+r.team+'|'+(r.espnId||r.id);if(!found.has(key)){found.add(key);rows.push(r);}};
 for(const id of ids)for(const r of byId.get(id)||[])add(r);
 for(const person of people)for(const r of byEspn.get(String(person._espnId||''))||[])add(r);
 return rows.sort((a,b)=>rank[a.league]-rank[b.league]);}
function updateBio(p,r){
 if(r.espnId)p._espnId=r.espnId;p._strictIdentity=true;if(r.nbaId)p._nbaId=Number(r.nbaId);
 // Never reinterpret birthplace as citizenship. Keep nationality unknown when it is not sourced.
 const bio={};for(const k of ['height','weight','born','birthDate','age','pos','role'])if(r[k]!=null&&r[k]!=='')bio[k]=r[k];
 Object.assign(p,bio);if(r.birthDate)delete p._birthYearNeedsSource;if(p._orig)for(const k of ['height','weight','born','birthDate','pos','role'])if(k in bio)p._orig[k]=bio[k];
 if(r.img)p.img=r.img;if(p.league===r.league)p.jersey=r.jersey;
 if(p.league===r.league)p._usRoster=true;p.currentRosterSeason=data.rosterSeason;
}
function apply(raw){
 if(!data||!raw?.leagues)return;
 for(const L of raw.leagues){if(!SUPPORTED.has(L.meta.id))continue;
  const lg=L.meta.id,rows=data.players.filter(r=>r.league===lg),lookup=new Map(L.players.map(p=>[p.id,p]));
  for(const p of L.players){p._usRoster=false;
   // Older NBA-family exports copied DRAFT_YEAR into born. Retain draft metadata,
   // but leave birth year unknown until a real birth date can replace it.
   if(lg!=='ncaam'&&p.born&&p.born===p._draftYr&&p.age&&Math.abs((2026-p.born)-p.age)>2){p.born=null;if(p._orig?.born===p._draftYr)p._orig.born=null;p._birthYearNeedsSource=true;}
  }
  for(const r of rows){let players=r.ids.map(id=>lookup.get(id)).filter(Boolean);
   if(!players.length){const p={id:r.id,code:lg==='ncaam'?r.espnId||r.id:r.nbaId||'espn-'+r.espnId,name:r.name,league:lg,team:r.team,teamName:r.teamName,
    g:null,mpg:null,ppg:null,rpg:null,apg:null,spg:null,bpg:null,topg:null,fgp:null,f3p:null,ftp:null,pir:null,
    height:null,weight:null,born:null,country:r.country||null,qualified:false,gameLog:[],pct:{},z:{},arch:[],_other:true,_rosterOnly:true,statsSeason:'2026/27'};
    L.players.push(p);lookup.set(p.id,p);players=[p];}
   for(const p of players)updateBio(p,r);
  }
  const teams=new Map((L.teams||[]).map(t=>[t.code,t]));
  for(const t of data.teams.filter(t=>t.league===lg)){const old=teams.get(t.code);if(old)Object.assign(old,{name:t.name,logo:t.logo||old.logo});else{const team={code:t.code,name:t.name,logo:t.logo,country:t.country||'United States'};L.teams.push(team);teams.set(t.code,team);}}
  Object.assign(L.meta,{combinedDatabase:true,rosterSeason:data.rosterSeason,statsSeason:L.meta.season,rosterUpdatedAt:data.checkedAt,rosterStatus:'imported',rosterSource:data.provider,
   rosterCoverage:{teams:data.teams.filter(t=>t.league===lg).length,players:rows.length,checkedAt:data.checkedAt}});
 }
 // A historical NBA line can belong to a current G League player and vice versa.
 // Correct the linked person's imported bio without making that old league a current membership.
 for(const L of raw.leagues)if(SUPPORTED.has(L.meta.id))for(const p of L.players){const rows=byId.get(p.id)||[],r=rows.find(r=>r.league===p.league)||rows[0];if(r)updateBio(p,r);}
}
function keys(p){return [...new Set(records(p).map(r=>typeof canonKey==='function'?canonKey(r.league+'|'+r.team):r.league+'|'+r.team))];}
function key(p){return keys(p)[0]||null;}
function ncaa(p){const r=records(p).find(r=>r.league==='ncaam');if(!r)return null;return {classYear:r.academicYear||'Unknown',classLabel:r.academicYear||'Year not published',classOrder:r.classOrder,
 classRaw:r.academicYearRaw,team:r.teamName,teamCode:r.team,teamId:r.teamProviderId,jersey:r.jersey,source:r.source,profile:r.profile,checkedAt:r.checkedAt};}
function collegeResolved(p){if(!data)return false;const ids=[p,...(p?._grp||[])];if(ids.some(x=>{const old=x?._ncaa?.seasons?.['2026-27'];return old?.teamId&&data.coverage.some(c=>c.league==='ncaa'&&String(c.teamId)===String(old.teamId)&&c.status==='failed');}))return false;return ids.some(x=>x.league==='ncaam');}
function preferredIds(ids){const old=ids.filter(id=>!addedIds.has(id));return old.length?old:ids;}
function link(uni){for(const pair of data?.links||[])uni(...pair);if(!data)return;for(const r of data.players)for(const id of r.ids)if(id!==r.id)uni(r.id,id);
 // ESPN's person ID is shared between its college and professional feeds.
 if(typeof allPlayersEvery==='function'){const groups=new Map();for(const p of allPlayersEvery()){const eid=p._espnId||(p.league==='ncaam'&&/^\d+$/.test(String(p.code))?String(p.code):null);if(!eid)continue;if(!groups.has(eid))groups.set(eid,[]);groups.get(eid).push(p);}for(const ps of groups.values()){const years=new Set(ps.map(p=>p.born).filter(Boolean));if(years.size>1)continue;for(const p of ps.slice(1))uni(ps[0].id,p.id);}}}
function teams(league){return data?.teams.filter(t=>t.league===league)||[];}
window.EuroScoutUSARosters={enrich,teams,apply,key,keys,records,ncaa,collegeResolved,link,preferredIds,ready:()=>!!data,coverage:()=>data?.coverage||[]};
})();
