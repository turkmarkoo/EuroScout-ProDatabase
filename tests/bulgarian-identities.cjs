const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},structuredClone,console,Event:class{},normName:v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),canonKey:k=>k};
for(const f of ['euroscout-bulgarian-names.js','euroscout-league-rosters.js','euroscout-dragons.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),context);
const bg=context.window.EuroScoutBulgarian;
assert.equal(bg.person({id:'40553',name:'Дилън Коусуел',birthDate:'1995-12-24'}).name,'Dylan Causwell');
assert.equal(bg.person({id:'16408',name:'Дейвид Хоутън',birthDate:'1991-08-01'}).name,'David Haughton');
assert.equal(bg.person({id:'40886',name:'Гаел Силва',birthDate:'2003-02-26'}).name,'Gael Bonilla');
assert.equal(bg.person({id:'other',name:'Георги Карастоянов'}).name,'Georgi Karastoyanov');
assert.equal(bg.team({id:'2774',name:'Шумен'}).name,'Shumen');
assert.equal(bg.person({id:'40553',name:'Different Person',birthDate:'2004-01-01'}).name,'Different Person','a reused ID with conflicting DOB cannot adopt a verified name');
const base={leagues:[{meta:{id:'bul'},teams:[{code:'SH1',name:'Shumen',country:'Bulgaria'}],players:[
 {id:'bul-0004',code:'681',name:'Kostadin Lazarov',league:'bul',born:null},
 {id:'bul-other',code:'9',name:'Kostadin Lazarov',league:'bul',born:1999},
 {id:'unknown-name',name:'—',league:'bul',born:2000},
 {id:'bul-wrong-dob',code:'40553',name:'Dylan Causwell',league:'bul',born:1995,birthDate:'1995-01-01'},
 {id:'nbl-0090',name:'David Okwera',teamName:'Perth Wildcats',league:'nbl'},
]}],notes:{'bul-0004':{text:'Retain this private note',rating:4}}};
const pack={id:'bul',season:'2026/27',country:'Bulgaria',teams:[{id:'2774',code:'SH1',key:'bul|SH1',name:'Шумен'}],roster:[{id:'681',name:'Костадин Лазаров',teamId:'2774',born:2000,birthDate:'2000-11-08',img:'portrait.png',number:'44',active:true},{id:'40553',name:'Дилън Коусуел',teamId:'2774',born:1995,birthDate:'1995-12-24',number:'13',active:true},{id:'39859',name:'Дейвид Окуеда',teamId:'2774',born:2002,birthDate:'2002-07-31',number:'0',active:true}]};
const before=JSON.stringify(base),input=JSON.stringify(pack);
context.window.EuroScoutLeagueRosters.apply(base,[pack]);
let row=context.window.EuroScoutLeagueRosters.resolve('dragons-bul-26','681');
assert(row.ids.includes('bul-0004'),'the scoped NBL numeric source ID links an older profile with no DOB');
assert(!row.ids.includes('bul-other'),'a namesake with another provider ID and birth year remains separate');
assert(!row.ids.includes('unknown-name'),'Cyrillic aliases cannot collapse to an empty Latin search key');
row=context.window.EuroScoutLeagueRosters.resolve('dragons-bul-26','40553');
assert(!row.ids.includes('bul-wrong-dob'),'full DOB conflicts block even a matching source code');
assert(context.window.EuroScoutLeagueRosters.resolve('dragons-bul-26','39859').ids.includes('nbl-0090'),'reviewed prior-club evidence can link a legacy biography with no DOB');
assert.equal(base.notes['bul-0004'].text,'Retain this private note');
assert.equal(base.leagues[0].players.find(p=>p.id==='bul-0004').born,2000);
assert.equal(base.leagues[0].players.find(p=>p.id==='bul-0004').img,'portrait.png');
assert.equal(JSON.stringify(pack),input,'normalization must not mutate source snapshots');
const feed={leagueRosters:[pack],fixtures:[],leagues:[]},oldBase=JSON.parse(before);
const result=context.window.EuroScoutDragons.connectData(oldBase,feed);
assert.equal(JSON.stringify(oldBase),before,'loading identities leaves saved notes and source data unchanged');
assert.equal(result.notes['bul-0004'].rating,4);
console.log('Bulgarian names, scoped source IDs, DOB conflicts, immutable imports and private-note preservation passed.');
