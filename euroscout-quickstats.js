/* EuroScout — Quick Stats: the numbers, without leaving the Scouting matchup.
   A slide-out panel with a sidebar: Overview · Offense · Defense · Shooting ·
   Playmaking · Rebounding · Advanced · Game log. Percentiles are the player's
   standing inside his own league (the database already holds them). */
(function(){
'use strict';
const TABS=[['overview','Overview'],['offense','Offense'],['defense','Defense'],['shooting','Shooting'],['playmaking','Playmaking'],['rebounding','Rebounding'],['advanced','Advanced'],['log','Game log']];
const LOWER_IS_BETTER=new Set(['topg','tov40','tovp']);
let tab='overview',current=null,line=null,seasonChoice='';
const percentilePools=new Map();
const n=(v,d)=>v==null||v===''||Number.isNaN(Number(v))?'—':Number(v).toFixed(d==null?1:d);
const pc=v=>v==null||v===''?'—':n(v,1)+'%';
const fmtDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(v||'');};
function pctOf(p,k){
 const saved=p.pct&&p.pct[k];
 if(saved!=null)return LOWER_IS_BETTER.has(k)?100-saved:saved;
 // Only compare qualified players in the same competition and season. A
 // qualifier's one-game line is not a trustworthy percentile distribution.
 if(p.qualified===false||Number(p.g)<5||Number(p.mpg)<10||p[k]==null||p[k]===''||!Number.isFinite(Number(p[k])))return null;
 const key=p.league+'|'+seasonOf(p);
 if(!percentilePools.has(key))percentilePools.set(key,{
  peers:allPlayersEvery().filter(x=>x.league===p.league&&seasonOf(x)===seasonOf(p)&&
   x.qualified!==false&&Number(x.g)>=5&&Number(x.mpg)>=10),metrics:new Map()
 });
 const pool=percentilePools.get(key);
 if(!pool.metrics.has(k))pool.metrics.set(k,pool.peers.filter(x=>x[k]!=null&&x[k]!=='').map(x=>Number(x[k])).filter(Number.isFinite));
 const values=pool.metrics.get(k),value=Number(p[k]);
 if(values.length<20)return null;
 const below=values.filter(x=>x<value).length,tied=values.filter(x=>x===value).length;
 const percentile=100*(below+tied/2)/values.length;
 return LOWER_IS_BETTER.has(k)?100-percentile:percentile;
}
function bar(v){if(v==null)return '<span class="qs-nobar">—</span>';const tone=v>=80?'top':v>=55?'good':v>=35?'mid':'low';return '<span class="qs-bar" title="'+Math.round(v)+'th percentile in his league"><span class="qs-track"><i class="qs-'+tone+'" style="width:'+Math.max(2,Math.min(100,v))+'%"></i></span><b>'+Math.round(v)+'</b></span>';}
const row=(label,value,pk,p,note)=>'<tr><th scope="row">'+label+(note?'<small>'+note+'</small>':'')+'</th><td>'+value+'</td><td>'+(pk?bar(pctOf(p,pk)):'')+'</td></tr>';
const table=(rows)=>'<table class="qs-table"><thead><tr><th>Stat</th><th>Value</th><th>League percentile</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
const ratio=(a,b)=>a==null||!b?'—':n(a/b,2);

const PAGES={
 overview(p){const L=leagueOf(p),cards=[['ppg','Points',n(p.ppg)],['rpg','Rebounds',n(p.rpg)],['apg','Assists',n(p.apg)],['pir',p.pir!=null?'PIR':'Efficiency',n(p.pir!=null?p.pir:p.eff)],['ts','True shooting',pc(p.ts)],['f3p','3-point %',pc(p.f3p)],['mpg','Minutes',n(p.mpg)],['usg','Usage',pc(p.usg)]];
  const g=statGradeOverall(p),lv=levelBand(p);
  return '<div class="qs-meta"><span><b>'+esc(seasonOf(p))+'</b> season</span><span><b>'+(p.g||0)+'</b> games</span><span><b>'+n(p.mpg)+'</b> min</span>'+(g!=null?'<span>Grade <b>'+Number(g).toFixed(1)+'</b></span>':'')+(lv?'<span>Level <b>'+esc(lv.label)+'</b></span>':'')+(p.qualified===false?'<span class="qs-warn" title="Below the league’s minimum games or minutes — percentiles are less reliable">small sample</span>':'')+'</div>'+
   '<div class="qs-cards">'+cards.map(([k,l,v])=>'<div class="qs-card"><small>'+l+'</small><b>'+v+'</b>'+bar(pctOf(p,k==='pir'&&p.pir==null?'eff':k))+'</div>').join('')+'</div>'+
   '<p class="qs-hint">'+(cards.some(([k])=>pctOf(p,k==='pir'&&p.pir==null?'eff':k)!=null)?'Bars show where he stands among '+esc(L&&L.meta?L.meta.name:'his league')+' players in '+esc(seasonOf(p))+': 50 is the league median.':'Percentiles are unavailable for this sample. Fallback rankings require at least five games and 20 comparable players.')+'</p>';},
 offense:p=>table([row('Points per game',n(p.ppg),'ppg',p),row('Points per 40',n(p.pts40),'pts40',p),row('Field goals',pc(p.fgp),'fgp',p,p.fgma),row('2-point %',pc(p.f2p),null,p),row('3-point %',pc(p.f3p),'f3p',p,p.f3ma),row('Free throws',pc(p.ftp),'ftp',p,p.ftma),row('Effective FG%',pc(p.efg),'efg',p),row('True shooting',pc(p.ts),'ts',p),row('Points per shot',n(p.pps,2),null,p),row('Usage',pc(p.usg),'usg',p)]),
 defense:p=>table([row('Steals per game',n(p.spg),'spg',p),row('Steals per 40',n(p.stl40),'stl40',p),row('Steal %',pc(p.stlp),null,p),row('Blocks per game',n(p.bpg),'bpg',p),row('Blocks per 40',n(p.blk40),'blk40',p),row('Block %',pc(p.blkp),null,p)])+'<p class="qs-hint">Box-score defense only — steals and blocks say little about positioning or effort. That is what the Defense notes are for.</p>',
 shooting:p=>table([row('Field goals',pc(p.fgp),'fgp',p,p.fgma),row('2-point %',pc(p.f2p),null,p),row('3-point %',pc(p.f3p),'f3p',p,p.f3ma),row('Free throws',pc(p.ftp),'ftp',p,p.ftma),row('Effective FG%',pc(p.efg),'efg',p),row('True shooting',pc(p.ts),'ts',p),row('Share of shots from three',pc(p.r3a),null,p),row('Free-throw rate',n(p.ftr,2),null,p,'FTA per FGA'),row('Points per shot',n(p.pps,2),null,p)]),
 playmaking:p=>table([row('Assists per game',n(p.apg),'apg',p),row('Assists per 40',n(p.ast40),'ast40',p),row('Assist %',pc(p.astp),null,p),row('Turnovers per game',n(p.topg),'topg',p,'bar: fewer is better'),row('Turnovers per 40',n(p.tov40),null,p),row('Turnover %',pc(p.tovp),null,p),row('Assist / turnover',ratio(p.apg,p.topg),null,p)]),
 rebounding:p=>table([row('Rebounds per game',n(p.rpg),'rpg',p),row('Rebounds per 40',n(p.reb40),'reb40',p),row('Total rebound %',pc(p.trbp),null,p)]),
 advanced:p=>table([row('PIR',n(p.pir),'pir',p),row('Efficiency',n(p.eff),'eff',p),row('Usage',pc(p.usg),'usg',p),row('True shooting',pc(p.ts),'ts',p),row('Effective FG%',pc(p.efg),'efg',p),row('Points per shot',n(p.pps,2),null,p),row('Assist %',pc(p.astp),null,p),row('Turnover %',pc(p.tovp),null,p),row('Rebound %',pc(p.trbp),null,p),row('Steal %',pc(p.stlp),null,p),row('Block %',pc(p.blkp),null,p),row('Minutes per game',n(p.mpg),'mpg',p)]),
 log(p){const L=leagueOf(p),cols=(L&&L.meta&&L.meta.gameLogCols)||[],log=p.gameLog||[];if(!log.length||!cols.length)return '<p class="qs-hint">No game log for this competition.</p>';
  const ix=k=>cols.indexOf(k),get=(g,k)=>ix(k)<0?null:g[ix(k)],ma=(g,m,a)=>get(g,m)==null?'—':get(g,m)+'-'+get(g,a);
  const games=log.slice().sort((a,b)=>String(get(b,'date')).localeCompare(String(get(a,'date'))));
  const avg=(list,k)=>{const v=list.map(g=>get(g,k)).filter(x=>x!=null);return v.length?n(v.reduce((s,x)=>s+Number(x),0)/v.length):'—';};
  const last=games.slice(0,5);
  return '<div class="qs-meta"><span>Last '+last.length+': <b>'+avg(last,'pts')+'</b> pts · <b>'+avg(last,'reb')+'</b> reb · <b>'+avg(last,'ast')+'</b> ast · <b>'+avg(last,'min')+'</b> min</span></div><div class="qs-scroll"><table class="qs-table qs-log"><thead><tr><th>Date</th><th>Opp</th><th>Result</th><th>Min</th><th>Pts</th><th>FG</th><th>3P</th><th>FT</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>TO</th><th>PIR</th><th>+/−</th></tr></thead><tbody>'+
   games.map(g=>'<tr><td>'+fmtDate(get(g,'date'))+'</td><td>'+(get(g,'ha')==='A'?'@ ':'')+esc(get(g,'opp')||'')+'</td><td class="'+(get(g,'win')?'qs-w':'qs-l')+'">'+(get(g,'win')?'W':'L')+' '+(get(g,'teamPts')??'')+'–'+(get(g,'oppPts')??'')+'</td><td>'+n(get(g,'min'),0)+'</td><td><b>'+(get(g,'pts')??'—')+'</b></td><td>'+ma(g,'fgm','fga')+'</td><td>'+ma(g,'fg3m','fg3a')+'</td><td>'+ma(g,'ftm','fta')+'</td><td>'+(get(g,'reb')??'—')+'</td><td>'+(get(g,'ast')??'—')+'</td><td>'+(get(g,'stl')??'—')+'</td><td>'+(get(g,'blk')??'—')+'</td><td>'+(get(g,'tov')??'—')+'</td><td>'+(get(g,'pir')??'—')+'</td><td>'+(get(g,'pm')??'—')+'</td></tr>').join('')+'</tbody></table></div>';}
};

function linesOf(p){const g=gid(p);return allPlayersEvery().filter(x=>gid(x)===g&&x.league!=='sl').sort((a,b)=>(b.min||0)-(a.min||0));}
function seasonOf(p){const value=p.season||leagueOf(p)?.meta?.season||p._seasonLabel||'';const match=String(value).match(/(20\d{2})\s*[/–-]\s*((?:20)?\d{2})/);return match?match[1]+'/'+match[2].slice(-2):'Season unknown';}
function paint(){
 const host=document.getElementById('qsPanel');if(!host||!current)return;
 const all=linesOf(current),seasons=[...new Set(all.map(seasonOf))].sort((a,b)=>(parseInt(b,10)||0)-(parseInt(a,10)||0)||b.localeCompare(a));
 if(!seasonChoice||!seasons.includes(seasonChoice))seasonChoice=seasons[0]||'Season unknown';
 const shown=all.filter(x=>seasonOf(x)===seasonChoice);
 if(!line||!shown.includes(line))line=shown.find(x=>x.league===current.league)||shown[0]||current;
 const L=leagueOf(line);
 host.innerHTML='<header class="qs-head"><div><h2>'+esc(current.name)+'</h2><div class="qs-filters"><label>Season<select id="qsSeason" aria-label="Statistics season">'+seasons.map(s=>'<option'+(s===seasonChoice?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label><label>Competition'+(shown.length>1?'<select id="qsLine" aria-label="Competition">'+shown.map((x,i)=>'<option value="'+i+'"'+(x===line?' selected':'')+'>'+esc((leagueOf(x)?.meta?.name||x.league)+' · '+(x.teamName||x.team)+' · '+(x.g||0)+' g')+'</option>').join('')+'</select>':'<span class="qs-single">'+esc((L?.meta?.name||line.league)+' · '+(line.teamName||line.team))+'</span>')+'</label></div></div>'+
  '<a class="btn ghost sm" href="'+escAttr(eurobasketURL(current))+'" target="_blank" rel="noopener">Eurobasket ↗</a><button type="button" class="qs-x" id="qsClose" aria-label="Close stats">✕</button></header>'+
  '<div class="qs-body"><nav class="qs-side" role="tablist" aria-label="Stat categories">'+TABS.map(([k,l],i)=>'<button type="button" role="tab" aria-selected="'+(k===tab)+'" class="qs-tab'+(k===tab?' on':'')+'" data-qs="'+k+'"><span>'+l+'</span><kbd>'+(i+1)+'</kbd></button>').join('')+'</nav><section class="qs-main" tabindex="-1">'+(line.g?PAGES[tab](line):'<p class="qs-hint">No '+esc(seasonChoice)+' statistics for this player in the selected competition.</p>')+'</section></div>';
 host.querySelector('#qsClose').onclick=close;
 host.querySelectorAll('[data-qs]').forEach(b=>b.onclick=()=>{tab=b.dataset.qs;paint();});
 const season=host.querySelector('#qsSeason');if(season)season.onchange=()=>{seasonChoice=season.value;line=null;paint();};
 const sel=host.querySelector('#qsLine');if(sel)sel.onchange=()=>{line=shown[+sel.value];paint();};
}
function open(p){
 if(!p)return;current=player(p.id)||p;line=null;seasonChoice='';percentilePools.clear();
 let mask=document.getElementById('qsMask');
 if(!mask){mask=document.createElement('div');mask.id='qsMask';mask.className='qs-mask';mask.innerHTML='<aside id="qsPanel" class="qs-panel" role="dialog" aria-modal="true" aria-label="Quick stats"></aside>';mask.addEventListener('mousedown',e=>{if(e.target===mask)close();});document.body.appendChild(mask);requestAnimationFrame(()=>mask.classList.add('open'));}
 paint();
}
function close(){const m=document.getElementById('qsMask');if(m)m.remove();current=null;}
const isOpen=()=>!!document.getElementById('qsMask');
document.addEventListener('keydown',e=>{if(!isOpen()||document.getElementById('mtscMask'))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}if(/^[1-8]$/.test(e.key)&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)){e.preventDefault();e.stopPropagation();tab=TABS[+e.key-1][0];paint();}},true);
window.ESQuickStats={open,close,isOpen,follow(p){if(isOpen()&&p){current=player(p.id)||p;line=null;seasonChoice='';percentilePools.clear();paint();}}};
})();
