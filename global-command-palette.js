/* DragonHub / EuroScout shared global navigation palette. Data stays in each app's adapter. */
(function () {
  'use strict';
  const ORDER = ['Players', 'Clubs', 'Agencies', 'Competitions', 'Reports', 'Notes', 'Events'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const matches = (query, value) => fold(query).split(/\s+/).filter(Boolean).every(word => fold(value).includes(word));
  const score = (query, title, extra = '') => {
    const q=fold(query),t=fold(title);
    if(!q || !matches(q,title+' '+extra))return -1;
    if(t===q)return 1000;
    if(t.startsWith(q))return 700;
    if(t.split(/\s+/).some(word=>word.startsWith(q)))return 500;
    if(t.includes(q))return 300;
    return 100;
  };
  function create(config) {
    let overlay=null,input=null,resultHost=null,selected=0,entries=[],groups=[],previousFocus=null,timer=null,closing=false,query='';
    const actions=()=>typeof config.actions==='function'?config.actions():config.actions||[];
    const option=(entry,index)=>'<div class="gcp-option'+(index===selected?' selected':'')+'" role="option" aria-selected="'+(index===selected)+'" data-index="'+index+'" tabindex="-1">'+entry.html+'</div>';
    const icon=(item,fallback)=>item.photo||item.logo?'<img src="'+escape(item.photo||item.logo)+'" data-fallback="'+escape(fallback)+'" alt="" loading="lazy">':'<span>'+escape(item.symbol||fallback)+'</span>';
    const chips=item=>(item.chips||[]).slice(0,4).map(chip=>'<span class="gcp-chip">'+escape(chip)+'</span>').join('');
    function row(item,index) {
      const type=item.type||'generic',isPlayer=type==='player';
      const stats=(item.stats||[]).map(stat=>'<span class="gcp-stat"><b>'+escape(stat.value||'—')+'</b><small>'+escape(stat.label)+'</small></span>').join('');
      const identity=[item.position,item.height?item.height+' cm':'',item.born,item.country].filter(Boolean).join(' · ');
      const main='<span class="gcp-avatar">'+icon(item,type==='player'?'♙':type==='club'?'♜':type==='agency'?'◈':'▤')+'</span><span class="gcp-main"><b>'+escape(item.title)+'</b>'+
        (isPlayer?'<small>'+escape(identity)+'</small><small>'+escape(item.club||item.subtitle||'')+'</small>':item.subtitle?'<small>'+escape(item.subtitle)+'</small>':'')+'</span>'+
        (chips(item)?'<span class="gcp-chips">'+chips(item)+'</span>':'');
      return option({html:'<div class="gcp-row gcp-'+escape(type)+'" data-item="'+index+'">'+main+
        (stats?'<span class="gcp-stats">'+stats+'</span>':'')+(item.season?'<span class="gcp-season"><b>'+escape(item.season)+'</b><small>Season</small></span>':'')+
        '<span class="gcp-open">'+escape(item.openLabel||'Open')+' →</span>'+
        (item.onWatch?'<button type="button" class="gcp-watch" data-watch="'+index+'" aria-label="'+escape(item.watchLabel||(item.watching?'Remove from watchlist':'Add to watchlist'))+'">'+(item.watching?'★':'☆')+'</button>':'')+'</div>'+
        (item.duplicate?'<div class="gcp-duplicate"><span>⚠ Possible duplicate · '+escape(item.duplicate.confidence)+'% confidence</span><button type="button" data-merge="'+index+'">Open Merge Center →</button></div>':'')},index);
    }
    function render() {
      if(!overlay)return;
      query=input.value.trim();entries=[];groups=[];
      const actionItems=actions().filter(action=>action && action.available!==false);
      let html='<section class="gcp-group gcp-quick"><header><h2>Quick Actions</h2></header><div class="gcp-actions">';
      actionItems.forEach(action=>{const index=entries.length;entries.push({kind:'action',action,group:'Quick Actions'});html+=option({html:'<div class="gcp-action"><span class="gcp-action-icon">'+escape(action.icon||'+')+'</span><b>'+escape(action.title)+'</b></div>'},index);});
      html+='</div></section>';
      let total=0;
      const minQueryLength=Math.max(1,Number(config.minQueryLength)||1);
      if(query&&fold(query).length>=minQueryLength){
        let provided={};try{provided=config.search(query)||{};}catch(error){console.error('Global search failed',error);}
        ORDER.forEach(title=>{
          const section=provided[title];if(!section || !section.items?.length)return;
          const items=section.items.slice(0,section.limit||5);total+=section.total??section.items.length;
          groups.push(title);
          html+='<section class="gcp-group"><header><h2>'+title+'</h2><span class="gcp-count">'+escape(section.total??section.items.length)+' results</span>'+
            (section.seeAll?'<button type="button" data-see-all="'+escape(title)+'">See all '+escape(title.toLowerCase())+' →</button>':'')+'</header><div class="gcp-group-rows">';
          items.forEach(item=>{const index=entries.length;entries.push({kind:'result',item,group:title});html+=row(item,index);});
          html+='</div></section>';
        });
        if(!total)html+='<div class="gcp-empty"><b>No results found.</b><span>Create a new player? Create a new club?</span></div>';
      } else if(query) html+='<p class="gcp-hint">Type at least '+minQueryLength+' characters to search.</p>';
      else html+='<p class="gcp-hint">Search across players, clubs, agencies, competitions, reports, notes and events.</p>';
      if(query&&total&&selected===0)selected=actionItems.length;
      selected=Math.max(0,Math.min(selected,entries.length-1));
      resultHost.innerHTML=html;
      mark();
      resultHost.querySelectorAll('.gcp-avatar img').forEach(img=>img.onerror=()=>{const replacement=document.createElement('span');replacement.textContent=img.dataset.fallback||'•';img.replaceWith(replacement);});
      resultHost.querySelectorAll('[data-index]').forEach(node=>node.onclick=event=>{if(event.target.closest('[data-watch],[data-merge]'))return;activate(Number(node.dataset.index));});
      resultHost.querySelectorAll('[data-watch]').forEach(node=>node.onclick=async event=>{event.stopPropagation();const item=entries[Number(node.dataset.watch)]?.item;await item?.onWatch?.();refresh();});
      resultHost.querySelectorAll('[data-merge]').forEach(node=>node.onclick=event=>{event.stopPropagation();const item=entries[Number(node.dataset.merge)]?.item;close({navigate:true});item?.duplicate?.onOpen?.();});
      resultHost.querySelectorAll('[data-see-all]').forEach(node=>node.onclick=()=>{const section=providedFor(node.dataset.seeAll);if(section?.seeAll){close({navigate:true});section.seeAll();}});
    }
    function providedFor(title){try{return config.search(input.value.trim())?.[title];}catch{return null;}}
    function mark() {if(!resultHost)return;resultHost.querySelectorAll('[data-index]').forEach(node=>{const on=Number(node.dataset.index)===selected;node.classList.toggle('selected',on);node.setAttribute('aria-selected',String(on));if(on)node.scrollIntoView({block:'nearest'});});}
    function activate(index){const entry=entries[index];if(!entry)return;close({navigate:true});(entry.kind==='action'?entry.action.onOpen:entry.item.onOpen)?.();}
    function move(delta){if(!entries.length)return;selected=(selected+delta+entries.length)%entries.length;mark();}
    function moveGroup(delta){if(!entries.length)return;const names=[...new Set(entries.map(entry=>entry.group))];const current=names.indexOf(entries[selected]?.group);const target=names[(current+delta+names.length)%names.length];selected=entries.findIndex(entry=>entry.group===target);mark();}
    function handleKey(event){if(!overlay)return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key==='ArrowDown'){event.preventDefault();move(1);return;}
      if(event.key==='ArrowUp'){event.preventDefault();move(-1);return;}
      if(event.key==='Tab'){event.preventDefault();moveGroup(event.shiftKey?-1:1);return;}
      if(event.key==='Enter'){event.preventDefault();activate(selected);}
    }
    function open(initial='') {
      if(overlay){input.value=initial||input.value;input.focus();render();return;}
      previousFocus=document.activeElement;closing=false;selected=0;
      overlay=document.createElement('div');overlay.className='gcp-overlay';overlay.innerHTML='<div class="gcp-panel" role="dialog" aria-modal="true" aria-label="Global search command palette"><div class="gcp-search"><span aria-hidden="true">⌕</span><input class="gcp-input" type="search" autocomplete="off" spellcheck="false" aria-label="Search all basketball objects" placeholder="Search players, clubs, agencies, competitions..."><span class="gcp-esc">Press <kbd>Esc</kbd> to close</span></div><div class="gcp-results" role="listbox"></div><footer class="gcp-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Tab</kbd> Category</span><span><kbd>Esc</kbd> Close</span></footer></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
      input=overlay.querySelector('.gcp-input');resultHost=overlay.querySelector('.gcp-results');input.value=initial;
      input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{selected=0;render();},Math.max(65,Number(config.inputDelay)||65));});
      overlay.addEventListener('keydown',handleKey);
      requestAnimationFrame(()=>overlay?.classList.add('open'));
      config.afterOpen?.();render();input.focus();
    }
    function close({navigate=false}={}){if(!overlay||closing)return;closing=true;clearTimeout(timer);const node=overlay;overlay=null;input=null;resultHost=null;config.afterClose?.();if(navigate){node.remove();return;}node.classList.remove('open');node.classList.add('closing');setTimeout(()=>node.remove(),120);previousFocus?.focus?.();}
    function refresh(){if(overlay)render();}
    function bind(trigger){
      if(trigger){if(trigger.tagName==='INPUT'){trigger.addEventListener('input',()=>{if(trigger.value.trim())open(trigger.value);});trigger.addEventListener('focus',()=>{if(trigger.value.trim())open(trigger.value);});}else trigger.addEventListener('click',()=>open());}
      document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='k'){event.preventDefault();open();}});
    }
    return {open,close,refresh,bind,isOpen:()=>!!overlay};
  }
  window.GlobalCommandPalette={create,fold,matches,score,order:ORDER};
})();
