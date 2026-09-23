const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');

const source=fs.readFileSync('euroscout-other-leagues.js','utf8');
const css=fs.readFileSync('euroscout-other-leagues.css','utf8');

new vm.Script(source);
assert(!source.includes('EuroScout status'),'internal identity status column must stay out of the player table');
assert(!source.includes('Duplicate detected'),'duplicate diagnostics belong in Merge Center');
assert(!source.includes('Prospect only'),'internal identity labels belong in Merge Center');
assert(!source.includes('Linked identity'),'internal identity labels belong in Merge Center');
assert(!source.includes('playerFlag('),'country labels must not prepend a second flag');
assert.match(source,/html\(countryLabel\(p\.country\)\|\|p\.country\|\|'—'\)/,
  'country rows should render the canonical single-flag label');
assert.match(source,/Intl\.DateTimeFormat\('en-GB'/,'last update should be formatted for people');
assert.match(source,/timeZone:'Europe\/Ljubljana'/,'last update should use the club timezone');
assert.match(css,/\.ol-table td\{font-family:var\(--body\)/,'table copy should use EuroScout body typography');
assert.match(css,/\.ol-player strong\{font-family:var\(--disp\)/,'player names should use EuroScout display typography');

console.log('Other Leagues readability checks passed.');
