const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('euroscout-dragons.js','utf8');
const feed={schema:1,quality_policy:'accepted_live_boxscores_only',leagues:[{meta:{id:'dragons-el-1',privateOwnerFeed:true},players:[]}],fixtures:[]};
function setup(email='markoturk.scouting@gmail.com',internal=true){let calls=0;const access={internal,owner:true,user:{email},get:async()=>{calls++;return{};},field:()=> 'a'.repeat(32),readPayload:async()=>JSON.stringify(feed)};const c={window:{ESAccess:access},ESAccess:access,structuredClone,console};vm.runInNewContext(code,c);return {api:c.window.EuroScoutDragons,calls:()=>calls};}
(async()=>{
 const raw={leagues:[{meta:{id:'historical'},players:[]}],notes:{keep:true}};
 let s=setup('other@example.org');assert.equal(await s.api.apply(raw),raw);assert.equal(s.calls(),0);
 s=setup('markoturk.scouting@gmail.com',false);assert.equal(await s.api.apply(raw),raw);assert.equal(s.calls(),0);
 s=setup();let result=await s.api.apply(raw);assert.equal(result.leagues.length,2);assert.equal(raw.leagues.length,1);assert.notEqual(result,raw);assert.notEqual(result.notes,raw.notes);
 result.leagues[0].players.push({name:'Changed'});assert.equal(raw.leagues[0].players.length,0);
 feed.quality_policy='offline';s=setup();assert.equal(await s.api.apply(raw),raw);
 console.log('Owner-only access, snapshot isolation and rejected-feed tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
