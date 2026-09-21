/* Agencies v2: a lightweight scouting directory, independent of the old roster UI. */
(function(){
  'use strict';
  const LOGOS='euroscout:agencyLogos:v1', NOTES='euroscout:agencyNotes:v1', VIEW='euroscout:agenciesView:v2';
  const byId=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{return {};}};
  const ui={mode:'agency',view:localStorage.getItem(VIEW)==='list'?'list':'cards',sort:'players',query:'',tab:'Overview'};
  let directory=null,transferIndex=null;
  const notes=()=>read(NOTES),logos=()=>read(LOGOS);
  const dateLabel=iso=>iso&&/^\d{4}-\d{2}-\d{2}/.test(iso)?new Date(iso.slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
  const initials=name=>String(name||'').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  function agencyKey(name){return fold(normAgency(name));}
  function logoFor(name){const entry=logos()[agencyKey(name)];return entry?.data||'';}
  function logoHTML(name,small=false){const src=logoFor(name),size=small?' small':'';
    return '<span class="av2-logo'+size+'">'+(src?'<img src="'+escape(src)+'" alt="" loading="lazy">':'<span>'+escape(initials(name))+'</span>')+'</span>';}
  function transferFor(player){
    const current=typeof nextOf==='function'?nextOf(player):null;
    if(!current||!['signed','extended'].includes(current.kind)||!current.club||!current.from)return null;
    const key=normNm(player.name),candidates=[TRANSFERS.get(key),...(TRANSFERS_SUR.get(key.split(' ').at(-1))||[])];
    const record=candidates.find(t=>t&&t.date&&t.from&&t.to&&playerForTransfer(t)&&gid(playerForTransfer(t))===gid(player)&&fold(t.from)===fold(current.from)&&fold(t.to)===fold(current.club));
    if(!record||fold(record.from)===fold(record.to))return null;
    return {player:player.name,from:record.from,to:record.to,date:record.date,id:player.id};
  }
  function mappedAgency(name){const canonical=window.EuroScoutMergeCenter?.canonicalAgent(name)||name;
    return normAgency(agentMap()[canonical]||agencyForAgent(canonical)||'');}
  function buildDirectory(){
    const players=assignPool(),agencies=new Map(),agents=new Map();
    function agency(name){const key=agencyKey(name);if(!key)return null;
      if(!agencies.has(key))agencies.set(key,{kind:'agency',name:normAgency(name),players:new Map(),agents:new Set(),transfers:[]});
      return agencies.get(key);}
    function agent(name){const key=fold(name);if(!key)return null;
      if(!agents.has(key))agents.set(key,{kind:'agent',name,players:new Map(),agencies:new Set(),transfers:[]});
      return agents.get(key);}
    agencyList().forEach(name=>agency(name));
    agentList().forEach(name=>{const a=agent(name),group=mappedAgency(name);if(group){a.agencies.add(group);agency(group)?.agents.add(name);}});
    for(const player of players){
      const names=[...new Set((EuroScoutAgencyResearch.agentsOf(player)||[]).filter(Boolean))];
      const group=player.agency&&agency(player.agency),transfer=transferFor(player);
      if(group){group.players.set(gid(player),player);if(transfer)group.transfers.push(transfer);}
      for(const name of names){const a=agent(name);a.players.set(gid(player),player);if(transfer)a.transfers.push(transfer);
        const ag=group||agency(mappedAgency(name));if(ag){
          ag.agents.add(a.name);a.agencies.add(ag.name);
          if(!ag.players.has(gid(player))){ag.players.set(gid(player),player);if(transfer)ag.transfers.push(transfer);}
        }}
    }
    const finish=map=>[...map.values()].map(item=>{
      item.players=[...item.players.values()];
      item.transfers.sort((a,b)=>b.date.localeCompare(a.date));
      item.last=item.transfers[0]||null;
      const stamp=notes()[agencyKey(item.name)]?.updatedAt||logos()[agencyKey(item.name)]?.updatedAt||'';
      item.updatedAt=[stamp.slice(0,10),item.last?.date||''].sort().at(-1)||'';
      return item;
    });
    return {agencies:finish(agencies),agents:finish(agents)};
  }
  function ensureDirectory(force=false){if(force||!directory||transferIndex!==TRANSFERS){directory=buildDirectory();transferIndex=TRANSFERS;}return directory;}
  function rows(){ensureDirectory();return ui.mode==='agency'?directory.agencies:directory.agents;}
  function sorted(items){return items.slice().sort((a,b)=>{
    const agents=x=>ui.mode==='agency'?x.agents.size:x.agencies.size;
    if(ui.sort==='players')return b.players.length-a.players.length||a.name.localeCompare(b.name);
    if(ui.sort==='agents')return agents(b)-agents(a)||a.name.localeCompare(b.name);
    if(ui.sort==='recent')return (b.updatedAt||'').localeCompare(a.updatedAt||'')||a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });}
  function currentItems(){return sorted(rows().filter(x=>fold(x.name).includes(fold(ui.query))));}
  const enc=name=>encodeURIComponent(name).replace(/'/g,'%27');
  function transferHTML(t,card){return t?'<strong>'+escape(t.player)+'</strong><span>'+escape(t.from)+' → '+escape(t.to)+'</span>'+
    (card?'<time datetime="'+escape(t.date)+'">'+dateLabel(t.date)+'</time>':''):'<span class="av2-muted">No recorded transfer</span>';}
  function renderCard(item){const count=ui.mode==='agency'?item.agents.size:item.agencies.size;
    return '<article class="av2-card"><div class="av2-card-top">'+logoHTML(item.name)+'<div class="av2-card-id"><h2 title="'+escape(item.name)+'">'+escape(item.name)+'</h2>'+
      '<div class="av2-counts"><span><strong>'+item.players.length+'</strong>Players</span><span><strong>'+count+'</strong>'+(ui.mode==='agency'?'Agents':'Agencies')+'</span></div></div></div>'+
      '<div class="av2-transfer"><small>Last transfer</small>'+transferHTML(item.last,true)+'</div>'+
      '<button type="button" class="btn ghost av2-view" data-av2-open="'+enc(item.name)+'">View</button></article>';
  }
  function renderList(items){return '<div class="av2-table-wrap"><table class="av2-table"><thead><tr><th>Agency Logo</th><th>'+(ui.mode==='agency'?'Agency':'Agent')+'</th><th>Players</th><th>'+(ui.mode==='agency'?'Agents':'Agencies')+'</th><th>Last Transfer</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>'+
    items.map(item=>'<tr><td>'+logoHTML(item.name,true)+'</td><td><strong>'+escape(item.name)+'</strong></td><td>'+item.players.length+'</td><td>'+(ui.mode==='agency'?item.agents.size:item.agencies.size)+'</td>'+
      '<td><div class="av2-table-transfer">'+transferHTML(item.last,false)+'</div></td><td>'+dateLabel(item.updatedAt)+'</td><td><button type="button" class="btn ghost av2-eye" data-av2-open="'+enc(item.name)+'" aria-label="View '+escape(item.name)+'">◉ <span>View</span></button></td></tr>').join('')+
    '</tbody></table></div>';}
  function header(){const total=directory.agencies.length,agentTotal=directory.agents.length;
    return '<div class="av2-breadcrumb">Resources › <strong>Agencies</strong></div><div class="av2-heading"><div><h1>Agencies</h1><p>Explore basketball agencies and the players they represent.</p></div><span>'+total+' agencies · '+agentTotal+' agents in your database</span></div>'+
      '<div class="av2-toolbar"><div class="seg av2-mode" role="group" aria-label="Directory type"><button type="button" data-av2-mode="agency" class="'+(ui.mode==='agency'?'active':'')+'">Agencies</button><button type="button" data-av2-mode="agent" class="'+(ui.mode==='agent'?'active':'')+'">Agents</button></div>'+
      '<input id="av2Search" type="search" placeholder="Search '+(ui.mode==='agency'?'agencies':'agents')+'..." aria-label="Search '+(ui.mode==='agency'?'agencies':'agents')+'" value="'+escape(ui.query)+'">'+
      '<div class="av2-spacer"></div><div class="seg av2-views" role="group" aria-label="Display"><button type="button" data-av2-view="cards" class="'+(ui.view==='cards'?'active':'')+'">▦ Card view</button><button type="button" data-av2-view="list" class="'+(ui.view==='list'?'active':'')+'">☷ List view</button></div>'+
      '<select id="av2Sort" aria-label="Sort agencies"><option value="alpha">Sort: A → Z</option><option value="players">Most Players</option><option value="agents">Most Agents</option><option value="recent">Recently Updated</option></select></div>';
  }
  function wireDirectory(){
    document.querySelectorAll('[data-av2-mode]').forEach(b=>b.onclick=()=>{ui.mode=b.dataset.av2Mode;ui.query='';renderDirectory();});
    document.querySelectorAll('[data-av2-view]').forEach(b=>b.onclick=()=>{ui.view=b.dataset.av2View;localStorage.setItem(VIEW,ui.view);renderDirectory();});
    document.querySelectorAll('[data-av2-open]').forEach(b=>b.onclick=()=>openAgencyPage(ui.mode,decodeURIComponent(b.dataset.av2Open)));
    const search=byId('av2Search');search.oninput=()=>{ui.query=search.value;paintResults();};
    const sort=byId('av2Sort');sort.value=ui.sort;sort.onchange=()=>{ui.sort=sort.value;paintResults();};
  }
  function paintResults(){const items=currentItems(),host=byId('av2Results');if(!host)return;
    host.innerHTML=items.length?(ui.view==='cards'?'<div class="av2-grid">'+items.map(renderCard).join('')+'</div>':renderList(items)):'<div class="empty">No '+(ui.mode==='agency'?'agencies':'agents')+' match your search.</div>';
    host.querySelectorAll('[data-av2-open]').forEach(b=>b.onclick=()=>openAgencyPage(ui.mode,decodeURIComponent(b.dataset.av2Open)));
  }
  function renderDirectory(force=false){ensureDirectory(force);const app=byId('app');
    app.innerHTML='<div class="av2-page">'+header()+'<div id="av2Results"></div></div>';
    wireDirectory();paintResults();
  }
  function currentProfile(){const view=STATE.agencyView;if(!view)return null;
    ensureDirectory();const data=view.kind==='agent'?directory.agents:directory.agencies;
    return data.find(x=>fold(x.name)===fold(view.name))||null;}
  function profileOverview(item){return '<div class="av2-profile-intro">'+logoHTML(item.name)+'<div><h2>'+escape(item.name)+'</h2><p>'+item.players.length+' players · '+(item.kind==='agency'?item.agents.size+' agents':item.agencies.size+' agencies')+'</p></div></div>'+
    '<div class="av2-profile-summary"><div><span>Players represented</span><strong>'+item.players.length+'</strong></div><div><span>'+(item.kind==='agency'?'Agents':'Agencies')+'</span><strong>'+(item.kind==='agency'?item.agents.size:item.agencies.size)+'</strong></div><div><span>Last transfer</span><strong>'+dateLabel(item.last?.date)+'</strong></div></div>'+
    '<h3>Latest move</h3><div class="av2-profile-move">'+transferHTML(item.last,true)+'</div>';
  }
  function profileAgents(item){const names=item.kind==='agency'?[...item.agents]:[item.name];return '<h3>Agents</h3><div class="av2-plain-list">'+
    (names.length?names.sort((a,b)=>a.localeCompare(b)).map(name=>'<div><strong>'+escape(name)+'</strong><span>'+item.players.filter(p=>EuroScoutAgencyResearch.agentsOf(p).some(a=>fold(a)===fold(name))).length+' players</span></div>').join(''):'<p>No agents recorded yet.</p>')+'</div>';}
  function profilePlayers(item){return '<h3>Players</h3><div class="av2-table-wrap"><table class="av2-table"><thead><tr><th>Player</th><th>Position</th><th>Club</th><th>Agent</th><th>Actions</th></tr></thead><tbody>'+
    item.players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<tr><td><strong>'+escape(p.name)+'</strong></td><td>'+escape(p.role||p.pos||'—')+'</td><td>'+escape(p.teamName||'—')+'</td><td>'+escape(EuroScoutAgencyResearch.agentsOf(p).join(', ')||'—')+'</td><td><button type="button" class="btn ghost av2-eye" data-av2-player="'+escape(p.id)+'">◉ <span>View</span></button></td></tr>').join('')+'</tbody></table></div>';}
  function profileTransfers(item){return '<h3>Transfers</h3>'+(item.transfers.length?'<div class="av2-table-wrap"><table class="av2-table"><thead><tr><th>Date</th><th>Player</th><th>Move</th></tr></thead><tbody>'+item.transfers.map(t=>'<tr><td>'+dateLabel(t.date)+'</td><td><strong>'+escape(t.player)+'</strong></td><td>'+escape(t.from)+' → '+escape(t.to)+'</td></tr>').join('')+'</tbody></table></div>':'<p>No confirmed transfers are recorded for these players.</p>');}
  function profileNotes(item){const value=notes()[agencyKey(item.name)]?.text||'';
    return '<h3>Internal Notes</h3><p>Scouting context for this '+(item.kind==='agency'?'agency':'agent')+'.</p>'+
      (Store.canEdit()?'<textarea id="av2Notes" rows="8" placeholder="Add internal scouting notes...">'+escape(value)+'</textarea><button type="button" class="btn ghost" id="av2SaveNotes">Save notes</button>':'<div class="av2-notes-read">'+escape(value||'No internal notes yet.')+'</div>');}
  function renderProfile(){const item=currentProfile();if(!item){STATE.agencyView=null;renderDirectory();return;}
    const app=byId('app'),tabs=['Overview','Agents','Players','Transfers','Internal Notes'];
    app.innerHTML='<div class="av2-page av2-profile"><div class="av2-breadcrumb"><button type="button" id="av2Back">← Agencies</button> › <strong>'+escape(item.name)+'</strong></div><div class="av2-profile-head">'+logoHTML(item.name)+'<div><h1>'+escape(item.name)+'</h1><p>'+item.players.length+' represented players</p></div>'+
      (Store.canEdit()?'<button type="button" class="btn ghost" id="av2ReplaceLogo">Replace logo</button><input type="file" id="av2LogoFile" accept="image/png,image/jpeg,image/webp" hidden>':'')+'</div>'+
      '<nav class="av2-tabs" aria-label="Agency profile">'+tabs.map(tab=>'<button type="button" data-av2-tab="'+escape(tab)+'" class="'+(ui.tab===tab?'active':'')+'">'+tab+'</button>').join('')+'</nav><section id="av2ProfileBody" class="panel av2-profile-body"></section></div>';
    byId('av2Back').onclick=()=>{STATE.agencyView=null;ui.tab='Overview';renderDirectory();};
    document.querySelectorAll('[data-av2-tab]').forEach(b=>b.onclick=()=>{ui.tab=b.dataset.av2Tab;renderProfile();});
    const body=byId('av2ProfileBody');body.innerHTML=ui.tab==='Overview'?profileOverview(item):ui.tab==='Agents'?profileAgents(item):ui.tab==='Players'?profilePlayers(item):ui.tab==='Transfers'?profileTransfers(item):profileNotes(item);
    body.querySelectorAll('[data-av2-player]').forEach(b=>b.onclick=()=>openProfile(b.dataset.av2Player));
    if(ui.tab==='Internal Notes'&&Store.canEdit())byId('av2SaveNotes').onclick=async()=>{
      const data=notes();data[agencyKey(item.name)]={text:byId('av2Notes').value,updatedAt:new Date().toISOString()};
      localStorage.setItem(NOTES,JSON.stringify(data));const ok=await Store.pushAppKey(NOTES);
      if(ok===false)toast('Notes saved here, but cloud save failed.');else toast('Notes saved.');directory=null;
    };
    if(Store.canEdit()){byId('av2ReplaceLogo').onclick=()=>byId('av2LogoFile').click();byId('av2LogoFile').onchange=e=>saveLogo(item.name,e.target.files?.[0]);}
  }
  async function saveLogo(name,file){if(!Store.canEdit()||!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Choose a PNG, JPEG or WebP logo.');return;}
    if(file.size>5*1024*1024){toast('Logo must be under 5 MB.');return;}
    try{const img=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
      const ctx=canvas.getContext('2d');const scale=Math.min(128/img.width,128/img.height),w=img.width*scale,h=img.height*scale;
      ctx.clearRect(0,0,128,128);ctx.drawImage(img,(128-w)/2,(128-h)/2,w,h);img.close();
      const dataUrl=canvas.toDataURL('image/webp',.88);if(dataUrl.length>100000)throw Error('Compressed logo is too large.');
      const data=logos();data[agencyKey(name)]={data:dataUrl,updatedAt:new Date().toISOString()};
      localStorage.setItem(LOGOS,JSON.stringify(data));const ok=await Store.pushAppKey(LOGOS);
      if(ok===false)toast('Logo saved here, but cloud save failed.');else toast('Logo saved.');directory=null;renderProfile();
    }catch(error){toast('Could not save logo: '+error.message);}
  }
  function renderAgenciesV2(){if(!STATE.data?.leagues)return;if(STATE.agencyView)renderProfile();else renderDirectory(true);}
  window.renderAgencies=renderAgenciesV2;
  window.renderAgencyRoster=renderProfile;
  window.openAgencyRoster=function(encoded){openAgencyPage('agency',decodeURIComponent(encoded));};
  window.openAgentRoster=function(encoded){openAgencyPage('agent',decodeURIComponent(encoded));};
  window.backToAgencies=function(){STATE.agencyView=null;ui.tab='Overview';renderDirectory(true);};
  window.EuroScoutAgenciesV2={buildDirectory,render:renderAgenciesV2,clearCache:()=>{directory=null;}};
})();

