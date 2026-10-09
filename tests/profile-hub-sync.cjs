const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const editor=fs.readFileSync(path.join(root,'euroscout-edit-player-v2.js'),'utf8');

assert.match(editor,/type:'dragonshub:player-updated'/);
assert.match(editor,/position:fresh\.role\|\|fresh\.pos\|\|position/);
assert.match(editor,/agent:fresh\.agent\|\|agent,agency:fresh\.agency\|\|agency/);
assert.match(editor,/refs=\[\.\.\.new Set/);
assert.match(editor,/\['Free agent','Free agent'\]/);
assert.match(editor,/set26\(id,STATUS_FREE\)/);
assert.match(editor,/availability=playerStatus==='Retired'\?'Retired':playerStatus==='Free agent'\?'Free Agent'/);
assert.match(editor,/withoutClub=playerStatus==='Retired'\|\|playerStatus==='Free agent'/);
assert.match(html,/registered\?canonKey\(registered\):null/);
assert.match(html,/if\(ids\.some\(id=>automated\[id\]\)\)return registered\?canonKey\(registered\):null/);
assert.match(html,/euroscout-edit-player-v2\.js\?v=[^"\s]+/);
new vm.Script(editor,{filename:'euroscout-edit-player-v2.js'});
console.log('EuroScout profile changes notify the embedded DragonHub view.');
