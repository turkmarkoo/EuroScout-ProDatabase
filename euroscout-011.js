(function(){
const norm=s=>String(s||'').replace(/[đĐ]/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|junior|sr|ii|iii|iv)\b\.?/g,'').replace(/[^a-z0-9]/g,'');
window.EUROSCOUT_AGENCIES=[...new Set([...(window.EUROSCOUT_AGENCIES||[]),'011 Sports'])];window.EUROSCOUT_AGENTS={...(window.EUROSCOUT_AGENTS||{}),'Ivan Ašanin':'011 Sports'};
const clientsByName=new Map();for(const client of EUROSCOUT_011){const key=norm(client.name);if(!clientsByName.has(key))clientsByName.set(key,[]);clientsByName.get(key).push(client);}
const prior=EuroScoutAgencyResearch.apply;EuroScoutAgencyResearch.apply=function(p,b){prior(p,b);const source=(clientsByName.get(norm(p.name))||[]).find(x=>x.born&&+x.born===+p.born);if(!source)return;if(!Object.prototype.hasOwnProperty.call(b||{},'agency'))p.agency='011 Sports';if(p.agency==='011 Sports'){if(!Object.prototype.hasOwnProperty.call(b||{},'agent'))p.agent='Ivan Ašanin';p._listedAgents=[];p._agencyEvidence=source.url;}};
if(STATE.data?.leagues){applyOverrides();}
})();