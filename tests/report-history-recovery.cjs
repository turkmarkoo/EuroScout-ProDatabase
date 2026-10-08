const assert=require('node:assert/strict'),fs=require('node:fs');
const merge=require('../euroscout-record-merge.js');
const history=require('../euroscout-scouting-history.js');

const merged=merge.mergeReports([
 {nOff:'• Smart decision maker\n• Strong shooter',_workflow:{updatedAt:'2026-10-01T10:00:00Z',viewings:[
  {id:'old-a',event:'Landau Lions vs Lions de Geneve',gameDate:'2026-10-07',date:'2026-10-07',author:'Scout',mode:'Video',updatedAt:'2026-10-07T10:00:00Z'}
 ]}},
 {nOff:'• strong shooter\n• Smart decision-maker\n• Attacks closeouts',_workflow:{updatedAt:'2026-10-07T11:00:00Z',viewings:[
  {id:'old-b',event:'Lions de Geneve vs Landau Lions',gameDate:'2026-10-07',date:'2026-10-07',author:'Scout',mode:'Video',status:'notes',updatedAt:'2026-10-07T11:00:00Z'},
  {id:'bcl-game',sessionId:'bcl-session',event:'BCL Team A vs BCL Team B',gameDate:'2026-09-25',date:'2026-09-25',author:'Scout',mode:'Video',status:'notes'}
 ]}}
]);
assert.deepEqual(merge.notes(merged.nOff),['Smart decision maker','Strong shooter','Attacks closeouts']);
assert.equal(merged._workflow.viewings.length,2,'same game under alternate IDs must appear once');
assert.ok(merged._workflow.viewings.some(v=>v.sessionId==='bcl-session'),'orphaned BCL session must be recovered');
const built=history.build(merged._workflow.viewings,[{id:'bcl-session',gameDate:'2026-09-25',a:{name:'BCL Team A'},b:{name:'BCL Team B'},players:[{id:'canonical-player'}]}],['canonical-player']);
assert.equal(built.filter(x=>x.title.includes('BCL Team')).length,1,'recovered session and viewing must deduplicate');

const html=fs.readFileSync('index.html','utf8'),sessions=fs.readFileSync('euroscout-sessions.js','utf8'),css=fs.readFileSync('euroscout-live-notes.css','utf8'),mergeCenter=fs.readFileSync('euroscout-merge-center.js','utf8');
assert.match(html,/euroscout-record-merge\.js\?v=20261008-history-recovery/);
assert.match(html,/next\._workflow=ESRecordMerge\.mergeWorkflows\(report\._workflow,next\._workflow\)/,'ordinary report saves must preserve history');
assert.match(html,/function recordAliasLinks\(\)/,'history recovery must follow saved player merges after a source feed disappears');
assert.match(mergeCenter,/ESRecordMerge\.mergeWorkflows\(a\[key\],value\)/,'manual identity merges must retain both timelines');assert.match(sessions,/reportRecords\(p\)/,'history must read records from every linked ID');
assert.match(sessions,/everything\(\), ids/,'history must include recovered legacy sessions');
assert.match(css,/\.mx-col \.rosterList\{[^}]*height:0;[^}]*overflow-y:scroll;[^}]*scrollbar-gutter:stable/,'roster columns must own a real scroll viewport');
console.log('Report deduplication, alias-history recovery, and roster scrolling checks passed.');