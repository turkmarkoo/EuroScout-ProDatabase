/* Shared DragonHub team selection workspace.
   Competition -> team is the canonical flow; only one competition's teams are
   rendered at a time so large club registries never become a giant picker. */
(function(){
'use strict';
const RECENT_KEY='dragonhub.recentMatchupCompetitions.v1';
const fold=value=>String(value||'').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const safe=value=>typeof esc==='function'?esc(value):String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=value=>typeof escAttr==='function'?escAttr(value):safe(value);
const initialsOf=value=>typeof initials==='function'?initials(value):String(value||'').split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase();
const flag=country=>typeof flagEmoji==='function'?flagEmoji(country):'';
function recent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]').filter(Boolean).slice(0,4);}catch(_){return[];}}
function remember(id){const ids=[id,...recent().filter(x=>x!==id)].slice(0,4);try{localStorage.setItem(RECENT_KEY,JSON.stringify(ids));}catch(_){}}
function category(meta){const text=fold([meta.id,meta.name,meta.tier].join(' '));if(/u1[246890]|u20|youth|junior|next gen|eybl|angt|nbl/.test(text))return'youth';if(/fiba|national|eurobasket|world cup/.test(text))return'national';if(/club|euroleague|eurocup|champions|aba|bbl|acb|bsl|lba|league|liga|ncaa|nba/.test(text))return'club';return'other';}
function region(meta,teams){if(meta.region)return meta.region;if(meta.country)return meta.country;const countries=[...new Set(teams.map(c=>c.country).filter(Boolean))];return countries.length===1?countries[0]:'International';}
function competitionLogo(comp){
 const registry=window.DragonHubAssetRegistry||window.BrandAssetsRegistry;
 let asset=null;try{asset=registry?.getAsset?.(comp.id)||registry?.get?.(comp.id);}catch(_){}
 const url=asset?.lightLogo||asset?.logoLight||asset?.logo||comp.logo;
 if(url)return'<span class="tsw-comp-logo"><img src="'+attr(url)+'" alt=""></span>';
 return'<span class="tsw-comp-logo tsw-logo-fallback" aria-label="'+attr(comp.name)+'">'+safe(initialsOf(comp.name))+'</span>';
}
function clubLogo(club){if(typeof clubBadge==='function')return clubBadge(club,38);return'<span class="tsw-club-logo">'+safe(initialsOf(club.name))+'</span>';}
function currentCompetitionIds(club){const ids=[];try{if(typeof nextCompsOf==='function')ids.push(...nextCompsOf(club).map(c=>c.id));if(typeof domCompsOf==='function')ids.push(...domCompsOf(club).map(c=>c.id));}catch(_){}return[...new Set(ids.filter(Boolean))];}
function buildCompetitions(){
 if(typeof allClubs!=='function')return[];
 const clubs=allClubs(),defs=new Map(),data=window.STATE?.data||{};
 for(const L of data.leagues||[])if(typeof showsTeams!=='function'||showsTeams(L.meta))defs.set(L.meta.id,{...L.meta});
 /* Authenticated payloads may retain registry clubs without the original
    league collection, so club memberships are a second competition source. */
 for(const club of clubs)for(const league of club.leagues||[]){if(!league?.id)continue;const old=defs.get(league.id)||{};defs.set(league.id,{...old,id:league.id,name:league.name||old.name||league.id});}
 const addCurrent=source=>Object.entries(source||{}).forEach(([id,value])=>{const old=defs.get(id)||{};defs.set(id,{...old,id,name:value.name||old.name||id,_teamKeys:(value.teams||[]).map(t=>t.key).filter(Boolean)});});
 addCurrent(data.season2627?.comps);addCurrent(data.domestic2627?.leagues);
 return[...defs.values()].map(meta=>{
   const keyed=(meta._teamKeys||[]).map(key=>typeof clubByKey==='function'?clubByKey(key):null).filter(Boolean),uniqueKeyed=[...new Map(keyed.map(c=>[c.key,c])).values()];
   const current=clubs.filter(c=>currentCompetitionIds(c).includes(meta.id));
   const teams=uniqueKeyed.length?uniqueKeyed:current.length?current:clubs.filter(c=>(c.leagues||[]).some(x=>x.id===meta.id));
   return{id:meta.id,name:meta.name,region:region(meta,teams),category:category(meta),logo:meta.logo||'',teams};
 }).filter(c=>c.teams.length).sort((a,b)=>a.name.localeCompare(b.name));
}
function open(options={}){
 close();
 const competitions=buildCompetitions();
 const current=typeof clubByKey==='function'?clubByKey(options.currentKey):null,currentIds=current?currentCompetitionIds(current):[];
 let selectedComp=current?competitions.find(c=>currentIds.includes(c.id))||competitions.find(c=>(current.leagues||[]).some(l=>l.id===c.id)):null;
 let selectedTeam=current&&selectedComp?current:null,cat='all',compQuery='',teamQuery='';
 const mask=document.createElement('div');mask.className='tsw-mask';mask.id='teamSelectionWorkspace';
 mask.innerHTML='<section class="tsw-dialog" role="dialog" aria-modal="true" aria-labelledby="tswTitle">'+
  '<header><span class="tsw-head-icon" aria-hidden="true">♟</span><div><h2 id="tswTitle">Select Team '+safe(String(options.slot||'').toUpperCase())+'</h2><p>Choose a competition and team for your scouting matchup.</p></div><button type="button" class="tsw-close" aria-label="Close">×</button></header>'+
  '<div class="tsw-grid"><section class="tsw-panel tsw-competitions"><h3>1. Select Competition</h3><label class="tsw-search"><span>⌕</span><input type="search" id="tswCompSearch" placeholder="Search competitions or teams…" autocomplete="off"></label><div class="tsw-cats" role="group" aria-label="Competition categories">'+[['all','All'],['youth','Youth'],['national','National'],['club','Club'],['other','Other']].map(([id,label])=>'<button type="button" data-cat="'+id+'" class="'+(id==='all'?'on':'')+'">'+label+'</button>').join('')+'</div><div id="tswRecent"></div><div class="tsw-list" id="tswCompetitionList"></div></section>'+
  '<section class="tsw-panel tsw-teams"><h3>2. Select Team</h3><label class="tsw-search"><span>⌕</span><input type="search" id="tswTeamSearch" placeholder="Search teams in selected competition…" autocomplete="off" disabled></label><div class="tsw-team-context" id="tswTeamContext"></div><div class="tsw-list" id="tswTeamList"></div></section></div>'+
  '<footer><div class="tsw-selected"><small>Selected:</small><div id="tswSelectedCompetition"></div><i></i><div id="tswSelectedTeam"></div></div><button type="button" class="btn ghost tsw-cancel">Cancel</button><button type="button" class="btn primary tsw-confirm" disabled>Confirm Selection →</button></footer></section>';
 document.body.append(mask);
 const $=selector=>mask.querySelector(selector),compList=$('#tswCompetitionList'),teamList=$('#tswTeamList'),teamInput=$('#tswTeamSearch');
 function matchingCompetitions(){return competitions.filter(c=>(cat==='all'||c.category===cat)&&(!compQuery||fold(c.name+' '+c.region).includes(compQuery)||c.teams.some(t=>fold(t.name).includes(compQuery))));}
 function competitionRow(c){return'<button type="button" class="tsw-row tsw-comp-row'+(selectedComp?.id===c.id?' on':'')+'" data-comp="'+attr(c.id)+'">'+competitionLogo(c)+'<span><b>'+safe(c.name)+'</b><small>'+safe(c.region)+'</small></span><em>'+c.teams.length+' teams</em><strong>›</strong></button>';}
 function teamRow(c){return'<button type="button" class="tsw-row tsw-team-row'+(selectedTeam?.key===c.key?' on':'')+'" data-team="'+attr(c.key)+'">'+clubLogo(c)+'<span><b>'+safe(c.name)+'</b></span><em>'+safe(flag(c.country))+' '+safe(c.country||'—')+'</em><strong>›</strong></button>';}
 function renderRecent(){const items=recent().map(id=>competitions.find(c=>c.id===id)).filter(Boolean);$('#tswRecent').innerHTML=items.length?'<div class="tsw-recent"><div><b>◷ &nbsp;Recent Competitions</b><button type="button" id="tswClearRecent">Clear</button></div><nav>'+items.map(c=>'<button type="button" data-recent="'+attr(c.id)+'">'+competitionLogo(c)+safe(c.name)+'</button>').join('')+'</nav></div>':'';$('#tswClearRecent')?.addEventListener('click',()=>{localStorage.removeItem(RECENT_KEY);renderRecent();});mask.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>selectCompetition(competitions.find(c=>c.id===b.dataset.recent)));}
 function renderCompetitions(){const rows=matchingCompetitions();compList.innerHTML=rows.map(competitionRow).join('')||'<div class="tsw-empty">No competitions found.</div>';compList.querySelectorAll('[data-comp]').forEach(b=>b.onclick=()=>selectCompetition(competitions.find(c=>c.id===b.dataset.comp)));}
 function renderTeams(){
  teamInput.disabled=!selectedComp;teamInput.placeholder=selectedComp?'Search teams in '+selectedComp.name+'…':'Select a competition first';
  if(!selectedComp){$('#tswTeamContext').innerHTML='';teamList.innerHTML='<div class="tsw-empty">Select a competition to see its teams.</div>';return;}
  $('#tswTeamContext').innerHTML=competitionLogo(selectedComp)+'<span><b>'+safe(selectedComp.name)+'</b><small>'+safe(selectedComp.region)+'</small></span><em>'+selectedComp.teams.length+' teams</em>';
  const teams=selectedComp.teams.filter(c=>!teamQuery||fold(c.name+' '+c.country).includes(teamQuery));teamList.innerHTML=teams.map(teamRow).join('')||'<div class="tsw-empty">No teams found in this competition.</div>';teamList.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{selectedTeam=selectedComp.teams.find(c=>c.key===b.dataset.team);renderTeams();renderSummary();});
 }
 function selectCompetition(comp,team){if(!comp)return;selectedComp=comp;selectedTeam=team&&comp.teams.some(c=>c.key===team.key)?team:null;teamQuery='';teamInput.value='';renderCompetitions();renderTeams();renderSummary();}
 function renderSummary(){
  $('#tswSelectedCompetition').innerHTML=selectedComp?competitionLogo(selectedComp)+'<span><b>'+safe(selectedComp.name)+'</b><small>'+safe(selectedComp.region)+' · '+selectedComp.teams.length+' teams</small></span>':'<span><b>Competition</b><small>Not selected</small></span>';
  $('#tswSelectedTeam').innerHTML=selectedTeam?clubLogo(selectedTeam)+'<span><b>'+safe(selectedTeam.name)+'</b><small>'+safe(flag(selectedTeam.country))+' '+safe(selectedTeam.country||'')+'</small></span>':'<span><b>Team</b><small>Not selected</small></span>';
  $('.tsw-confirm').disabled=!(selectedComp&&selectedTeam);
 }
 let searchTimer=null;
 $('#tswCompSearch').oninput=e=>{compQuery=fold(e.target.value.trim());clearTimeout(searchTimer);searchTimer=setTimeout(()=>{
   const matches=matchingCompetitions();renderCompetitions();
   if(compQuery){const teamHits=[];for(const comp of matches)for(const team of comp.teams)if(fold(team.name).includes(compQuery))teamHits.push({comp,team});const uniqueTeams=new Map(teamHits.map(hit=>[hit.team.key,hit]));if(uniqueTeams.size===1){const only=[...uniqueTeams.values()][0],preferred=teamHits.find(hit=>hit.team.key===only.team.key&&hit.comp.id===selectedComp?.id)||only;selectCompetition(preferred.comp,preferred.team);}else if(teamHits[0]&&fold(teamHits[0].team.name)===compQuery)selectCompetition(teamHits[0].comp,teamHits[0].team);}
  },100);};
 teamInput.oninput=e=>{teamQuery=fold(e.target.value.trim());renderTeams();};
 mask.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;mask.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('on',x===b));renderCompetitions();});
 function done(){if(!(selectedComp&&selectedTeam))return;remember(selectedComp.id);options.onConfirm?.({competition:selectedComp,team:selectedTeam});close();}
 $('.tsw-confirm').onclick=done;$('.tsw-cancel').onclick=close;$('.tsw-close').onclick=close;mask.onclick=e=>{if(e.target===mask)close();};
 mask.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Enter'&&document.activeElement?.closest('.tsw-search')&&selectedComp&&selectedTeam){e.preventDefault();done();}};
 renderRecent();renderCompetitions();renderTeams();renderSummary();setTimeout(()=>$('#tswCompSearch').focus(),0);
}
function close(){document.querySelector('#teamSelectionWorkspace')?.remove();}
window.ESTeamSelection={open,close};
})();
