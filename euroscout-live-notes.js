/* EuroScout — Scouting matchup (compact layout, session-aware, keyboard-first).
   Narrow roster panels, wide notebook, compact player header, category bar that
   never scrolls away, similar notes on demand. */
(function(){
'use strict';
function sizeWorkspace(){const root=document.documentElement,viewport=window.visualViewport?.height||window.innerHeight,app=document.querySelector('main#app'),top=Math.max(0,app?.getBoundingClientRect().top||document.querySelector('body > header')?.getBoundingClientRect().bottom||76);root.style.setProperty('--matchup-viewport',viewport+'px');root.style.setProperty('--matchup-workspace',Math.max(240,viewport-top)+'px');}
function scrollMatchupArea(e){const area=e.target?.closest?.('.rosterList,#liveBullets,#liveRelated');if(!area||!area.closest('.liveScouting'))return;const max=area.scrollHeight-area.clientHeight;if(max<=0)return;const unit=e.deltaMode===1?32:e.deltaMode===2?area.clientHeight:1,next=Math.max(0,Math.min(max,area.scrollTop+e.deltaY*unit));if(next===area.scrollTop)return;area.scrollTop=next;e.preventDefault();e.stopPropagation();}
sizeWorkspace();window.addEventListener('resize',sizeWorkspace);window.visualViewport?.addEventListener('resize',sizeWorkspace);const appHeader=document.querySelector('body > header');if(appHeader)new ResizeObserver(sizeWorkspace).observe(appHeader);

const cats=[['nAth','Athleticism'],['nOff','Offense'],['nDef','Defense'],['nIntel','Intel'],['nProj','Projection']];
const SX=window.ESSessions;
let selected='',chosen='',category='nOff',busyStatus='',showSimilar=false,timer=null;
const filters={a:{q:'',pos:''},b:{q:'',pos:''}};
let clubIndex=null,rosters=new Map();

const fold=t=>String(t||'').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const author=()=>SX?SX.me():(window.ESAccess?.user?.email||'');
function todayStr(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function numberKey(p){return '2026/27|'+p._liveClub;}
function jerseyRecords(p){return typeof reportRecords==='function'?reportRecords(p):[recOf(p)];}
function jerseyNumbers(p){const out={};for(const r of jerseyRecords(p))for(const [key,value] of Object.entries(r?.jerseyNumbers||{}))if(out[key]==null)out[key]=value;return out;}
function storedShirt(p){const numbers=jerseyNumbers(p),exact=numbers[numberKey(p)];if(exact!=null)return String(exact);const target=canonKey(p._liveClub),prefix='2026/27|';for(const [key,value] of Object.entries(numbers))if(key.startsWith(prefix)&&canonKey(key.slice(prefix.length))===target&&value!=null)return String(value);return null;}
function officialRosterRow(p){return window.EuroScoutEuroCup?.current?.(p)||window.EuroScoutOfficialRosters?.current?.(p)||null;}
function shirt(p){const v=storedShirt(p);if(v!=null)return v;const official=officialRosterRow(p);if(official?.number!=null)return String(official.number);const r=window.EuroScoutExpansion?.record(p);return r&&canonKey('directory|'+r.club)===p._liveClub&&r.jersey!=null?String(r.jersey):'';}
function jerseyOrder(a,b){const rank=p=>{const n=shirt(p);return n==='00'?-2:n==='0'?-1:/^\d{1,2}$/.test(n)?Number(n):1000};return rank(a)-rank(b)||a.name.localeCompare(b.name);}
function resetRosters(){clubIndex=null;rosters.clear();}
let rosterDirectoriesPending=false,rosterDirectoriesFailed=false,rosterRefreshTimer=null,matchupPointerDown=false,matchupInteractionUntil=0;
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.liveScouting')){matchupPointerDown=true;matchupInteractionUntil=performance.now()+300;}},true);
window.addEventListener('blur',()=>{matchupPointerDown=false;});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>{if(matchupPointerDown){matchupPointerDown=false;matchupInteractionUntil=performance.now()+200;}},true);
function scheduleRosterRefresh(){
 if(rosterRefreshTimer!==null)return;
 rosterRefreshTimer=setTimeout(()=>{rosterRefreshTimer=null;
  const editing=document.activeElement?.closest?.('.liveScouting')&&document.activeElement.matches('input,select,textarea,[contenteditable=true]');
  if(editing||openingSession||matchupPointerDown||performance.now()<matchupInteractionUntil||document.querySelector('#teamSelectionWorkspace,#modal.open,#sxMask,#qsMask')){scheduleRosterRefresh();return;}
  resetRosters();if(STATE.view==='scouting')fullRedraw();
 },200);
}
/* Optional catalogue imports must not compete with active scouting input. */
window.ESMatchupBusy=()=>STATE.view==='scouting'&&!!(openingSession||matchupPointerDown||performance.now()<matchupInteractionUntil||document.activeElement?.closest?.('.liveScouting')&&document.activeElement.matches('input,select,textarea,[contenteditable=true]')||document.querySelector('#teamSelectionWorkspace,#sxMask,#qsMask'));
function matchupDirectoriesReady(){return !!(window.EUROSCOUT_EUROCUP_ROSTERS&&window.EUROSCOUT_OFFICIAL_ROSTERS);}
function ensureMatchupDirectories(){
 if(matchupDirectoriesReady()||rosterDirectoriesPending||typeof window.loadMatchupRosterScripts!=="function")return;
 rosterDirectoriesPending=true;rosterDirectoriesFailed=false;
 window.loadMatchupRosterScripts().then(()=>{rosterDirectoriesPending=false;scheduleRosterRefresh();}).catch(()=>{rosterDirectoriesPending=false;rosterDirectoriesFailed=true;scheduleRosterRefresh();});
}
function officialDirectories(){return [window.EUROSCOUT_EUROCUP_ROSTERS,window.EUROSCOUT_OFFICIAL_ROSTERS].filter(Boolean);}
window.addEventListener?.("euroscout:rosters-ready",scheduleRosterRefresh);
function rosterNameTokens(p){return fold(p?.name||'').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean).filter(token=>!['jr','sr','ii','iii','iv'].includes(token));}
function rosterBaseName(p){return rosterNameTokens(p).join(' ');}
function rosterBirth(p){return String(p?.born||p?.birthYear||String(p?.birthdate||'').match(/(?:19|20)\d{2}/)?.[0]||'');}
function rosterNumber(p){const n=p?.jersey??p?.number??officialRosterRow(p)?.number;return n==null?'':String(n).trim();}
function rosterIdentityIds(p){const row=officialRosterRow(p),raw=[p?.id,gid(p),...(p?._grp||[]).map(x=>x.id),...(row?.ids||[])].filter(Boolean),ids=new Set(raw);for(const id of raw){const match=String(id).match(/^(?:fiba-(?:fec|bcl)|bclq(?:-stat)?)-(\d+)$/);if(match)ids.add('fiba-person:'+match[1]);}return ids;}
function compatibleRosterName(a,b){const at=rosterNameTokens(a),bt=rosterNameTokens(b);if(at.length<2||bt.length<2)return false;if(at.join(' ')===bt.join(' '))return true;if(at[0]!==bt[0]||at.at(-1)!==bt.at(-1))return false;const subset=(short,long)=>{let i=0;for(const token of long)if(token===short[i])i++;return i===short.length;};return subset(at,bt)||subset(bt,at);}
function sameRosterPerson(a,b){const ai=rosterIdentityIds(a),bi=rosterIdentityIds(b);if([...ai].some(id=>bi.has(id)))return true;if(!compatibleRosterName(a,b))return false;const ab=rosterBirth(a),bb=rosterBirth(b);if(ab&&bb)return ab===bb;const exact=rosterBaseName(a)===rosterBaseName(b);if(exact&&!ab&&!bb)return true;const aj=rosterNumber(a),bj=rosterNumber(b);return !!(aj&&bj&&aj===bj);}
function addClubPlayer(index,seen,key,p){key=canonKey(key);if(!key||!p)return;const id=gid(p)||p.id;if(!id)return;if(!seen.has(key))seen.set(key,{ids:new Set(),players:[]});const bucket=seen.get(key);if(bucket.ids.has(id))return;if(bucket.players.some(x=>sameRosterPerson(x,p))){bucket.ids.add(id);return;}bucket.ids.add(id);bucket.players.push(p);if(!index.has(key))index.set(key,[]);index.get(key).push(p);}
function buildClubIndex(){
 const index=new Map(),seen=new Map(),m=next26Get(),mb=next26bGet(),pool=assignPool(),directories=officialDirectories();
 const catalogue=typeof allPlayersEvery==='function'?allPlayersEvery():[],byId=new Map(),sources=[...pool,...catalogue,...directories.flatMap(d=>d.players||[])];
 for(const p of catalogue)if(!byId.has(p.id))byId.set(p.id,p);
 for(const p of sources)for(const id of [p.id,gid(p),...(p._grp||[]).map(x=>x.id)])if(id&&!byId.has(id))byId.set(id,p);
 const clubKeysByName=new Map(),rememberClubName=(name,keys)=>{const n=fold(name);if(!n)return;if(!clubKeysByName.has(n))clubKeysByName.set(n,new Set());for(const key of keys)if(key)clubKeysByName.get(n).add(key);};
 for(const club of allClubs()){const keys=new Set([club.key,...(club.teams||[]).map(t=>t.key)].filter(Boolean));rememberClubName(club.name,keys);for(const team of club.teams||[]){rememberClubName(team.name,keys);for(const name of team.searchAliases||[])rememberClubName(name,keys);}}
 const officialRows=[],officialKeys=new Map(),mark=(id,key)=>{if(!id||!key)return;if(!officialKeys.has(id))officialKeys.set(id,new Set());officialKeys.get(id).add(key);};
 for(const directory of directories){
  const teams=new Map();for(const team of directory.teams||[]){const base=team.currentKey||team.key,keys=new Set([base,canonKey(base),team.key,team.currentKey].filter(Boolean));for(const name of [team.name,...(team.aliases||[])])for(const key of clubKeysByName.get(fold(name))||[])keys.add(key);for(const id of [team.id,team.code])if(id)teams.set(id,keys);}
  for(const row of directory.roster||[]){const keys=teams.get(row.teamId||row.teamCode);if(!keys?.size)continue;const ids=row.ids||[row.id],p=ids.map(id=>byId.get(id)).find(Boolean);if(!p)continue;officialRows.push({keys,p});for(const id of [...ids,p.id,gid(p),...(p._grp||[]).map(x=>x.id)])for(const key of keys)mark(id,key);}
 }
 for(const p of pool){const registered=new Set();for(const id of [p.id,gid(p),...(p._grp||[]).map(x=>x.id)])for(const key of officialKeys.get(id)||[])registered.add(key);for(const key of registered.size?registered:effective26keys(p,m,mb))addClubPlayer(index,seen,key,p);}
 for(const {keys,p} of officialRows)for(const key of keys)addClubPlayer(index,seen,key,p);
 return index;
}
function liveRoster(key){if(!key)return null;key=canonKey(key);if(rosters.has(key))return rosters.get(key);const club=allClubs().find(c=>c.key===key)||window.ESTeamSelection?.teamForKey?.(key);if(!club)return null;
 if(!clubIndex)clubIndex=buildClubIndex();
 const r={t:{name:club.name},club,players:(clubIndex.get(key)||[]).map(p=>({...p,_liveClub:key})).sort(jerseyOrder)};rosters.set(key,r);return r;}
function rosterPlayers(){return ['a','b'].flatMap(k=>liveRoster(STATE.scouting[k])?.players||[])}
/* G · W · B — the three groups the roster filter offers. */
function posGroup(p){const t=String(p.role||p.pos||'');if(/big|cent|^c$|^pf|power|^c\//i.test(t))return 'B';if(/guard|^pg|^sg|^g$|bek/i.test(t))return 'G';if(/forw|wing|^sf|^f$|kril/i.test(t))return 'W';return '';}
function posShort(p){const g=posGroup(p);return g==='W'?'F':g==='B'?'C':g||'–';}
function shortName(n){const parts=String(n||'').trim().split(/\s+/);return parts.length<2?n:parts[0][0]+'. '+parts.slice(1).join(' ');}
function rosterName(p,players){const short=shortName(p.name),collision=players.some(other=>other.id!==p.id&&fold(shortName(other.name))===fold(short)&&fold(other.name)!==fold(p.name));return collision?p.name:short;}
function visible(p,slot){const f=filters[slot];return (!f.pos||posGroup(p)===f.pos)&&(!f.q||fold(p.name).includes(fold(f.q))||shirt(p)===f.q.trim());}
/* The players the arrow keys walk through: what is on screen, left panel then right. */
function walkList(){return ['a','b'].flatMap(k=>(liveRoster(STATE.scouting[k])?.players||[]).filter(p=>visible(p,k)));}
function teamButton(key,slot){const r=liveRoster(key),label=r?.t.name||'Select team';return '<button type="button" class="scoutTeamButton" data-slot="'+slot+'" aria-label="Select Team '+slot.toUpperCase()+'"><span>'+esc(label)+'</span><b>⌄</b></button>';}

function logViewing(r,event,date,gameDate){const who=author();const w=r._workflow={...(r._workflow||{})};w.viewings=[...(w.viewings||[])];if(!w.viewings.some(v=>!v.removed&&v.event===event&&v.date===date&&v.author===who)){w.viewings.push({id:crypto.randomUUID(),event,date,gameDate:gameDate||'',mode:SX?.active()?.mode==='Live'?'Live':'Video',notes:'',author:who,updatedAt:new Date().toISOString(),source:'matchup'});}w.updatedAt=new Date().toISOString();}
function migrateContext(p,r){let changed=false;for(const [k]of cats){if(!r[k])continue;r[k]=r[k].split('\n').map(line=>{const m=line.match(/ \[([^\[\]]+?) · (\d{4}-\d{2}-\d{2}) · ([^\[\]]+@[^\[\]]+)\]$/);if(!m)return line;changed=true;logViewing(r,m[1],m[2],'');return line.slice(0,m.index);}).join('\n');}if(changed&&editable())saveRec(p,{report:JSON.stringify(r)});}
function editable(){return window.ESAccess?ESAccess.internal&&ESAccess.owner:true}
const workspace=()=>window.ESWorkspace?ESWorkspace.visible():editable();
function choose(id,keepFocus){if(!id)return;selected=id;chosen=id;busyStatus='';renderScouting(true);if(!keepFocus)document.querySelector('.rosterRow.liveSelected')?.scrollIntoView({block:'nearest'});}
function step(delta){const list=walkList();if(!list.length)return;if(document.activeElement?.classList.contains('rosterRow'))document.activeElement.blur();const i=list.findIndex(p=>p.id===selected);choose(list[(i<0?0:i+delta+list.length)%list.length].id);}
function otherSide(){if(document.activeElement?.classList.contains('rosterRow'))document.activeElement.blur();const s=STATE.scouting,cur=rosterPlayers().find(p=>p.id===selected);if(!cur)return;const from=canonKey(s.a)===cur._liveClub?'a':'b',to=from==='a'?'b':'a';const mine=(liveRoster(s[from])?.players||[]).filter(p=>visible(p,from)),theirs=(liveRoster(s[to])?.players||[]).filter(p=>visible(p,to));if(!theirs.length)return;choose(theirs[Math.min(Math.max(0,mine.findIndex(p=>p.id===selected)),theirs.length-1)].id);}

function columnHTML(key,slot){const r=liveRoster(key),f=filters[slot];
 return '<div class="rosterCol mx-col" data-slot="'+slot+'"><div class="mx-colhead">'+(r?clubBadge(r.club,26):'')+teamButton(key,slot)+'</div>'+
 (r?'<input class="mx-rsearch" type="search" data-slot="'+slot+'" value="'+escAttr(f.q)+'" placeholder="Search players…" aria-label="Search '+escAttr(r.t.name)+' players"><div class="mx-posfilter" role="group" aria-label="Position filter">'+[['','All'],['G','G'],['W','W'],['B','B']].map(([v,l])=>'<button type="button" class="mx-pos'+(f.pos===v?' on':'')+'" data-pos="'+v+'" data-slot="'+slot+'" aria-pressed="'+(f.pos===v)+'">'+l+'</button>').join('')+'</div><div class="rosterList" tabindex="0" aria-label="'+escAttr(r.t.name)+' roster">'+
  r.players.map(p=>'<button type="button" class="rosterRow mx-row" data-id="'+escAttr(p.id)+'" title="'+escAttr(p.name)+'"'+(visible(p,slot)?'':' hidden')+'><span class="rrNum">'+esc(shirt(p)||'–')+'</span><span class="rrName">'+esc(rosterName(p,r.players))+'</span><span class="mx-mark" data-mark="'+(SX?SX.markOf(p):'')+'"></span><span class="mx-rpos">'+posShort(p)+'</span></button>').join('')+
  (r.players.length?'':'<div class="empty">'+(rosterDirectoriesPending?'Loading confirmed 2026/27 roster…':rosterDirectoriesFailed?'Roster data could not load. Retry the page once.':'No confirmed 2026/27 assignments yet.')+'</div>')+'</div>':'<div class="empty">Pick a team to see its roster.</div>')+'</div>';}

function contextHTML(){const s=STATE.scouting,a=SX?.active(),ra=liveRoster(s.a),rb=liveRoster(s.b);
 const sub=a?[a.competition?.name,a.stage].filter(Boolean).join(' | ')||'Session running':'2026/27 rosters';
 const team=(r,side)=>'<span class="mx-team mx-team-'+side+'">'+(r?clubBadge(r.club,28):'')+'<b>'+esc(r?r.t.name:'Team '+side.toUpperCase())+'</b></span>';
 const score=a?'<span class="mx-scorebox"><input id="mxScoreA" inputmode="numeric" maxlength="3" value="'+escAttr(a.scoreA||'')+'" aria-label="Score '+escAttr(a.a.name)+'"><i>–</i><input id="mxScoreB" inputmode="numeric" maxlength="3" value="'+escAttr(a.scoreB||'')+'" aria-label="Score '+escAttr(a.b.name)+'"></span>':'<span class="mx-vs">vs</span>';
 const meta=a?'<span class="mx-meta">'+esc([SX.fmtDate(a.gameDate),a.mode,a.venue].filter(Boolean).join(' · '))+'</span>':'';
 const session=!SX||!workspace()?'':a?'<span class="mx-live"><i></i>Session running</span><button type="button" class="btn primary sm" id="mxFinish">Finish session</button>':(editable()?'<button type="button" class="btn primary sm" id="mxStart">Start session</button>':'');
 return '<div class="mx-context"><div class="mx-title"><b>Scouting Matchup</b><small>'+esc(sub)+'</small></div><div class="mx-game">'+team(ra,'a')+score+team(rb,'b')+'</div>'+meta+'<span class="mx-spacer"></span>'+session+
  '<details class="mx-actions"><summary>Actions</summary><div class="mx-menu"><button type="button" data-act="swap">⇄ Swap teams</button>'+(a?'<button type="button" data-act="game">Edit game details</button>':'')+(s.a?'<button type="button" data-act="logA">'+esc(ra?.t.name||'Team A')+' · Team log</button>':'')+(s.b?'<button type="button" data-act="logB">'+esc(rb?.t.name||'Team B')+' · Team log</button>':'')+'<button type="button" data-act="log">Scouting log</button><button type="button" data-act="print">Print both rosters</button><button type="button" data-act="keys">Keyboard shortcuts</button></div></details></div>';}

function bioSelect(id,label,value,options){return '<label class="mx-bio-field" title="'+escAttr(label)+'"><select id="'+id+'" aria-label="'+escAttr(label)+'" data-option-search><option value="">'+esc(label)+' —</option>'+options.map(([v,text])=>'<option value="'+escAttr(v)+'"'+(String(value??'')===String(v)?' selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>';}
function numericOptions(min,max,value,suffix){const values=Array.from({length:max-min+1},(_,i)=>min+i);if(value!=null&&Number.isFinite(Number(value))&&!values.includes(Number(value)))values.push(Number(value));return values.sort((a,b)=>b-a).map(v=>[v,v+(suffix||'')]);}
function headerHTML(p){const lv=levelBand(p),g=statGradeOverall(p),photo=photoOf(p),num=shirt(p),stock=SX?SX.stockOf(p):'',a=SX?.active(),position=posGroup(p)==='G'?'Guard':posGroup(p)==='W'?'Forward':posGroup(p)==='B'?'Big':'';
 const positionField=editable()?'<label class="mx-position" title="Player position">🏀 <select id="mxPosition" aria-label="Player position" data-option-search><option value="">Position —</option>'+['Guard','Forward','Big'].map(v=>'<option'+(position===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label>':esc(position||posLabel(p));
 const nationality=editable()?bioSelect('mxCountry','Nationality',EuroScoutCountries.canonical(p.country),EuroScoutCountries.names.map(name=>[name,EuroScoutCountries.label(name)])):(p.country?'<span class="mx-flag">'+flagEmoji(p.country)+'</span> '+esc(p.country):'');
 const born=editable()?bioSelect('mxBorn','Birth year',p.born,numericOptions(1940,new Date().getFullYear()-10,p.born,'')):(p.born?esc(p.born)+(p.age!=null?' ('+esc(p.age)+')':''):'');
 const height=editable()?bioSelect('mxHeight','Height',p.height,numericOptions(140,235,p.height,' cm')):(p.height?esc(p.height)+' cm':'');
 const bits=[nationality,born,height,positionField,editable()?'<label class="mx-hand" title="Dominant hand">✋ <select id="mxHand" aria-label="Dominant hand" data-option-search><option value="">Hand —</option><option'+(p.hand==='Right'?' selected':'')+'>Right</option><option'+(p.hand==='Left'?' selected':'')+'>Left</option></select></label>':(p.hand?'<span title="Dominant hand">✋ '+esc(p.hand)+'</span>':'')].filter(Boolean);
 return '<div class="livePlayer mx-player"><span class="liveAvatar mx-avatar">'+(photo?'<img src="'+escAttr(photo)+'" alt="">':esc(initials(p.name)))+(num?'<em>#'+esc(num)+'</em>':'')+'</span>'+
  '<div class="mx-id"><h2>'+esc(p.name)+' <button type="button" class="mx-star'+(isWatched(p)?' on':'')+'" id="mxWatch" aria-pressed="'+isWatched(p)+'" title="Watchlist">'+(isWatched(p)?'★':'☆')+'</button></h2><div class="mx-bio">'+bits.join('<i>|</i>')+'</div><div class="mx-club">'+clubBadge(liveRoster(p._liveClub)?.club,18)+esc(liveRoster(p._liveClub)?.t.name||'')+'</div>'+(window.ESSignals?'<div class="mx-signals">'+ESSignals.html(p)+'</div>':'')+'</div>'+
  '<div class="mx-rate">'+'<div class="mx-level"><small>Estimated level'+(lv&&!lv.manual?' · auto':'')+'</small>'+(editable()?'<select id="mxLevel" aria-label="Estimated level"><option value="">'+(lv&&!lv.manual?esc(lv.label):'Auto')+'</option>'+LEVEL_BANDS.map((name,i)=>({name,i})).reverse().map(({name,i})=>'<option value="'+i+'"'+(lv&&lv.manual&&lv.i===i?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select>':'<b>'+esc(lv?lv.label:'—')+'</b>')+'<span class="mx-segs">'+LEVEL_BANDS.map((_,i)=>'<i class="'+(lv&&i<=lv.i?'on':'')+'"></i>').join('')+'</span></div>'+(g!=null?'<div class="mx-grade"><small>Grade</small><b>'+Number(g).toFixed(1)+'</b></div>':'')+'</div>'+
  '<div class="mx-buttons"><button type="button" class="btn ghost sm" id="liveProfile">Open profile ↗</button><button type="button" class="btn ghost sm" id="liveNumber">Jersey #'+esc(num||'—')+'</button>'+(workspace()?'<button type="button" class="btn ghost sm" id="mxLogs">History</button>':'')+(window.ESQuickStats?'<button type="button" class="btn ghost sm" id="mxStats" title="Season statistics without leaving the matchup">📊 Stats</button>':'')+'<button type="button" class="btn primary sm" id="mxBoard" title="Add this player to one of your private Scout Boards">＋ Board</button>'+
  (a?'<span class="mx-stock" role="group" aria-label="Stock"><button type="button" class="btn ghost sm'+(stock==='up'?' on':'')+'" data-stock="up" aria-pressed="'+(stock==='up')+'" title="Stock up">▲ Up</button><button type="button" class="btn ghost sm'+(stock==='down'?' on':'')+'" data-stock="down" aria-pressed="'+(stock==='down')+'" title="Stock down">▼ Down</button></span>':'')+
  '<span class="mx-spacer"></span><button type="button" class="btn ghost sm" id="mxPrev">← Prev</button><button type="button" class="btn ghost sm" id="mxNext">Next →</button></div></div>';}

renderScouting=function(partial=false){
 if(!partial)resetRosters();
 ensureMatchupDirectories();
 const s=STATE.scouting,act=SX?.active();
 /* A running session owns the two teams, so a reload lands back in the game. */
 if(act&&!partial){s.a=act.a.key||s.a;s.b=act.b.key||s.b;}
 const players=rosterPlayers();if(!players.some(p=>p.id===selected))selected=walkList()[0]?.id||players[0]?.id||'';
 const p=players.find(p=>p.id===selected),rep=p?effectiveReport(p):{};
 if(p)migrateContext(p,rep);
 if(p&&SX&&act&&chosen===p.id)try{SX.select(p,p._liveClub);}catch(error){busyStatus='Session tracking could not be saved. Free browser storage and retry.';console.warn('Session selection not saved',error);}
 const count=k=>bulletParse(rep[k]||'').length,total=cats.reduce((n,[k])=>n+count(k),0);
 const notebook='<section class="liveNotebook mx-notebook">'+(p?headerHTML(p)+'<div class="liveBody"><div class="mx-catbar"><div class="liveCategories" role="tablist" aria-label="Note categories">'+[['all','All notes'],...cats].map(([key,label])=>'<button type="button" role="tab" class="mx-cat'+(key===category?' on':'')+'" aria-selected="'+(key===category)+'" data-cat="'+key+'">'+label+' ('+(key==='all'?total:count(key))+')</button>').join('')+'</div><button type="button" class="mx-similar'+(showSimilar?' on':'')+'" id="mxSimilar" aria-pressed="'+showSimilar+'" title="Notes that overlap with the one you are writing">💡 Similar <span id="mxSimilarN"></span></button></div>'+
  '<div class="liveNoteTools"><input id="liveSearch" type="search" placeholder="Search this player’s notes…" aria-label="Search player notes"><span id="liveStatus" role="status">'+esc(busyStatus||(editable()?'✓ Changes save automatically':'Read only'))+'</span></div><div id="liveRelated" hidden></div><div id="liveBullets"></div></div>':'<div class="empty">Choose two teams, then select a player to begin taking notes.</div>')+'</section>';
 const app=document.querySelector('#app');
 const live=document.querySelector('.liveScouting');
 if(partial&&live){
  /* Player and note-category changes only affect the center notebook and the
     compact game header. Rebuilding both roster columns also regenerated every
     team option and player row on each click, which made live scouting pause for
     several seconds on the full database. */
  const t=document.createElement('template');
  t.innerHTML=contextHTML()+notebook;
  document.querySelector('.liveNotebook').replaceWith(t.content.querySelector('.liveNotebook'));
  document.querySelector('.mx-context').replaceWith(t.content.querySelector('.mx-context'));
 }else{
  app.innerHTML='<div class="view scoutingView liveScouting mx">'+contextHTML()+'<div class="liveLayout mx-layout">'+columnHTML(s.a,'a')+notebook+columnHTML(s.b,'b')+'</div></div>';
 }
 wireFrame();wireRows();if(p){wireNotebook(p,rep);window.ESPlayerScouting?.mountMatchup(p);}tick();backgroundLeagues();
};
/* Confirmed rosters come from the roster directories. Optional NCAA/NBA
   histories are loaded by their own views and signal filters, not while scouting. */
function backgroundLeagues(){}

function fullRedraw(){document.querySelector('.liveScouting')?.remove();renderScouting(true);}
function wireFrame(){const s=STATE.scouting;
 const root=document.querySelector('.liveScouting');root?.addEventListener('wheel',scrollMatchupArea,{capture:true,passive:false});document.querySelector('#liveBullets')?.setAttribute('tabindex','0');requestAnimationFrame(sizeWorkspace);
 document.querySelectorAll('.scoutTeamButton').forEach(el=>el.onclick=()=>{const slot=el.dataset.slot;if(!window.ESTeamSelection)return;window.ESTeamSelection.open({slot,currentKey:s[slot],onConfirm:({team})=>{const key=canonKey(team.key),current=STATE.scouting;if(canonKey(current[slot])===key)return;const a=SX?.active();if(a)SX.update({[slot]:{key,name:team.name}});current[slot]=key;filters[slot]={q:'',pos:''};rosters.delete(key);fullRedraw();}});});
 document.querySelectorAll('.mx-rsearch').forEach(el=>el.oninput=()=>{filters[el.dataset.slot].q=el.value;applyFilter(el.dataset.slot);});
 document.querySelectorAll('.mx-pos').forEach(el=>el.onclick=()=>{filters[el.dataset.slot].pos=el.dataset.pos;document.querySelectorAll('.mx-pos[data-slot="'+el.dataset.slot+'"]').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});applyFilter(el.dataset.slot);});
 const start=document.querySelector('#mxStart');if(start)start.onclick=startSession;
 const fin=document.querySelector('#mxFinish');if(fin)fin.onclick=finishSession;
 ['A','B'].forEach(k=>{const el=document.querySelector('#mxScore'+k);if(el)el.onchange=()=>SX.update({['score'+k]:el.value.trim()});});
 const menu=document.querySelector('.mx-actions');
 menu?.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{menu.open=false;({swap:swapTeams,game:editGame,logA:()=>SX?.openTeamLog(s.a),logB:()=>SX?.openTeamLog(s.b),log:()=>{STATE.view='scoutlog';render();},print:()=>{if(typeof printScoutingMatchup==='function')printScoutingMatchup(s.a,s.b);},keys:()=>window.MTShortcuts?.openHelp()})[b.dataset.act]?.();});
}
function applyFilter(slot){const col=document.querySelector('.mx-col[data-slot="'+slot+'"]');if(!col)return;const byId=new Map((liveRoster(STATE.scouting[slot])?.players||[]).map(p=>[p.id,p]));col.querySelectorAll('.rosterRow').forEach(row=>{const p=byId.get(row.dataset.id);row.hidden=!p||!visible(p,slot);});}
function wireRows(){document.querySelectorAll('.rosterRow').forEach(el=>{const on=el.dataset.id===selected;el.classList.toggle('liveSelected',on);el.setAttribute('aria-pressed',on);el.onclick=()=>choose(el.dataset.id,true);});}
function refreshMarks(){if(!SX)return;const active=SX.active(),byId=new Map(rosterPlayers().map(p=>[p.id,p]));document.querySelectorAll('.rosterRow').forEach(row=>{const p=byId.get(row.dataset.id),m=row.querySelector('.mx-mark');if(p&&m)m.dataset.mark=SX.markOf(p,active);});}
function tick(){if(!SX?.active()){clearInterval(timer);timer=null;return;}if(timer)return;timer=setInterval(()=>{if(!document.querySelector('.liveScouting')){clearInterval(timer);timer=null;return;}refreshMarks();},2000);}

function swapTeams(){const s=STATE.scouting;[s.a,s.b]=[s.b,s.a];[filters.a,filters.b]=[filters.b,filters.a];const a=SX?.active();if(a)SX.update({a:a.b,b:a.a,scoreA:a.scoreB,scoreB:a.scoreA});fullRedraw();}
let openingSession=false;
function startSession(){
 if(openingSession||document.getElementById('sxStart'))return;
 const button=document.querySelector('#mxStart'),s=STATE.scouting,preset={a:s.a,b:s.b};
 openingSession=true;if(button){button.disabled=true;button.textContent='Opening…';}
 // Paint feedback before building the full team picker; one click opens one dialog.
 requestAnimationFrame(()=>setTimeout(()=>{
  try{SX.openStart(preset,a=>{if(!a)return;s.a=a.a.key;s.b=a.b.key;s.gameDate=a.gameDate;fullRedraw();});}
  catch(error){SX.closeModal();console.warn('Scouting session dialog unavailable',error);toast('Could not open the session form. Try again.');}
  finally{openingSession=false;if(button?.isConnected){button.disabled=false;button.textContent='Start session';}}
 },0));
}
function finishSession(){SX.openFinish(()=>fullRedraw());}
function editGame(){const a=SX?.active();if(!a)return;const box=SX.modal('<h3>Game details</h3><form id="mxGame" class="sx-form"><div class="sx-two"><label>Competition<input name="comp" type="text" value="'+escAttr(a.competition?.name||'')+'"></label><label>Stage / round<input name="stage" type="text" value="'+escAttr(a.stage||'')+'"></label></div><div class="sx-two"><label>Game date<input name="gameDate" type="date" value="'+escAttr(a.gameDate||'')+'"></label><label>How are you watching?<select name="mode"><option'+(a.mode==='Video'?' selected':'')+'>Video</option><option'+(a.mode==='Live'?' selected':'')+'>Live</option></select></label></div><label>Venue<input name="venue" type="text" value="'+escAttr(a.venue||'')+'"></label><div class="sx-actions"><button class="btn primary">Save</button></div></form>');const f=box.querySelector('#mxGame');f.onsubmit=e=>{e.preventDefault();const name=f.elements.comp.value.trim();SX.update({competition:name===(a.competition?.name||'')?a.competition:{id:'',name},stage:f.elements.stage.value.trim(),gameDate:f.elements.gameDate.value||a.gameDate,mode:f.elements.mode.value,venue:f.elements.venue.value.trim()});SX.closeModal();renderScouting(true);};}

function wireNotebook(p,rep){
 const s=STATE.scouting,date=todayStr();
 const avatar=document.querySelector('.liveAvatar img');if(avatar){const fallback=()=>{avatar.replaceWith(document.createTextNode(initials(p.name)))};avatar.onerror=fallback;if(avatar.complete&&!avatar.naturalWidth)fallback();}
 document.querySelector('#liveNumber').onclick=()=>{if(!editable())return;showModal('<h3>'+esc(p.name)+' · jersey number</h3><p>2026/27 · '+esc(liveRoster(p._liveClub)?.t.name||'')+'</p><form id="jerseyForm"><label>Number (00, 0–99)<input name="jersey" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" value="'+escAttr(shirt(p))+'" style="display:block;padding:12px;margin:12px 0"></label><p class="hint">Leave empty for unknown. #00 and #0 stay distinct.</p><button class="btn primary">Save number</button><p role="status"></p></form>');const form=document.querySelector('#jerseyForm');form.elements.jersey.focus();form.onsubmit=async e=>{e.preventDefault();const raw=form.elements.jersey.value.trim();if(raw&&!/^[0-9]{1,2}$/.test(raw))return;const value=raw==='00'?'00':raw?String(Number(raw)):'';const numbers={...jerseyNumbers(p),[numberKey(p)]:value};form.querySelector('button').disabled=true;try{const ok=await saveRec(p,{jerseyNumbers:numbers});busyStatus=ok===false?'Number stored locally; cloud sync failed.':'Jersey number saved.';hideModal();rosters.clear();fullRedraw();}catch(e){form.querySelector('[role=status]').textContent='Could not save. Try again.';form.querySelector('button').disabled=false;}};};
 document.querySelector('#liveProfile').onclick=()=>openProfile(p.id);
 const boardBtn=document.querySelector('#mxBoard');if(boardBtn)boardBtn.onclick=()=>addToScoutBoard(p.id);
 const level=document.querySelector('#mxLevel');if(level)level.onchange=async()=>{await window.wfFlushReport?.();ovrSaveLocal({bio:{[gid(p)||p.id]:{projLevel:level.value}}});busyStatus=level.value===''?'Level back to automatic.':'Estimated level saved.';rosters.clear();clubIndex=null;fullRedraw();};
 for(const [id,field,label] of [['mxHand','hand','Dominant hand'],['mxPosition','role','Position'],['mxBorn','born','Birth year'],['mxHeight','height','Height'],['mxCountry','country','Nationality']]){const control=document.getElementById(id);if(!control)continue;control.onchange=async()=>{control.disabled=true;try{await window.wfFlushReport?.();const value=control.value,patch={[field]:['born','height','weight'].includes(field)&&value!==''?Number(value):value};if(field==='born'){const dob=String(p.birthDate||p.dob||'');patch.birthDate=value&&/^\d{4}-\d{2}-\d{2}$/.test(dob)?value+dob.slice(4):'';}if(field==='role')patch.pos={Guard:'G',Forward:'F',Big:'C'}[value]||'';ovrSaveLocal({bio:{[gid(p)||p.id]:patch}},{players:personLines(p)});await window.ESStorage?.flush();busyStatus=label+' saved to player profile.';rosters.clear();renderScouting(true);if(field==='role'){const byId=new Map(rosterPlayers().map(x=>[x.id,x]));document.querySelectorAll('.rosterRow').forEach(row=>{const updated=byId.get(row.dataset.id);if(updated)row.querySelector('.mx-rpos').textContent=posShort(updated);});['a','b'].forEach(applyFilter);}}catch(error){control.disabled=false;busyStatus='Could not save '+label.toLowerCase()+'. Your existing data is retained.';document.getElementById('liveStatus').textContent=busyStatus;}};}
 const logsBtn=document.querySelector('#mxLogs');if(logsBtn)logsBtn.onclick=()=>SX?SX.openPlayerLog(p):openProfile(p.id);
 const statsBtn=document.querySelector('#mxStats');if(statsBtn)statsBtn.onclick=()=>ESQuickStats.open(p);
 window.ESQuickStats?.follow(p);
 document.querySelector('#mxPrev').onclick=()=>step(-1);document.querySelector('#mxNext').onclick=()=>step(1);
 document.querySelector('#mxWatch').onclick=()=>{if(!editable())return;toggleTag(p.id,WATCH_TAG).then(()=>renderScouting(true));};
 document.querySelectorAll('.mx-stock [data-stock]').forEach(b=>b.onclick=()=>{SX.setStock(p,b.dataset.stock);renderScouting(true);refreshMarks();});
 let dragged=null,noteSaveSequence=0;
 document.querySelectorAll('[data-cat]').forEach(el=>{el.onclick=()=>{category=el.dataset.cat;renderScouting(true)};if(el.dataset.cat==='all')return;el.ondragover=e=>{if(!dragged||dragged.field===el.dataset.cat)return;e.preventDefault();el.classList.add('drop');};el.ondragleave=()=>el.classList.remove('drop');el.ondrop=e=>{if(!dragged)return;e.preventDefault();const d=dragged;dragged=null;moveNote(d.field,d.text,el.dataset.cat);};});
 document.querySelector('#mxSimilar').onclick=()=>{showSimilar=!showSimilar;renderScouting(true);};

 const host=document.querySelector('#liveBullets'),related=document.querySelector('#liveRelated'),similarN=document.querySelector('#mxSimilarN');
 const tokens=t=>new Set(fold(t).split(/[^a-z0-9]+/).filter(w=>w.length>3).map(w=>/^(shoot|shot|shooting|shooter)/.test(w)?'shoot':/^(defen)/.test(w)?'defense':w.replace(/(ing|ers|es|s)$/,'')));

 function counts(r=effectiveReport(p)){document.querySelectorAll('[data-cat]').forEach(button=>{const k=button.dataset.cat,label=k==='all'?'All notes':cats.find(c=>c[0]===k)[1];button.textContent=label+' ('+(k==='all'?cats.reduce((n,[f])=>n+bulletParse(r[f]||'').length,0):bulletParse(r[k]||'').length)+')'});document.querySelectorAll('[data-count]').forEach(el=>{const n=bulletParse(r[el.dataset.count]||'').length;el.textContent=n+' note'+(n===1?'':'s');});}
 /* Similar notes stay out of the way: the count is always there, the list only on request. */
 function suggestions(text,current){const words=tokens(text),matches=[];related.replaceChildren();if(words.size){const report=effectiveReport(p);for(const [key,label]of cats)bulletParse(report[key]||'').forEach((note,index)=>{if(key===current.key&&index===current.index)return;const other=tokens(note),score=[...words].filter(w=>other.has(w)).length;if(score)matches.push({key,label,note,index,score})});matches.sort((a,b)=>b.score-a.score);}
  similarN.textContent=matches.length?'('+matches.length+')':'';related.hidden=!showSimilar||!matches.length;if(related.hidden)return;
  const title=document.createElement('div');title.textContent='Similar notes · open one to edit it instead of repeating yourself';related.append(title);
  for(const m of matches.slice(0,4)){const button=document.createElement('button');button.className='btn ghost';button.textContent=m.label+': '+m.note;button.type='button';button.onclick=()=>{category=m.key;renderScouting(true);const row=document.querySelectorAll('#liveBullets .bl-txt')[m.index];row?.scrollIntoView({block:'nearest'});row?.focus()};related.append(button);}}
 /* Move a note to another category: the ⇄ button on the row, Alt + the category's
    letter while typing in it, or drag the row's handle onto a category tab. */
 function moveNote(from,text,to){text=String(text||'').trim();if(!text||from===to||!cats.some(c=>c[0]===to))return;const r=effectiveReport(p),src=bulletParse(r[from]||''),i=src.indexOf(text);if(i<0)return;src.splice(i,1);r[from]=src.map(t=>'\u2022 '+t).join('\n');r[to]=bulletParse(r[to]||'').concat([text]).map(t=>'\u2022 '+t).join('\n');busyStatus='Moved to '+cats.find(c=>c[0]===to)[1]+'.';saveRec(p,{report:JSON.stringify(r)}).then(()=>refreshMarks()).catch(()=>{});renderScouting(true);}
 window.__mxMove=(to)=>{const row=document.activeElement?.closest?.('#liveBullets .bl-item');if(!row)return false;moveNote(row.closest('[data-note-section]').dataset.noteSection,row.querySelector('.bl-txt').textContent,to);return true;};
 function closeMoveMenu(){document.querySelector('.mx-movemenu')?.remove();}
 function decorate(list,field){list.querySelectorAll('.bl-item').forEach(row=>{if(row.querySelector('.mx-move'))return;const b=document.createElement('button');b.type='button';b.className='mx-move';b.title='Move to another category';b.setAttribute('aria-label','Move note to another category');b.textContent='\u21c4';
   b.onclick=e=>{e.stopPropagation();const open=row.querySelector('.mx-movemenu');closeMoveMenu();if(open)return;const text=row.querySelector('.bl-txt').textContent;if(!text.trim())return;const m=document.createElement('div');m.className='mx-movemenu';m.setAttribute('role','menu');const t=document.createElement('small');t.textContent='Move to';m.append(t);cats.filter(c=>c[0]!==field).forEach(([k,label])=>{const o=document.createElement('button');o.type='button';o.setAttribute('role','menuitem');o.textContent=label;o.onclick=()=>moveNote(field,text,k);m.append(o);});row.append(m);m.querySelector('button').focus();};
   row.querySelector('.bl-del')?.before(b);});}
 for(const [field,label]of cats.filter(([k])=>category==='all'||k===category)){
  const section=document.createElement('section');section.dataset.noteSection=field;
  const head=document.createElement('div');head.className='mx-sechead';const title=document.createElement('h3');title.textContent=label;const n=document.createElement('span');n.dataset.count=field;head.append(title,n);section.append(head);
  const list=document.createElement('div');section.append(list);host.append(section);
  if(!editable()){list.innerHTML='<ul class="mx-readonly">'+bulletParse(rep[field]||'').map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';continue;}
  let editor=makeBulletList(list,rep[field]||'','Write an observation…',()=>{/* An editor that has been redrawn away must never write its stale rows back. */if(!list.isConnected)return;if(SX?.active()&&chosen!==p.id){chosen=p.id;try{SX.select(p,p._liveClub);}catch(error){console.warn('Session selection not saved',error);}}const r=effectiveReport(p);r[field]=editor.serialize();
   if(r._workflow?.noteTimes){r._workflow={...r._workflow};delete r._workflow.noteTimes;}counts(r);
   const sequence=++noteSaveSequence;saveRec(p,{report:JSON.stringify(r)}).then(ok=>{if(!list.isConnected||sequence!==noteSaveSequence)return;counts();refreshMarks();const st=document.querySelector('#liveStatus');if(st)st.textContent=ok===false?'Saved locally; cloud sync failed.':'✓ Saved to player profile';}).catch(()=>{if(!list.isConnected||sequence!==noteSaveSequence)return;const st=document.querySelector('#liveStatus');if(st)st.textContent='Could not save changes. Keep this note open and retry.'});});
  const addRow=list.querySelector('.bl-addrow');list.prepend(addRow);const addButton=addRow.querySelector('button');addButton.textContent='+  Add note';addButton.dataset.addNote=field;
  addButton.onclick=()=>{const ul=list.querySelector('.bl-ul');[...ul.children].slice(0,-1).forEach(li=>{if(!li.querySelector('.bl-txt').textContent.trim())li.remove();});const row=ul.lastElementChild;ul.prepend(row);row.querySelector('.bl-txt')?.focus();row.scrollIntoView({block:'nearest'});};
  decorate(list,field);
  list.addEventListener('input',e=>{if(!e.target.matches('.bl-txt'))return;const index=[...list.querySelectorAll('.bl-txt')].indexOf(e.target);suggestions(e.target.textContent,{key:field,index})});
  list.addEventListener('focusout',()=>setTimeout(()=>decorate(list,field),0));
  list.addEventListener('dragstart',e=>{const row=e.target.closest?.('.bl-item');dragged=row?{field,text:row.querySelector('.bl-txt').textContent}:null;});list.addEventListener('dragend',()=>setTimeout(()=>{dragged=null;document.querySelectorAll('.mx-cat.drop').forEach(x=>x.classList.remove('drop'));},0));
 }
 counts();
 document.querySelector('#liveSearch').oninput=e=>{const q=fold(e.target.value);host.querySelectorAll('.bl-item').forEach(row=>row.hidden=!!q&&!fold(row.textContent).includes(q));host.querySelectorAll('section').forEach(section=>section.hidden=!!q&&![...section.querySelectorAll('.bl-item')].some(row=>!row.hidden));};
}

document.addEventListener('click',e=>{if(!e.target.closest?.('.mx-movemenu,.mx-move'))document.querySelector('.mx-movemenu')?.remove();});

/* ── keyboard ──────────────────────────────────────────── */
const K=window.MTShortcuts;
if(K){
 const inMatchup=()=>STATE.view==='scouting'&&!!document.querySelector('.liveScouting')&&!(typeof DRAWER_OPEN!=='undefined'&&DRAWER_OPEN)&&!document.querySelector('#modal,#sxMask,#mtscMask');
 const G='Scouting matchup',add=(id,label,keys,run,opt)=>K.register({id:'matchup.'+id,label,keys,group:G,scope:'matchup',when:inMatchup,run,...(opt||{})});
 add('next','Next player','ArrowDown',()=>step(1));
 add('prev','Previous player','ArrowUp',()=>step(-1));
 add('nextTyping','Next player (while typing)','Alt+ArrowDown',()=>step(1),{allowInInput:true});
 add('prevTyping','Previous player (while typing)','Alt+ArrowUp',()=>step(-1),{allowInInput:true});
 add('side','Jump to the other team','ArrowRight',otherSide);
 add('sideBack','Jump to the other team (left)','ArrowLeft',otherSide);
 [['all','All notes','L'],['nAth','Athleticism','A'],['nOff','Offense','O'],['nDef','Defense','D'],['nIntel','Intel','I'],['nProj','Projection','P']].forEach(([k,l,key])=>add('cat.'+k,'Category: '+l,key,()=>{category=k;renderScouting(true);}));
 [['nAth','Athleticism','Alt+A'],['nOff','Offense','Alt+O'],['nDef','Defense','Alt+D'],['nIntel','Intel','Alt+I'],['nProj','Projection','Alt+P']].forEach(([k,l,key])=>add('move.'+k,'Move the note you are in to '+l,key,()=>window.__mxMove?.(k),{allowInInput:true}));
 add('note','New note','N',()=>document.querySelector('#liveBullets [data-add-note]')?.click());
 add('noteTyping','New note (while typing)','Alt+N',()=>document.querySelector('#liveBullets [data-add-note]')?.click(),{allowInInput:true});
 add('leave','Leave the note you are typing','Escape',()=>document.activeElement?.blur(),{allowInInput:true,when:()=>inMatchup()&&!!document.activeElement?.closest?.('#liveBullets,.liveNoteTools,.mx-col')});
 add('search','Search this player’s notes','/',()=>document.querySelector('#liveSearch')?.focus());
 add('findPlayer','Search the roster','F',()=>{const cur=rosterPlayers().find(p=>p.id===selected),slot=cur&&canonKey(STATE.scouting.b)===cur._liveClub?'b':'a';document.querySelector('.mx-rsearch[data-slot="'+slot+'"]')?.focus();});
 add('similar','Show / hide similar notes','S',()=>document.querySelector('#mxSimilar')?.click());
 add('watch','Watchlist on / off','W',()=>document.querySelector('#mxWatch')?.click());
 add('profile','Open full profile','Enter',()=>document.querySelector('#liveProfile')?.click());
 add('stats','Quick stats panel','T',()=>{if(window.ESQuickStats?.isOpen())ESQuickStats.close();else document.querySelector('#mxStats')?.click();});
 add('logs','View the player’s history','H',()=>document.querySelector('#mxLogs')?.click());
 add('up','Stock up (session)','+',()=>document.querySelector('.mx-stock [data-stock=up]')?.click());
 add('down','Stock down (session)','-',()=>document.querySelector('.mx-stock [data-stock=down]')?.click());
 add('swap','Swap teams','X',swapTeams);
 add('session','Start / finish session','Shift+S',()=>(document.querySelector('#mxFinish')||document.querySelector('#mxStart'))?.click());
}
window.ESMatchupProfile={refresh:function(){rosters.clear();clubIndex=null;renderScouting(true);}};
})();
