const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['eurocup-rosters-2026.js','official-rosters-2026.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const sets=[context.window.EUROSCOUT_EUROCUP_ROSTERS,context.window.EUROSCOUT_OFFICIAL_ROSTERS].filter(Boolean);
const rows=sets.flatMap(set=>(set.roster||[]).map(row=>({...row,_set:set})));
const owner=new Map(),conflicts=[];
for(const row of rows)for(const id of row.ids||[row.id]){
 if(!id)continue;const prior=owner.get(id);
 if(prior&&prior.born&&row.born&&prior.born!==row.born)conflicts.push([id,prior.name,prior.born,row.name,row.born]);else owner.set(id,row);
}
assert.deepEqual(conflicts,[],'One stable player ID must never belong to people with conflicting birth years');
for(const set of sets){
 const ids=new Set();for(const row of set.roster||[])for(const id of row.ids||[row.id]){assert.equal(ids.has(id),false,`Duplicate stable ID ${id} inside one official directory`);ids.add(id);}
}
const live=fs.readFileSync('euroscout-live-notes.js','utf8');
assert.match(live,/function rosterName\(p,players\)/);
assert.match(live,/esc\(rosterName\(p,r\.players\)\)/);
const lietkabelis=sets[0].roster.filter(row=>row.teamCode==='LKB');
const ilic=lietkabelis.filter(row=>['Milos Ilic','Veljko Ilic'].includes(row.name));
assert.equal(ilic.length,2);
assert.deepEqual(Array.from(ilic,row=>row.name).sort(),['Milos Ilic','Veljko Ilic']);
assert.equal(new Set(ilic.map(row=>row.ids[0])).size,2);
const cowan=sets[0].roster.find(row=>row.ids?.includes('eurocup-012003'));
assert.ok(cowan,'Anthony Cowan Jr must remain in the official EuroCup directory');
for(const id of ['aba-5608','bcl-0319','bsl-0202','bsn-80'])assert.ok(cowan.ids.includes(id),`Anthony Cowan identity must include ${id}`);
console.log('Stable-ID ownership and matchup name-collision audit passed for official roster directories.');
