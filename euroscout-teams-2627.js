/* Teams · 2026/27 — competition picker, team table, roster preview.
   Replaces the list view of the 2026/27 Teams page (renderTeamsNext). The 2025/26
   view stays reachable from a small link under the competition list. The club
   page itself (renderNextRoster), assignments and data are unchanged.
   Load after the main app script:  <script src="euroscout-teams-2627.js"></script>
   and the stylesheet:              <link rel="stylesheet" href="euroscout-teams-2627.css"> */
(function () {
  'use strict';
  if (typeof window.renderTeamsNext !== 'function') return;
  var original = window.renderTeamsNext;
  var REGIONAL = { aba: 1, aba2: 1, elb: 1, bnxt: 1, vtb: 1 };
  var EURO = { euroleague: 1, eurocup: 1, bcl: 1, fec: 1, enbl: 1 };
  var PER = 15;
  var T = function () { STATE.tm = STATE.tm || { cq: '', country: '', stage: '', sort: 'roster', page: 1, preview: '' }; return STATE.tm; };
  var e = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };

  function competitions(byTeam, clubs) {
    var raw = STATE.data || {}, S = raw.season2627, loaded = new Set((raw.leagues || []).map(function (L) { return L.meta.id; }));
    var list = [];
    if (S && S.comps) Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; list.push({ value: 'n27:' + id, id: id, name: c.name, type: EURO[id] ? 'europe' : REGIONAL[id] ? 'regional' : 'europe', raw: c }); });
    Object.keys((raw.domestic2627 || {}).leagues || {}).forEach(function (id) { var l = raw.domestic2627.leagues[id]; if (!loaded.has(l.id || id)) return; list.push({ value: l.name, id: id, name: l.name, type: REGIONAL[id] ? 'regional' : 'domestic', raw: l, provisional: !dom27Confirmed(id) }); });
    list.forEach(function (c) {
      var members = clubs.filter(function (cl) { return inComp(cl, c.value); });
      c.count = members.length;
      var cc = {}; members.forEach(function (m) { if (m.country) cc[m.country] = (cc[m.country] || 0) + 1; });
      c.country = c.type === 'domestic' ? (Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; })[0] || '') : '';
      c.status = window.EuroScoutMemberships ? window.EuroScoutMemberships.status(c.raw) : (c.provisional ? 'Provisional' : 'Verified');
    });
    var order = { europe: 0, regional: 1, domestic: 2 }, eo = ['euroleague', 'eurocup', 'bcl', 'fec', 'enbl'];
    return list.sort(function (a, b) { return order[a.type] - order[b.type] || (a.type === 'europe' ? eo.indexOf(a.id) - eo.indexOf(b.id) : a.name.localeCompare(b.name)); });
  }
  function inComp(c, value) {
    if (!value) return true;
    if (value.indexOf('n27:') === 0) { var id = value.slice(4); return nextCompsOf(c).some(function (x) { return x.id === id; }); }
    return domCompsOf(c).some(function (l) { return l.name === value; }) || nextCompsOf(c).some(function (x) { return x.name === value; });
  }
  function stageOf(c, value) {
    var id = value && value.indexOf('n27:') === 0 ? value.slice(4) : null;
    var hit = nextCompsOf(c).concat(domCompsOf(c)).find(function (x) { return id ? x.id === id : x.name === value; });
    return hit && hit.stage || '';
  }

  window.renderTeamsNext = function () {
    try {
      if (STATE.nextTeam) return original();
      var st = T(), m = next26Get(), byTeam = roster2627Assignments(m, next26bGet());
      var clubs = allClubs(), comps = competitions(byTeam, clubs), sel = STATE.next26Lg || '', comp = comps.find(function (c) { return c.value === sel; }) || null;
      var q = normClub(STATE.next26Q || ''), placed = Array.from(byTeam.values()).reduce(function (s, a) { return s + a.length; }, 0);
      var inSel = clubs.filter(function (c) { return inComp(c, sel); });
      var countries = Array.from(new Set(inSel.map(function (c) { return c.country; }).filter(Boolean))).sort();
      var hasQ = inSel.some(function (c) { return stageOf(c, sel) === 'Q'; });
      var rows = inSel.filter(function (c) {
        if (q && !(normClub(c.name).indexOf(q) >= 0 || c.teams.some(function (t) { return normClub(t.city || '').indexOf(q) >= 0 || (t.searchAliases || []).some(function (a) { return normClub(a).indexOf(q) >= 0; }); }))) return false;
        if (st.country && c.country !== st.country) return false;
        if (st.stage === 'Q' && stageOf(c, sel) !== 'Q') return false;
        if (st.stage === 'RS' && stageOf(c, sel) === 'Q') return false;
        return true;
      });
      rows.sort(function (a, b) { return st.sort === 'az' ? a.name.localeCompare(b.name) : ((byTeam.get(b.key) || []).length - (byTeam.get(a.key) || []).length) || a.name.localeCompare(b.name); });
      var pages = 1, pageRows = rows;
      var cq = fold(st.cq);
      var visComps = comps.filter(function (c) { return !cq || fold(c.name + ' ' + c.country + ' ' + c.id).indexOf(cq) >= 0; });
      var group = function (type, label) { var g = visComps.filter(function (c) { return c.type === type; }); if (!g.length) return ''; return '<div class="tm27-gh">' + label + '</div>' + g.map(function (c) { return '<button type="button" class="tm27-comp' + (c.value === sel ? ' on' : '') + '" data-tm27-comp="' + escAttr(c.value) + '"><span class="tm27-ci">' + (type === 'domestic' ? (c.country && flagEmoji(c.country) || '🏀') : type === 'regional' ? '🗺️' : '🌍') + '</span><span class="tm27-cn">' + e(c.name) + (c.status !== 'Verified' ? ' <i title="' + e(c.status) + '">*</i>' : '') + '<small>' + e([c.country, c.count + ' clubs'].filter(Boolean).join(' · ')) + '</small></span></button>'; }).join(''); };
      var left = '<aside class="tm27-card tm27-left"><h3>Competition</h3><div class="tm27-search"><input id="tm27Cq" placeholder="Search competition…" autocomplete="off" value="' + escAttr(st.cq) + '"></div><div class="tm27-comps">' +
        '<button type="button" class="tm27-comp' + (!sel ? ' on' : '') + '" data-tm27-comp=""><span class="tm27-ci">🔎</span><span class="tm27-cn">All competitions<small>' + clubs.length + ' clubs</small></span></button>' +
        group('europe', 'Europe') + group('regional', 'Regional') + group('domestic', 'Domestic') + '</div><p class="tm27-note">* provisional or awaiting a verified entry list</p>' +
        (window.EuroScoutMemberships ? '<button type="button" class="tm27-checks-open" id="tm27EntriesOpen">All league entry checks ↗</button><dialog class="tm27-checks-dialog" id="tm27EntriesDialog" aria-labelledby="tm27EntriesTitle"><div class="tm27-checks-head"><h2 id="tm27EntriesTitle">League entry checks · 2026/27</h2><button type="button" id="tm27EntriesClose" aria-label="Close league entry checks">✕</button></div><div class="tm27-checks-content">' + window.EuroScoutMemberships.reviewRowsHTML(STATE.data) + '</div></dialog>' : '') +
        '<button type="button" class="tm27-old" data-tmode="current">Teams 2025/26 (previous season) ›</button></aside>';
      var entry = '';
      if (comp) { var r = comp.raw || {}; entry = '<div class="tm27-entry"><span class="tm27-st ' + (comp.status === 'Verified' ? 'ok' : 'prov') + '">' + e(comp.status) + '</span><span>' + (r.teams ? r.teams.length : comp.count) + ' listed</span>' + (r.checked ? '<span>Checked ' + e(r.checked) + '</span>' : '') + (r.note ? '<span class="tm27-en">' + e(r.note) + '</span>' : '') + (/^https:\/\//.test(r.source || '') ? '<a href="' + escAttr(r.source) + '" target="_blank" rel="noopener noreferrer">Entry source ↗</a>' : '') + '</div>'; }
      var prev = null;
      var mid = '<section class="tm27-card tm27-mid"><div class="tm27-mh"><h3>' + e(comp ? comp.name : 'All competitions') + '</h3>' + entry + '</div>' +
        '<div class="tm27-filters"><input id="rbClubQ" placeholder="Search team or city… (e.g. Batumi, Vienna)" value="' + escAttr(STATE.next26Q || '') + '" autocomplete="off">' +
        '<select id="tm27Country"><option value="">All countries</option>' + countries.map(function (c) { return '<option' + (st.country === c ? ' selected' : '') + '>' + e(c) + '</option>'; }).join('') + '</select>' +
        '<select id="tm27Stage"><option value="">All entries</option><option value="RS"' + (st.stage === 'RS' ? ' selected' : '') + '>Regular season</option>' + (hasQ || !sel ? '<option value="Q"' + (st.stage === 'Q' ? ' selected' : '') + '>Qualifiers</option>' : '') + '</select>' +
        '<button type="button" class="tm27-sort" id="tm27Sort">Sort: ' + (st.sort === 'az' ? 'A–Z' : 'Roster size') + ' ⇅</button></div>' +
        '<div class="tm27-meta">' + rows.length + ' club' + (rows.length === 1 ? '' : 's') + ' · <b>' + placed + '</b> players placed in 2026/27 overall</div>' +
        (pageRows.length ? '<div class="tm27-tw"><table class="tm27-table"><colgroup><col><col style="width:112px"><col style="width:176px"><col style="width:64px"><col style="width:48px"></colgroup><thead><tr><th>Team</th><th>Country</th><th>Competitions</th><th class="n">Roster</th><th></th></tr></thead><tbody>' + pageRows.map(function (c) {
          var n = (byTeam.get(c.key) || []).length, stg = stageOf(c, sel);
          return '<tr class="' + (prev && prev.key === c.key ? 'on' : '') + '" data-tm27-row="' + escAttr(c.key) + '"><td><span class="tm27-team">' + clubBadge(c, 28) + '<b>' + e(c.name) + '</b>' + (stg === 'Q' ? '<em class="tm27-q">Q</em>' : '') + '</span></td><td class="tm27-nat">' + e(c.country || '—') + '</td><td><div class="tm27-tagw">' + compactTeamTags(c) + '</div></td><td class="n">' + (n ? n : '<span class="tm27-mute">0</span>') + '</td><td class="tm27-open"><button type="button" class="tm27-btn" data-club="' + escAttr(c.key) + '" title="Open the club page">›</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty" style="margin-top:16px">No verified clubs match. If this league’s entries are not published yet, use the previous-season view for historical teams.</div>') +
        '</section>';
      $('#app').innerHTML = '<div class="view tm27"><h1 class="title">Teams · 2026/27</h1><div class="sub" style="margin-bottom:14px">Pick a competition, then click a team to open its 2026/27 roster. <b>' + placed + '</b> players placed so far.</div><div class="tm27-grid">' + left + mid + '</div></div>';
      wireRosterCommon(); if (typeof wireTransferInbox === 'function') wireTransferInbox();
      var app = $('#app');
      var entriesDialog=app.querySelector('#tm27EntriesDialog'),entriesOpen=app.querySelector('#tm27EntriesOpen'),entriesClose=app.querySelector('#tm27EntriesClose');
      if(entriesDialog&&entriesOpen){entriesOpen.onclick=function(){entriesDialog.showModal();};entriesClose.onclick=function(){entriesDialog.close();entriesOpen.focus();};entriesDialog.onclick=function(ev){if(ev.target===entriesDialog)entriesDialog.close();};}
      app.querySelectorAll('[data-tm27-comp]').forEach(function (b) { b.onclick = function () { STATE.next26Lg = b.getAttribute('data-tm27-comp'); st.page = 1; st.country = ''; st.stage = ''; st.preview = ''; renderTeams(); }; });
      var cqi = $('#tm27Cq'); if (cqi) cqi.oninput = function () { st.cq = cqi.value; var pos = cqi.selectionStart; renderTeams(); var el = $('#tm27Cq'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} } };
      var sc = $('#tm27Country'); if (sc) sc.onchange = function () { st.country = sc.value; st.page = 1; renderTeams(); };
      var ss = $('#tm27Stage'); if (ss) ss.onchange = function () { st.stage = ss.value; st.page = 1; renderTeams(); };
      var so = $('#tm27Sort'); if (so) so.onclick = function () { st.sort = st.sort === 'az' ? 'roster' : 'az'; renderTeams(); };
      app.querySelectorAll('[data-tm27-page]').forEach(function (b) { b.onclick = function () { st.page = Number(b.getAttribute('data-tm27-page')); renderTeams(); }; });
      app.querySelectorAll('[data-tm27-row]').forEach(function (tr) { tr.onclick = function (ev) { if (ev.target.closest('[data-club]')) return; STATE.nextTeam = tr.getAttribute('data-tm27-row'); renderTeams(); try { window.scrollTo(0, 0); } catch (x) {} }; });
      app.querySelectorAll('.tm27-old[data-tmode]').forEach(function (b) { b.onclick = function () { STATE.teamsMode = 'current'; STATE.curTeam = null; renderTeams(); try { window.scrollTo(0, 0); } catch (x) {} }; });
      app.querySelectorAll('[data-club]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); STATE.nextTeam = b.getAttribute('data-club'); renderTeams(); try { window.scrollTo(0, 0); } catch (x) {} }; });
      app.querySelectorAll('.tm27-p[data-pid]').forEach(function (b) { b.onclick = function () { openProfile(b.getAttribute('data-pid')); }; });
    } catch (err) {
      console.warn('Teams 2026/27 layout failed — using the standard view', err);
      return original();
    }
  };
})();
