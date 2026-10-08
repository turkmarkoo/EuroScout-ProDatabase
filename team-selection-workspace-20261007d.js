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
const REGIONAL_COMPETITIONS=new Set(['aba','aba2','euroleague','eurocup','bcl','bclq','fec','enbl']);
const COMPETITION_REGIONS=new Map([
 ['nba','United States'],['gleague','United States'],['ncaa','United States'],['ncaam','United States'],
 ['acb','Spain'],['feb','Spain'],['lba','Italy'],['seriea2','Italy'],['bbl','Germany'],['proa','Germany'],['prob','Germany'],
 ['lnb','France'],['elite2','France'],['bnxt','International'],['sbl','Sweden'],['il','Israel'],['gbl','Greece'],['plk','Poland'],
 ['rou','Romania'],['bsl','Turkiye'],['tbl','Turkiye'],['lkl','Lithuania'],['vtb','International'],['elb','International'],
 ['slo','Slovenia'],['hun','Hungary'],['hrv','Croatia'],['bul','Bulgaria'],['fin','Finland'],['cze','Czechia'],['por','Portugal'],
 ['bsn','Puerto Rico'],['cba','China'],['jbl','Japan'],['kbl','South Korea'],['pba','Philippines'],['arg','Argentina'],
 ['nbb','Brazil'],['nbl','Australia'],['cebl','Canada'],['autbsl','Austria'],['cyp','Cyprus'],['kls','Serbia']
]);
const ABA2_CURRENT=[
 ['BOR','Borac WWIN','Bosnia and Herzegovina',76],['GGD','GGD Šenčur','Slovenia',88],['MOR','Mornar-Barsko zlato','Montenegro',38],['VOJ','Vojvodina mts','Serbia',82],
 ['HER','Hercegovac Aling-Conel','Serbia',112],['POD','Podgorica Bemax','Montenegro',75],['SLO','Sloboda Energoinvest','Bosnia and Herzegovina',48],['TFT','TFT Skopje','North Macedonia',87],
 ['ECE','ECE Triglav Kranj','Slovenia',113],['MZT','MZT Skopje Aerodrom','North Macedonia',32],['SL1','Sloboda Užice','Serbia',71],['SUT','Sutjeska Elektroprivreda Nikšić','Montenegro',37],
 ['BAS','Basket Živinice','Bosnia and Herzegovina',114],['PRI','Primorje 1945','Montenegro',104],['VZG','Virtus Zagreb','Croatia',90],['ZLA','Zlatibor Mozzart','Serbia',70]
].map(([code,name,country,id])=>({key:'aba2|'+code,name,country,logo:'https://www.aba-liga.com/images/club/150x150/'+id+'.png'}));
const SERIE_A2_CURRENT=[
 ['1501090','Halley Campania Avellino Basket','png','FOiNhHkP'],['1','Flats Service Fortitudo Bologna','jpg','IXtKxpYh'],['9675','Valtur Brindisi','png','RZbXA8ja'],['36002','ProValue Juvecaserta 2021','png','FhucKQ7W'],
 ['100118','Sella Cento','png','c-rlBzx5'],['1501072','UEB Gesteco Cividale','png','lUmce1GX'],['9612','Ferraroni Juvi Cremona 1952','png','eo2GOplm'],['10050','Unieuro Forlì','png','cwHdF1dM'],
 ['13088','Libertas Livorno 1947','png','npdC1KbO'],['32106','Gemini Mestre','png','xJXfOT6V'],['32014','Wegreenit Urania Milano','png','jf_2GoDs'],['11033','La T Tecnica Gema Montecatini','png','HDcYW-LX'],
 ['7','CMT Orange Tools Pesaro','jpg','PMHKZ7DY'],['9555','Lumos Pistoia Basket','png','MzzMoeI7'],['1501075','RSR Sebastiani Rieti','png','7iAJf0Zd'],['100143','Dole Basket Rimini','jpg','we1PhYuw'],
 ['9678','Crifo Wines Ruvo di Puglia','png','KsQsMgGM'],['9503','Banco di Sardegna Sassari','png','91uQgoWk'],['100145','Reale Mutua Torino','png','Op38aFU6'],['9502','Elachem Vigevano 1955','jpg','lBvF023O']
].map(([code,name,ext,itok])=>({key:'seriea2|lnp-'+code,name,country:'Italy',logo:'https://static.legapallacanestro.com/sites/default/files/styles/255_x/public/team_logo/'+code+'.'+ext+'?itok='+itok}));
const KNOWN_TEAM_LOGOS=new Map([
 ['roanne','https://www.chorale-roanne.com/media/derivees/96/site__logo-chorale-roanne-1bc86da5.avif'],
 ['paulacqorthez','https://www.chorale-roanne.com/media/derivees/96/site__pau-lacq-orthez-9f914538.avif'],
 ['saintquentinbb','https://sqbb.fr/logo.svg'],
 ['cbliege','https://static.wixstatic.com/media/0088ba_304e9eaba3b84d6297858ebb5d2bef99~mv2.png']
]);
function region(meta,teams){const id=competitionIdentity(meta).id;if(REGIONAL_COMPETITIONS.has(id))return'International';if(COMPETITION_REGIONS.has(id))return COMPETITION_REGIONS.get(id);if(meta.region)return meta.region;if(meta.country)return meta.country;const countries=[...new Set(teams.map(c=>c.country).filter(Boolean))];return countries.length===1?countries[0]:'International';}
function competitionLogo(comp){
 const registry=window.DragonHubAssetRegistry||window.BrandAssetsRegistry;
 let asset=null;try{asset=registry?.getAsset?.(comp.id)||registry?.get?.(comp.id);}catch(_){}
 const url=asset?.lightLogo||asset?.logoLight||asset?.logo||window.EUROSCOUT_COMPETITION_ASSETS?.[comp.id]||comp.logo;
 if(url)return'<span class="tsw-comp-logo"><img src="'+attr(url)+'" alt=""></span>';
 return'<span class="tsw-comp-logo tsw-logo-fallback" aria-label="'+attr(comp.name)+'">'+safe(initialsOf(comp.name))+'</span>';
}
function clubLogo(club){if(typeof clubBadge==='function')return clubBadge(club,38);return'<span class="tsw-club-logo">'+safe(initialsOf(club.name))+'</span>';}
function currentCompetitionIds(club){const ids=[];try{if(typeof nextCompsOf==='function')ids.push(...nextCompsOf(club).map(c=>c.id));if(typeof domCompsOf==='function')ids.push(...domCompsOf(club).map(c=>c.id));}catch(_){}return[...new Set(ids.filter(Boolean))];}
const COMPETITION_ALIASES=[
 ['euroleague','EuroLeague',/^(turkishairlines)?euroleague$/],['eurocup','EuroCup',/^(bkt)?eurocup$/],
 ['aba2','ABA League 2',/^abaleague2$/],['aba','ABA League',/^(admiralbet)?abaleague$/],
 ['bclq','BCL Qualifiers',/^(basketballchampionsleague|bcl)qualifiers$/],['bcl','Basketball Champions League',/^(basketball)?championsleague$/],['fec','FIBA Europe Cup',/^fibaeuropecup$/],['acb','Liga ACB',/^(ligaendesa|ligaacb|acb)$/],
 ['lnb','Betclic Élite',/^(lnbproa|betclicelite|francebetclicelite|franceproa)$/],['elite2','France · Élite 2',/^(france)?elite2$/],
 ['bnxt','BNXT League',/^bnxt(league)?$/],['proa','Germany · ProA',/^(german|germany)?proa$/],['prob','Germany · ProB',/^(german|germany)?prob$/],
 ['lba','Lega A',/^(legabasketseriea|legaseriea|lba|legaa)$/],['seriea2','Serie A2',/^(italy)?seriea2(italy)?$/],
 ['jbl','B.League (Japan B1)',/^(japanbpremier|bleaguejapanb1)$/],['gleague','NBA G League',/^(nba)?gleague$/]
];
function competitionIdentity(meta){const name=fold(meta.name).replace(/20\d{2}\s*[\/-]\s*(?:20)?\d{2}/g,'').replace(/[^a-z0-9]/g,'');const baseId=String(meta.id||'').replace(/26$/,'');const hit=COMPETITION_ALIASES.find(x=>x[2].test(name)||baseId===x[0]);return hit?{key:hit[0],id:hit[0],name:hit[1]}:{key:'name:'+name,id:meta.id,name:meta.name};}
function directoryCompetitionId(name){return'directory:'+fold(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function clubLogoUrl(club){if(!club)return'';if(club.logo)return club.logo;const team=(club.teams||[]).find(row=>row.logo);return team?.logo||'';}
const teamNameKey=value=>fold(value).replace(/[^a-z0-9]/g,'');
function closeTeamName(left,right){const a=teamNameKey(left),b=teamNameKey(right);return a===b||(Math.min(a.length,b.length)>=7&&(a.includes(b)||b.includes(a)));}
function uniqueCompetitionTeams(teams){
 const byIdentity=new Map();
 for(const club of teams||[]){
  const country=fold(club.country||'').replace(/[^a-z0-9]/g,''),name=fold(club.name).replace(/[^a-z0-9]/g,''),identity=country+'|'+name;
  const old=byIdentity.get(identity);
  if(!old){byIdentity.set(identity,club);continue;}
  const score=value=>(clubLogoUrl(value)?4:0)+(value.country?2:0)+(String(value.key||'').includes('26|')?1:0);
  if(score(club)>score(old))byIdentity.set(identity,club);
 }
 return[...byIdentity.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function currentTeamClub(ref,competitionId,competitionName,clubs,data){
 const wanted=teamNameKey(ref.name),key=ref.currentKey||ref.key||competitionId+'|'+wanted;
 let club=typeof clubByKey==='function'?clubByKey(key):null;
 /* A live statistics feed can use the competition's own team key while the
    roster registry uses the domestic key. The published 2026/27 entry is the
    stable bridge between those two identities (for example Tortona). */
 const seasonRef=(data.season2627?.comps?.[competitionId]?.teams||[]).find(team=>closeTeamName(team.name,ref.name));
 if(!club&&seasonRef?.key&&typeof clubByKey==='function')club=clubByKey(seasonRef.key);
 const code=String(key).split('|')[1]||'';
 const sourceLeague=(data.leagues||[]).find(league=>competitionIdentity(league.meta).id===competitionId);
 const sourceTeam=(sourceLeague?.teams||[]).find(team=>team.code===code)||
  (sourceLeague?.teams||[]).find(team=>fold(team.name).replace(/[^a-z0-9]/g,'')===wanted);
 const nearSourceTeam=sourceTeam||(sourceLeague?.teams||[]).find(team=>{const name=fold(team.name).replace(/[^a-z0-9]/g,'');return Math.min(name.length,wanted.length)>=7&&(name.includes(wanted)||wanted.includes(name));});
 if(!club&&sourceTeam&&typeof clubByKey==='function')club=clubByKey(sourceLeague.meta.id+'|'+sourceTeam.code);
 if(!club)club=clubs.find(candidate=>teamNameKey(candidate.name)===wanted)||null;
 const officialAba=competitionId==='aba'?window.EUROSCOUT_ABA_ROSTERS?.teams?.find(team=>{const name=fold(team.name).replace(/[^a-z0-9]/g,'');return name===wanted||name.endsWith(wanted)||wanted.endsWith(name);}):null;
 const globalSourceTeam=(data.leagues||[]).flatMap(league=>league.teams||[]).find(team=>fold(team.name).replace(/[^a-z0-9]/g,'')===wanted&&team.logo);
 const nbaLogo=competitionId==='nba'&&/^\d+$/.test(code)?'https://cdn.nba.com/logos/nba/'+code+'/primary/L/logo.svg':competitionId==='gleague'&&/^\d+$/.test(code)?'https://cdn.nba.com/logos/gleague/'+code+'/primary/L/logo.svg':'';
 const logo=ref.logo||(officialAba?.id?'https://www.aba-liga.com/images/club/150x150/'+officialAba.id+'.png':'')||nearSourceTeam?.logo||globalSourceTeam?.logo||nbaLogo||KNOWN_TEAM_LOGOS.get(wanted)||clubLogoUrl(club);
 const country=ref.country||sourceTeam?.country||club?.country||'';
 const resolvedKey=club?.key||seasonRef?.key||key;
 return{...(club||{}),key:resolvedKey,name:ref.name||sourceTeam?.name||club?.name||resolvedKey,country,logo,leagues:club?.leagues||[{id:competitionId,name:competitionName}],teams:logo?[{lg:competitionId,name:ref.name||sourceTeam?.name||'',country,logo},...(club?.teams||[])]:club?.teams||[{lg:competitionId,name:ref.name||'',country}]};
}
let competitionCache=null;
function buildCompetitions(){
 if(typeof allClubs!=='function')return[];
 const clubs=allClubs(),defs=new Map(),data=window.STATE?.data||{};
 if(competitionCache?.data===data&&competitionCache.clubs===clubs&&competitionCache.count===clubs.length)return competitionCache.value;
 const addDef=(value,replaceTeams=false)=>{if(!value?.id||value.id==='n2627'||value.id==='directory')return;const identity=competitionIdentity(value),old=defs.get(identity.key)||{},incoming=value._teamKeys||[],teamKeys=replaceTeams&&incoming.length?incoming:[...(old._teamKeys||[]),...incoming],rawRefs=[...(old._rawRefs||[]),...(value._rawRefs||[])];defs.set(identity.key,{...old,...value,id:identity.id,name:identity.name,_ids:[...new Set([...(old._ids||[]),value.id])],_teamKeys:[...new Set(teamKeys)],_rawRefs:rawRefs});};
 for(const L of data.leagues||[])if(L.meta.id!=='n2627'&&(typeof showsTeams!=='function'||showsTeams(L.meta)))addDef({...L.meta,_rawRefs:(L.teams||[]).map(team=>({currentKey:L.meta.id+'|'+team.code,...team}))});
 /* Authenticated payloads may retain registry clubs without the original
    league collection, so club memberships are a second competition source. */
 for(const club of clubs)for(const league of club.leagues||[]){if(!league?.id||league.id==='n2627'||league.id==='directory')continue;addDef({id:league.id,name:league.name||league.id});}
 const directoryGroups=new Map();
 for(const club of clubs)for(const team of club.teams||[]){if(team.lg!=='directory'||!team.lgName)continue;const id=directoryCompetitionId(team.lgName),group=directoryGroups.get(id)||{id,name:team.lgName,_clubs:[]};group._clubs.push(club);directoryGroups.set(id,group);}
 for(const group of directoryGroups.values()){const identity=competitionIdentity(group);if(!defs.has(identity.key))defs.set(identity.key,{...group,id:identity.id,name:identity.name,_ids:[group.id],_teamKeys:[]});}
 const addCurrent=source=>Object.entries(source||{}).forEach(([id,value])=>addDef({id,name:value.name||id,_teamKeys:(value.teams||[]).map(t=>t.key).filter(Boolean),_currentRefs:value.teams||[]},true));
 addCurrent(data.season2627?.comps);addCurrent(data.domestic2627?.leagues);
 /* The official 2026/27 ABA2 standings define a 16-team regional field. */
 {const old=defs.get('aba2')||{},teams=ABA2_CURRENT.map(team=>currentTeamClub(team,'aba2','ABA League 2',clubs,data));defs.set('aba2',{...old,id:'aba2',name:'ABA League 2',_ids:[...new Set([...(old._ids||[]),'aba2'])],_teamKeys:[],_currentRefs:[],_clubs:teams});}
 /* LNP publishes one 20-team Serie A2 field for 2026/27. Older imports also
    contain the prior 23-team season under a second label. */
 {const old=defs.get('seriea2')||{},teams=SERIE_A2_CURRENT.map(team=>currentTeamClub(team,'seriea2','Serie A2',clubs,data));defs.set('seriea2',{...old,id:'seriea2',name:'Serie A2',_ids:[...new Set([...(old._ids||[]),'seriea2'])],_teamKeys:[],_currentRefs:[],_clubs:teams});}
 /* BCL qualifier labels from the database and the official feed are one event. */
 if(window.EUROSCOUT_BCLQ_2026?.teams?.length){
  const teams=window.EUROSCOUT_BCLQ_2026.teams.map(team=>currentTeamClub({currentKey:'bclq|'+team.code,...team},'bclq','BCL Qualifiers',clubs,data));
  const old=defs.get('bclq')||{};defs.set('bclq',{...old,id:'bclq',name:'BCL Qualifiers',_ids:[...new Set([...(old._ids||[]),'bclq'])],_teamKeys:[],_currentRefs:[],_clubs:teams});
 }
 /* FIBA's current event payload is authoritative. Club membership maps also
    contain historical entries and can otherwise double the field. */
 for(const [id,competition] of Object.entries(window.EuroScoutFIBAClub?.data?.competitions||{})){
  const identity=competitionIdentity({id,name:competition.name||id}),old=defs.get(identity.key)||{};
  const teams=(competition.teams||[]).map(team=>typeof clubByKey==='function'?clubByKey(team.currentKey):null).map((club,index)=>club||(()=>{const team=competition.teams[index];return{key:team.currentKey,name:team.name,country:team.country||'',logo:team.logo||'',leagues:[{id:id+'26',name:competition.name}],teams:[{lg:id+'26',name:team.name,country:team.country||'',logo:team.logo||''}]};})());
  defs.set(identity.key,{...old,id:identity.id,name:identity.name,_ids:[...new Set([...(old._ids||[]),id,id+'26'])],_teamKeys:[],_clubs:teams,_officialFiba:true});
 }
 defs.delete('n2627');
 const value=[...defs.values()].map(meta=>{
   const keyed=(meta._teamKeys||[]).map(key=>typeof clubByKey==='function'?clubByKey(key):null).filter(Boolean),uniqueKeyed=[...new Map(keyed.map(c=>[c.key,c])).values()];
   const ids=meta._ids||[meta.id],current=clubs.filter(c=>currentCompetitionIds(c).some(id=>ids.includes(id)));
   const currentRefs=(meta._currentRefs||[]).map(ref=>currentTeamClub(ref,meta.id,meta.name,clubs,data));
   const sourceRefs=(meta._rawRefs||[]).map(ref=>currentTeamClub(ref,meta.id,meta.name,clubs,data));
   const rawTeams=meta._clubs?meta._clubs:currentRefs.length?currentRefs:sourceRefs.length?sourceRefs:uniqueKeyed.length?uniqueKeyed:current.length?current:clubs.filter(c=>(c.leagues||[]).some(x=>ids.includes(x.id)));
   const teams=uniqueCompetitionTeams(rawTeams);
   return{id:meta.id,name:meta.name,region:region(meta,teams),category:category(meta),logo:meta.logo||'',teams};
 }).filter(c=>c.teams.length).sort((a,b)=>a.name.localeCompare(b.name));
 competitionCache={data,clubs,count:clubs.length,value};return value;
}
function open(options={}){
 close();
 let competitions=[];
 const current=typeof clubByKey==='function'?clubByKey(options.currentKey):null,currentIds=current?currentCompetitionIds(current):[];
 let selectedComp=null,selectedTeam=null,cat='all',compQuery='',teamQuery='';
 const mask=document.createElement('div');mask.className='tsw-mask';mask.id='teamSelectionWorkspace';
 mask.innerHTML='<section class="tsw-dialog" role="dialog" aria-modal="true" aria-labelledby="tswTitle">'+
  '<header><span class="tsw-head-icon" aria-hidden="true">♟</span><div><h2 id="tswTitle">Select Team '+safe(String(options.slot||'').toUpperCase())+'</h2><p>Choose a competition and team for your scouting matchup.</p></div><button type="button" class="tsw-close" aria-label="Close">×</button></header>'+
  '<div class="tsw-grid"><section class="tsw-panel tsw-competitions"><h3>1. Select Competition</h3><label class="tsw-search"><span>⌕</span><input type="search" id="tswCompSearch" placeholder="Search competitions or teams…" autocomplete="off"></label><div class="tsw-cats" role="group" aria-label="Competition categories">'+[['all','All'],['youth','Youth'],['national','National'],['club','Club'],['other','Other']].map(([id,label])=>'<button type="button" data-tsw-cat="'+id+'" class="'+(id==='all'?'on':'')+'">'+label+'</button>').join('')+'</div><div id="tswRecent"></div><div class="tsw-list" id="tswCompetitionList"></div></section>'+
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
 mask.querySelectorAll('[data-tsw-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.tswCat;mask.querySelectorAll('[data-tsw-cat]').forEach(x=>x.classList.toggle('on',x===b));renderCompetitions();});
 function done(){if(!(selectedComp&&selectedTeam))return;remember(selectedComp.id);selectedTeams.set(selectedTeam.key,selectedTeam);const result={competition:selectedComp,team:selectedTeam};close();options.onConfirm?.(result);}
 $('.tsw-confirm').onclick=done;$('.tsw-cancel').onclick=close;$('.tsw-close').onclick=close;mask.onclick=e=>{if(e.target===mask)close();};
 mask.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Enter'&&document.activeElement?.closest('.tsw-search')&&selectedComp&&selectedTeam){e.preventDefault();done();}};
 compList.innerHTML='<div class="tsw-empty" role="status">Loading competitions and current rosters…</div>';
 teamList.innerHTML='<div class="tsw-empty">The team list will appear here.</div>';
 renderSummary();
 requestAnimationFrame(()=>setTimeout(()=>{
  if(!document.body.contains(mask))return;
  competitions=buildCompetitions();
  selectedComp=current?competitions.find(c=>currentIds.includes(c.id))||competitions.find(c=>(current.leagues||[]).some(l=>l.id===c.id)):null;
  selectedTeam=current&&selectedComp?current:null;
  renderRecent();renderCompetitions();renderTeams();renderSummary();$('#tswCompSearch').focus();
 },0));
}
function close(){document.querySelector('#teamSelectionWorkspace')?.remove();}
const selectedTeams=new Map();
window.ESTeamSelection={open,close,teamForKey:key=>selectedTeams.get(key)||null,_buildCompetitions:buildCompetitions};
})();
