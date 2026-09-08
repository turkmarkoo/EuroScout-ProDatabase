const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(process.argv[2]||'work/source/EuroScout-ProDatabase-main');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const html=read('index.html');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
for(const f of ['euroscout-market.js','euroscout-transfers.js','euroscout-agency-research.js','euroscout-011.js'])new vm.Script(read(f));
assert(!html.includes('<script src="data/data.js">'));
const loader=html.slice(html.indexOf('async function loadCoreData()'),html.indexOf('async function boot()'));
async function checkLoader({protocol='http:',response,fail=false,scriptFails=false,timeout=false}){
 let fetches=0,scripts=0,clears=0;
 const c={location:{protocol},window:{},console:{warn(){}},AbortController,setTimeout:fn=>{if(timeout)fn();return 1;},clearTimeout:()=>clears++,fetch:async(url,opts)=>{fetches++;if(fail||opts.signal.aborted)throw Error('unavailable');return response;},document:{createElement:()=>({}),head:{appendChild:s=>{scripts++;if(scriptFails)s.onerror();else{c.window.EUROSCOUT_INLINE={leagues:['fallback']};s.onload();}}}}};
 vm.createContext(c);vm.runInContext(loader,c);const result=await c.loadCoreData();return {result,fetches,scripts,clears};
}
(async()=>{
 let r=await checkLoader({response:{ok:true,json:async()=>({leagues:['json']})}});assert.equal(r.result.leagues[0],'json');assert.equal(r.scripts,0);assert.equal(r.clears,1);
 for(const opts of [{fail:true},{response:{ok:false,status:404}},{response:{ok:true,json:async()=>({bad:true})}},{response:{ok:true,json:async()=>{throw Error('invalid JSON');}}},{timeout:true}]){r=await checkLoader(opts);assert.equal(r.result.leagues[0],'fallback');assert.equal(r.scripts,1);}
 r=await checkLoader({protocol:'file:'});assert.equal(r.fetches,0);assert.equal(r.result.leagues[0],'fallback');
 r=await checkLoader({fail:true,scriptFails:true});assert.equal(r.result,null);
 // Indexed research must retain original file order, merged identities, and birth-year rules.
 const market=read('euroscout-market.js'),review=JSON.parse(read('data/free-agent-review.json'));
 const ctx={review,gid:p=>p.groupId||p.id};vm.createContext(ctx);
 vm.runInContext(market.slice(market.indexOf('let indexedReview'),market.indexOf('let searchedReview')),ctx);
 const original=(p,rv)=>{const ids=new Set([p.id,ctx.gid(p),...(p._grp||[]).map(x=>x.id)]);return(rv.items||[]).find(t=>(t.ids||[]).some(id=>ids.has(id))&&(!t.born||!p.born||+t.born===+p.born));};
 let checks=0;for(const item of review.items)for(const id of item.ids||[])for(const born of [null,item.born,1900]){const p={id:'unmatched',groupId:id,born,_grp:[{id}]};assert.equal(ctx.auditFor(p),original(p,review));checks++;}
 ctx.review={items:[{ids:['b'],born:2000},{ids:['a'],born:2000},{ids:['a'],born:1999}]};
 for(const born of [2000,1999,null]){const p={id:'a',born,_grp:[{id:'b'}]};assert.equal(ctx.auditFor(p),original(p,ctx.review));}
 // Club indexes must invalidate with allDbTeams, and never collapse ambiguous clubs.
 const transfers=read('euroscout-transfers.js');let teams=[{key:'1',name:'Club Alpha',searchAliases:['Alpha BC']},{key:'2',name:'Club Beta'},{key:'3',name:'Club Beta'}];
 const tc={allDbTeams:()=>teams,clubForTeamKey:k=>({key:k}),dbTeamForClub:()=>null,normClub:s=>s.toLowerCase()};vm.createContext(tc);
 vm.runInContext(transfers.slice(transfers.indexOf('const key='),transfers.indexOf('const basePending=')),tc);
 assert.equal(tc.dbTeamForClub('Alpha BC').key,'1');assert.equal(tc.dbTeamForClub('Club Beta'),null);assert.equal(tc.dbTeamForClub('unknown'),null);
 teams=[{key:'4',name:'Club Alpha',searchAliases:['Alpha BC']}];assert.equal(tc.dbTeamForClub('Alpha BC').key,'4');
 console.log('PASS: inline/external syntax; 8 loader scenarios; '+checks+' research comparisons; record refresh/order; club aliases/ambiguity/cache invalidation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
