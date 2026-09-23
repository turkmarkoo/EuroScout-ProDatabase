/* Native EuroScout database for NBA, G League, Summer League and NCAA Division I. */
(function(){
  'use strict';
  const ORDER=['nba','gleague','sl','ncaam'];
  const LABELS={nba:['NBA','National Basketball Association'],gleague:['NBA G League','NBA development league'],sl:['NBA Summer League','Summer competition'],ncaam:['NCAA Division I','College basketball']};
  const LOGOS={
    nba:'assets/competitions/nba.svg',
    gleague:'assets/competitions/nba-g-league.png',
    sl:'assets/competitions/nba-summer-league.png',
    ncaam:'assets/competitions/ncaa.png'
  };
  const SOURCE={nba:['NBA.com','https://www.nba.com/stats/players/traditional'],gleague:['NBA G League','https://gleague.nba.com/stats/'],sl:['NBA.com Summer League','https://www.nba.com/summer-league'],ncaam:['NCAA / official school rosters','https://www.ncaa.com/sports/basketball-men/d1']};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=html;
  const fmt=(value,digits=1)=>value==null||value===''?'—':Number.isFinite(Number(value))?Number(value).toFixed(digits):html(value);
  const state=()=>STATE.otherV2||(STATE.otherV2={league:'nba',q:'',position:'',team:'',country:'',draft:'',mode:'pg',page:1,pageSize:25,sort:'ppg',dir:-1,more:false});
  let loading=false,teamCache=null;

  function leagues(){
    const found=new Map(otherLeagues().filter(L=>ORDER.includes(L.meta.id)).map(L=>[L.meta.id,L]));
    return ORDER.map(id=>found.get(id)).filter(Boolean);
  }
  function logo(id,cls='ol-logo'){return `<span class="${cls} ol-logo-${id}"><img src="${attr(LOGOS[id]||'')}" alt="" loading="lazy" onerror="this.parentNode.textContent='${html((LABELS[id]?.[0]||id).slice(0,2).toUpperCase())}'"></span>`;}
  function rosterInfo(p,L){return L.meta.id==='ncaam'?window.EuroScoutNCAA?.info(p,'2026-27'):null;}
  function visiblePlayers(L){
    if(L.meta.id==='nba'&&L.meta.rosterSeason==='2026-27')return L.players.filter(p=>p._nbaCurrent);
    if(L.meta.id==='ncaam'){const seen=new Set(),players=[];for(const p of L.players){if(!rosterInfo(p,L))continue;const key=p._ncaa?.espnId||p.id;if(seen.has(key))continue;seen.add(key);players.push(p);}return players;}
    if(L.meta.rosterStatus==='pending')return [];
    return L.players;
  }
  function playerTeam(p,L){return rosterInfo(p,L)?.team||p.teamName||p.team||'';}
  function qualifiedCount(L,players=visiblePlayers(L)){return players.filter(p=>p.qualified).length;}
  function teamCount(L,players=visiblePlayers(L)){return new Set(players.map(p=>playerTeam(p,L)).filter(Boolean)).size;}
  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function allTeamMap(){
    if(teamCache)return teamCache;
    teamCache=new Map();
    try{allClubs().forEach(c=>{teamCache.set(normalize(c.name),c);(c.teams||[]).forEach(t=>teamCache.set(normalize(t.name||t.teamName),c));});}catch{}
    return teamCache;
  }
  function teamLogo(p,L){
    const team=allTeamMap().get(normalize(p.teamName));
    if(team){const src=clubLogo(team);if(src)return src;}
    const entry=(L.teams||[]).find(t=>normalize(t.name||t.teamName)===normalize(p.teamName));
    if(entry?.logo)return entry.logo;
    if(L.meta.id==='nba'&&/^161061\d+$/.test(String(entry?.code||'')))return `https://cdn.nba.com/logos/nba/${entry.code}/global/L/logo.svg`;
    if(L.meta.id==='gleague'&&/^16127\d+$/.test(String(entry?.code||'')))return `https://cdn.nba.com/logos/gleague/${entry.code}/primary/L/logo.svg`;
    return '';
  }
  function playerPhoto(p){return photoOf(p)||'';}
  function stat(p,key,mode){
    if(mode==='totals'&&['ppg','rpg','apg','spg','bpg'].includes(key))return Number(p[key]||0)*Number(p.g||0);
    return p[key];
  }
  function columns(mode){
    if(mode==='advanced')return [['g','GP',0],['ts','TS%',1],['efg','eFG%',1],['usg','USG%',1],['pts40','PTS/40',1],['reb40','REB/40',1],['ast40','AST/40',1],['ftr','FTr',2],['netrtg','NET',1]];
    return [['g','GP',0],['ppg','PPG',1],['rpg','RPG',1],['apg','APG',1],['spg','SPG',1],['bpg','BPG',1],['fgp','FG%',1],['f3p','3PT%',1],['ftp','FT%',1]];
  }
  function currentSeason(L){return String(L.meta.rosterSeason||L.meta.season||'2026/27').replace('-','/');}
  function statsSeason(L){return String(L.meta.statsSeason||L.meta.season||'').replace('-','/');}
  function lastUpdate(L){try{const raw=L?.meta?.rosterUpdatedAt||(typeof dataBuildDate==='function'?dataBuildDate():'');if(!raw)return 'Current import';const date=new Date(raw);if(Number.isNaN(date.getTime()))return raw;const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Ljubljana'}).format(date);const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Ljubljana'}).format(date);return `${day} · ${time}`;}catch{return 'Current import';}}

  function render(){
    if(!STATE._extraDone){
      $('#app').innerHTML='<div class="view ol-page"><h1>Other Leagues</h1><p>Loading NBA, G League, Summer League and NCAA Division I…</p><div class="ol-loading">Preparing player database</div></div>';
      if(!loading){loading=true;loadExtraLeagues().then(()=>{loading=false;teamCache=null;if(STATE.view==='exhib')render();}).catch(error=>{loading=false;toast(error.message);render();});}
      return;
    }
    const list=leagues(),st=state();if(!list.length){$('#app').innerHTML='<div class="view"><h1>Other Leagues</h1><div class="empty">League data is unavailable.</div></div>';return;}
    if(!list.some(L=>L.meta.id===st.league))st.league=list[0].meta.id;
    const L=list.find(x=>x.meta.id===st.league),id=L.meta.id;
    const roster=visiblePlayers(L);
    let pool=roster.slice();
    if(st.q){const q=normalize(st.q);pool=pool.filter(p=>normalize([p.name,p.teamName,p.country].join(' ')).includes(q));}
    if(st.position)pool=pool.filter(p=>posLabel(p)===st.position);
    if(st.team)pool=pool.filter(p=>playerTeam(p,L)===st.team);
    if(st.country)pool=pool.filter(p=>(p.country||'')===st.country);
    if(st.draft)pool=pool.filter(p=>String(p._draftYr||'')===st.draft);
    const cols=columns(st.mode),value=(p,key)=>Number(stat(p,key,st.mode));
    pool.sort((a,b)=>{if(st.sort==='name')return a.name.localeCompare(b.name)*st.dir;const av=value(a,st.sort),bv=value(b,st.sort);return ((Number.isFinite(bv)?bv:-Infinity)-(Number.isFinite(av)?av:-Infinity))*-st.dir;});
    const pages=Math.max(1,Math.ceil(pool.length/st.pageSize));st.page=Math.min(st.page,pages);const start=(st.page-1)*st.pageSize,shown=pool.slice(start,start+st.pageSize);
    const teams=[...new Set(roster.map(p=>playerTeam(p,L)).filter(Boolean))].sort();
    const countries=[...new Set(roster.map(p=>p.country).filter(Boolean))].sort((a,b)=>(countryLabel(a)||a).localeCompare(countryLabel(b)||b));
    const drafts=[...new Set(roster.map(p=>p._draftYr).filter(Boolean))].sort((a,b)=>b-a);
    const tabs=list.map(item=>{const count=visiblePlayers(item).length;const note=item.meta.rosterStatus==='pending'?'2026/27 roster pending':`${count.toLocaleString()} players`;return `<button class="ol-league-card${item.meta.id===id?' active':''}" data-league="${item.meta.id}">${logo(item.meta.id)}<span><b>${html(LABELS[item.meta.id]?.[0]||item.meta.name)}</b><small>${html(note)}</small></span></button>`;}).join('');
    const rows=shown.map((p,index)=>{const photo=playerPhoto(p),teamName=playerTeam(p,L),teamLogoSrc=teamLogo({...p,teamName},L);return `<tr data-player="${attr(p.id)}">
      <td class="ol-rank">${start+index+1}</td><td class="ol-player"><span class="ol-avatar">${photo?`<img src="${attr(photo)}" alt="" loading="lazy" onerror="this.remove()">`:html(initials(p.name))}</span><strong>${html(p.name)}</strong></td>
      <td>${html(posLabel(p)||'—')}</td><td>${p.height?html(p.height)+' cm':'—'}</td><td>${p.weight?html(p.weight)+' kg':'—'}</td><td>${p.age??'—'}</td>
      <td>${html(countryLabel(p.country)||p.country||'—')}</td><td class="ol-team">${teamLogoSrc?`<img src="${attr(teamLogoSrc)}" alt="" loading="lazy" onerror="this.remove()">`:''}<span>${html(teamName||'—')}</span></td>
      ${cols.map(([key,,digits])=>`<td class="num">${fmt(stat(p,key,st.mode),digits)}</td>`).join('')}
      <td class="ol-profile-cell"><button class="ol-profile" data-open="${attr(p.id)}">Profile →</button></td></tr>`;}).join('');
    const pagesHtml=pageButtons(st.page,pages);
    $('#app').innerHTML=`<div class="view ol-page">
      <div class="ol-breadcrumb">⌂ &nbsp; Other Leagues &nbsp;›&nbsp; <b>${html(LABELS[id]?.[0]||L.meta.name)}</b></div>
      <div class="ol-leagues">${tabs}</div>
      <section class="ol-summary">${logo(id,'ol-summary-logo')}<div class="ol-summary-name"><h2>${html(LABELS[id]?.[0]||L.meta.name)}</h2><p>${html(LABELS[id]?.[1]||L.meta.tier||'')}</p></div>
        <dl><div><dt>Roster season</dt><dd>${html(currentSeason(L))}</dd></div><div><dt>Players</dt><dd>${roster.length.toLocaleString()}</dd></div><div><dt>Teams</dt><dd>${teamCount(L,roster)}</dd></div><div><dt>Stats season</dt><dd>${html(statsSeason(L)||'—')}</dd></div><div><dt>Last update</dt><dd>${html(lastUpdate(L))}</dd></div></dl>
        <span class="ol-imported${L.meta.rosterStatus==='pending'?' pending':''}">● ${L.meta.rosterStatus==='pending'?'Roster pending':'Roster imported'}</span></section>
      <section class="ol-database"><div class="ol-filters"><label class="ol-search">⌕<input id="olSearch" placeholder="Search players…" value="${attr(st.q)}"></label>
        ${select('olPosition','All positions',['Guard','Forward','Big'],st.position)}${select('olTeam','All teams',teams,st.team)}${select('olCountry','All countries',countries,st.country,c=>countryLabel(c)||c)}${select('olDraft','All draft years',drafts.map(String),st.draft)}
        <div class="ol-mode">${[['pg','Per game'],['totals','Totals'],['advanced','Advanced']].map(([key,label])=>`<button data-mode="${key}" class="${st.mode===key?'active':''}">${label}</button>`).join('')}</div><button class="ol-more" id="olMore">☷ More filters</button></div>
        ${st.more?'<div class="ol-more-panel">Only the four supported league databases are included. Draft year is shown when supplied by the official feed.</div>':''}
        <div class="ol-season-context">${html(currentSeason(L))} roster · ${L.meta.rosterStatus==='pending'?'The official roster has not been published yet.':`${html(statsSeason(L))} statistics`}</div>
        <div class="ol-table-wrap"><table class="ol-table"><thead><tr><th>#</th><th data-sort="name">Player</th><th>Pos</th><th>Ht</th><th>Wt</th><th>Age</th><th>Nationality</th><th>Current team</th>${cols.map(([key,label])=>`<th class="num" data-sort="${key}">${label}${st.sort===key?(st.dir<0?' ↓':' ↑'):''}</th>`).join('')}<th>Profile</th></tr></thead><tbody>${rows||`<tr><td colspan="21" class="empty">${html(L.meta.rosterStatus==='pending'?'The official 2026/27 roster has not been published yet.':'No players match these filters.')}</td></tr>`}</tbody></table></div>
        <div class="ol-pagination"><span>Showing ${pool.length?start+1:0}–${Math.min(start+st.pageSize,pool.length)} of ${pool.length.toLocaleString()} players</span><div>${pagesHtml}</div><label>Show ${select('olPageSize','', ['10','25','50','100'],String(st.pageSize))} per page</label></div>
      </section>
      <footer class="ol-source"><span>● Data source: <a href="${attr(SOURCE[id][1])}" target="_blank" rel="noopener">${html(SOURCE[id][0])}</a> · Last updated: ${html(lastUpdate(L))}</span><span>Rosters and statistics are imported from official league and school sources.</span></footer>
    </div>`;
    wire(L,pages);
  }

  function select(id,label,values,current,display=x=>x){return `<select id="${id}">${label?`<option value="">${html(label)}</option>`:''}${values.map(v=>`<option value="${attr(v)}"${String(current)===String(v)?' selected':''}>${html(display(v))}</option>`).join('')}</select>`;}
  function pageButtons(page,pages){const values=[1,page-2,page-1,page,page+1,page+2,pages].filter(x=>x>=1&&x<=pages);return [...new Set(values)].map((p,i,a)=>`${i&&p-a[i-1]>1?'<span>…</span>':''}<button data-page="${p}" class="${p===page?'active':''}">${p}</button>`).join('');}
  function wire(L,pages){
    const st=state();
    $$('[data-league]').forEach(b=>b.onclick=()=>{st.league=b.dataset.league;st.page=1;st.q='';st.position='';st.team='';st.country='';st.draft='';render();});
    let timer;$('#olSearch').oninput=e=>{st.q=e.target.value;st.page=1;clearTimeout(timer);timer=setTimeout(render,160);};
    for(const [id,key] of [['olPosition','position'],['olTeam','team'],['olCountry','country'],['olDraft','draft']])$('#'+id).onchange=e=>{st[key]=e.target.value;st.page=1;render();};
    $$('[data-mode]').forEach(b=>b.onclick=()=>{st.mode=b.dataset.mode;st.page=1;render();});
    $$('[data-sort]').forEach(h=>h.onclick=()=>{const key=h.dataset.sort;if(st.sort===key)st.dir*=-1;else{st.sort=key;st.dir=-1;}render();});
    $$('[data-page]').forEach(b=>b.onclick=()=>{st.page=Number(b.dataset.page);render();$('#app').scrollIntoView({behavior:'smooth'});});
    $('#olPageSize').onchange=e=>{st.pageSize=Number(e.target.value);st.page=1;render();};
    $('#olMore').onclick=()=>{st.more=!st.more;render();};
    $$('[data-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();openProfile(b.dataset.open);});
    $$('.ol-table tbody tr[data-player]').forEach(row=>row.onclick=()=>openProfile(row.dataset.player));
  }
  window.EuroScoutOtherLeagues={render,reset(){teamCache=null;}};
})();
