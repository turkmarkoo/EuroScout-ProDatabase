(function(){
const original=openEditModal;
openEditModal=function(id){original(id);const box=document.querySelector('#modal .editgrid'),save=document.getElementById('editSave');if(!box||!save)return;
 const p=player(id),current=effective26(p)||'',section=document.createElement('section');section.className='es-edit-section';
 section.innerHTML='<h4>Team for 2026/27</h4><p class="hint">Set the current club or mark the player as a free agent. Historical season statistics stay with their original club.</p><label for="eRosterSearch">Search club or league</label><input id="eRosterSearch" type="search" placeholder="Club, country or league…"><label for="eRoster26">Club / status</label><select id="eRoster26" style="width:100%;min-height:44px"></select><p id="eRosterChoice" class="hint"></p>';
 box.prepend(section);const input=section.querySelector('input'),select=section.querySelector('select'),choice=section.querySelector('#eRosterChoice');let selected=current;
 let clubs=allClubs();const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const label=k=>!k?'Unknown / clear assignment':isStatus(k)?statusLabel(k):clubByKey(k)?.name||k;
 function paint(){select.replaceChildren(new Option('Unknown / clear assignment',''),new Option('Free agent — no club',STATUS_FREE),new Option('Retired',STATUS_RETIRED));const q=norm(input.value);const rows=clubs.filter(c=>c.key===selected||norm([c.name,c.country,...c.leagues.map(l=>l.name),...c.teams.flatMap(t=>t.searchAliases||[])].join(' ')).includes(q));rows.forEach(c=>select.add(new Option(c.name+' · '+(c.country||c.leagues[0]?.name||''),c.key)));select.value=selected;choice.textContent='Selected: '+label(selected)+(q?' · '+rows.length+' matching clubs':'');}
 const add=document.createElement('button');add.type='button';add.className='btn';add.textContent='+ Add missing club';input.after(add);add.onclick=()=>EuroScoutClubs.addForm(k=>{clubs=allClubs();selected=k;input.value='';paint();choice.textContent+=' · saves with Save';});input.oninput=paint;select.onchange=()=>{selected=select.value;choice.textContent='Selected: '+label(selected)+' · saves with Save';};paint();
 const oldSave=save.onclick;save.onclick=function(e){if(!Store.canEdit()){toast('Sign in with editing access.');return;}if(selected!==current)set26(id,selected);oldSave.call(this,e);};
};window.openEditModal=openEditModal;
})();
