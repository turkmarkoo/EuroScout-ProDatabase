/* Player database workspace. The two views deliberately share STATE.scout. */
(function(){
  esScoutEnhance=function(){};
  const escape=val=>String(val??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields=['player','primaryRole','secondaryRole','pos','height','age','academicYear','nationality','club','competition','games','pts','reb','ast','pir','level'];
  const labels={primaryRole:'Primary Role',secondaryRole:'Secondary Role',player:'Player',pos:'Pos',height:'HT',age:'Age',academicYear:'College year',nationality:'Nationality',club:'Club',competition:'Competition',games:'GP',pts:'PTS',reb:'REB',ast:'AST',pir:'PIR',level:'Estimated level'};
  const FILTER_VISIBILITY_KEY='euroscout:dbFiltersCollapsed:v1';
  const SEARCH_RESULT_LIMIT=160;
  let signalEvidenceJob=null,signalEvidenceState='idle',signalEvidenceError='';
  let rosterJob=null,rosterError='';
  function ensureRosterDatabase(){
    if(!coreCatalogueSettled||STATE._extraDone||rosterJob||rosterError)return;
    // Paint the current catalogue before parsing and integrating the extra rosters.
    rosterJob=new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)))
      .then(()=>STATE.view==='scout'&&loadExtraLeagues())
      .catch(e=>{rosterError=e.message||'US rosters could not load.';if(STATE.view==='scout')renderScout();})
      .finally(()=>{rosterJob=null;});
  }
  window.addEventListener('euroscout:core-settled',()=>{if(STATE.view==='scout')ensureRosterDatabase();});
  const needsSignalHistory=s=>s.signals?.has('college')||s.signals?.has('uspro');
  const signalEvidenceReady=()=>window.EuroScoutCatalogueReady&&window.ESSignals?.historyReady();
  function repaintSignals(){if(STATE.view!=='scout'||!STATE.scout.signals?.size)return;const active=document.activeElement,editing=active?.closest('.scoutwrap')&&active.matches('input:not([type=checkbox])'),saved=editing&&active.id?{id:active.id,value:active.value,start:active.selectionStart,end:active.selectionEnd}:null;renderScout();if(saved){const field=document.getElementById(saved.id);if(field){field.value=saved.value;field.focus({preventScroll:true});if(saved.start!=null&&field.setSelectionRange)try{field.setSelectionRange(saved.start,saved.end);}catch{}}}}
  function ensureSignalEvidence(){
    if(signalEvidenceJob||signalEvidenceState==='error')return;
    if(signalEvidenceReady()){signalEvidenceState='ready';return;}
    signalEvidenceState='loading';signalEvidenceError='';
    signalEvidenceJob=(async()=>{
      // Wait for the initial catalogue swap; otherwise it can discard packs
      // loaded by an early saved-view click.
      if(!window.EuroScoutCatalogueReady)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('euroscout:catalogue-ready',check);reject(Error('The player catalogue is still loading.'));},45000);const check=()=>{if(!window.EuroScoutCatalogueReady)return;clearTimeout(timer);window.removeEventListener('euroscout:catalogue-ready',check);resolve();};window.addEventListener('euroscout:catalogue-ready',check);check();});
      await ESSignals.loadHistory();
      if(!signalEvidenceReady())throw Error('Arrival history could not be loaded.');
      signalEvidenceState='ready';
    })().catch(e=>{signalEvidenceState='error';signalEvidenceError=e.message||'Player history could not be loaded.';}).finally(()=>{signalEvidenceJob=null;repaintSignals();});
  }
  const searchIndex=new Map();
  let countryCache=null;
  function countryOptions(){
    if(countryCache?.data===STATE.data&&countryCache.revision===personLinkRevision&&countryCache.overrides===OVR)return countryCache.options;
    const countries=[...new Set(allPlayersEvery().map(p=>p.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const options=[['','All nationalities'],...countries.map(c=>[c,countryLabel(c)||c])];
    countryCache={data:STATE.data,revision:personLinkRevision,overrides:OVR,options};
    return options;
  }
  let searchGeneration=0,moreObserver=null;
  function stopMore(){moreObserver?.disconnect();moreObserver=null;}
  let filtersCollapsed=false,mobileFiltersOpen=false,levelPickerOpen=false;
  try{filtersCollapsed=localStorage.getItem(FILTER_VISIBILITY_KEY)==='1';}catch(e){}
  function visible(){const saved=STATE.scout.dbColumns;return Array.isArray(saved)?saved.map(key=>key==='grade'?'level':key).filter(key=>fields.includes(key)):fields;}
  function photo(p){const img=photoOf(p);return img?'<img src="'+escape(img)+'" loading="lazy" alt="" onerror="this.remove()">':escape(initials(p.name));}
  function club(p){
    const scoped=p._databaseClubKey&&clubByKey(p._databaseClubKey);
    if(p._seasonContext?.endsWith(' · BCL Qualifiers')&&p._seasonClub)return {name:p._seasonClub,logo:clubLogo(scoped),leagues:[]};
    if(!scoped)return esCurrentRosterProfile(p);
    const season=STATE.scout.season;
    const leagues=season==='2026/27'?[...domCompsOf(scoped),...nextCompsOf(scoped)]:scoped.leagues;
    return {name:scoped.name,logo:clubLogo(scoped),leagues:[...new Set(leagues.map(l=>l.name))]};
  }
  function playerLeague(p,current){
    const s=STATE.scout;
    if(s.leagues.size===1&&s.leagues.has('bclq'))return 'BCL Qualifiers';
    return SCOUT_ROSTER_COMPETITIONS.get(p._databaseGroup)||current.leagues.join(', ')||leagueOf(p)?.meta?.name||'—';
  }
  function levelBadge(p,fallback='—'){
    const band=levelBand(p);
    return band?'<span class="es-db-level" title="Estimated level · '+(band.manual?'manual':'automatic')+'">'+escape(band.label)+'</span>':fallback;
  }
  function searchText(p){
    const id=gid(p),notes=noteText(p),roleText=window.ESPlayerScouting?PlayerScouting.rolesOf(ESPlayerScouting.roles(p)).join(' '):'',key=[p.name,p._seasonClub,p.teamName,p.country,notes,roleText].join('\u0000');
    const cached=searchIndex.get(id);if(cached?.key===key)return cached.text;
    const text=searchFold([p.name,p._seasonClub||p.teamName||'',countryLabel(p.country)||p.country||'',notes,roleText].join(' '));
    searchIndex.set(id,{key,text});return text;
  }
  function bindSearchRows(root){
    root.querySelectorAll('.es-db-table tbody tr').forEach(row=>{row.onclick=e=>{if(e.target.closest('button,input')){if(e.target.closest('.eststar'))toggleTag(row.dataset.id,WATCH_TAG).then(renderScout);return;}openProfile(row.dataset.id);};});
    root.querySelectorAll('.es-db-card').forEach(card=>{card.onclick=e=>{if(e.target.closest('.cardwatch')){e.stopPropagation();toggleTag(card.dataset.id,WATCH_TAG).then(renderScout);return;}if(e.target.closest('button'))return;openProfile(card.dataset.id);};});
  }
  function paintSearchResults(wrap,s,pool){
    stopMore();s._displayPool=pool;
    const main=wrap.querySelector('.scoutmain'),oldStatus=main?.querySelector('.es-db-search-status');
    oldStatus?.remove();main?.querySelector('.es-db-loadmore')?.remove();main?.querySelector('.empty')?.remove();
    if(s.view==='table'){
      const body=main?.querySelector('.es-db-table tbody');if(body)body.innerHTML=tableRows(pool.slice(0,SEARCH_RESULT_LIMIT),0);
    }else{
      const board=main?.querySelector('.board');if(board)board.innerHTML=pool.slice(0,SEARCH_RESULT_LIMIT).map(scoutCard).join('');
    }
    if(main){
      const anchor=s.view==='table'?main.querySelector('.estwrap'):main.querySelector('.board');
      if(!pool.length)anchor?.insertAdjacentHTML('afterend','<div class="empty">No players match. Try another name, club, country or note.</div>');
      else if(pool.length>SEARCH_RESULT_LIMIT)anchor?.insertAdjacentHTML('afterend','<div class="es-db-search-status es-db-loadmore" role="status">Showing the first '+SEARCH_RESULT_LIMIT.toLocaleString()+' of '+pool.length.toLocaleString()+' matches · keep typing to narrow the results</div>');
      bindSearchRows(main);
    }
    const apply=wrap.querySelector('.es-db-apply');if(apply)apply.textContent='Apply filters · '+pool.length.toLocaleString()+' players';
  }
  function scheduleSearchResults(wrap,s){
    const generation=++searchGeneration,needle=searchFold(String(s.q||'').trim()),base=s._dbSearchBase||s._displayPool||[];
    if(!needle){renderScout();return;}
    const input=wrap.querySelector('#esDbSearch');input?.setAttribute('aria-busy','true');
    const matches=[];let index=0;
    const step=()=>{
      if(generation!==searchGeneration||!wrap.isConnected)return;
      const started=performance.now();
      while(index<base.length&&performance.now()-started<7){const p=base[index++];if(searchText(p).includes(needle))matches.push(p);}
      if(index<base.length){setTimeout(step,0);return;}
      input?.removeAttribute('aria-busy');paintSearchResults(wrap,s,matches);
    };
    step();
  }
  function roleCell(value,key){return value?'<button type="button" class="dq-role-chip '+(key==='primaryRole'?'primary':'secondary')+'" data-scout-role="'+escape(value)+'" title="'+escape(PlayerScouting.roles.find(r=>r.name===value)?.definition)+'">'+escape(value)+'</button>':'—';}
  function tableRows(pool,offset){
    const shown=new Set(visible());
    return pool.map((p,i)=>{
      const current=club(p),watched=isWatched(p),roles=window.ESPlayerScouting?.roles(p);
      const cell=(key,value,cls='')=>shown.has(key)?'<td data-col="'+key+'" class="'+cls+'">'+value+'</td>':'';
      return '<tr class="estr" data-id="'+escape(p.id)+'" tabindex="0">'+
        '<td class="es-db-check"><input type="checkbox" aria-label="Select '+escape(p.name)+'" data-select="'+escape(p.id)+'"></td><td class="es-db-rank">'+(offset+i+1)+'</td>'+
        cell('player','<div class="es-db-identity"><span class="es-db-avatar">'+photo(p)+'</span><span>'+escape(p.name)+'</span><button type="button" class="eststar '+(watched?'on':'')+'" data-star="'+escape(p.id)+'" aria-label="'+(watched?'Remove from':'Add to')+' watchlist">'+(watched?'★':'☆')+'</button></div>','es-db-name')+
        cell('primaryRole',roleCell(roles?.primaryRole,'primaryRole'),'dq-role-cell')+cell('secondaryRole',roleCell(roles?.secondaryRole,'secondaryRole'),'dq-role-cell')+cell('pos',escape(dbPositionGroup(p)||'—'))+cell('height',p.height?escape(p.height)+' cm':'—')+cell('age',p.age!=null?escape(p.age):'—')+
        cell('academicYear',escape(scoutCollegeInfo(p,STATE.scout.season)?.classLabel||'—'))+
        cell('nationality',(flagEmoji(p.country)?flagEmoji(p.country)+' ':'')+escape(EuroScoutCountries.canonical(p.country)||p.country||'—'))+
        cell('club','<span class="es-db-club">'+(current.logo?'<img src="'+escape(current.logo)+'" loading="lazy" alt="">':'')+escape(current.name)+'</span>')+
        cell('competition',escape(playerLeague(p,current)))+
        cell('games',p.g??'—')+cell('pts',p.ppg!=null?p.ppg.toFixed(1):'—')+cell('reb',p.rpg!=null?p.rpg.toFixed(1):'—')+
        cell('ast',p.apg!=null?p.apg.toFixed(1):'—')+cell('pir',p.pir!=null?p.pir.toFixed(1):'—')+
        cell('level',levelBadge(p))+
        '<td class="es-db-more"><button type="button" data-menu="'+escape(p.id)+'" aria-label="More actions for '+escape(p.name)+'">⋮</button></td></tr>';
    }).join('');
  }
  scoutTable=function(pool,s){const shown=new Set(visible());return '<div class="estwrap"><table class="estable es-db-table"><thead><tr><th><input type="checkbox" id="esSelectAll" aria-label="Select visible players"></th><th>#</th>'+fields.filter(k=>shown.has(k)).map(k=>'<th data-sort="'+({primaryRole:'primaryRole',secondaryRole:'secondaryRole',age:'born',height:'ht',games:'g',pts:'pts',reb:'reb',ast:'ast',pir:'pir',level:'level',player:'name'}[k]||'')+'" data-col="'+k+'"'+(k==='level'?' aria-sort="'+(s.tsort.key==='level'?(s.tsort.dir===1?'ascending':'descending'):'none')+'"':'')+'>'+(k==='level'?'<button type="button" class="es-db-level-sort">'+labels[k]+(s.tsort.key==='level'?(s.tsort.dir===1?' ↑':' ↓'):'')+'</button>':labels[k])+'</th>').join('')+'<th aria-label="Actions"></th></tr></thead><tbody>'+tableRows(pool,0)+'</tbody></table></div>';};
  scoutCard=function(p){const c=club(p),level=levelBadge(p,''),tags=playerTags(p).filter(t=>t!==WATCH_TAG).slice(0,3),summary=noteSummary(p)||statSummary(p)||'No scouting summary recorded yet.',watched=isWatched(p);
    return '<article class="scoutcard es-db-card" data-id="'+escape(p.id)+'" tabindex="0"><div class="es-db-card-top"><span class="es-db-card-photo">'+photo(p)+'</span><div class="es-db-card-id"><strong>'+escape(p.name)+'</strong><small>'+escape(dbPositionGroup(p)||'—')+' · '+(p.age??'—')+' · '+(p.height??'—')+' cm</small><small>'+escape(c.name)+'</small><small>'+escape(playerLeague(p,c))+'</small></div><div class="es-db-card-controls"><button class="cardwatch '+(watched?'on':'')+'" type="button" aria-label="Toggle watchlist">'+(watched?'★':'☆')+'</button>'+level+'</div></div><div class="dq-role-row">'+(window.ESPlayerScouting?PlayerScouting.chipsHTML(ESPlayerScouting.roles(p)):'')+'</div><div class="es-db-tags">'+tags.map(t=>'<span>'+escape(t)+'</span>').join('')+'</div><div class="es-db-card-stats">'+[['PTS',p.ppg],['REB',p.rpg],['AST',p.apg],['PIR',p.pir]].map(([l,n])=>'<span><b>'+(n!=null?n.toFixed(1):'—')+'</b><small>'+l+'</small></span>').join('')+'</div><p class="es-db-summary">'+escape(summary)+'</p><div class="es-db-card-actions"><button type="button" data-note="'+escape(p.id)+'">＋ Add note</button><button type="button" data-menu="'+escape(p.id)+'" aria-label="More actions">⋮</button></div></article>';
  };
  const oldRender=renderScout;
  renderScout=function(){
    // Free Agents owns delegated handlers on #app. Drop them before rebuilding the database.
    const app=document.getElementById('app');if(app){app.onclick=null;app.onchange=null;app.oninput=null;app.onkeydown=null;app.removeAttribute('data-view');}
    stopMore();
    const focused=document.activeElement?.id==='esDbSearch'?document.activeElement:null;
    const selection=focused?[focused.selectionStart,focused.selectionEnd]:null;
    const s=STATE.scout;
    const query=s.q||'';if(query)s.q='';
    document.body.classList.remove('fa2-active');document.body.classList.add('es-database-page');
    try{oldRender(!s.simRef);}finally{s.q=query;}
    s._dbSearchBase=s._displayPool||[];
    ensureRosterDatabase();
    if(needsSignalHistory(s))ensureSignalEvidence();
    if(s.simRef)return;enhance();
    if(selection){
      const input=document.getElementById('esDbSearch');
      input?.focus({preventScroll:true});input?.setSelectionRange(...selection);
    }
    if(query){const wrap=$('#app .scoutwrap');if(wrap)scheduleSearchResults(wrap,s);}
  };
  const oldRenderAll=render;
  let wasDatabase=false,previousNavCollapsed=false;
  render=function(){
    const database=STATE.view==='scout';
    if(database&&!wasDatabase){previousNavCollapsed=document.body.classList.contains('es-nav-collapsed');document.body.classList.add('es-nav-collapsed');}
    if(!database&&wasDatabase){stopMore();searchGeneration++;searchIndex.clear();countryCache=null;document.body.classList.toggle('es-nav-collapsed',previousNavCollapsed);levelPickerOpen=false;}
    wasDatabase=database;
    document.body.classList.toggle('es-database-page',database);
    oldRenderAll();
  };
  Object.assign(window,{render,renderScout});
  function select(label,value,options,handler){const box=document.createElement('label');box.className='es-db-filter';box.textContent=label;const el=document.createElement('select');el.innerHTML=options.map(([v,t])=>'<option value="'+escape(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+escape(t)+'</option>').join('');el.onchange=()=>handler(el.value);box.append(el);return box;}
  function clear(){const s=STATE.scout;s.q='';s.basketballRole='';s.dbPositions.clear();s.dbCountry='';s.dbAgeMin=s.dbAgeMax=s.dbHeightMin=s.dbHeightMax=null;s.dbGrade='';s.dbAcademicYear='';s.dbWatchOnly=s.dbReviewOnly=s.dbNotesOnly=false;s.levels.clear();levelPickerOpen=false;s.rosterGroups.clear();s.next26=null;s.leagues.clear();s.roles.clear();s.tags.clear();s.signals?.clear();s.status='all';s.filters=[];s.arch=null;s.ratingMin=null;renderScout();}
  function range(label,min,max,low,high,keyMin,keyMax){const block=document.createElement('div');block.className='es-db-filter es-db-range';const title=document.createElement('span');title.textContent=label;block.append(title);const row=document.createElement('div');for(const [key,val,bound] of [[keyMin,low,min],[keyMax,high,max]]){const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.value=val??bound;input.setAttribute('aria-label',label+' '+(key===keyMin?'minimum':'maximum'));input.onchange=()=>{const value=input.value===''?null:Number(input.value);if(STATE.scout[key]===value)return;STATE.scout[key]=value;renderScout();};row.append(input);}block.append(row);return block;}
  function renderFilterChange(rail,selector){
    const scroll=rail.scrollTop;
    renderScout();
    const next=document.getElementById('esDbFilterRail');
    if(next)next.scrollTop=scroll;
    next?.querySelector(selector)?.focus({preventScroll:true});
  }
  function levelPicker(s,rail){
    const label=document.createElement('div');label.className='es-db-filter';
    const title=document.createElement('span');title.id='esDbLevelLabel';title.textContent='Estimated level';label.append(title);
    const picker=document.createElement('details');picker.className='es-db-level-picker';picker.open=levelPickerOpen;
    const summary=document.createElement('summary');summary.setAttribute('aria-labelledby','esDbLevelLabel esDbLevelSelection');
    summary.onclick=()=>{levelPickerOpen=!picker.open;};
    const selection=document.createElement('span');selection.id='esDbLevelSelection';
    selection.textContent=s.levels.size?[...s.levels].sort((a,b)=>b-a).map(i=>LEVEL_BANDS[i]).join(', '):'All levels';
    summary.append(selection);picker.append(summary);
    const choices=document.createElement('div');choices.className='es-db-level-options';choices.setAttribute('role','group');choices.setAttribute('aria-labelledby',title.id);
    LEVEL_BANDS.map((name,i)=>[name,i]).reverse().forEach(([name,i])=>{
      const row=document.createElement('label');row.className='es-db-toggle';
      const input=document.createElement('input');input.type='checkbox';input.dataset.dbLevel=i;input.checked=s.levels.has(i);
      input.onchange=()=>{
        input.checked?s.levels.add(i):s.levels.delete(i);
        levelPickerOpen=true;
        renderFilterChange(rail,'[data-db-level="'+i+'"]');
      };
      row.append(input,document.createTextNode(name));choices.append(row);
    });
    picker.append(choices);label.append(picker);return label;
  }
  function enhance(){const s=STATE.scout,wrap=$('#app .scoutwrap'),rail=wrap?.querySelector('.scoutrail'),head=wrap?.querySelector('.scouthead');if(!rail||!head)return;
    s.railHidden=false;wrap.classList.remove('rail-hidden');wrap.classList.toggle('es-db-rail-hidden',filtersCollapsed);wrap.classList.toggle('es-db-filters-open',mobileFiltersOpen);
    rail.id='esDbFilterRail';
    rail.replaceChildren();const title=document.createElement('div');title.className='es-db-filter-head';title.innerHTML='<strong>Filters</strong>';const reset=document.createElement('button');reset.type='button';reset.textContent='↻ Reset all';reset.onclick=clear;title.append(reset);rail.append(title);
    const search=document.createElement('input');search.id='esDbSearch';search.placeholder='Search players, clubs, countries…';search.value=s.q||'';search.setAttribute('aria-label','Search player database');rail.append(search);search.oninput=()=>{s.q=search.value;clearTimeout(window.esDbTyping);window.esDbTyping=setTimeout(()=>{if(STATE.view!=='scout'||!search.isConnected)return;scheduleSearchResults(wrap,s);},80);};
    const groups=document.createElement('fieldset');groups.className='es-db-roster-groups';
    groups.innerHTML='<legend>Where they play</legend>'+scoutRosterGroupOptions(s.rosterGroups)+'<p class="hint">Leave all unchecked to show every league.</p>';
    groups.onchange=e=>{
      const input=e.target,id=input.dataset.rosterGroup;
      input.checked?s.rosterGroups.add(id):s.rosterGroups.delete(id);
      renderFilterChange(rail,'[data-roster-group="'+id+'"]');
    };
    rail.append(groups);
    const position=document.createElement('div');position.className='es-db-filter';
    position.innerHTML='<span id="esDbPositionLabel">Position</span>';
    const pills=document.createElement('div');pills.className='es-db-position';
    pills.setAttribute('role','group');pills.setAttribute('aria-labelledby','esDbPositionLabel');
    for(const key of ['',...SCOUT_POSITIONS]){
      const b=document.createElement('button');b.textContent=key||'All';b.type='button';b.dataset.dbPosition=key;
      const active=key?s.dbPositions.has(key):!s.dbPositions.size;
      b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));
      b.onclick=()=>{
        if(!key)s.dbPositions.clear();
        else if(s.dbPositions.has(key))s.dbPositions.delete(key);
        else s.dbPositions.add(key);
        renderFilterChange(rail,'[data-db-position="'+key+'"]');
      };
      pills.append(b);
    }
    position.append(pills);rail.append(position);
    rail.append(levelPicker(s,rail));
    rail.append(select('Nationality',s.dbCountry||'',countryOptions(),v=>{s.dbCountry=v;renderScout();}));
    rail.append(select('College year',s.dbAcademicYear||'',[['','All college years'],...['Freshman','Sophomore','Junior','Senior','Graduate','Fifth year','Sixth year','Unknown'].map(y=>[y,y])],v=>{s.dbAcademicYear=v;renderScout();}));
    const signals=document.createElement('fieldset');signals.className='es-db-signals';
    const legend=document.createElement('legend');legend.textContent='Scouting signals · 2026/27';signals.append(legend);
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Select one or more. Includes players matching any selected signal.';signals.append(hint);
    for(const rule of window.ESSignals?.FILTERS||[]){const line=document.createElement('label');line.className='es-db-toggle';line.title=rule.title;const input=document.createElement('input');input.type='checkbox';input.dataset.signal=rule.key;input.checked=s.signals?.has(rule.key)||false;input.onchange=()=>{s.signals=s.signals||new Set();input.checked?s.signals.add(rule.key):s.signals.delete(rule.key);if(input.checked)s.season='2026/27';renderScout();};line.append(input,document.createTextNode(rule.label));signals.append(line);}rail.append(signals);
    const leagues=STATE.data.leagues.filter(l=>isStatLeague(l.meta)&&!SCOUT_ROSTER_COMPETITIONS.has(l.meta.id)&&l.meta.id!=='bclq'&&l.meta.dragonsCompetition!=='BCLQ');
    const selected=[...s.leagues][0]||'';
    rail.append(select('League',selected,[['','All leagues'],...leagues.map(l=>[l.meta.id,l.meta.name]),['bclq','BCL Qualifiers · 2026/27']],v=>{
      s.leagues.clear();
      if(v)s.leagues.add(v);
      if(v==='bclq')s.season=s.statsSeason='2026/27';
      renderScout();
    }));
    rail.append(range('Age',16,45,s.dbAgeMin,s.dbAgeMax,'dbAgeMin','dbAgeMax'));rail.append(range('Height (cm)',150,235,s.dbHeightMin,s.dbHeightMax,'dbHeightMin','dbHeightMax'));
    rail.append(select('Stats grade',s.dbGrade||'',[['','All grades'],['9','9+'],['8','8+'],['7','7+'],['6','6+']],v=>{s.dbGrade=v;renderScout();}));
    rail.append(select('Contract status',s.next26||'',[['','All'],['signed','Under contract'],['free','Free agent']],v=>{s.next26=v||null;renderScout();}));
    for(const [key,label] of [['dbWatchOnly','Show only watchlist'],['dbReviewOnly','Show only review queue'],['dbNotesOnly','My notes only']]){const line=document.createElement('label');line.className='es-db-toggle';const input=document.createElement('input');input.type='checkbox';input.checked=!!s[key];input.onchange=()=>{s[key]=input.checked;renderScout();};line.append(input,document.createTextNode(label));rail.append(line);}
    const apply=document.createElement('button');apply.className='es-db-apply';apply.type='button';apply.textContent='Apply filters · '+s._displayPool.length.toLocaleString()+' players';apply.onclick=()=>wrap.querySelector('.scoutmain')?.scrollIntoView({block:'start',behavior:'smooth'});rail.append(apply);
    head.querySelector('.railToggle')?.remove();head.querySelector('.scoutTools')?.remove();head.querySelector('.headleft')?.remove();
    wrap.querySelectorAll('.seasonFilters,.filterbar,.viewsBar,.recentRow,.chipbar').forEach(el=>el.remove());
    const toolbar=document.createElement('div');toolbar.className='es-db-toolbar';const left=document.createElement('div');left.className='es-db-view';
    const filterButton=document.createElement('button');filterButton.type='button';filterButton.className='es-db-rail-toggle';filterButton.setAttribute('aria-controls','esDbFilterRail');
    const syncFilterButton=()=>{const open=window.matchMedia('(max-width:700px)').matches?wrap.classList.contains('es-db-filters-open'):!wrap.classList.contains('es-db-rail-hidden');filterButton.textContent=(open?'☷  Hide filters':'☷  Show filters');filterButton.setAttribute('aria-expanded',String(open));};
    filterButton.onclick=()=>{if(window.matchMedia('(max-width:700px)').matches){mobileFiltersOpen=wrap.classList.toggle('es-db-filters-open');}else{filtersCollapsed=!filtersCollapsed;wrap.classList.toggle('es-db-rail-hidden',filtersCollapsed);try{localStorage.setItem(FILTER_VISIBILITY_KEY,filtersCollapsed?'1':'0');}catch(e){}}syncFilterButton();};
    syncFilterButton();left.append(filterButton);
    for(const [mode,label] of [['table','▦  Table view'],['cards','▣  Card view']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.classList.toggle('on',s.view===mode);b.onclick=()=>{s.view=mode;localStorage.setItem(SCOUT_VIEW_KEY,mode);renderScout();};left.append(b);}toolbar.append(left);
    const actions=document.createElement('div');actions.className='es-db-toolbar-actions';const saved=viewsGet(),active=saved.findIndex(viewIsActive);const viewPicker=select('Saved view',active<0?'':String(active),[['','Select a view…'],...saved.map((v,i)=>[String(i),v.name])],v=>{if(v!=='')applyView(viewsGet()[Number(v)]);});viewPicker.querySelector('select').id='esDbSavedView';actions.append(viewPicker);const save=document.createElement('button');save.textContent='♧  Save view';save.onclick=saveCurrentView;actions.append(save);
    actions.append(select('Sort',s.tsort?.key||'level',[['level','Estimated level'],['pts','Points'],['reb','Rebounds'],['ast','Assists'],['pir','PIR'],['name','Name'],['born','Birth year'],['primaryRole','Primary Role'],['secondaryRole','Secondary Role']],v=>{s.tsort={key:v,dir:['name','born','primaryRole','secondaryRole'].includes(v)?1:-1};s.sort=v==='level'?'level':v==='name'?'name':v==='pts'?'ppg':'grade';renderScout();}));
    if(s.view==='table'){const columns=document.createElement('details');columns.className='es-db-columns';columns.innerHTML='<summary>▦  Columns</summary>';const panel=document.createElement('div');for(const key of fields){const line=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=visible().includes(key);cb.disabled=key==='player';cb.onchange=()=>{s.dbColumns=cb.checked?[...new Set([...visible(),key])]:visible().filter(x=>x!==key);renderScout();};line.append(cb,document.createTextNode(labels[key]));panel.append(line);}columns.append(panel);actions.append(columns);}toolbar.append(actions);head.after(toolbar);
    if(!STATE._extraDone){const status=document.createElement('div');status.className='es-db-signal-status';status.setAttribute('role','status');status.textContent=rosterError?'US roster coverage is incomplete. '+rosterError:'Loading NCAA, NBA and G League rosters…';if(rosterError){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>{rosterError='';renderScout();};status.append(retry);}toolbar.after(status);}
    if(needsSignalHistory(s)&&signalEvidenceState!=='ready'){
      const status=document.createElement('div');status.className='es-db-signal-status';status.setAttribute('role','status');
      status.textContent=signalEvidenceState==='error'?'Rookie / NBA-G League list is incomplete. '+signalEvidenceError:'Loading arrival history across all leagues… Results below are incomplete until loading finishes.';
      if(signalEvidenceState==='error'){const retry=document.createElement('button');retry.type='button';retry.textContent='Retry loading history';retry.onclick=()=>{signalEvidenceState='idle';renderScout();};status.append(retry);}toolbar.after(status);
    }
    if(s.signals?.size){const active=document.createElement('div');active.className='es-db-active-signals';active.setAttribute('aria-label','Active scouting signals');for(const rule of window.ESSignals?.FILTERS||[]){if(!s.signals.has(rule.key))continue;const button=document.createElement('button');button.type='button';button.textContent=rule.label+' ×';button.setAttribute('aria-label','Remove '+rule.label+' filter');button.onclick=()=>{s.signals.delete(rule.key);renderScout();};active.append(button);}toolbar.after(active);}
    const content=wrap.querySelector('.scoutmain');content.addEventListener('click',e=>{const note=e.target.closest('[data-note]'),menu=e.target.closest('[data-menu]');if(note){e.stopPropagation();openProfile(note.dataset.note);esSelectTab('Notes');}else if(menu){e.stopPropagation();openProfile(menu.dataset.menu);}else if(e.target.matches('[data-select],#esSelectAll')){e.stopPropagation();if(e.target.id==='esSelectAll')content.querySelectorAll('[data-select]').forEach(c=>c.checked=e.target.checked);}},true);
    if(s.view==='table')esScrollbars(wrap);
    setupMore(wrap,s);
  }
  function setupMore(wrap,s){const sentinel=wrap.querySelector('.es-db-loadmore');if(!sentinel)return;const scroller=s.view==='table'?wrap.querySelector('.estwrap'):null;if(scroller)scroller.append(sentinel);let shown=s.view==='table'?60:30;const step=s.view==='table'?60:30;let busy=false;const append=()=>{if(busy||!sentinel.isConnected)return;busy=true;const next=s._displayPool.slice(shown,shown+step);if(s.view==='table'){const body=wrap.querySelector('.es-db-table tbody');body?.insertAdjacentHTML('beforeend',tableRows(next,shown));body?.querySelectorAll('tr:not([data-db-bound])').forEach(row=>{row.dataset.dbBound='1';row.onclick=e=>{if(e.target.closest('button,input')){if(e.target.closest('.eststar'))toggleTag(row.dataset.id,WATCH_TAG).then(renderScout);return;}openProfile(row.dataset.id);};});}else{const board=wrap.querySelector('.board');board?.insertAdjacentHTML('beforeend',next.map(scoutCard).join(''));board?.querySelectorAll('.es-db-card:not([data-db-bound])').forEach(card=>{card.dataset.dbBound='1';card.onclick=e=>{if(e.target.closest('.cardwatch')){e.stopPropagation();toggleTag(card.dataset.id,WATCH_TAG).then(renderScout);return;}if(e.target.closest('button'))return;openProfile(card.dataset.id);};});}window.PlayerScouting?.wireChips(wrap,window.ESPlayerScouting.filterRole,window.ESPlayerScouting.openLibrary);shown+=next.length;sentinel.textContent=shown.toLocaleString()+' of '+s._displayPool.length.toLocaleString()+' players';if(shown>=s._displayPool.length){stopMore();sentinel.remove();}busy=false;};
    moreObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)append();},{root:scroller,rootMargin:'400px'});moreObserver.observe(sentinel);
  }
})();
