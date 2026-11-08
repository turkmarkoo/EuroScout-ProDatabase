const assert=require('node:assert/strict'),{stabilize}=require('./project.cjs');
const prior={leagues:[{players:[{id:'provider-1',born:1995,_canonicalPersonId:'existing-person'}]}]};
const current={leagues:[{players:[{id:'provider-1',born:1995,_canonicalPersonId:'different-loader-order'},{id:'new-provider',born:1995,linkedEuroScoutId:'provider-1'},{id:'another-person',born:2002,linkedEuroScoutId:'provider-1',_canonicalPersonId:'separate-person'}]}]};
const rows=stabilize(current,prior).leagues[0].players;
assert.equal(rows[0]._canonicalPersonId,'existing-person');assert.equal(rows[1]._canonicalPersonId,'existing-person');assert.equal(rows[2]._canonicalPersonId,'separate-person');
console.log('PASS stable verified source IDs across refresh order, explicit links, and conflicting birth-year rejection');
