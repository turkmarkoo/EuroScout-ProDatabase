#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FEED='https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/E2026/people?personType=J&limit=600';
const input=process.argv[2];
const raw=input?JSON.parse(fs.readFileSync(input,'utf8')):await fetch(FEED,{headers:{'User-Agent':'EuroScout/1.0',Origin:'https://www.euroleaguebasketball.net',Referer:'https://www.euroleaguebasketball.net/'}}).then(r=>{if(!r.ok)throw new Error(`EuroLeague feed returned ${r.status}`);return r.json();});
const base=JSON.parse(fs.readFileSync(path.join(ROOT,'data','data.json'),'utf8'));
const officialContext={window:{}};
vm.createContext(officialContext);
vm.runInContext(fs.readFileSync(path.join(ROOT,'official-rosters-2026.js'),'utf8'),officialContext);

const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const titleName=rawName=>{
  const [surname,first='']=String(rawName||'').split(',').map(x=>x.trim());
  const cap=s=>s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu,m=>m.toUpperCase());
  return `${cap(first)} ${cap(surname)}`.trim();
};
const countryName=s=>({'United States of America':'United States','Türkiye':'Turkiye'}[s]||s||'');
const role=position=>position==='Center'?'Big':position==='Forward'?'Wing':'Guard';
const TEAM_COUNTRIES={ASV:'France',BAR:'Spain',BAS:'Spain',BES:'Turkiye',DUB:'United Arab Emirates',HTA:'Israel',IST:'Turkiye',MAD:'Spain',MIL:'Italy',MUN:'Germany',OLY:'Greece',PAM:'Spain',PAN:'Greece',PAR:'Serbia',PRS:'France',RED:'Serbia',TEL:'Israel',ULK:'Turkiye',VIR:'Italy',ZAL:'Lithuania'};
const allPlayers=(base.leagues||[]).flatMap(L=>L.players||[]);
const euroleagueTeams=new Map((base.leagues||[]).find(L=>L.meta?.id==='euroleague')?.teams?.map(t=>[t.code,t])||[]);
const existingRoster=officialContext.window.EUROSCOUT_OFFICIAL_ROSTERS?.roster||[];
const manualIdentities=new Map([['jonasvalanciunas|1992-05-06',['nba-287']]]);
const identity=new Map();
for(const p of allPlayers){const dob=p.dob||p.birthDate||'';if(dob)identity.set(`${fold(p.name)}|${dob.slice(0,10)}`,p.id);}
for(const r of existingRoster){if(r.dob)for(const id of r.ids||[])identity.set(`${fold(r.name)}|${r.dob.slice(0,10)}`,id);}

const active=(raw.data||[]).filter(row=>row.active&&row.club?.code&&row.person?.code);
const clubs=new Map();
for(const row of active)if(!clubs.has(row.club.code))clubs.set(row.club.code,row.club);
const checked=new Date().toISOString();
const teams=[...clubs.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({
  id:`euroleague-2026-${c.code.toLowerCase()}`,name:c.name,key:`euroleague|${c.code}`,code:c.code,
  country:euroleagueTeams.get(c.code)?.country||TEAM_COUNTRIES[c.code]||'',logo:c.images?.crest||'',source:FEED,aliases:[c.abbreviatedName,c.editorialName].filter(Boolean)
}));
const roster=[];
const players=[];
for(const row of active){
  const p=row.person,name=titleName(p.name),dob=(p.birthDate||'').slice(0,10),id=`euroleague-${p.code}`;
  const identityKey=`${fold(name)}|${dob}`,ids=[id,...(manualIdentities.get(identityKey)||[])];const linked=identity.get(identityKey);if(linked&&!ids.includes(linked))ids.push(linked);
  const img=row.images?.headshot||row.images?.action||'';
  const profile=`https://www.euroleaguebasketball.net/euroleague/players/-/${p.code}/`;
  roster.push({id:`euroleague-2026-${p.code}`,ids,name,teamId:`euroleague-2026-${row.club.code.toLowerCase()}`,teamName:row.club.name,league:'euroleague',born:dob?Number(dob.slice(0,4)):null,dob,height:p.height||null,weight:p.weight||null,number:row.dorsal||'',img,source:FEED,profile,existing:!!linked});
  players.push({id,code:p.code,name,league:'euroleague',team:row.club.code,teamName:row.club.name,born:dob?Number(dob.slice(0,4)):null,dob,height:p.height||null,weight:p.weight||null,country:countryName(p.country?.name),pos:row.positionName||'',role:role(row.positionName),jersey:row.dorsal||'',img,url:profile,_rosterOnly:true,_strictIdentity:true,qualified:false,g:null,gameLog:[],pct:{},z:{},arch:[]});
}
const payload={season:'2026/27',checked,source:FEED,teams,roster,players,identityPairs:[['euroleague|BES','eurocup|BES'],['euroleague|BES','bsl|BJK']]};
fs.writeFileSync(path.join(ROOT,'euroleague-rosters-2026.js'),`window.EUROSCOUT_EUROLEAGUE_ROSTERS=${JSON.stringify(payload)};\n`);
console.log(JSON.stringify({checked,teams:teams.length,players:players.length,linked:roster.filter(r=>r.ids.length>1).length,paris:roster.filter(r=>r.teamId==='euroleague-2026-prs').length,zalgiris:roster.filter(r=>r.teamId==='euroleague-2026-zal').length},null,2));
