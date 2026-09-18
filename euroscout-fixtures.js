/* EuroScout — 2026/27 fixtures.
   Two sources, one list:
   1. EuroLeague and EuroCup come straight from the official EuroLeague API. It is
      the only league API that allows a browser to read it, so the app fetches it
      itself and the schedule (dates, tip-off changes, scores) stays current.
   2. Every other league is read from data/fixtures-2627.js, in the same
      pipe format the scrapers already write for *_games.txt:
        id|round|date|HOME|homeScore|AWAY|awayScore|time(optional)|venue(optional)
      Empty scores mean the game has not been played. */
(function(){
'use strict';
const SEASON=2026, CACHE='euroscout:fixtures:v1', TTL=6*3600*1000;
const LIVE=[{id:'euroleague',code:'E',name:'EuroLeague'},{id:'eurocup',code:'U',name:'EuroCup'}];
let games=[],loadedAt=0,pending=null,state='idle',problems=[];
const fold=s=>String(s||'').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const WEAK=new Set(['bc','bk','kk','fc','cb','sk','as','basket','basketball','basket-ball','club','the','de','city']);
const toks=s=>fold(s).split(' ').filter(w=>w.length>1&&!WEAK.has(w));
function overlap(a,b){const B=new Set(toks(b));return toks(a).filter(w=>B.has(w)).length;}

/* ── who is who: an API team → a club in the database ─── */
function resolver(comp,teams){
 const out=new Map(),entries=(((STATE.data||{}).season2627||{}).comps||{})[comp]?.teams||[],free=new Set(entries.map((_,i)=>i));
 /* A code alone proves nothing: BUR was Burgos one season and Bursa the next. The name has to agree as well. */
 teams.forEach(t=>{const i=entries.findIndex((e,n)=>free.has(n)&&e.key===comp+'|'+t.code&&agrees(t,e.name));if(i>=0){out.set(t.code,entries[i].key);free.delete(i);}});
 /* Best name match first, each entry used once, so "Roma Basketball" cannot take "Maxima Roma". */
 const pairs=[];teams.filter(t=>!out.has(t.code)).forEach(t=>free.forEach(i=>{const s=overlap(t.name,entries[i].name);if(s)pairs.push({t,i,s});}));
 pairs.sort((a,b)=>b.s-a.s).forEach(p=>{if(out.has(p.t.code)||!free.has(p.i))return;out.set(p.t.code,entries[p.i].key);free.delete(p.i);});
 teams.filter(t=>!out.has(t.code)).forEach(t=>{
  const known=typeof dbTeamByKey==='function'?dbTeamByKey(comp+'|'+t.code):null;if(known&&agrees(t,known.name)){out.set(t.code,comp+'|'+t.code);return;}
  let best=null;allClubs().forEach(c=>{const s=overlap(t.name,c.name);if(s>=2&&(!best||s>best.s||(s===best.s&&c.name.length<best.c.name.length)))best={c,s};});
  out.set(t.code,best?best.c.key:'');});
 out.forEach((k,code)=>out.set(code,k?canonKey(k):''));
 return out;
}
/* Codes from the fixtures file are the database's own, so they are taken as given; an API's codes need the name to agree. */
function agrees(t,name){return t.name===t.code||overlap(t.name,name)>0;}
function build(comp,name,rows){
 const teams=new Map();rows.forEach(r=>{teams.set(r.h,{code:r.h,name:r.hn||r.h});teams.set(r.a,{code:r.a,name:r.an||r.a});});
 const keyOf=resolver(comp,[...teams.values()]);
 const label=(code,fallback)=>{const k=keyOf.get(code);const c=k&&typeof clubByKey==='function'?clubByKey(k):null;return c?c.name:fallback;};
 [...teams.values()].filter(t=>!keyOf.get(t.code)).forEach(t=>problems.push(name+': '+t.name+' ('+t.code+') is not matched to a club'));
 return rows.map(r=>({comp,compName:name,round:r.round,phase:r.phase||'',group:r.group||'',date:r.date,time:r.time||'',utc:r.utc||'',
  home:{key:keyOf.get(r.h)||'',code:r.h,name:label(r.h,r.hn||r.h)},away:{key:keyOf.get(r.a)||'',code:r.a,name:label(r.a,r.an||r.a)},
  hs:r.hs,as:r.as,played:r.hs!==''&&r.hs!=null&&r.as!==''&&r.as!=null,venue:r.venue||''}));
}

async function fetchLive(src){
 const r=await fetch('https://api-live.euroleague.net/v2/competitions/'+src.code+'/seasons/'+src.code+SEASON+'/games',{cache:'no-store'});
 if(!r.ok)throw Error(src.name+' schedule returned '+r.status);
 const j=await r.json();
 return (j.data||[]).filter(g=>g.local?.club&&g.road?.club&&g.date).map(g=>({id:g.identifier||g.gameCode,round:g.round,phase:g.phaseType?.name||'',group:g.group?.rawName&&/^[A-Z]$/.test(g.group.rawName.trim())?g.group.rawName.trim():'',
  date:String(g.date).slice(0,10),time:String(g.date).slice(11,16),utc:g.utcDate||'',h:g.local.club.code,hn:g.local.club.name,a:g.road.club.code,an:g.road.club.name,
  hs:g.played?g.local.score:'',as:g.played?g.road.score:'',venue:g.venue?.name||''}));
}
function fromFile(){
 const raw=window.EUROSCOUT_FIXTURES_2627;if(!raw||!raw.comps)return [];
 return Object.entries(raw.comps).flatMap(([comp,c])=>build(comp,c.name||comp,String(c.games||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&l[0]!=='#').map(l=>{const f=l.split('|');return {id:f[0],round:f[1]||'',date:f[2],h:f[3],hs:f[4]||'',a:f[5],as:f[6]||'',time:f[7]||'',venue:f[8]||'',hn:(c.teams||{})[f[3]],an:(c.teams||{})[f[5]]};}).filter(r=>r.date&&r.h&&r.a)));
}
function restore(){try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&c.season===SEASON&&Array.isArray(c.rows))return c;}catch(e){}return null;}
function assemble(rowsByComp){problems=[];games=LIVE.flatMap(s=>build(s.id,s.name,rowsByComp[s.id]||[])).concat(fromFile()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));}

