const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={window:{}};vm.runInNewContext(fs.readFileSync('euroscout-identity-bio.js','utf8'),c);
const api=c.window.EuroScoutIdentityBio;
const rows=[
 {id:'cze-9',name:'Robert Lee Bonham',born:2001,g:48,ppg:16.7},
 {id:'cze-official-138828',name:'Robert Lee Bonham',born:2002},
 {id:'fiba-bcl-398976',name:'Robert Lee Bonham III',born:2002},
 {id:'dragons-bcl-123-player-3309',name:'Trey Bonham',fibaPlayerId:'398976',g:4,ppg:14.75,gameLog:[['2026-11-18',8]]},
 {id:'other-bonham',name:'Robert Lee Bonham',born:1990}
];
const metrics=JSON.stringify(rows.map(p=>[p.g,p.ppg,p.gameLog]));
api.apply({leagues:[{players:rows}]});
assert(rows.slice(0,4).every(p=>p.born===2002&&p.birthDate==='2002-04-14'));
assert.equal(rows[4].born,1990,'A matching name is not evidence of the same person');
assert.equal(JSON.stringify(rows.map(p=>[p.g,p.ppg,p.gameLog])),metrics,'Identity repair must not rewrite statistics');
const pairs=[];api.link((a,b)=>pairs.push([a,b]));
for(const id of ['cze-official-138828','fiba-bcl-398976','fiba-stat-bcl-398976','dragons-bcl-123-player-3309','dragons-cze-5-player-15337-team-41'])assert(pairs.some(([a,b])=>a==='cze-9'&&b===id));
assert(!pairs.flat().includes('other-bonham'));
assert.equal(api.personKey(rows[0]),api.personKey(rows[3]));
console.log('PASS reviewed Bonham IDs share one identity, correct the imported year, retain all aliases and keep competition statistics unchanged.');
