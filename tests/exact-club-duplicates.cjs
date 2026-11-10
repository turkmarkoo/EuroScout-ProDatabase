const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const c={window:{},STATE:{data:{}},normClub:v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,''),CLUB_CODE_ALIAS_GROUPS:[],separateFrankfurtSquads:()=>false,clubMatchIndex:()=>()=>false};
c.DBTEAM_LIST=[
 {key:'nbl|ADE',lg:'nbl',name:'Adelaide 36ers',country:'Australia',logo:'logo.svg'},
 {key:'nbl|ADE2',lg:'nbl',name:'Adelaide 36ers',country:'Australia'},
 {key:'dragons-aus-1|604',lg:'dragons-aus-1',name:'Adelaide 36ers',country:''},
 {key:'directory|adelaide',lg:'directory',name:'Adelaide 36ers',country:'Australia'},
 {key:'ncaa|adams',lg:'ncaam',name:'Adams State Grizzlies',country:'United States'},
 {key:'directory|adams',lg:'directory',name:'Adams State Grizzlies',country:'United States'},
 {key:'dragons-ncaa-1|880',lg:'dragons-ncaa-1',name:'Adams State Grizzlies',country:''},
 {key:'other|adams',lg:'other',name:'Adams State Grizzlies',country:'Canada'},
 {key:'nbl|reserves',lg:'nbl',name:'Adelaide 36ers Reserves',country:'Australia'},
];
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function buildClubs('),html.indexOf('function allClubs(')),c);c.buildClubs();
assert.equal(c.CLUBS.length,4);
assert.equal(c.CLUB_BY_TEAMKEY.get('nbl|ADE'),c.CLUB_BY_TEAMKEY.get('nbl|ADE2'));
assert.equal(c.CLUB_BY_TEAMKEY.get('nbl|ADE'),c.CLUB_BY_TEAMKEY.get('directory|adelaide'));
assert.equal(c.CLUB_BY_TEAMKEY.get('ncaa|adams'),c.CLUB_BY_TEAMKEY.get('directory|adams'));
assert.notEqual(c.CLUB_BY_TEAMKEY.get('ncaa|adams'),c.CLUB_BY_TEAMKEY.get('other|adams'));
assert.notEqual(c.CLUB_BY_TEAMKEY.get('nbl|reserves'),c.CLUB_BY_TEAMKEY.get('nbl|ADE'));
assert.equal(c.CLUB_BY_TEAMKEY.get('nbl|ADE').teams.length,4,'retain all source rows and keys');
assert.equal(c.CLUB_BY_TEAMKEY.get('nbl|ADE'),c.CLUB_BY_TEAMKEY.get('dragons-aus-1|604'));
assert.equal(c.CLUB_BY_TEAMKEY.get('ncaa|adams'),c.CLUB_BY_TEAMKEY.get('dragons-ncaa-1|880'));
console.log('Exact duplicate clubs consolidate while countries, reserves, source keys and logos remain intact.');
