const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function signalsFor({player,rows,origins={college:[],usPro:[],otherNonEurope:[]},next=[]}){
 const context={
  window:{EUROSCOUT_SIGNAL_ORIGINS:origins},STATE:{data:{transfers:[]}},
  gid:p=>p.gid||p.id,allPlayersEvery:()=>rows,
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
 const labels=signalsFor({player,rows,next:[]});
 assert(labels.includes('Coming from NBA/G League'));
 assert(labels.includes('Rookie in Europe'));
}

{
 const player={id:'college-eu',gid:'person-2',name:'College Player',born:2003,_liveClub:'bbl|NEW'};
 const rows=[{...player,id:'ncaa-old',league:'ncaam',team:'UNI',_rosterOnly:false}];
 const labels=signalsFor({player,rows});
 assert(labels.includes('Coming from NCAA'));
 assert(labels.includes('Rookie in Europe'));
}

{
 const player={id:'returning',gid:'person-3',name:'Returning Player',born:1999,_liveClub:'aba|NEW'};
 const rows=[{...player,id:'old',league:'aba',team:'OLD',_rosterOnly:false}];
 const labels=signalsFor({player,rows});
 assert.equal(labels.join('|'),'New team');
}

console.log('signal regression checks passed');
