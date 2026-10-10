/* Read-only, authenticated Player Dossier source. No player data is stored in a report. */
(function(){'use strict';
const HUB='https://dragonshub.mtscouting.com',active=new URLSearchParams(location.search).get('dossier')==='1';
let requested=[],inFlight=false,lastInventory='';
const safeURL=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
function basic(original){
 const p=currentSeasonProfile(original),v=window.ESPlayerScouting?.values(p)||{},key=effective26(p),club=key&&!isStatus(key)?clubByKey(key):null;
 const evidence=window.EuroScoutMarket?.evidence(p,next26Get())||{},market=window.EuroScoutMarketRecords?.view(p,evidence)||{};
 const lines=personLines(p).filter(x=>!isOtherLeague(leagueOf(x)?.meta)),recent=lines.filter(x=>ESQuickStats.seasonOf(x)!=='Season unknown').sort((a,b)=>ESQuickStats.seasonOf(b).localeCompare(ESQuickStats.seasonOf(a))||(b.g||0)-(a.g||0));
 const last=recent.find(x=>ESQuickStats.seasonOf(x)!=='2026/27')||recent[0],level=levelBand(p);
 const currentLeagues=club?[...(typeof domCompsOf==='function'?domCompsOf(club):[]),...(typeof nextCompsOf==='function'?nextCompsOf(club):[])].map(x=>x.name):lines.filter(x=>ESQuickStats.seasonOf(x)==='2026/27').map(x=>ESQuickStats.competitionOf(x).name);
 return {id:String(gid(p)),sourceIds:personLines(p).map(x=>String(x.id)),name:p.name||'',born:String(v.born||p.born||''),height:v.height||p.height||'',country:v.country||p.country||'',position:v.position||p.role||p.pos||'',hand:v.hand||p.hand||'',primaryRole:v.primaryRole||'',secondaryRole:v.secondaryRole||'',photo:photoOf(p)||'',club:club?.name||evidence.club||'',lastClub:last?ESQuickStats.clubNameOf(last)||'':'',leagues:[...new Set(currentLeagues.filter(Boolean))],projection:level?.label||'',projectionAutomatic:!level?.manual,draftStock:p.draftStock||p.draftProjection||'',watchlist:isWatched(p),status:statusLabel(key)||evidence.label||'Unconfirmed',availability:market.availability||'Unknown',availabilitySource:evidence.url||market.sourceURL||'',contractStatus:p.contractStatus||'',contractUntil:p.contractUntil||'',agent:p.agent||'',agency:p.agency||'',url:location.origin+location.pathname+'#p='+encodeURIComponent(p.id)};
}
function details(id){
 const p=player(id)||assignPool().find(x=>gid(x)===id);if(!p)return null;
 const out={...basic(p),canonicalId:String(gid(p)),id:String(id)},rows=personLines(p).filter(x=>!isOtherLeague(leagueOf(x)?.meta)&&Number(x.g)>0),seasons=[...new Set(rows.map(x=>ESQuickStats.seasonOf(x)).filter(x=>x!=='Season unknown'))].sort().reverse().slice(0,3);
 out.stats=ESQuickStats.distinctLines(rows.filter(x=>seasons.includes(ESQuickStats.seasonOf(x)))).sort((a,b)=>ESQuickStats.seasonOf(b).localeCompare(ESQuickStats.seasonOf(a))).map(x=>({season:ESQuickStats.seasonOf(x),club:ESQuickStats.clubNameOf(x),competition:ESQuickStats.competitionOf(x).name,g:x.g,mpg:x.mpg,pts:x.ppg,reb:x.rpg,ast:x.apg,stl:x.spg,blk:x.bpg,fg:x.fgp,three:x.f3p,ft:x.ftp}));
 const reports=reportRecords(p).map(r=>parseReport(r.report)),seed=effectiveReport(p),rep=window.ESRecordMerge?ESRecordMerge.mergeReports([seed,...reports]):seed;
 const notes=value=>window.ESRecordMerge?.notes(value)||bulletParse(value);
 out.strengths=notes(rep.nStrengths);out.improve=notes(rep.nImprove);
 out.scoutingNotes=[['Athleticism','nAth'],['Offense','nOff'],['Defense','nDef'],['Intel','nIntel'],['Projection','nProj'],['Recommendation','nRecommend'],['Overall','overall']].map(([label,k])=>({label,items:notes(rep[k])})).filter(x=>x.items.length);
 const links=[['EuroScout',out.url],['EuroBasket',(window.EUROSCOUT_EBLINKS||{})[ebKey(p)]||p._ext],['RealGM',p._rgm],['Proballers',p._proballers],['Link',p._otherLink]],r=recOf(p)||{};
 for(const value of [p.video,r.videoUrl,r.video,p.googleDrive,...(Array.isArray(p.videoLinks)?p.videoLinks:[]),...(Array.isArray(r.links)?r.links:[])]){const url=typeof value==='string'?value:value?.url;links.push([/drive\.google\.com/i.test(url||'')?'Google Drive':'Video',url]);}
 const seen=new Set();out.links=links.map(([label,url])=>({label,url:safeURL(url)})).filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url));return out;
}
async function ready(){
 await window.ESAccess?.ready;if(!window.ESAccess?.internal)throw Error('Sign in through DragonHub to load EuroScout.');
 const started=Date.now();while(!window.EuroScoutCatalogueReady){if(Date.now()-started>90000)throw Error('EuroScout is still loading. Please retry.');await new Promise(r=>setTimeout(r,200));}
 if(!window.ESQuickStats)throw Error('Statistics module unavailable.');
}
async function respond(msg){
 await ready();await Store.refreshPrivate?.();window.EuroScoutMarketRecords?.refresh?.();
 if(msg.action==='inventory'){await loadCoreEnrichmentScripts();await loadMatchupRosterScripts();rebuildLinks();applyOverrides();return {players:assignPool().map(basic).filter(p=>p.name),checkedAt:new Date().toISOString()};}
 if(msg.action==='players'){requested=[...new Set((msg.ids||[]).filter(x=>typeof x==='string'))].slice(0,100);return {players:requested.map(details).filter(Boolean),checkedAt:new Date().toISOString()};}
 throw Error('Unknown dossier action');
}
window.addEventListener('message',async e=>{const msg=e.data;if(e.origin!==HUB||e.source!==parent||!active||msg?.type!=='dragonshub:dossier-request'||typeof msg.requestId!=='string'||msg.requestId.length>100)return;
 try{const result=await respond(msg);parent.postMessage({type:'euroscout:dossier-result',requestId:msg.requestId,result},HUB);}catch(error){parent.postMessage({type:'euroscout:dossier-result',requestId:msg.requestId,error:error.message},HUB);}
});
if(active){document.documentElement.classList.add('dossier-source-mode');setInterval(async()=>{if(inFlight||!requested.length||!window.ESAccess?.internal||document.visibilityState!=='visible')return;inFlight=true;try{await Store.refreshPrivate?.();window.EuroScoutMarketRecords?.refresh?.();const result={players:requested.map(details).filter(Boolean),checkedAt:new Date().toISOString()},stamp=JSON.stringify(result.players);if(stamp!==lastInventory){lastInventory=stamp;parent.postMessage({type:'euroscout:dossier-live',result},HUB);}}catch{}finally{inFlight=false;}},10000);}
window.ESDossierSource={basic,details,safeURL};
})();
