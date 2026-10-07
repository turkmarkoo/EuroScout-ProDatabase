const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('euroscout-dragons.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const feed={schema:1,quality_policy:'accepted_live_boxscores_only',leagues:[{meta:{id:'dragons-el-1',privateOwnerFeed:true},players:[]}],fixtures:[]};
function setup(email='markoturk.scouting@gmail.com',internal=true){let calls=0;const access={internal,owner:email==='markoturk.scouting@gmail.com',user:email?{email}:null,get:async()=>{calls++;return{};},field:()=> 'a'.repeat(32),readPayload:async()=>JSON.stringify(feed)};const c={window:{ESAccess:access},ESAccess:access,structuredClone,console};vm.runInNewContext(code,c);return {api:c.window.EuroScoutDragons,calls:()=>calls};}
(async()=>{
 const raw={leagues:[{meta:{id:'historical'},players:[]}],notes:{keep:true}};
 let s=setup('other@example.org');assert.equal((await s.api.apply(raw)).leagues.length,2);assert.equal(s.calls(),1);
 s=setup('other@example.org',false);assert.equal(await s.api.apply(raw),raw);assert.equal(s.calls(),0);
 s=setup(null);assert.equal(await s.api.apply(raw),raw);assert.equal(s.calls(),0);
 s=setup('markoturk.scouting@gmail.com',false);assert.equal(await s.api.apply(raw),raw);assert.equal(s.calls(),0);
 s=setup();let result=await s.api.apply(raw);assert.equal(result.leagues.length,2);assert.equal(raw.leagues.length,1);assert.notEqual(result,raw);assert.notEqual(result.notes,raw.notes);
 result.leagues[0].players.push({name:'Changed'});assert.equal(raw.leagues[0].players.length,0);
 feed.quality_policy='offline';s=setup();assert.equal(await s.api.apply(raw),raw);
 feed.quality_policy='accepted_live_boxscores_only';

 const localFeed={schema:1,quality_policy:'accepted_live_boxscores_only',generated:'2026-10-01T12:00:00Z',leagues:[{meta:{id:'dragons-local-current',privateOwnerFeed:true},players:[]}],fixtures:[]};
 const cloudFeed={schema:1,quality_policy:'accepted_live_boxscores_only',generated:'2026-09-27T12:00:00Z',leagues:[{meta:{id:'dragons-cloud-old',privateOwnerFeed:true},players:[]}],fixtures:[]};
 const localAccess={internal:true,user:{email:'markoturk.scouting@gmail.com'},get:async()=>({}),field:()=> 'a'.repeat(32),readPayload:async()=>JSON.stringify(cloudFeed)};
 const localContext={window:{ESAccess:localAccess},ESAccess:localAccess,structuredClone,console,fetch:async()=>({ok:true,json:async()=>localFeed}),AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(code,localContext);const fresh=await localContext.window.EuroScoutDragons.apply(raw);
 assert.equal(fresh.leagues.at(-1).meta.id,'dragons-local-current');

 const directory={teams:[{code:'LEM',name:'Le Mans Sarthe Basket',aliases:['Le Mans Sarthe']}],roster:[{id:'014866',ids:['eurocup-014866','lnb-9352'],name:'Bastien Grasshoff',born:2007,height:198,position:'Guard',nationality:'France',teamCode:'LEM'}]};
 const live={schema:1,quality_policy:'accepted_live_boxscores_only',generated:'2026-09-30T09:00:00Z',fixtures:[{home:{code:'dd-lem',name:'Le Mans Sarthe Basket'},away:{code:'dd-other',name:'Other Club'}},{comp:'fec',source_url:'https://www.fiba.basketball/en/events/fiba-europe-cup-26-27/games/135695-OLAJ-ZIE',home:{code:'dragons-team-73',name:'NHSZ-Szolnoki Olajbányász'},away:{code:'dragons-team-262',name:'Grono Sportowa Spolka Akcyjna W Restrukturyzacji'}}],leagues:[
  {meta:{id:'dragons-eurocup-26',name:'EuroCup',season:'2026/27',privateOwnerFeed:true},players:[{id:'dragons-eurocup-grasshoff',name:'B. Grasshoff',team:'dd-lem',g:1,ppg:8,gameLog:[]}]},
  {meta:{id:'dragons-lnb-26',name:'Betclic Elite',season:'2026/27',privateOwnerFeed:true},players:[{id:'dragons-lnb-grasshoff',name:'Bastien Grasshoff',team:'dd-lem',teamName:'Le Mans',g:2,ppg:6,gameLog:[]}]}
 ]};
 const access={internal:true,user:{email:'markoturk.scouting@gmail.com'}},events=[];
 const context={window:{ESAccess:access,EUROSCOUT_EUROCUP_ROSTERS:directory,EUROSCOUT_FIBA_CLUB_2026:{teams:[{id:'szolnok',key:'hun|NHS',code:'NHS',officialCode:'OLAJ',name:'NHSZ-Szolnoki Olajbanyasz',aliases:[]},{id:'zastal',key:'plk|OZZ',code:'OZZ',officialCode:'ZIE',name:'Zastal Zielona Gora',aliases:[]}],roster:[]},dispatchEvent:event=>events.push(event.type)},ESAccess:access,structuredClone,console,Event:class Event{constructor(type){this.type=type;}}};vm.runInNewContext(code,context);
 const connected=context.window.EuroScoutDragons.connectData({leagues:[{meta:{id:'lnb'},players:[{id:'lnb-9352',name:'Bastien Grasshoff',league:'lnb'}]}]},live);
 const statLines=connected.leagues.filter(league=>league.meta.privateOwnerFeed).flatMap(league=>league.players);
 assert.equal(statLines.length,2);
 assert.equal(statLines.every(player=>player.linkedEuroScoutId==='lnb-9352'),true);
 assert.equal(statLines.every(player=>player.statsSeason==='2026/27'),true);
 const linked=[];context.window.EuroScoutDragons.link((left,right)=>linked.push([left,right]));
 assert.equal(linked.some(pair=>pair[0]==='dragons-eurocup-grasshoff'&&pair[1]==='lnb-9352'),true);
 assert.equal(linked.some(pair=>pair[0]==='dragons-lnb-grasshoff'&&pair[1]==='lnb-9352'),true);
 assert.equal(live.unresolvedPlayers,0);
 assert.equal(live.fixtures[1].home.key,'hun|NHS');
 assert.equal(live.fixtures[1].away.key,'plk|OZZ');
 assert(events.includes('euroscout-dragons'));
assert.match(html,/euroscout-dragons\.js\?v=20261007-registry-repair/);
 assert.match(html,/raw=await window\.EuroScoutDragons\?\.apply\(raw\)\|\|raw/);
 assert.match(html,/prepareCoreData\(raw,false,false,false\)/);
 assert.match(html,/Never let a large private snapshot win the first-paint race/);
 assert.match(html,/setTimeout\(\(\)=>loadCurrentStatsThenFullCore\(raw\),80\)/);
 assert.match(html,/window\.EuroScoutDragons\?\.link\(uni\)/);

 const manyBase=Array.from({length:15000},(_,i)=>({id:'base-'+i,name:'Player '+i,league:'test'}));manyBase.push({id:'lnb-9352',name:'Bastien Grasshoff',league:'lnb'});
 const manyStats=Array.from({length:3000},(_,i)=>({id:'dragons-speed-'+i,name:'B. Grasshoff',team:'dd-lem',teamName:'Le Mans',g:1,gameLog:[]}));
 const speedFeed={...live,leagues:[{meta:{id:'dragons-speed',name:'EuroCup',season:'2026/27',privateOwnerFeed:true},players:manyStats}]};
 const started=Date.now();context.window.EuroScoutDragons.connectData({leagues:[{meta:{id:'test'},players:manyBase}]},speedFeed);const elapsed=Date.now()-started;
 assert(elapsed<2000,'DragonsData identity linking should use one shared player index; took '+elapsed+' ms');
 console.log('Approved reader access, blocked external access, snapshot isolation and rejected-feed tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
