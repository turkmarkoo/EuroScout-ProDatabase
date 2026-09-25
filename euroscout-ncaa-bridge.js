/* NCAA 2025/26 statistics for players already linked to a current European roster.
   This deliberately small league stays out of the Other Leagues navigation and
   percentile pools while making the historic line available to profiles/signals. */
(function(){
'use strict';
const data=window.EUROSCOUT_NCAA_EUROPE_BRIDGE;
if(!data)return;
const LEAGUE='ncaabridge';
function apply(raw){
 if(!raw?.leagues)return;
 let L=raw.leagues.find(x=>x.meta?.id===LEAGUE);
 if(!L){
  L={meta:{id:LEAGUE,name:'NCAA Division I',season:'2025-26',statsSeason:'2025/26',
   excludeFromStats:true,hiddenBridge:true,source:data.source,playerCount:0},teams:[],players:[]};
  raw.leagues.push(L);
 }
 const have=new Set(L.players.map(p=>p.id));
 for(const record of data.records)if(!have.has(record.player.id)){L.players.push(structuredClone(record.player));have.add(record.player.id);}
 L.meta.playerCount=L.players.length;
}
function link(uni){
 for(const record of data.records){
  for(const id of record.linkIds||[])uni(record.player.id,id);
 }
}
window.EuroScoutNCAABridge={apply,link,data};
})();
