const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'global-command-palette.js'), 'utf8');
new vm.Script(source);

function runSelection(method) {
  let overlay, opened = 0;
  const document = { activeElement: null, body: { appendChild(node) { overlay = node; } }, addEventListener() {} };
  function element() {
    return {
      value: '', dataset: {}, removed: false, listeners: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      focus() { document.activeElement = this; this.listeners.focus?.(); },
      remove() { this.removed = true; },
      setAttribute() {}, scrollIntoView() {},
      querySelectorAll(selector) { return selector === '[data-index]' && this.option ? [this.option] : []; }
    };
  }
  const header = element(); header.tagName = 'INPUT';
  document.activeElement = header;
  document.createElement = () => {
    const node = element();
    const input = element();
    const results = element();
    results.option = element(); results.option.dataset.index = '0';
    node.querySelector = selector => selector === '.gcp-input' ? input : results;
    node.results = results;
    return node;
  };
  const context = { window: {}, document, console, clearTimeout() {}, setTimeout() {}, requestAnimationFrame(callback) { callback(); } };
  vm.runInNewContext(source, context);
  const palette = context.window.GlobalCommandPalette.create({
    search: () => ({ Players: { total: 1, items: [{ type: 'player', title: 'Test Player', onOpen() { opened++; } }] } }),
    actions: () => [], minQueryLength: 2, inputDelay: 160, afterClose: () => { header.value = ''; }
  });
  palette.bind(header);
  header.value = 'Test Player';
  header.listeners.input();
  assert.equal(palette.isOpen(), true);
  if (method === 'click') overlay.results.option.onclick({ target: { closest: () => null } });
  else overlay.listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(opened, 1, `${method} should open exactly one profile`);
  assert.equal(palette.isOpen(), false, `${method} should close search`);
  assert.equal(overlay.removed, true, `${method} should remove the overlay before navigation`);
  assert.equal(header.value, '', `${method} should clear the header query`);
  assert.notEqual(document.activeElement, header, `${method} should not refocus search`);
}

runSelection('click');
runSelection('keyboard');
assert.match(source, /fold\(query\)\.length>=minQueryLength/);
assert.match(source, /Math\.max\(65,Number\(config\.inputDelay\)\|\|65\)/);
console.log('Palette result navigation checks passed.');
