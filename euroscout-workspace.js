/* EuroScout — the personal scout workspace.
   One place decides who sees the scouting tools (sessions, scouting history, team
   log, keyboard shortcuts) and how people are named on screen.
   - Tools: the administrator, plus anyone DragonsHub identifies with a role in
     WORKSPACE_ROLES. Coaches and directors see the outputs — notes, reports,
     shortlists — not the working tools.
   - Names: a display name is shown everywhere; an email address never is. */
(function(){
'use strict';
const WORKSPACE_ROLES=['admin','scout'];
const NAMES='euroscout:names:v1', HUBS=['https://dragonshub.mtscouting.com'];
let hubUser=null;
const readNames=()=>{try{return JSON.parse(localStorage.getItem(NAMES)||'{}')||{};}catch(e){return {};}};
function myEmail(){try{if(Store.user&&Store.user.email)return Store.user.email;}catch(e){}return window.ESAccess?.user?.email||'';}
/* "marko.turk@club.si" → "Marko Turk". Only the part before the @ is ever used. */
function fromEmail(e){const local=String(e||'').split('@')[0].replace(/[._-]+/g,' ').replace(/\d+/g,' ').trim();return local?local.split(/\s+/).map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):'Scout';}
function nameOf(v){
 v=String(v||'').trim();if(!v||v==='Local editor')return 'Scout';
 if(!v.includes('@'))return v;
 const known=readNames()[v.toLowerCase()];if(known)return known;
 if(hubUser&&hubUser.email&&hubUser.email.toLowerCase()===v.toLowerCase()&&hubUser.name)return hubUser.name;
 return fromEmail(v);
}
function learn(email,name){
 email=String(email||'').toLowerCase();name=String(name||'').trim();if(!email||!name||name.includes('@'))return;
 const all=readNames();if(all[email]===name)return;all[email]=name;localStorage.setItem(NAMES,JSON.stringify(all));
 try{if(Store.canEdit())Promise.resolve(Store.pushAppKey(NAMES)).catch(()=>{});}catch(e){}
}
function visible(){
 if(!window.ESAccess)return true;                               // local mode: your own browser
 if(ESAccess.internal&&ESAccess.owner)return true;
 return !!(hubUser&&WORKSPACE_ROLES.includes(hubUser.role));
}
function paintAccount(){const b=document.getElementById('authBtn');if(!b||!window.ESAccess?.internal)return;const n=nameOf(myEmail());b.title=n;b.setAttribute('aria-label','Account: '+n);const label=b.querySelector('.es-account-label');if(label)label.textContent=n;b.onclick=()=>toast('Signed in through DragonsHub · '+n);}
/* DragonsHub introduces the person it has signed in: name and role. */
window.addEventListener('message',e=>{const d=e.data;if(!HUBS.includes(e.origin)||e.source!==parent||!d||d.source!=='dragons-hub'||!d.user)return;
 hubUser={email:String(d.user.email||''),name:String(d.user.name||'').slice(0,80),role:String(d.user.role||'')};learn(hubUser.email,hubUser.name);paintAccount();window.dispatchEvent(new Event('euroscout-workspace'));});
window.addEventListener('euroscout-authenticated',()=>{paintAccount();window.dispatchEvent(new Event('euroscout-workspace'));});
(function wait(n){if(document.getElementById('authBtn')&&(typeof STATE!=='undefined'&&STATE.data))paintAccount();else if(n<120)setTimeout(()=>wait(n+1),500);})(0);
window.ESWorkspace={visible,nameOf,learn,me:()=>nameOf(myEmail()),roles:WORKSPACE_ROLES};
})();
