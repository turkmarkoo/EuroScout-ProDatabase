import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker,{plan} from './worker.mjs';

const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='unit-key';
const originalFetch=globalThis.fetch;let denied=false,roleReads=0,queries=0;
globalThis.fetch=async url=>{if(url.includes('googleapis.com/service_accounts/'))return Response.json({keys:[jwk]});if(url.includes('/documents/users/')){roleReads++;return Response.json({fields:{role:{stringValue:denied?'viewer':'admin'},active:{booleanValue:true}}});}throw Error('Unexpected external request');};
const meta={seasons:['2026/27'],version:'test-version',generated:'2026-11-08',teams:[],competitions:[],countries:[]};
const env={STATS:{prepare(sql){queries++;return {bind(){return this;},async first(){return sql.includes('stats_meta')?{value:JSON.stringify(meta)}:{records:0,qualified:0};},async all(){return {results:[]};}};}}};
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function token(extra={}){const now=Math.floor(Date.now()/1000),claim={sub:'test-owner',aud:'dragons-hub-65b1c',iss:'https://securetoken.google.com/dragons-hub-65b1c',iat:now,exp:now+3600,email:'markoturk.scouting@gmail.com',...extra},data=encode({alg:'RS256',kid:jwk.kid})+'.'+encode(claim);return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(data))).toString('base64url');}
async function call(value,origin='https://euroscout.mtscouting.com',path='/stats-api/query'){return worker.fetch(new Request('https://stats.example'+path,{headers:{Origin:origin,...value?{Authorization:'Bearer '+value}:{}}}),env);}
try{
 assert.equal((await call(null)).status,403);assert.equal(queries,0);
 assert.equal((await call(await token(),'https://untrusted.example')).status,403);assert.equal(queries,0);
 for(const claim of [{aud:'wrong'},{exp:0},{iat:9999999999},{exp:null},{email:'someone@example.com'},{iss:'wrong'},{sub:''}])assert.equal((await call(await token(claim))).status,403);
 const good=await token();assert.equal((await call(good)).status,200);assert.equal(roleReads,1);
 const before=queries;assert.equal((await call(good)).status,200);assert.equal(queries,before+1); // metadata only, row result cached per user/version.
 denied=true;assert.equal((await call(await token({sub:'other-owner-session'}))).status,403);
 const modified=good.split('.');modified[1]=encode({sub:'attacker',email:'markoturk.scouting@gmail.com'});assert.equal((await call(modified.join('.'))).status,403);
 const p=plan(new URLSearchParams([['competitions','euroleague'],['competitions','eurocup'],['positions','Guard'],['countries','SI'],['countries','HR'],['q','De’Jour'],['sort','apg'],['direction','desc']]),meta);
 assert.equal(p.args.length,5);assert.equal(p.args[4],'dejour');assert.match(p.rows,/r.apg DESC/);assert.match(p.rows,/json_each/);assert(!p.rows.includes('De’Jour'));
 assert.throws(()=>plan(new URLSearchParams('size=999'),meta));assert(!plan(new URLSearchParams('sort=DROP TABLE stats_rows'),meta).rows.includes('DROP'));
 console.log('PASS: signed authentication, authorization, rejection, private/versioned cache, safe SQL and D1 parameter limits');
}finally{globalThis.fetch=originalFetch;}
