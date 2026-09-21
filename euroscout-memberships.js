/* Current entries are separate from historical teams, standings and player statistics. */
(function(){
  const copy=value=>JSON.parse(JSON.stringify(value));
  function apply(raw){
    const data=window.EUROSCOUT_MEMBERSHIPS;if(!raw||!data)return;
    const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);
    for(const club of data.clubs||[])if(!directory.some(t=>t.id===club.id))directory.push(copy(club));
    raw.domestic2627={season:data.season,checked:data.checked,leagues:{}};
    raw.season2627={...(raw.season2627||{}),season:data.season,checked:data.checked,comps:{}};
    for(const [id,league] of Object.entries({...data.leagues,...(window.EUROSCOUT_EXPANSION_DATA?.memberships||{})})){
      (league.international?raw.season2627.comps:raw.domestic2627.leagues)[id]=copy(league);
    }
  }
  function decorate(clubs,byKey){
    for(const [key,name]of Object.entries(window.EUROSCOUT_MEMBERSHIPS?.renames||{})){
      const club=byKey.get(key);if(!club)continue;
      club.name=name;
      for(const team of club.teams)team.searchAliases=[...new Set([...(team.searchAliases||[]),name])];
    }
    for(const league of Object.values(window.EUROSCOUT_EXPANSION_DATA?.memberships||{}))if(league.confirmed)for(const team of league.teams||[]){
      const club=byKey.get(team.key);if(!club)continue;
      for(const t of club.teams)t.searchAliases=[...new Set([...(t.searchAliases||[]),club.name,team.name])];
      club.name=team.name;
    }
    clubs.sort((a,b)=>a.name.localeCompare(b.name));
  }
  function status(league){
    if(!league)return 'Not verified';
    if(!league.confirmed)return league.teams?.length?'Provisional':'Not published / verified';
    return league.complete?'Verified':'Partial list';
  }
  function reviewHTML(raw,selected){
    const leagues=[...Object.values(raw.domestic2627?.leagues||{}),...Object.values(raw.season2627?.comps||{})];
    const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const detail=l=>`<div class="membership-review-row"><strong>${e(l.name)} · ${e(l.season||'2026/27')}</strong><span>${e(status(l))} · ${l.teams.length} listed${l.checked?' · Checked '+e(l.checked):''}</span>${l.note?'<span>'+e(l.note)+'</span>':''}${/^https:\/\//.test(l.source||'')?'<a href="'+e(l.source)+'" target="_blank" rel="noopener noreferrer">Entry source ↗</a>':''}</div>`;
    const picked=leagues.find(l=>selected==='n27:'+l.id||selected===l.name);
    return `<div class="membership-review">${picked?detail(picked):'<span>League entries checked 13 Sept 2026. Qualifications and provisional entries are marked separately.</span>'}<details><summary>All league entry checks</summary>${leagues.sort((a,b)=>a.name.localeCompare(b.name)).map(detail).join('')}</details></div>`;
  }
  function reviewRowsHTML(raw){
    const leagues=[...Object.values(raw.domestic2627?.leagues||{}),...Object.values(raw.season2627?.comps||{})];
    const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return leagues.sort((a,b)=>a.name.localeCompare(b.name)).map(l=>`<div class="membership-review-row"><strong>${e(l.name)} · ${e(l.season||'2026/27')}</strong><span>${e(status(l))} · ${(l.teams||[]).length} listed${l.checked?' · Checked '+e(l.checked):''}</span>${l.note?'<span>'+e(l.note)+'</span>':''}${/^https:\/\//.test(l.source||'')?'<a href="'+e(l.source)+'" target="_blank" rel="noopener noreferrer">Entry source ↗</a>':''}</div>`).join('');
  }
  window.EuroScoutMemberships={apply,decorate,status,reviewHTML,reviewRowsHTML};
})();
