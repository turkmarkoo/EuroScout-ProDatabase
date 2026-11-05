/* Official cup fixtures only. Validate the entire snapshot before replacing last good data. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),SOURCE='https://netto-bbl-pokal.de/spielplan';
const {JSDOM}=require(process.env.EUROSCOUT_JSDOM||path.resolve(ROOT,'../../nextgen-suite/node_modules/jsdom'));
async function run(){
 const input=process.argv.indexOf('--input'),html=input>=0?fs.readFileSync(process.argv[input+1],'utf8'):await (async()=>{const r=await fetch(SOURCE,{signal:AbortSignal.timeout(30000)});assert(r.ok,'Cup schedule HTTP '+r.status);return r.text();})();
 const context={window:{}};for(const f of ['bbl-rosters-2026.js','expansion-data.js'])vm.runInNewContext(fs.readFileSync(path.join(ROOT,f),'utf8'),context,{filename:f});
 const keys=new Map(context.window.EUROSCOUT_BBL_ROSTERS.teams.map(t=>[String(t.id),t.key]));
 for(const t of context.window.EUROSCOUT_EXPANSION_DATA.teams){const id=t.source?.match(/2basketballbundesliga\.de\/teams\/kader\/(\d+)/)?.[1];if(id&&!keys.has(id))keys.set(id,'directory|'+t.id);}
 const dom=new JSDOM(html),d=dom.window.document,teams={},teamKeys={},sourceUrls={},seen=new Set(),rows=[];
 for(const game of d.querySelectorAll('article.gamerow[id^="game-"]')){
  const id=game.id.slice(5);assert(!seen.has(id),'Duplicate cup game '+id);seen.add(id);
  const header=game.querySelector('header')?.textContent||'',day=header.match(/(\d{2})\.(\d{2})\.(\d{4})/),time=header.match(/\d{2}:\d{2}/)?.[0]||'',stage=game.querySelector('header > span')?.textContent.trim();
  assert(day&&stage,'Incomplete date/stage '+id);const date=day[3]+'-'+day[2]+'-'+day[1];assert(date>='2026-07-01'&&date<'2027-07-01','Wrong cup season '+id);
  const pair=[...game.querySelectorAll('.gamerow__item-team')].map(a=>{const teamId=a.querySelector('img')?.getAttribute('src')?.match(/\/teams\/logo\/2026\/(\d+)/)?.[1],name=a.querySelector('[aria-label]')?.getAttribute('aria-label'),code=a.getAttribute('href')?.split('/').at(-1);assert(teamId&&name&&code&&keys.has(teamId),'Unknown official cup team '+teamId);teams[code]=name;teamKeys[code]=keys.get(teamId);return code;});
  assert(pair.length===2&&pair[0]!==pair[1],'Invalid cup pairing '+id);
  const played=game.classList.contains('-played'),score=game.querySelector('.gamerow__item-score > span')?.textContent.trim().match(/^(\d+):(\d+)$/);assert(!played||score,'Missing final score '+id);
  const round=({'1. Runde':'First round','Achtelfinale':'Last 16','Viertelfinale':'Quarterfinals','Halbfinale':'Semifinals','Finale':'Final'})[stage]||stage;
  sourceUrls[id]='https://www.easycredit-bbl.de/spiele/'+id;
  rows.push([id,round,date,pair[0],played?score[1]:'',pair[1],played?score[2]:'',time,''].join('|'));
 }
 assert(rows.length>=16&&rows.length<=40,'Unexpected cup coverage: '+rows.length);
 const pack={season:'2026/27',checkedAt:new Date().toISOString(),source:SOURCE,name:'BBL Cup',teams,teamKeys,sourceUrls,games:rows.join('\n')};
 const target=path.join(ROOT,'data/bbl-cup-fixtures-2026.js'),output='/* Official BBL Cup schedule; separate from BBL league statistics. */\nwindow.EUROSCOUT_BBL_CUP_2026='+JSON.stringify(pack,null,2)+';\n';
 fs.writeFileSync(target+'.tmp',output);fs.renameSync(target+'.tmp',target);dom.window.close();console.log(JSON.stringify({games:rows.length,teams:Object.keys(teams).length,source:SOURCE}));
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
