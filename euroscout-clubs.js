/* Destination identities only: never inject these clubs into historical standings. */
(function(){
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const directory=()=>window.EUROSCOUT_CLUB_DIRECTORY||[];
const redirects=new Map();
function extend(out){redirects.clear();for(const d of directory()){
 const names=[d.name,...d.aliases].map(norm);
 // Only an exact full-name/explicit alias match is eligible. No city or nickname guessing.
 const country=s=>window.EuroScoutCountries?.canonical(s)||s;
 const matches=out.filter(t=>!t.directoryOnly&&names.includes(norm(t.name))&&(!t.country||norm(country(t.country))===norm(country(d.country))));
 if(matches.length){for(const t of matches)t.searchAliases=[...(t.searchAliases||[]),d.name,...d.aliases];redirects.set('directory|'+d.id,matches[0].key);continue;}
 out.push({key:'directory|'+d.id,code:d.id,lg:'directory',lgName:d.league,name:d.name,country:d.country,city:'',logo:null,directoryOnly:true,source:d.source,searchAliases:d.aliases});
}}
function linkAliases(teamMap,clubMap){for(const [old,key]of redirects){teamMap.set(old,teamMap.get(key));clubMap.set(old,clubMap.get(key));}}
function open(key){const t=dbTeamByKey(key);if(t&&key.startsWith('directory|')&&!t.directoryOnly){openTeamIn(t.lg,t.code);return true;}if(!t?.directoryOnly)return false;
 const people=assignPool().filter(p=>effective26keys(p).includes(canonKey(key)));
 showModal(`<h3>${esc(t.name)}</h3><p>${esc(t.country)} · ${esc(t.lgName)}</p><p class="hint">Destination club directory. No statistics have been imported. League labels identify the source directory, not confirmed 2026/27 competition entry.</p><p><a href="${escAttr(t.source)}" target="_blank" rel="noopener noreferrer">Club source ↗</a></p><h4>Assigned for 2026/27 · ${people.length}</h4>${people.length?people.map(p=>`<p><button class="btn" data-directory-player="${escAttr(p.id)}">${esc(p.name)}</button></p>`).join(''):'<p>No players assigned yet.</p>'}`);
 document.querySelectorAll('[data-directory-player]').forEach(b=>b.onclick=()=>{hideModal();openProfile(b.dataset.directoryPlayer);});return true;
}
window.EuroScoutClubs={extend,open,linkAliases};
})();
