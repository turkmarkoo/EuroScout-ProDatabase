const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g,'\n');
const live = fs.readFileSync(path.join(root, 'euroscout-live-notes.js'), 'utf8');
const primary = html.slice(html.indexOf('function manual26Key('), html.indexOf('function set26b('));
const matchup = live.slice(live.indexOf('function buildClubIndex('), live.indexOf('function liveRoster('));
const player = {id:'aba-2594', group:'aba-2594', name:'Petar Popović', _grp:[{id:'slo-0174'}]};
const free = '__free_agent', retired = '__retired', ilirija = 'aba|ILI';
const club = {key:ilirija, name:'Perspektiva Ilirija', teams:[]};
let assignments = {}, automated = {}, secondary = {'aba-2594':'gleague|TEST'};
let memberships = {aba:ilirija, usa:[]};
const ctx = vm.createContext({
  window: {
    dispatchEvent: () => {},
    EuroScoutABA: {key:() => memberships.aba},
    EuroScoutUSARosters: {key:() => memberships.usa[0],keys:() => memberships.usa},
  },
  localStorage: {setItem:() => {}},
  AUTO_APPLIED_KEY:'auto', STATUS_FREE:free, STATUS_RETIRED:retired, Event,
  gid:p => p.group || p.id, player:id => id === player.id ? player : null,
  canonKey:x => x, isStatus:x => [free,retired].includes(x),
  readAssignmentMap:() => automated,
  next26Get:() => ({...assignments}), next26Set:value => { assignments = value; },
  next26bGet:() => ({...secondary}), next26bSet:value => { secondary = value; },
  autoAppliedGet:() => ({...automated}), autoAppliedSet:value => { automated = value; },
  assignPool:() => [player], allClubs:() => [club], fold:x => String(x).toLowerCase(),
  officialDirectories:() => [{teams:[{id:'92',key:ilirija,name:club.name}],roster:[{teamId:'92',ids:[player.id]}]}],
  addClubPlayer:(index,seen,key,p) => index.set(key,p.id),
});
// Keep the production readers and write path while replacing storage adapters.
const code = primary.replace(/function next26bGet\(\).*?\nfunction next26bSet\([\s\S]*?(?=\n\/\/ league id)/, '');
vm.runInContext(code + '\n' + matchup, ctx);

assert.equal(ctx.effective26(player), ilirija);
assert.equal(ctx.buildClubIndex().get(ilirija), player.id);
ctx.set26(player.id,free);
assert.equal(assignments[player.id], free);
assert.equal(ctx.effective26(player), free);
assert.deepEqual(Array.from(ctx.effective26keys(player)), []);
assert.equal(ctx.buildClubIndex().has(ilirija), false);
assert.equal(secondary[player.id], undefined);

// A synced import marker on an alternate profile must not suppress a manual choice.
assignments['slo-0174'] = ilirija;
automated['slo-0174'] = 'imported';
assert.equal(ctx.effective26(player), free);
assert.equal(ctx.buildClubIndex().has(ilirija), false);
ctx.set26(player.id,'bcl|NEW');
assert.equal(ctx.effective26(player),'bcl|NEW');
assert.equal(ctx.buildClubIndex().has(ilirija),false);
ctx.set26(player.id,retired);
assert.deepEqual(Array.from(ctx.effective26keys(player)),[]);
ctx.set26(player.id,'');
assert.equal(ctx.effective26(player),ilirija);
assert.equal(ctx.buildClubIndex().get(ilirija),player.id);
memberships = {aba:null,usa:['nba|TEST','gleague|TEST']};
assert.deepEqual(Array.from(ctx.effective26keys(player)),memberships.usa);
console.log('Manual availability takes precedence in the profile, current roster and matchup.');
