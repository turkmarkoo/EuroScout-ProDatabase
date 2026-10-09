const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','euroscout-ui.js'),'utf8');
const quickstats=fs.readFileSync(path.join(__dirname,'..','euroscout-quickstats.js'),'utf8');

test('2026/27 is the default database statistics season',()=>{
  assert.match(html,/season:"2026\/27",statsSeason:"2026\/27"/);
});

test('played DragonsData lines replace empty current-roster shells in quick stats',()=>{
  assert.match(quickstats,/playedLines=seasonLines\.filter\(x=>Number\(x\.g\)>0\)/);
  assert.match(quickstats,/shown=distinctLines\(playedLines\.length\?playedLines:seasonLines\)/);
  assert.match(html,/euroscout-quickstats\.js\?v=20261009-distinct-stats-v2/);
});

test('profiles prefer a linked 2026/27 statistics line',()=>{
  assert.match(html,/function currentSeasonProfile\(p\)/);
  assert.match(html,/group\.filter\(x=>scoutSeason\(x\)==='2026\/27'\)/);
  assert.match(html,/if\(!exact\)\{const preferred=currentSeasonProfile\(_p\)/);
  assert.match(html,/openProfile\(id,false,true\)/);
  const source=html.slice(html.indexOf('function currentSeasonProfile('),html.indexOf('function openProfile('));
  const context={scoutSeason:p=>p.season};
  vm.createContext(context);vm.runInContext(source,context);
  const old={id:'old',season:'2025/26',g:30,mpg:28};
  const currentA={id:'current-a',season:'2026/27',g:1,mpg:20};
  const currentB={id:'current-b',season:'2026/27',g:2,mpg:12};
  old._grp=[old,currentA,currentB];
  assert.equal(context.currentSeasonProfile(old).id,'current-b');
});


test('profile season cards discover and default to linked DragonsData 2026/27 lines',()=>{
  assert.match(ui,/allPlayersFlat\(\)\.forEach/);
  assert.match(ui,/r\._dragonsData/);
  assert.match(ui,/seasons\.includes\('2026\/27'\)\?'2026\/27'/);
  assert.match(ui,/const value=display\[key\]/);
  assert.match(html,/euroscout-ui\.js\?v=20261008-dashboard-evidence-v9/);
});

test('dashboard defaults to played 2026/27 statistics before qualification thresholds are met',()=>{
  assert.match(ui,/const currentSeason='2026\/27'/);
  assert.match(ui,/esDashboardHasPlayedSeason\(currentVariant,currentSeason\)/);
  assert.match(ui,/ES\.dashboardSeason=currentSeason/);
  assert.match(ui,/ES\.dashboardSeason===currentSeason\?Number\(p\.g\)>0:p\.qualified/);
  assert.match(ui,/new Set\(\[currentSeason,/);
  assert.match(html,/euroscout-ui\.js\?v=20261008-dashboard-evidence-v9/);
});

test('dashboard groups historical and current feeds under one competition choice',()=>{
  assert.match(ui,/function esDashboardCompetitionKey\(league\)/);
  assert.match(ui,/for\(const \[key,items\] of groups\)/);
  assert.match(ui,/esDashboardLeagueForSeason\(group,ES\.dashboardSeason\)/);
  const source=ui.slice(ui.indexOf('function esDashboardCompetitionKey('),ui.indexOf('function renderDashboard('));
  const context={scoutSeason:player=>String(player.statsSeason||player.season||'').replace('-','/')};
  vm.createContext(context);vm.runInContext(source,context);
  const historical={meta:{id:'eurocup',name:'EuroCup',season:'2025/26'},players:[{season:'2025/26',g:30}]};
  const current={meta:{id:'dragons-eurocup',name:'EuroCup',season:'2026/27'},players:[{statsSeason:'2026/27',g:1}]};
  assert.equal(context.esDashboardCompetitionKey(historical),context.esDashboardCompetitionKey(current));
  assert.equal(context.esDashboardLeagueForSeason([historical,current],'2026/27'),current);
  assert.equal(context.esDashboardLeagueForSeason([historical,current],'2025/26'),historical);
});
