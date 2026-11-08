/* Owner-only schedule and roster/stat supplement. Never persisted in the public core. */
(function(){'use strict';
const OWNER='markoturk.scouting@gmail.com',ALIASES={fra:'lnb',fra2:'elite2',aus:'nbl',cro:'hrv',aut:'autbsl',ita2:'seriea2',gbr:'britain',kos:'kosovo',isl:'iceland',svk:'slovakia',mne:'montenegro',bih:'bosnia',den:'denmark',sui:'swiss'};
let feed=null,headId='',pending=null,checked=0,problem='',teamKeys=new Map();
const allowed=()=>!!(window.ESAccess?.internal&&ESAccess.owner&&ESAccess.user?.email?.toLowerCase()===OWNER);
const comp=id=>ALIASES[id]||id;
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function resetTeams(){if(typeof DBTEAM_LIST!=='undefined'){DBTEAM_LIST=null;DBTEAM_BYKEY=null;CLUBS=null;CLUB_BY_TEAMKEY=null;DOM27=null;NEXTCOMP=null;}teamKeys.clear();}
function validate(data){
 if(data?.schema!==1||data.quality_policy!=='private_schedule_fixtures'||data.delivery!=='firebase_admin_only'||!Array.isArray(data.fixtures)||!Array.isArray(data.leagues))throw Error('Private schedule format changed.');
 if(data.leagues.some(l=>!l.meta?.privateBoardSchedule||!Array.isArray(l.players)||l.players.length||!Array.isArray(l.teams)))throw Error('Private schedule cannot contain player statistics.');
 if(data.fixtures.some(g=>!g.id||!g.comp||!g.home?.code||!g.away?.code||(g.played&&(!g.date||!Number.isFinite(g.hs)||!Number.isFinite(g.as)||g.hs===g.as))))throw Error('Invalid private schedule game.');
 const ids=new Set(['denmark','slovakia','nbl','britain','cebl','bul','lnb','elite2','swiss']);
 if(data.statsLeagues!=null&&(!Array.isArray(data.statsLeagues)||data.statsLeagues.some(l=>!l.meta?.privateOwnerFeed||!/^dragons-(den|svk|aus|gbr|cebl)-\d+$/.test(l.meta.id)||!Array.isArray(l.players)||!Array.isArray(l.teams)||!['2026/27','2026'].includes(l.meta.statsSeason))))throw Error('Invalid private statistics supplement.');
 if(data.rosterPacks!=null&&(!Array.isArray(data.rosterPacks)||data.rosterPacks.some(p=>!ids.has(p.id)||(p.season!=='2026/27'&&!(p.id==='cebl'&&p.season==='2026'))||!Array.isArray(p.roster)||!Array.isArray(p.teams))))throw Error('Invalid private roster supplement.');
 if((data.statsLeagues||[]).some(l=>l.players.some(p=>!p.id||!p.name||!Number.isFinite(p.g)||p.g<=0))||(data.rosterPacks||[]).some(p=>p.roster.some(r=>!r.id||!r.name||!r.teamId)))throw Error('Invalid private player identity.');
 if((data.rosterPacks||[]).some(p=>p.id==='swiss'&&!p.validatedMetricAverages))throw Error('Swiss metric coverage has not been validated.');
 return data;
}
async function refresh(force=false){
 if(!allowed()){if(feed){feed=null;headId='';resetTeams();}return false;}
 if(pending)return pending;if(!force&&Date.now()-checked<60000)return false;checked=Date.now();
 pending=(async()=>{try{const head=await ESAccess.get('dragonsBoardState/current');if(!head)return false;const id=ESAccess.field(head,'snapshot');if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid private schedule pointer.');if(id===headId)return false;const next=validate(JSON.parse(await ESAccess.readPayload('dragonsBoardSnapshots',id)));if(!allowed())return false;feed=next;headId=id;problem='';resetTeams();return true;}catch(error){problem='Additional league schedules could not refresh. The last loaded schedules are retained.';console.warn(problem,error);return false;}})();
 try{return await pending;}finally{pending=null;}
}
function missing(){const current=new Set((window.EuroScoutDragons?.fixtures?.()||[]).map(g=>comp(g.comp)));return allowed()&&feed?feed.leagues.filter(l=>!current.has(comp(feed.fixtures.find(g=>g.league_id===l.meta.id)?.comp||l.meta.dragonsCompetition?.toLowerCase()))):[];}
function extendTeams(out){
 teamKeys.clear();
 for(const l of missing()){
  const sample=feed.fixtures.find(g=>g.league_id===l.meta.id),id=comp(sample?.comp||l.meta.dragonsCompetition.toLowerCase());
  for(const t of l.teams){
   const proposed=id+'|'+t.code,exact=out.find(x=>x.key===proposed),matches=out.filter(x=>normal(x.name)===normal(t.name)&&(!x.country||!t.country||normal(x.country)===normal(t.country)));
   const found=exact||(matches.length===1?matches[0]:null),key=found?.key||proposed;
   if(!found)out.push({key,code:t.code,lg:id,lgName:l.meta.name,name:t.name,country:t.country||'',city:t.city||'',logo:t.logo||null,privateScheduleOnly:true});
   teamKeys.set(l.meta.id+'|'+t.code,key);
  }
 }
}
function fixtures(){
 if(!allowed()||!feed)return [];
 if(typeof allDbTeams==='function')allDbTeams();
 const ids=new Set(missing().map(l=>l.meta.id));
 return feed.fixtures.filter(g=>ids.has(g.league_id)).map(g=>({...g,comp:comp(g.comp),privateSchedule:true,home:{...g.home,key:teamKeys.get(g.league_id+'|'+g.home.code)||''},away:{...g.away,key:teamKeys.get(g.league_id+'|'+g.away.code)||''}}));
}
function coverage(id){if(!allowed()||!feed)return null;const rows=fixtures().filter(g=>g.comp===id),l=feed.leagues.find(l=>l.meta.id===rows[0]?.league_id);return l?{...l.meta,games:rows.length,completed:rows.filter(g=>g.played).length,undated:rows.filter(g=>!g.date).length}:null;}
window.ESPrivateFixtures={refresh,fixtures,extendTeams,validate,coverage,statsLeagues:()=>allowed()?feed?.statsLeagues||[]:[],rosterPacks:()=>allowed()?feed?.rosterPacks||[]:[],generated:()=>allowed()?feed?.generated||'':'',problems:()=>allowed()&&problem?[problem]:[]};
window.addEventListener?.('es-access-role',()=>{if(!allowed()){feed=null;headId='';resetTeams();}});
})();
