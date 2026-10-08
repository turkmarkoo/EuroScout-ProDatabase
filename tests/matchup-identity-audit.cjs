const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['eurocup-rosters-2026.js','official-rosters-2026.js','euroleague-rosters-2026.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const sets=[context.window.EUROSCOUT_EUROCUP_ROSTERS,context.window.EUROSCOUT_OFFICIAL_ROSTERS,context.window.EUROSCOUT_EUROLEAGUE_ROSTERS].filter(Boolean);
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
assert.match(live,/function buildClubIndex\(\)/,'Matchup must build a stable roster index');
assert.match(live,/window\.EUROSCOUT_EUROCUP_ROSTERS/,'Matchup must include official EuroCup registrations');
assert.match(live,/window\.EUROSCOUT_OFFICIAL_ROSTERS/,'Matchup must include other official competition registrations');
assert.match(live,/officialRosterRow\(p\)/,'Matchup must use official registration numbers');
const eurocup=sets[0],leMans=eurocup.roster.filter(row=>row.teamCode==='LEM'),tortona=eurocup.roster.filter(row=>row.teamCode==='TRT');
assert.ok(leMans.length>=12,'Le Mans must have a usable 2026/27 EuroCup roster');
assert.ok(tortona.length>=12,'Tortona must have a usable 2026/27 EuroCup roster');
assert.equal(new Set(leMans.flatMap(row=>row.ids)).size,leMans.flatMap(row=>row.ids).length,'Le Mans stable IDs must be unique');
assert.equal(new Set(tortona.flatMap(row=>row.ids)).size,tortona.flatMap(row=>row.ids).length,'Tortona stable IDs must be unique');
const helperSource=live.slice(live.indexOf('function officialDirectories()'),live.indexOf('function liveRoster(key)'));
const rosterContext={
 window:{EUROSCOUT_EUROCUP_ROSTERS:eurocup},
 canonKey:key=>key,gid:p=>p._gid||p.id,next26Get:()=>({}),next26bGet:()=>({}),
 assignPool:()=>[],allPlayersEvery:()=>eurocup.players,player:()=>null,
 effective26keys:()=>[],effective26:()=>null,isStatus:()=>false,Map,Set
};
vm.createContext(rosterContext);
vm.runInContext(helperSource+';this.clubIndex=buildClubIndex();',rosterContext);
assert.equal(rosterContext.clubIndex.get('lnb|LEM').length,leMans.length,'Le Mans official registrations must populate its matchup roster');
assert.equal(rosterContext.clubIndex.get('lba|BDBT').length,tortona.length,'Tortona official registrations must populate its matchup roster');
const lietkabelis=sets[0].roster.filter(row=>row.teamCode==='LKB');
const ilic=lietkabelis.filter(row=>['Milos Ilic','Veljko Ilic'].includes(row.name));
assert.equal(ilic.length,2);
assert.deepEqual(Array.from(ilic,row=>row.name).sort(),['Milos Ilic','Veljko Ilic']);
assert.equal(new Set(ilic.map(row=>row.ids[0])).size,2);
const cowan=sets[0].roster.find(row=>row.ids?.includes('eurocup-012003'));
assert.ok(cowan,'Anthony Cowan Jr must remain in the official EuroCup directory');
for(const id of ['aba-5608','bcl-0319','bsl-0202','bsn-80'])assert.ok(cowan.ids.includes(id),`Anthony Cowan identity must include ${id}`);
console.log('Stable-ID ownership and matchup name-collision audit passed for official roster directories.');
