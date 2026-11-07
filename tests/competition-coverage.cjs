const assert=require('node:assert/strict');
const {build}=require('../euroscout-competition-coverage.js');
const names={a:'Alpha',b:'Beta',c:'Gamma',old:'Historic'};
const resolveTeam=t=>t?.key?{key:t.key==='alias'?'a':t.key,name:names[t.key]||t.key}:null;
const competitionKey=c=>c.id==='aliasLeague'?'league':c.id||'name:'+c.name;
const s=(id,comp,date,a='a',b='b')=>({id,competition:{id:comp},a:{key:a},b:{key:b},watchedOn:[date],gameDate:'2026-09-01',players:[{id:'p',club:'alias',status:'notes'}]});
const input={competition:{id:'league'},competitions:[{id:'league',name:'League',members:[{key:'a'},{key:'b'},{key:'c'}]},{id:'cup',name:'Cup',members:[{key:'alias'}]}],resolveTeam,competitionKey,
 sessions:[s('1','aliasLeague','2026-11-06','alias','old'),s('2','cup','2026-11-07','b','other'),{...s('3','league','2026-11-07'),active:true},{...s('4','league','2026-11-07'),removed:true}],roster:k=>k==='a'?[{id:'p'},{id:'q'}]:[],noted:p=>p.id==='p',watched:p=>p.id==='q'};
let m=build(input);assert.equal(m.current,3);assert.equal(m.league,1);assert.equal(m.any,2);assert.equal(m.never,1);
const a=m.teams.find(t=>t.key==='a'),b=m.teams.find(t=>t.key==='b');
assert.equal(a.leagueSessions.length,1);assert.equal(a.noted.size,1);assert.equal(a.watchlist.size,1);assert.equal(a.lastDate,'2026-11-06');assert.deepEqual(a.otherCompetitions,['Cup']);assert.equal(b.status,'elsewhere');assert.equal(m.teams.find(t=>t.key==='old').current,false);
assert.ok(!m.teams.some(t=>t.key==='other'));assert.ok(m.teams.every(t=>t.sessions.every(s=>s.id!=='3'&&s.id!=='4')));
const original=JSON.stringify(input.sessions);build(input);assert.equal(JSON.stringify(input.sessions),original,'read-only history');
m=build({...input,competition:{id:'nba'},competitions:[],fixtures:[{comp:'nba',compName:'NBA',date:'2026-10-22',home:{key:'a'},away:{key:'b'}},{comp:'nba',date:'2025-10-22',home:{key:'old'},away:{key:'c'}}]});assert.equal(m.current,2);assert.equal(m.teams.length,2);
for(const id of ['bbl','eurocup','fec','ncaam','gleague','cup','name:Custom'])assert.equal(build({...input,competition:{id},competitions:[{id,members:[{key:'a'}]}],sessions:[]}).current,1);
console.log('PASS: league aliases, current membership, replay dates, cross-competition history, unknown fields, all competition types, inactive sessions, notes/watchlist deduplication and read-only data.');
