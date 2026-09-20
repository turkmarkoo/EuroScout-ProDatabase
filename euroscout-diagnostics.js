/* EuroScout session diagnostics. Loaded in every build; the dialog is exposed
   only to administrators/editors from Settings. It reads metadata and key
   names, never private note values or tokens. */
(function(){
  'use strict';
  const BUILD='20260920-profile-blueprint-1';
  const text=v=>v==null?'—':String(v);
  const safe=fn=>{try{return fn();}catch{return null;}};
  const appStore=()=>safe(()=>typeof Store!=='undefined'?Store:null);
  const role=()=>safe(()=>appStore()?.role)||safe(()=>window.ESAccess?.owner?'editor':null)||null;
  const user=()=>safe(()=>appStore()?.user)||safe(()=>window.ESAccess?.user)||null;
  const isAdmin=()=>!!(safe(()=>window.ESAccess?.owner)||role()==='editor'||/^(admin|owner|superadmin)$/i.test(text(role())));
  const assetList=()=>[...document.querySelectorAll('script[src],link[href]')].map(n=>{
    const value=n.src||n.href; if(!value)return null;
    try{const u=new URL(value,location.href);return {type:n.tagName.toLowerCase(),path:u.pathname,version:u.searchParams.get('v')||'—'};}catch{return {type:n.tagName.toLowerCase(),path:value,version:'—'};}
  }).filter(Boolean);
  const nav=()=>[...document.querySelectorAll('#tabs button,[data-nav-item]')].map(b=>({label:(b.textContent||'').trim().replace(/\s+/g,' '),view:b.dataset.view||null,icon:b.dataset.navIcon||b.dataset.icon||null,hidden:!!b.hidden})).filter(x=>x.label);
  const storage=storageObj=>{const keys=[];try{for(let i=0;i<storageObj.length;i++)keys.push(storageObj.key(i));}catch{}return keys.sort();};
  async function snapshot(){
    const registrations=await safe(async()=>navigator.serviceWorker?.getRegistrations())||[];
    const cacheNames=await safe(async()=>window.caches?.keys())||[];
    const u=user();
    return {
      build:document.querySelector('meta[name="euroscout-build"]')?.content||BUILD,
      commit:document.querySelector('meta[name="euroscout-commit"]')?.content||'not embedded',
      deployedAt:document.querySelector('meta[name="euroscout-deployed-at"]')?.content||'not embedded',
      location:location.href,
      user:u?.email||u?.id||'signed out', role:role()||'unknown', member:safe(()=>appStore()?.member)??'—',
      navigation:nav(), featureFlags:safe(()=>window.ESAccess?.flags||window.ESAccess?.state?.featureFlags||appStore()?.featureFlags)||{},
      assets:assetList(), serviceWorker:{controller:navigator.serviceWorker?.controller?.scriptURL||null, registrations:registrations.map(r=>({scope:r.scope,active:r.active?.scriptURL||null,waiting:!!r.waiting,installing:!!r.installing})),caches:cacheNames},
      localStorage:storage(localStorage),sessionStorage:storage(sessionStorage)
    };
  }
  function esc(v){return text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function json(v){return esc(JSON.stringify(v,null,2));}
  async function open(){
    if(!isAdmin()){window.toast?.('Developer info is available to administrators only.');return;}
    const s=await snapshot();
    const body=`<h3>Developer info</h3><p class="hint">Session and deployment diagnostics. Values are read-only; note contents and tokens are never shown.</p><div class="es-devgrid"><div><b>Build</b><code>${esc(s.build)}</code></div><div><b>Commit</b><code>${esc(s.commit)}</code></div><div><b>Deployed</b><code>${esc(s.deployedAt)}</code></div><div><b>User</b><code>${esc(s.user)}</code></div><div><b>Role</b><code>${esc(s.role)} · member ${esc(s.member)}</code></div><div><b>Service worker</b><code>${esc(s.serviceWorker.controller||'none controlling')}</code></div></div><details open><summary>Navigation configuration</summary><pre>${json(s.navigation)}</pre></details><details><summary>Feature flags</summary><pre>${json(s.featureFlags)}</pre></details><details><summary>Loaded assets</summary><pre>${json(s.assets)}</pre></details><details><summary>Service worker and caches</summary><pre>${json(s.serviceWorker)}</pre></details><details><summary>Storage keys only</summary><pre>${json({localStorage:s.localStorage,sessionStorage:s.sessionStorage})}</pre></details><div class="es-dev-actions"><button class="btn" id="esDevRefresh">Refresh</button><button class="btn" id="esDevCopy">Copy diagnostics</button></div>`;
    window.showModal?.(body);
    const copy=()=>navigator.clipboard?.writeText(JSON.stringify(s,null,2)).then(()=>window.toast?.('Diagnostics copied'));
    document.getElementById('esDevCopy')?.addEventListener('click',copy);
    document.getElementById('esDevRefresh')?.addEventListener('click',()=>{window.hideModal?.();open();});
  }
  window.EuroScoutDiagnostics={BUILD,isAdmin,snapshot,open};
})();
