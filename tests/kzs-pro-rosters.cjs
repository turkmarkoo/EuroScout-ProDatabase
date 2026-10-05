const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context={window:{}};vm.createContext(context);
new vm.Script(fs.readFileSync(path.join(root,'data','kzs-pro-2026.js'),'utf8')).runInContext(context);
new vm.Script(fs.readFileSync(path.join(root,'euroscout-kzs-pro.js'),'utf8')).runInContext(context);
const source=context.window.EUROSCOUT_KZS_PRO_2026;
assert.equal(source.teams.length,11);
assert.equal(source.roster.length,171);
assert.ok(source.teams.every(t=>t.key.startsWith('slo|')&&t.logo));
assert.equal(source.teams.find(t=>t.id==='kzs:18649').logo,'https://api.kzs.si/public/images/2b272b00-f297-42e6-92d3-90885a50b5e2');
const taij=source.roster.find(r=>r.name==='Taij Pesjak'||r.name==='Taij Pešjak');
assert.ok(taij);
const raw={leagues:[{meta:{id:'slo',name:'Liga OTP banka',season:'2025-26'},teams:[],players:[{id:'existing-taij',name:taij.name,born:taij.born,league:'slo',team:'LAS'}]}]};
context.window.EuroScoutKzsPro.apply(raw);
assert.equal(raw.domestic2627.leagues.slo.season,'2026/27');
assert.equal(raw.domestic2627.leagues.slo.teams.length,11);
const imported=raw.leagues[0].players.find(p=>p.id==='slo-'+taij.id);
assert.ok(imported&&imported._kzsPro&&imported.img);
const pairs=[];context.window.EuroScoutKzsPro.link((a,b)=>pairs.push([a,b]));
assert.ok(pairs.some(([a,b])=>a===imported.id&&b==='existing-taij'));
assert.equal(context.window.EuroScoutKzsPro.key(imported),source.teams.find(t=>t.id===taij.teamId).key);
const likar=source.roster.find(r=>r.name==='Arian Likar');
assert.ok(likar&&likar.id==='kzs-85343');
const likarLine=raw.leagues[0].players.find(p=>p.id==='slo-kzs-85343');
context.window.EuroScoutKzsPro.hydrate(likarLine,{data:{phases:[{matches:[{
 played:true,dateTime:'2026-10-03T15:30:00Z',firstTeamId:18649,secondTeamId:18651,
 firstTeamName:'Gorica',secondTeamName:'Kansai Helios Domžale',firstTeamScore:88,secondTeamScore:69,
 minutes:21.5,points:21,totalRebounds:5,assists:4,steals:1,blocksInFavor:0,turnovers:2,
 fgM:8,fgA:12,twoPM:6,twoPA:6,threePM:2,threePA:6,fTM:3,fTA:3,efficiency:25,plusMinus:11
}]}]}});
assert.equal(likarLine.g,1);
assert.equal(likarLine.ppg,21);
assert.equal(likarLine.rpg,5);
assert.deepEqual(Array.from(likarLine.gameLog[0]).slice(0,8),['2026-10-03','Kansai Helios Domžale','H',true,88,69,21.5,21]);
assert.deepEqual(Array.from(raw.leagues[0].meta.gameLogCols).slice(0,4),['date','opp','ha','win']);
console.log('KZS senior rosters are imported into the EuroScout Pro Database layer.');
