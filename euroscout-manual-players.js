(function () {
  'use strict';
  const KEY='euroscout:manualPlayers:v1';
  const read=()=>{try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function league(raw) {let L=raw.leagues.find(item=>item.meta.id==='custom');
    if(!L){L={meta:{id:'custom',name:'Manual Registry',season:'2026/27',minGames:0,minMpg:0},teams:[],players:[],games:[],statMeta:{}};raw.leagues.push(L);}return L;
  }
  function apply(raw){const rows=read();if(!rows.length)return;const L=league(raw),seen=new Set(L.players.map(p=>p.id));rows.forEach(p=>{if(!seen.has(p.id)){L.players.push({...p,league:'custom',_strictIdentity:true,gameLog:[],pct:{},z:{}});seen.add(p.id);}});}
  function openCreate(){if(!Store.canEdit()){toast('Editing access required.');return;}
    const dialog=document.createElement('dialog');dialog.className='ep2-shell';dialog.id='manualPlayerCreate';dialog.style.cssText='max-width:520px;width:calc(100vw - 32px);border:1px solid var(--line);border-radius:16px;padding:0;box-shadow:0 22px 60px #0003';
    dialog.innerHTML='<form method="dialog" style="padding:24px;display:grid;gap:14px"><div style="display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0">New Player</h2><p class="hint" style="margin:4px 0 0">Add a manual registry record. Details can be completed later.</p></div><button type="button" data-close aria-label="Close" class="btn ghost">×</button></div><label>Player name<input name="name" required maxlength="120" autocomplete="name"></label><label>Birth year<input name="born" inputmode="numeric" type="number" min="1900" max="2100" placeholder="YYYY"></label><label>Position<select name="role"><option value="">Unknown</option><option>Guard</option><option>Forward</option><option>Big</option></select></label><label>Nationality<input name="country" type="search" autocomplete="off" placeholder="Search countries…"></label><label>Height (cm)<input name="height" type="number" min="100" max="250"></label><p role="status" style="margin:0;color:#92500f"></p><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-close class="btn ghost">Cancel</button><button type="submit" class="btn primary">Create player</button></div></form>';
    document.body.appendChild(dialog);dialog.showModal();
    dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>dialog.close());
    dialog.onclose=()=>dialog.remove();dialog.onclick=event=>{if(event.target===dialog)dialog.close();};
    EuroScoutCountryPicker?.mount(dialog.querySelector('[name=country]'),{countries:COUNTRY_LIST});
    const form=dialog.querySelector('form');form.onsubmit=async event=>{
      event.preventDefault();const data=new FormData(form),name=String(data.get('name')||'').trim();if(!name)return;
      const born=String(data.get('born')||'').trim(),country=String(data.get('country')||'').trim(),role=String(data.get('role')||'').trim(),height=Number(data.get('height'))||null;
      const resolved=window.EuroScoutMergeCenter?.resolveImport({name,born,country,role,height});
      if(resolved?.requiresAdminConfirmation){
        const first=resolved.candidates[0];
        if(!confirm('Possible existing player: '+first.name+' ('+first.score+'% match). Create a separate player record anyway?')){dialog.close();EuroScoutMergeCenter.openPair(EuroScoutMergeCenter.detect().player.find(pair=>pair.a.id===first.id||pair.b.id===first.id)?.id||'');return;}
      }
      const p={id:'custom-'+crypto.randomUUID(),code:'',name,born:born?Number(born):null,country,height,role:role||'Unknown',pos:role||'Unknown',team:'',teamName:'',g:0,mpg:0,ppg:0,rpg:0,apg:0,pir:0,eff:0,qualified:false,jersey:'',img:null,_strictIdentity:true};
      const before=localStorage.getItem(KEY),rows=read();rows.push(p);localStorage.setItem(KEY,JSON.stringify(rows));
      const save=form.querySelector('[type=submit]');save.disabled=true;
      try{const ok=await Store.pushAppKey(KEY);if(ok===false)throw Error('Cloud save failed');apply(STATE.data);rebuildLinks();STATE._idx=null;dialog.close();openProfile(p.id);}
      catch(error){before==null?localStorage.removeItem(KEY):localStorage.setItem(KEY,before);form.querySelector('[role=status]').textContent='Could not save player: '+error.message;save.disabled=false;}
    };
    form.querySelector('[name=name]').focus();
  }
  window.EuroScoutManualPlayers={apply,openCreate};
})();
