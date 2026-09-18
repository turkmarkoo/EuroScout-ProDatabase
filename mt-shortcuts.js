/* MT Shortcuts — one keyboard-shortcut manager for every DragonsHub module.
   No dependencies. Drop the file in, call MTShortcuts.configure() once, then
   MTShortcuts.register() for each action.

   MTShortcuts.configure({
     app:     'euroscout',                     // namespaces the saved bindings
     account: () => 'someone@club.com',        // bindings are kept per account
     load:    () => ({ 'action.id': 'Shift+K' })   // optional: cloud copy
     save:    map => {}                            // optional: cloud copy
   });
   MTShortcuts.register({
     id: 'matchup.next', label: 'Next player', group: 'Scouting matchup',
     keys: 'ArrowDown',            // default; '' means unassigned
     scope: 'matchup',             // 'global' or any name you like
     when: () => true,             // is this scope active right now?
     allowInInput: false,          // fire while typing? (only sensible with Ctrl/Alt)
     run: event => {}
   });
   MTShortcuts.openHelp();  MTShortcuts.openSettings();                        */
(function () {
  'use strict';
  if (window.MTShortcuts) return;

  var actions = [];                 // registration order is display order
  var cfg = { app: 'app', account: function () { return ''; }, load: null, save: null };
  var custom = null;                // { actionId: combo } — only the changed ones
  var capturing = null;             // action id waiting for a key press

  /* ── combos ───────────────────────────────────────────── */
  var MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  function comboOf(e) {
    var k = e.key;
    if (!k || k === 'Control' || k === 'Alt' || k === 'Shift' || k === 'Meta' || k === 'Dead') return '';
    if (k === ' ') k = 'Space';
    /* With Alt held, macOS reports the accented character (Alt+O gives ø); the physical key is what was meant. */
    if (e.altKey && /^Key[A-Z]$/.test(e.code || '')) k = e.code.slice(3);
    if (k.length === 1) k = k.toUpperCase();
    var out = [];
    if (e.ctrlKey) out.push('Ctrl');
    if (e.altKey) out.push('Alt');
    /* Shift is part of the combo for letters and named keys. For symbols the
       symbol already says it: "?" is "?", not "Shift+/". */
    if (e.shiftKey && (k.length > 1 || /[A-Z0-9]/.test(k))) out.push('Shift');
    if (e.metaKey) out.push('Meta');
    out.push(k);
    return out.join('+');
  }
  function normalise(s) {
    if (!s) return '';
    var parts = String(s).split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    if (String(s).slice(-1) === '+' && String(s).length > 1) parts.push('+');
    if (String(s) === '+') parts = ['+'];
    var key = parts.pop() || '';
    if (key.length === 1) key = key.toUpperCase();
    var mods = MODS.filter(function (m) {
      return parts.some(function (p) { return p.toLowerCase() === m.toLowerCase(); });
    });
    return mods.concat([key]).join('+');
  }
  var PRETTY = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Space: 'Space', Enter: 'Enter' };
  function pretty(combo) {
    if (!combo) return '—';
    return combo === '+' ? '+' : combo.split('+').map(function (p, i, all) {
      if (p === '' && i === all.length - 1) return '+';
      return PRETTY[p] || p;
    }).filter(function (p) { return p !== ''; }).join(' + ');
  }

  /* ── storage: per account, with an optional cloud copy ── */
  function storageKey() { return 'mt:shortcuts:v1:' + cfg.app + ':' + (cfg.account() || 'local'); }
  function loadCustom() {
    var map = {};
    try { map = JSON.parse(localStorage.getItem(storageKey()) || '{}') || {}; } catch (e) { map = {}; }
    if (cfg.load) {
      try { var cloud = cfg.load(); if (cloud && typeof cloud === 'object') map = Object.assign({}, map, cloud); } catch (e) { /* cloud copy is optional */ }
    }
    custom = map;
    return map;
  }
  function saveCustom() {
    try { localStorage.setItem(storageKey(), JSON.stringify(custom || {})); } catch (e) { /* private mode */ }
    if (cfg.save) { try { cfg.save(Object.assign({}, custom)); } catch (e) { /* cloud copy is optional */ } }
  }
  function binding(a) {
    if (!custom) loadCustom();
    return Object.prototype.hasOwnProperty.call(custom, a.id) ? custom[a.id] : a.keys;
  }

  /* ── conflicts ────────────────────────────────────────── */
  function overlaps(a, b) { return a.scope === b.scope || a.scope === 'global' || b.scope === 'global'; }
  function conflictsFor(action, combo) {
    if (!combo) return [];
    return actions.filter(function (b) { return b.id !== action.id && binding(b) === combo && overlaps(action, b); });
  }
  function allConflicts() {
    var out = [];
    actions.forEach(function (a, i) {
      actions.slice(i + 1).forEach(function (b) {
        if (binding(a) && binding(a) === binding(b) && overlaps(a, b)) out.push([a, b]);
      });
    });
    return out;
  }

  /* ── dispatch ─────────────────────────────────────────── */
  function typing(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }
  function onKey(e) {
    if (capturing || e.defaultPrevented || e.isComposing) return;
    var combo = comboOf(e);
    if (!combo) return;
    var inInput = typing(e.target);
    /* Enter and Space belong to whatever button has the focus. */
    if ((combo === 'Enter' || combo === 'Space') && e.target && e.target.closest && e.target.closest('button,a,summary,[role=button],[role=tab]')) return;
    /* A view's own shortcut beats a global one on the same key. */
    var hits = actions.filter(function (a) {
      if (binding(a) !== combo) return false;
      if (inInput && !a.allowInInput) return false;
      try { return !a.when || a.when(); } catch (err) { return false; }
    }).sort(function (a, b) { return (a.scope === 'global') - (b.scope === 'global'); });
    if (!hits.length) return;
    e.preventDefault();
    e.stopPropagation();
    try { hits[0].run(e); } catch (err) { console.warn('Shortcut failed:', hits[0].id, err); }
  }
  /* Capture phase, so a view-level shortcut wins over older page handlers. */
  document.addEventListener('keydown', onKey, true);

  /* ── dialog ───────────────────────────────────────────── */
  var STYLE = '.mtsc-mask{position:fixed;inset:0;z-index:12000;background:rgba(15,25,30,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}' +
    '.mtsc-box{margin:auto;width:min(720px,100%);background:var(--panel,#fff);color:var(--txt,#1d2b30);border:1px solid var(--line,#dfe5e1);border-radius:14px;padding:22px;font:13px/1.5 var(--body,system-ui,sans-serif)}' +
    '.mtsc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}.mtsc-head h2{margin:0;font-size:22px}' +
    '.mtsc-box p{color:var(--muted,#6b7a75);margin:4px 0 14px}.mtsc-group{margin:18px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6b7a75);font-weight:700}' +
    '.mtsc-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line-soft,#edf1ee)}.mtsc-row>span:first-child{flex:1;min-width:0}' +
    '.mtsc-key{display:inline-block;min-width:34px;text-align:center;padding:4px 9px;border:1px solid var(--line,#dfe5e1);border-bottom-width:2px;border-radius:7px;background:var(--panel2,#f7f9f7);font:600 12px ui-monospace,Menlo,monospace;white-space:nowrap}' +
    '.mtsc-key.mtsc-wait{border-color:var(--accent,#d28f56);background:var(--accent-soft,#f3e6d9)}.mtsc-key.mtsc-clash{border-color:#c2503f;color:#c2503f}' +
    '.mtsc-btn{min-height:34px!important;padding:6px 11px;border:1px solid var(--line,#dfe5e1);border-radius:8px;background:var(--panel,#fff);color:inherit;font:inherit;cursor:pointer}.mtsc-btn:hover{background:var(--chip,#edf3ef)}' +
    '.mtsc-btn.mtsc-primary{background:#176348;border-color:#176348;color:#fff}.mtsc-warn{margin:10px 0;padding:10px 12px;border-radius:8px;background:#fbeae6;color:#8a2f22;border:1px solid #efc3ba}' +
    '.mtsc-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin-top:18px}.mtsc-note{font-size:11px;color:var(--muted,#6b7a75)}';
  function ensureStyle() {
    if (document.getElementById('mtscStyle')) return;
    var s = document.createElement('style'); s.id = 'mtscStyle'; s.textContent = STYLE; document.head.appendChild(s);
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function close() {
    capturing = null;
    var m = document.getElementById('mtscMask'); if (m) m.remove();
    document.removeEventListener('keydown', dialogKeys, true);
  }
  function dialogKeys(e) {
    if (capturing) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { capturing = null; paint(true); return; }
      var combo = comboOf(e);
      if (!combo) return;                       // a modifier on its own
      var action = actions.filter(function (a) { return a.id === capturing; })[0];
      capturing = null;
      if (action) assign(action, (e.key === 'Backspace' || e.key === 'Delete') ? '' : combo);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }
  var pendingClash = null;
  function assign(action, combo) {
    var clashes = conflictsFor(action, combo);
    if (clashes.length) { pendingClash = { action: action, combo: combo, clashes: clashes }; paint(true); return; }
    commit(action, combo);
  }
  function commit(action, combo) {
    if (!custom) loadCustom();
    if (combo === action.keys) delete custom[action.id]; else custom[action.id] = combo;
    pendingClash = null; saveCustom(); paint(true);
  }
  function paint(editable) {
    ensureStyle();
    var mask = document.getElementById('mtscMask');
    if (!mask) {
      mask = el('div', 'mtsc-mask'); mask.id = 'mtscMask';
      mask.addEventListener('mousedown', function (e) { if (e.target === mask) close(); });
      document.body.appendChild(mask);
      document.addEventListener('keydown', dialogKeys, true);
    }
    mask.dataset.editable = editable ? '1' : '';
    mask.replaceChildren();
    var box = el('div', 'mtsc-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Keyboard shortcuts');
    var head = el('div', 'mtsc-head'); head.appendChild(el('h2', null, editable ? 'Customise shortcuts' : 'Keyboard shortcuts'));
    var x = el('button', 'mtsc-btn', 'Close'); x.type = 'button'; x.onclick = close; head.appendChild(x); box.appendChild(head);
    box.appendChild(el('p', null, editable
      ? 'Choose Change, then press the new key. Backspace clears a shortcut, Esc cancels. Saved for ' + (cfg.account() || 'this device') + '.'
      : 'Single-letter shortcuts work when you are not typing in a field — press Esc to leave a note first.'));

    if (pendingClash) {
      var w = el('div', 'mtsc-warn');
      w.appendChild(el('div', null, pretty(pendingClash.combo) + ' is already used by “' + pendingClash.clashes.map(function (c) { return c.label; }).join('”, “') + '”.'));
      var row = el('div'); row.style.marginTop = '8px'; row.style.display = 'flex'; row.style.gap = '8px';
      var take = el('button', 'mtsc-btn mtsc-primary', 'Use it here and clear the other'); take.type = 'button';
      take.onclick = function () { var p = pendingClash; p.clashes.forEach(function (c) { custom[c.id] = ''; }); commit(p.action, p.combo); };
      var keep = el('button', 'mtsc-btn', 'Cancel'); keep.type = 'button'; keep.onclick = function () { pendingClash = null; paint(true); };
      row.appendChild(take); row.appendChild(keep); w.appendChild(row); box.appendChild(w);
    }
    var clashIds = {}; allConflicts().forEach(function (pair) { clashIds[pair[0].id] = clashIds[pair[1].id] = true; });

    var groups = [];
    actions.forEach(function (a) { if (groups.indexOf(a.group) < 0) groups.push(a.group); });
    groups.forEach(function (g) {
      box.appendChild(el('div', 'mtsc-group', g));
      actions.filter(function (a) { return a.group === g; }).forEach(function (a) {
        var r = el('div', 'mtsc-row'); r.appendChild(el('span', null, a.label));
        var key = el('span', 'mtsc-key' + (capturing === a.id ? ' mtsc-wait' : '') + (clashIds[a.id] ? ' mtsc-clash' : ''),
          capturing === a.id ? 'Press a key…' : pretty(binding(a)));
        r.appendChild(key);
        if (editable) {
          var change = el('button', 'mtsc-btn', 'Change'); change.type = 'button';
          change.onclick = function () { capturing = a.id; pendingClash = null; paint(true); };
          r.appendChild(change);
          if (binding(a) !== a.keys) {
            var reset = el('button', 'mtsc-btn', 'Reset'); reset.type = 'button'; reset.title = 'Back to ' + pretty(a.keys);
            reset.onclick = function () { assign(a, a.keys); };
            r.appendChild(reset);
          }
        }
        box.appendChild(r);
      });
    });

    var foot = el('div', 'mtsc-foot');
    if (editable) {
      var restore = el('button', 'mtsc-btn', 'Restore all defaults'); restore.type = 'button';
      restore.onclick = function () { custom = {}; pendingClash = null; saveCustom(); paint(true); };
      var done = el('button', 'mtsc-btn mtsc-primary', 'Done'); done.type = 'button'; done.onclick = close;
      foot.appendChild(restore); foot.appendChild(done);
    } else {
      var edit = el('button', 'mtsc-btn', 'Customise…'); edit.type = 'button'; edit.onclick = function () { paint(true); };
      foot.appendChild(el('span', 'mtsc-note', 'Press ? at any time to see this list.')); foot.appendChild(edit);
    }
    box.appendChild(foot); mask.appendChild(box);
  }

  window.MTShortcuts = {
    configure: function (options) { Object.assign(cfg, options || {}); custom = null; },
    register: function (a) {
      if (!a || !a.id || typeof a.run !== 'function') throw Error('Shortcut needs an id and a run function.');
      var next = { id: a.id, label: a.label || a.id, group: a.group || 'General', keys: normalise(a.keys), scope: a.scope || 'global', when: a.when || null, allowInInput: !!a.allowInInput, run: a.run };
      var i = actions.findIndex(function (x) { return x.id === a.id; });
      if (i >= 0) actions[i] = next; else actions.push(next);
    },
    unregister: function (id) { actions = actions.filter(function (a) { return a.id !== id; }); },
    reload: function () { custom = null; },
    bindingOf: function (id) { var a = actions.filter(function (x) { return x.id === id; })[0]; return a ? binding(a) : ''; },
    label: function (id) { return pretty(this.bindingOf(id)); },
    conflicts: allConflicts,
    openHelp: function () { pendingClash = null; capturing = null; paint(false); },
    openSettings: function () { pendingClash = null; capturing = null; paint(true); },
    close: close,
    _combo: comboOf, _normalise: normalise
  };
})();
