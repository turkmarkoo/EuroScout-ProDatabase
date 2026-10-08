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
 assignPool:()=>eurocup.players,allPlayersEvery:()=>eurocup.players,player:()=>null,
 allClubs:()=>[{key:'eurocup|DER',name:'Baglietto Derthona Tortona',teams:[{key:'eurocup|DER',name:'Baglietto Derthona Tortona'},{key:'lba|BDBT',name:'Derthona Basket'}]},{key:'bcl|MSB',name:'Le Mans Sarthe Basket',teams:[{key:'bcl|MSB',name:'Le Mans Sarthe Basket'},{key:'lnb|LEM',name:'Le Mans Sarthe Basket'}]}],
 effective26keys:()=>['stale|OLD'],effective26:()=> 'stale|OLD',isStatus:()=>false,fold:s=>String(s||'').toLowerCase(),officialRosterRow:()=>null,Map,Set
};
vm.createContext(rosterContext);
vm.runInContext(helperSource+";this.clubIndex=buildClubIndex();this.sameRosterPerson=sameRosterPerson;",rosterContext);
assert.equal(rosterContext.sameRosterPerson({name:'D. Maddox',jersey:'21'},{name:'D. Maddox Jr',jersey:'21'}),true,'suffix aliases with the same jersey are one roster person');
assert.equal(rosterContext.sameRosterPerson({name:'James Frazier',jersey:'0'},{name:'James Frazier Jr.',jersey:'0'}),true,'punctuated suffix aliases are one roster person');
assert.equal(rosterContext.sameRosterPerson({id:'fiba-fec-239392',name:'J.J. Frazier',born:1995,jersey:'0'},{id:'bclq-239392',name:'James Frazier Jr',born:1995,jersey:'0'}),true,'the same FIBA person ID merges across Europe Cup and qualifier prefixes');
assert.equal(rosterContext.sameRosterPerson({name:'Edward Polite',jersey:'24'},{name:'Edward Polite Jr.',jersey:'24'}),true,'Polite suffix aliases are one roster person');
assert.equal(rosterContext.sameRosterPerson({name:'Noah Kirkwood',born:1999},{name:'Noah Arthur Kirkwood',born:1999}),true,'middle names do not create a second roster person');
assert.equal(rosterContext.sameRosterPerson({name:'Anthony Cowan Jr',born:1997},{name:'Anthony Dewayne Cowan',born:1997}),true,'middle names and suffixes can resolve together');
assert.equal(rosterContext.sameRosterPerson({name:'Cameron Houindo',born:2008},{name:'Cameron Toussaint Selidji Houindo',born:2008}),true,'multiple middle names remain one roster person');
assert.equal(rosterContext.sameRosterPerson({name:'Jayce Johnson',born:1997},{name:'Jayce Ryback Johnson',born:1997}),true,'Jayce Johnson middle-name variant is one roster person');
assert.equal(rosterContext.sameRosterPerson({name:'Matthew Hurt',born:2000},{name:'Matthew Christopher Hurt',born:2000}),true,'Matthew Hurt middle-name variant is one roster person');
assert.equal(rosterContext.sameRosterPerson({name:'G. Gazzotti',born:1999},{name:'G. Gazzotti',born:1999}),true,'same-name feed rows merge');
assert.equal(rosterContext.sameRosterPerson({name:'Alex Smith',born:1998},{name:'Alex Smith',born:2001}),false,'same-name players with conflicting birth years remain separate');
assert.equal(rosterContext.sameRosterPerson({name:'Alex John Smith',born:1998},{name:'Alex James Smith',born:1998}),false,'different middle names are not silently merged');
assert.equal(rosterContext.clubIndex.get('lnb|LEM').length,leMans.length,'Le Mans official registrations must populate its matchup roster');
assert.equal(rosterContext.clubIndex.get('lba|BDBT').length,tortona.length,'Tortona official registrations must populate its domestic-key matchup roster');
assert.equal(rosterContext.clubIndex.get('eurocup|DER').length,tortona.length,'Tortona official registrations must populate its competition-key matchup roster');
assert.equal(rosterContext.clubIndex.get('bcl|MSB').length,leMans.length,'Le Mans official registrations must populate its competition-key matchup roster');
assert.equal(rosterContext.clubIndex.get('stale|OLD')?.length||0,0,'stale cloud assignments must not override official current registrations');
const lietkabelis=sets[0].roster.filter(row=>row.teamCode==='LKB');
const ilic=lietkabelis.filter(row=>['Milos Ilic','Veljko Ilic'].includes(row.name));
assert.equal(ilic.length,2);
assert.deepEqual(Array.from(ilic,row=>row.name).sort(),['Milos Ilic','Veljko Ilic']);
assert.equal(new Set(ilic.map(row=>row.ids[0])).size,2);

