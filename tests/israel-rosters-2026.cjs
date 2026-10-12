const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const data=read('data/israel-rosters-2026.json'),raw=read('data/data.json'),before=structuredClone(raw);
assert.equal(data.teams.length,14);assert.equal(data.roster.length,219);assert.equal(new Set(data.roster.map(r=>r.id)).size,219);
const ids=new Map();for(const r of data.roster){assert(r.born&&r.height&&r.country&&r.position&&r.profile);assert(data.teams.some(t=>t.id===r.teamId));for(const id of r.ids){assert(!ids.has(id),'Alias claimed by different people: '+id);ids.set(id,r.id);}}
const ctx={window:{EUROSCOUT_ISRAEL_2026:data},canonKey:x=>x,structuredClone};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'euroscout-israel-rosters.js'),'utf8'),ctx);const api=ctx.window.EuroScoutIsrael;
const saved=raw.leagues.find(l=>l.meta.id==='il').players[0];saved.notes=['Keep my observation'];saved.rating=4;saved.manualLevel='EuroCup';saved.overrides={hand:'Left'};const privateSnapshot=JSON.stringify([saved.notes,saved.rating,saved.manualLevel,saved.overrides]);
api.apply(raw);api.apply(raw);const L=raw.leagues.find(l=>l.meta.id==='il');assert.equal(L.players.length,304+219,'Idempotent import');assert.equal(L.meta.season,'2025-26');assert.equal(raw.domestic2627.leagues.il.teams.length,14);
for(const old of before.leagues.flatMap(l=>l.players)){const now=raw.leagues.flatMap(l=>l.players).find(p=>p.id===old.id);for(const key of ['g','mpg','min','ppg','rpg','apg','pir','gameLog','pct','z','arch'])assert.deepEqual(now[key],old[key],'Historical statistics changed: '+old.id+' '+key);}
assert.equal(JSON.stringify([saved.notes,saved.rating,saved.manualLevel,saved.overrides]),privateSnapshot);
const current=L.players.filter(p=>p._israelCurrent);assert.equal(current.length,219);assert.equal(current.filter(p=>Number(p.g)>0).length,83);assert.equal(current.filter(p=>p._rosterOnly).length,136);
for(const p of current.filter(p=>p._rosterOnly)){assert.equal(p.g,null);assert.equal(p.ppg,undefined);assert.equal(p.pir,undefined);}
const c=current.find(p=>p.name==='Christian Coleman');assert.equal(c.born,2000);assert.equal(c.role,'Forward');assert.equal(c.height,203);assert.equal(c.currentClub,'Hapoel Altshuler Shaham Beer Sheva/Dimona');assert.equal(c.ppg,24);assert.equal(c.rpg,16);assert.equal(c.apg,3);assert.equal(c.pir,32);assert.equal(c.gameLog[0][0],'2026-10-11');assert.equal(c.gameLog[0][4],82);assert.equal(c.gameLog[0][5],95);assert.equal(c.gameLog[0][3],false);
const pairs=[];api.link((a,b)=>pairs.push([a,b]));assert(pairs.some(([a,b])=>a===c.id&&b==='ncaam-1934'));assert.equal(api.key({id:'ncaam-1934'}),'il|BSH');
assert.equal(c.gameLog.length,1,'Cup games must not enter league averages');
console.log('PASS 14 complete official rosters / 219 active profiles / 83 published league stat lines; identity aliases unique, import idempotent, old statistics and private fields preserved, Coleman history and league game verified.');

