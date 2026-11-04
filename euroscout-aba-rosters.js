/* Official ABA registrations are current-season defaults, never historical stats. */
(function(){
 const data=window.EUROSCOUT_ABA_ROSTERS;if(!data)return;
 // The 10 September roster snapshot predates this confirmed intra-league move.
 const mateo=data.roster.find(r=>r.abaId==='2853');
 if(mateo)Object.assign(mateo,{teamId:'110',teamName:'Slovan Bratislava',staleKey:'aba|SCD',
   teamUrl:'https://www.aba-liga.com/team/110/26/1/0/slovan-bratislava/',
   sourceUrl:'https://www.aba-liga.com/news/55164/mateo-dreznjak-joins-slovan-bratislava/',
   correctedAt:'2026-09-21'});
 // Verified ABA and EuroCup identities. The roster retains each competition's IDs.
 const buducnostLinks=[
  ['4104','eurocup-011281','Yogi Ferrell'],
  ['3750','eurocup-010307','Dordije Jovanovic'],
  ['5072','eurocup-013247','Oleksandr Kovliar'],
  ['5139','eurocup-013926','Iverson Molinar'],
  ['2668','eurocup-006977','Stefan Dordevic']
 ];
 // RealGM person IDs 152276 and 120866 publish the same full birth dates
 // and Buducnost history as the official ABA/EuroCup registrations.
 const regionalIdentities={
  '3750':{id:'montenegro-rg152276-rgteam-67',name:'Djordije Jovanovic'},
  '5072':{id:'montenegro-rg120866-rgteam-67',name:'Alexander Kovlyar'}
 };
 const verifiedBuducnost=[];
 for(const [abaId,eurocupId,eurocupName] of buducnostLinks){
  const row=data.roster.find(player=>player.teamId==='12'&&player.abaId===abaId);
  if(!row)continue;
  const regional=regionalIdentities[abaId];
  row.ids=[...new Set([...row.ids,'aba-'+abaId,eurocupId,...(regional?[regional.id]:[])])];
  verifiedBuducnost.push({names:[row.name,eurocupName,...(regional?[regional.name]:[])],born:row.born,ids:row.ids});
 }
 const byId=new Map(data.roster.flatMap(r=>r.ids.map(id=>[id,r])));
 function merge(raw,pack){for(const incoming of pack){let L=raw.leagues.find(l=>l.meta.id===incoming.meta.id);if(!L){L={meta:{...incoming.meta},teams:[],players:[]};raw.leagues.push(L);}const ids=new Set(L.players.map(p=>p.id)),codes=new Set((L.teams||[]).map(t=>t.code));for(const p of incoming.players)if(!ids.has(p.id)){L.players.push(structuredClone(p));ids.add(p.id);}for(const t of incoming.teams||[])if(!codes.has(t.code)){L.teams.push(structuredClone(t));codes.add(t.code);}}}
 function apply(raw){if(!raw?.leagues)return;merge(raw,data.leagues);
  const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]);
  for(const t of data.teams){const id='aba-2026-'+t.id;if(!directory.some(x=>x.id===id)){const old=raw.leagues.flatMap(l=>l.teams||[]).filter(x=>new RegExp('/'+t.id+'\\.png(?:\\?|$)').test(x.logo||''));directory.push({id,name:t.name,country:t.country,league:'ABA League',aliases:old.map(x=>x.name),source:t.url,checked:data.checked});}}
  for(const L of raw.leagues)for(const p of L.players){const r=byId.get(p.id);if(!r)continue;p._abaRoster={teamId:r.teamId,teamName:r.teamName,season:data.season,source:r.sourceUrl,checked:r.correctedAt||data.checked};p._abaAliases=[r.name];if(!p.born)p.born=r.born;if(!p.height)p.height=r.height;if(!p.country)p.country=r.nationality;}
 }
 function current(p){const r=byId.get(p.id)||(p._grp||[]).map(x=>byId.get(x.id)).find(Boolean);return r||null;}
 function key(p){const r=current(p);if(!r)return null;const team=allDbTeams().find(t=>new RegExp('/'+r.teamId+'\\.png(?:\\?|$)').test(t.logo||''));return canonKey(team?team.key:'directory|aba-2026-'+r.teamId);}
 function link(uni){for(const r of data.roster)for(let i=1;i<r.ids.length;i++)uni(r.ids[0],r.ids[i]);}
 window.EuroScoutABA={apply,merge,current,key,link,data,verifiedBuducnost};
})();
