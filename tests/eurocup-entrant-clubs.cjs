const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={window:{},structuredClone,canonKey:k=>k};vm.createContext(context);
for(const f of ['eurocup-rosters-2026.js','euroscout-eurocup-rosters.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context);
const {EuroScoutEuroCup:api,EUROSCOUT_EUROCUP_ROSTERS:data}=context.window;
const oldClub={code:'EXISTING',name:'Keep historical entrant',country:'Italy'},oldPlayer={id:'keep-player',name:'Keep Player',g:10};
const raw={leagues:[{meta:{id:'historical'},teams:[{code:'OLD',name:'Historical team'}],players:[oldPlayer]},{meta:{id:'n2627',teamsOnly:true,excludeFromStats:true},teams:[oldClub],players:[]}],notes:{private:'Do not change'},season2627:{comps:{other:{name:'Other',teams:[{key:'historical|OLD'}]}}}};
const before=JSON.stringify({club:oldClub,player:oldPlayer,notes:raw.notes,other:raw.season2627.comps.other});
api.apply(raw);api.apply(raw);
const entries=raw.leagues.find(l=>l.meta.id==='n2627');assert.equal(entries.teams.length,4);assert.equal(entries.players.length,0);
assert.equal(JSON.stringify({club:oldClub,player:oldPlayer,notes:raw.notes,other:raw.season2627.comps.other}),before);
for(const team of data.teams.filter(t=>t.key.startsWith('n2627|'))){const rows=entries.teams.filter(t=>'n2627|'+t.code===team.key);assert.equal(rows.length,1);assert.equal(rows[0].name,team.name);assert.equal(rows[0].country,team.country);assert.equal(rows[0].logo,team.logo);}
const lemar=data.roster.find(r=>r.name==='Brynton Lemar');assert.equal(api.key({id:lemar.ids[0]}),'n2627|MR');assert.equal(lemar.number,'11');
const empty={leagues:[]};api.apply(empty);const created=empty.leagues.find(l=>l.meta.id==='n2627');assert.equal(created.meta.teamsOnly,true);assert.equal(created.meta.excludeFromStats,true);assert.equal(created.players.length,0);
console.log('PASS official EuroCup entrants register once with stable keys; source club rows, notes, historic stats and other competitions preserved; entrants add no stat lines.');
