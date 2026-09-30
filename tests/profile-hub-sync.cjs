const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const editor=fs.readFileSync(path.join(root,'euroscout-edit-player-v2.js'),'utf8');

assert.match(editor,/type:'dragonshub:player-updated'/);
assert.match(editor,/position:fresh\.role\|\|fresh\.pos\|\|position/);
assert.match(editor,/refs=\[\.\.\.new Set/);
assert.match(html,/euroscout-edit-player-v2\.js\?v=20260930-hub-profile-sync/);
new vm.Script(editor,{filename:'euroscout-edit-player-v2.js'});
console.log('EuroScout profile changes notify the embedded DragonHub view.');
