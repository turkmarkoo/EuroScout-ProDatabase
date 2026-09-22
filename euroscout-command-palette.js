(function () {
  'use strict';
  let palette=null,cache=null;
  const api=()=>window.GlobalCommandPalette;
  const folded=value=>api().fold(value);
  const scored=(query,items,title,extra)=>items.map(item=>({item,rank:api().score(query,title(item),extra(item))})).filter(x=>x.rank>=0).sort((a,b)=>b.rank-a.rank||title(a.item).localeCompare(title(b.item)));
  const season=value=>String(value||'').replace(/(\d{4})-(\d{2})/,'$1/$2');
  function notesFor(player) {
    let report={};try{report=JSON.parse(Store.get(gid(player)).report||'{}')||{};}catch{return [];}
    return Object.entries(report).filter(([key,value])=>/^(nAth|nOff|nDef|nIntel|nProj|overall)$/i.test(key)&&typeof value==='string'&&value.trim()).map(([key,value])=>({player,label:({nAth:'Athleticism',nOff:'Offense',nDef:'Defense',nIntel:'Intelligence',nProj:'Projection',overall:'Overall'})[key]||key,text:value}));
  }
  function duplicateFor(player,candidates) {
    const ids=new Set((player._grp?.length?player._grp:[player]).map(p=>gid(p)));
    const match=candidates.find(pair=>ids.has(pair.a.id)||ids.has(pair.b.id));
    return match?{confidence:match.score,onOpen:()=>EuroScoutMergeCenter.openPair(match.id)}:null;
  }
  function playerItem(player,duplicates){
    const group=player._grp?.length?player._grp:[player];
    player=group.slice().sort((a,b)=>String(leagueOf(b)?.meta?.season||'').localeCompare(String(leagueOf(a)?.meta?.season||''))||Number(b.g||0)-Number(a.g||0))[0];
    const L=leagueOf(player),ckey=effective26(player),club=ckey&&!isStatus(ckey)?clubByKey(ckey)?.name:player.teamName;
    const chips=[...new Set(group.map(p=>leagueOf(p)?.meta?.name).filter(Boolean))];
    return {type:'player',title:player.name,photo:photoOf(player),position:dbPositionGroup(player)||player.role,height:player.height,born:player.born,country:countryLabel(player.country)||player.country,club:club||'',chips,
      stats:[{value:fmt(player.ppg),label:'PPG'},{value:fmt(player.pir),label:'PIR'}],season:season(L?.meta?.season),watching:isWatched(player),
      onWatch:()=>toggleWatch(player.id),duplicate:duplicateFor(player,duplicates),onOpen:()=>openGlobal(L?.meta?.id,player.id)};
  }
  function reportIndex(players){return players.flatMap(({p})=>notesFor(p));}
  function index(){if(cache)return cache;
    const players=allPlayersIndexed();
    return cache={players,dupes:window.EuroScoutMergeCenter?.detect().player||[],clubs:allClubs(),agencies:window.EuroScoutAgenciesV2?.buildDirectory()?.agencies||[],
      competitions:STATE.data.leagues.filter(L=>!L.meta.teamsOnly).map(L=>L.meta),notes:reportIndex(players),sessions:window.ESSessions?.all()||[]};
  }
  function search(query){
    if(!STATE.data?.leagues)return {};
    const {players,dupes,clubs,agencies,competitions,notes,sessions}=index();
    const playerMatches=scored(query,players,x=>x.p.name,x=>[x.p.teamName,x.p.country,x.L.meta.name].join(' '));
    const clubMatches=scored(query,clubs,x=>x.name,x=>[x.country,...x.leagues.map(l=>l.name)].join(' '));
    const agencyMatches=scored(query,agencies,x=>x.name,x=>[x.last?.player,x.last?.from,x.last?.to].join(' '));
    const compMatches=scored(query,competitions,x=>x.name,x=>[x.season,x.id].join(' '));
    const noteMatches=scored(query,notes,x=>x.player.name,x=>x.label+' '+x.text);
    const sessionMatches=scored(query,sessions,x=>[x.a?.name,x.b?.name].filter(Boolean).join(' vs '),x=>[x.competition?.name,x.gameDate,x.note].join(' '));
    const agencyLogo=name=>{try{const map=JSON.parse(localStorage.getItem('euroscout:agencyLogos:v1')||'{}');return map[folded(name).replace(/[^a-z0-9]+/g,' ')]?.data||'';}catch{return '';}};
    return {
      Players:{total:playerMatches.length,items:playerMatches.map(({item})=>playerItem(item.p,dupes)),seeAll:()=>goView('scout')},
      Clubs:{total:clubMatches.length,items:clubMatches.map(({item:c})=>({type:'club',title:c.name,subtitle:countryLabel(c.country)||c.country,logo:clubLogo(c),chips:c.leagues.map(l=>l.name),openLabel:'View club',onOpen:()=>{const t=c.teams.find(t=>t.lg!=='directory')||c.teams[0];if(t)openTeamIn(t.lg,t.code);}})),seeAll:()=>goView('teams')},
      Agencies:{total:agencyMatches.length,items:agencyMatches.map(({item:a})=>({type:'agency',title:a.name,subtitle:a.players.length+' players · '+a.agents.size+' agents',logo:agencyLogo(a.name),openLabel:'View agency',onOpen:()=>openAgencyPage('agency',a.name)})),seeAll:()=>goView('agencies')},
      Competitions:{total:compMatches.length,items:compMatches.map(({item:m})=>({type:'competition',title:m.name,subtitle:season(m.season),chips:m.season?['Season '+season(m.season)]:[],openLabel:'View competition',onOpen:()=>{STATE.league=STATE.data.leagues.find(L=>L.meta.id===m.id)||STATE.league;STATE.allLeagues=false;goView('players');}})),seeAll:()=>goView('players')},
      Reports:{total:noteMatches.length,items:noteMatches.map(({item:n})=>({type:'report',title:n.player.name+' · scouting report',subtitle:n.text.slice(0,120),chips:[n.label],openLabel:'Open report',onOpen:()=>openProfile(n.player.id)})),seeAll:()=>goView('scout')},
      Notes:{total:noteMatches.length,items:noteMatches.map(({item:n})=>({type:'note',title:n.player.name+' · '+n.label,subtitle:n.text.slice(0,140),openLabel:'Open note',onOpen:()=>openProfile(n.player.id)})),seeAll:()=>goView('scout')},
      Events:{total:sessionMatches.length,items:sessionMatches.map(({item:s})=>({type:'event',title:[s.a?.name,s.b?.name].filter(Boolean).join(' vs '),subtitle:[s.gameDate,s.competition?.name].filter(Boolean).join(' · '),openLabel:'Open session',onOpen:()=>ESSessions.openSession(s.id)})),seeAll:()=>goView('scoutlog')}
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
    palette=api().create({search,actions,afterOpen:()=>{cache=null;if(!STATE._extraDone)loadExtraLeagues().then(()=>{cache=null;palette.refresh();}).catch(error=>console.warn('Extra leagues unavailable in global search',error));},afterClose:()=>{header.value='';}});
    palette.bind(header);
  }
  window.EuroScoutCommandPalette={init,open:query=>palette?.open(query),refresh:()=>palette?.refresh(),search};
})();
