/* EuroScout — automatic scouting signals.
   Short, current badges worked out from what the database knows about a player:
   where he played in 2025/26, where he is signed for 2026/27, his age and level.
   Each rule is one entry below; a rule that cannot be decided from the data stays silent. */
(function(){
'use strict';
const SEASON_START=2026, MAX=3;
/* Leagues outside Europe. A player whose only 2025/26 lines are here has not played in Europe yet. */
const COLLEGE=new Set(['ncaam','ncaabridge','ncaa','naia','juco']);
const NCAA=new Set(['ncaam','ncaabridge','ncaa']);
const US_PRO=new Set(['nba','gleague']);
const NOT_EUROPE=new Set(['nba','gleague','cebl','bsn','cba','jbl','kbl','pba','arg','nbb','nbl','sl',...COLLEGE]);
const seasonLabel=value=>{const m=String(value||'').match(/(20\d{2})\s*[/–-]\s*((?:20)?\d{2})/);return m?m[1]+'/'+m[2].slice(-2):'';};
const playerSeason=x=>seasonLabel(x.statsScope||x.statsSeason||x.season||(typeof leagueOf==='function'?leagueOf(x)?.meta?.season:''));
const currentRosterOnly=x=>playerSeason(x)==='2026/27'||x._fibaCurrent||x._rosterOnly||/^bclq-/.test(String(x.id||''))||
 ((!x.g||Number(x.g)===0)&&seasonLabel(x.currentRosterSeason||x._officialRoster?.season)==='2026/27');
const lines=p=>{const rows=typeof personLines==='function'?personLines(p):allPlayersEvery().filter(x=>gid(x)===gid(p));return rows.filter(x=>x.league!=='sl'&&!currentRosterOnly(x));};
function next(p,m,mb){if(p._signalNextKeys)return p._signalNextKeys;try{return effective26keys(p,m||next26Get(),mb||next26bGet()).map(canonKey).filter(k=>k&&!String(k).startsWith('__'));}catch(e){return [];}}
const isEuropeClub=k=>!NOT_EUROPE.has(String(k).split('|')[0]);
/* Where a 2026/27 signing came from, read off the transfer list: most college and
   overseas players have no stat line here, but their transfer names the last club. */
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
/* "Joseph Girard III" and "Joseph Girard" are one man. */
const nameKey=s=>fold(s).replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/\s+/g,' ').trim();
let origins=null,playerOrigins=null,byName=null,transferRows=null,originData=null;
function index(){
 const o=window.EUROSCOUT_SIGNAL_ORIGINS||{};
 if(byName&&transferRows===STATE.data.transfers&&originData===o&&byName.n===(STATE.data.transfers||[]).length)return;
 transferRows=STATE.data.transfers;originData=o;origins={college:new Set(o.college||[]),usPro:new Set(o.usPro||[]),other:new Set(o.otherNonEurope||[])};playerOrigins=new Map(Object.entries(o.players||{}));
 byName=new Map();byName.n=(STATE.data.transfers||[]).length;
 (STATE.data.transfers||[]).forEach(t=>{if(t.status!=='signed'||!t.from||/^(nba|g ?league)$/i.test(t.league||'')||(seasonLabel(t.season)&&seasonLabel(t.season)!=='2026/27'))return;const k=nameKey(t.player);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(t);});
}
function origin(p){
 index();const hits=(byName.get(nameKey(p.name))||[]).filter(t=>!t.birth_year||!p.born||Number(t.birth_year)===Number(p.born));
 const types=new Set();
 for(const t of hits){const f=fold(t.from);types.add(origins.college.has(f)?'college':origins.usPro.has(f)?'usPro':origins.other.has(f)?'overseas':'other');}
 const verified=playerOrigins.get(nameKey(p.name));if(verified&&seasonLabel(verified.season)==='2025/26'&&(!verified.birth_year||!p.born||Number(verified.birth_year)===Number(p.born))){types.add(verified.type||'other');if(types.size===1&&verified.type==='college')return 'ncaa';}
 return types.size===1?[...types][0]:types.size?'conflict':'';
}
function arrival(c){
 if(!c.next.some(isEuropeClub))return '';
 const recent=c.lines.filter(x=>playerSeason(x)==='2025/26');
 // Conflicting evidence stays silent. A professional stop after NCAA is not
 // a direct NCAA arrival, even if older college statistics are available.
 if(c.origin==='conflict'||c.origin==='other'||c.origin==='overseas')return '';
 if(c.origin==='ncaa')return recent.some(x=>!NCAA.has(x.league))?'':'college';
 // The legacy college-name list also contains NAIA/JUCO schools. Require
 // a linked NCAA season rather than treating every college transfer as NCAA.
 if(c.origin==='college')return recent.length&&recent.every(x=>NCAA.has(x.league))?'college':'';
 if(c.origin==='usPro')return 'uspro';
 if(recent.length&&recent.every(x=>NCAA.has(x.league)))return 'college';
 if(recent.some(x=>US_PRO.has(x.league))&&recent.every(x=>US_PRO.has(x.league)||NCAA.has(x.league)))return 'uspro';
 return '';
}
const RULES=[
 {key:'college',label:'Rookie',title:'Arrives directly from NCAA basketball for a confirmed European club in 2026/27',
  test:(p,c)=>c.arrival==='college'},
 {key:'uspro',label:'Out of NBA/G League',title:'Arrives from the NBA or NBA G League for a confirmed European club in 2026/27',
  test:(p,c)=>c.arrival==='uspro'},
 {key:'newteam',label:'New club',title:'Signed for 2026/27 with a club he did not play for in 2025/26',
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
function context(p,m,mb){const ls=lines(p),c={lines:ls,next:next(p,m,mb),current:new Set(ls.map(x=>canonKey(x.league+'|'+x.team))),origin:origin(p),europe:ls.some(x=>!NOT_EUROPE.has(x.league))};c.arrival=arrival(c);return c;}
function of(p,m,mb){
 if(!p)return [];
 let c;try{c=context(p,m,mb);}catch(e){return [];}
 const out=[];for(const r of RULES){try{if(r.test(p,c))out.push({key:r.key,label:r.label,title:r.title});}catch(e){}if(out.length>=MAX)break;}
 return out;
}
const html=p=>of(p).map(s=>'<span class="es-signal es-signal-'+s.key+'" title="'+escAttr(s.title)+'">'+esc(s.label)+'</span>').join('');
// Signals within this group use OR; other player filters narrow the result.
// Assignment maps are shared across a filtering pass to keep it responsive.
function filter(pool,keys){const selected=new Set(keys||[]);if(!selected.size)return pool;const rules=RULES.filter(r=>selected.has(r.key)),m=next26Get(),mb=next26bGet();return pool.filter(p=>{try{const c=context(p,m,mb);return rules.some(r=>r.test(p,c));}catch(e){return false;}});}
window.ESSignals={of,html,RULES,filter,FILTERS:RULES.filter(r=>['college','uspro','newteam'].includes(r.key))};

/* Player profile: the same badges, beside the other pills. */
const base=renderProfile;
renderProfile=function(){base();try{
 const p=player(CURRENT);if(!p)return;
 let host=document.querySelector('#drawer .ph-pills')||document.querySelector('#drawer .es-dossier-signals');
 const identity=document.querySelector('#drawer .es-dossier-identity');
 if(!host&&identity){host=document.createElement('div');host.className='es-dossier-signals';identity.append(host);}
 if(host&&!host.querySelector('.es-signal'))host.insertAdjacentHTML('beforeend',html(p));
 // The dossier replaces the original hero, including its board button.
 const actions=document.querySelector('#drawer .es-profile-top-actions');
 if(actions&&!actions.querySelector('[data-signal-board]')){const board=document.createElement('button');board.type='button';board.className='btn primary sm';board.dataset.signalBoard='';board.textContent='＋ Board';board.onclick=()=>addToScoutBoard(p.id);actions.append(board);}
 }catch(e){console.warn('Signals unavailable',e);}};
})();
