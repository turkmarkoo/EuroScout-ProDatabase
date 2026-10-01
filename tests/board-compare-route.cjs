const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('Scout Board deep links prefill the existing EuroScout comparison',()=>{
  assert.match(html,/\^#compare=/);
  assert.match(html,/STATE\.compare\.slots=\[available\[0\]\|\|null,available\[1\]\|\|null,available\[2\]\|\|null,available\[3\]\|\|null\]/);
  assert.match(html,/goView\("compare"\)/);
  assert.match(html,/split\("~"\)/);
  assert.match(html,/slice\(0,4\)/);
});
