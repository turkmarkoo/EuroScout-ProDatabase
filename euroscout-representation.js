(function(){
const norm=s=>String(s||'').replace(/[đĐ]/g,'dj').replace(/[łŁ]/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|junior|sr|ii|iii|iv)\b\.?/g,'').replace(/[^a-z0-9]/g,'');
const research=window.EUROSCOUT_REALGM_REPRESENTATION||{records:[]},records=research.records,byId=new Map();for(const r of records)for(const id of r.ids){if(!byId.has(id))byId.set(id,[]);byId.get(id).push(r);}
// Merge both names without discarding saved player or agent associations.
for(const r of records){for(const x of r.representatives)if(x.agency==='Octagon Europe')x.agency='Octagon';if(r.agency==='Octagon Europe')r.agency='Octagon';const names=[...new Set(r.representatives.map(x=>x.agency).filter(Boolean))];r.agencyConflict=names.length>1;if(names.length===1)r.agency=names[0];}
const reps=records.filter(r=>!r.identityConflict&&!r.agencyConflict).flatMap(r=>r.representatives);
Object.assign(AGENCY_RENAME,{'THE.TEAM (previously known as Wasserman)':'The Team','Beo Basket Ltd.':'BeoBasket','Beo Basket Ltd':'BeoBasket','Sports International Group, Inc.':'Sports International Group'});
window.EUROSCOUT_AGENCIES=[...new Set([...(window.EUROSCOUT_AGENCIES||[]),...reps.map(r=>r.agency)].filter(Boolean))];
window.EUROSCOUT_AGENTS={...Object.fromEntries(reps.filter(r=>r.agent).map(r=>[r.agent,r.agency])),...(window.EUROSCOUT_AGENTS||{})};
const owns=(b,k)=>Object.prototype.hasOwnProperty.call(b||{},k),legacy=EuroScoutAgencyResearch.apply;
EuroScoutAgencyResearch.apply=function(p,b){p._agencyEvidence=null;p._listedAgents=[];p._representation=null;
 const r=(byId.get(p.id)||[]).find(r=>+p.born===r.born&&r.names.some(n=>norm(n)===norm(p.name)));
 if(!r){legacy(p,b);p.agency=normAgency(p.agency);return;}p._representation=r;if(r.identityConflict)return;
 if(!r.agencyConflict&&!owns(b,'agency')&&r.agency)p.agency=normAgency(r.agency);
 const eligible=r.representatives.filter(x=>(!r.agencyConflict||owns(b,'agency'))&&(!x.agency||norm(x.agency)===norm(p.agency)));
 if(!owns(b,'agent')){p._listedAgents=[...new Set(eligible.map(x=>x.agent).filter(Boolean))];if(p._listedAgents.length===1)p.agent=p._listedAgents[0];}
};
EuroScoutAgencyResearch.agentsOf=p=>p.agent?[p.agent]:(p._listedAgents||[]);
EuroScoutAgencyResearch.records=records;
const priorAgency=agencyForAgent;agencyForAgent=function(name){const existing=priorAgency(name);if(existing)return existing;const choices=[...new Set(reps.filter(r=>norm(r.agent)===norm(name)).map(r=>r.agency).filter(Boolean))];return choices.length===1?choices[0]:'';};
const cell=agentCellHTML;agentCellHTML=function(p){let html=cell(p);if(!p.agent&&p._listedAgents?.length)html='<div>'+p._listedAgents.map(a=>'<span class="agentchip" onclick="openAgentRoster(\''+agencyEnc(a)+'\')">'+esc(a)+'</span>').join(' ')+'</div>'+html;
 const r=p._representation;if(r){const warning=r.identityConflict?'Identity match needs review':r.agencyConflict?'Multiple agency listings — review sources':'Listed representatives';html+='<details class="rep-evidence"><summary>'+warning+'</summary><small>RealGM client lists · checked 7 Sep 2026</small>'+r.representatives.map(x=>'<p><a href="'+escAttr(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.agent)+' ↗</a>'+(x.agency?' · '+esc(x.agency):' · agency not listed')+'<br><a class="hint" href="'+escAttr(x.playerURL)+'" target="_blank" rel="noopener noreferrer">RealGM player · '+esc(x.birth)+'</a></p>').join('')+'</details>';}return html;};
agencyClear=function(pid,kind){const p=player(pid);if(!p||!Store.canEdit())return false;ovrSaveLocal({bio:{[gid(p)||pid]:kind==='agency'?{agency:'',agent:''}:{agent:''}}});return true;};
})();
