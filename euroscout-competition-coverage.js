/* Read-only coverage model. Team identity is supplied by the existing club map. */
(function(root){
'use strict';
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
root.ESCompetitionCoverage={build};
if(typeof module!=='undefined')module.exports={build};
})(typeof window==='undefined'?globalThis:window);
