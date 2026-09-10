(function(){
'use strict';
const cats=[['nAth','Athleticism'],['nOff','Offense'],['nDef','Defense'],['nIntel','Intel'],['nProj','Projection / verdict']];
let selected='',category='nOff',recent=[],busy=false,status='';
const draftKey=()=> 'euroscout:live-drafts:'+ (window.ESAccess?.user?.email||'local');
function drafts(){try{return JSON.parse(localStorage.getItem(draftKey())||'{}')}catch{return {}}}
function draft(p,value){const d=drafts(),k=gid(p)+'|'+category;if(value===undefined)return d[k]||'';d[k]=value;try{localStorage.setItem(draftKey(),JSON.stringify(d))}catch{status='Draft could not be stored on this device.'}}
let clubIndex=null,rosters=new Map(),columns=new Map();
function numberKey(p){return '2026/27|'+p._liveClub;}
function shirt(p){const v=recOf(p).jerseyNumbers?.[numberKey(p)];return v==null?'':String(v);}
function jerseyOrder(a,b){const rank=p=>{const n=shirt(p);return n==='00'?-2:n==='0'?-1:/^\d{1,2}$/.test(n)?Number(n):1000};return rank(a)-rank(b)||a.name.localeCompare(b.name);}
function resetRosters(){clubIndex=null;rosters.clear();columns.clear();}
function liveRoster(key){if(!key)return null;key=canonKey(key);if(rosters.has(key))return rosters.get(key);const club=allClubs().find(c=>c.key===key);if(!club)return null;
 if(!clubIndex){clubIndex=new Map();const m=next26Get(),mb=next26bGet();for(const p of assignPool())for(const k of effective26keys(p,m,mb)){if(!clubIndex.has(k))clubIndex.set(k,[]);clubIndex.get(k).push(p);}}
 const r={t:{name:club.name},players:(clubIndex.get(key)||[]).map(p=>({...p,_liveClub:key})).sort(jerseyOrder)};rosters.set(key,r);return r;
}
function liveColumn(key,slot){const cache=slot+'|'+key;if(columns.has(cache))return columns.get(cache);const r=liveRoster(key);const html='<div class="rosterCol"><div class="rosterHead"><select class="scoutTeamSel" data-slot="'+slot+'">'+scoutingTeamOptions(key)+'</select></div>'+(r?'<div class="rosterTeam">'+esc(r.t.name)+'</div><div class="rosterSub">'+r.players.length+' players · jersey order · unknown numbers last</div><div class="rosterList">'+r.players.map(p=>'<button class="rosterRow" data-id="'+escAttr(p.id)+'"><span class="rrNum">'+(shirt(p)||'–')+'</span><span class="rrMain"><span class="rrName">'+esc(p.name)+'</span><span class="rrMeta">'+esc(posLabel(p))+'</span></span></button>').join('')+'</div>':'<div class="empty">Pick a team to see its roster.</div>')+'</div>';columns.set(cache,html);return html;}
function rosterPlayers(){return ['a','b'].flatMap(k=>liveRoster(STATE.scouting[k])?.players||[])}

function choose(id){selected=id;recent=[id,...recent.filter(x=>x!==id)].slice(0,5);status='';renderScouting(true);document.querySelector('#liveInput')?.focus()}
function editable(){return window.ESAccess?ESAccess.internal&&ESAccess.owner:true}
renderScouting=function(partial=false){
 if(!partial)resetRosters();
 const s=STATE.scouting,players=rosterPlayers();if(!players.some(p=>p.id===selected))selected=players[0]?.id||'';
 const p=players.find(p=>p.id===selected),rep=p?parseReport(recOf(p).report):{};
 const today=new Date(),date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const markup=`<div class="view scoutingView liveScouting"><div class="scouthead"><div><h1 class="title">Scouting matchup</h1><div class="sub">Choose a player. Choose a category. Write an observation.</div></div><button class="btn ghost" id="liveSwap">⇄ Swap teams</button></div><div class="liveLayout">${liveColumn(s.a,'a')}<section class="liveNotebook">${p?`<div class="livePlayer"><span class="hint">PLAYER NOTES</span><h2>${esc(p.name)}</h2><span>${esc(liveRoster(p._liveClub)?.t.name||'')}</span><button class="btn ghost sm" id="liveProfile">Open full profile ↗</button><button class="btn ghost sm" id="liveNumber">Edit jersey #${esc(shirt(p)||'—')}</button></div><div class="liveBody"><div class="liveCategories">${cats.map(([key,label])=>`<button class="btn ${key===category?'primary':'ghost'}" aria-pressed="${key===category}" data-cat="${key}">${label}</button>`).join('')}</div><label for="liveInput">New ${cats.find(c=>c[0]===category)[1].toLowerCase()} observation</label><textarea id="liveInput" rows="4" placeholder="Write what you see…" ${editable()?'':'disabled'}>${esc(draft(p))}</textarea><div class="liveActions"><span class="hint">Enter to add · Shift + Enter for a new line</span><button class="btn primary" id="liveAdd" ${busy||!editable()?'disabled':''}>Add bullet</button></div><p id="liveStatus" role="status">${esc(status||(!editable()?'Sign in with editing access to write notes.':'Saves directly to this player’s profile.'))}</p><details><summary>Game context</summary><label>Viewing date <input id="liveDate" type="date" value="${escAttr(s.noteDate||date)}"></label><p class="hint">Team names, viewing date and author are attached to each observation.</p></details><h3>${cats.find(c=>c[0]===category)[1]} notes</h3><div id="liveBullets"></div></div>`:'<div class="empty">Choose a team, then select a player to begin taking notes.</div>'}</section>${liveColumn(s.b,'b')}</div><div class="liveRecent">${recent.map(id=>players.find(p=>p.id===id)).filter(Boolean).map(p=>`<button class="btn ghost sm" data-recent="${escAttr(p.id)}">${esc(p.name)}</button>`).join('')}</div></div>`;
 if(partial&&document.querySelector('.liveScouting')){const template=document.createElement('template');template.innerHTML=markup;document.querySelector('.liveNotebook').replaceWith(template.content.querySelector('.liveNotebook'));document.querySelector('.liveRecent').replaceWith(template.content.querySelector('.liveRecent'));}else document.querySelector('#app').innerHTML=markup;
 document.querySelectorAll('.scoutTeamSel').forEach(el=>el.onchange=()=>{s[el.dataset.slot]=el.value;document.querySelector('.liveScouting')?.remove();renderScouting(true)});
 document.querySelector('#liveSwap').onclick=()=>{[s.a,s.b]=[s.b,s.a];document.querySelector('.liveScouting')?.remove();renderScouting(true)};
 document.querySelectorAll('.rosterRow').forEach(el=>{el.classList.toggle('liveSelected',el.dataset.id===selected);el.setAttribute('aria-pressed',el.dataset.id===selected);el.onclick=()=>choose(el.dataset.id)});
 document.querySelectorAll('[data-recent]').forEach(el=>el.onclick=()=>choose(el.dataset.recent));
 if(!p)return;
 document.querySelector('#liveNumber').onclick=()=>{if(!editable())return;showModal('<h3>'+esc(p.name)+' · jersey number</h3><p>2026/27 · '+esc(liveRoster(p._liveClub)?.t.name||'')+'</p><form id="jerseyForm"><label>Number (00, 0–99)<input name="jersey" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" value="'+escAttr(shirt(p))+'" style="display:block;padding:12px;margin:12px 0"></label><p class="hint">Leave empty for unknown. #00 and #0 stay distinct.</p><button class="btn primary">Save number</button><p role="status"></p></form>');const form=document.querySelector('#jerseyForm');form.onsubmit=async e=>{e.preventDefault();const raw=form.elements.jersey.value.trim();if(raw&&!/^[0-9]{1,2}$/.test(raw))return;const value=raw==='00'?'00':raw?String(Number(raw)):'';const numbers={...(recOf(p).jerseyNumbers||{}),[numberKey(p)]:value};form.querySelector('button').disabled=true;try{const ok=await saveRec(p,{jerseyNumbers:numbers});status=ok===false?'Number stored locally; cloud sync failed.':'Jersey number saved.';hideModal();rosters.clear();columns.clear();document.querySelector('.liveScouting')?.remove();renderScouting(true);}catch(e){form.querySelector('[role=status]').textContent='Could not save. Try again.';form.querySelector('button').disabled=false;}};};
 document.querySelector('#liveProfile').onclick=()=>openProfile(p.id);
 document.querySelectorAll('[data-cat]').forEach(el=>el.onclick=()=>{category=el.dataset.cat;renderScouting(true);document.querySelector('#liveInput').focus()});
 const input=document.querySelector('#liveInput');input.oninput=()=>draft(p,input.value);
 document.querySelector('#liveDate').onchange=e=>{s.noteDate=e.target.value};
 const field=category;
 async function add(){if(busy||!editable()||!input.value.trim())return;busy=true;document.querySelector('#liveAdd').disabled=true;
  const text=input.value.trim(),r=parseReport(recOf(p).report),game=['a','b'].map(k=>liveRoster(s[k])?.t.name).filter(Boolean).join(' vs '),author=window.ESAccess?.user?.email||'';
  r[field]=[r[field],...text.split(/\r?\n/).filter(x=>x.trim()).map(x=>'• '+x.trim()+' ['+[game,s.noteDate||date,author].filter(Boolean).join(' · ')+']')].filter(Boolean).join('\n');
  try{const ok=await saveRec(p,{report:JSON.stringify(r)});status=ok===false?'Stored locally. Cloud save failed — reconnect and retry sync.':'Saved to player profile.';const d=drafts();d[gid(p)+'|'+field]='';localStorage.setItem(draftKey(),JSON.stringify(d));}catch(e){status='Could not save. Your draft is retained.'}finally{busy=false;if(document.querySelector('.liveScouting')){renderScouting(true);document.querySelector('#liveInput')?.focus()}}
 }
 document.querySelector('#liveAdd').onclick=add;input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();add()}};
 const host=document.querySelector('#liveBullets');
 if(editable()){let editor=makeBulletList(host,rep[field]||'','Observation',()=>{const r=parseReport(recOf(p).report);r[field]=editor.serialize();saveRec(p,{report:JSON.stringify(r)}).then(ok=>{const el=document.querySelector('#liveStatus');if(el)el.textContent=ok===false?'Stored locally; cloud sync failed.':'Saved to player profile.'})});}
 else host.innerHTML='<ul>'+bulletParse(rep[field]||'').map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';
};
})();

