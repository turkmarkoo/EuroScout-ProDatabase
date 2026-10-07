const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function signalsFor({player,rows,origins={college:[],usPro:[],otherNonEurope:[]},next=[]}){
 const context={
  window:{EUROSCOUT_SIGNAL_ORIGINS:origins},STATE:{data:{transfers:[]}},
  gid:p=>p.gid||p.id,allPlayersEvery:()=>rows,
  leagueOf:p=>({meta:{season:p.leagueSeason||''}}),
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
 assert(labels.includes('Rookie in Europe'));
}

{
 const player={id:'college-eu',gid:'person-2',name:'College Player',born:2003,_liveClub:'bbl|NEW'};
 const rows=[{...player,id:'ncaa-old',league:'ncaam',team:'UNI',_rosterOnly:false}];
 const labels=signalsFor({player,rows,next:['bbl|NEW']});
 assert(labels.includes('Out of college'));
 assert(labels.includes('Rookie in Europe'));
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

console.log('signal regression checks passed');
