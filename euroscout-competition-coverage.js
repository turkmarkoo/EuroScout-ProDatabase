/* Read-only coverage model. Team identity is supplied by the existing club map. */
(function(root){
'use strict';
function resolveTeams({clubs,preferredKeys=[],canonicalKey=x=>x,nameKey}){
 const byKey=new Map(),byName=new Map(),preferred=new Set(preferredKeys.map(canonicalKey)),preferredNames=new Map(),redirects=new Map();
 const names=c=>[c.name,...(c.teams||[]).flatMap(t=>[t.name,...(t.searchAliases||[])])].map(nameKey).filter(Boolean);
 const add=(map,name,key)=>{if(!map.has(name))map.set(name,key);else if(map.get(name)!==key)map.set(name,null);};
 for(const c of clubs){byKey.set(c.key,c);for(const t of c.teams||[])byKey.set(t.key,c);for(const name of names(c)){add(byName,name,c.key);if(preferred.has(c.key))add(preferredNames,name,c.key);}}
 const codes=c=>new Set([c.key,...(c.teams||[]).map(t=>t.key)].map(k=>String(k||'').split('|')[1]).filter(Boolean));
 for(const c of clubs){if(preferred.has(c.key))continue;const candidates=new Set(names(c).map(n=>preferredNames.get(n)).filter(Boolean));if(candidates.size!==1)continue;
  const target=byKey.get([...candidates][0]);if(!target)continue;
  const sameCountry=c.country&&target.country&&nameKey(c.country)===nameKey(target.country),targetCodes=codes(target);
  // An exact full club name plus country or source code is needed. Never use
  // city/nickname similarity or combine two entries within the selected field.
  if(sameCountry||[...codes(c)].some(code=>targetCodes.has(code)))redirects.set(c.key,target.key);
 }
 const resolve=t=>{if(!t?.key&&!t?.name)return null;const original=canonicalKey(t.key||byName.get(nameKey(t.name))||''),key=redirects.get(original)||original,c=byKey.get(key);return{key:key||'name:'+nameKey(t.name),name:c?.name||t.name||key,club:c};};
 resolve.aliases=key=>[key,...[...redirects].filter(([,target])=>target===key).map(([source])=>source)];
 return resolve;
}
function build({competition,competitions=[],sessions=[],fixtures=[],resolveTeam,competitionKey,roster=()=>[],playerId=x=>x.pid||x.id,noted=()=>false,watched=()=>false}){
 const compKey=c=>competitionKey(c||{}),id=compKey(competition),rows=new Map();
 const ensure=t=>{if(!t)return null;const team=resolveTeam(t);if(!team?.key)return null;
  if(!rows.has(team.key))rows.set(team.key,{...team,competitions:new Map(),sessions:[],leagueSessions:[],players:new Set(),noted:new Set(),watchlist:new Set(),current:false});return rows.get(team.key);};
 const member=(c,t)=>{const r=ensure(t);if(!r)return;r.competitions.set(compKey(c),c.name);if(compKey(c)===id)r.current=true;};
 for(const c of competitions)for(const t of c.members||[])member(c,t);
 for(const g of fixtures)if(g.date>='2026-07-01'&&g.date<'2027-07-01')for(const t of [g.home,g.away])member({id:g.comp,name:g.compName},t);
 // Historical sessions are evidence of viewing, never proof of present membership.
 for(const s of sessions){if(s.removed||s.active)continue;const same=compKey(s.competition)===id;
  for(const t of [s.a,s.b]){const resolved=resolveTeam(t);let r=resolved&&rows.get(resolved.key);if(!r&&same)r=ensure(t);if(!r)continue;
   r.sessions.push(s);if(same)r.leagueSessions.push(s);
   for(const p of s.players||[])if(resolveTeam({key:p.club})?.key===r.key){const pid=playerId(p);if(pid)r.players.add(pid);if(pid&&p.status&&p.status!=='none')r.noted.add(pid);}
  }
 }
 const watchDate=s=>(s.watchedOn||[]).filter(Boolean).sort().at(-1)||String(s.endedAt||s.startedAt||'').slice(0,10);
 const teams=[...rows.values()].filter(r=>r.current||r.leagueSessions.length).map(r=>{
  r.sessions.sort((a,b)=>watchDate(b).localeCompare(watchDate(a))||String(b.endedAt||'').localeCompare(String(a.endedAt||'')));
  r.last=r.sessions[0]||null;r.lastDate=r.last?watchDate(r.last):'';r.roster=roster(r.key);
  for(const p of r.roster){const pid=playerId(p);if(noted(p))r.noted.add(pid);if(watched(p))r.watchlist.add(pid);}
  r.otherCompetitions=[...r.competitions].filter(([key])=>key!==id).map(([,name])=>name);
  r.status=r.leagueSessions.length?'league':r.sessions.length?'elsewhere':'never';return r;
 });
 const current=teams.filter(r=>r.current);
 return {teams,current:current.length,league:current.filter(r=>r.leagueSessions.length).length,any:current.filter(r=>r.sessions.length).length,never:current.filter(r=>!r.sessions.length).length,watchDate};
}
root.ESCompetitionCoverage={build,resolveTeams};
if(typeof module!=='undefined')module.exports={build,resolveTeams};
})(typeof window==='undefined'?globalThis:window);