const raw=JSON.parse(fs.readFileSync('data/data.json','utf8')),actualPlayers=raw.leagues.flatMap(league=>league.players||[]);
const fibaContext={window:{}};vm.createContext(fibaContext);for(const file of ['official-rosters-2026.js','data/fiba-club-competitions-2026.js','euroscout-fiba-club-competitions.js'])vm.runInContext(fs.readFileSync(file,'utf8'),fibaContext);
const official=fibaContext.window.EUROSCOUT_OFFICIAL_ROSTERS,actualById=new Map(actualPlayers.map(player=>[player.id,player])),rosterById=new Map();
for(const directory of [eurocup,official])for(const row of directory.roster||[])for(const id of row.ids||[row.id])if(!rosterById.has(id))rosterById.set(id,row);
const actualClubs=[
 {key:'aba|COL',name:'Cedevita Olimpija',teams:[{key:'aba|COL',name:'Cedevita Olimpija',searchAliases:['Cedevita Olimpija']},{key:'eurocup|LJU',name:'Cedevita Olimpija Ljubljana',searchAliases:['Cedevita Olimp','Cedevita Olimpija','KK Cedevita Olimpija']}]},
 {key:'fec|AL',name:'LANDAU Lions',teams:[{key:'fec|AL',name:'LANDAU Lions',searchAliases:['LANDAU Lions']}]}
];
const actualContext={
 window:{EUROSCOUT_EUROCUP_ROSTERS:eurocup,EUROSCOUT_OFFICIAL_ROSTERS:official},
 canonKey:key=>key,gid:p=>p._gid||p.id,next26Get:()=>({}),next26bGet:()=>({}),assignPool:()=>[],allPlayersEvery:()=>actualPlayers,
 player:id=>actualById.get(id)||null,allClubs:()=>actualClubs,effective26keys:()=>[],
 fold:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),
 officialRosterRow:p=>rosterById.get(p?.id)||(p?._grp||[]).map(x=>rosterById.get(x.id)).find(Boolean)||null,Map,Set
};
vm.createContext(actualContext);vm.runInContext(helperSource+';this.clubIndex=buildClubIndex();',actualContext);
const cedevita=actualContext.clubIndex.get('aba|COL'),landau=actualContext.clubIndex.get('fec|AL');
assert.ok(official.roster.some(row=>row.name==='J.J. Frazier'),'the current FIBA Europe Cup J.J. Frazier row must be present in the reconstructed directory');
assert.ok(official.roster.some(row=>row.name==='James Frazier Jr'),'the qualifier James Frazier Jr row must be present in the reconstructed directory');
assert.equal(cedevita.length,15,'Cedevita cross-competition roster must collapse middle-name aliases');
for(const surname of ['Kirkwood','Cowan','Houindo','Johnson','Hurt'])assert.equal(cedevita.filter(p=>p.name.includes(surname)).length,1,`Cedevita must show one ${surname} identity`);
assert.equal(landau.length,13,'LANDAU current roster must contain 13 unique players after cross-feed identity consolidation');
assert.equal(landau.filter(p=>/Frazier/.test(p.name)).length,1,'LANDAU must show one James Frazier identity');
assert.equal(landau.filter(p=>/Polite/.test(p.name)).length,1,'LANDAU must show one Edward Polite identity');
const cowan=sets[0].roster.find(row=>row.ids?.includes('eurocup-012003'));
assert.ok(cowan,'Anthony Cowan Jr must remain in the official EuroCup directory');
for(const id of ['aba-5608','bcl-0319','bsl-0202','bsn-80'])assert.ok(cowan.ids.includes(id),`Anthony Cowan identity must include ${id}`);
console.log('Stable-ID ownership and matchup name-collision audit passed for official roster directories.');
