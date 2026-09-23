const fs=require('fs');
const https=require('https');
const path=require('path');

const root=path.resolve(__dirname,'..');
const input=process.argv[2];
const out=path.join(root,'nba-rosters-2026.json');

function decode(value=''){
  return value.replace(/<!--.*?-->/gs,'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim();
}
function heightCm(value){const m=String(value).match(/(\d+)-(\d+)/);return m?Math.round((Number(m[1])*12+Number(m[2]))*2.54):null;}
function position(value){if(/^G/.test(value))return 'Guard';if(/^C/.test(value))return 'Big';return 'Forward';}
function parse(html){
  const marker='<script id="__NEXT_DATA__"';
  const start=html.indexOf(marker);
  if(start>=0){
    const body=html.indexOf('>',start)+1,end=html.indexOf('</script>',body);
    const records=JSON.parse(html.slice(body,end)).props?.pageProps?.players||[];
    return records.filter(p=>p.ROSTER_STATUS&&p.PERSON_ID&&p.TEAM_ABBREVIATION).map(p=>({
      id:String(p.PERSON_ID),name:[p.PLAYER_FIRST_NAME,p.PLAYER_LAST_NAME].filter(Boolean).join(' '),team:p.TEAM_ABBREVIATION,
      teamId:String(p.TEAM_ID),teamName:[p.TEAM_CITY,p.TEAM_NAME].filter(Boolean).join(' '),jersey:p.JERSEY_NUMBER||'',
      position:position(p.POSITION||''),height:heightCm(p.HEIGHT),weight:Number(p.WEIGHT)||null,college:p.COLLEGE||'',country:p.COUNTRY||'',
      img:`https://cdn.nba.com/headshots/nba/latest/260x190/${p.PERSON_ID}.png`
    }));
  }
  const rows=[...html.matchAll(/<tr class="RosterRow_row__[^"]+">([\s\S]*?)<\/tr>/g)].map(match=>match[1]);
  return rows.map(row=>{
    const id=row.match(/href="\/player\/(\d+)\//)?.[1];
    const name=[...row.matchAll(/<p(?: class="[^"]+")?>([\s\S]*?)<\/p>/g)].slice(0,2).map(x=>decode(x[1])).join(' ');
    const team=row.match(/RosterRow_team__[^"]+"[^>]*>([^<]+)</)?.[1]?.trim()||'';
    const cells=[...row.matchAll(/<td(?: class="[^"]*")?>([\s\S]*?)<\/td>/g)].map(x=>decode(x[1]));
    const src=row.match(/<img[^>]+src="([^"]+)"/)?.[1]||'';
    return {id,name,team,jersey:cells[2]||'',position:position(cells[3]||''),height:heightCm(cells[4]),weight:parseInt(cells[5],10)||null,college:cells[6]||'',country:cells[7]||'',img:src};
  }).filter(p=>p.id&&p.name&&p.team);
}
function fetchPage(){return new Promise((resolve,reject)=>https.get('https://www.nba.com/players',{rejectUnauthorized:false,headers:{'user-agent':'Mozilla/5.0'}},r=>{let body='';r.on('data',d=>body+=d);r.on('end',()=>r.statusCode===200?resolve(body):reject(Error('NBA.com returned '+r.statusCode)));}).on('error',reject));}

(async()=>{
  const html=input?fs.readFileSync(input,'utf8'):await fetchPage();
  const players=parse(html);
  if(players.length<500)throw Error(`Expected at least 500 current NBA players, found ${players.length}`);
  const payload={rosterSeason:'2026-27',statsSeason:'2025-26',checkedAt:new Date().toISOString(),source:'https://www.nba.com/players',players};
  fs.writeFileSync(out,JSON.stringify(payload));
  console.log(`Saved ${players.length} current NBA players to ${path.basename(out)}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
