/* DragonHub transfer verification: evidence-based workflow, never a quality judgement. */
(function(){
  const AUDIT_KEY='euroscout:transferVerification:v1';
  const SOURCE_WEIGHTS={official:25,journalist:18,trusted:12,general:5,rumor:0};
  const officialRe=/official|club|league|federation|basketball association|super league|liga|basketball\.com/i;
  const journalistRe=/basketnews|eurohoops|sportando|basketinside|bball1|backdoor|reliable/i;
  const rumorRe=/rumou?r|social|twitter|x\.com|instagram/i;
  function audit(){try{return JSON.parse(localStorage.getItem(AUDIT_KEY)||'{}')||{};}catch(e){return {};}}
  function saveAudit(a){try{localStorage.setItem(AUDIT_KEY,JSON.stringify(a));}catch(e){}try{Sync.stampKey(AUDIT_KEY);Sync.pushAppKey(AUDIT_KEY);}catch(e){}}
  function sourceKind(s){const t=String((s&&((s.name||s.source_name||'')+' '+(s.url||'')))||s||'').toLowerCase();if(rumorRe.test(t))return'rumor';if(officialRe.test(t))return'official';if(journalistRe.test(t))return'journalist';return'general';}
  function sourcesOf(x){const tr=x.tr||x;const out=[];if(tr.source_url||tr.source_name)out.push({url:tr.source_url||'',name:tr.source_name||'Imported source',kind:sourceKind(tr)});(tr.sources||[]).forEach(s=>out.push({...s,kind:sourceKind(s)}));if(tr.corroboration)out.push({url:tr.corroboration,name:'Corroborating source',kind:sourceKind(tr.corroboration)});return out.filter((s,i,a)=>s.url||i===0).filter((s,i,a)=>a.findIndex(z=>z.url&&z.url===s.url)===i);}
  function verify(x){
    const tr=x.tr||x,p=x.p,team=x.team,src=sourcesOf(x), exact=!!(tr.playerId&&p&&(tr.playerId===p.id||(p._grp||[]).some(g=>g.id===tr.playerId))), player=exact?30:(p?20:0);
    const dest=team?20:0, origin=tr.from&&typeof dbTeamForClub==='function'&&dbTeamForClub(tr.from)?10:0;
    const official=src.some(s=>s.kind==='official')?25:0, corroboration=src.filter(s=>s.kind!=='rumor').length>1?10:0;
    const conflict=tr.conflict||tr.status==='rumor'||src.some(s=>s.kind==='rumor'&&s.kind!=='official');
    const noConflict=conflict?0:5,score=Math.min(100,player+dest+origin+official+corroboration+noConflict);
    const status=score>=90&&exact&&!!team?'auto_approved':score>=60?'needs_review':'rejected';
    return {id:tr.id,score,status,playerMatch:exact?'exact':p?'possible':'none',destinationMatch:!!team,originMatch:!!origin,evidence:src,conflict:!!conflict,checkedAt:new Date().toISOString()};
  }
  function label(v){return v.status==='auto_approved'?'Auto approved':v.status==='needs_review'?'Needs review':'Rejected';}
  function autoApply(items){
    const a=audit(),changed=[];
    items.forEach(v=>{if(v.status!=='auto_approved'||a[v.id])return;const x=v.item,p=x.p,k=x.team&&x.team.key;if(!p||!k)return;try{set26(p.id,k);const h=trHandledGet();h[x.tr.id]='approved';trHandledSet(h);a[v.id]={...v,decision:'auto_approved',decisionAt:new Date().toISOString(),administrator:null};changed.push(v.id);}catch(e){}});
    if(changed.length)saveAudit(a);return changed.length;
  }
  function enrich(){const raw=window.__esTransferPendingBase||pendingTransfers;const all=raw();const vals=all.map(item=>{const v=verify(item);v.item=item;return v;});autoApply(vals);return vals;}
  function queue(){return enrich().filter(v=>v.status==='needs_review').map(v=>({...v.item,verification:v}));}
  function drawer(id){const v=enrich().find(x=>x.id===id);if(!v)return;const rows=v.evidence.map(s=>`<li><b>${esc(s.kind)}</b> · ${esc(s.name||'Source')} ${s.url?`<a href="${escAttr(s.url)}" target="_blank" rel="noopener">↗</a>`:''}</li>`).join('');showModal(`<h3>Transfer verification</h3><p><b>${esc(v.item.p?.name||v.item.tr?.player||'Transfer')}</b> · <strong>${v.score}%</strong> · ${esc(label(v))}</p><p class="hint">Player registry: ${esc(v.playerMatch)} · Destination registry: ${v.destinationMatch?'matched':'not matched'} · Origin registry: ${v.originMatch?'matched':'not matched'}</p><h4>Evidence</h4><ul>${rows||'<li>No evidence recorded</li>'}</ul><p class="hint">Verification answers whether the move is sufficiently supported. It does not judge the player or transfer quality.</p>` ,true);}
  function install(){
    if(typeof pendingTransfers!=='function'||window.__esTransferVerificationInstalled)return;
    window.__esTransferVerificationInstalled=true;window.__esTransferPendingBase=pendingTransfers;
    pendingTransfers=function(){return queue();};
    const row=trRow;trRow=function(x){const v=verify(x);let h=row(x);h=h.replace('<span class="trMove">',`<span class="trMove"><span class="trConfidence ${v.status}" title="${escAttr(v.evidence.map(s=>s.name||s.kind).join(', '))}">${v.score}% · ${label(v)}</span>`);h=h.replace('</div>',`<button class="trVerifyBtn" type="button" onclick="openTransferVerification('${escAttr(v.id)}');event.stopPropagation()">Evidence</button></div>`);return h;};window.openTransferVerification=drawer;
    const approve=approveTransfer,reject=rejectTransfer;
    approveTransfer=function(id,pid,team){const v=enrich().find(x=>x.id===id);approve(id,pid,team);if(v){const a=audit();a[id]={...v,decision:'manual_approved',decisionAt:new Date().toISOString(),administrator:Store.user?.email||'local-admin'};delete a[id].item;saveAudit(a);}};
    rejectTransfer=function(id){const v=enrich().find(x=>x.id===id);reject(id);if(v){const a=audit();a[id]={...v,decision:'manual_rejected',decisionAt:new Date().toISOString(),administrator:Store.user?.email||'local-admin'};delete a[id].item;saveAudit(a);}};
  }
  function summary(){const vals=enrich(),a=audit(),counts={auto_approved:Object.values(a).filter(v=>v&&v.decision==='auto_approved').length,needs_review:0,rejected:0};vals.forEach(v=>{if(v.status==='needs_review')counts.needs_review++;if(v.status==='rejected')counts.rejected++;});return counts;}
  window.EuroScoutTransferVerification={verify,queue,audit,install,label,summary,enrich};
  install();
})();
