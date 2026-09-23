/* Current NBA roster assignments kept separate from previous-season statistics. */
(function(){
  let data=null,pending=null;
  async function enrich(raw){
    if(!data){pending=pending||fetch('nba-rosters-2026.json?v=20260923',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Current NBA roster could not load');return r.json();}).then(d=>data=d);await pending;}
    apply(raw);
  }
  function apply(raw){
    const nba=raw?.leagues?.find(l=>l.meta.id==='nba');
    const gleague=raw?.leagues?.find(l=>l.meta.id==='gleague');
    if(nba&&data){
      const byId=new Map(nba.players.map(p=>[String(p.code||p._nbaId||''),p]));
      const teamNames=new Map(nba.players.map(p=>[p.team,p.teamName]));
      for(const p of nba.players)p._nbaCurrent=false;
      for(const r of data.players){
        let p=byId.get(String(r.id));
        if(!p){p={id:'nba-'+r.id,code:r.id,name:r.name,league:'nba',g:null,ppg:null,rpg:null,apg:null,spg:null,bpg:null,fgp:null,f3p:null,ftp:null,qualified:false,_other:true,_nbaId:Number(r.id)};nba.players.push(p);}
        Object.assign(p,{name:r.name,team:r.team,teamName:r.teamName||teamNames.get(r.team)||r.team,jersey:r.jersey,role:r.position,pos:r.position,height:r.height||p.height,weight:r.weight||p.weight,country:r.country||p.country,img:r.img||p.img,_college:r.college||p._college,_nbaCurrent:true,currentRosterSeason:data.rosterSeason});
      }
      Object.assign(nba.meta,{rosterSeason:data.rosterSeason,statsSeason:data.statsSeason,rosterUpdatedAt:data.checkedAt,rosterStatus:'imported',rosterSource:data.source});
    }
    if(gleague)Object.assign(gleague.meta,{rosterSeason:'2026-27',statsSeason:gleague.meta.season,rosterStatus:'pending'});
  }
  window.EuroScoutNBARosters={enrich,apply};
})();
