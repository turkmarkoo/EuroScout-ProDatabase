const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function signalsFor({player,rows,origins={college:[],usPro:[],otherNonEurope:[]},next=[],transfers=[],manualOverrides={}}){
 const context={
  OVR:{bio:manualOverrides},window:{EUROSCOUT_SIGNAL_ORIGINS:origins},STATE:{data:{transfers}},
  gid:p=>p.gid||p.id,allPlayersEvery:()=>rows,
  leagueOf:p=>({meta:{season:p.leagueSeason||'2025/26'}}),
  effective26keys:()=>next,next26Get:()=>({}),next26bGet:()=>({}),canonKey:k=>k,
  careerStatus:()=>'',levelBand:()=>null,escAttr:String,esc:String,
  renderProfile(){},player(){return null;},CURRENT:null,document:{querySelector(){return null;}},console
 };
 context.window.window=context.window;
 vm.runInNewContext(fs.readFileSync('euroscout-signals.js','utf8'),context);
 return context.window.ESSignals.of(player).map(x=>x.label);
}

{
 const player={id:'new-eu',gid:'person-1',name:'Example Guard',born:2002,_liveClub:'acb|NEW'};
 const rows=[
  {...player,id:'gl-old',league:'gleague',team:'OLD',_rosterOnly:false},
  {...player,id:'new-eu',league:'acb',team:'NEW',_rosterOnly:true}
 ];
 const labels=signalsFor({player,rows,next:['acb|NEW']});
 assert(labels.includes('Out of NBA/G League'));
}

{
 const player={id:'college-eu',gid:'person-2',name:'College Player',born:2003,_liveClub:'bbl|NEW'};
 const rows=[{...player,id:'ncaa-old',league:'ncaam',team:'UNI',_rosterOnly:false}];
 const labels=signalsFor({player,rows,next:['bbl|NEW']});
 assert(labels.includes('Rookie'));
 assert(!labels.includes('Out of NBA/G League'),'NCAA arrivals must not receive the NBA/G League chip');
}

{
 const player={id:'returning',gid:'person-3',name:'Returning Player',born:1999,_liveClub:'aba|NEW'};
 const rows=[{...player,id:'old',league:'aba',team:'OLD',_rosterOnly:false}];
 const labels=signalsFor({player,rows,next:['aba|NEW']});
 assert.equal(labels.join('|'),'New club');
}

{
 const player={id:'fec-current',gid:'person-4',name:'FIBA Transfer',born:1999};
 const rows=[
  {...player,id:'old',league:'aba',team:'OLD',leagueSeason:'2025/26'},
  {...player,id:'fec-current',league:'fec26',team:'NEW',statsSeason:'2026/27',_fibaCurrent:true,g:1}
 ];
 const labels=signalsFor({player,rows,next:['fec26|NEW']});
 assert.equal(labels.join('|'),'New club','a current FIBA stat line must not be mistaken for prior-season club history');
}

{
 const player={id:'unsigned-college',gid:'person-5',name:'Unsigned College Player',born:2003};
 const rows=[{...player,id:'ncaa-old',league:'ncaam',team:'UNI',leagueSeason:'2025/26'}];
 assert.equal(signalsFor({player,rows,next:[]}).join('|'),'','origin tags require a confirmed 2026/27 European club');
}

// Origins must distinguish NBA/G League from other overseas leagues, without an age cap.
for(const league of ['nba','gleague']){
 const player={id:'veteran-'+league,name:'Veteran '+league,born:1988};
 const labels=signalsFor({player,rows:[{...player,league,team:'OLD'}],next:['aba|NEW']});
 assert(labels.includes('Out of NBA/G League'));assert(!labels.includes('Rookie'));
}
for(const league of ['nbl','cba','naia','juco']){
 const player={id:league,name:'Other '+league,born:2002};
 assert(!signalsFor({player,rows:[{...player,league,team:'OLD'}],next:['aba|NEW']}).some(x=>['Rookie','Out of NBA/G League'].includes(x)));
}
{
 const player={id:'old-college',name:'Old College',born:1998};
 assert(!signalsFor({player,rows:[{...player,league:'ncaam',team:'UNI',season:'2024/25'}],next:['aba|NEW']}).includes('Rookie'),'an old NCAA season is not a direct arrival');
}
{
 const player={id:'college-to-nba',name:'College To NBA',born:2002};
 const rows=[{...player,league:'ncaam',team:'UNI'},{...player,league:'nba',team:'PRO'}];
 const labels=signalsFor({player,rows,next:['aba|NEW']});
 assert(labels.includes('Out of NBA/G League'));assert(!labels.includes('Rookie'));
}
{
 const player={id:'origin-nba',name:'Origin NBA',born:1997};
 const origins={college:[],usPro:['nba club'],otherNonEurope:['overseas club']};
 const transfers=[{player:player.name,birth_year:1997,from:'NBA Club',status:'signed',season:'2026/27',league:'ABA'}];
 assert(signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Out of NBA/G League'));
 transfers[0].birth_year=2003;
 assert(!signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Out of NBA/G League'),'reject same-name birth-year conflicts');
 transfers[0].birth_year=1997;transfers[0].from='Overseas Club';
 assert(!signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Out of NBA/G League'));
 transfers[0].from='NBA Club';transfers[0].season='2025/26';
 assert(!signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Out of NBA/G League'),'reject past-season transfer origins');
}
{
 const player={id:'unclassified-college',name:'Unclassified College',born:2003};
 const origins={college:['some college'],usPro:[],otherNonEurope:[]};
 const transfers=[{player:player.name,from:'Some College',status:'signed',season:'2026/27',league:'ABA'}];
 assert(!signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Rookie'),'a general college-name list alone is not NCAA proof');
 origins.players={'unclassified college':{type:'college',season:'2025/26',birth_year:2003,from:'Verified NCAA School',source:'official-school-roster'}};
 assert(signalsFor({player,rows:[],origins,transfers,next:['aba|NEW']}).includes('Rookie'),'verified individual NCAA origin supports a rookie without a statistics row');
}
console.log('PASS mutually exclusive NCAA and NBA/G League arrivals, other-league exclusion, season, identity and club checks.');

{
 const p={id:'manual-arrival',name:'Manual Arrival',born:2002},rows=[{...p,league:'gleague',team:'OLD'}];
 const manualOverrides={[p.id]:{arrivalSignals:{'2026/27':{rookie:true}}}};
 const labels=signalsFor({player:p,rows,next:['fec26|IRA'],manualOverrides});assert(labels.includes('Rookie'));assert(!labels.includes('Out of NBA/G League'),'Manual Rookie stays exclusive');
 assert(!signalsFor({player:p,rows,next:['fec26|IRA'],manualOverrides:{[p.id]:{arrivalSignals:{'2025/26':{rookie:true}}}}}).includes('Rookie'),'Manual tags must remain season-specific');
 const collegeRows=[{...p,league:'ncaam',team:'UNI'}];assert(!signalsFor({player:p,rows:collegeRows,next:['fec26|IRA'],manualOverrides:{[p.id]:{arrivalSignals:{'2026/27':{rookie:false}}}}}).includes('Rookie'),'A manual rejection suppresses the automatic tag');
}
console.log('PASS manual Rookie inclusion, removal, season scope and NBA/G League exclusivity.');
