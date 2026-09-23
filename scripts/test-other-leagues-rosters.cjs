const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');

const roster=JSON.parse(fs.readFileSync('nba-rosters-2026.json','utf8'));
assert.equal(roster.rosterSeason,'2026-27');
assert.equal(roster.statsSeason,'2025-26');
assert(roster.players.length>=500,'official NBA roster should contain the full league');
assert.equal(new Set(roster.players.map(p=>p.id)).size,roster.players.length,'NBA player IDs must be unique');
assert(roster.players.every(p=>p.team&&p.teamName),'every NBA player needs a current team');

const ncaa=JSON.parse(fs.readFileSync('ncaa-rosters.json','utf8'));
assert.equal(ncaa.rosterSeason,'2026-27');
assert.equal(ncaa.statsSeason,'2025-26');
assert(ncaa.teamsPublished>300,'NCAA roster coverage should remain substantial');

for(const file of ['euroscout-nba-rosters.js','euroscout-ncaa.js'])new vm.Script(fs.readFileSync(file,'utf8'));
const nbaSource=fs.readFileSync('euroscout-nba-rosters.js','utf8');
assert.match(nbaSource,/rosterStatus:'pending'/,'unpublished G League rosters must be marked pending');
assert.match(nbaSource,/_nbaCurrent:true/,'NBA view must distinguish current roster members');

(async()=>{
  const pack=JSON.parse(fs.readFileSync('data/leagues_pro.json','utf8'));
  const context={window:{},fetch:async()=>({ok:true,json:async()=>roster})};
  vm.createContext(context);vm.runInContext(nbaSource,context);await context.window.EuroScoutNBARosters.enrich(pack);
  const nba=pack.leagues.find(l=>l.meta.id==='nba'),gleague=pack.leagues.find(l=>l.meta.id==='gleague');
  assert.equal(nba.players.filter(p=>p._nbaCurrent).length,580);
  assert.equal(nba.players.find(p=>p.name==='LeBron James').teamName,'Philadelphia 76ers');
  assert.equal(nba.meta.rosterSeason,'2026-27');
  assert.equal(nba.meta.statsSeason,'2025-26');
  assert.equal(gleague.meta.rosterStatus,'pending');
  console.log('Other Leagues 2026/27 roster checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
