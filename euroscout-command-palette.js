(function () {
  'use strict';
  let palette=null,cache=null,backgroundQueued=false;
  const api=()=>window.GlobalCommandPalette;
  const folded=value=>api().fold(value);
  const searchKeys=new WeakMap();
  const matchCache=new Map();
  function scored(query,items,title,extra,scope){
    const q=folded(query),words=q.split(/\s+/).filter(Boolean),best=[];
    const previous=matchCache.get(scope),source=previous&&previous.base===items&&previous.size===items.length&&previous.query&&q.startsWith(previous.query)?previous.matches:items;
    const matches=[];
    for(const item of source){
      let key=searchKeys.get(item);
      if(!key){key={title:folded(title(item)),all:folded(title(item)+' '+extra(item))};searchKeys.set(item,key);}
      if(!words.every(word=>key.all.includes(word)))continue;
      matches.push(item);
      const rank=key.title===q?1000:key.title.startsWith(q)?700:key.title.split(/\s+/).some(word=>word.startsWith(q))?500:key.title.includes(q)?300:100;
      const hit={item,rank,name:key.title};
      let at=best.findIndex(other=>rank>other.rank||(rank===other.rank&&key.title<other.name));
      if(at<0)at=best.length;
      if(at<5)best.splice(at,0,hit);
      if(best.length>5)best.pop();
    }
    matchCache.set(scope,{base:items,size:items.length,query:q,matches});
    return {total:matches.length,items:best};
  }
  const season=value=>String(value||'').replace(/(\d{4})-(\d{2})/,'$1/$2');
  function notesFor(player) {
    let report={};try{report=JSON.parse(Store.get(gid(player)).report||'{}')||{};}catch{return [];}
    return Object.entries(report).filter(([key,value])=>/^(nAth|nOff|nDef|nIntel|nProj|overall)$/i.test(key)&&typeof value==='string'&&value.trim()).map(([key,value])=>({player,label:({nAth:'Athleticism',nOff:'Offense',nDef:'Defense',nIntel:'Intelligence',nProj:'Projection',overall:'Overall'})[key]||key,text:value}));
  }
  function duplicateFor(player,candidates) {
    const ids=new Set((player._grp?.length?player._grp:[player]).map(p=>gid(p)));
    const match=candidates.find(pair=>ids.has(pair.a.id)||ids.has(pair.b.id));
    return match?{confidence:match.score,onOpen:()=>{
      const pair=EuroScoutMergeCenter.detect().player.find(candidate=>
        [candidate.a.id,candidate.b.id].includes(match.a.id)&&[candidate.a.id,candidate.b.id].includes(match.b.id));
      if(pair)EuroScoutMergeCenter.openPair(pair.id);else goView('mergecenter');
    }}:null;
  }
  function playerItem(player,duplicates){
    const group=player._grp?.length?player._grp:[player];
    const latest=group.slice().sort((a,b)=>String(leagueOf(b)?.meta?.season||'').localeCompare(String(leagueOf(a)?.meta?.season||''))||Number(b.g||0)-Number(a.g||0))[0];
    const assignment=effective26(latest),current=assignment&&!isStatus(assignment)?clubByKey(assignment):null;
    const free=assignment===STATUS_FREE,retired=assignment===STATUS_RETIRED;
    const currentRows=group.filter(p=>/^2026\s*[/-]\s*27$/.test(String(leagueOf(p)?.meta?.season||'')));
    const statsRow=currentRows.sort((a,b)=>Number(b.g||0)-Number(a.g||0))[0];
    const lastLeague=leagueOf(latest),lastSeason=season(lastLeague?.meta?.season);
    const comps=current?[...domCompsOf(current),...nextCompsOf(current)].map(c=>c.name):[];
    // NCAA membership is recorded on the current club rather than in the 2026/27 league-entry maps.
    if(current&&!comps.length&&(current.teams||[]).some(t=>t.lg==='ncaa'))comps.push('NCAA D1');
    const chips=[...new Set(comps.filter(Boolean))];
    if(free&&lastLeague?.meta?.name)chips.push(lastLeague.meta.name);
    const club=current?.name||(free?'Free Agent'+(latest.teamName?' · Last club: '+latest.teamName:''):retired?'Retired':'Current club unverified');
    const statsPlayer=free?latest:statsRow;
    const statsSeason=free?lastSeason:'2026/27';
    return {type:'player',title:latest.name,photo:photoOf(latest),position:dbPositionGroup(latest)||latest.role,height:latest.height,born:latest.born,country:countryLabel(latest.country)||latest.country,club,chips,
      stats:[{value:statsPlayer?fmt(statsPlayer.ppg):'—',label:'PPG'},{value:statsPlayer?fmt(statsPlayer.pir):'—',label:'PIR'}],season:statsSeason,watching:isWatched(latest),
      onWatch:()=>toggleWatch(latest.id),duplicate:duplicateFor(latest,duplicates),onOpen:()=>openGlobal(lastLeague?.meta?.id,latest.id)};
  }
  function likelyDuplicates(players){
    const seen=new Map(),pairs=[];
    players.forEach(({p})=>{
      const key=folded(p.name)+'|'+String(p.born||'');
      if(!p.born)return;
      const earlier=seen.get(key);
      if(earlier&&gid(earlier)!==gid(p))pairs.push({a:{id:gid(earlier)},b:{id:gid(p)},score:98});
      else if(!earlier)seen.set(key,p);
    });
    return pairs;
  }
  function queueBackgroundIndex(){
    if(backgroundQueued||!cache)return;
    backgroundQueued=true;
    const run=()=>{
      backgroundQueued=false;
      if(!cache||cache.notesReady)return;
      if(!palette?.isOpen())return;
      const end=Math.min(cache.noteCursor+15,cache.players.length);
      for(let i=cache.noteCursor;i<end;i++)cache.notes.push(...notesFor(cache.players[i].p));
      cache.noteCursor=end;
      if(end<cache.players.length)setTimeout(queueBackgroundIndex,120);
      else {cache.notesReady=true;palette?.refresh();}
    };
    if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1000});else setTimeout(run,20);
  }
  function index(){const players=allPlayersIndexed();if(cache&&cache.players===players)return cache;
    matchCache.clear();
    cache={players,dupes:likelyDuplicates(players),clubs:allClubs(),agencies:window.EuroScoutAgenciesV2?.buildDirectory()?.agencies||[],
      competitions:STATE.data.leagues.filter(L=>!L.meta.teamsOnly).map(L=>L.meta),notes:[],noteCursor:0,notesReady:false,sessions:window.ESSessions?.all()||[]};
    return cache;
  }
  function search(query){
    if(!STATE.data?.leagues)return {};
    if(folded(query).length<2)return {};
    const {players,dupes,clubs,agencies,competitions,notes,sessions}=index();
    const playerMatches=scored(query,players,x=>x.p.name,x=>[x.p.teamName,x.p.country,x.L.meta.name].join(' '),'players');
    const clubMatches=scored(query,clubs,x=>x.name,x=>[x.country,...x.leagues.map(l=>l.name)].join(' '),'clubs');
    const agencyMatches=scored(query,agencies,x=>x.name,x=>[x.last?.player,x.last?.from,x.last?.to].join(' '),'agencies');
    const compMatches=scored(query,competitions,x=>x.name,x=>[x.season,x.id].join(' '),'competitions');
    const noteMatches=scored(query,notes,x=>x.player.name,x=>x.label+' '+x.text,'notes');
    const sessionMatches=scored(query,sessions,x=>[x.a?.name,x.b?.name].filter(Boolean).join(' vs '),x=>[x.competition?.name,x.gameDate,x.note].join(' '),'events');
    if(folded(query).length>=3)queueBackgroundIndex();
    const agencyLogo=name=>{try{const map=JSON.parse(localStorage.getItem('euroscout:agencyLogos:v1')||'{}');return map[folded(name).replace(/[^a-z0-9]+/g,' ')]?.data||'';}catch{return '';}};
    return {
      Players:{total:playerMatches.total,items:playerMatches.items.map(({item})=>playerItem(item.p,dupes)),seeAll:()=>goView('scout')},
      Clubs:{total:clubMatches.total,items:clubMatches.items.map(({item:c})=>({type:'club',title:c.name,subtitle:countryLabel(c.country)||c.country,logo:clubLogo(c),chips:c.leagues.map(l=>l.name),openLabel:'View club',onOpen:()=>{const t=c.teams.find(t=>t.lg!=='directory')||c.teams[0];if(t)openTeamIn(t.lg,t.code);}})),seeAll:()=>goView('teams')},
      Agencies:{total:agencyMatches.total,items:agencyMatches.items.map(({item:a})=>({type:'agency',title:a.name,subtitle:a.players.length+' players · '+a.agents.size+' agents',logo:agencyLogo(a.name),openLabel:'View agency',onOpen:()=>openAgencyPage('agency',a.name)})),seeAll:()=>goView('agencies')},
      Competitions:{total:compMatches.total,items:compMatches.items.map(({item:m})=>({type:'competition',title:m.name,subtitle:season(m.season),chips:m.season?['Season '+season(m.season)]:[],openLabel:'View competition',onOpen:()=>{STATE.league=STATE.data.leagues.find(L=>L.meta.id===m.id)||STATE.league;STATE.allLeagues=false;goView('players');}})),seeAll:()=>goView('players')},
      Reports:{total:noteMatches.total,items:noteMatches.items.map(({item:n})=>({type:'report',title:n.player.name+' · scouting report',subtitle:n.text.slice(0,120),chips:[n.label],openLabel:'Open report',onOpen:()=>openProfile(n.player.id)})),seeAll:()=>goView('scout')},
      Notes:{total:noteMatches.total,items:noteMatches.items.map(({item:n})=>({type:'note',title:n.player.name+' · '+n.label,subtitle:n.text.slice(0,140),openLabel:'Open note',onOpen:()=>openProfile(n.player.id)})),seeAll:()=>goView('scout')},
      Events:{total:sessionMatches.total,items:sessionMatches.items.map(({item:s})=>({type:'event',title:[s.a?.name,s.b?.name].filter(Boolean).join(' vs '),subtitle:[s.gameDate,s.competition?.name].filter(Boolean).join(' · '),openLabel:'Open session',onOpen:()=>ESSessions.openSession(s.id)})),seeAll:()=>goView('scoutlog')}
    };
  }
  function actions(){const edit=callback=>()=>{if(!Store.canEdit()){toast('Editing access required.');return;}callback();};return [
    {title:'New Player',icon:'+',onOpen:edit(()=>window.EuroScoutManualPlayers?.openCreate())},
    {title:'New Club',icon:'+',onOpen:edit(()=>{EuroScoutClubs.addForm(()=>{cache=null;goView('teams');});window.EuroScoutCountryPicker?.mount(document.querySelector('#clubCreateOverlay input[name="country"]'),{countries:COUNTRY_LIST});})},
    {title:'New Agency',icon:'+',onOpen:edit(()=>{const name=prompt('New agency name');if(!name?.trim())return;addAgency(name.trim());cache=null;openAgencyPage('agency',name.trim());})},
    {title:'Open Merge Center',icon:'⧉',onOpen:()=>goView('mergecenter')}
  ];}
  function init(){if(palette)return;const header=document.getElementById('globalSearch');if(!header)return;
    header.placeholder='Search players, clubs, agencies, competitions...';header.setAttribute('aria-label','Open global search');header.setAttribute('aria-haspopup','dialog');
    palette=api().create({search,actions,minQueryLength:2,inputDelay:160,afterClose:()=>{header.value='';}});
    palette.bind(header);
  }
  window.EuroScoutCommandPalette={init,open:query=>palette?.open(query),refresh:()=>palette?.refresh(),search};
})();
