const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={window:{},structuredClone,console,Event:class{},setTimeout};vm.createContext(c);
for(const f of ['official-rosters-2026.js','data/fiba-club-competitions-2026.js','euroscout-fiba-club-competitions.js','euroscout-dragons.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const pack=c.window.EUROSCOUT_FIBA_CLUB_2026,raw={notes:{keep:{text:'Preserve private notes',rating:5}},leagues:[]};c.window.EuroScoutFIBAClub.apply(raw);
const feed=(url,comp,code,name='Unidentified legal company')=>({fixtures:[{id:'game-'+comp,comp,compName:comp,league_id:'dragons-'+comp+'-test',date:'2026-11-17',home:{code,name,key:'bcl|NYMB'},away:{code:'opponent',name:'Opponent'},hs:74,as:70,played:true,source_url:url}],leagues:[{meta:{id:'dragons-'+comp+'-test',season:'2026/27'},teams:[{code,name}],players:[]}]});
const bcl=feed('https://www.championsleague.basketball/en/games/123-AEK-FCP','bcl','shared','AEK'),fec=feed('https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/games/456-AEK-KERAV','fec','shared','AEK');
const data={fixtures:[...bcl.fixtures,...fec.fixtures],leagues:[...bcl.leagues,...fec.leagues]},before=JSON.stringify(raw);
c.window.EuroScoutDragons.connectData(raw,data);assert.equal(JSON.stringify(raw),before);
assert.equal(c.window.EuroScoutDragons.clubKey('dragons-bcl-test|shared'),'bcl26|AEK');
assert.equal(c.window.EuroScoutDragons.clubKey('dragons-fec-test|shared'),'fec26|AEK','The same code/name in two competitions must remain distinct');
assert.equal(c.window.EuroScoutDragons.clubPairs().length,2);
const api=c.window.EuroScoutDragons,clubs=pack.teams.map(t=>({key:t.currentKey,name:t.name}));
Object.assign(c,{STATE:{data:raw},allClubs:()=>clubs,canonKey:k=>k,clubByKey:k=>clubs.find(t=>t.key===k),dbTeamByKey:k=>clubs.find(t=>t.key===k),localStorage:{getItem:()=>null,setItem:()=>assert.fail('Do not cache private fixtures')},EuroScoutDragons:{active:()=>true,fixtures:()=>data.fixtures}});
Object.assign(c.window,{EuroScoutDragons:c.EuroScoutDragons,dispatchEvent(){},addEventListener(){}});
vm.runInContext(fs.readFileSync('euroscout-fixtures.js','utf8'),c);
assert.equal(c.window.ESFixtures.all().find(g=>g.comp==='bcl').home.key,'bcl26|AEK','Official BCL URL outranks a stale saved key');
assert.equal(c.window.ESFixtures.all().find(g=>g.comp==='fec').home.key,'fec26|AEK');
const untrusted=feed('https://example.invalid/en/games/123-AEK-FCP','bcl','unknown');api.connectData(raw,untrusted);assert.equal(api.clubKey('dragons-bcl-test|unknown'),null);assert.equal(api.clubPairs().length,0,'An unrelated host cannot supply official identity evidence');
const conflict=feed('https://www.championsleague.basketball/en/games/123-AEK-FCP','bcl','conflict');
conflict.fixtures.push({...structuredClone(conflict.fixtures[0]),source_url:'https://www.championsleague.basketball/en/games/124-FCP-AEK'});
api.connectData(raw,conflict);assert.equal(api.clubKey('dragons-bcl-test|conflict'),null);assert.equal(api.clubPairs().length,0,'Conflicting official team codes must not merge clubs');
console.log('PASS competition-scoped FIBA identities, official BCL fixture precedence, trusted hosts, conflicting evidence and private note preservation.');

// Exercise actual registry construction: provider aliases must not remain as
// additional club entries even when their legal names share no text.
const html=fs.readFileSync('index.html','utf8'),normal=v=>String(v||'').toLowerCase().replace(/[^a-z0-9 ]/g,'');
const reg=vm.createContext({window:{EuroScoutDragons:{clubPairs:()=>[['dragons-bcl-test|shared','bcl26|AEK'],['dragons-fec-test|shared','fec26|AEK']]}},STATE:{data:{}},normClub:normal,normName:normal,separateFrankfurtSquads:()=>false,clubMatchIndex:()=>()=>false,DBTEAM_LIST:[['bcl26|AEK','AEK BC'],['dragons-bcl-test|shared','Athens legal company'],['fec26|AEK','Petrolina AEK'],['dragons-fec-test|shared','Larnaca legal company']].map(([key,name])=>({key,name,lg:key.split('|')[0]}))});
vm.runInContext(html.slice(html.indexOf('const FRENCH_CLUB_KEYS'),html.indexOf('const FRANKFURT_SENIOR_KEYS'))+html.slice(html.indexOf('function buildClubs('),html.indexOf('function allClubs(')),reg);
const registry=reg.buildClubs();assert.equal(registry.length,2);assert.ok(registry.every(club=>club.teams.length===2));
console.log('PASS one registry entry per verified club, with Athens and Larnaca kept separate.');
