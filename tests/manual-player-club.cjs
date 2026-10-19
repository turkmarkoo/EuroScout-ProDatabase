const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('euroscout-manual-players.js','utf8'),record={id:'custom-fixture',name:'Fixture Player',born:1999,_manualClubKey:'old|roma',teamName:'Maxima Roma'};
function device(rows){const stored=JSON.stringify(rows),c={window:{},localStorage:{getItem:()=>stored},canonKey:k=>k==='old|roma'?'current|roma':k};vm.createContext(c);vm.runInContext(source,c);return c.window.EuroScoutManualPlayers;}
const api=device([record]),raw={leagues:[],notes:{keep:'Existing scouting note'}};api.apply(raw);api.apply(raw);
assert.equal(raw.leagues[0].players.filter(p=>p.id===record.id).length,1);assert.equal(api.key(raw.leagues[0].players.find(p=>p.id===record.id)),'current|roma');assert.equal(raw.notes.keep,'Existing scouting note');
assert.equal(api.key({id:record.id}),'current|roma');assert.equal(api.key({id:'other',_grp:[record]}),'current|roma');assert.equal(api.key({id:'other'}),null);assert.equal(api.key({id:'custom-nathan-soliman'}),null,'A historic team name alone cannot assign a current club');
assert.equal(device(JSON.parse(JSON.stringify([record]))).key({id:record.id}),'current|roma','A synced manual-player record carries its club to another device');
assert.equal(device([{id:'custom-no-club',name:'No Club'}]).key({id:'custom-no-club'}),null);
console.log('PASS a manual player and current club share one saved record; reload/device sync restores assignment; original notes and historic club names stay untouched.');
