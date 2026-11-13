/* Verified person metadata. NBA person IDs are shared across NBA, G League and
   Summer League; club membership and statistics are not inferred here. */
(function(root){'use strict';
// Verified identities for records previously cross-linked by imported aliases.
const distinctPeople=[
 {key:'marcus-foster-2002',ids:['bbl-2004437','bbl-2001733','enbl-97','fiba-bcl-400006','fiba-stat-bcl-400006','dragons-bbl-329-player-1116'],birthDate:'2002-01-06',height:196,source:'https://www.telekom-baskets-bonn.de/presse/newsarchiv/mehr-als-ein-ersatz-marcus-foster-bleibt-in-bonn'},
 {key:'marcus-foster-1995',ids:['eurocup-010386','jbl-31','dragons-ec-97-player-1116','dragons-gre-335-player-4504'],birthDate:'1995-06-03',height:191,source:'https://www.paokbc.gr/en/news/team/3564-marcus-foster-joins-paok-on-a-two-year-deal'},
 {key:'stefan-todorovic-2002',ids:['aba-5708','slo-kzs-108676','gl-445','dragons-aba-1-player-5381','dragons-otp-331-player-1470'],name:'Stefan Todorovi\u0107',birthDate:'2002-12-04',source:'https://www.aba-liga.com/player/5708/26/1/stefan-todorovic/'},
 {key:'stefan-filipovic-1998',ids:['hun-A69342','hun-official-A69342','dragons-hun-9-player-174'],birthDate:'1998-02-05',source:'https://www.fiba.basketball/en/players/236098-stefan-filipovic'}
];
const distinctIds=new Map(distinctPeople.flatMap(p=>p.ids.map(id=>[id,p])));
function personKey(value){return distinctIds.get(typeof value==='string'?value:value?.id)?.key||value?._identityPersonKey||'';}
function separated(a,b){const A=personKey(a),B=personKey(b);return !!(A&&B&&A!==B);}
function correctDistinct(raw){for(const L of raw?.leagues||[])for(const p of L.players||[]){const known=distinctIds.get(p.id);if(!known)continue;p.born=Number(known.birthDate.slice(0,4));p.birthDate=known.birthDate;p.dob=known.birthDate;p._identityPersonKey=known.key;p._identityBioSource=known.source;p._strictIdentity=true;
 if(known.name)p.name=known.name;
 const official=known.key==='marcus-foster-2002'?root.EUROSCOUT_BBL_ROSTERS?.roster?.find(r=>r.id==='2004437'):null;if(official?.img)p.img=official.img;
 // Repair only the imported size inherited from the other Foster, retaining
 // separately entered height measurements and every source statistic/note.
 if(known.key==='marcus-foster-2002'&&Number(p.height)===191)p.height=known.height;
 if(p._orig){p._orig.born=p.born;p._orig.birthDate=p.birthDate;if(known.name)p._orig.name=known.name;if(known.key==='marcus-foster-2002'&&Number(p._orig.height)===191)p._orig.height=known.height;}
 if(p.linkedEuroScoutId&&separated(p,p.linkedEuroScoutId))delete p.linkedEuroScoutId;
}return raw;}
const people=[
 {nbaId:'1642045',name:'Devon Higgs',birthDate:'2000-02-10',source:'https://gleague.nba.com/player/1642045/devon-higgs'},
 {nbaId:'1630777',name:'Jeremiah Tilmon',birthDate:'1998-11-25',source:'https://gleague.nba.com/player/1630777/jeremiah-tilmon'},
 {nbaId:'1642465',name:'Tylor Perry',birthDate:'2001-01-17',source:'https://gleague.nba.com/player/1642465/tylor-perry'},
 {nbaId:'1629599',name:'Amir Coffey',birthDate:'1997-06-17',source:'https://www.nba.com/player/1629599/amir-coffey'},
 {nbaId:'1631210',name:'Jacob Toppin',birthDate:'2000-05-08',source:'https://www.nba.com/player/1631210/bio'}
];
const byId=new Map(people.map(p=>[p.nbaId,p])),fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function apply(raw){correctDistinct(raw);for(const L of raw?.leagues||[])for(const p of L.players||[]){const id=String(p._nbaId||(['nba','gleague'].includes(p.league)?p.code:'')||''),known=byId.get(id);if(!known||fold(p.name)!==fold(known.name))continue;const year=Number(known.birthDate.slice(0,4)),old=String(p.born||'').match(/^(?:19|20)\d{2}$/);if(old&&Number(old[0])!==year||p.birthDate&&p.birthDate!==known.birthDate)continue;if(!old)p.born=year;if(!p.birthDate)p.birthDate=known.birthDate;p._identityBioSource=known.source;p._identityBioChecked='2026-10-08';}return raw;}
// Read-only identity evidence for matching. Do not backfill imported rows here:
// identity changes must pass through the reversible merge batch and its notes backup.
const verified=[
 {realgmId:'22778',name:'Isiah Umipig',birthDate:'1992-03-25'},
 {realgmId:'138860',name:'Kameron Hobbs',birthDate:'2002-06-30'},
 {realgmId:'149031',name:'Daylen Williams',birthDate:'2001-04-09'},
 {realgmId:'132237',name:'Jack Hemphill',birthDate:'1999-05-15'},
 {realgmId:'235010',name:'Sam Maillet',birthDate:'2001-08-16'},
 {realgmId:'142041',name:'Grant Singleton',birthDate:'2000-08-01'},
 {realgmId:'153125',name:'Mayuom Buom',birthDate:'2001-10-07'},
 {realgmId:'120144',name:'Amin Adamu',birthDate:'1997-10-03',ids:['eurocup-014096'],sources:['https://www.fiba.basketball/en/players/236706-amin-adamu','https://basketball.realgm.com/player/Amin-Adamu/Summary/120144']},
 {realgmId:'188444',name:'Vatangoe Donzo',birthDate:'2000-01-28',ids:['bul-0170'],sources:['https://basketball.realgm.com/player/Vatangoe-Donzo/Summary/188444']},
 {realgmId:'85951',name:'Curtis Jones',birthDate:'1997-01-28'},
 {realgmId:'128754',name:'Jordan Harris',birthDate:'1999-07-22'},
 {realgmId:'208130',name:'Bojan Stojanovski',birthDate:'2004-10-13'},
 {nbaId:'1642938',name:'Curtis Jones',birthDate:'2001-10-04',source:'https://www.nba.com/stats/player/1642938/traditional'}
].map(p=>({...p,checked:'2026-10-11',source:p.source||'https://basketball.realgm.com/player/'+p.name.replace(/ /g,'-')+'/Summary/'+p.realgmId}));
const rgId=p=>String(p.realgmId||p.realGMId||[p.profile_url,p._rgm].filter(Boolean).join('\n').match(/\/(?:Summary|GameLogs|NBA)\/(\d+)/i)?.[1]||'');
const verifiedRgm=new Map(verified.filter(p=>p.realgmId).map(p=>[p.realgmId,p])),verifiedNba=new Map([...people,...verified].filter(p=>p.nbaId).map(p=>[p.nbaId,p])),verifiedRows=new Map(verified.flatMap(p=>(p.ids||[]).map(id=>[id,p])));
const months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
function isoBirth(value){if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value;const m=String(value||'').match(/^([A-Z][a-z]{2}) (\d{1,2}), ((?:19|20)\d{2})$/);return m&&months[m[1]]?m[3]+'-'+months[m[1]]+'-'+m[2].padStart(2,'0'):'';}
let representation=null,representationRows=new Map();
function resolve(p){
 if(!p)return null;
 const records=root.EUROSCOUT_REALGM_REPRESENTATION?.records;
 if(records!==representation){representation=records;representationRows=new Map();for(const r of records||[]){if(r.identityConflict)continue;const dates=[...new Set((r.representatives||[]).map(x=>isoBirth(x.birth)).filter(Boolean))],urls=[...new Set(r.playerURLs||[])];if(dates.length!==1||urls.length!==1||Number(dates[0].slice(0,4))!==Number(r.born))continue;const id=rgId({profile_url:urls[0]});if(!id)continue;const evidence={name:r.name,names:r.names,birthDate:dates[0],realgmId:id,source:urls[0],checked:(r.representatives||[])[0]?.checked};for(const key of r.ids||[]){if(representationRows.has(key))representationRows.set(key,null);else representationRows.set(key,evidence);}}}
 const nbaId=String(p._nbaId||(['nba','gleague'].includes(p.league)?p.code:'')||'');
 const known=verifiedRows.get(p.id)||verifiedRgm.get(rgId(p))||verifiedNba.get(nbaId)||representationRows.get(p.id);
 if(!known||![known.name,...(known.names||[])].some(n=>fold(n)===fold(p.name)))return null;
 const year=Number(known.birthDate.slice(0,4)),date=p.birthDate||p.birthdate||p.birth_date||p.dob;
 if(p.born&&Number(p.born)!==year||date&&isoBirth(date)!==known.birthDate)return null;
 const existing=rgId(p);if(existing&&known.realgmId&&existing!==known.realgmId)return null;
 return known;
}
// Exact fingerprints of the seven Filipovic import lines observed on aba-5708.
// The private source text must stay outside this public identity file.
const filipovicImport={
 nOff:new Set(['2ed65d97e64c3328','5b7b1b2ace25dd8a','45d4d9ec6e83376d','f399ecd94232cc0a','85f3844c0ef2f5a3']),
 nDef:new Set(['362fcd956a31e17c','60cee9d85bd8f6c3'])
};
function noteFingerprint(text){
 let hash=0xcbf29ce484222325n;
 for(const char of text)hash=BigInt.asUintN(64,(hash^BigInt(char.codePointAt(0)))*0x100000001b3n);
 return hash.toString(16);
}
function displayName(player, name){
 if(personKey(player)==='stefan-todorovic-2002'&&fold(name)==='todorovic stefan')return 'Stefan Todorovi\u0107';
 return name;
}
function reviewReport(player, report){
 const parse=root.ESRecordMerge?.notes;
 if(personKey(player)!=='stefan-todorovic-2002'||!parse)return report;
 let reviewed=report;
 for(const [field,imported] of Object.entries(filipovicImport)){
  const original=parse(report[field]);
  const kept=original.filter(line=>!imported.has(noteFingerprint(line)));
  if(kept.length===original.length)continue;
  if(reviewed===report)reviewed={...report};
  if(kept.length)reviewed[field]=kept.map(line=>'\u2022 '+line).join('\n');
  else delete reviewed[field];
 }
 return reviewed;
}
root.EuroScoutIdentityBio={apply,people,resolve,verified,personKey,separated,correctDistinct,displayName,reviewReport};
})(window);
