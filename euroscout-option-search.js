(function(){
'use strict';
const normalize=s=>String(s||'').replace(/[đĐ]/g,'dj').replace(/[łŁ]/g,'l').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const leagueCountries={acb:'Spain',feb:'Spain',lba:'Italy',seriea2:'Italy',bbl:'Germany',proa:'Germany',lnb:'France',elite2:'France',sbl:'Sweden',il:'Israel',gbl:'Greece',plk:'Poland',rou:'Romania',bsl:'Turkey',tbl:'Turkey',lkl:'Lithuania',slo:'Slovenia',hun:'Hungary',hrv:'Croatia',bul:'Bulgaria',fin:'Finland',cebl:'Canada',cze:'Czechia',por:'Portugal',bsn:'Puerto Rico',cba:'China',jbl:'Japan',kbl:'South Korea',pba:'Philippines',arg:'Argentina',nbb:'Brazil',autbsl:'Austria',cyp:'Cyprus',kls:'Serbia',bosnia:'Bosnia and Herzegovina',britain:'United Kingdom',denmark:'Denmark',iceland:'Iceland',kosovo:'Kosovo',macedonia:'North Macedonia',montenegro:'Montenegro',slovakia:'Slovakia',swiss:'Switzerland',nba:'United States',gleague:'United States',ncaam:'United States'};
const regions={aba:'Adriatic region',aba2:'Adriatic region',bnxt:'Belgium / Netherlands',elb:'Latvia / Estonia',vtb:'Russia / regional',euroleague:'Europe',eurocup:'Europe',bcl:'Europe',fec:'Europe',enbl:'Europe'};
function leagueLabel(o){
 let leagues=[];try{leagues=STATE.data?.leagues||[];}catch{}
 const v=String(o.value).replace(/^n27:/,'');const L=leagues.find(l=>l.meta.id===v||l.meta.name===o.value||l.meta.name===o.textContent.trim());
 const id=L?.meta.id||v,country=leagueCountries[id],region=regions[id];if(!country&&!region)return o.textContent;
 const label=o.textContent.replace(/^[\s\u{1F1E6}-\u{1F1FF}]+/u,'').trim();
 const prefix=country||region;const flag=country?window.EuroScoutCountries?.flag(country)||'':'';
 return (flag?flag+' ':'')+(normalize(label).includes(normalize(prefix))?label:prefix+' · '+label);
}

let current=null;
function eligible(s){return s instanceof HTMLSelectElement&&!s.matches('#mxLevel,#esLevel,#eProj,.es-blueprint-level,.es-level-picker')&&!s.disabled&&!s.multiple&&s.size<=1&&(s.hasAttribute('data-option-search')||s.options.length>=7||/team|club|agent|agency|league|country|arch|role|position/i.test(s.id));}
function openCompact(s,initial=''){
 if(current)current.close();
 const menu=document.createElement('div');menu.className='es-option-popover';menu.setAttribute('role','dialog');menu.setAttribute('aria-label',s.getAttribute('aria-label')||'Choose an option');
 menu.innerHTML='<input type="search" aria-label="Search options" placeholder="Search…" autocomplete="off"><small aria-live="polite"></small><div class="es-option-results" role="listbox"></div>';
 document.body.append(menu);s.setAttribute('aria-expanded','true');
 const input=menu.querySelector('input'),list=menu.querySelector('.es-option-results'),count=menu.querySelector('small');
 const isTeam=/team|club|roster/i.test(s.id)||(['a','b'].includes(s.name)&&!!s.closest('#sxStart'));
 const clubs=isTeam?allClubs():[],byKey=new Map(),byName=new Map();for(const c of clubs){byKey.set(c.key,c);for(const t of c.teams||[])byKey.set(t.key,c);byName.set(normalize(c.name),c);}
 const opts=Array.from(s.options).filter(o=>!o.hidden).map(o=>{const c=isTeam?(byKey.get(o.value)||byName.get(normalize(o.textContent.trim()))):null;return{value:o.value,label:o.textContent,disabled:o.disabled,logo:c?clubLogo(c):'',search:normalize([o.textContent,c?.country,c?.city,...(c?.teams||[]).flatMap(t=>[t.name,...(t.searchAliases||[])])].filter(Boolean).join(' '))};});
 const position=()=>{if(!s.isConnected){close();return;}const r=s.getBoundingClientRect(),w=Math.min(isTeam?420:300,innerWidth-24),height=Math.min(380,innerHeight-24),below=innerHeight-r.bottom-12;menu.style.width=w+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';menu.style.maxHeight=Math.max(130,Math.min(height,Math.max(below,r.top-12)))+'px';menu.style.top=(below>=Math.min(240,height)?r.bottom+5:Math.max(12,r.top-Math.min(height,r.top-12)))+'px';};
 const close=()=>{menu.remove();s.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keys,true);window.removeEventListener('resize',position);current=null;if(s.isConnected)s.focus();};current={close};
 const outside=e=>{if(!menu.contains(e.target)&&e.target!==s)close();};let limit=80;
 const choose=o=>{if(!s.isConnected)return close();s.value=o.value;close();s.dispatchEvent(new Event('change',{bubbles:true}));};
 function paint(){const words=normalize(input.value).trim().split(/\s+/).filter(Boolean),matches=opts.filter(o=>words.every(w=>o.search.includes(w)));list.replaceChildren();count.textContent=matches.length+' matching '+(isTeam?'teams':'options')+(matches.length>limit?' · type to narrow the list':'');for(const o of matches.slice(0,limit)){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.dataset.value=o.value;b.setAttribute('aria-selected',String(o.value===s.value));b.disabled=o.disabled;if(o.logo){const img=document.createElement('img');img.src=o.logo;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();b.append(img);}const text=document.createElement('span');text.textContent=o.label;b.append(text);if(o.value===s.value){const tick=document.createElement('i');tick.textContent='✓';tick.setAttribute('aria-hidden','true');b.append(tick);}b.onclick=()=>choose(o);list.append(b);}if(matches.length>limit){const more=document.createElement('button');more.type='button';more.className='es-option-more';more.textContent='Show more';more.onclick=()=>{limit+=80;paint();};list.append(more);}if(!matches.length)list.textContent='No matches.';}
 function keys(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}const buttons=[...list.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus();}else if(e.key==='Enter'&&e.target===input){e.preventDefault();buttons[0]?.click();}else if(e.key==='Tab'){close();}}
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keys,true);window.addEventListener('resize',position);input.oninput=()=>{limit=80;paint();};input.value=initial;position();paint();input.focus();
}
function open(s,initial=''){
 if(s.closest('.liveScouting,#sxStart'))return openCompact(s,initial);
 if(current)current.close();
 const restore=document.activeElement,overlay=document.createElement('div');overlay.className='es-option-overlay';
 const title=s.getAttribute('aria-label')||document.querySelector('label[for="'+CSS.escape(s.id)+'"]')?.textContent||s.closest('label')?.childNodes[0]?.textContent||s.options[0]?.textContent||'Choose an option';
 overlay.innerHTML='<section class="es-option-dialog" role="dialog" aria-modal="true" aria-label="Search options"><header><strong></strong><button type="button" aria-label="Close options">×</button></header><input type="search" aria-label="Search options" placeholder="Type any part of a name…" autocomplete="off"><small aria-live="polite"></small><div class="es-option-results"></div></section>';
 overlay.querySelector('strong').textContent=title.trim();document.body.appendChild(overlay);
 const input=overlay.querySelector('input'),list=overlay.querySelector('.es-option-results'),count=overlay.querySelector('small');
 const close=()=>{overlay.remove();document.removeEventListener('keydown',keys,true);current=null;if(restore?.isConnected)restore.focus();};current={close};
 let clubs=[];if(/team|club|roster/i.test(s.id)){try{clubs=allClubs();}catch{}}
 const opts=Array.from(s.options).filter(o=>!o.hidden).map(o=>{const club=clubs.find(c=>c.key===o.value||normalize(o.textContent).includes(normalize(c.name)));return {value:o.value,label:leagueLabel(o),logo:club?clubLogo(club):null,disabled:o.disabled,search:normalize([leagueLabel(o),o.textContent,club?.city,club?.country,...(club?.teams||[]).flatMap(t=>[t.name,t.city,...(t.searchAliases||[])])].filter(Boolean).join(' '))};});
 function paint(){const words=normalize(input.value).trim().split(/\s+/).filter(Boolean),matches=opts.filter(o=>words.every(w=>o.search.includes(w)));list.replaceChildren();count.textContent=matches.length+' matching options';for(const o of matches){const b=document.createElement('button');b.type='button';b.textContent=o.label;if(o.logo){const img=document.createElement('img');img.src=o.logo;img.alt='';img.style.cssText='width:24px;height:24px;object-fit:contain;margin-right:10px;vertical-align:middle';img.onerror=()=>img.remove();b.prepend(img);}b.disabled=o.disabled;b.setAttribute('aria-pressed',String(o.value===s.value));b.onclick=()=>{if(!s.isConnected){close();return;}s.value=o.value;close();s.dispatchEvent(new Event('change',{bubbles:true}));};list.appendChild(b);}if(!matches.length)list.textContent='No matches. Try another part of the name.';}
 function keys(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='ArrowDown'&&e.target===input){e.preventDefault();list.querySelector('button:not(:disabled)')?.focus();}else if(e.key==='Enter'&&e.target===input){e.preventDefault();list.querySelector('button:not(:disabled)')?.click();}else if(e.key==='Tab'){const els=[...overlay.querySelectorAll('button:not(:disabled),input')],first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 overlay.querySelector('header button').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};document.addEventListener('keydown',keys,true);input.oninput=paint;input.value=initial;paint();input.focus();
}
document.addEventListener('pointerdown',e=>{if(eligible(e.target)){e.preventDefault();open(e.target);}},true);
document.addEventListener('click',e=>{if(eligible(e.target)){e.preventDefault();if(!current)open(e.target);}},true);
document.addEventListener('keydown',e=>{if(eligible(e.target)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key==='Enter'||e.key===' '||e.key==='ArrowDown'||e.key.length===1)){e.preventDefault();open(e.target,e.key.length===1&&e.key!==' '?e.key:'');}},true);
window.EuroScoutOptionSearch={open,normalize};
})();

