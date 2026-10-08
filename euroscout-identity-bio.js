/* Verified person metadata. NBA person IDs are shared across NBA, G League and
   Summer League; club membership and statistics are not inferred here. */
(function(root){'use strict';
const people=[
 {nbaId:'1642045',name:'Devon Higgs',birthDate:'2000-02-10',source:'https://gleague.nba.com/player/1642045/devon-higgs'},
 {nbaId:'1630777',name:'Jeremiah Tilmon',birthDate:'1998-11-25',source:'https://gleague.nba.com/player/1630777/jeremiah-tilmon'},
 {nbaId:'1642465',name:'Tylor Perry',birthDate:'2001-01-17',source:'https://gleague.nba.com/player/1642465/tylor-perry'},
 {nbaId:'1629599',name:'Amir Coffey',birthDate:'1997-06-17',source:'https://www.nba.com/player/1629599/amir-coffey'},
 {nbaId:'1631210',name:'Jacob Toppin',birthDate:'2000-05-08',source:'https://www.nba.com/player/1631210/bio'}
];
const byId=new Map(people.map(p=>[p.nbaId,p])),fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function apply(raw){for(const L of raw?.leagues||[])for(const p of L.players||[]){const id=String(p._nbaId||(['nba','gleague'].includes(p.league)?p.code:'')||''),known=byId.get(id);if(!known||fold(p.name)!==fold(known.name))continue;const year=Number(known.birthDate.slice(0,4)),old=String(p.born||'').match(/^(?:19|20)\d{2}$/);if(old&&Number(old[0])!==year||p.birthDate&&p.birthDate!==known.birthDate)continue;if(!old)p.born=year;if(!p.birthDate)p.birthDate=known.birthDate;p._identityBioSource=known.source;p._identityBioChecked='2026-10-08';}return raw;}
root.EuroScoutIdentityBio={apply,people};
})(window);
