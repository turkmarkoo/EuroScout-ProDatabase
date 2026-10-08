const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),sessions=fs.readFileSync('euroscout-sessions.js','utf8');
assert.match(html,/canonKey\(v\)===target/,'selected clubs must survive canonical league-key aliases');
assert.match(html,/cur&&!matched[^;]+clubName\(cur\)/,'directory-only current clubs must remain selected');
assert.match(html,/euroscout-sessions\.js\?v=20261008-session-membership-v8/);
assert.match(sessions,/if \(pick < 0 && el\.a\.value && el\.b\.value && games\.length\) pick = 0/,'first known game must be recommended automatically');
assert.match(sessions,/el\.known\.onchange\(\)/,'recommended game must fill competition, round, date, score and venue');
new vm.Script(sessions);
console.log('Matchup start dialog preserves selected teams and recommends their known game.');
