const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const picker=fs.readFileSync('team-selection-workspace-20261007d.js','utf8');

assert.match(html,/if\(\[\.\.\.lgSet\[a\]\]\.some\(l=>lgSet\[b\]\.has\(l\)\)\)return false/);
assert.match(html,/buducnost/);
assert.match(html,/sc derby\|studentski centar/);
assert.match(picker,/\['fec','FIBA Europe Cup',\/\^fibaeuropecup\$\//);
assert.ok(picker.includes("replace(/26$/,'')"));
assert.match(html,/const currentSeasonKeys=new Set/);
const current=JSON.parse(fs.readFileSync('data/data.json','utf8'));
const eurocup2627=current.season2627.comps.eurocup.teams;
assert.ok(eurocup2627.some(team=>team.key==='lnb|LEM'&&/Le Mans/i.test(team.name)),'Le Mans is a current 2026/27 EuroCup entry');
assert.ok(!current.season2627.comps.bcl.teams.some(team=>/Le Mans/i.test(team.name)||team.key==='bcl|MSB'),'Le Mans historical BCL identity is not a 2026/27 BCL entry');

const data=JSON.parse(fs.readFileSync('ncaa-rosters.json','utf8'));
const counts=new Map();
for(const record of Object.values(data.records)){
  const season=record.seasons?.['2026-27'];
  if(season)counts.set(season.teamCode,(counts.get(season.teamCode)||0)+1);
}
assert.equal(counts.get('AMCC'),16);
assert.equal(counts.get('GT'),15);
assert.ok(Math.max(...counts.values())<30);

const pro=JSON.parse(fs.readFileSync('leagues_pro.js','utf8'));
const cedevita=pro.leagues.flatMap(league=>(league.teams||[]).filter(team=>/cedevita olimpija/i.test(team.name)).map(team=>({league,team})));
assert.ok(cedevita.length>=2);
assert.ok(cedevita.reduce((sum,row)=>sum+row.league.players.filter(player=>player.team===row.team.code&&!player._rosterOnly&&Number(player.g)>0).length,0)>=18);

console.log('Club identity, NCAA roster size and previous-season roster regressions are guarded.');
