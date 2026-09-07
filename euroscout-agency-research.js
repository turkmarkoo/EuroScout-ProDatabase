(function(){
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const rows=(window.EUROSCOUT_AGENCY_RESEARCH||[]).flatMap(s=>s.players.map(([name,born])=>({...s,players:undefined,name,born})));
window.EUROSCOUT_AGENCIES=[...new Set([...(window.EUROSCOUT_AGENCIES||[]),...rows.map(r=>r.agency)])];
window.EUROSCOUT_AGENTS={...Object.fromEntries(rows.filter(r=>r.agent).map(r=>[r.agent,r.agency])),...(window.EUROSCOUT_AGENTS||{})};
let birthIndex=new Map();function prepare(){birthIndex=new Map();for(const L of STATE.data.leagues)for(const p of L.players||[]){const n=norm(p.name);if(!birthIndex.has(n))birthIndex.set(n,new Set());if(p.born)birthIndex.get(n).add(p.born);}}
function apply(p,b){p._agencyEvidence=null;const r=rows.find(r=>norm(r.name)===norm(p.name)&&(!r.born||!p.born||+r.born===+p.born));if(!r)return;
 const births=birthIndex.get(norm(r.name))||new Set();if(births.size>1&&!r.born)return;
 if(!Object.prototype.hasOwnProperty.call(b||{},'agency'))p.agency=r.agency;
 if(norm(p.agency)===norm(r.agency)){if(!Object.prototype.hasOwnProperty.call(b||{},'agent')&&r.agent)p.agent=r.agent;p._agencyEvidence=r.url;}
}
window.EuroScoutAgencyResearch={apply,rows,prepare};
const cell=agentCellHTML;agentCellHTML=function(p){return cell(p)+(p._agencyEvidence?'<br><a class="hint" href="'+escAttr(p._agencyEvidence)+'" target="_blank" rel="noopener noreferrer">Client-list source · checked 7 Sep 2026 ↗</a>':'');};
})();
