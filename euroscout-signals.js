/* EuroScout — automatic scouting signals.
   Short, current badges worked out from what the database knows about a player:
   where he played in 2025/26, where he is signed for 2026/27, his age and level.
   Each rule is one entry below; a rule that cannot be decided from the data stays silent. */
(function(){
'use strict';
const SEASON_START=2026, MAX=3;
/* Leagues outside Europe. A player whose only 2025/26 lines are here has not played in Europe yet. */
const COLLEGE=new Set(['ncaam','ncaa','naia','juco']);
const NOT_EUROPE=new Set(['nba','gleague','cebl','bsn','cba','jbl','kbl','pba','arg','nbb','nbl','sl',...COLLEGE]);
const lines=p=>{const g=gid(p);return allPlayersEvery().filter(x=>gid(x)===g&&x.league!=='sl');};
function next(p){try{return effective26keys(p,next26Get(),next26bGet()).map(canonKey).filter(k=>k&&!String(k).startsWith('__'));}catch(e){return [];}}
const isEuropeClub=k=>!NOT_EUROPE.has(String(k).split('|')[0]);
const RULES=[
 {key:'college',label:'Coming out of college',title:'Played college basketball in 2025/26 and is signed in Europe for 2026/27',
  test:(p,c)=>c.lines.length>0&&c.lines.every(x=>COLLEGE.has(x.league))&&c.next.some(isEuropeClub)},
 {key:'rookie',label:'Rookie in Europe',title:'No European club in 2025/26; first European season in 2026/27',
  test:(p,c)=>c.lines.length>0&&c.lines.every(x=>NOT_EUROPE.has(x.league))&&!c.lines.every(x=>COLLEGE.has(x.league))&&c.next.some(isEuropeClub)},
 {key:'newteam',label:'New team',title:'Signed for 2026/27 with a club he did not play for in 2025/26',
  test:(p,c)=>c.next.length>0&&c.lines.some(x=>!NOT_EUROPE.has(x.league))&&!c.next.some(k=>c.current.has(k))},
 {key:'breakout',label:'Breakout season',title:'Production jumped compared with the previous season',
  /* Needs a previous-season line (p.prev) — the database holds 2025/26 only, so this stays silent until earlier seasons are imported. */
  test:p=>!!(p.prev&&p.prev.pir!=null&&p.pir!=null&&p.prev.mpg>=8&&p.pir-p.prev.pir>=5&&p.pir>=12)},
 {key:'draft',label:'Draft prospect',title:'Draft-age player already producing at a high level',
  test:(p,c)=>{const born=Number(p.born)||0;if(born<SEASON_START-22||born>SEASON_START-17)return false;const lv=levelBand(p);return !!(lv&&lv.i>=2)||c.lines.some(x=>COLLEGE.has(x.league)&&(x.ppg||0)>=15);}},
 {key:'young',label:'U22 with a real role',title:'21 or younger and playing 20+ minutes a game',
  test:(p,c)=>{const born=Number(p.born)||0;return born>=SEASON_START-21&&c.lines.some(x=>!NOT_EUROPE.has(x.league)&&(x.mpg||0)>=20&&(x.g||0)>=8);}}
 /* No "unsigned" badge: a missing 2026/27 club usually means the roster has not been entered yet, not that he is a free agent. */
];
function of(p){
 if(!p)return [];
 let c;try{const ls=lines(p);c={lines:ls,next:next(p),current:new Set(ls.map(x=>canonKey(x.league+'|'+x.team))),status:careerStatus(p)};}catch(e){return [];}
 const out=[];for(const r of RULES){try{if(r.test(p,c))out.push({key:r.key,label:r.label,title:r.title});}catch(e){}if(out.length>=MAX)break;}
 return out;
}
const html=p=>of(p).map(s=>'<span class="es-signal es-signal-'+s.key+'" title="'+escAttr(s.title)+'">'+esc(s.label)+'</span>').join('');
window.ESSignals={of,html,RULES};

/* Player profile: the same badges, beside the other pills. */
const base=renderProfile;
renderProfile=function(){base();try{const p=player(CURRENT),host=document.querySelector('#drawer .ph-pills')||document.querySelector('.ph-pills');if(!p||!host||host.querySelector('.es-signal'))return;host.insertAdjacentHTML('beforeend',html(p));}catch(e){console.warn('Signals unavailable',e);}};
})();
