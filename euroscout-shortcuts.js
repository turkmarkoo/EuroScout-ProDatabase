/* EuroScout — wires the shared shortcut manager into this app:
   per-account bindings, a cloud copy for editors, the app-wide shortcuts,
   and a way in from Settings. */
(function(){
'use strict';
const K=window.MTShortcuts;if(!K)return;
const KEY='euroscout:shortcuts:v1';
const account=()=>{try{if(Store.user&&Store.user.email)return Store.user.email.toLowerCase();}catch(e){}return (window.ESAccess?.user?.email||'').toLowerCase();};
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return {};}};
K.configure({app:'euroscout',account,accountLabel:()=>window.ESWorkspace?ESWorkspace.me():'',
 load:()=>read()[account()||'local']||null,
 /* Only an editor can write the shared app data; everyone else keeps their bindings on the device. */
 save:map=>{let ok=false;try{ok=Store.canEdit();}catch(e){}if(!ok)return;const all=read();all[account()||'local']=map;localStorage.setItem(KEY,JSON.stringify(all));Promise.resolve(Store.pushAppKey(KEY)).catch(()=>{});}});
window.addEventListener('euroscout-authenticated',()=>K.reload());

const free=()=>!document.querySelector('#modal,#sxMask,#mtscMask,#tpOverlay')&&(!window.ESWorkspace||ESWorkspace.visible());
const go=v=>()=>{if(typeof DRAWER_OPEN!=='undefined'&&DRAWER_OPEN&&typeof closeDrawer==='function')closeDrawer();goView(v);};
const G='Everywhere in EuroScout',add=(id,label,keys,run,opt)=>K.register({id:'app.'+id,label,keys,group:G,scope:'global',when:free,run,...(opt||{})});
add('help','Show keyboard shortcuts','?',()=>K.openHelp());
add('search','Search any player','Ctrl+K',()=>{const el=document.querySelector('#globalSearch');el?.focus();el?.select?.();},{allowInInput:true});
add('dashboard','Go to Dashboard','Shift+D',go('dashboard'));
add('players','Go to Player database','Shift+P',go('scout'));
add('watchlist','Go to Watchlist','Shift+W',go('watchlist'));
add('teams','Go to Teams','Shift+T',go('teams'));
add('matchup','Go to Scouting matchup','Shift+M',go('scouting'));
add('log','Go to Scouting log','Shift+L',go('scoutlog'));

if(typeof esSettings==='function'){const base=esSettings;esSettings=function(){base();const box=document.querySelector('#esSettingsActions');if(box&&typeof esButton==='function'&&(!window.ESWorkspace||ESWorkspace.visible()))box.appendChild(esButton('Keyboard shortcuts',()=>{hideModal();K.openSettings();}));};
 const btn=document.querySelector('#esSettings');if(btn)btn.onclick=()=>esSettings();}
})();
