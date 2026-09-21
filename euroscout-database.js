/* Player database workspace. The two views deliberately share STATE.scout. */
(function(){
  esScoutEnhance=function(){};
  const escape=val=>String(val??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields=['player','pos','height','age','nationality','club','competition','games','pts','reb','ast','pir','grade'];
  const labels={player:'Player',pos:'Pos',height:'HT',age:'Age',nationality:'Nationality',club:'Club',competition:'Competition',games:'GP',pts:'PTS',reb:'REB',ast:'AST',pir:'PIR',grade:'Grade'};
  const FILTER_VISIBILITY_KEY='euroscout:dbFiltersCollapsed:v1';
  let filtersCollapsed=false;
  try{filtersCollapsed=localStorage.getItem(FILTER_VISIBILITY_KEY)==='1';}catch(e){}
  function visible(){const saved=STATE.scout.dbColumns;return Array.isArray(saved)?saved.filter(key=>fields.includes(key)):fields;}
  function photo(p){const img=photoOf(p);return img?'<img src="'+escape(img)+'" loading="lazy" alt="" onerror="this.remove()">':escape(initials(p.name));}
  function club(p){return esCurrentRosterProfile(p);}
  function playerLeague(p){const current=club(p);return current.leagues.join(', ')||leagueOf(p)?.meta?.name||'—';}
  function tableRows(pool,offset){return pool.map((p,i)=>{
    const current=club(p),grade=statGradeOverall(p),watched=isWatched(p),shown=new Set(visible());
    const cell=(key,value,cls='')=>shown.has(key)?'<td data-col="'+key+'" class="'+cls+'">'+value+'</td>':'';
    return '<tr class="estr" data-id="'+escape(p.id)+'" tabindex="0">'+
      '<td class="es-db-check"><input type="checkbox" aria-label="Select '+escape(p.name)+'" data-select="'+escape(p.id)+'"></td><td class="es-db-rank">'+(offset+i+1)+'</td>'+
      cell('player','<div class="es-db-identity"><span class="es-db-avatar">'+photo(p)+'</span><span>'+escape(p.name)+'</span><button type="button" class="eststar '+(watched?'on':'')+'" data-star="'+escape(p.id)+'" aria-label="'+(watched?'Remove from':'Add to')+' watchlist">'+(watched?'★':'☆')+'</button></div>','es-db-name')+
      cell('pos',escape(dbPositionGroup(p)||'—'))+cell('height',p.height?escape(p.height)+' cm':'—')+cell('age',p.age!=null?escape(p.age):'—')+
      cell('nationality',(flagEmoji(p.country)?flagEmoji(p.country)+' ':'')+escape(EuroScoutCountries.canonical(p.country)||p.country||'—'))+
      cell('club','<span class="es-db-club">'+(current.logo?'<img src="'+escape(current.logo)+'" loading="lazy" alt="">':'')+escape(current.name)+'</span>')+
      cell('competition',escape(playerLeague(p)))+
      cell('games',p.g??'—')+cell('pts',p.ppg!=null?p.ppg.toFixed(1):'—')+cell('reb',p.rpg!=null?p.rpg.toFixed(1):'—')+
      cell('ast',p.apg!=null?p.apg.toFixed(1):'—')+cell('pir',p.pir!=null?p.pir.toFixed(1):'—')+
      cell('grade',grade!=null?'<span class="es-db-grade">'+grade.toFixed(1)+'</span>':'—')+
      '<td class="es-db-more"><button type="button" data-menu="'+escape(p.id)+'" aria-label="More actions for '+escape(p.name)+'">⋮</button></td></tr>';
  }).join('');}
  scoutTable=function(pool,s){const shown=new Set(visible());return '<div class="estwrap"><table class="estable es-db-table"><thead><tr><th><input type="checkbox" id="esSelectAll" aria-label="Select visible players"></th><th>#</th>'+fields.filter(k=>shown.has(k)).map(k=>'<th data-sort="'+({age:'born',height:'ht',games:'g',pts:'pts',reb:'reb',ast:'ast',pir:'pir',grade:'grade',player:'name'}[k]||'')+'" data-col="'+k+'">'+labels[k]+'</th>').join('')+'<th aria-label="Actions"></th></tr></thead><tbody>'+tableRows(pool,0)+'</tbody></table></div>';};
  scoutCard=function(p){const c=club(p),g=statGradeOverall(p),tags=playerTags(p).filter(t=>t!==WATCH_TAG).slice(0,3),summary=noteSummary(p)||statSummary(p)||'No scouting summary recorded yet.',watched=isWatched(p);
    return '<article class="scoutcard es-db-card" data-id="'+escape(p.id)+'" tabindex="0"><div class="es-db-card-top"><span class="es-db-card-photo">'+photo(p)+'</span><div class="es-db-card-id"><strong>'+escape(p.name)+'</strong><small>'+escape(dbPositionGroup(p)||'—')+' · '+(p.age??'—')+' · '+(p.height??'—')+' cm</small><small>'+escape(c.name)+'</small><small>'+escape(playerLeague(p))+'</small></div><div class="es-db-card-controls"><button class="cardwatch '+(watched?'on':'')+'" type="button" aria-label="Toggle watchlist">'+(watched?'★':'☆')+'</button>'+(g!=null?'<b class="es-db-grade">'+g.toFixed(1)+'</b>':'')+'</div></div><div class="es-db-tags">'+tags.map(t=>'<span>'+escape(t)+'</span>').join('')+'</div><div class="es-db-card-stats">'+[['PTS',p.ppg],['REB',p.rpg],['AST',p.apg],['PIR',p.pir]].map(([l,n])=>'<span><b>'+(n!=null?n.toFixed(1):'—')+'</b><small>'+l+'</small></span>').join('')+'</div><p class="es-db-summary">'+escape(summary)+'</p><div class="es-db-card-actions"><button type="button" data-note="'+escape(p.id)+'">＋ Add note</button><button type="button" data-menu="'+escape(p.id)+'" aria-label="More actions">⋮</button></div></article>';
  };
  const oldRender=renderScout;
  renderScout=function(){
    // Free Agents owns delegated handlers on #app. Drop them before rebuilding the database.
    const app=document.getElementById('app');if(app){app.onclick=null;app.onchange=null;app.oninput=null;app.onkeydown=null;app.removeAttribute('data-view');}
    const position=STATE.scout.dbPos;STATE.scout.dbPos=({PG:'Guard',SG:'Guard',SF:'Forward',PF:'Big',C:'Big'})[position]||position;
    document.body.classList.remove('fa2-active');document.body.classList.add('es-database-page');oldRender();if(STATE.scout.simRef)return;enhance();
  };
  const oldRenderAll=render;
  let wasDatabase=false,previousNavCollapsed=false;
  render=function(){
    const database=STATE.view==='scout';
    if(database&&!wasDatabase){previousNavCollapsed=document.body.classList.contains('es-nav-collapsed');document.body.classList.add('es-nav-collapsed');}
    if(!database&&wasDatabase)document.body.classList.toggle('es-nav-collapsed',previousNavCollapsed);
    wasDatabase=database;
    document.body.classList.toggle('es-database-page',database);
    oldRenderAll();
  };
  Object.assign(window,{render,renderScout});
  function select(label,value,options,handler){const box=document.createElement('label');box.className='es-db-filter';box.textContent=label;const el=document.createElement('select');el.innerHTML=options.map(([v,t])=>'<option value="'+escape(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+escape(t)+'</option>').join('');el.onchange=()=>handler(el.value);box.append(el);return box;}
  function clear(){const s=STATE.scout;s.q='';s.dbPos='';s.dbCountry='';s.dbAgeMin=s.dbAgeMax=s.dbHeightMin=s.dbHeightMax=null;s.dbGrade='';s.dbWatchOnly=s.dbReviewOnly=s.dbNotesOnly=false;s.level=null;s.next26=null;s.leagues.clear();s.roles.clear();s.tags.clear();s.status='all';s.filters=[];s.arch=null;s.ratingMin=null;renderScout();}
  function range(label,min,max,low,high,keyMin,keyMax){const block=document.createElement('div');block.className='es-db-filter es-db-range';const title=document.createElement('span');title.textContent=label;block.append(title);const row=document.createElement('div');for(const [key,val,bound] of [[keyMin,low,min],[keyMax,high,max]]){const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.value=val??bound;input.setAttribute('aria-label',label+' '+(key===keyMin?'minimum':'maximum'));input.onchange=()=>{STATE.scout[key]=input.value===''?null:Number(input.value);renderScout();};row.append(input);}block.append(row);return block;}
  function enhance(){const s=STATE.scout,wrap=$('#app .scoutwrap'),rail=wrap?.querySelector('.scoutrail'),head=wrap?.querySelector('.scouthead');if(!rail||!head)return;
    s.railHidden=false;wrap.classList.remove('rail-hidden');wrap.classList.toggle('es-db-rail-hidden',filtersCollapsed);
    rail.id='esDbFilterRail';
    rail.replaceChildren();const title=document.createElement('div');title.className='es-db-filter-head';title.innerHTML='<strong>Filters</strong>';const reset=document.createElement('button');reset.type='button';reset.textContent='↻ Reset all';reset.onclick=clear;title.append(reset);rail.append(title);
    const search=document.createElement('input');search.id='esDbSearch';search.placeholder='Search players, clubs, countries…';search.value=s.q||'';search.setAttribute('aria-label','Search player database');rail.append(search);search.oninput=()=>{s.q=search.value;const pos=search.selectionStart;clearTimeout(window.esDbTyping);window.esDbTyping=setTimeout(()=>{renderScout();const next=$('#esDbSearch');next?.focus();next?.setSelectionRange(pos,pos);},180);};
    const position=document.createElement('div');position.className='es-db-filter';position.innerHTML='<span>Position</span>';const pills=document.createElement('div');pills.className='es-db-position';[['','All'],['Guard','Guard'],['Forward','Forward'],['Big','Big']].forEach(([key,label])=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.classList.toggle('on',(s.dbPos||'')===key);b.onclick=()=>{s.dbPos=key;renderScout();};pills.append(b);});position.append(pills);rail.append(position);
    rail.append(select('Level',s.level??'',[['','All levels'],...LEVEL_BANDS.map((v,i)=>[i,v])],v=>{s.level=v===''?null:Number(v);renderScout();}));
    const leagues=STATE.data.leagues.filter(l=>!l.meta.teamsOnly&&!isOtherLeague(l.meta));const selected=[...s.leagues][0]||'';rail.append(select('Competition',s.competition||'all',[['all','All competitions'],['bclq','BCL Qualifiers · 2026/27']],v=>{s.competition=v;renderScout();}));
    rail.append(select('League',selected,[['','All leagues'],...leagues.map(l=>[l.meta.id,l.meta.name])],v=>{s.leagues.clear();if(v)s.leagues.add(v);renderScout();}));
    const countries=[...new Set(scoutPool().map(p=>p.country).filter(Boolean))].sort((a,b)=>countryLabel(a).localeCompare(countryLabel(b)));rail.append(select('Country',s.dbCountry||'',[['','All countries'],...countries.map(c=>[c,countryLabel(c)])],v=>{s.dbCountry=v;renderScout();}));
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
    filterButton.onclick=()=>{if(window.matchMedia('(max-width:700px)').matches){wrap.classList.toggle('es-db-filters-open');}else{filtersCollapsed=!filtersCollapsed;wrap.classList.toggle('es-db-rail-hidden',filtersCollapsed);try{localStorage.setItem(FILTER_VISIBILITY_KEY,filtersCollapsed?'1':'0');}catch(e){}}syncFilterButton();};
    syncFilterButton();left.append(filterButton);
    for(const [mode,label] of [['table','▦  Table view'],['cards','▣  Card view']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.classList.toggle('on',s.view===mode);b.onclick=()=>{s.view=mode;localStorage.setItem(SCOUT_VIEW_KEY,mode);renderScout();};left.append(b);}toolbar.append(left);
    const actions=document.createElement('div');actions.className='es-db-toolbar-actions';const save=document.createElement('button');save.textContent='♧  Save view';save.onclick=saveCurrentView;actions.append(save);
    actions.append(select('Sort',s.tsort?.key||'grade',[['grade','Stats grade'],['pts','Points'],['reb','Rebounds'],['ast','Assists'],['pir','PIR'],['name','Name'],['born','Birth year']],v=>{s.tsort={key:v,dir:v==='name'||v==='born'?1:-1};s.sort=v==='name'?'name':v==='pts'?'ppg':'grade';renderScout();}));
    if(s.view==='table'){const columns=document.createElement('details');columns.className='es-db-columns';columns.innerHTML='<summary>▦  Columns</summary>';const panel=document.createElement('div');for(const key of fields){const line=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=visible().includes(key);cb.disabled=key==='player';cb.onchange=()=>{s.dbColumns=cb.checked?[...new Set([...visible(),key])]:visible().filter(x=>x!==key);renderScout();};line.append(cb,document.createTextNode(labels[key]));panel.append(line);}columns.append(panel);actions.append(columns);}toolbar.append(actions);head.after(toolbar);
    const content=wrap.querySelector('.scoutmain');content.addEventListener('click',e=>{const note=e.target.closest('[data-note]'),menu=e.target.closest('[data-menu]');if(note){e.stopPropagation();openProfile(note.dataset.note);esSelectTab('Notes');}else if(menu){e.stopPropagation();openProfile(menu.dataset.menu);}else if(e.target.matches('[data-select],#esSelectAll')){e.stopPropagation();if(e.target.id==='esSelectAll')content.querySelectorAll('[data-select]').forEach(c=>c.checked=e.target.checked);}},true);
    if(s.view==='table')esScrollbars(wrap);
    setupMore(wrap,s);
  }
  function setupMore(wrap,s){const sentinel=wrap.querySelector('.es-db-loadmore');if(!sentinel)return;const scroller=s.view==='table'?wrap.querySelector('.estwrap'):null;if(scroller)scroller.append(sentinel);let shown=s.view==='table'?60:30;const step=s.view==='table'?60:30;let busy=false;const append=()=>{if(busy||!sentinel.isConnected)return;busy=true;const next=s._displayPool.slice(shown,shown+step);if(s.view==='table'){const body=wrap.querySelector('.es-db-table tbody');body?.insertAdjacentHTML('beforeend',tableRows(next,shown));body?.querySelectorAll('tr:not([data-db-bound])').forEach(row=>{row.dataset.dbBound='1';row.onclick=e=>{if(e.target.closest('button,input')){if(e.target.closest('.eststar'))toggleTag(row.dataset.id,WATCH_TAG).then(renderScout);return;}openProfile(row.dataset.id);};});}else{const board=wrap.querySelector('.board');board?.insertAdjacentHTML('beforeend',next.map(scoutCard).join(''));board?.querySelectorAll('.es-db-card:not([data-db-bound])').forEach(card=>{card.dataset.dbBound='1';card.onclick=e=>{if(e.target.closest('.cardwatch')){e.stopPropagation();toggleTag(card.dataset.id,WATCH_TAG).then(renderScout);return;}if(e.target.closest('button'))return;openProfile(card.dataset.id);};});}shown+=next.length;sentinel.textContent=shown.toLocaleString()+' of '+s._displayPool.length.toLocaleString()+' players';if(shown>=s._displayPool.length){observer.disconnect();sentinel.remove();}busy=false;};
    const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)append();},{root:scroller,rootMargin:'400px'});observer.observe(sentinel);
  }
})();