function refresh(force){
 if(pending)return pending;
 const cached=restore();
 if(cached&&!games.length){assemble(cached.rows.reduce((m,[id,rows])=>(m[id]=rows,m),{}));loadedAt=cached.at;state='cached';}
 if(!force&&cached&&Date.now()-cached.at<TTL)return Promise.resolve(games);
 state='loading';
 pending=Promise.allSettled(LIVE.map(fetchLive)).then(res=>{
  const by={},old=cached?cached.rows.reduce((m,[id,rows])=>(m[id]=rows,m),{}):{};let failed=[];
  LIVE.forEach((s,i)=>{if(res[i].status==='fulfilled'&&res[i].value.length)by[s.id]=res[i].value;else{by[s.id]=old[s.id]||[];failed.push(s.name);}});
  assemble(by);
  if(failed.length<LIVE.length){loadedAt=Date.now();try{localStorage.setItem(CACHE,JSON.stringify({season:SEASON,at:loadedAt,rows:Object.entries(by)}));}catch(e){}}
  state=failed.length?'partial':'ready';if(failed.length)problems.unshift('Could not refresh: '+failed.join(', ')+' — showing the last saved schedule.');
  pending=null;window.dispatchEvent(new Event('euroscout-fixtures'));return games;
 });
 return pending;
}

const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const api=window.ESFixtures={
 refresh,all:()=>games,state:()=>state,problems:()=>problems.slice(),loadedAt:()=>loadedAt,
 competitions:()=>{const m=new Map();games.forEach(g=>{const c=m.get(g.comp)||{id:g.comp,name:g.compName,games:0,played:0};c.games++;if(g.played)c.played++;m.set(g.comp,c);});return [...m.values()];},
 between(ka,kb){ka=canonKey(ka||'');kb=canonKey(kb||'');if(!ka||!kb)return [];return games.filter(g=>(g.home.key===ka&&g.away.key===kb)||(g.home.key===kb&&g.away.key===ka));},
 forTeam(k){k=canonKey(k||'');return k?games.filter(g=>g.home.key===k||g.away.key===k):[];},
 recent(days,comp){const to=todayStr(),from=new Date(Date.now()-days*86400000).toISOString().slice(0,10);return games.filter(g=>g.date>=from&&g.date<=to&&(!comp||g.comp===comp)).reverse();},
 upcoming(days,comp){const from=todayStr(),to=new Date(Date.now()+days*86400000).toISOString().slice(0,10);return games.filter(g=>g.date>=from&&g.date<=to&&(!comp||g.comp===comp));}
};
/* Wait for the database before matching teams, then load quietly in the background. */
(function wait(n){if(typeof STATE!=='undefined'&&STATE.data&&typeof allClubs==='function'){try{allClubs();refresh(false);}catch(e){console.warn('Fixtures unavailable',e);}}else if(n<240)setTimeout(()=>wait(n+1),500);})(0);
})();
