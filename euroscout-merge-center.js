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
  const playerFold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[đð]/g, 'dj').replace(/ł/g, 'l').replace(/[şș]/g, 's')
    .replace(/ı/g, 'i').replace(/ħ/g, 'h').replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  let cachedRaw, cachedState;
  const current = () => {
    const raw=localStorage.getItem(KEY);
    if (raw!==cachedRaw) { cachedRaw=raw; try { cachedState=JSON.parse(raw)||{}; } catch { cachedState={}; } }
    return cachedState || {};
  };
  const state = () => { const value=current(); return { merges:[...(value.merges||[])], batches:[...(value.batches||[])], reviewed:{...(value.reviewed||{})}, autoSkipped:{...(value.autoSkipped||{})}, scannedAt:value.scannedAt||'' }; };
  const active = type => (current().merges||[]).filter(x => x.type === type && !x.undoneAt);
  let canonicalState=null,canonicalParent=new Map(),canonicalLinked=new Set();
  const canonicalPlayer = ids => {
    const snapshot=current();
    if(canonicalState!==snapshot){
      const merges=(snapshot.merges||[]).filter(m=>m.type==='player'&&!m.undoneAt);
      canonicalParent=new Map(merges.map(m=>[m.source,m.survivor]));
      canonicalLinked=new Set(merges.flatMap(m=>[m.source,m.survivor]));
      canonicalState=snapshot;
    }
    for(const id of ids){
      if(!canonicalLinked.has(id))continue;
      let current=id;const seen=new Set();
      while(canonicalParent.has(current)&&!seen.has(current)){seen.add(current);current=canonicalParent.get(current);}
      if(!seen.has(current))return current;
    }
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
  const view = { type:'player', query:'', confidence:'all', status:'pending', reviewed:'all', pair:null, manualCandidate:null, manualA:null, manualB:null, quality:null, options:null, survivor:null, candidates:[], detectionReady:{} };
  let detectionCache = {}, detectionSignature = '', entityCache = {}, importQueue = [];
  let cachedCatalogue=null,cachedInventory='',cachedOverride=null,automaticTimer=null;
  let automaticRunning=false, automaticAttempted='',automaticMerged=0,automaticFailure='';
  const AUTO_OPTIONS={reports:true,notes:true,statistics:true,timeline:true,watchlist:true,review:true,external:true,images:true};

  // Build comparisons from the same canonical record and current-season assignment
  // used by Player Profile. Imported statistical rows remain available as history,
  // but their historical teamName/league fields are never shown as the current club.
  function canonicalPlayerEntity(id, fallback) {
    const profile=(typeof player==='function'&&player(id))||fallback||{};
    const group=profile._grp?.length?profile._grp:[profile];
    let assignment=null,club=null,currentClub='',currentLeague='';
    try {
      assignment=typeof effective26==='function'?effective26(profile):null;
      if(assignment&&typeof isStatus==='function'&&isStatus(assignment))currentClub=statusLabel(assignment);
      else if(assignment){club=typeof clubByKey==='function'?clubByKey(assignment):null;currentClub=club?.name||'';}
      if(club)currentLeague=typeof comps2627Label==='function'?comps2627Label(club):'';
    } catch {}
    const external=[...new Set(group.flatMap(p=>[p._ext,p._rgm,p._proballers,p._otherLink]).filter(Boolean))].join('\n');
    const fiba=group.map(p=>p.fibaId||p._fiba).find(Boolean)||'';
    return {
      id,name:profile.name||fallback?.name||'',born:profile.born||'',birthDate:profile.birthDate||group.find(p=>p.birthDate)?.birthDate||'',country:profile.country||'',
      height:profile.height||'',position:profile.role||profile.pos||'',team:currentClub,league:currentLeague,
      photo:(typeof photoOf==='function'?photoOf(profile):profile.photo)||'',external,fiba,player:profile,
      report:Store.get(id)||{report:'{}',rating:0,watch:false,eye:{}},sources:{
        profile:'Player Profile · canonical record',current:'Player Profile · 2026/27',
        scouting:'Player Profile · saved scouting data',statistics:'Imported statistics · preserved entries'
      }
    };
  }

  function entities(type) {
    if(entityCache[type])return entityCache[type];
    if (type === 'player') {
      const map = new Map();
      allPlayersEvery().forEach(p => { const id = gid(p); if (!map.has(id) || p.id === id) map.set(id, p); });
      return entityCache[type]=[...map.entries()].map(([id,p]) => canonicalPlayerEntity(id,p));
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
    if(euroA&&euroB&&euroA!==euroB || fibaA&&fibaB&&fibaA!==fibaB)return 0;
    if(euroA&&euroB&&euroA===euroB || fibaA&&fibaB&&fibaA===fibaB)return 99;
    const nameA=playerFold(a.name),nameB=playerFold(b.name);const _tA=nameA.split(' ').filter(Boolean),_tB=nameB.split(' ').filter(Boolean);const _sameSet=_tA.length===_tB.length&&_tA.length>1&&[..._tA].sort().join(' ')===[..._tB].sort().join(' ');const exactName=!!nameA&&(nameA===nameB||_sameSet);
    const lastA=nameA.split(' ').at(-1),lastB=nameB.split(' ').at(-1);
    if(!exactName&&(!lastA||lastA!==lastB))return 0;
    if(a.born&&b.born&&String(a.born)!==String(b.born))return 0;
    let score=exactName?60:24;
    if(a.born&&b.born)score+=23;
    const heightA=Number(a.height),heightB=Number(b.height);
    if(heightA&&heightB){const diff=Math.abs(heightA-heightB);if(diff>10)return 0;score+=diff<=3?8:2;}
    if(a.country&&b.country){if((countryKey(a.country)||fold(a.country))===(countryKey(b.country)||fold(b.country)))score+=6;else score-=15;}
    if(a.position&&b.position){const pa=fold(a.position),pb=fold(b.position);if(pa===pb)score+=3;else if(pa.includes(pb)||pb.includes(pa))score+=1;}
    return Math.max(0,Math.min(98,score));
  }
  const birthYear=value=>String(value||'').match(/(?:19|20)\d{2}/)?.[0]||'';
  const countryKey=value=>fold(window.EuroScoutCountries?.canonical(value)||value);
  function positionKey(value){const p=fold(value);if(/\b(guard|pg|sg|point|shooting)\b/.test(p)||p==='g')return 'guard';if(/\b(center|centre|big)\b/.test(p)||p==='c')return 'big';if(/\b(forward|wing|sf|pf)\b/.test(p)||p==='f')return 'forward';return '';}
  function realgmId(entity){const p=entity.player||{};const ids=[...new Set((p._grp||[p]).map(row=>String(row.realgmId||row.realGMId||[row.profile_url,row._rgm,entity.external].filter(Boolean).join('\n').match(/\/(?:Summary|GameLogs|NBA)\/(\d+)/i)?.[1]||'')).filter(Boolean))];return ids.length===1?ids[0]:ids.length?'conflict:'+ids.sort().join(','):'';}
  function sameClubContext(a,b){const words=value=>new Set(fold(value).split(' ').filter(word=>word.length>3&&!['basketball','club','team'].includes(word)));const left=words(a.team),right=words(b.team);if(!left.size||!right.size)return false;const shared=[...left].filter(word=>right.has(word)).length;return shared>=2||shared>=1&&Math.min(left.size,right.size)===1;}
  function automaticPlayerMatch(a,b){
    if(!a||!b||a.id===b.id)return false;
    const nameA=playerFold(a.name).replace(/\s+(?:jr|sr|ii|iii|iv)$/,''),nameB=playerFold(b.name).replace(/\s+(?:jr|sr|ii|iii|iv)$/,'');if(!nameA||!nameB)return false;
    const tokA=nameA.split(' ').filter(Boolean),tokB=nameB.split(' ').filter(Boolean),lastA=tokA.at(-1),lastB=tokB.at(-1),firstA=tokA[0]||'',firstB=tokB[0]||'';
    const sameTokenSet=tokA.length===tokB.length&&tokA.length>1&&[...tokA].sort().join(' ')===[...tokB].sort().join(' ');
    const initialCompat=!!lastA&&lastA===lastB&&!!firstA&&!!firstB&&(firstA===firstB||(firstA.length===1&&firstB.startsWith(firstA))||(firstB.length===1&&firstA.startsWith(firstB))||firstA.startsWith(firstB)||firstB.startsWith(firstA));
    const strongName=nameA===nameB||sameTokenSet;
    const middleA=tokA.slice(1,-1),middleB=tokB.slice(1,-1),tokenMatch=(a,b)=>a===b||a.length===1&&b.startsWith(a)||b.length===1&&a.startsWith(b),subset=(small,large)=>{let at=0;for(const token of large)if(at<small.length&&tokenMatch(small[at],token))at++;return at===small.length;};
    if(!strongName&&(!initialCompat||middleA.length&&middleB.length&&!subset(middleA,middleB)&&!subset(middleB,middleA)))return false;
    const bornA=birthYear(a.born),bornB=birthYear(b.born);if(bornA&&bornB&&bornA!==bornB)return false;
    const dateA=a.birthDate||a.player?.birthDate,dateB=b.birthDate||b.player?.birthDate;if(/^\d{4}-\d{2}-\d{2}$/.test(dateA||'')&&/^\d{4}-\d{2}-\d{2}$/.test(dateB||'')&&dateA!==dateB)return false;
    const heightA=Number(a.height),heightB=Number(b.height),heightKnown=!!(heightA&&heightB);
    if(heightKnown&&Math.abs(heightA-heightB)>5)return false;
    const countryA=countryKey(a.country),countryB=countryKey(b.country),countryKnown=!!(countryA&&countryB);
    if(countryKnown&&countryA!==countryB)return false;
    const positionA=positionKey(a.position),positionB=positionKey(b.position);
    const realgmA=realgmId(a),realgmB=realgmId(b);if(realgmA.startsWith('conflict:')||realgmB.startsWith('conflict:')||realgmA&&realgmB&&realgmA!==realgmB)return false;
    const euroA=externalId(a.external,'eurobasket'),euroB=externalId(b.external,'eurobasket');if(euroA&&euroB&&euroA!==euroB)return false;
    const fibaA=externalId(a.fiba,'fiba'),fibaB=externalId(b.fiba,'fiba');if(fibaA&&fibaB&&fibaA!==fibaB)return false;
    const sharedProfile=!!(realgmA&&realgmA===realgmB||euroA&&euroA===euroB||fibaA&&fibaA===fibaB);
    if(sharedProfile)return true;
    const signals=Number(heightKnown&&Math.abs(heightA-heightB)<=3)+Number(countryKnown&&countryA===countryB)+
      Number(positionA&&positionA===positionB)+Number(sameClubContext(a,b));
    // An equal known birth year plus an exact normalized name is a clear identity
    // unless one of the hard-conflict checks above rejected the pair.
    if(strongName){if(bornA&&bornB)return true;if(bornA||bornB)return signals>=1;return sameClubContext(a,b)&&signals>=2;}
    // Initial / prefix first name (Facu vs Facundo): shared known birth year plus a hard bio signal (height or country), not position alone.
    return !!(bornA&&bornB)&&(!!(heightKnown&&Math.abs(heightA-heightB)<=3)||!!(countryKnown&&countryA===countryB));
  }
  function userRecordPayload(entity){
    const record=entity?.report||{};let report={};try{report=JSON.parse(record.report||'{}')||{};}catch{report={overall:record.report||''};}
    const meaningful=Object.fromEntries(Object.entries(report).filter(([key,value])=>key!=='_notesUpdated'&&value!=null&&value!==''&&
      (!Array.isArray(value)||value.length)&&(!(typeof value==='object'&&!Array.isArray(value))||Object.keys(value).length)));
    return {report:meaningful,rating:Number(record.rating)||0,watch:!!record.watch,tags:record.tags||[],eye:record.eye||{}};
  }
  const hasUserData=entity=>{const value=userRecordPayload(entity);return !!(value.rating||value.watch||value.tags.length||Object.keys(value.eye).length||Object.keys(value.report).length);};
  const conflictingUserData=(a,b)=>hasUserData(a)&&hasUserData(b)&&JSON.stringify(userRecordPayload(a))!==JSON.stringify(userRecordPayload(b));
  function chooseAutomaticSurvivor(a,b){
    if(hasUserData(a)!==hasUserData(b))return hasUserData(a)?a.id:b.id;
    const quality=x=>{const p=x.player||{};return (birthYear(x.born)?40:0)+(Number(p.g)>0?25:0)+(Number(p.ppg)>0?8:0)+(x.photo?3:0)+(p.profile_provider==='RealGM'?0:4);};
    return quality(a)>quality(b)?a.id:quality(b)>quality(a)?b.id:[a.id,b.id].sort()[0];
  }
  function automaticPlan(all=detect(false,'player').player){
    const currentState=state(),plan=[];
    const blocked=new Set();
    Object.entries({...currentState.reviewed,...currentState.autoSkipped}).forEach(([id,status])=>{
      if(status!=='dismissed'&&status!==true)return;
      if(!id.startsWith('player:'))return;
      id.slice(7).split('|').forEach(playerId=>blocked.add(playerId));
    });
    const eligible=all.filter(candidate=>!currentState.reviewed[candidate.id]&&
      !currentState.autoSkipped[candidate.id]&&!blocked.has(candidate.a.id)&&!blocked.has(candidate.b.id)&&
      automaticPlayerMatch(candidate.a,candidate.b));
    eligible.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    // Resolve full connected duplicate groups in one pass. The former one-pair-
    // per-player cap needed many page reloads and left obvious name variants queued.
    const parent=new Map(),items=new Map(),find=id=>{let root=id;while(parent.has(root)&&parent.get(root)!==root)root=parent.get(root);let node=id;while(parent.has(node)&&parent.get(node)!==root){const next=parent.get(node);parent.set(node,root);node=next;}return root;};
    const join=(a,b)=>{if(!parent.has(a))parent.set(a,a);if(!parent.has(b))parent.set(b,b);const ra=find(a),rb=find(b);if(ra!==rb){const left=[...items.values()].filter(item=>find(item.id)===ra),right=[...items.values()].filter(item=>find(item.id)===rb);if(left.every(a=>right.every(b=>automaticPlayerMatch(a,b))))parent.set(rb,ra);}};
    eligible.forEach(candidate=>{items.set(candidate.a.id,candidate.a);items.set(candidate.b.id,candidate.b);join(candidate.a.id,candidate.b.id);});
    const groups=new Map();items.forEach((item,id)=>{const root=find(id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(item);});
    for(const group of groups.values()){
      let survivor=group[0];for(const item of group.slice(1)){const chosen=chooseAutomaticSurvivor(survivor,item);survivor=chosen===item.id?item:survivor;}
      for(const source of group){if(source.id===survivor.id)continue;const id=pairKey('player',survivor.id,source.id);plan.push({candidate:{id,type:'player',a:survivor,b:source,score:playerConfidence(survivor,source),reason:'Clear identity group'},survivor:survivor.id,source:source.id});if(plan.length===1500)return plan;}
    }
    return plan;
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
      const name=playerFold(existing.name);add(byName,name,existing);
      if(existing.born)add(byBirthSurname,name.split(' ').at(-1)+'|'+existing.born,existing);
      add(byEurobasket,externalId(existing.external,'eurobasket'),existing);
      add(byFiba,externalId(existing.fiba,'fiba'),existing);
    });
    const flagged=(players||[]).flatMap(incoming=>{
      const probe={name:incoming.name,born:incoming.born||'',height:incoming.height||'',country:incoming.country||'',position:incoming.role||incoming.pos||'',external:incoming._ext||incoming.eurobasketId||'',fiba:incoming.fibaId||incoming._fiba||''};
      const key=playerFold(probe.name);
      const matches=[...new Map([...(byName.get(key)||[]),...(probe.born?byBirthSurname.get(key.split(' ').at(-1)+'|'+probe.born)||[]:[]),...(byEurobasket.get(externalId(probe.external,'eurobasket'))||[]),...(byFiba.get(externalId(probe.fiba,'fiba'))||[])].map(item=>[item.id,item])).values()];
      const candidates=matches.map(existing=>({id:existing.id,name:existing.name,score:playerConfidence(probe,existing)})).filter(x=>x.score>=60).sort((a,b)=>b.score-a.score);
      return candidates.length?[{id:incoming.id,name:incoming.name,candidates,requiresAdminConfirmation:true}]:[];
    });
    importQueue=[...new Map([...importQueue,...flagged].map(item=>[item.id,item])).values()];
    return flagged;
  }
  function detect(force=false, requestedType='all') {
    const signature=state().merges.map(m=>m.id+':'+(m.undoneAt||'')).join('|');
    const catalogue=typeof STATE!=='undefined'?STATE.data:null,inventory=(catalogue?.leagues||[]).map(L=>L.meta?.id+':'+(L.players||[]).length).join('|'),override=typeof OVR!=='undefined'?OVR:null;
    if(force||signature!==detectionSignature||catalogue!==cachedCatalogue||inventory!==cachedInventory||override!==cachedOverride){entityCache={};detectionCache={};detectionSignature=signature;cachedCatalogue=catalogue;cachedInventory=inventory;cachedOverride=override;}
    const types=requestedType==='all'?['player','club','agent']:[requestedType];
    for (const type of types) {
      if(!force&&detectionCache[type])continue;
      const items=entities(type), out={type,map:new Map()};
      if (type === 'player') {
        indexPairs(items,x => externalId(x.external,'eurobasket'),playerConfidence,'Same Eurobasket profile',out);
        indexPairs(items,x => externalId(x.fiba,'fiba'),playerConfidence,'Same FIBA profile',out);
        indexPairs(items,x => realgmId(x), (a,b)=>automaticPlayerMatch(a,b)?99:playerConfidence(a,b),'Same RealGM person profile',out);
        indexPairs(items,x => playerFold(x.name),playerConfidence,'Name, birth year and bio comparison',out);
        indexPairs(items,x => x.born ? playerFold(x.name).split(' ').at(-1)+'|'+x.born : '',playerConfidence,'Same surname and birth year',out);
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
      detectionCache[type]=[...out.map.values()].filter(c => !existing.has(c.id)).sort((a,b)=>b.score-a.score || a.a.name.localeCompare(b.a.name));
    }
    return {player:detectionCache.player||[],club:detectionCache.club||[],agent:detectionCache.agent||[]};
  }
  const val = x => x == null || x === '' ? '—' : String(x);
  const reportParts = rec => { try { return JSON.parse(rec.report||'{}')||{}; } catch { return {overall:rec.report||''}; } };
  function comparison(type, a, b) {
    if (type === 'player') {
      const ar=reportParts(a.report), br=reportParts(b.report);
      const notes=r=>['nAth','nOff','nDef','nIntel','nProj'].map(k=>r[k]).filter(Boolean).join(' · ');
      const ap=a.sources||{},bp=b.sources||{};
      const fields = [
        ['Photo',a.photo,b.photo,'image',ap.profile,bp.profile],['Name',a.name,b.name,null,ap.profile,bp.profile],
        ['Birth year',a.born,b.born,null,ap.profile,bp.profile],['Nationality',a.country,b.country,null,ap.profile,bp.profile],
        ['Height',a.height&&a.height+' cm',b.height&&b.height+' cm',null,ap.profile,bp.profile],
        ['Current season','2026/27','2026/27',null,ap.current,bp.current],
        ['Current club',a.team,b.team,null,ap.current,bp.current],['Current league',a.league,b.league,null,ap.current,bp.current],
        ['Agent',a.player.agent,b.player.agent,null,ap.profile,bp.profile],['Agency',a.player.agency,b.player.agency,null,ap.profile,bp.profile],
        ['External links',a.external,b.external,null,ap.profile,bp.profile],
        ['Reports',ar.overall||('Rating '+(a.report.rating||0)),br.overall||('Rating '+(b.report.rating||0)),null,ap.scouting,bp.scouting],
        ['Notes',notes(ar),notes(br),null,ap.scouting,bp.scouting],
        ['Statistics',(a.player._grp||[a.player]).length+' entries',(b.player._grp||[b.player]).length+' entries',null,ap.statistics,bp.statistics],
        ['Timeline',JSON.stringify({eye:a.report.eye||{},workflow:ar._workflow||{}}),JSON.stringify({eye:b.report.eye||{},workflow:br._workflow||{}}),null,ap.scouting,bp.scouting],
        ['Watchlist',a.report.watch?'Yes':'No',b.report.watch?'Yes':'No',null,ap.scouting,bp.scouting],
        ['Review queue',ar._workflow?.review?.status||'—',br._workflow?.review?.status||'—',null,ap.scouting,bp.scouting]
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
  function comparisonCell(value,kind,source){
    return imageOrText(value,kind)+(source?'<small class="mc-source">'+esc(source)+'</small>':'');
  }
  const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function valueAt(root,path){
    let value=root;
    for(const part of path){if(value==null||!Object.hasOwn(value,part))return {exists:false,value:undefined};value=value[part];}
    return {exists:true,value};
  }
  function diffValues(before,after,path=[],out=[],beforeExists=true,afterExists=true){
    if(beforeExists&&afterExists&&sameValue(before,after))return out;
    const beforeObject=beforeExists&&before&&typeof before==='object',afterObject=afterExists&&after&&typeof after==='object';
    if(beforeObject&&afterObject&&Array.isArray(before)===Array.isArray(after)){
      const keys=new Set([...Object.keys(before),...Object.keys(after)]);
      for(const key of keys)diffValues(before[key],after[key],path.concat(key),out,Object.hasOwn(before,key),Object.hasOwn(after,key));
      return out;
    }
    out.push({path,beforeExists,afterExists,before:beforeExists?before:undefined,after:afterExists?after:undefined});
    return out;
  }
  function storageChanges(before,after){
    const changed={};
    for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
      const left=before?.[key]??null,right=after?.[key]??null;if(left===right)continue;
      try{changed[key]={json:true,changes:diffValues(left==null?null:JSON.parse(left),right==null?null:JSON.parse(right))};}
      catch{changed[key]={json:false,before:left,after:right};}
    }
    return changed;
  }
  function restoreStorageChanges(changed,verify=true){
    const restored=[];
    for(const [key,delta] of Object.entries(changed||{})){
      if(!delta.json){if(verify&&localStorage.getItem(key)!==delta.after)throw Error('Related data changed since the merge. Review those edits before undoing.');delta.before==null?localStorage.removeItem(key):localStorage.setItem(key,delta.before);restored.push(key);continue;}
      const raw=localStorage.getItem(key);let value=raw==null?null:JSON.parse(raw);
      if(verify)for(const change of delta.changes){const current=valueAt(value,change.path);if(current.exists!==change.afterExists||change.afterExists&&!sameValue(current.value,change.after))throw Error('Related data changed since the merge. Review those edits before undoing.');}
      for(const change of delta.changes.slice().reverse()){
        if(!change.path.length){value=change.beforeExists?change.before:null;continue;}
        let parent=value;for(const part of change.path.slice(0,-1))parent=parent[part];const leaf=change.path.at(-1);
        if(change.beforeExists)parent[leaf]=change.before;else if(Array.isArray(parent))parent.splice(Number(leaf),1);else delete parent[leaf];
      }
      value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));restored.push(key);
    }
    return restored;
  }
  function compactUndo(next){
    next.merges.forEach(m=>{
      if(m.before&&m.after&&!m.changes){const keysBefore={...m.before};delete keysBefore.record;m.changes=storageChanges(keysBefore,m.after);if(Object.hasOwn(m.before,'record'))m.recordBefore=m.before.record;delete m.before;delete m.after;}
      if(Date.now()-Date.parse(m.at)>WINDOW){delete m.changes;delete m.recordBefore;delete m.recordAfter;delete m.before;delete m.after;}
    });
    next.batches.forEach(b=>{if(Date.now()-Date.parse(b.at)>WINDOW){delete b.before;delete b.after;delete b.recordsBefore;delete b.recordsAfter;}});
    return next;
  }
  function saveState(next, persist=true) {
    compactUndo(next);
    try{localStorage.setItem(KEY,JSON.stringify(next));}
    catch(error){if(error?.name==='QuotaExceededError'||/quota/i.test(error?.message||''))throw Error('The Merge Center storage is full. Refresh once to compact older undo data, then retry the merge.');throw error;}
    try { Sync.stampKey(KEY); } catch {}
    return persist?Store.pushAppKey(KEY):true;
  }
  async function persistBatch(next,records){
    saveState(next,false);
    const items=Object.entries(records).map(([id,rec])=>({id,rec}));
    try{Sync.stampKey('euroscout:overrides');items.forEach(item=>Sync.stampRecord(item.id));}catch{}
    const recordsSaved=Store.bulkSet?Store.bulkSet(items):Promise.all(items.map(item=>Store.save(item.id,item.rec)));
    const saved=await Promise.all([recordsSaved,Store.pushAppKey('euroscout:overrides'),Store.pushAppKey(KEY)]);
    if(saved.some(value=>value===false||Array.isArray(value)&&value.some(result=>result===false)))throw Error('Identity links or player notes could not be saved.');
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
    const mergeNotes=(left,right)=>{const seen=new Set();return [left,right].filter(Boolean).join('\n').split(/\r?\n/).map(line=>line.replace(/^\s*(?:[•‣⁃▪●·*–—-]|\d+[.)])\s*/,'').trim()).filter(Boolean).filter(line=>{const key=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();if(seen.has(key))return false;seen.add(key);return true;}).map(line=>'• '+line).join('\n');};
    for (const [key,value] of Object.entries(b)) {
      const category = key==='_workflow' ? 'timeline' : key.startsWith('n') || key==='overall' ? 'notes' : 'reports';
      if (!options[category] || value == null || value === '') continue;
      if(key==='_notesUpdated'){a[key]=[a[key],value].filter(Boolean).sort().at(-1);}
      else if(key==='_history'){const revisions=new Map([...(Array.isArray(a[key])?a[key]:[]),...(Array.isArray(value)?value:[])].map(x=>[x.id||JSON.stringify(x),x]));a[key]=[...revisions.values()].sort((x,y)=>String(x.savedAt||'').localeCompare(String(y.savedAt||'')));}
      else if (key==='_workflow'&&window.ESRecordMerge) a[key]=ESRecordMerge.mergeWorkflows(a[key],value);
      else if ((key.startsWith('n')||key==='overall')&&window.ESRecordMerge) a[key]=ESRecordMerge.mergeNoteText(a[key],value);
      else if (/^n(?:Ath|Off|Def|Intel|Proj)$/.test(key)) a[key]=mergeNotes(a[key],value);
      else if (a[key] == null || a[key] === '') a[key]=value;
      else if (typeof value === 'string' && typeof a[key] === 'string' && !a[key].includes(value)) a[key] += '\n—\n'+value;
      else if (Array.isArray(a[key]) && Array.isArray(value)) a[key]=[...new Set([...a[key],...value])];
      else if (typeof a[key] === 'object' && typeof value === 'object') a[key]={...value,...a[key]};
    }
    return JSON.stringify(a);
  }
  function combinedPlayerRecord(target,other,options=AUTO_OPTIONS) {
    const merged={...target};
    merged.report=mergeReport(target.report,other.report,options);
    if(merged.board==null&&other.board!=null)merged.board=other.board;
    merged.watch=!!(target.watch||other.watch);
    merged.rating=Math.max(target.rating||0,other.rating||0);
    merged.tags=[...new Set([...(target.tags||[]),...(other.tags||[])])];
    merged.eye={...(other.eye||{}),...(target.eye||{})};
    merged.jerseyNumbers={...(other.jerseyNumbers||{}),...(target.jerseyNumbers||{})};
    return merged;
  }
  async function autoMergeBatch(plan) {
    if(!Store.canEdit())throw Error('Administrator access is required.');
    if(!plan.length)return 0;
    const oldState=structuredClone(state()),beforeOverrides=localStorage.getItem('euroscout:overrides');
    const batchId=crypto.randomUUID(),at=new Date().toISOString();
    const override=ovrLocal();
    const next=state();
    const existingPairs=new Set(active('player').map(m=>pairKey('player',m.survivor,m.source)));
    for(const item of plan){
      const {candidate,survivor,source}=item;
      if(next.reviewed[candidate.id]||existingPairs.has(candidate.id))continue;
      if(!override.links.some(link=>link.includes(survivor)&&link.includes(source)))override.links.push([survivor,source]);
      next.merges.push({id:crypto.randomUUID(),type:'player',survivor,source,at,
        admin:Store.user?.email||window.ESAccess?.user?.email||'Administrator',options:AUTO_OPTIONS,auto:true,batchId});
      next.reviewed[candidate.id]='merged';
      existingPairs.add(candidate.id);
    }
    const batchMerges=next.merges.filter(item=>item.batchId===batchId);
    if(!batchMerges.length)return 0;
    const recordsBefore={},recordsAfter={};
    // Resolve the entire batch before combining records: a statistics alias
    // may join a domestic profile that itself joins a European profile.
    const parents=new Map(batchMerges.map(item=>[item.source,item.survivor]));
    const root=id=>{const seen=new Set();while(parents.has(id)&&!seen.has(id)){seen.add(id);id=parents.get(id);}return id;};
    const groups=new Map();for(const item of batchMerges)for(const id of [item.survivor,item.source]){const survivor=root(id);if(!groups.has(survivor))groups.set(survivor,new Set());groups.get(survivor).add(id);}
    for(const [survivor,members] of groups){
      recordsBefore[survivor]=structuredClone(Store.get(survivor)||{report:'{}'});let merged=recordsBefore[survivor];
      for(const id of members)if(id!==survivor)merged=combinedPlayerRecord(merged,Store.get(id)||{report:'{}'},AUTO_OPTIONS);
      recordsAfter[survivor]=merged;
    }
    try{
      localStorage.setItem('euroscout:overrides',JSON.stringify(override));
      next.batches.push({id:batchId,at,admin:Store.user?.email||window.ESAccess?.user?.email||'Administrator',
        count:batchMerges.length,pairs:batchMerges.map(item=>pairKey('player',item.survivor,item.source)),lightweight:true,recordsBefore,recordsAfter});
      await persistBatch(next,recordsAfter);
      OVR=ovrMerged();rebuildLinks();applyOverrides();detectionCache={};entityCache={};
      return batchMerges.length;
    }catch(error){
      beforeOverrides==null?localStorage.removeItem('euroscout:overrides'):localStorage.setItem('euroscout:overrides',beforeOverrides);
      await persistBatch(oldState,recordsBefore).catch(()=>{});
      OVR=ovrMerged();rebuildLinks();applyOverrides();detectionCache={};entityCache={};
      throw error;
    }
  }
  async function undoBatch(id){
    if(!Store.canEdit())throw Error('Administrator access is required.');
    const old=state(),original=structuredClone(old),batch=old.batches.find(item=>item.id===id);
    if(!batch||batch.undoneAt||Date.now()-Date.parse(batch.at)>WINDOW)throw Error('Undo is no longer available.');
    if(batch.lightweight){
      const mergePairs=old.merges.filter(item=>item.batchId===id&&!item.undoneAt),override=ovrLocal();
      const keys=new Set(mergePairs.map(item=>[item.survivor,item.source].sort().join('|')));
      override.links=(override.links||[]).filter(link=>!keys.has([link[0],link[1]].sort().join('|')));
      for(const [playerId,post] of Object.entries(batch.recordsAfter||{}))if(JSON.stringify(Store.get(playerId))!==JSON.stringify(post))throw Error('A player was edited since this batch. Review those edits before undoing.');
      const undoneAt=new Date().toISOString();batch.undoneAt=undoneAt;mergePairs.forEach(item=>item.undoneAt=undoneAt);
      batch.pairs.forEach(pair=>{if(old.reviewed[pair]==='merged')delete old.reviewed[pair];old.autoSkipped[pair]=true;});
      const beforeOverrides=localStorage.getItem('euroscout:overrides');
      try{localStorage.setItem('euroscout:overrides',JSON.stringify(override));await persistBatch(old,batch.recordsBefore||{});}
      catch(error){beforeOverrides==null?localStorage.removeItem('euroscout:overrides'):localStorage.setItem('euroscout:overrides',beforeOverrides);await persistBatch(original,batch.recordsAfter||{}).catch(()=>{});OVR=ovrMerged();rebuildLinks();applyOverrides();throw error;}
      OVR=ovrMerged();rebuildLinks();applyOverrides();detectionCache={};entityCache={};if(STATE.view==='mergecenter')renderMergeCenter();toast('Automatic merge batch undone.');return;
    }
    if(!batch.before)throw Error('Undo is no longer available.');
    for(const [key,post] of Object.entries(batch.after.keys))if(localStorage.getItem(key)!==post)throw Error('Related data changed since this batch. Review those edits before undoing.');
    for(const [playerId,post] of Object.entries(batch.after.records))if(JSON.stringify(Store.get(playerId))!==JSON.stringify(post))throw Error('A player was edited since this batch. Review those edits before undoing.');
    if(!window.confirm('Undo all '+batch.count+' automatic player merges in this batch?'))return;
    try{
      const pending=[];
      for(const [key,raw] of Object.entries(batch.before.keys)){raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);pending.push(Store.pushAppKey(key));}
      for(const [playerId,record] of Object.entries(batch.before.records))pending.push(Store.save(playerId,record));
      batch.undoneAt=new Date().toISOString();
      old.merges.filter(m=>m.batchId===id).forEach(m=>m.undoneAt=batch.undoneAt);
      batch.pairs.forEach(pair=>{if(old.reviewed[pair]==='merged')delete old.reviewed[pair];old.autoSkipped[pair]=true;});
      pending.push(saveState(old));if((await Promise.all(pending)).some(result=>result===false))throw Error('Cloud save did not complete.');
      OVR=ovrMerged();rebuildLinks();applyOverrides();detectionCache={};entityCache={};if(STATE.view==='mergecenter')renderMergeCenter();toast('Automatic merge batch undone.');
    }catch(error){
      const pending=[];
      for(const [key,raw] of Object.entries(batch.after.keys)){raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);pending.push(Store.pushAppKey(key));}
      for(const [playerId,record] of Object.entries(batch.after.records))pending.push(Store.save(playerId,record));
      pending.push(saveState(original));await Promise.allSettled(pending);
      OVR=ovrMerged();rebuildLinks();applyOverrides();throw error;
    }
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
      admin:Store.user?.email||window.ESAccess?.user?.email||'Administrator', options, changes:{} };
    if(type==='player')entry.recordBefore=structuredClone(before.record);
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
        const after={};for (const key of keys) { after[key]=localStorage.getItem(key); pending.push(Store.pushAppKey(key)); }
        const storageBefore={...before};delete storageBefore.record;entry.changes=storageChanges(storageBefore,after);entry.recordAfter=structuredClone(merged);
      }
      const next=state(); next.merges.push(entry); next.reviewed[candidate.id]='merged';
      pending.push(saveState(next));
      if ((await Promise.all(pending)).some(result=>result===false)) throw Error('Cloud save did not complete.');
      if (type==='player') { OVR=ovrMerged(); rebuildLinks(); applyOverrides(); }
      if (type==='club') { buildClubs(); NEXTCOMP=null; DOM27=null; }
      if (type==='agent') applyOverrides();
      detectionCache={}; entityCache={}; view.pair=null; view.manualCandidate=null; renderMergeCenter(); toast('Merge saved. Undo is available for 30 days.');
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
    if(entry?.batchId)return undoBatch(entry.batchId);
    if (!entry || entry.undoneAt || Date.now()-Date.parse(entry.at)>WINDOW) throw Error('Undo is no longer available.');
    if (!window.confirm('Undo this merge and restore both identities?')) return;
    const original=structuredClone(old), postRecord=entry.type==='player'?structuredClone(Store.get(entry.survivor)):null;
    const postStorage={};
    try {
    if (entry.type==='player') {
      const pending=[];
      if(entry.recordAfter&&!sameValue(Store.get(entry.survivor),entry.recordAfter))throw Error('This player was edited since the merge. Review those edits before undoing.');
      if(entry.changes){for(const key of Object.keys(entry.changes))postStorage[key]=localStorage.getItem(key);restoreStorageChanges(entry.changes,true).forEach(key=>pending.push(Store.pushAppKey(key)));}
      else{
        for (const [key,post] of Object.entries(entry.after||{})) if (localStorage.getItem(key)!==post)throw Error('Related data changed since the merge. Review those edits before undoing.');
        for (const [key,raw] of Object.entries(entry.before||{})) if (key!=='record') {postStorage[key]=localStorage.getItem(key);raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);pending.push(Store.pushAppKey(key));}
      }
      pending.push(Store.save(entry.survivor,entry.recordBefore??entry.before?.record));
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
    detectionCache={}; entityCache={}; renderMergeCenter(); toast('Merge undone.');
    } catch(error) {
      const rollback=[];
      if(entry.type==='player') {
        for(const [key,post] of Object.entries(postStorage)) {post==null?localStorage.removeItem(key):localStorage.setItem(key,post);rollback.push(Store.pushAppKey(key));}
        rollback.push(Store.save(entry.survivor,postRecord));
        OVR=ovrMerged(); rebuildLinks(); applyOverrides();
      }
      rollback.push(saveState(original));
      await Promise.allSettled(rollback);
      throw error;
    }
  }
  function summary(activeType='player') {
    const list=detect(false,activeType), players=entities('player'),reviewed=state().reviewed;
    const pending=type=>list[type].filter(candidate=>!reviewed[candidate.id]).length;
    return [
      ['Players',detectionCache.player?pending('player'):'…','player'],['Clubs',detectionCache.club?pending('club'):'…','club'],['Agents',detectionCache.agent?pending('agent'):'…','agent'],
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
      for (const [label,key,source] of [['Birth year','born','profile'],['Nationality','country','profile'],['Height','height','profile'],['Current club','team','current'],['Current league','league','current']])
        if (candidate.a[key]&&candidate.b[key]&&fold(candidate.a[key])!==fold(candidate.b[key])) warnings.push({label,key,source});
    }
    const warningHTML=warnings.length?'<div class="mc-warning"><strong>⚠ Review profile differences</strong>'+warnings.map(item=>
      '<div class="mc-warning-row"><b>'+esc(item.label)+' differs</b><span>'+esc(candidate.a.name)+': '+esc(val(candidate.a[item.key]))+'<small>'+esc(candidate.a.sources?.[item.source]||'Player Profile')+'</small></span><span>'+esc(candidate.b.name)+': '+esc(val(candidate.b[item.key]))+'<small>'+esc(candidate.b.sources?.[item.source]||'Player Profile')+'</small></span></div>').join('')+'</div>':'';
    app.innerHTML='<div class="mc-page"><button class="es-button" id="mcBack">← Back to suggestions</button>'+
      '<div class="mc-head"><div><h1>Review possible '+esc(candidate.type)+' duplicate</h1><p>Compare both records before choosing the survivor.</p></div></div>'+
      warningHTML+
      '<div class="mc-compare"><div class="mc-record"><h2>'+esc(candidate.a.name)+'</h2><small>'+esc(candidate.a.id)+'</small></div>'+
      '<div class="mc-record"><h2>'+esc(candidate.b.name)+'</h2><small>'+esc(candidate.b.id)+'</small></div></div>'+
      '<div class="mc-fields">'+fields.map(([label,left,right,kind,leftSource,rightSource])=>{
        const differs=val(left)!==val(right);
        return '<div class="mc-field'+(differs?' differs':'')+'"><strong>'+esc(label)+'</strong><span>'+comparisonCell(left,kind,leftSource)+'</span><span>'+comparisonCell(right,kind,rightSource)+'</span></div>';
      }).join('')+'</div><section class="mc-controls"><h2>Which record survives?</h2><div class="mc-choice">'+
      [candidate.a,candidate.b].map(x=>'<label><input type="radio" name="mcSurvivor" value="'+esc(x.id)+'"'+(view.survivor===x.id?' checked':'')+'> '+esc(x.name)+' <small>'+esc(x.id)+'</small></label>').join('')+'</div>'+
      (candidate.type==='player'?'<h2>Information to combine</h2><div class="mc-options">'+
      Object.entries({reports:'Reports',notes:'Notes',statistics:'Statistics',timeline:'Timeline',watchlist:'Watchlist',review:'Review queue',external:'External links',images:'Images'}).map(([key,label])=>
        '<label><input type="checkbox" data-mc-option="'+key+'"'+(view.options[key]?' checked':'')+(['statistics','images'].includes(key)?' disabled':'')+'> '+label+(['statistics','images'].includes(key)?' (always preserved)':'')+'</label>').join('')+'</div>':'')+
      '<p class="hint">Statistics and images stay with their source entries. Source records remain in the backup for a 30-day undo period. This manual merge requires confirmation.</p>'+
      '<button class="es-button es-primary" id="mcMerge">Merge selected records</button></section></div>';
    document.getElementById('mcBack').onclick=()=>{view.pair=null;view.manualCandidate=null;renderMergeCenter();};
    document.querySelectorAll('[name=mcSurvivor]').forEach(el=>el.onchange=()=>view.survivor=el.value);
    document.querySelectorAll('[data-mc-option]').forEach(el=>el.onchange=()=>view.options[el.dataset.mcOption]=el.checked);
    document.getElementById('mcMerge').onclick=async e=>{e.currentTarget.disabled=true;try{await merge(candidate,view.survivor,view.options);}catch(error){toast(error.message);e.currentTarget.disabled=false;}};
  }
  function invalidateCatalogue(){detectionCache={};entityCache={};view.detectionReady={};automaticAttempted='';}
  function scheduleAutomatic(){if(automaticTimer!==null)clearTimeout(automaticTimer);automaticTimer=setTimeout(()=>{automaticTimer=null;if(window.ESSessions?.active?.()){scheduleAutomaticDeferred();return;}runAutomatic().catch(error=>console.warn('Automatic identity consolidation delayed',error));},250);}
  function scheduleAutomaticDeferred(){if(automaticTimer!==null)return;automaticTimer=setTimeout(()=>{automaticTimer=null;scheduleAutomatic();},30000);}
  function linkedRecordPlan(){
    const pairs=window.EuroScoutDragons?.recordLinks?.()||[],out=[],seen=new Set();
    const add=(id,survivor)=>{const source=canonicalPlayer([id])||id;if(source===survivor||seen.has(source))return;const rec=Store.get(source)||{};if(!rec.rating&&!rec.watch&&rec.board==null&&!rec.tags?.length&&!Object.keys(rec.eye||{}).length&&!Object.keys(rec.jerseyNumbers||{}).length&&(!rec.report||['{}',''].includes(String(rec.report).trim())))return;
      seen.add(source);const a=canonicalPlayerEntity(survivor,player(survivor)),b=canonicalPlayerEntity(source,player(source));out.push({candidate:{id:pairKey('player',survivor,source),type:'player',a,b,score:100,reason:'Resolved official statistics identity'},survivor,source});
    };
    for(const [source,target] of pairs){const p=player(target),survivor=canonicalPlayer([target])||(p?gid(p):null)||target;add(source,survivor);
      // Preserve records on every catalogue alias before adding a persistent
      // statistics link. Previously merged backups resolve to their live root.
      for(const alias of p?._grp||[])add(alias.id,survivor);
    }return out;
  }
  async function runAutomatic(){
    if(!Store.canEdit()||automaticRunning||automaticFailure||window.ESSessions?.active?.())return 0;
    automaticRunning=true;let count=0;
    try{await window.wfFlushReport?.();for(let pass=0;pass<6;pass++){if(window.ESSessions?.active?.()){scheduleAutomaticDeferred();break;}const plan=[...linkedRecordPlan(),...automaticPlan(detect(true,'player').player)];if(!plan.length)break;automaticAttempted=plan.map(item=>item.candidate.id).join('|');const merged=await autoMergeBatch(plan);count+=merged;if(!merged)break;await new Promise(resolve=>setTimeout(resolve,0));}automaticMerged+=count;return count;}
    catch(error){automaticFailure=error.message;automaticAttempted='';toast('Automatic merges stopped: '+error.message+' Review Merge Center before retrying.');throw error;}
    finally{automaticRunning=false;if(count||automaticFailure){if(STATE.view==='mergecenter')setTimeout(renderMergeCenter,0);else if(count){render();if(typeof DRAWER_OPEN!=='undefined'&&DRAWER_OPEN)renderProfile();toast(count+' clear player duplicates merged. Undo is available in Merge Center.');automaticMerged=0;}}}
  }
  window.addEventListener?.('euroscout:catalogue-ready',()=>{invalidateCatalogue();scheduleAutomatic();});
  window.addEventListener?.('euroscout:rosters-ready',()=>{invalidateCatalogue();if(window.EuroScoutCatalogueReady)scheduleAutomatic();});
  function renderMergeCenter() {
    if (!Store.canEdit()) { app.innerHTML='<div class="mc-page"><h1>Administrator access required</h1></div>'; return; }
    // Do not pull the 6,000+ player NBA/NCAA packs merely by opening this page.
    // Those packs join detection after their own page is visited or global search loads them.
    if(!view.detectionReady[view.type]){
      view.detectionReady[view.type]=true;
      app.innerHTML='<div class="mc-page"><div class="mc-head"><div><h1>Merge Center</h1><p>Preparing the '+esc(view.type)+' identity queue…</p></div></div><div class="mc-loading">Checking clear identity signals</div></div>';
      const prepare=()=>{if(STATE.view==='mergecenter'){detect(false,view.type);renderMergeCenter();}};
      if(window.requestIdleCallback)requestIdleCallback(prepare,{timeout:100});else setTimeout(prepare,0);
      return;
    }
    const all=detect(false,view.type);
    const plan=automaticPlan(all.player),signature=plan.map(item=>item.candidate.id).join('|');
    if(plan.length&&!automaticFailure&&!automaticRunning&&automaticAttempted!==signature&&!window.ESSessions?.active?.()){
      app.innerHTML='<div class="mc-page"><h1>Merge Center</h1><p>Consolidating '+plan.length+' clear player duplicates…</p></div>';
      runAutomatic().catch(error=>console.warn('Automatic identity consolidation delayed',error));return;
    }
    if(automaticRunning)return;
    if(automaticMerged){toast(automaticMerged+' clear player duplicates merged. Undo is available for 30 days.');automaticMerged=0;}
    if (view.manualCandidate) { renderReview(view.manualCandidate); return; }
    if (view.quality) {
      const quality=view.quality, items=entities('player').filter(p=>quality==='photo'?!p.photo:quality==='eurobasket'?!/eurobasket\.com/i.test(p.external):quality==='birth'?!p.born:!p.country);
      app.innerHTML='<div class="mc-page"><button class="es-button" id="mcBackQuality">← Back to Merge Center</button><div class="mc-head"><div><h1>Missing '+esc(({photo:'photos',eurobasket:'Eurobasket links',birth:'birth years',country:'nationalities'})[quality])+'</h1><p>'+items.length+' player records need review.</p></div></div><div class="mc-list">'+items.slice(0,100).map(p=>'<div class="mc-row"><span>Player</span><strong>'+esc(p.name)+'</strong><span>'+esc(p.team)+'</span><span><button class="es-button" data-mc-profile="'+esc(p.id)+'">Open profile</button></span></div>').join('')+'</div></div>';
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
    const counters=summary(view.type),log=state().merges.slice().reverse().filter(m=>!m.batchId||state().batches.find(b=>b.id===m.batchId)?.pairs[0]===pairKey('player',m.survivor,m.source));
    app.innerHTML='<div class="mc-page"><div class="mc-head"><div><h1>Merge Center</h1><p>Maintain database quality. Merge duplicate players, clubs and agents.</p></div><button class="es-button" id="mcRefresh">↻ Refresh detection</button></div>'+
      (automaticFailure?'<div class="mc-warning">Automatic merging paused: '+esc(automaticFailure)+' <button class="es-button" id="mcRetryAuto">Retry</button></div>':'')+
      '<div class="mc-quality">'+counters.map(([label,count,target])=>'<button data-mc-quality="'+target+'"><strong>'+count+'</strong><span>'+esc(label)+'</span></button>').join('')+'</div>'+
      '<div class="mc-tabs" role="tablist">'+[['player','Players'],['club','Clubs'],['agent','Agents']].map(([key,label])=>'<button data-mc-tab="'+key+'" class="'+(view.type===key?'active':'')+'">'+label+' <span>'+(detectionCache[key]?detectionCache[key].filter(candidate=>!reviewed[candidate.id]).length:'…')+'</span></button>').join('')+'</div>'+
      (view.type==='player'?'<h2>Identity Resolution queue</h2><p>Clear identity matches merge automatically. Ambiguous cross-league matches remain here for review.'+(importQueue.length?' '+importQueue.length+' incoming records were flagged before joining the registry.':'')+'</p>':'')+
      '<details class="mc-manual"><summary>Review a pair manually</summary><p>Find both records, compare them, then choose which survives.</p><div class="mc-manual-grid"><div><label for="mcManualA">First record</label><input id="mcManualA" type="search" placeholder="Search name or ID"><div id="mcResultsA" class="mc-manual-results"></div></div><div><label for="mcManualB">Second record</label><input id="mcManualB" type="search" placeholder="Search name or ID"><div id="mcResultsB" class="mc-manual-results"></div></div></div><button class="es-button" id="mcCompareManual" disabled>Compare selected records</button></details>'+
      '<div class="mc-toolbar"><input id="mcSearch" type="search" placeholder="Search player, club or agent" value="'+esc(view.query)+'">'+
      '<select id="mcConfidence"><option value="all">All confidence</option><option value="high">95%+</option><option value="medium">80–94%</option><option value="low">Below 80%</option></select>'+
      '<select id="mcStatus"><option value="pending">Pending</option><option value="all">All status</option><option value="dismissed">Dismissed</option></select>'+
      '<select id="mcReviewed"><option value="all">All reviews</option><option value="yes">Reviewed</option><option value="no">Unreviewed</option></select></div>'+
      '<div class="mc-list"><div class="mc-list-head"><span>Confidence</span><span>Object</span><span>Reason</span><span>Actions</span></div>'+
      (list.length?list.slice(0,100).map(x=>'<div class="mc-row"><span class="mc-score '+(x.score>=95?'high':x.score>=80?'medium':'low')+'">'+x.score+'%</span><span><strong>'+esc(x.a.name)+'</strong><br>'+esc(x.b.name)+'</span><span>'+esc(x.reason)+'</span><span><button class="es-button" data-mc-review="'+esc(x.id)+'">Review</button> <button class="es-button" data-mc-dismiss="'+esc(x.id)+'">Dismiss</button></span></div>').join(''):'<p class="mc-empty">No matching suggestions. You can refresh detection after data changes.</p>')+'</div>'+
      '<section class="mc-log"><h2>Merge log</h2><div class="mc-list-head"><span>Date</span><span>Administrator</span><span>Merge</span><span>Undo</span></div>'+
      (log.map(m=>'<div class="mc-row"><span>'+esc(m.at.slice(0,10))+'</span><span>'+esc(m.admin)+'</span><span>'+(m.batchId?esc(state().batches.find(b=>b.id===m.batchId)?.count||1)+' automatic player merges':esc(m.type)+'<br>'+esc(m.source)+' → '+esc(m.survivor))+'</span><span>'+
        (m.undoneAt?'Undone':Date.now()-Date.parse(m.at)<=WINDOW?'<button class="es-button" data-mc-undo="'+esc(m.id)+'">Undo</button>':'Undo expired')+'</span></div>').join('')||'<p class="mc-empty">No merges yet.</p>')+'</section></div>';
    document.getElementById('mcRefresh').onclick=async()=>{detectionCache={};entityCache={};view.detectionReady={};automaticFailure='';automaticAttempted='';const s=state();s.scannedAt=new Date().toISOString();await saveState(s);renderMergeCenter();};
    document.getElementById('mcRetryAuto')?.addEventListener('click',()=>{automaticFailure='';automaticAttempted='';renderMergeCenter();});
    document.querySelectorAll('[data-mc-tab]').forEach(b=>b.onclick=()=>{view.type=b.dataset.mcTab;view.pair=null;view.quality=null;renderMergeCenter();});
    const manualItems=entities(view.type), manualButton=document.getElementById('mcCompareManual');
    for (const [suffix,key] of [['A','manualA'],['B','manualB']]) {
      const input=document.getElementById('mcManual'+suffix), results=document.getElementById('mcResults'+suffix);
      input.oninput=()=>{view[key]=null;manualButton.disabled=true;const q=fold(input.value);results.innerHTML=q.length<2?'':manualItems.filter(x=>fold(x.name+' '+x.id).includes(q)).slice(0,20).map(x=>'<button type="button" data-id="'+esc(x.id)+'">'+esc(x.name)+' <small>'+esc(x.id)+'</small></button>').join('');
        results.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{view[key]=manualItems.find(x=>x.id===b.dataset.id);input.value=view[key].name+' · '+view[key].id;results.innerHTML='';manualButton.disabled=!(view.manualA&&view.manualB&&view.manualA.id!==view.manualB.id);});};
    }
    manualButton.onclick=()=>{view.manualCandidate={id:pairKey(view.type,view.manualA.id,view.manualB.id),type:view.type,a:view.manualA,b:view.manualB,score:0,reason:'Manual review'};view.survivor=null;view.options=null;renderMergeCenter();};
    document.querySelectorAll('[data-mc-quality]').forEach(b=>b.onclick=()=>{const type=b.dataset.mcQuality;if(['player','club','agent'].includes(type)){view.type=type;view.query='';view.quality=null;}else{view.quality=type;}renderMergeCenter();});
    const search=document.getElementById('mcSearch');let searchTimer;search.oninput=()=>{view.query=search.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{renderMergeCenter();document.getElementById('mcSearch')?.focus();},140);};
    for (const [id,key] of [['mcConfidence','confidence'],['mcStatus','status'],['mcReviewed','reviewed']]) {const select=document.getElementById(id);select.value=view[key];select.onchange=()=>{view[key]=select.value;renderMergeCenter();};}
    document.querySelectorAll('[data-mc-review]').forEach(b=>b.onclick=()=>{view.pair=b.dataset.mcReview;view.survivor=null;view.options=null;renderMergeCenter();});
    document.querySelectorAll('[data-mc-dismiss]').forEach(b=>b.onclick=async()=>{const s=state();s.reviewed[b.dataset.mcDismiss]='dismissed';await saveState(s);renderMergeCenter();});
    document.querySelectorAll('[data-mc-undo]').forEach(b=>b.onclick=async()=>{try{await undo(b.dataset.mcUndo);}catch(error){toast(error.message);}});
  }
  if (window.EuroScoutAgencyResearch?.agentsOf) {
    const original=EuroScoutAgencyResearch.agentsOf;
    EuroScoutAgencyResearch.agentsOf=p=>[...new Set(original(p).map(canonicalAgent))];
  }
  function openPair(id) { view.type='player'; view.pair=id; view.manualCandidate=null; goView('mergecenter'); }
  window.EuroScoutMergeCenter={canonicalPlayer,canonicalPlayerEntity,canonicalClub,canonicalAgent,activeClubMerges,hasManualGroup,detect,merge,undo,resolveImport,previewImport,playerConfidence,automaticPlayerMatch,automaticPlan,autoMergeBatch,runAutomatic,invalidateCatalogue,automaticStatus:()=>({running:automaticRunning,pending:automaticTimer!==null,failure:automaticFailure}),openPair,
    _test:{storageChanges,restoreStorageChanges,compactUndo,mergeReport}};
  window.renderMergeCenter=renderMergeCenter;
})();

