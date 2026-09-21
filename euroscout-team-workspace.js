(function () {
  'use strict';
  const WATCH_KEY = 'euroscout:watched-clubs:v1';
  const watchedClubs = () => { try { return new Set(JSON.parse(localStorage.getItem(WATCH_KEY) || '[]')); } catch (_) { return new Set(); } };
  const saveWatched = set => { try { localStorage.setItem(WATCH_KEY,JSON.stringify([...set])); try { Sync.stampKey(WATCH_KEY); Store.pushAppKey(WATCH_KEY); } catch (_) {} } catch (_) { toast('Could not save the club watchlist.'); } };
  const N = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const F = (value, digits=1) => N(value) == null ? '—' : Number(value).toFixed(digits);
  const pct = value => N(value) == null ? '—' : F(value) + '%';
  const photo = p => photoOf(p) || p.img || '';
  const basic = TEAM_CARDS.slice(0,15);
  const advanced = TEAM_CARDS_ADV;
  const icons = {ppg:'▥',oppg:'▥',net:'↔',rpg:'◉',apg:'◈',spg:'♙',bpg:'▢',tpg:'◷',pirg:'✣',fgp:'◔',f2p:'◯',f3p:'◉',ftp:'◡',f3apg:'⌁',ftapg:'⌄',pace:'◷',ortg:'↗',drtg:'↘',efg:'◉',ts:'◎'};
  const metricValue = (k,v) => N(v) == null ? '—' : ((k==='net'||k==='orebdiff') && v>0?'+':'') + F(v) + (['fgp','f2p','f3p','ftp','efg','ts','astpct','tovpct','f3ar','ftr','oppfgp','oppf3p','oppefg'].includes(k)?'%':'');
  const clubKey = (L,t) => clubForTeamKey(L.meta.id+'|'+t.code)?.key || L.meta.id+'|'+t.code;
  const getTeam = () => { const L=STATE.league; return {L,t:L&&L.teams.find(x=>x.code===CURRENT_TEAM)}; };
  const rankRows = (L,k,hi) => L.teams.map(t=>({t,value:N((teamAgg(L)[t.code]||{})[k])})).filter(x=>x.value!=null).sort((a,b)=>(hi?b.value-a.value:a.value-b.value)||a.t.name.localeCompare(b.t.name));
  const standingRows = (L,t) => L.teams.filter(x=>!x.newFor2627 && (x.group||'')===(t.group||'')).slice().sort((a,b)=>(N(a.rank)??999)-(N(b.rank)??999)||(N(b.winPct)??0)-(N(a.winPct)??0));
  const teamBadge = t => {const src=t.logo||dbTeamByKey(t.lg+'|'+t.code)?.logo||'';return src?`<img src="${escAttr(src)}" alt="" loading="lazy" onerror="this.remove()">`:`<span>${esc(initials(t.name))}</span>`;};
  const currentClub = (L,t) => clubForTeamKey(L.meta.id+'|'+t.code) || clubByKey(clubKey(L,t));

  window.renderTeamScoutingV2 = function renderTeamScoutingV2() {
    const {L,t}=getTeam(); if(!L||!t){STATE.view='teams';render();return;}
    const group=teamGroup(L.meta.id,t.code);
    const roster=L.players.filter(p=>p.team===t.code||(t.name&&p.teamName===t.name)||(t.teamName&&p.teamName===t.teamName))
      .sort((a,b)=>(N(a.jersey)??999)-(N(b.jersey)??999)||(N(b.ppg)??0)-(N(a.ppg)??0));
    const agg=teamAgg(L)[t.code]||{};
    const mode=STATE.tswMode||'basic', view=STATE.tswRosterView||'grid';
    const standings=standingRows(L,t), rank=standings.findIndex(x=>x.code===t.code)+1;
    const wins=N(t.w),losses=N(t.l),winPercent=wins!=null&&losses!=null&&wins+losses>0?wins/(wins+losses)*100:null;
    const ckey=clubKey(L,t), watching=watchedClubs().has(ckey);
    const country=t.country?countryLabel(t.country)||t.country:'', city=t.city||'';
    const logo=t.logo||dbTeamByKey(L.meta.id+'|'+t.code)?.logo||'';
    const cards=(mode==='adv'?advanced:basic).map(([k,label,hi])=>{
      const val=N(agg[k]); if(val==null)return '';
      const rows=rankRows(L,k,hi),place=rows.findIndex(x=>x.t.code===t.code)+1;
      return `<button class="tswStat" type="button" data-stat="${k}" aria-label="View ${escAttr(label)} league ranking"><span class="tswStatIcon">${icons[k]||'◈'}</span><span class="tswStatContent"><strong>${metricValue(k,val)}</strong><small>${esc(label)}</small><em>${place?ordinal(place):'—'} / ${rows.length}</em></span></button>`;
    }).join('');
    const teamRow=(x,i)=>{const w=N(x.w),l=N(x.l),percentage=w!=null&&l!=null&&w+l?F(w/(w+l),3).replace(/^0/,''): '—';
      return `<tr data-team="${escAttr(x.code)}" tabindex="0" class="${x.code===t.code?'current':''}"><td>${N(x.rank)??i+1}</td><td><span class="tswStandTeam">${teamBadge({...x,lg:L.meta.id})}${esc(x.name)}</span></td><td>${w??'—'}</td><td>${l??'—'}</td><td>${percentage}</td></tr>`;};
    const card=p=>{const src=photo(p);const born=p.born?String(p.born).slice(0,4):'—';const height=N(p.height)?(N(p.height)/100).toFixed(2)+' m':'—';const jersey=p.jersey===0||p.jersey==='0'?'0':p.jersey||'—';
      return `<article class="pcard tswPlayer" data-player="${escAttr(p.id)}" tabindex="0" role="button" aria-label="Open ${escAttr(p.name)} profile"><span class="pc-watch${isWatched(p)?' on':''}" data-star="${escAttr(p.id)}" role="button" tabindex="0" aria-label="${isWatched(p)?'Remove from':'Add to'} watchlist">${isWatched(p)?'★':'☆'}</span><div class="pc-top"><div class="pc-ava">${src?`<img src="${escAttr(src)}" alt="" loading="lazy" onerror="this.remove()">`:esc(initials(p.name))}</div><div class="pc-num">${esc(jersey)}</div><div class="pc-id"><div class="pc-name">${esc(p.name)}</div><div class="pc-meta">${esc(p.pos&&p.pos!=='-'?p.pos:p.role||'—')} · ${height} · '${esc(born.slice(-2))}</div></div></div><div class="pc-stats">${[['PPG',p.ppg],['RPG',p.rpg],['APG',p.apg],['PIR',p.pir]].map(([label,value])=>`<div class="s"><div class="v">${F(value)}</div><div class="k">${label}</div></div>`).join('')}</div></article>`;};
    $('#app').innerHTML=`<div class="view tswPage">
      <nav class="tswCrumb"><button type="button" id="tswBack">‹ &nbsp; Back to teams</button><span>›</span><b>${esc(t.name)}</b></nav>
      <section class="tswHero"><div class="tswLogo">${logo?`<img src="${escAttr(logo)}" alt="${escAttr(t.name)} logo" onerror="this.remove()">`:esc(initials(t.name))}</div><div class="tswIdentity"><div class="tswTitle"><h1>${esc(t.name)}</h1><button type="button" id="tswStar" aria-label="${watching?'Remove club from':'Add club to'} watchlist" aria-pressed="${watching}">${watching?'★':'☆'}</button></div><p>${t.country?flagEmoji(t.country)+' ':''}${esc(country)} <span>·</span> ${esc(L.meta.name)} <span>·</span> ${esc(L.meta.season||'—')}</p>${city?`<small>⌖ &nbsp;${esc(city)}${country?', '+esc(country):''}</small>`:''}</div><div class="tswControls"><div class="tswActions"><button class="btn ghost" id="tswCompare" type="button">⇄ &nbsp;Compare</button><button class="btn ghost" id="tswWatch" type="button">${watching?'★ Watching':'☆ Add to watchlist'}</button></div><div class="tswControlBottom"><label>Competition<select id="tswCompetition">${group.map(g=>`<option value="${escAttr(g.league+'|'+g.code)}"${g.league===L.meta.id&&g.code===t.code?' selected':''}>${esc(g.L.meta.name)} · ${esc(g.L.meta.season||'')}</option>`).join('')}</select></label><div class="tswRecord"><div><strong>${wins??'—'}-${losses??'—'}</strong><small>RECORD</small></div><div><strong>${pct(winPercent)}</strong><small>WIN %</small></div><div><strong>${rank||'—'}</strong><small>RANK</small></div></div></div></div></section>
      <main class="tswColumns"><div class="tswLeft"><section class="tswPanel"><div class="tswPanelTitle"><div><h2>Team averages · ${esc(L.meta.name)}</h2><p>Team rankings compared to all ${esc(L.meta.name)} teams (${esc(L.meta.season||'recorded season')}).</p></div><div class="tswSegment"><button type="button" data-mode="basic" class="${mode==='basic'?'active':''}">Basic</button><button type="button" data-mode="adv" class="${mode==='adv'?'active':''}">Advanced</button></div></div><div class="tswStats">${cards||'<p class="hint">Team statistics are not available for this competition.</p>'}</div></section>
      <section class="tswPanel tswRoster"><div class="tswPanelTitle"><div><h2>Roster · ${roster.length} players</h2><p>${esc(L.meta.name)} ${esc(L.meta.season||'')}</p></div><div class="tswSegment"><button type="button" data-roster-view="grid" class="${view==='grid'?'active':''}">▦ Grid</button><button type="button" data-roster-view="list" class="${view==='list'?'active':''}">☷ List</button></div></div><div class="rostergrid tswRosterGrid ${view==='list'?'list':''}">${roster.length?roster.map(card).join(''):'<p class="hint">No roster recorded for this competition.</p>'}</div></section></div>
      <aside class="tswPanel tswStandings"><div class="tswStandHead"><span class="tswLeagueMark">🏀</span><div><h2>${esc(L.meta.name)}</h2><p>Standings · ${esc(L.meta.season||'recorded season')}</p></div></div><table><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th></tr></thead><tbody>${standings.length?standings.map(teamRow).join(''):'<tr><td colspan="5">Standings are not available.</td></tr>'}</tbody></table><button type="button" class="btn ghost tswFullStandings" id="tswFullStandings">View full standings ↗</button></aside></main>
    </div>`;
    $('#tswBack').onclick=()=>{STATE.view='teams';render();};
    $('#tswCompetition').onchange=e=>{const [league,code]=e.target.value.split('|');openTeamIn(league,code);};
    const toggleClub=()=>{const set=watchedClubs();set.has(ckey)?set.delete(ckey):set.add(ckey);saveWatched(set);renderTeam();};
    $('#tswStar').onclick=toggleClub;$('#tswWatch').onclick=toggleClub;
    $('#tswCompare').onclick=()=>openCompare(L,t);
    $$('#app [data-mode]').forEach(b=>b.onclick=()=>{STATE.tswMode=b.dataset.mode;renderTeam();});
    $$('#app [data-roster-view]').forEach(b=>b.onclick=()=>{STATE.tswRosterView=b.dataset.rosterView;renderTeam();});
    $$('#app .tswStat').forEach(b=>b.onclick=()=>{const def=(mode==='adv'?advanced:basic).find(x=>x[0]===b.dataset.stat);if(def)openRanking(L,t,def);});
    $$('#app .tswPlayer').forEach(card=>{card.onclick=e=>{if(e.target.closest('[data-star]'))return;openProfile(card.dataset.player);};card.onkeydown=e=>{if(e.key==='Enter'&&e.target===card)openProfile(card.dataset.player);};});
    $$('#app .tswPlayer [data-star]').forEach(star=>{const toggle=e=>{e.stopPropagation();toggleWatch(star.dataset.star).then(renderTeam);};star.onclick=toggle;star.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e);}};});
    $$('#app .tswStandings tr[data-team]').forEach(row=>{row.onclick=()=>openTeam(row.dataset.team);row.onkeydown=e=>{if(e.key==='Enter')openTeam(row.dataset.team);};});
    $('#tswFullStandings').onclick=()=>openStandings(L,t);
  };
  window.renderTeam = window.renderTeamScoutingV2;

  function trend(L,t,k){
    const gs=(L.games||[]).filter(g=>g.h===t.code||g.a===t.code).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-5);
    return gs.map(g=>{
      const home=g.h===t.code,opp=home?g.a:g.h,side=home?'H':'A';
      const forPts=N(home?g.hs:g.as),against=N(home?g.as:g.hs);
      if(k==='ppg')return {date:g.date,value:forPts};
      if(k==='oppg')return {date:g.date,value:against};
      if(k==='net')return {date:g.date,value:forPts!=null&&against!=null?forPts-against:null};
      const lines=L.players.filter(p=>p.team===t.code).flatMap(p=>(p.gameLog||[]).filter(r=>r[0]===g.date&&r[1]===opp&&r[2]===side));
      if(!lines.length)return {date:g.date,value:null};
      const sum=i=>lines.reduce((total,r)=>total+(N(r[i])||0),0);
      const fgm=sum(8),fga=sum(9),f3m=sum(10),f3a=sum(11),ftm=sum(12),fta=sum(13),reb=sum(14),ast=sum(15),stl=sum(16),blk=sum(17),tov=sum(18),pir=sum(19),pts=sum(7);
      const possessions=fga+.44*fta+tov;
      const stats={rpg:reb,apg:ast,spg:stl,bpg:blk,tpg:tov,pirg:pir,
        fgp:fga?fgm/fga*100:null,f2p:fga-f3a?(fgm-f3m)/(fga-f3a)*100:null,f3p:f3a?f3m/f3a*100:null,ftp:fta?ftm/fta*100:null,
        f3apg:f3a,ftapg:fta,astto:tov?ast/tov:null,pace:possessions,ortg:possessions?pts/possessions*100:null,
        efg:fga?(fgm+.5*f3m)/fga*100:null,ts:fga+.44*fta?pts/(2*(fga+.44*fta))*100:null,
        astpct:fgm?ast/fgm*100:null,tovpct:possessions?tov/possessions*100:null,f3ar:fga?f3a/fga*100:null,ftr:fga?fta/fga*100:null};
      return {date:g.date,value:stats[k]??null};
    }).filter(x=>x.value!=null);
  }
  function drawer(title,body){const old=document.getElementById('tswDrawer');if(old)old.remove();const d=document.createElement('dialog');d.id='tswDrawer';d.className='tswDrawer';d.innerHTML=`<div class="tswDrawerHead"><h2>${esc(title)}</h2><button type="button" aria-label="Close">×</button></div><div class="tswDrawerBody">${body}</div>`;document.body.appendChild(d);d.querySelector('button').onclick=()=>d.close();d.onclick=e=>{if(e.target===d)d.close();};d.onclose=()=>d.remove();d.showModal();return d;}
  function openRanking(L,t,[k,label,hi]){const rows=rankRows(L,k,hi),mine=rows.find(x=>x.t.code===t.code),values=rows.map(x=>x.value),average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null,difference=mine&&average!=null?mine.value-average:null,series=trend(L,t,k);const d=drawer(label+' · '+L.meta.name,`<div class="tswDrawerSummary"><div><small>LEAGUE AVERAGE</small><strong>${metricValue(k,average)}</strong></div><div><small>${esc(t.name.toUpperCase())}</small><strong>${mine?metricValue(k,mine.value):'—'}</strong></div><div><small>DIFFERENCE</small><strong>${difference==null?'—':(difference>0?'+':'')+F(difference)}</strong></div></div><h3>Last five games</h3><div class="tswTrend">${series.length?series.map(x=>`<span><b>${metricValue(k,x.value)}</b><small>${esc(x.date)}</small></span>`).join(''):'<p>Game-by-game trend is unavailable for this statistic.</p>'}</div><h3>League ranking</h3><div class="tswRanking">${rows.map((x,i)=>`<button type="button" data-rank-team="${escAttr(x.t.code)}" class="${x.t.code===t.code?'current':''}"><span>${i+1}.</span><span>${esc(x.t.name)}</span><strong>${metricValue(k,x.value)}</strong></button>`).join('')}</div>`);d.querySelectorAll('[data-rank-team]').forEach(b=>b.onclick=()=>{d.close();openTeam(b.dataset.rankTeam);});}
  function openStandings(L,t){const rows=standingRows(L,t);const d=drawer('Standings · '+L.meta.name,`<div class="tswRanking">${rows.map((x,i)=>{const w=N(x.w),l=N(x.l);return `<button type="button" data-rank-team="${escAttr(x.code)}" class="${x.code===t.code?'current':''}"><span>${N(x.rank)??i+1}.</span><span>${esc(x.name)}</span><strong>${w??'—'}-${l??'—'}</strong></button>`;}).join('')}</div>`);d.querySelectorAll('[data-rank-team]').forEach(b=>b.onclick=()=>{d.close();openTeam(b.dataset.rankTeam);});}
  function openCompare(L,t){const teams=L.teams.filter(x=>x.code!==t.code);const d=drawer('Compare · '+t.name,`<label class="tswComparePick">Compare with<select id="tswCompareTeam"><option value="">Select a team...</option>${teams.map(x=>`<option value="${escAttr(x.code)}">${esc(x.name)}</option>`).join('')}</select></label><div id="tswCompareResult"><p>Select a team from ${esc(L.meta.name)} to compare its averages.</p></div>`);const picker=d.querySelector('#tswCompareTeam'),result=d.querySelector('#tswCompareResult');picker.onchange=()=>{const other=L.teams.find(x=>x.code===picker.value),agg=teamAgg(L);if(!other){result.innerHTML='<p>Select a team.</p>';return;}result.innerHTML=`<table class="tswCompareTable"><thead><tr><th>Statistic</th><th>${esc(t.name)}</th><th>${esc(other.name)}</th></tr></thead><tbody>${basic.map(([k,label])=>`<tr><td>${esc(label)}</td><td>${metricValue(k,(agg[t.code]||{})[k])}</td><td>${metricValue(k,(agg[other.code]||{})[k])}</td></tr>`).join('')}</tbody></table>`;};}
})();
