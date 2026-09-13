/* Official FEB regular-season enrichment. Current assignments and private records are untouched. */
(function(){
function apply(raw){const pack=window.EUROSCOUT_ELITE2_DATA;if(!raw?.leagues||!pack)return;
const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);for(const t of pack.teams)if(!directory.some(v=>v.id===t.id))directory.push({...t});
for(const source of pack.leagues){let l=raw.leagues.find(l=>l.meta.id===source.meta.id);if(!l){l={meta:{...source.meta},teams:[],players:[],statMeta:{}};raw.leagues.push(l);}const teams=new Set(l.teams.map(t=>t.code));for(const t of source.teams)if(!teams.has(t.code)){l.teams.push({...t});teams.add(t.code);}for(const incoming of source.players){let old=l.players.find(p=>p.id===incoming.id);if(old){if(incoming.g>0)Object.assign(old,incoming);else for(const k of ['img','birthdate','profile_url','profile_provider'])if(!old[k])old[k]=incoming[k];}else l.players.push({...incoming});}
const keys=['ppg','rpg','apg','spg','bpg','topg','orpg','drpg','fgp','f3p','ftp','efg','ts','pir','eff','mpg','pts40','reb40','ast40','stl40','blk40','tov40'];l.statMeta=l.statMeta||{};
for(const k of keys){const vals=l.players.filter(p=>p.qualified&&Number.isFinite(p[k])).map(p=>p[k]).sort((a,b)=>a-b);if(!vals.length)continue;const mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length);l.statMeta[k]={mean,sd};for(const p of l.players){p.pct=p.pct||{};p.z=p.z||{};if(!Number.isFinite(p[k])){p.pct[k]=null;p.z[k]=null;continue;}p.pct[k]=100*vals.filter(v=>v<=p[k]).length/vals.length;p.z[k]=sd?(p[k]-mean)/sd:0;}}
l.meta.playerCount=l.players.length;l.meta.qualifiedCount=l.players.filter(p=>p.qualified).length;l.meta.source=source.meta.source;l.meta.statsScope=pack.scope;
}}
function key(p){const r=window.EUROSCOUT_ELITE2_DATA.roster.find(r=>r.ids.includes(p.id)||(p._grp||[]).some(x=>r.ids.includes(x.id)));return r?canonKey('directory|'+r.club):null;}
function link(uni){if(typeof allPlayersEvery==="function"){const all=allPlayersEvery(),fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");for(const p of all.filter(p=>p.league==="elite2"))for(const q of all)if(q.id!==p.id&&q.league!=="elite2"&&p.birthdate&&q.birthdate===p.birthdate&&fold(p.name)===fold(q.name))uni(p.id,q.id);}for(const pair of window.EUROSCOUT_ELITE2_DATA?.links||[])uni(...pair);}
window.EuroScoutElite2={apply,link,key};
})();
