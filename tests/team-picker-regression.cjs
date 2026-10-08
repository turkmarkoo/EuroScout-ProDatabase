const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'euroscout-live-notes.js'), 'utf8');
const picker = fs.readFileSync(path.join(root, 'team-selection-workspace-20261007d.js'), 'utf8');

assert.match(html, /team-selection-workspace\.css\?v=20260930-1/);
assert.match(html, /data\/competition-assets\.js\?v=20261007-picker-leagues/);
assert.match(html, /team-selection-workspace-20261007d\.js\?v=20261008-select-fast/);
assert.match(html, /euroscout-live-notes\.js\?v=20261008-team-key/);
assert.ok(html.indexOf('team-selection-workspace-20261007d.js') < html.indexOf('euroscout-live-notes.js'));
assert.ok(html.indexOf('data/competition-assets.js') < html.indexOf('team-selection-workspace-20261007d.js'));
assert.match(notes, /class="scoutTeamButton"/);
assert.match(notes, /ESTeamSelection\.open\(\{slot,currentKey:s\[slot\]/);
assert.match(notes, /const key=canonKey\(team\.key\)/);
assert.match(picker, /Loading competitions and current rosters/);
assert.match(picker, /competitionCache/);
assert.match(notes, /id="mxPosition"/);
assert.match(notes, /\['Guard','Forward','Big'\]/);
assert.match(notes, /Position saved to player profile/);
assert.match(notes, /ovrSaveLocal\(\{bio:\{\[gid\(p\)\|\|p\.id\]:\{role,pos\}\}\}\)/);
assert.doesNotMatch(notes, /class="scoutTeamSel"/);
assert.match(picker, /1\. Select Competition/);
assert.match(picker, /2\. Select Team/);
assert.match(picker, /selectedComp\.teams\.filter/);

new vm.Script(notes);
new vm.Script(picker);

const clubs=[
 {key:'fec|BAT',name:'BC Batumi 2010',country:'Georgia',leagues:[{id:'fec',name:'FIBA Europe Cup'}],teams:[{lg:'fec',name:'BC Batumi 2010'}]},
 {key:'fec26|BAT',name:'BC Batumi 2010',country:'Georgia',leagues:[{id:'fec26',name:'FIBA Europe Cup 2026/27'}],teams:[{lg:'fec26',name:'BC Batumi 2010',logo:'batumi.png'}]},
 {key:'fec|PAR',name:'BC Parnu',country:'Estonia',leagues:[{id:'fec',name:'FIBA Europe Cup'}],teams:[{lg:'fec',name:'BC Parnu'}]},
 {key:'fec26|PAR',name:'BC Pärnu',country:'Estonia',leagues:[{id:'fec26',name:'FIBA Europe Cup 2026/27'}],teams:[{lg:'fec26',name:'BC Pärnu',logo:'parnu.png'}]},
 {key:'aba2|KAN',name:'Kansai Helios Domžale',country:'Slovenia',leagues:[{id:'aba2',name:'ABA League 2'}],teams:[{lg:'aba2',name:'Kansai Helios Domžale',logo:'helios.png'}]},
 {key:'directory|bahrain-a',name:'Al Manama',country:'Bahrain',leagues:[{id:'directory',name:'Bahrain · Premier League'}],teams:[{lg:'directory',lgName:'Bahrain · Premier League'}]},
 {key:'directory|bahrain-b',name:'Al Muharraq',country:'Bahrain',leagues:[{id:'directory',name:'Bahrain · Premier League'}],teams:[{lg:'directory',lgName:'Bahrain · Premier League'}]},
 {key:'directory|france-a',name:'Denain Voltaire',country:'France',leagues:[{id:'directory',name:'France · Élite 2'}],teams:[{lg:'directory',lgName:'France · Élite 2'}]},
 {key:'directory|germany-a',name:'Artland Dragons',country:'Germany',leagues:[{id:'directory',name:'Germany · ProA'}],teams:[{lg:'directory',lgName:'Germany · ProA'}]},
 {key:'lba|BDBT',name:'Derthona Basket',country:'Italy',leagues:[{id:'lba',name:'Lega A'}],teams:[{lg:'lba',name:'Derthona Basket',logo:'derthona.png'}]}
];
const context={window:{STATE:{data:{leagues:[{meta:{id:'fec',name:'FIBA Europe Cup'},teams:[]},{meta:{id:'eurocup',name:'EuroCup'},teams:[{code:'OLD',name:'Legacy Club',country:'Spain',logo:'legacy.png'}]},{meta:{id:'aba2',name:'ABA League 2',country:'Croatia'},teams:[]},{meta:{id:'bclq',name:'BCL Qualifiers'},teams:[]},{meta:{id:'bbl',name:'German BBL'},teams:[{code:'BER',name:'ALBA Berlin',country:'Germany',logo:'alba.png'},{code:'BAM',name:'Bamberg Baskets',country:'Germany',logo:'bamberg.png'}]},{meta:{id:'lnb',name:'Betclic Elite'},teams:[{code:'PAR',name:'Paris Basketball',country:'France',logo:'paris.png'},{code:'LEM',name:'Le Mans Sarthe Basket',country:'France',logo:'lemans.png'}]},{meta:{id:'bnxt',name:'BNXT League'},teams:[{code:'ANT',name:'Giants Antwerp',country:'Belgium',logo:'antwerp.png'},{code:'OOS',name:'Filou Oostende',country:'Belgium',logo:'oostende.png'}]},{meta:{id:'gleague',name:'NBA G League',region:'International'},teams:[{code:'CAP',name:'Capital City Go-Go',country:'United States',logo:'cap.png'}]},{meta:{id:'seriea2',name:'Serie A2 (Italy)'},teams:[]}],season2627:{comps:{fec:{name:'FIBA Europe Cup',teams:[{key:'fec|BAT'},{key:'fec|PAR'},{key:'fec|OLD'}]},eurocup:{name:'EuroCup',teams:[{key:'eurocup|OLD',name:'Legacy Club'},{key:'new|ONE',name:'New Club One',country:'France'},{key:'new|TWO',name:'New Club Two',logo:'two.png'},{key:'lba|BDBT',name:'Baglietto Derthona Tortona'}]}}}}},EuroScoutFIBAClub:{data:{competitions:{fec:{name:'FIBA Europe Cup',teams:[{currentKey:'fec26|BAT',name:'BC Batumi 2010',country:'Georgia',logo:'batumi.png'},{currentKey:'fec26|PAR',name:'BC Pärnu',country:'Estonia',logo:'parnu.png'}]}}}},EUROSCOUT_ABA_ROSTERS:{teams:[]},EUROSCOUT_BCLQ_2026:{teams:[{code:'BAT',name:'BC Batumi 2010',country:'Georgia',logo:'batumi.png'},{code:'PAR',name:'BC Pärnu',country:'Estonia',logo:'parnu.png'}]}},allClubs:()=>clubs,clubByKey:key=>clubs.find(c=>c.key===key)||null,showsTeams:()=>true,console};
context.window.window=context.window;Object.assign(context,context.window);vm.createContext(context);vm.runInContext(picker,context);
const competitions=context.window.ESTeamSelection._buildCompetitions();
const fec=competitions.find(c=>c.id==='fec');
assert.equal(fec.teams.length,2,'current FIBA field replaces historical keys instead of doubling it');
assert.ok(fec.teams.every(team=>team.teams.some(row=>row.logo)),'current FIBA teams retain their official logos');
assert.equal(competitions.find(c=>c.id==='eurocup').teams.length,4,'all current EuroCup entries survive unresolved legacy keys');
assert.equal(competitions.find(c=>c.id==='eurocup').teams.find(team=>/Derthona/.test(team.name)).key,'lba|BDBT','EuroCup returns the canonical domestic club key used by the live roster');
assert.equal(context.window.ESTeamSelection._buildCompetitions(),competitions,'reopening the picker reuses the current competition index');
assert.equal(competitions.find(c=>c.id==='aba2').region,'International','ABA2 is always presented as a regional competition');
assert.equal(competitions.find(c=>c.id==='aba2').teams.length,16,'ABA2 uses the official current regional field');
assert.ok(competitions.find(c=>c.id==='aba2').teams.every(team=>team.logo),'official ABA2 badges are retained');
assert.equal(competitions.filter(c=>c.id==='bclq').length,1,'BCL qualifier labels merge into one competition');
assert.equal(competitions.find(c=>c.id==='bclq').teams.length,2,'official qualifier field replaces duplicate membership lists');
assert.equal(competitions.find(c=>c.name==='Bahrain · Premier League').teams.length,2);
assert.equal(competitions.find(c=>c.name==='France · Élite 2').teams.length,1);
assert.equal(competitions.find(c=>c.name==='Germany · ProA').teams.length,1);
assert.equal(competitions.find(c=>c.id==='bbl').teams.length,2,'domestic league feed supplies its complete team list');
assert.ok(competitions.find(c=>c.id==='bbl').teams.every(team=>team.logo),'domestic league badges survive club consolidation');
assert.equal(competitions.find(c=>c.id==='lnb').teams.length,2,'Betclic Élite clubs come from the loaded league feed');
assert.ok(competitions.find(c=>c.id==='lnb').teams.every(team=>team.logo));
assert.equal(competitions.find(c=>c.id==='bnxt').teams.length,2,'BNXT teams come from the loaded league feed');
assert.ok(competitions.find(c=>c.id==='bnxt').teams.every(team=>team.logo));
assert.equal(competitions.find(c=>c.id==='gleague').region,'United States','NBA G League is labelled as a US competition');
assert.equal(competitions.filter(c=>c.id==='seriea2').length,1,'Serie A2 aliases merge into one competition');
assert.equal(competitions.find(c=>c.id==='seriea2').teams.length,20,'Serie A2 uses the official 2026/27 field');
assert.ok(competitions.find(c=>c.id==='seriea2').teams.every(team=>team.logo),'official Serie A2 badges are retained');
assert.ok(fs.existsSync(path.join(root,'assets','competitions','fiba-europe-cup.png')));
console.log('Competition-first scouting matchup team picker checks passed.');
