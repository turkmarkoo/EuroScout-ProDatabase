const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');

const access=fs.readFileSync('euroscout-access.js','utf8');
const live=fs.readFileSync('euroscout-live-notes.js','utf8');
const html=fs.readFileSync('index.html','utf8');

// A Firebase response must reach the caller with its useful message and status.
const requestSource=access.split('\n').find(line=>line.startsWith('async function request('));
assert(requestSource,'request() not found');
const errors=[];
const context={
  BASE:'https://example.invalid',currentToken:async()=> 'token',lock:()=>{},
  AbortController,JSON,Error,String,
  setTimeout,clearTimeout,
  console:{error:(...args)=>errors.push(args)},
  fetch:async()=>({
    ok:false,status:400,
    clone(){return this;},
    async text(){return JSON.stringify({error:{message:'Season record not found.'}});}
  })
};
vm.createContext(context);
vm.runInContext(requestSource,context);

(async()=>{
  await assert.rejects(()=>context.request('/save',{method:'POST'}),error=>{
    assert.equal(error.message,'Season record not found.');
    assert.equal(error.status,400);
    assert.match(error.responseBody,/Season record not found/);
    return true;
  });
  assert.equal(errors.length,1);

  // A full localStorage cache must not stop the protected cloud write.
  assert.match(html,/set\(o\)\{try\{localStorage\.setItem\(LKEY,JSON\.stringify\(o\)\);return true;\}catch\(e\)/);
  assert.match(html,/if\(window\.ESAccess\)return persistPrivate\(\);/);
  assert.match(html,/get lastError\(\)\{return lastError\}/);
  const storeStart=html.indexOf('const Store = (()=>{');
  const storeEnd=html.indexOf('/* every record write funnels through Store.save',storeStart);
  assert(storeStart>=0&&storeEnd>storeStart,'Store source not found');
  let cloudWrites=0,localWrites=0;
  const esAccess={internal:true,owner:true,user:{email:'admin@example.test'},state:{records:{},appData:{}},saveState:async snapshot=>{cloudWrites++;esAccess.state=snapshot;return true;}};
  esAccess.ready=Promise.resolve(esAccess);
  const storeContext={
    window:{ESAccess:esAccess,EUROSCOUT_CONFIG:{},addEventListener(){}},ESAccess:esAccess,
    localStorage:{getItem:()=>null,setItem:()=>{localWrites++;const error=Error('quota');error.name='QuotaExceededError';throw error;},removeItem(){}},
    document:{addEventListener(){},visibilityState:'visible',activeElement:null,querySelector:()=>null},
    console:{warn(){},error(){}},toast(){},setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,
    Event,JSON,Object,Promise,Date,Error
  };
  vm.createContext(storeContext);
  vm.runInContext(html.slice(storeStart,storeEnd)+';globalThis.__Store=Store;',storeContext);
  await storeContext.__Store.initSB();
  assert.equal(await storeContext.__Store.save('player-1',{jerseyNumbers:{'2026/27|club-1':'1'}}),true);
  assert.equal(cloudWrites,1,'cloud save was blocked by localStorage quota');
  assert.equal(localWrites,0,'protected saves must not serialize the full record cache locally');
  esAccess.saveState=async()=>{throw Error('Season record not found.');};
  assert.equal(await storeContext.__Store.save('player-1',{jerseyNumbers:{'2026/27|club-1':'2'}}),false);
  assert.equal(storeContext.__Store.lastError,'Season record not found.');

  // The dialog validates the canonical player/team context and surfaces the real error.
  assert.match(live,/if\(!playerId\)throw Error\('Player record not found\.'\)/);
  assert.match(live,/if\(!teamId\|\|!roster\)throw Error\('Season or team record not found\.'\)/);
  assert.match(live,/if\(ok===false\)throw Error\(Store\.lastError\|\|'Cloud save failed\.'\)/);
  assert.match(live,/button\.textContent='Saving…'/);
  assert.match(live,/status\.textContent='✓ Saved'/);
  assert.match(live,/status\.textContent='❌ '\+message/);
  console.log('Jersey save error propagation and status checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
