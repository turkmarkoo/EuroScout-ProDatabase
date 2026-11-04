const assert=require('node:assert/strict');
const {create,jsonChunks}=require('../euroscout-cloud-sync.js');
const input={text:'A\n\"\\\t'+'😀'.repeat(80000),array:[null,undefined,{keep:true,omit:undefined}],number:Infinity};
const chunks=[...jsonChunks(input)];assert(chunks.length>1);assert(chunks.every(s=>s.length<75000));assert.deepEqual(JSON.parse(chunks.join('')),JSON.parse(JSON.stringify(input)));
(async()=>{
 let reads=0;const saved={records:{p:{report:JSON.stringify({nOff:'Private current note'}),rating:4}},appData:{session:{id:'active'}}};
 const sync=create({account:'fixture',tab:'test',initial:saved,journal:{all:async()=>{reads++;return[];},put:async()=>{}},applyLocal:()=>{}});await sync.init();
 const before=reads,backup=await sync.currentBackup();assert.equal(reads,before,'Current export must not load every historical journal');assert.deepEqual(backup.current.local,saved);assert(!('recovery' in backup.current));assert(!('journals' in backup));assert(backup.scope.includes('older recovery copies remain'));assert.deepEqual(JSON.parse([...jsonChunks(backup)].join('')),JSON.parse(JSON.stringify(backup)));
 console.log('PASS bounded JSON export, Unicode/escaping, current notes and settings, historical journals untouched.');
})().catch(e=>{console.error(e);process.exitCode=1});
