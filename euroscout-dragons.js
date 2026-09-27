/* Owner-only Dragons Data. Never cache or copy this feed into shared scouting snapshots. */
(function(){'use strict';
const OWNER='markoturk.scouting@gmail.com';
let feed=null,problem='';
function owner(){return window.ESAccess?.internal&&ESAccess.owner&&ESAccess.user?.email?.toLowerCase()===OWNER;}
async function apply(raw){
 if(!owner())return raw;
 try{
  const head=await ESAccess.get('dragonsDataState/current');
  if(!head)return raw;
  const id=ESAccess.field(head,'snapshot');
  if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid statistics snapshot pointer.');
  const data=JSON.parse(await ESAccess.readPayload('dragonsDataSnapshots',id));
  if(data.schema!==1||data.quality_policy!=='accepted_live_boxscores_only'||!Array.isArray(data.leagues)||!Array.isArray(data.fixtures))throw Error('Invalid Dragons Data feed.');
  if(!owner())return raw;
  // A detached copy prevents future scouting saves from sharing the owner feed.
  const result=structuredClone(raw);
  const ids=new Set(data.leagues.map(l=>l.meta.id));
  if(data.leagues.some(l=>!l.meta?.privateOwnerFeed||!l.meta.id?.startsWith('dragons-')||!Array.isArray(l.players)))throw Error('Invalid owner-only league.');
  result.leagues=result.leagues.filter(l=>!ids.has(l.meta.id)).concat(data.leagues);
  feed=data;return result;
 }catch(e){problem='Dragons Data could not load. Existing EuroScout data is unchanged.';console.warn(problem);return raw;}
}
function finish(raw){
 if(!owner())return;
 for(const L of raw.leagues||[])if(L.meta.privateOwnerFeed)for(const p of L.players||[]){
  for(const [key,val] of Object.entries(p.dragonsTotals||{}))p['t_'+({p3m:'f3m',p3a:'f3a'}[key]||key)]=val;
 }
 const badge=document.createElement('div');badge.id='dragonsDataStatus';badge.setAttribute('role','status');badge.style.cssText='padding:8px 16px;background:#edf8ee;color:#23462b;font:13px system-ui';
 badge.textContent=feed?'Private Dragons Data · updated '+new Date(feed.generated).toLocaleString()+' · validated boxes only.':problem||'Dragons Data is not synced yet.';
 document.querySelector('header')?.after(badge);
}
window.EuroScoutDragons={apply,finish,fixtures(){return owner()&&feed?feed.fixtures:[];},active(){return !!(owner()&&feed);}};
})();
