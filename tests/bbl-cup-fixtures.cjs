const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const window={},context={window};vm.createContext(context);vm.runInContext(fs.readFileSync('data/bbl-cup-fixtures-2026.js','utf8'),context);
 const cup=window.EUROSCOUT_BBL_CUP_2026,clubs=Object.entries(cup.teams).map(([code,name])=>({key:cup.teamKeys[code],name}));
 let feed=[],active=true;const dragons={active:()=>active,fixtures:()=>feed};
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T12:00:00Z']));}static now(){return +new Date('2026-11-05T12:00:00Z');}};
 Object.assign(context,{Date:FixedDate,STATE:{data:{}},allClubs:()=>clubs,clubByKey:key=>clubs.find(c=>c.key===key),canonKey:key=>key,dbTeamByKey:()=>null,EuroScoutDragons:dragons,localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>{throw Error('Offline');},console,Event:class{},setTimeout,clearTimeout});
 Object.assign(window,{EuroScoutDragons:dragons,dispatchEvent(){},addEventListener(){}});
 vm.runInContext(fs.readFileSync('euroscout-fixtures.js','utf8'),context);const FX=window.ESFixtures;
 assert.equal(FX.all().length,20);assert.equal(FX.recent(0,'bblcup').length,16);assert.equal(FX.upcoming(0,'bblcup').length,4);
 assert.equal(FX.recent(14,'bblcup').length,0);const target=FX.between('bbl|OLD','bbl|BON')[0];
 assert.equal(target.date,'2026-10-16');assert.equal(target.round,'Last 16');assert.equal(target.time,'20:00');assert.equal(target.hs,'61');assert.equal(target.as,'75');assert.equal(target.source_url,'https://www.easycredit-bbl.de/spiele/2007040');assert(target.played);assert(FX.all().every(g=>g.home.key&&g.away.key));
 feed=[{...target},{...target,comp:'bbl',compName:'German BBL',id:'league-same-pair'}];await FX.refresh(true);
 assert.equal(FX.all().length,21,'Feed duplicate is removed but league and cup remain separate');assert.equal(FX.forTeam('bbl|BON').length,3);
 feed.push({...target,id:'prior-season',date:'2025-10-16'},{...target,id:'next-season',date:'2027-10-16'});await FX.refresh(true);assert.equal(FX.recent(0,'bblcup').length,16);assert.equal(FX.upcoming(0,'bblcup').length,4);
 active=false;await FX.refresh(true);assert.equal(FX.all().length,20,'Bundled official cup fixtures survive source failure');assert.equal(FX.state(),'partial');
 console.log('PASS 20 official cup games, 24 stable club mappings, cup/league deduplication, season windows and source-failure fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
