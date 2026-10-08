const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('euroscout-dragons.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const feed={schema:1,quality_policy:'accepted_live_boxscores_only',leagues:[{meta:{id:'dragons-el-1',privateOwnerFeed:true},players:[]}],fixtures:[]};
function setup(email='markoturk.scouting@gmail.com',internal=true){let calls=0;const access={internal,owner:email==='markoturk.scouting@gmail.com',user:email?{email}:null,get:async()=>{calls++;return{};},field:()=> 'a'.repeat(32),readPayload:async()=>JSON.stringify(feed)};const c={window:{ESAccess:access},ESAccess:access,structuredClone,console,setTimeout,clearTimeout};vm.runInNewContext(code,c);return {api:c.window.EuroScoutDragons,calls:()=>calls};}
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
 let localCalls=0;
 const localContext={window:{ESAccess:localAccess},ESAccess:localAccess,structuredClone,console,fetch:async()=>{localCalls++;return {ok:true,json:async()=>localFeed}},AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(code,localContext);const fresh=await localContext.window.EuroScoutDragons.apply(raw);
 assert.equal(fresh.leagues.at(-1).meta.id,'dragons-cloud-old');
 assert.equal(localCalls,0,'the hosted app must not probe localhost automatically');

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
assert.match(html,/euroscout-dragons\.js\?v=20261008-full-player-identity-v11/);
 assert.doesNotMatch(code,/Promise\.race\(\[localPromise/);
 assert.doesNotMatch(code,/data-dd-check|Check latest/);
 assert.match(code,/Update stats ↗/);
 assert.match(code,/Cloud sync ↗/);
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
 const bioRaw={leagues:[{meta:{id:'acb'},teams:[{code:'UNI',name:'Unicaja',logo:'club.png'}],players:[{id:'acb-diaz',name:'Alberto Díaz',born:1994,height:190,weight:90,age:32,country:'Spain',role:'Guard',img:'headshot.png',team:'UNI',teamName:'Unicaja',league:'acb'},{id:'acb-smith-1',name:'Alex Smith',born:1995,team:'UNI',teamName:'Unicaja',league:'acb'},{id:'acb-smith-2',name:'Adam Smith',born:1995,team:'UNI',teamName:'Unicaja',league:'acb'}]}]};
 const abbreviated={...live,fixtures:[],leagues:[{meta:{id:'dragons-acb-test',name:'Spain ACB',season:'ACB 2026/27',privateOwnerFeed:true},teams:[{code:'dd-uni',name:'Unicaja'}],players:[{id:'dragons-diaz',name:'A. Díaz',team:'dd-uni',teamName:'Unicaja',g:2,ppg:9,gameLog:[['2026-10-04']]},{id:'dragons-smith',name:'A. Smith',team:'dd-uni',teamName:'Unicaja',g:1,ppg:4,gameLog:[]},{id:'dragons-wrong-year',name:'A. Díaz',born:2001,team:'dd-uni',teamName:'Unicaja',g:1,gameLog:[]}]}]};
 const before=JSON.stringify(bioRaw),enriched=context.window.EuroScoutDragons.connectData(bioRaw,abbreviated),stats=enriched.leagues.at(-1).players;
 assert.equal(stats[0].name,'Alberto Díaz');assert.equal(stats[0].height,190);assert.equal(stats[0].weight,90);assert.equal(stats[0].age,32);assert.equal(stats[0].country,'Spain');assert.equal(stats[0].img,'headshot.png');assert.equal(stats[0].g,2);assert.equal(stats[0].ppg,9);assert.equal(context.window.EuroScoutDragons.key(stats[0]),'acb|UNI');assert.equal(stats[1].linkedEuroScoutId,undefined);assert.equal(stats[2].linkedEuroScoutId,undefined);assert.equal(JSON.stringify(bioRaw),before);

 context.window.EUROSCOUT_ACB_IDENTITY_FIXES=[{code:'test-olaseni',name:'Gabriel Olaseni',born:1991,height:208,country:'United Kingdom',role:'Big',img:'verified.png',feedAliases:['A. Olaseni'],feedTeam:'Unicaja',source:'https://acb.com/verified'}];
 const supplementFeed={...abbreviated,leagues:[{...abbreviated.leagues[0],players:[{id:'dragons-verified',name:'A. Olaseni',teamName:'Unicaja',g:1,ppg:7,gameLog:[]},{id:'dragons-other-team',name:'A. Olaseni',teamName:'Other Club',g:1},{id:'dragons-conflicting-birth',name:'A. Olaseni',teamName:'Unicaja',born:2000,g:1}]}]};
 const verified=context.window.EuroScoutDragons.connectData(bioRaw,supplementFeed).leagues.at(-1).players;assert.equal(verified[0].name,'Gabriel Olaseni');assert.equal(verified[0].img,'verified.png');assert.equal(verified[0].country,'United Kingdom');assert.equal(verified[0].linkedEuroScoutId,undefined);assert.equal(verified[0].g,1);assert.equal(verified[0].ppg,7);assert.equal(context.window.EuroScoutDragons.key(verified[0]),'acb|UNI');assert.equal(verified[1].name,'A. Olaseni');assert.equal(verified[2].name,'A. Olaseni');
 supplementFeed.leagues[0].meta.season='2025/26';assert.equal(context.window.EuroScoutDragons.connectData(bioRaw,supplementFeed).leagues.at(-1).players[0].name,'A. Olaseni');
 const metadata={window:{}};vm.runInNewContext(fs.readFileSync('data/acb-verified-identities-20261008.js','utf8'),metadata);assert.equal(metadata.window.EUROSCOUT_ACB_IDENTITY_FIXES.length,27);assert.ok(metadata.window.EUROSCOUT_ACB_IDENTITY_FIXES.every(p=>p.source.startsWith('https://acb.com/')&&p.img.startsWith('https://static.acb.com/')&&p.birthDate&&p.country));
 console.log('Approved reader access, blocked external access, snapshot isolation and rejected-feed tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
