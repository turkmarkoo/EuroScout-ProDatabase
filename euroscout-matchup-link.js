/* EuroScout — ways straight into the Scouting matchup.
   1. A link:     …/#matchup                      opens the page
                  …/#matchup=<teamA>~<teamB>      with both teams chosen
                  …/#matchup=<teamA>~<teamB>~2026-09-17   and the game date
      A team is a club key (aba|COL) or simply its name (Cedevita Olimpija).
   2. A message from DragonsHub, for a frame that is already open:
        { type:'hub:goto', view:'matchup', a, b, date }
   3. A running session: opening EuroScout lands back in the game.
   4. Ctrl+M, for the administrator only. */
(function(){
'use strict';
const HUB='https://dragonshub.mtscouting.com';
const fold=s=>String(s||'').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const WEAK=new Set(['bc','bk','kk','fc','cb','sk','as','basket','basketball','club','the','de']);
const toks=s=>fold(s).split(' ').filter(w=>w.length>1&&!WEAK.has(w));

function findClub(x){
 x=String(x||'').trim();if(!x)return '';
 if(x.includes('|')){const c=clubByKey(canonKey(x));if(c)return c.key;}
 const want=fold(x),clubs=allClubs();
 const names=c=>[c.name,...(c.searchAliases||[]),...(c.teams||[]).map(t=>t.name)];
 const exact=clubs.find(c=>names(c).some(n=>fold(n)===want));if(exact)return exact.key;
 /* Otherwise every word has to be there ("Krka" finds "KK Krka Novo Mesto"); the shortest such name wins. */
 const words=toks(x);if(!words.length)return '';
 const hits=clubs.filter(c=>names(c).some(n=>{const t=new Set(toks(n));return words.every(w=>t.has(w));})).sort((a,b)=>a.name.length-b.name.length);
 return hits.length?hits[0].key:'';
}
function open(target){
 target=target||{};const s=STATE.scouting,missing=[];
 [['a',target.a],['b',target.b]].forEach(([slot,x])=>{if(!x)return;const k=findClub(x);if(k)s[slot]=k;else missing.push(x);});
 if(/^\d{4}-\d{2}-\d{2}$/.test(target.date||'')){s.gameDate=target.date;}
 try{if(typeof DRAWER_OPEN!=='undefined'&&DRAWER_OPEN)closeDrawer(true);}catch(e){}
 window.ESSessions?.closeModal?.();
 goView('scouting');
 if(missing.length)toast('Could not find '+missing.join(' or ')+' in the database — pick the team by hand.');
}
function parse(hash){const m=/^#matchup(?:=(.*))?$/.exec(hash||'');if(!m)return null;const parts=(m[1]||'').split('~').map(x=>{try{return decodeURIComponent(x);}catch(e){return x;}});return {a:parts[0]||'',b:parts[1]||'',date:parts[2]||''};}
function fromHash(){const t=parse(location.hash);if(!t)return false;open(t);try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}return true;}
function link(a,b,date){return location.origin+location.pathname+'#matchup'+(a||b?'='+[a,b,date].filter((x,i)=>x||i<2).map(x=>encodeURIComponent(x||'')).join('~'):'');}

const initial=location.hash;
(function wait(n){
 if(typeof STATE!=='undefined'&&STATE.data&&document.querySelector('#app')?.children.length&&typeof allClubs==='function'){
  if(parse(initial)){if(!fromHash())open(parse(initial));}
  /* Nothing asked for in the link, and a game is in progress: go back to it. */
  else if(!initial&&window.ESSessions?.active()&&STATE.view==='dashboard'){const a=ESSessions.active();open({a:a.a.key,b:a.b.key});}
 }else if(n<240)setTimeout(()=>wait(n+1),250);
})(0);
window.addEventListener('hashchange',()=>{if(typeof STATE!=='undefined'&&STATE.data)fromHash();});
window.addEventListener('message',e=>{if(e.origin!==HUB||e.source!==parent||!e.data||e.data.type!=='hub:goto'||e.data.view!=='matchup')return;if(typeof STATE==='undefined'||!STATE.data)return;open({a:e.data.a,b:e.data.b,date:e.data.date});});

/* Inside DragonsHub: say when the app is ready, which two teams are up and whether
   a session is running, so the hub's dashboard card and its "open without
   reloading" path have something to go on. Only names leave this page. */
if(parent!==window){let sent='';setInterval(()=>{if(typeof STATE==='undefined'||!STATE.data||!document.querySelector('#app')?.children.length)return;
 const name=k=>{const c=k&&clubByKey(canonKey(k));return c?{name:c.name}:null;},a=window.ESSessions?.active();
 const msg={type:'euroscout:matchup',ready:true,teams:STATE.scouting.a&&STATE.scouting.b?{a:name(STATE.scouting.a),b:name(STATE.scouting.b)}:null,
  session:a?{a:{name:a.a.name},b:{name:a.b.name},competition:a.competition?.name||'',gameDate:a.gameDate||''}:null};
 const sig=JSON.stringify(msg);if(sig===sent)return;sent=sig;try{parent.postMessage(msg,HUB);}catch(e){}},2000);}

const isAdmin=()=>window.ESAccess?!!(ESAccess.internal&&ESAccess.owner):true;
window.MTShortcuts?.register({id:'app.matchupAdmin',label:'Scouting matchup from anywhere (administrator)',keys:'Ctrl+M',group:'Everywhere in EuroScout',scope:'global',allowInInput:true,when:isAdmin,run:()=>open({})});
window.ESMatchupLink={open,link,findClub};
})();
