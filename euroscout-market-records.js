/* Shared market intelligence. Never stored in public datasets or mixed with statistical grades. */
(function(){'use strict';
const KEY='euroscout:market:v1';
const enums={availability:['Free Agent','Likely Available','Expiring Contract','Potentially Available','Under Contract','Unknown'],medical:['Healthy','Minor Injury','Out','Rehab','Returning','Unknown'],nbaStatus:['Free Agent','Waived','Training Camp','Exhibit 10','Two-Way','G League','Draft Rights','Unknown'],interest:['Priority','Monitoring','Discussing','Too expensive','Not interested'],confidence:['Confirmed','Reported','Unverified']};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const days=(date,now=new Date())=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;const t=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date)return null;const n=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-t)/864e5);return n<0?null:n;};
const url=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
let cached=null,rawCache='';
function refresh(){const raw=localStorage.getItem(KEY)||'{}';if(raw!==rawCache||!cached){rawCache=raw;try{cached=JSON.parse(raw);}catch{cached={};}}return cached;}
function all(){return cached||refresh();}
window.addEventListener('storage',e=>{if(e.key===KEY){cached=null;}});
function get(p){const records=all();return records[gid(p)]||records[p.id]||(p._grp||[]).map(x=>records[x.id]).find(Boolean)||{};}
function lastGame(p){const dates=[p,...(p._grp||[])].flatMap(x=>x.gameLog||[]).map(row=>Array.isArray(row)?row[0]:row.date||row.dateTime).filter(x=>typeof x==='string'&&days(x.slice(0,10))!==null).map(x=>x.slice(0,10));return dates.sort().pop()||'';}
function view(p,e){if(e.source?.startsWith('Manually ')&&window.EuroScoutMarket)e=EuroScoutMarket.evidence(p,next26Get(),null,true);const r=get(p),fallback=e.status==='signed'?'Under Contract':e.status==='available'?'Free Agent':e.status==='presumed'?'Likely Available':'Unknown';return {...r,availability:r.availability||fallback,medical:r.medical||'Unknown',daysAvailable:days(r.freeAgentSince),daysOnMarket:days(r.marketAddedAt),lastGame:lastGame(p),daysInactive:days(lastGame(p)),medicalStale:r.medical!=='Unknown'&&r.medical&& (days(r.medicalChecked)==null||days(r.medicalChecked)>60),conflict:!!(r.verified&&r.availability&&((e.status==='signed'&&r.availability!=='Under Contract')||(e.status==='available'&&r.availability==='Under Contract')))};}
function matches(p,e,f){const r={...get(p)};r.availability=r.availability||(e.status==='signed'?'Under Contract':e.status==='available'?'Free Agent':e.status==='presumed'?'Likely Available':'Unknown');const any=(k)=>!f[k]?.length||f[k].includes(String(r[k]||'Unknown'));

 if(f.inactive){const n=days(lastGame(p));if(n===null||n<+f.inactive)return false;}
 return true;
}
function validate(r){for(const k of Object.keys(enums))if(r[k]&&!enums[k].includes(r[k]))throw Error('Invalid '+k);for(const k of ['freeAgentSince','marketAddedAt','lastGame','medicalSince','medicalChecked','sourceDate','checkedAt'])if(r[k]&&days(r[k])===null)throw Error('Check '+k+' date.');if(r.expectedReturn&&!/^\d{4}-\d{2}-\d{2}$/.test(r.expectedReturn))throw Error('Check expected return date.');for(const k of ['askingSalary','lastSalary','nbaGames','gleagueGames'])if(r[k]!==''&&r[k]!=null&&(!Number.isFinite(+r[k])||+r[k]<0))throw Error('Check '+k);if(r.opportunity&&!(+r.opportunity>=1&&+r.opportunity<=5))throw Error('Opportunity must be 1–5.');for(const k of ['sourceURL','medicalSource'])if(r[k]&&!url(r[k]))throw Error('Use an http or https source link.');return r;}
async function save(p,data){if(!Store.canEdit())throw Error('Editing access required.');const records=refresh(),old=get(p),now=new Date().toISOString();const r=validate({...old,...data,updatedAt:now});if(!old.marketAddedAt&&!r.marketAddedAt&&['Free Agent','Likely Available','Expiring Contract','Potentially Available'].includes(r.availability))r.marketAddedAt=now.slice(0,10);if(r.medical!==old.medical)r.medicalUpdatedAt=now;r.history=[...(old.history||[]),{at:now,by:Store.user?.email||'local',before:{availability:old.availability||'',medical:old.medical||'',interest:old.interest||''},after:{availability:r.availability||'',medical:r.medical||'',interest:r.interest||''}}].slice(-100);records[gid(p)]=r;localStorage.setItem(KEY,JSON.stringify(records));const ok=await Store.pushAppKey(KEY);if(!ok)throw Error('Saved on this device; cloud save failed. Keep this page open and retry.');return r;}
function summary(){return '';}
window.EuroScoutMarketRecords={KEY,enums,days,get,view,matches,validate,save,summary,lastGame,refresh};
})();
