const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {window:{}, structuredClone, canonKey:value=>value, console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('eurocup-rosters-2026.js','utf8'),context);
vm.runInContext(fs.readFileSync('euroscout-eurocup-rosters.js','utf8'),context);

const data=context.window.EUROSCOUT_EUROCUP_ROSTERS;
const api=context.window.EuroScoutEuroCup;
assert.equal(data.season,'2026/27');
assert.equal(data.teams.length,32);
assert.equal(data.roster.length,469);
assert.equal(new Set(data.roster.map(row=>row.ids[0])).size,data.roster.length);
assert.equal(data.teams.some(team=>/bosna/i.test(team.name)),true);
assert.equal(data.teams.some(team=>team.name.includes('Monaco')),false);

const leMans=data.roster.filter(row=>row.teamCode==='LEM');
assert.equal(leMans.length,14);
for(const name of ['Carlos Stewart','Bastien Grasshoff','Swann Penda','Melvin Ajinca','Tashawn Thomas']){
  assert.equal(leMans.some(row=>row.name===name),true,`${name} is linked to the official Le Mans roster`);
}
const grasshoff=leMans.find(row=>row.name==='Bastien Grasshoff');
assert.equal(grasshoff.ids.includes('lnb-9352'),true);

const links=[];api.link((left,right)=>links.push([left,right]));
assert.equal(links.some(pair=>pair[0]==='eurocup-014866'&&pair[1]==='lnb-9352'),true);

const raw={leagues:[
  {meta:{id:'eurocup'},teams:[],players:[]},
  {meta:{id:'lnb'},teams:[],players:[{id:'lnb-9352',name:'Bastien Grasshoff',league:'lnb'}]}
]};
api.apply(raw);
assert.equal(raw.leagues[0].players.length,469);
assert.equal(raw.leagues[1].players[0].currentClub,'Le Mans Sarthe Basket');
assert.equal(api.key(raw.leagues[1].players[0]),'lnb|LEM');
assert.equal(raw.season2627.comps.eurocup.teams.length,32);

const html=fs.readFileSync('index.html','utf8');
assert.match(html,/eurocup-rosters-2026\.js\?v=20260930-full/);
assert.match(html,/euroscout-eurocup-rosters\.js\?v=20260930-full/);
assert.match(html,/EuroScoutEuroCup\?\.apply\(raw\)/);
assert.match(html,/EuroScoutEuroCup\?\.key\(p\)/);

console.log('Official 2026/27 EuroCup roster coverage checks passed.');
