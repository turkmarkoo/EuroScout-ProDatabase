/* Admin-only, reversible identity consolidation. Feed rows remain immutable. */
(function () {
  'use strict';
  const KEY = 'euroscout:mergeCenter:v1';
  const WINDOW = 30 * 24 * 60 * 60 * 1000;
  const RELATED = ['euroscout:sessions:v1', 'euroscout:shortcuts:v1', 'euroscout:market:v1',
    'euroscout:matchup', 'euroscout:next26:v1', 'euroscout:next26b:v1',
    'euroscout:trHandled:v1', 'euroscout:notionApplied:v1'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let cachedRaw, cachedState;
  const current = () => {
    const raw=localStorage.getItem(KEY);
    if (raw!==cachedRaw) { cachedRaw=raw; try { cachedState=JSON.parse(raw)||{}; } catch { cachedState={}; } }
    return cachedState || {};
  };
  const state = () => { const value=current(); return { merges:[...(value.merges||[])], reviewed:{...(value.reviewed||{})}, scannedAt:value.scannedAt||'' }; };
  const active = type => (current().merges||[]).filter(x => x.type === type && !x.undoneAt);
  const canonicalPlayer = ids => {
    const set = new Set(ids);
    for (const m of active('player')) if (set.has(m.survivor) || set.has(m.source)) return m.survivor;
    return null;
  };
  const canonicalClub = ids => {
    const set = new Set(ids);
    for (const m of active('club')) if (set.has(m.survivor) || set.has(m.source)) return m.survivor;
    return null;
  };
  const canonicalAgent = name => {
    let current = name;
    for (let i = 0; i < 8; i++) {
      const next = active('agent').find(x => fold(x.source) === fold(current));
      if (!next) break;
      current = next.survivor;
    }
    return current;
  };
  const activeClubMerges = () => active('club');
  const hasManualGroup = group => { const ids=new Set(group.map(p=>p.id)); return active('player').some(m=>ids.has(m.survivor)&&ids.has(m.source)); };
  const pairKey = (type, a, b) => type + ':' + [a,b].sort().join('|');
  const app = document.getElementById('app');
  const view = { type:'player', query:'', confidence:'all', status:'pending', reviewed:'all', pair:null, manualCandidate:null, manualA:null, manualB:null, quality:null, options:null, survivor:null, candidates:[], extraAttempted:false, extraLoading:false };
  let detectionCache = null, detectionSignature = '', entityCache = {}, importQueue = [];

  function entities(type) {
    if(entityCache[type])return entityCache[type];
    if (type === 'player') {
      const map = new Map();
      allPlayersEvery().forEach(p => { const id = gid(p); if (!map.has(id) || p.id === id) map.set(id, p); });
      return entityCache[type]=[...map.entries()].map(([id,p]) => ({ id, name:p.name, born:p.born || '', country:p.country || '',
        height:p.height || '', position:p.role || p.pos || '', team:p.teamName || '', league:p.league || '', photo:photoOf(p) || '',
        external:p._ext || '', fiba:p.fibaId || p._fiba || '', player:p, report:Store.get(id) }));
    }
    if (type === 'club') return entityCache[type]=allClubs().map(c => ({ id:c.key, name:c.name, country:c.country || '',
      competitions:(c.leagues || []).map(l => l.name).join(', '), roster:(c.teams || []).length,
      logo:clubLogo(c) || '', club:c }));
    const pool=assignPool(), counts=new Map();
    pool.forEach(p=>{const key=fold(canonicalAgent(p.agent));if(key)counts.set(key,(counts.get(key)||0)+1);});
    return entityCache[type]=agentList().map(name => ({ id:name, name, agency:agencyForAgent(name) || '',
      players:counts.get(fold(name))||0 }));
  }
  function indexPairs(items, key, score, reason, out) {
    const buckets = new Map();
    items.forEach(item => { const value = key(item); if (!value) return; if (!buckets.has(value)) buckets.set(value, []); buckets.get(value).push(item); });
    for (const bucket of buckets.values()) {
      if (bucket.length < 2 || bucket.length > 16) continue;
      for (let i=0;i<bucket.length;i++) for (let j=i+1;j<bucket.length;j++) {
        const a=bucket[i], b=bucket[j]; if (a.id === b.id) continue;
        const type = out.type, id=pairKey(type,a.id,b.id);
        const grade=typeof score==='function'?score(a,b):score;
        if(!grade)continue;
        const old=out.map.get(id); if (!old || grade > old.score) out.map.set(id,{ id,type,a,b,score:grade,reason });
      }
    }
  }
  function externalId(value, provider) {
    const text=String(value||'');
    const match=provider==='eurobasket'?text.match(/(?:eurobasket\.com\/player\/[^?#]*?\/)(\d+)(?:[/?#]|$)/i):text.match(/(?:fiba\.basketball\/[^?#]*?\/players?\/)([\w-]+)(?:[/?#]|$)/i);
    return match?match[1]:text&&!text.includes('/')?text:'';
  }
  function playerConfidence(a,b) {
    const euroA=externalId(a.external,'eurobasket'),euroB=externalId(b.external,'eurobasket');
    const fibaA=externalId(a.fiba,'fiba'),fibaB=externalId(b.fiba,'fiba');
    if(euroA&&euroB&&euroA===euroB || fibaA&&fibaB&&fibaA===fibaB)return 99;
    if(euroA&&euroB&&euroA!==euroB || fibaA&&fibaB&&fibaA!==fibaB)return 0;
    const nameA=fold(a.name),nameB=fold(b.name),exactName=nameA&&nameA===nameB;
    const lastA=nameA.split(' ').at(-1),lastB=nameB.split(' ').at(-1);
    if(!exactName&&(!lastA||lastA!==lastB))return 0;
    if(a.born&&b.born&&String(a.born)!==String(b.born))return 0;
    let score=exactName?60:24;
    if(a.born&&b.born)score+=23;
    const heightA=Number(a.height),heightB=Number(b.height);
    if(heightA&&heightB){const diff=Math.abs(heightA-heightB);if(diff>10)return 0;score+=diff<=3?8:2;}
    if(a.country&&b.country){if(fold(a.country)===fold(b.country))score+=6;else score-=15;}
    if(a.position&&b.position){const pa=fold(a.position),pb=fold(b.position);if(pa===pb)score+=3;else if(pa.includes(pb)||pb.includes(pa))score+=1;}
    return Math.max(0,Math.min(98,score));
  }
  function resolveImport(incoming) {
    const player={id:'incoming',name:incoming.name||'',born:incoming.born||incoming.birthYear||'',country:incoming.country||incoming.nationality||'',height:incoming.height||'',position:incoming.position||incoming.role||incoming.pos||'',external:incoming.eurobasketId||incoming.eurobasket||incoming._ext||'',fiba:incoming.fibaId||incoming.fiba||incoming._fiba||''};
    const candidates=entities('player').map(existing=>({id:existing.id,name:existing.name,born:existing.born,score:playerConfidence(player,existing)})).filter(x=>x.score>=60).sort((a,b)=>b.score-a.score).slice(0,20);
    return {status:candidates.length?'review':'new',candidates,requiresAdminConfirmation:!!candidates.length};
  }
  function previewImport(players) {
    const byName=new Map(),byBirthSurname=new Map(),byEurobasket=new Map(),byFiba=new Map();
    const add=(map,key,item)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(item);};
    entities('player').forEach(existing=>{
      const name=fold(existing.name);add(byName,name,existing);
      if(existing.born)add(byBirthSurname,name.split(' ').at(-1)+'|'+existing.born,existing);
      add(byEurobasket,externalId(existing.external,'eurobasket'),existing);
      add(byFiba,externalId(existing.fiba,'fiba'),existing);
    });
    const flagged=(players||[]).flatMap(incoming=>{
      const probe={name:incoming.name,born:incoming.born||'',height:incoming.height||'',country:incoming.country||'',position:incoming.role||incoming.pos||'',external:incoming._ext||incoming.eurobasketId||'',fiba:incoming.fibaId||incoming._fiba||''};
      const key=fold(probe.name);
      const matches=[...new Map([...(byName.get(key)||[]),...(probe.born?byBirthSurname.get(key.split(' ').at(-1)+'|'+probe.born)||[]:[]),...(byEurobasket.get(externalId(probe.external,'eurobasket'))||[]),...(byFiba.get(externalId(probe.fiba,'fiba'))||[])].map(item=>[item.id,item])).values()];
      const candidates=matches.map(existing=>({id:existing.id,name:existing.name,score:playerConfidence(probe,existing)})).filter(x=>x.score>=60).sort((a,b)=>b.score-a.score);
      return candidates.length?[{id:incoming.id,name:incoming.name,candidates,requiresAdminConfirmation:true}]:[];
    });
    importQueue=[...new Map([...importQueue,...flagged].map(item=>[item.id,item])).values()];
    return flagged;
  }
  function detect(force=false) {
    const signature=state().merges.map(m=>m.id+':'+(m.undoneAt||'')).join('|');
    if (!force && detectionCache && signature===detectionSignature) return detectionCache;
    if(force||signature!==detectionSignature)entityCache={};
    const result = { player:[], club:[], agent:[] };
    for (const type of Object.keys(result)) {
      const items=entities(type), out={type,map:new Map()};
      if (type === 'player') {
        indexPairs(items,x => externalId(x.external,'eurobasket'),playerConfidence,'Same Eurobasket profile',out);
        indexPairs(items,x => externalId(x.fiba,'fiba'),playerConfidence,'Same FIBA profile',out);
        indexPairs(items,x => fold(x.name),playerConfidence,'Name, birth year and bio comparison',out);
        indexPairs(items,x => x.born ? fold(x.name).split(' ').at(-1)+'|'+x.born : '',playerConfidence,'Same surname and birth year',out);
      } else if (type === 'club') {
        indexPairs(items,x => fold(x.name)+'|'+fold(x.country),92,'Same club name and country',out);
        indexPairs(items,x => fold(x.name),80,'Same club name',out);
        indexPairs(items,x => x.country ? fold(x.name).split(' ')[0]+'|'+fold(x.country) : '',72,'Similar name and country',out);
      } else {
        indexPairs(items,x => fold(x.name),91,'Same agent name after diacritics',out);
        indexPairs(items,x => x.agency ? fold(x.name)+'|'+fold(x.agency) : '',94,'Same agent and agency',out);
        indexPairs(items,x => x.agency ? fold(x.name).split(' ').at(-1)+'|'+fold(x.agency) : '',72,'Same surname and agency',out);
      }
      const existing = new Set(active(type).map(m => pairKey(type,m.survivor,m.source)));
      result[type]=[...out.map.values()].filter(c => !existing.has(c.id)).sort((a,b)=>b.score-a.score || a.a.name.localeCompare(b.a.name));
    }
    detectionCache=result; detectionSignature=signature;
    return result;
  }
  const val = x => x == null || x === '' ? '—' : String(x);
  const reportParts = rec => { try { return JSON.parse(rec.report||'{}')||{}; } catch { return {overall:rec.report||''}; } };
  function comparison(type, a, b) {
    if (type === 'player') {
      const ar=reportParts(a.report), br=reportParts(b.report);
      const notes=r=>['nAth','nOff','nDef','nIntel','nProj'].map(k=>r[k]).filter(Boolean).join(' · ');
      const fields = [
        ['Photo',a.photo,b.photo,'image'],['Name',a.name,b.name],['Birth year',a.born,b.born],
        ['Nationality',a.country,b.country],['Height',a.height&&a.height+' cm',b.height&&b.height+' cm'],
        ['Club',a.team,b.team],['League',a.league,b.league],
        ['Agent',a.player.agent,b.player.agent],['Agency',a.player.agency,b.player.agency],
        ['External links',a.external,b.external],['Reports',ar.overall||('Rating '+(a.report.rating||0)),br.overall||('Rating '+(b.report.rating||0))],
        ['Notes',notes(ar),notes(br)],['Statistics',(a.player._grp||[a.player]).length+' entries',(b.player._grp||[b.player]).length+' entries'],
        ['Timeline',JSON.stringify({eye:a.report.eye||{},workflow:ar._workflow||{}}),JSON.stringify({eye:b.report.eye||{},workflow:br._workflow||{}})],
        ['Watchlist',a.report.watch?'Yes':'No',b.report.watch?'Yes':'No'],
        ['Review queue',ar._workflow?.review?.status||'—',br._workflow?.review?.status||'—']
      ]; return fields;
    }
    if (type === 'club') return [['Club',a.name,b.name],['Country',a.country,b.country],
      ['Competitions',a.competitions,b.competitions],['Roster',a.roster,b.roster],
      ['History',a.club.teams?.length,b.club.teams?.length],['Logo',a.logo,b.logo,'image'],
      ['Reports','Preserved through team keys','Preserved through team keys'],
      ['Players','Preserved through team keys','Preserved through team keys']];
    return [['Agent',a.name,b.name],['Agency',a.agency,b.agency],['Players',a.players,b.players],
      ['Country','—','—'],['Contact','—','—'],['Links','—','—']];
  }
  function imageOrText(value, kind) {
    if (kind !== 'image') return esc(val(value));
    return value ? '<img class="mc-thumb" src="'+esc(value)+'" alt="">' : '—';
  }
  function saveState(next) {
    next.merges.forEach(m=>{if(Date.now()-Date.parse(m.at)>WINDOW){delete m.before;delete m.after;}});
    localStorage.setItem(KEY,JSON.stringify(next));
    try { Sync.stampKey(KEY); } catch {}
    return Store.pushAppKey(KEY);
  }
  function replaceId(value, sources, survivor) {
    if (typeof value === 'string') return sources.has(value) ? survivor : value;
    if (Array.isArray(value)) return value.map(v => replaceId(v,sources,survivor));
    if (value && typeof value === 'object') {
      const out={}; for (const [k,v] of Object.entries(value)) {
        const key=sources.has(k)?survivor:k, next=replaceId(v,sources,survivor);
        if (Object.hasOwn(out,key) && Array.isArray(out[key]) && Array.isArray(next)) out[key]=[...out[key],...next];
        else if (Object.hasOwn(out,key) && typeof out[key]==='object' && typeof next==='object') out[key]={...out[key],...next};
        else out[key]=next;
      } return out;
    }
    return value;
  }
  function mergeReport(target, source, options) {
    let a={},b={}; try { a=JSON.parse(target||'{}'); } catch { a={overall:target||''}; }
    try { b=JSON.parse(source||'{}'); } catch { b={overall:source||''}; }
    for (const [key,value] of Object.entries(b)) {
      const category = key==='_workflow' ? 'timeline' : key.startsWith('n') || key==='overall' ? 'notes' : 'reports';
      if (!options[category] || value == null || value === '') continue;
      if (a[key] == null || a[key] === '') a[key]=value;
      else if (typeof value === 'string' && typeof a[key] === 'string' && !a[key].includes(value)) a[key] += '\n—\n'+value;
      else if (Array.isArray(a[key]) && Array.isArray(value)) a[key]=[...new Set([...a[key],...value])];
      else if (typeof a[key] === 'object' && typeof value === 'object') a[key]={...value,...a[key]};
    }
    return JSON.stringify(a);
  }
  async function merge(candidate, survivor, options) {
    if (!Store.canEdit()) throw Error('Administrator access is required.');
    if (!candidate || ![candidate.a.id,candidate.b.id].includes(survivor)) throw Error('Choose a surviving record.');
    const source=candidate.a.id===survivor?candidate.b.id:candidate.a.id;
    const type=candidate.type;
    if (active(type).some(m=>pairKey(type,m.survivor,m.source)===pairKey(type,survivor,source))) throw Error('These records are already merged.');
    const description=(candidate.a.id===survivor?candidate.a.name:candidate.b.name)+' will survive. '+
      (candidate.a.id===source?candidate.a.name:candidate.b.name)+' will become an alias. Confirm merge?';
    if (!window.confirm(description)) return false;
    const before={}; const keys=type==='player'?[...RELATED,'euroscout:overrides']:[];
    keys.forEach(k=>before[k]=localStorage.getItem(k));
    if (type==='player') before.record=structuredClone(Store.get(survivor));
    const entry={ id:crypto.randomUUID(), type, survivor, source, at:new Date().toISOString(),
      admin:Store.user?.email||window.ESAccess?.user?.email||'Administrator', options, before, after:{} };
    const oldState=state();
    try {
      const pending=[];
      if (type==='player') {
        const target=Store.get(survivor), other=Store.get(source);
        const sourcePlayer=player(source), sourceIds=new Set((sourcePlayer?sourcePlayer._grp||[sourcePlayer]:[]).map(p=>p.id));
        sourceIds.add(source);
        const merged={...target};
        if (options.reports||options.notes||options.timeline||options.review) merged.report=mergeReport(target.report,other.report,options);
        if (options.watchlist) merged.watch=!!(target.watch||other.watch);
        if (options.reports) { merged.rating=Math.max(target.rating||0,other.rating||0); merged.tags=[...new Set([...(target.tags||[]),...(other.tags||[])])]; }
        if (options.timeline) merged.eye={...(other.eye||{}),...(target.eye||{})};
        const override=ovrLocal(); override.links.push([survivor,source]);
        if (options.external && !override.ext?.[survivor] && override.ext?.[source]) override.ext[survivor]=override.ext[source];
        if (options.images || options.external) override.bio[survivor]={...(override.bio[source]||{}),...(override.bio[survivor]||{})};
        localStorage.setItem('euroscout:overrides',JSON.stringify(override));
        for (const key of RELATED) {
          const raw=localStorage.getItem(key); if (!raw) continue;
          let data; try { data=JSON.parse(raw); } catch { continue; }
          localStorage.setItem(key,JSON.stringify(replaceId(data,sourceIds,survivor)));
        }
        pending.push(Store.save(survivor,merged));
        for (const key of keys) { entry.after[key]=localStorage.getItem(key); pending.push(Store.pushAppKey(key)); }
      }
      const next=state(); next.merges.push(entry); next.reviewed[candidate.id]='merged';
      pending.push(saveState(next));
      if ((await Promise.all(pending)).some(result=>result===false)) throw Error('Cloud save did not complete.');
      if (type==='player') { OVR=ovrMerged(); rebuildLinks(); applyOverrides(); }
      if (type==='club') { buildClubs(); NEXTCOMP=null; DOM27=null; }
      if (type==='agent') applyOverrides();
      detectionCache=null; entityCache={}; view.pair=null; view.manualCandidate=null; renderMergeCenter(); toast('Merge saved. Undo is available for 30 days.');
      return true;
    } catch (error) {
      for (const [key,raw] of Object.entries(before)) if (key!=='record') raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);
      const rollback=[];
      if (type==='player') { rollback.push(Store.save(survivor,before.record));for(const key of keys)rollback.push(Store.pushAppKey(key));OVR=ovrMerged(); rebuildLinks(); applyOverrides(); }
      rollback.push(saveState(oldState));
      await Promise.allSettled(rollback);
      throw error;
    }
  }
  async function undo(id) {
    if (!Store.canEdit()) throw Error('Administrator access is required.');
    const old=state(), entry=old.merges.find(m=>m.id===id);
    if (!entry || entry.undoneAt || Date.now()-Date.parse(entry.at)>WINDOW) throw Error('Undo is no longer available.');
    if (!window.confirm('Undo this merge and restore both identities?')) return;
    const original=structuredClone(old), postRecord=entry.type==='player'?structuredClone(Store.get(entry.survivor)):null;
    try {
    if (entry.type==='player') {
      for (const [key,post] of Object.entries(entry.after)) if (localStorage.getItem(key)!==post)
        throw Error('Related data changed since the merge. Review those edits before undoing.');
      const pending=[];
      for (const [key,raw] of Object.entries(entry.before)) if (key!=='record') {
        raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);
        pending.push(Store.pushAppKey(key));
      }
      pending.push(Store.save(entry.survivor,entry.before.record));
      OVR=ovrMerged(); rebuildLinks(); applyOverrides();
      entry.undoneAt=new Date().toISOString();
      pending.push(saveState(old));
      if((await Promise.all(pending)).some(result=>result===false))throw Error('Cloud save did not complete. Please refresh and retry.');
    } else {
      entry.undoneAt=new Date().toISOString();
      if(!await saveState(old))throw Error('Cloud save did not complete. Please refresh and retry.');
    }
    if (entry.type==='club') { buildClubs(); NEXTCOMP=null; DOM27=null; }
    if (entry.type==='agent') applyOverrides();
    detectionCache=null; entityCache={}; renderMergeCenter(); toast('Merge undone.');
    } catch(error) {
      const rollback=[];
      if(entry.type==='player') {
        for(const [key,post] of Object.entries(entry.after)) {post==null?localStorage.removeItem(key):localStorage.setItem(key,post);rollback.push(Store.pushAppKey(key));}
        rollback.push(Store.save(entry.survivor,postRecord));
        OVR=ovrMerged(); rebuildLinks(); applyOverrides();
      }
      rollback.push(saveState(original));
      await Promise.allSettled(rollback);
      throw error;
    }
  }
  function summary() {
    const list=detect(), players=entities('player');
    return [
      ['Players',list.player.length,'player'],['Clubs',list.club.length,'club'],['Agents',list.agent.length,'agent'],
      ['Missing photos',players.filter(p=>!p.photo).length,'photo'],
      ['Missing Eurobasket links',players.filter(p=>!/eurobasket\.com/i.test(p.external)).length,'eurobasket'],
      ['Missing birth years',players.filter(p=>!p.born).length,'birth'],
      ['Missing nationalities',players.filter(p=>!p.country).length,'country']
    ];
  }
  function renderReview(candidate) {
    const fields=comparison(candidate.type,candidate.a,candidate.b);
    view.survivor ||= candidate.a.id;
    view.options ||= Object.fromEntries(['reports','notes','statistics','timeline','watchlist','review','external','images'].map(x=>[x,true]));
    const warnings=[];
    if (candidate.type==='player') {
      for (const [label,key] of [['Birth year','born'],['Nationality','country'],['Current club','team']])
        if (candidate.a[key]&&candidate.b[key]&&fold(candidate.a[key])!==fold(candidate.b[key])) warnings.push(label+' mismatch');
    }
    app.innerHTML='<div class="mc-page"><button class="es-button" id="mcBack">← Back to suggestions</button>'+
      '<div class="mc-head"><div><h1>Review possible '+esc(candidate.type)+' duplicate</h1><p>Compare both records before choosing the survivor.</p></div></div>'+
      (warnings.length?'<div class="mc-warning">⚠ '+warnings.map(esc).join(' · ')+'</div>':'')+
      '<div class="mc-compare"><div class="mc-record"><h2>'+esc(candidate.a.name)+'</h2><small>'+esc(candidate.a.id)+'</small></div>'+
      '<div class="mc-record"><h2>'+esc(candidate.b.name)+'</h2><small>'+esc(candidate.b.id)+'</small></div></div>'+
      '<div class="mc-fields">'+fields.map(([label,left,right,kind])=>{
        const differs=val(left)!==val(right);
        return '<div class="mc-field'+(differs?' differs':'')+'"><strong>'+esc(label)+'</strong><span>'+imageOrText(left,kind)+'</span><span>'+imageOrText(right,kind)+'</span></div>';
      }).join('')+'</div><section class="mc-controls"><h2>Which record survives?</h2><div class="mc-choice">'+
      [candidate.a,candidate.b].map(x=>'<label><input type="radio" name="mcSurvivor" value="'+esc(x.id)+'"'+(view.survivor===x.id?' checked':'')+'> '+esc(x.name)+' <small>'+esc(x.id)+'</small></label>').join('')+'</div>'+
      (candidate.type==='player'?'<h2>Information to combine</h2><div class="mc-options">'+
      Object.entries({reports:'Reports',notes:'Notes',statistics:'Statistics',timeline:'Timeline',watchlist:'Watchlist',review:'Review queue',external:'External links',images:'Images'}).map(([key,label])=>
        '<label><input type="checkbox" data-mc-option="'+key+'"'+(view.options[key]?' checked':'')+(['statistics','images'].includes(key)?' disabled':'')+'> '+label+(['statistics','images'].includes(key)?' (always preserved)':'')+'</label>').join('')+'</div>':'')+
      '<p class="hint">Statistics and images stay with their source entries. Source records remain in the backup for a 30-day undo period. No merge runs without confirmation.</p>'+
      '<button class="es-button es-primary" id="mcMerge">Merge selected records</button></section></div>';
    document.getElementById('mcBack').onclick=()=>{view.pair=null;view.manualCandidate=null;renderMergeCenter();};
    document.querySelectorAll('[name=mcSurvivor]').forEach(el=>el.onchange=()=>view.survivor=el.value);
    document.querySelectorAll('[data-mc-option]').forEach(el=>el.onchange=()=>view.options[el.dataset.mcOption]=el.checked);
    document.getElementById('mcMerge').onclick=async e=>{e.currentTarget.disabled=true;try{await merge(candidate,view.survivor,view.options);}catch(error){toast(error.message);e.currentTarget.disabled=false;}};
  }
  function renderMergeCenter() {
    if (!Store.canEdit()) { app.innerHTML='<div class="mc-page"><h1>Administrator access required</h1></div>'; return; }
    if (!view.extraAttempted && !STATE._extraDone) {
      view.extraAttempted=true; view.extraLoading=true;
      app.innerHTML='<div class="mc-page"><h1>Merge Center</h1><p>Checking all player leagues, including NCAA…</p></div>';
      loadExtraLeagues().catch(error=>console.warn('Additional player leagues could not be checked',error)).finally(()=>{
        view.extraLoading=false; detectionCache=null; entityCache={};
        if (STATE.view==='mergecenter') renderMergeCenter();
      });
      return;
    }
    if (view.extraLoading) return;
    const all=detect();
    if (view.manualCandidate) { renderReview(view.manualCandidate); return; }
    if (view.quality) {
      const quality=view.quality, items=entities('player').filter(p=>quality==='photo'?!p.photo:quality==='eurobasket'?!/eurobasket\.com/i.test(p.external):quality==='birth'?!p.born:!p.country);
      app.innerHTML='<div class="mc-page"><button class="es-button" id="mcBackQuality">← Back to Merge Center</button><div class="mc-head"><div><h1>Missing '+esc(({photo:'photos',eurobasket:'Eurobasket links',birth:'birth years',country:'nationalities'})[quality])+'</h1><p>'+items.length+' player records need review.</p></div></div><div class="mc-list">'+items.slice(0,250).map(p=>'<div class="mc-row"><span>Player</span><strong>'+esc(p.name)+'</strong><span>'+esc(p.team)+'</span><span><button class="es-button" data-mc-profile="'+esc(p.id)+'">Open profile</button></span></div>').join('')+'</div></div>';
      document.getElementById('mcBackQuality').onclick=()=>{view.quality=null;renderMergeCenter();};
      document.querySelectorAll('[data-mc-profile]').forEach(b=>b.onclick=()=>openProfile(b.dataset.mcProfile));
      return;
    }
    if (view.pair) { const found=all[view.type].find(x=>x.id===view.pair); if(found){renderReview(found);return;} view.pair=null; }
    const reviewed=state().reviewed;
    const list=all[view.type].filter(x=>{
      const q=fold(view.query), match=!q||fold(x.a.name+' '+x.b.name+' '+x.reason+' '+x.a.id+' '+x.b.id).includes(q);
      return match && (view.confidence==='all'||(view.confidence==='high'?x.score>=95:view.confidence==='medium'?x.score>=80&&x.score<95:x.score<80)) &&
        (view.status==='all'||(view.status==='pending'?!reviewed[x.id]:reviewed[x.id]===view.status)) &&
        (view.reviewed==='all'||(view.reviewed==='yes'?!!reviewed[x.id]:!reviewed[x.id]));
    });
    const counters=summary();
    app.innerHTML='<div class="mc-page"><div class="mc-head"><div><h1>Merge Center</h1><p>Maintain database quality. Merge duplicate players, clubs and agents.</p></div><button class="es-button" id="mcRefresh">↻ Refresh detection</button></div>'+
      '<div class="mc-quality">'+counters.map(([label,count,target])=>'<button data-mc-quality="'+target+'"><strong>'+count+'</strong><span>'+esc(label)+'</span></button>').join('')+'</div>'+
      '<div class="mc-tabs" role="tablist">'+[['player','Players'],['club','Clubs'],['agent','Agents']].map(([key,label])=>'<button data-mc-tab="'+key+'" class="'+(view.type===key?'active':'')+'">'+label+' <span>'+all[key].length+'</span></button>').join('')+'</div>'+
      (view.type==='player'?'<h2>Identity Resolution queue</h2><p>Possible cross-league identities stay separate until an administrator compares and confirms them.'+(importQueue.length?' '+importQueue.length+' incoming records were flagged before joining the registry.':'')+'</p>':'')+
      '<details class="mc-manual"><summary>Review a pair manually</summary><p>Find both records, compare them, then choose which survives.</p><div class="mc-manual-grid"><div><label for="mcManualA">First record</label><input id="mcManualA" type="search" placeholder="Search name or ID"><div id="mcResultsA" class="mc-manual-results"></div></div><div><label for="mcManualB">Second record</label><input id="mcManualB" type="search" placeholder="Search name or ID"><div id="mcResultsB" class="mc-manual-results"></div></div></div><button class="es-button" id="mcCompareManual" disabled>Compare selected records</button></details>'+
      '<div class="mc-toolbar"><input id="mcSearch" type="search" placeholder="Search player, club or agent" value="'+esc(view.query)+'">'+
      '<select id="mcConfidence"><option value="all">All confidence</option><option value="high">95%+</option><option value="medium">80–94%</option><option value="low">Below 80%</option></select>'+
      '<select id="mcStatus"><option value="pending">Pending</option><option value="all">All status</option><option value="dismissed">Dismissed</option></select>'+
      '<select id="mcReviewed"><option value="all">All reviews</option><option value="yes">Reviewed</option><option value="no">Unreviewed</option></select></div>'+
      '<div class="mc-list"><div class="mc-list-head"><span>Confidence</span><span>Object</span><span>Reason</span><span>Actions</span></div>'+
      (list.length?list.slice(0,250).map(x=>'<div class="mc-row"><span class="mc-score '+(x.score>=95?'high':x.score>=80?'medium':'low')+'">'+x.score+'%</span><span><strong>'+esc(x.a.name)+'</strong><br>'+esc(x.b.name)+'</span><span>'+esc(x.reason)+'</span><span><button class="es-button" data-mc-review="'+esc(x.id)+'">Review</button> <button class="es-button" data-mc-dismiss="'+esc(x.id)+'">Dismiss</button></span></div>').join(''):'<p class="mc-empty">No matching suggestions. You can refresh detection after data changes.</p>')+'</div>'+
      '<section class="mc-log"><h2>Merge log</h2><div class="mc-list-head"><span>Date</span><span>Administrator</span><span>Merge</span><span>Undo</span></div>'+
      (state().merges.slice().reverse().map(m=>'<div class="mc-row"><span>'+esc(m.at.slice(0,10))+'</span><span>'+esc(m.admin)+'</span><span>'+esc(m.type)+'<br>'+esc(m.source)+' → '+esc(m.survivor)+'</span><span>'+
        (m.undoneAt?'Undone':Date.now()-Date.parse(m.at)<=WINDOW?'<button class="es-button" data-mc-undo="'+esc(m.id)+'">Undo</button>':'Undo expired')+'</span></div>').join('')||'<p class="mc-empty">No merges yet.</p>')+'</section></div>';
    document.getElementById('mcRefresh').onclick=async()=>{detectionCache=null;entityCache={};const s=state();s.scannedAt=new Date().toISOString();await saveState(s);renderMergeCenter();};
    document.querySelectorAll('[data-mc-tab]').forEach(b=>b.onclick=()=>{view.type=b.dataset.mcTab;view.pair=null;view.quality=null;renderMergeCenter();});
    const manualItems=entities(view.type), manualButton=document.getElementById('mcCompareManual');
    for (const [suffix,key] of [['A','manualA'],['B','manualB']]) {
      const input=document.getElementById('mcManual'+suffix), results=document.getElementById('mcResults'+suffix);
      input.oninput=()=>{view[key]=null;manualButton.disabled=true;const q=fold(input.value);results.innerHTML=q.length<2?'':manualItems.filter(x=>fold(x.name+' '+x.id).includes(q)).slice(0,20).map(x=>'<button type="button" data-id="'+esc(x.id)+'">'+esc(x.name)+' <small>'+esc(x.id)+'</small></button>').join('');
        results.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{view[key]=manualItems.find(x=>x.id===b.dataset.id);input.value=view[key].name+' · '+view[key].id;results.innerHTML='';manualButton.disabled=!(view.manualA&&view.manualB&&view.manualA.id!==view.manualB.id);});};
    }
    manualButton.onclick=()=>{view.manualCandidate={id:pairKey(view.type,view.manualA.id,view.manualB.id),type:view.type,a:view.manualA,b:view.manualB,score:0,reason:'Manual review'};view.survivor=null;view.options=null;renderMergeCenter();};
    document.querySelectorAll('[data-mc-quality]').forEach(b=>b.onclick=()=>{const type=b.dataset.mcQuality;if(['player','club','agent'].includes(type)){view.type=type;view.query='';view.quality=null;}else{view.quality=type;}renderMergeCenter();});
    const search=document.getElementById('mcSearch');search.oninput=()=>{view.query=search.value;renderMergeCenter();document.getElementById('mcSearch')?.focus();};
    for (const [id,key] of [['mcConfidence','confidence'],['mcStatus','status'],['mcReviewed','reviewed']]) {const select=document.getElementById(id);select.value=view[key];select.onchange=()=>{view[key]=select.value;renderMergeCenter();};}
    document.querySelectorAll('[data-mc-review]').forEach(b=>b.onclick=()=>{view.pair=b.dataset.mcReview;view.survivor=null;view.options=null;renderMergeCenter();});
    document.querySelectorAll('[data-mc-dismiss]').forEach(b=>b.onclick=async()=>{const s=state();s.reviewed[b.dataset.mcDismiss]='dismissed';await saveState(s);renderMergeCenter();});
    document.querySelectorAll('[data-mc-undo]').forEach(b=>b.onclick=async()=>{try{await undo(b.dataset.mcUndo);}catch(error){toast(error.message);}});
  }
  if (window.EuroScoutAgencyResearch?.agentsOf) {
    const original=EuroScoutAgencyResearch.agentsOf;
    EuroScoutAgencyResearch.agentsOf=p=>[...new Set(original(p).map(canonicalAgent))];
  }
  window.EuroScoutMergeCenter={canonicalPlayer,canonicalClub,canonicalAgent,activeClubMerges,hasManualGroup,detect,merge,undo,resolveImport,previewImport,playerConfidence};
  window.renderMergeCenter=renderMergeCenter;
})();
