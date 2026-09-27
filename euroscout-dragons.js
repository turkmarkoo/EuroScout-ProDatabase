/* DragonsHub statistics. Never cache or copy this feed into scouting snapshots. */
(function(){'use strict';
let feed=null,problem='';
function reader(){return window.ESAccess?.internal&&!!ESAccess.user;}
async function apply(raw){
 if(!reader())return raw;
 try{
  const head=await ESAccess.get('dragonsDataState/current');
  if(!head)return raw;
  const id=ESAccess.field(head,'snapshot');
  if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid statistics snapshot pointer.');
  const data=JSON.parse(await ESAccess.readPayload('dragonsDataSnapshots',id));
  if(data.schema!==1||data.quality_policy!=='accepted_live_boxscores_only'||!Array.isArray(data.leagues)||!Array.isArray(data.fixtures))throw Error('Invalid Dragons Data feed.');
  if(!reader())return raw;
  // Keep statistics separate from saved scouting data.
  const result=structuredClone(raw);
  const ids=new Set(data.leagues.map(l=>l.meta.id));
  if(data.leagues.some(l=>!l.meta?.privateOwnerFeed||!l.meta.id?.startsWith('dragons-')||!Array.isArray(l.players)))throw Error('Invalid owner-only league.');
  result.leagues=result.leagues.filter(l=>!ids.has(l.meta.id)).concat(data.leagues);
  feed=data;return result;
 }catch(e){problem='Dragons Data could not load. Existing EuroScout data is unchanged.';console.warn(problem);return raw;}
}
function finish(raw){
 if(!reader())return;
 for(const L of raw.leagues||[])if(L.meta.privateOwnerFeed)for(const p of L.players||[]){
  for(const [key,val] of Object.entries(p.dragonsTotals||{}))p['t_'+({p3m:'f3m',p3a:'f3a'}[key]||key)]=val;
 }
 const badge=document.createElement('div');badge.id='dragonsDataStatus';badge.setAttribute('role','status');badge.style.cssText='padding:8px 16px;background:#edf8ee;color:#23462b;font:13px system-ui';
 badge.textContent=feed?'Dragons Data · updated '+new Date(feed.generated).toLocaleString()+' · validated boxes only.':problem||'Dragons Data is not synced yet.';
 document.querySelector('header')?.after(badge);
}
window.EuroScoutDragons={apply,finish,fixtures(){return reader()&&feed?feed.fixtures:[];},active(){return !!(reader()&&feed);}};
})();
