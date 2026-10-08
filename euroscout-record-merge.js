/* EuroScout — lossless report merging and history recovery across player IDs. */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
else root.ESRecordMerge=api;
})(globalThis,function(){
'use strict';
const NOTE_FIELDS=['nStrengths','nImprove','nAth','nOff','nDef','nIntel','nProj','nRecommend','overall'];
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function notes(value){
 return String(value||'').split(/\r?\n/).map(line=>line.replace(/^\s*(?:[•‣⁃▪●·*–—-]|\d+[.)])\s*/,'').trim()).filter(Boolean);
}
function mergeNoteText(...values){
 const out=[],seen=new Set();
 for(const value of values)for(const note of notes(value)){const key=norm(note);if(!key||seen.has(key))continue;seen.add(key);out.push(note);}
 return out.map(note=>'• '+note).join('\n');
}
function viewingKey(v){
 if(v?.sessionId)return'session:'+v.sessionId;
 const event=String(v?.event||'').split(/\s+vs\s+/i).map(norm).sort().join('|'),game=String(v?.gameDate||v?.date||'').slice(0,10),author=norm(v?.author),mode=norm(v?.mode);
 return event||game?'game:'+game+'|'+event+'|'+author+'|'+mode:'id:'+String(v?.id||'');
}
function mergeViewings(...lists){
 const out=[],positions=new Map();
 for(const item of lists.flat().filter(Boolean)){
  const key=viewingKey(item),at=String(item.updatedAt||item.date||'');
  if(!positions.has(key)){positions.set(key,out.length);out.push({...item});continue;}
  const i=positions.get(key),prior=out[i],priorAt=String(prior.updatedAt||prior.date||'');
  const newer=at>=priorAt?item:prior,older=at>=priorAt?prior:item;
  const merged={...older,...newer};
  const noteText=mergeNoteText(older.notes,newer.notes);if(noteText)merged.notes=notes(noteText).join('\n');
  out[i]=merged;
 }
 return out;
}
function mergeWorkflows(...items){
 const workflows=items.filter(x=>x&&typeof x==='object'),out={};
 for(const workflow of workflows)for(const [key,value]of Object.entries(workflow))if(key!=='viewings'&&key!=='updatedAt'&&(out[key]==null||out[key]===''))out[key]=value;
 out.viewings=mergeViewings(...workflows.map(x=>x.viewings||[]));
 out.updatedAt=workflows.map(x=>String(x.updatedAt||'')).sort().at(-1)||'';
 return out;
}
function mergeReports(reports){
 const list=reports.filter(x=>x&&typeof x==='object'),out={...(list[0]||{})};
 for(const report of list.slice(1))for(const [key,value]of Object.entries(report))if(!NOTE_FIELDS.includes(key)&&key!=='_workflow'&&key!=='_notesUpdated'&&(out[key]==null||out[key]===''))out[key]=value;
 for(const key of NOTE_FIELDS){const merged=mergeNoteText(...list.map(report=>report[key]));if(merged)out[key]=merged;else delete out[key];}
 const workflows=list.map(report=>report._workflow).filter(Boolean);if(workflows.length)out._workflow=mergeWorkflows(...workflows);
 const updated=list.map(report=>String(report._notesUpdated||'')).sort().at(-1);if(updated)out._notesUpdated=updated;
 return out;
}
return{NOTE_FIELDS,notes,mergeNoteText,viewingKey,mergeViewings,mergeWorkflows,mergeReports};
});