/* Private Cloudflare D1 query endpoint. No credentials or statistics in this source. */
const PROJECT='dragons-hub-65b1c',OWNER='markoturk.scouting@gmail.com',ORIGINS=new Set(['https://dragonshub.mtscouting.com','https://euroscout.mtscouting.com']);
const METRICS=new Set('g mpg ppg rpg apg spg bpg topg drpg fgp f2p f3p ftp ts efg pir eff usg pts40 reb40 ast40 stl40 blk40 tov40 astto ftr r3a pps astp tovp trbp stlp blkp t_min t_pts t_reb t_ast t_stl t_blk t_tov t_fgm t_fga t_f3m t_f3a t_ftm t_fta t_pir name team_id role'.split(' '));
let jwks=null,jwkUntil=0;const roles=new Map(),cache=new Map();
const fold=v=>String(v||'').replace(/[đĐ]/g,'dj').replace(/[łŁ]/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function bytes(part){const b=part.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b),c=>c.charCodeAt(0));}
async function authenticate(request){
 const token=/^Bearer (.+)$/.exec(request.headers.get('Authorization')||'')?.[1];if(!token)throw Error('Unauthorized');
 const parts=token.split('.');if(parts.length!==3)throw Error('Unauthorized');
 let header,claim;try{header=JSON.parse(new TextDecoder().decode(bytes(parts[0])));claim=JSON.parse(new TextDecoder().decode(bytes(parts[1])));}catch{throw Error('Unauthorized');}
 const now=Date.now();if(header.alg!=='RS256'||claim.aud!==PROJECT||claim.iss!=='https://securetoken.google.com/'+PROJECT||typeof claim.sub!=='string'||!claim.sub||!Number.isFinite(claim.exp)||!Number.isFinite(claim.iat)||claim.exp*1000<=now||claim.iat*1000>now+60000||claim.email?.toLowerCase()!==OWNER)throw Error('Unauthorized');
 if(!jwks||now>=jwkUntil){const r=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');if(!r.ok)throw Error('Authorization unavailable');jwks=(await r.json()).keys;jwkUntil=now+3600000;}
 const jwk=jwks.find(k=>k.kid===header.kid);if(!jwk)throw Error('Unauthorized');const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Unauthorized');
 if((roles.get(claim.sub)||0)<now){const r=await fetch('https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/users/'+encodeURIComponent(claim.sub),{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Unauthorized');const fields=(await r.json()).fields;if(fields?.role?.stringValue!=='admin'||fields?.active?.booleanValue===false)throw Error('Unauthorized');roles.set(claim.sub,now+60000);}
 return claim.sub;
}
export function plan(params,meta){
 const year=params.get('season')||meta.seasons[0],where=['r.season=?'],args=[year];
 for(const [key,col] of [['competitions','competition'],['teams','team_id'],['positions','role']]){const values=params.getAll(key).filter(Boolean);if(values.length>500)throw Error('Too many filters');if(values.length){where.push('r.'+col+' IN (SELECT value FROM json_each(?))');args.push(JSON.stringify(values));}}
 const countries=params.getAll('countries').filter(Boolean);if(countries.length>250)throw Error('Too many countries');if(countries.length){where.push('EXISTS (SELECT 1 FROM stats_nationalities n WHERE n.row_id=r.id AND n.country IN (SELECT value FROM json_each(?)))');args.push(JSON.stringify(countries));}
 const search=params.get('q')||'';if(search.length>150)throw Error('Search is too long');if(search){where.push('instr(r.search_name,?)>0');args.push(fold(search));}
 const base=' FROM stats_rows r WHERE '+where.join(' AND '),qualified=params.get('qualified')!=='0',size=Number(params.get('size')||50),page=Number(params.get('page')||1);if(![25,50,100].includes(size)||!Number.isInteger(page)||page<1||page>100000)throw Error('Invalid pagination');
 const sort=METRICS.has(params.get('sort'))?params.get('sort'):'ppg',direction=params.get('direction')==='asc'?'ASC':'DESC';
 return {year,size,page,qualified,args,count:'SELECT count(*) records,coalesce(sum(r.qualified),0) qualified'+base,rows:'SELECT r.payload'+base+(qualified?' AND r.qualified=1':'')+' ORDER BY r.'+sort+' IS NULL ASC,r.'+sort+' '+direction+',r.id ASC LIMIT ? OFFSET ?'};
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),url=new URL(request.url),headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Origin'};
 if(origin&&!ORIGINS.has(origin))return new Response('{"error":"Origin not allowed"}',{status:403,headers});if(origin)headers['Access-Control-Allow-Origin']=origin;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(request.method!=='GET')return new Response('{"error":"Method not allowed"}',{status:405,headers});
 try{
  const uid=await authenticate(request);const stored=await env.STATS.prepare("SELECT value FROM stats_meta WHERE key='catalogue'").first();if(!stored)throw Error('Statistics are not synchronized');const meta=JSON.parse(stored.value);
  if(url.pathname==='/stats-api/meta')return Response.json(meta,{headers});if(url.pathname!=='/stats-api/query')return new Response('{"error":"Not found"}',{status:404,headers});
  const key=uid+'|'+meta.version+'|'+url.search,cached=cache.get(key);if(cached&&cached.expires>Date.now())return Response.json(cached.data,{headers});
  const p=plan(url.searchParams,meta),counts=await env.STATS.prepare(p.count).bind(...p.args).first(),rows=await env.STATS.prepare(p.rows).bind(...p.args,p.size,(p.page-1)*p.size).all();const data={version:meta.version,generated:meta.generated,season:p.year,total:p.qualified?counts.qualified:counts.records,records:counts.records,qualified:counts.qualified,page:p.page,size:p.size,rows:rows.results.map(r=>{const row=JSON.parse(r.payload),fields=(url.searchParams.get('fields')||'g,mpg,ppg,rpg,apg,spg,bpg,topg,fgp,f3p,ftp').split(',').filter(k=>METRICS.has(k));row.metrics=Object.fromEntries(fields.map(k=>[k,row.metrics[k]??null]));delete row.pct;return row;})};
  cache.set(key,{data,expires:Date.now()+300000});if(cache.size>200)cache.delete(cache.keys().next().value);return Response.json(data,{headers});
 }catch(e){const unauthorized=/Unauthorized|Authorization/.test(e.message);return Response.json({error:unauthorized?'Reconnect through DragonsHub.':'Statistics request failed.'},{status:unauthorized?403:400,headers});}
}};
