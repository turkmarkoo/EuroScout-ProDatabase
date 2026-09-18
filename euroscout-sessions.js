/* EuroScout — scouting sessions.
   Game → Scouting session → Players → Notes. The session is the record; the
   player timelines, the Team Log and the competition coverage are all read out
   of it, so nothing here is typed twice.

   Storage
   - euroscout:sessions:v1        finished sessions, synced with the rest of the app data
   - euroscout:session:active:v1  the session in progress, this device only
   - each viewed player's report  _workflow.viewings gains sessionId + status   */
(function () {
'use strict';
const KEY = 'euroscout:sessions:v1', ACTIVE = 'euroscout:session:active:v1', RECORDS = 'euroscout:records';
/* Tunable. A player counts as viewed once he has been open this long, or was edited. */
const DWELL_MS = 5000;
/* Team familiarity, 0–100: games watched, share of the roster viewed, how recent. */
const FAM = { gamesFull: 8, wGames: 40, wRoster: 35, wRecency: 25, freshDays: 30, staleDays: 180 };
const FAM_BANDS = [[75, 'Well known'], [45, 'Familiar'], [15, 'Glimpsed'], [0, 'Barely seen']];
const STATUS = { notes: 'Updated Notes', none: 'Reviewed – No Changes', up: 'Stock Up', down: 'Stock Down' };
const NOTE_KEYS = ['nAth', 'nOff', 'nDef', 'nIntel', 'nProj'];

/* ── small helpers ─────────────────────────────────────── */
const $1 = (s, r) => (r || document).querySelector(s);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
/* dd/mm/yyyy everywhere. Accepts YYYY-MM-DD or a full ISO stamp. */
function fmtDate(v) { if (!v) return '—'; const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v); }
function fmtTime(v) { const d = new Date(v); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ' h ' + pad(m) + ' min' : m + ' min'; }
function clock(sec) { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60); }
function daysSince(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return Infinity; return Math.floor((Date.now() - new Date(+m[1], +m[2] - 1, +m[3]).getTime()) / 86400000); }
function hash(s) { let h = 5381; s = String(s || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function me() { try { if (Store.user && Store.user.email) return Store.user.email; } catch (e) { /* Store is a lexical global */ } return (window.ESAccess && ESAccess.user && ESAccess.user.email) || 'Local editor'; }
function canEdit() { try { return Store.canEdit(); } catch (e) { return false; } }
function club(key) { try { return clubByKey(canonKey(key)); } catch (e) { return null; } }
function clubName(key) { const c = club(key); return c ? c.name : ''; }
function notesHash(p) { const r = effectiveReport(p); return hash(NOTE_KEYS.map(k => r[k] || '').join('\u0001')); }
function readJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }

/* ── modal of our own: tall content stays reachable ───── */
function modal(html, wide) {
  closeModal();
  const mask = document.createElement('div'); mask.id = 'sxMask'; mask.className = 'sx-mask';
  mask.innerHTML = '<div class="sx-dialog' + (wide ? ' sx-wide' : '') + '" role="dialog" aria-modal="true"><button type="button" class="sx-x" aria-label="Close">✕</button>' + html + '</div>';
  mask.addEventListener('mousedown', e => { if (e.target === mask) closeModal(); });
  $1('.sx-x', mask).onclick = closeModal;
  document.body.appendChild(mask);
  return $1('.sx-dialog', mask);
}
function closeModal() { const m = document.getElementById('sxMask'); if (m) m.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('sxMask') && !document.getElementById('mtscMask')) { e.stopPropagation(); closeModal(); } }, true);

/* ── the store ─────────────────────────────────────────── */
function all() { const d = readJSON(KEY, null); return d && Array.isArray(d.sessions) ? d.sessions.filter(s => !s.removed) : []; }
function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify({ v: 1, sessions: list }));
  fresh();
  return Promise.resolve(Store.pushAppKey(KEY)).catch(() => false);
}
function active() { const a = readJSON(ACTIVE, null); return a && a.id ? a : null; }
function setActive(a) { if (a) localStorage.setItem(ACTIVE, JSON.stringify(a)); else localStorage.removeItem(ACTIVE); }

/* ── a session in progress ─────────────────────────────── */
let openId = '', openSince = 0;                 // the player currently on screen
function start(details) {
  if (!canEdit()) return null;
  const a = Object.assign({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), by: me(), players: {}, mode: 'Video',
    a: { key: '', name: '' }, b: { key: '', name: '' }, competition: { id: '', name: '' }, stage: '', gameDate: today(), scoreA: '', scoreB: '', venue: '' }, details);
  setActive(a); openId = ''; openSince = 0;
  return a;
}
function update(patch) { const a = active(); if (!a) return null; Object.assign(a, patch); setActive(a); return a; }
function bankDwell(a) {
  if (!openId || !openSince || !a.players[openId]) return;
  a.players[openId].ms = (a.players[openId].ms || 0) + (Date.now() - openSince);
  openSince = Date.now();
}
/* Called by the matchup whenever a player comes on screen. */
function select(p, clubKey) {
  const a = active(); if (!a || !p) return;
  bankDwell(a);
  const id = gid(p);
  if (!a.players[id]) a.players[id] = { pid: p.id, name: p.name, club: canonKey(clubKey || ''), ms: 0, stock: '', before: notesHash(p) };
  openId = id; openSince = Date.now();
  setActive(a);
}
function setStock(p, dir) {
  const a = active(); if (!a || !p) return '';
  const id = gid(p); if (!a.players[id]) select(p);
  const e = active().players[id]; const next = e.stock === dir ? '' : dir;
  const b = active(); b.players[id].stock = next; setActive(b);
  return next;
}
function stockOf(p) { const a = active(); return a && p && a.players[gid(p)] ? a.players[gid(p)].stock || '' : ''; }
/* viewed / edited marks for the roster panels */
function markOf(p) {
  const a = active(); if (!a || !p) return '';
  const e = a.players[gid(p)]; if (!e) return '';
  if (e.stock) return e.stock;
  if (e.before !== notesHash(p)) return 'notes';
  const ms = (e.ms || 0) + (openId === gid(p) && openSince ? Date.now() - openSince : 0);
  return ms >= DWELL_MS ? 'none' : '';
}
function statusKey(e, edited) { return e.stock === 'up' ? 'up' : e.stock === 'down' ? 'down' : edited ? 'notes' : 'none'; }

/* Who counts, and with what status. Nothing is written here. */
function review() {
  const a = active(); if (!a) return [];
  bankDwell(a); setActive(a);
  return Object.entries(a.players).map(([id, e]) => {
    const p = P(e.pid) || player(e.pid); const edited = p ? e.before !== notesHash(p) : false;
    return { id, e, p, edited, viewed: edited || !!e.stock || (e.ms || 0) >= DWELL_MS, status: statusKey(e, edited) };
  }).filter(x => x.viewed);
}

async function finish(extra) {
  const a = active(); if (!a || !canEdit()) return null;
  const rows = review(), ended = new Date();
  const session = {
    id: a.id, startedAt: a.startedAt, endedAt: ended.toISOString(), watchedOn: [today()],
    a: a.a, b: a.b, competition: a.competition, stage: a.stage || '', gameDate: a.gameDate || today(),
    scoreA: a.scoreA, scoreB: a.scoreB, venue: a.venue || '', mode: a.mode || 'Video', by: a.by || me(),
    note: (extra && extra.note) || '',
    players: rows.map(x => ({ id: x.id, pid: x.e.pid, name: x.e.name, club: x.e.club, status: x.status, sec: Math.round((x.e.ms || 0) / 1000) }))
  };
  session.outcome = session.players.some(x => x.status === 'up') || session.players.some(x => x.status === 'down')
    ? (session.players.filter(x => x.status === 'up').length >= session.players.filter(x => x.status === 'down').length ? 'up' : 'down')
    : session.players.some(x => x.status === 'notes') ? 'notes' : 'none';

  /* Every viewed player gets the session on his own timeline. saveRec is used
     rather than a raw write so imported notes that have never been saved are
     carried into the record instead of being replaced by an empty report. */
  const event = [session.a.name, session.b.name].filter(Boolean).join(' vs ');
  const writes = rows.filter(x => x.p).map(x => {
    const r = parseReport(recOf(x.p).report), w = Object.assign({}, r._workflow || {});
    w.viewings = (w.viewings || []).slice();
    let v = w.viewings.find(v => !v.removed && !v.sessionId && v.source === 'matchup' && v.author === me() && (v.updatedAt || '') >= a.startedAt);
    if (!v) { v = { id: crypto.randomUUID(), notes: '', source: 'session' }; w.viewings.push(v); }
    Object.assign(v, { sessionId: session.id, status: x.status, event, competition: session.competition.name || '', date: today(),
      gameDate: session.gameDate, mode: session.mode === 'Live' ? 'Live' : 'Video', author: me(), updatedAt: ended.toISOString() });
    w.updatedAt = ended.toISOString();
    return saveRec(x.p, { report: JSON.stringify(Object.assign({}, r, { _workflow: w })) });
  });
  const list = readJSON(KEY, { sessions: [] }).sessions || [];
  list.push(session);
  setActive(null); openId = ''; openSince = 0;
  const ok = await Promise.all(writes.concat([writeAll(list)])).then(r => r.every(x => x !== false), () => false);
  return { session, ok };
}
function discard() { setActive(null); openId = ''; openSince = 0; }

async function remove(id) {
  if (!canEdit()) return;
  const raw = readJSON(KEY, { sessions: [] }).sessions || [], s = raw.find(x => x.id === id); if (!s) return;
  s.removed = true;
  const writes = (s.players || []).map(x => {
    const p = player(x.pid); if (!p) return null;
    const r = parseReport(recOf(p).report), w = Object.assign({}, r._workflow || {});
    if (!(w.viewings || []).some(v => v.sessionId === id && !v.removed)) return null;
    w.viewings = w.viewings.map(v => v.sessionId === id ? Object.assign({}, v, { removed: true }) : v);
    return saveRec(p, { report: JSON.stringify(Object.assign({}, r, { _workflow: w })) });
  }).filter(Boolean);
  await Promise.all(writes.concat([writeAll(raw)]));
}

/* ── history that predates sessions ────────────────────
   The matchup already logged a viewing whenever a note was written. Those are
   grouped by game and date so the logs do not start from zero. Read-only. */
const cache = { stamp: '', legacy: [], reports: null };
const HAS_NOTES = /"(?:nAth|nOff|nDef|nIntel|nProj|overall)":"[^"]/;
function records() { return readJSON(RECORDS, {}) || {}; }
function legacy() {
  const raw = localStorage.getItem(RECORDS) || '', stamp = raw.length + ':' + hash(raw.slice(0, 2000) + raw.slice(-2000));
  if (cache.stamp === stamp) return cache.legacy;
  const groups = new Map(), byName = new Map(allClubs().map(c => [c.name, c]));
  let recs = {}; try { recs = JSON.parse(raw) || {}; } catch (e) { recs = {}; }
  const reports = new Set();
  Object.entries(recs).forEach(([id, rec]) => {
    if (!rec || !rec.report) return;
    /* Cheap string tests first: parsing every report is what costs time. */
    const text = typeof rec.report === 'string' ? rec.report : JSON.stringify(rec.report);
    if (HAS_NOTES.test(text)) reports.add(id);
    if (text.indexOf('"viewings"') < 0) return;
    const r = parseReport(rec.report);
    ((r._workflow || {}).viewings || []).forEach(v => {
      if (v.removed || v.sessionId || v.source !== 'matchup' || !v.event) return;
      const k = v.event + '|' + (v.gameDate || v.date);
      if (!groups.has(k)) {
        const names = v.event.split(' vs '), A = byName.get(names[0]), B = byName.get(names[1]);
        groups.set(k, { id: 'legacy:' + hash(k), legacy: true, event: v.event, startedAt: v.updatedAt || v.date, endedAt: '', watchedOn: [v.date].filter(Boolean),
          a: { key: A ? A.key : '', name: names[0] || '' }, b: { key: B ? B.key : '', name: names[1] || '' },
          competition: { id: '', name: '' }, stage: '', gameDate: v.gameDate || v.date, mode: v.mode || 'Video', by: v.author || '', players: [], outcome: 'notes' });
      }
      const s = groups.get(k), p = player(id);  /* legacy() runs inside snap(), so it cannot use P() */
      let ck = '';
      if (p) { try { const keys = effective26keys(p, next26Get(), next26bGet()).map(canonKey); ck = keys.find(x => x === s.a.key || x === s.b.key) || ''; } catch (e) { ck = ''; } }
      if (!s.players.some(x => x.id === id)) s.players.push({ id, pid: p ? p.id : id, name: p ? p.name : id, club: ck, status: 'notes', sec: 0 });
    });
  });
  cache.stamp = stamp; cache.legacy = [...groups.values()]; cache.reports = reports;
  return cache.legacy;
}
/* One snapshot, reused for a few seconds. The records blob is several megabytes;
   reading and hashing it once per team row (and once per roster player) is what
   made this page slow. Any write clears it. */
let snapshot = null;
function fresh() { snapshot = null; cache.stamp = ''; }
function snap() {
  if (snapshot && Date.now() - snapshot.at < 4000) return snapshot;
  const sessions = all().concat(legacy()).sort((x, y) => String(y.gameDate + y.startedAt).localeCompare(String(x.gameDate + x.startedAt)));
  const byId = new Map(); (STATE.data.leagues || []).forEach(L => (L.players || []).forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p); }));
  /* Rosters are only needed by the team log, so they are built the first time it asks. */
  let built = null;
  const rosters = { get(k) { if (!built) { built = new Map(); try { const m = next26Get(), mb = next26bGet(); assignPool().forEach(p => effective26keys(p, m, mb).forEach(x => { x = canonKey(x); if (!built.has(x)) built.set(x, []); built.get(x).push(p); })); } catch (e) { /* stays empty */ } } return built.get(k); } };
  snapshot = { at: Date.now(), sessions, byId, rosters, reports: cache.reports || new Set(), logs: new Map() };
  return snapshot;
}
function P(id) { return snap().byId.get(id) || null; }
function everything() { return snap().sessions; }
function hasReport(p) { return snap().reports.has(gid(p)) || (!recOf(p).report && NOTE_KEYS.some(k => String(effectiveReport(p)[k] || '').trim())); }

/* ── Team Log ──────────────────────────────────────────── */
function teamLog(key) {
  key = canonKey(key);
  const memo = snap().logs; if (memo.has(key)) return memo.get(key);
  const c = club(key), sessions = everything().filter(s => s.a.key === key || s.b.key === key);
  const games = new Map();
  sessions.forEach(s => { const k = s.gameDate + '|' + [s.a.key || s.a.name, s.b.key || s.b.name].sort().join('|'); if (!games.has(k)) games.set(k, s); });
  const dates = [...games.values()].map(s => s.gameDate).filter(Boolean).sort();
  const viewed = new Map();
  sessions.forEach(s => s.players.filter(x => x.club === key).forEach(x => {
    const v = viewed.get(x.id) || { id: x.id, pid: x.pid, name: x.name, times: 0, last: '', status: '' };
    v.times++; if ((s.gameDate || '') >= v.last) { v.last = s.gameDate || ''; v.status = x.status; }
    viewed.set(x.id, v);
  }));
  const roster = snap().rosters.get(key) || [];
  const rosterIds = new Set(roster.map(gid)), seenOnRoster = [...viewed.keys()].filter(id => rosterIds.has(id)).length;
  const last = dates[dates.length - 1] || '', since = daysSince(last);
  const recency = !last ? 0 : since <= FAM.freshDays ? 1 : since >= FAM.staleDays ? 0 : 1 - (since - FAM.freshDays) / (FAM.staleDays - FAM.freshDays);
  const parts = {
    games: Math.min(games.size, FAM.gamesFull) / FAM.gamesFull * FAM.wGames,
    roster: (roster.length ? seenOnRoster / roster.length : Math.min(viewed.size, 10) / 10) * FAM.wRoster,
    recency: recency * FAM.wRecency
  };
  const score = Math.round(parts.games + parts.roster + parts.recency);
  const result = {
    key, name: c ? c.name : (sessions[0] ? (sessions[0].a.key === key ? sessions[0].a.name : sessions[0].b.name) : key), club: c,
    sessions, games: [...games.values()], first: dates[0] || '', last,
    competitions: [...new Set(sessions.map(s => s.competition && s.competition.name).filter(Boolean))],
    viewed: [...viewed.values()].sort((x, y) => y.times - x.times || x.name.localeCompare(y.name)),
    rosterSize: roster.length, seenOnRoster,
    shortlisted: roster.filter(p => { try { return isWatched(p); } catch (e) { return false; } }),
    reports: roster.filter(hasReport),
    score, parts, band: FAM_BANDS.find(b => score >= b[0])[1]
  };
  memo.set(key, result);
  return result;
}
function teamLogs() {
  const keys = new Set(); everything().forEach(s => { if (s.a.key) keys.add(s.a.key); if (s.b.key) keys.add(s.b.key); });
  return [...keys].map(teamLog).sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
}

/* ── Competition coverage ──────────────────────────────── */
function competitionsKnown() {
  const out = new Map(), d = STATE.data || {};
  Object.entries((d.season2627 || {}).comps || {}).forEach(([id, c]) => out.set(id, { id, name: c.name, total: (c.teams || []).length }));
  Object.entries((d.domestic2627 || {}).leagues || {}).forEach(([id, c]) => { if (!out.has(id)) out.set(id, { id, name: c.name, total: (c.teams || []).length }); });
  (d.leagues || []).forEach(L => { const m = L.meta || {}; if (m.id && !out.has(m.id)) out.set(m.id, { id: m.id, name: m.name, total: (L.teams || []).length }); });
  return out;
}
function coverage() {
  const comps = competitionsKnown(), rows = new Map();
  const row = c => { const k = c.id || 'name:' + c.name; if (!rows.has(k)) { const known = comps.get(c.id); rows.set(k, { id: c.id || '', name: (known && known.name) || c.name || 'Unspecified', total: known ? known.total : 0, games: new Set(), teams: new Set(), players: new Set(), sessions: 0, last: '' }); } return rows.get(k); };
  comps.forEach(c => row(c));
  everything().forEach(s => {
    if (!s.competition || !(s.competition.id || s.competition.name)) return;
    const r = row(s.competition); r.sessions++;
    r.games.add(s.gameDate + '|' + [s.a.key || s.a.name, s.b.key || s.b.name].sort().join('|'));
    [s.a, s.b].forEach(t => { if (t.key || t.name) r.teams.add(t.key || t.name); });
    s.players.forEach(x => r.players.add(x.id));
    if ((s.gameDate || '') > r.last) r.last = s.gameDate || '';
  });
  return [...rows.values()].map(r => {
    const shortlisted = [...r.players].filter(id => { const p = P(id); try { return p && isWatched(p); } catch (e) { return false; } }).length;
    return { id: r.id, name: r.name, total: r.total, games: r.games.size, teams: r.teams.size, players: r.players.size, shortlisted, sessions: r.sessions, last: r.last,
      pct: r.total ? Math.min(100, Math.round(r.teams.size / r.total * 100)) : null };
  }).sort((x, y) => y.games - x.games || (y.pct || 0) - (x.pct || 0) || x.name.localeCompare(y.name));
}

/* ── competition + known-game choices for two clubs ───── */
function compsFor(ka, kb) {
  const list = k => { const c = club(k); if (!c) return []; let out = []; try { out = nextCompsOf(c).concat(domCompsOf(c)); } catch (e) { out = []; } return out.map(x => ({ id: x.id, name: x.name })); };
  const A = list(ka), B = list(kb), seen = new Set(), out = [];
  A.filter(x => B.some(y => y.id === x.id)).concat(A, B).forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); out.push(x); } });
  return { options: out, shared: A.filter(x => B.some(y => y.id === x.id)).map(x => x.id) };
}
function knownGames(ka, kb) {
  const A = club(ka), B = club(kb); if (!A || !B) return [];
  const out = [];
  (STATE.data.leagues || []).forEach(L => {
    const id = L.meta && L.meta.id, ta = (A.teams || []).find(t => t.lg === id), tb = (B.teams || []).find(t => t.lg === id);
    if (!ta || !tb || !(L.games || []).length) return;
    L.games.forEach(g => { if ((g.h === ta.code && g.a === tb.code) || (g.h === tb.code && g.a === ta.code)) {
      const homeIsA = g.h === ta.code;
      out.push({ date: g.date, comp: { id, name: L.meta.name }, round: g.rnd || '', scoreA: homeIsA ? g.hs : g.as, scoreB: homeIsA ? g.as : g.hs, home: homeIsA ? 'a' : 'b' });
    } });
  });
  /* 2026/27 schedule: upcoming games first, nearest on top, then what has been played. */
  const FX = window.ESFixtures;
  if (FX) FX.between(ka, kb).forEach(g => {
    const homeIsA = g.home.key === canonKey(ka);
    out.push({ date: g.date, time: g.time, comp: { id: g.comp, name: g.compName }, round: g.round, group: g.group, venue: g.venue, fixture: true, played: g.played,
      scoreA: g.played ? (homeIsA ? g.hs : g.as) : '', scoreB: g.played ? (homeIsA ? g.as : g.hs) : '', home: homeIsA ? 'a' : 'b' });
  });
  /* Finished games first, most recent on top — that is what gets watched. Not-yet-played games follow. */
  const done = g => g.scoreA !== '' && g.scoreA != null;
  return out.filter(done).sort((x, y) => String(y.date).localeCompare(String(x.date))).concat(out.filter(g => !done(g)).sort((x, y) => String(x.date).localeCompare(String(y.date))));
}

/* ── dialogs ───────────────────────────────────────────── */
function teamOptions(cur) { return scoutingTeamOptions(cur); }
function openStart(preset, done) {
  if (!canEdit()) { toast('Only an editor can run a scouting session.'); return; }
  preset = preset || {};
  const box = modal('<h3>Start scouting session</h3><p class="sx-hint">Pick the game once. Every player you open or edit is logged against it when you finish.</p>' +
    '<form id="sxStart" class="sx-form"><div class="sx-two"><label>Team A<select name="a" required>' + teamOptions(preset.a) + '</select></label><label>Team B<select name="b" required>' + teamOptions(preset.b) + '</select></label></div>' +
    '<label id="sxKnownWrap" hidden>Game<select name="known"></select></label>' +
    '<div class="sx-two"><label>Competition<select name="comp"></select></label><label>Stage / round<input name="stage" type="text" placeholder="Regular season · Round 4"></label></div>' +
    '<label id="sxCompOtherWrap" hidden>Competition name<input name="compOther" type="text" placeholder="Pre-season · Friendly · Tournament name"></label>' +
    '<div class="sx-two"><label>Game date<input name="gameDate" type="date" value="' + escAttr(preset.gameDate || today()) + '"></label><label>How are you watching?<select name="mode"><option>Video</option><option>Live</option></select></label></div>' +
    '<div class="sx-two"><label>Score (optional)<span class="sx-score"><input name="scoreA" inputmode="numeric" maxlength="3" aria-label="Team A score"><i>–</i><input name="scoreB" inputmode="numeric" maxlength="3" aria-label="Team B score"></span></label><label>Venue (optional)<input name="venue" type="text"></label></div>' +
    '<div class="sx-actions"><button type="button" class="btn ghost" id="sxCancel">Cancel</button><button class="btn primary">Start session</button></div></form>', true);
  const f = $1('#sxStart', box), el = f.elements;
  let games = [];
  function paint() {
    const c = compsFor(el.a.value, el.b.value), keep = el.comp.value;
    el.comp.innerHTML = c.options.map(o => '<option value="' + escAttr(o.id) + '">' + esc(o.name) + (c.shared.includes(o.id) ? '' : ' · one team only') + '</option>').join('') + '<option value="__other">Other / friendly…</option>';
    if ([...el.comp.options].some(o => o.value === keep)) el.comp.value = keep;
    $1('#sxCompOtherWrap', box).hidden = el.comp.value !== '__other';
    games = knownGames(el.a.value, el.b.value);
    $1('#sxKnownWrap', box).hidden = !games.length;
    el.known.innerHTML = '<option value="">— not listed · enter by hand —</option>' + games.map((g, i) => '<option value="' + i + '">' + fmtDate(g.date) + (g.time ? ' ' + esc(g.time) : '') + ' · ' + esc(g.comp.name) + (g.round ? ' · R' + esc(g.round) : '') + ' · ' + (g.scoreA !== '' && g.scoreB !== '' ? g.scoreA + '–' + g.scoreB : 'not played yet') + '</option>').join('');
    if (preset.game) { const i = games.findIndex(g => g.date === preset.game.date && g.comp.id === preset.game.comp); if (i >= 0) { el.known.value = String(i); el.known.onchange(); } }
  }
  el.a.onchange = el.b.onchange = paint;
  el.comp.onchange = () => { $1('#sxCompOtherWrap', box).hidden = el.comp.value !== '__other'; };
  el.known.onchange = () => { const g = games[+el.known.value]; if (!el.known.value || !g) return; el.gameDate.value = g.date; el.scoreA.value = g.scoreA; el.scoreB.value = g.scoreB; if ([...el.comp.options].some(o => o.value === g.comp.id)) el.comp.value = g.comp.id; if (g.round) el.stage.value = (g.group ? 'Group ' + g.group + ' · ' : '') + 'Round ' + g.round; if (g.venue) el.venue.value = g.venue; $1('#sxCompOtherWrap', box).hidden = true; };
  paint();
  $1('#sxCancel', box).onclick = closeModal;
  f.onsubmit = e => {
    e.preventDefault();
    if (!el.a.value || !el.b.value || el.a.value === el.b.value) { toast('Pick two different teams.'); return; }
    const other = el.comp.value === '__other', opt = el.comp.selectedOptions[0];
    const a = start({ a: { key: canonKey(el.a.value), name: clubName(el.a.value) }, b: { key: canonKey(el.b.value), name: clubName(el.b.value) },
      competition: other ? { id: '', name: el.compOther.value.trim() || 'Other' } : { id: el.comp.value, name: opt ? opt.textContent.replace(' · one team only', '') : '' },
      stage: el.stage.value.trim(), gameDate: el.gameDate.value || today(), mode: el.mode.value, scoreA: el.scoreA.value.trim(), scoreB: el.scoreB.value.trim(), venue: el.venue.value.trim() });
    closeModal(); if (done) done(a);
  };
}

function statusChip(k) { return '<span class="sx-status sx-' + k + '">' + STATUS[k] + '</span>'; }
function openFinish(done) {
  const a = active(); if (!a) return;
  const rows = review();
  const box = modal('<h3>Finish scouting session</h3><p class="sx-hint">' + esc(a.a.name) + ' vs ' + esc(a.b.name) + ' · ' + esc(a.competition.name || 'No competition') + ' · ' + fmtDate(a.gameDate) + '</p>' +
    '<div class="sx-two"><label>Final score<span class="sx-score"><input id="sxFA" inputmode="numeric" maxlength="3" value="' + escAttr(a.scoreA || '') + '" aria-label="' + escAttr(a.a.name) + ' score"><i>–</i><input id="sxFB" inputmode="numeric" maxlength="3" value="' + escAttr(a.scoreB || '') + '" aria-label="' + escAttr(a.b.name) + ' score"></span></label><label>Session note (optional)<input id="sxNote" type="text" placeholder="Anything about the game as a whole"></label></div>' +
    '<h4 class="sx-sub">' + rows.length + ' player' + (rows.length === 1 ? '' : 's') + ' reviewed</h4>' +
    (rows.length ? '<div class="sx-reviewlist">' + rows.map(x => '<div class="sx-reviewrow" data-id="' + escAttr(x.id) + '"><span class="sx-rname"><b>' + esc(x.e.name) + '</b><small>' + esc(clubName(x.e.club)) + '</small></span><span class="sx-rstatus">' + statusChip(x.status) + '</span><span class="sx-stockbtns"><button type="button" class="sx-mini' + (x.e.stock === 'up' ? ' on' : '') + '" data-stock="up" title="Stock up">▲</button><button type="button" class="sx-mini' + (x.e.stock === 'down' ? ' on' : '') + '" data-stock="down" title="Stock down">▼</button><button type="button" class="sx-mini" data-drop title="Leave this player out of the session">✕</button></span></div>').join('') + '</div>'
      : '<p class="sx-hint">No player was open for more than a few seconds, so nothing will be added to any timeline. The game still counts for both teams and the competition.</p>') +
    '<p class="sx-hint">Edited players become “Updated Notes”; everyone else you looked at becomes “Reviewed – No Changes”. Use ▲ ▼ for a player whose stock moved.</p>' +
    '<div class="sx-actions"><button type="button" class="btn ghost" id="sxDiscard">Discard session</button><span style="flex:1"></span><button type="button" class="btn ghost" id="sxKeep">Keep scouting</button><button type="button" class="btn primary" id="sxSave">Save session</button></div>', true);
  box.querySelectorAll('[data-stock]').forEach(b => b.onclick = () => {
    const row = b.closest('[data-id]'), id = row.dataset.id, cur = active(); if (!cur || !cur.players[id]) return;
    cur.players[id].stock = cur.players[id].stock === b.dataset.stock ? '' : b.dataset.stock; setActive(cur);
    const x = rows.find(r => r.id === id); x.e.stock = cur.players[id].stock;
    row.querySelectorAll('[data-stock]').forEach(o => o.classList.toggle('on', o.dataset.stock === x.e.stock));
    $1('.sx-rstatus', row).innerHTML = statusChip(statusKey(x.e, x.edited));
  });
  box.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
    const row = b.closest('[data-id]'), cur = active(); if (!cur) return;
    delete cur.players[row.dataset.id]; setActive(cur); row.remove();
    const n = box.querySelectorAll('.sx-reviewrow').length; $1('.sx-sub', box).textContent = n + ' player' + (n === 1 ? '' : 's') + ' reviewed';
  });
  $1('#sxKeep', box).onclick = closeModal;
  $1('#sxDiscard', box).onclick = () => { if (!confirm('Discard this session? Notes you wrote are kept; only the session record is dropped.')) return; discard(); closeModal(); if (done) done(null); };
  $1('#sxSave', box).onclick = async () => {
    const btn = $1('#sxSave', box); btn.disabled = true; btn.textContent = 'Saving…';
    update({ scoreA: $1('#sxFA', box).value.trim(), scoreB: $1('#sxFB', box).value.trim() });
    const result = await finish({ note: $1('#sxNote', box).value.trim() });
    closeModal();
    toast(result && result.ok ? 'Session saved · ' + result.session.players.length + ' player timelines updated' : 'Session stored on this device; cloud sync failed.');
    if (done) done(result && result.session);
  };
}

/* ── Player history ────────────────────────────────────── */
function timeline(p) {
  const r = parseReport(recOf(p).report), w = r._workflow || {}, out = [];
  (w.viewings || []).filter(v => !v.removed).forEach(v => out.push({ at: (v.gameDate || v.date || '') + 'T' + (v.updatedAt || '').slice(11, 19), date: v.gameDate || v.date, kind: 'viewing',
    title: v.event || 'Viewing', status: v.status || (v.source === 'matchup' ? 'notes' : ''), meta: [v.competition, v.mode, v.date && v.date !== v.gameDate ? 'watched ' + fmtDate(v.date) : '', v.author].filter(Boolean).join(' · '), text: v.notes || '', sessionId: v.sessionId || '' }));
  (r._history || []).forEach(h => out.push({ at: h.savedAt, date: h.savedAt, kind: 'notes', title: 'Notes revised', status: '', meta: [fmtTime(h.savedAt), h.author].filter(Boolean).join(' · '), text: '' }));
  return out.sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
function timelineHTML(p) {
  const items = timeline(p), views = items.filter(i => i.kind === 'viewing');
  if (!items.length) return '<p class="sx-hint">Nothing logged yet. Players you open or edit during a scouting session appear here when the session is finished.</p>';
  const games = new Set(views.map(v => v.title + '|' + v.date)).size;
  return '<p class="sx-hint">' + games + ' game' + (games === 1 ? '' : 's') + ' watched · ' + views.filter(v => v.status === 'notes').length + ' with updated notes · last seen ' + fmtDate((views[0] || {}).date) + '</p><ol class="sx-timeline">' +
    items.map(i => '<li class="sx-tl sx-tl-' + i.kind + '"><span class="sx-tl-date">' + fmtDate(i.date) + '</span><div><b>' + esc(i.title) + '</b> ' + (i.status ? statusChip(i.status) : '') + (i.meta ? '<small>' + esc(i.meta) + '</small>' : '') + (i.text ? '<p>' + esc(i.text) + '</p>' : '') + '</div></li>').join('') + '</ol>';
}
function openPlayerLog(p) { if (!p) return; modal('<h3>' + esc(p.name) + ' · scouting history</h3>' + timelineHTML(p), true); }

/* ── Team Log dialog ───────────────────────────────────── */
function famBar(score, band) { return '<span class="sx-fam" title="Games watched, share of the roster viewed and how recently — 0 to 100"><span class="sx-fam-track"><i style="width:' + score + '%"></i></span><b>' + score + '</b><small>' + esc(band) + '</small></span>'; }
function gameLine(s, key) {
  const score = s.scoreA !== '' && s.scoreA != null && s.scoreB !== '' && s.scoreB != null ? ' · ' + s.scoreA + '–' + s.scoreB : '';
  return '<li><span class="sx-tl-date">' + fmtDate(s.gameDate) + '</span><div><b>' + esc(s.a.name) + ' vs ' + esc(s.b.name) + '</b>' + esc(score) + '<small>' + esc([s.competition && s.competition.name, s.stage, s.mode].filter(Boolean).join(' · ')) + '</small></div></li>';
}
function openTeamLog(key) {
  const t = teamLog(key), next = window.ESFixtures ? ESFixtures.forTeam(key).filter(g => !g.played && g.date >= today()).slice(0, 4) : [];
  const stat = (v, l) => '<div class="sx-stat"><b>' + v + '</b><small>' + l + '</small></div>';
  const people = (list, empty) => list.length ? '<div class="sx-people">' + list.map(p => '<button type="button" class="sx-person" data-open="' + escAttr(p.pid || p.id) + '">' + esc(p.name) + (p.times ? ' <small>×' + p.times + (p.status ? ' · ' + STATUS[p.status] : '') + '</small>' : '') + '</button>').join('') + '</div>' : '<p class="sx-hint">' + empty + '</p>';
  const box = modal('<h3>' + esc(t.name) + ' · Team Log</h3><div class="sx-famrow">' + famBar(t.score, t.band) + '<small class="sx-hint">Games ' + Math.round(t.parts.games) + '/' + FAM.wGames + ' · roster ' + Math.round(t.parts.roster) + '/' + FAM.wRoster + ' · recency ' + Math.round(t.parts.recency) + '/' + FAM.wRecency + '</small></div>' +
    '<div class="sx-stats">' + stat(t.games.length, 'games watched') + stat(fmtDate(t.first), 'first watched') + stat(fmtDate(t.last), 'last watched') + stat(t.viewed.length + (t.rosterSize ? ' <small>/ ' + t.rosterSize + '</small>' : ''), 'players viewed') + stat(t.shortlisted.length, 'on watchlist') + stat(t.reports.length, 'reports written') + '</div>' +
    '<p class="sx-hint">Competitions watched: ' + (t.competitions.length ? esc(t.competitions.join(' · ')) : '—') + '</p>' +
    '<div class="sx-cols"><section><h4 class="sx-sub">Recent games</h4>' + (t.games.length ? '<ol class="sx-timeline">' + t.games.slice(0, 8).map(s => gameLine(s, key)).join('') + '</ol>' : '<p class="sx-hint">No games watched yet.</p>') + '</section>' +
    '<section><h4 class="sx-sub">Recent scouting sessions</h4>' + (t.sessions.length ? '<ol class="sx-timeline">' + t.sessions.slice(0, 8).map(s => '<li><span class="sx-tl-date">' + fmtDate((s.startedAt || s.gameDate || '').slice(0, 10)) + '</span><div><b>' + s.players.length + ' player' + (s.players.length === 1 ? '' : 's') + '</b><small>' + esc([s.a.name + ' vs ' + s.b.name, s.by].filter(Boolean).join(' · ')) + '</small></div></li>').join('') + '</ol>' : '<p class="sx-hint">No sessions yet.</p>') + '</section></div>' +
    (next.length ? '<h4 class="sx-sub">Next games</h4><ol class="sx-timeline">' + next.map(g => '<li><span class="sx-tl-date">' + fmtDate(g.date) + '</span><div><b>' + esc(g.home.name) + ' vs ' + esc(g.away.name) + '</b><small>' + esc([g.time, g.compName, 'Round ' + g.round, g.venue].filter(Boolean).join(' · ')) + '</small></div></li>').join('') + '</ol>' : '') +
    '<h4 class="sx-sub">Players viewed</h4>' + people(t.viewed, 'Nobody from this team has been viewed in a session yet.') +
    '<h4 class="sx-sub">On the watchlist</h4>' + people(t.shortlisted.map(p => ({ id: gid(p), pid: p.id, name: p.name })), 'No 2026/27 roster player is on the watchlist.') +
    '<h4 class="sx-sub">Reports written</h4>' + people(t.reports.map(p => ({ id: gid(p), pid: p.id, name: p.name })), 'No notes on the current roster yet.'), true);
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { closeModal(); openProfile(b.dataset.open); });
}

/* ── Scouting log view: sessions · teams · competitions ── */
let tab = 'sessions', showUnscouted = false, upComp = '', upDays = 14, upMode = 'recent';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayLabel(v) { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? DAYS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] + ' ' + fmtDate(v) : v; }
window.addEventListener('euroscout-fixtures', () => { if (STATE.view === 'scoutlog' && tab === 'upcoming' && !document.getElementById('sxMask')) renderLog(); });
function renderLog() {
  const sessions = everything();
  const teamKeys = new Set(); sessions.forEach(s => { if (s.a.key) teamKeys.add(s.a.key); if (s.b.key) teamKeys.add(s.b.key); });
  const compCount = new Set(sessions.map(s => s.competition && (s.competition.id || s.competition.name)).filter(Boolean)).size;
  const teams = tab === 'teams' ? teamLogs() : [], comps = tab === 'comps' ? coverage() : [];
  const a = active();
  const head = '<div class="sx-loghead"><div><h1 class="title" style="margin:0">Scouting log</h1><div class="sub">Every game you scouted, and what it adds up to for each team and competition.</div></div>' +
    (a ? '<button class="btn primary" id="sxResume">● Session running · ' + esc(a.a.name) + ' vs ' + esc(a.b.name) + '</button>' : (canEdit() ? '<button class="btn primary" id="sxNew">Start scouting session</button>' : '')) + '</div>' +
    '<div class="sx-tabs" role="tablist">' + [['sessions', 'Sessions', sessions.length], ['teams', 'Team log', teamKeys.size], ['comps', 'Competition coverage', compCount], ['upcoming', 'Games', window.ESFixtures ? ESFixtures[upMode](upDays, '').length : 0]].map(([k, l, n]) => '<button type="button" role="tab" aria-selected="' + (tab === k) + '" class="sx-tab' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + l + ' · ' + n + '</button>').join('') + '</div>';
  let body = '';
  if (tab === 'sessions') {
    const watched = x => [x.mode, (x.watchedOn || []).map(fmtDate).join(', ')].filter(Boolean).join(' · ');
    body = sessions.length ? '<div class="sx-tablewrap"><table class="sx-table"><thead><tr><th>Game date</th><th>Game</th><th>Competition</th><th>Watched</th><th>Players</th><th>Notes updated</th></tr></thead><tbody>' +
      sessions.map(x => '<tr class="sx-click" data-session="' + escAttr(x.id) + '" tabindex="0"><td>' + fmtDate(x.gameDate) + '</td><td><b>' + esc(x.a.name) + ' vs ' + esc(x.b.name) + '</b>' + (x.scoreA !== '' && x.scoreA != null && x.scoreB !== '' && x.scoreB != null ? ' <span class="sx-hint">' + esc(x.scoreA + '–' + x.scoreB) + '</span>' : '') + '</td><td>' + esc((x.competition && x.competition.name) || '—') + (x.stage ? ' <span class="sx-hint">' + esc(x.stage) + '</span>' : '') + '</td><td>' + esc(watched(x)) + '</td><td>' + x.players.length + '</td><td>' + x.players.filter(y => y.status !== 'none').length + '</td></tr>').join('') + '</tbody></table></div><p class="sx-hint">Open a session to edit the game, the competition or the date, or to merge it with another one.</p>'
      : '<div class="empty">No sessions yet. Start one from the Scouting matchup, watch the game, then finish it — the rest fills in on its own.</div>';
  } else if (tab === 'teams') {
    body = teams.length ? '<div class="sx-tablewrap"><table class="sx-table"><thead><tr><th>Team</th><th>Familiarity</th><th>Games</th><th>First watched</th><th>Last watched</th><th>Players viewed</th><th>Watchlist</th><th>Reports</th><th>Competitions</th></tr></thead><tbody>' +
      teams.map(t => '<tr class="sx-click" data-team="' + escAttr(t.key) + '" tabindex="0"><td><b>' + esc(t.name) + '</b></td><td>' + famBar(t.score, t.band) + '</td><td>' + t.games.length + '</td><td>' + fmtDate(t.first) + '</td><td>' + fmtDate(t.last) + '</td><td>' + t.viewed.length + (t.rosterSize ? ' / ' + t.rosterSize : '') + '</td><td>' + t.shortlisted.length + '</td><td>' + t.reports.length + '</td><td>' + esc(t.competitions.join(' · ') || '—') + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="empty">Team logs appear once a session is finished.</div>';
  } else if (tab === 'upcoming') {
    const FX = window.ESFixtures, list = FX ? FX[upMode](upDays, upComp) : [], cs = FX ? FX.competitions() : [];
    const byDay = new Map(); list.forEach(g => { if (!byDay.has(g.date)) byDay.set(g.date, []); byDay.get(g.date).push(g); });
    body = '<div class="sx-filters"><label>Show <select id="sxUpMode"><option value="recent"' + (upMode === 'recent' ? ' selected' : '') + '>Played games</option><option value="upcoming"' + (upMode === 'upcoming' ? ' selected' : '') + '>Upcoming games</option></select></label><label>Competition <select id="sxUpComp"><option value="">All (' + cs.length + ')</option>' + cs.map(c => '<option value="' + escAttr(c.id) + '"' + (c.id === upComp ? ' selected' : '') + '>' + esc(c.name) + ' · ' + c.games + ' games</option>').join('') + '</select></label><label>Window <select id="sxUpDays">' + [7, 14, 30, 60].map(n => '<option value="' + n + '"' + (n === upDays ? ' selected' : '') + '>' + (upMode === 'recent' ? 'last ' : 'next ') + n + ' days</option>').join('') + '</select></label><button type="button" class="btn ghost sm" id="sxUpRefresh">Refresh schedule</button><span class="sx-hint" style="margin:0">' + (FX && FX.loadedAt() ? 'Schedule checked ' + fmtDate(new Date(FX.loadedAt()).toISOString()) + ' ' + fmtTime(FX.loadedAt()) : FX && FX.state() === 'loading' ? 'Loading the schedule…' : '') + '</span></div>' +
      (FX && FX.problems().length ? '<details class="sx-problems"><summary>' + FX.problems().length + ' thing' + (FX.problems().length === 1 ? '' : 's') + ' to check</summary><ul>' + FX.problems().map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : '') +
      (list.length ? [...byDay.entries()].map(([d, gs]) => '<h4 class="sx-sub">' + dayLabel(d) + '</h4><div class="sx-tablewrap"><table class="sx-table sx-fixt"><tbody>' + gs.map(g => '<tr><td class="sx-ftime">' + esc(g.time || '—') + '</td><td class="sx-fcomp">' + esc(g.compName) + (g.group ? ' · ' + esc(g.group) : '') + ' <span class="sx-hint">R' + esc(g.round) + '</span></td><td><b>' + esc(g.home.name) + '</b> vs <b>' + esc(g.away.name) + '</b>' + (g.played ? ' <span class="sx-hint">' + esc(g.hs + '–' + g.as) + '</span>' : '') + '</td><td class="sx-hint">' + esc(g.venue) + '</td><td class="sx-fact">' + (canEdit() && g.home.key && g.away.key ? '<button type="button" class="btn ghost sm" data-scout="' + escAttr([g.home.key, g.away.key, g.date, g.comp].join('~')) + '">Scout this game</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>').join('')
        : '<div class="empty">' + (FX && FX.state() === 'loading' ? 'Loading the schedule…' : 'No games in this window.') + '</div>') +
      '<p class="sx-hint">EuroLeague and EuroCup come live from the official schedule, with final scores as games finish. Other leagues appear here once their results are in <code>data/fixtures-2627.js</code>.</p>';
  } else {
    const list = comps.filter(c => showUnscouted || c.games);
    body = '<label class="sx-check"><input type="checkbox" id="sxUnscouted" ' + (showUnscouted ? 'checked' : '') + '> Show competitions with nothing watched yet (' + comps.filter(c => !c.games).length + ')</label>' +
      (list.length ? '<div class="sx-tablewrap"><table class="sx-table"><thead><tr><th>Competition</th><th>Coverage</th><th>Teams watched</th><th>Games watched</th><th>Players viewed</th><th>On watchlist</th><th>Last session</th></tr></thead><tbody>' +
      list.map(c => '<tr><td><b>' + esc(c.name) + '</b></td><td>' + (c.pct == null ? '<span class="sx-hint">team list unknown</span>' : '<span class="sx-fam"><span class="sx-fam-track"><i style="width:' + c.pct + '%"></i></span><b>' + c.pct + '%</b></span>') + '</td><td>' + c.teams + (c.total ? ' / ' + c.total : '') + '</td><td>' + c.games + '</td><td>' + c.players + '</td><td>' + c.shortlisted + '</td><td>' + fmtDate(c.last) + '</td></tr>').join('') + '</tbody></table></div><p class="sx-hint">Coverage is the share of a competition’s 2026/27 teams you have watched at least once.</p>'
      : '<div class="empty">Nothing watched yet.</div>');
  }
  $1('#app').innerHTML = '<div class="view sx-log">' + head + body + '</div>';
  document.querySelectorAll('.sx-tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderLog(); });
  const go = () => { STATE.view = 'scouting'; render(); };
  const nw = $1('#sxNew'); if (nw) nw.onclick = () => openStart({ a: STATE.scouting.a, b: STATE.scouting.b }, s => { if (s) { STATE.scouting.a = s.a.key; STATE.scouting.b = s.b.key; go(); } });
  const rs = $1('#sxResume'); if (rs) rs.onclick = () => { STATE.scouting.a = a.a.key; STATE.scouting.b = a.b.key; go(); };
  const um = $1('#sxUpMode'); if (um) um.onchange = () => { upMode = um.value; renderLog(); };
  const uc = $1('#sxUpComp'); if (uc) uc.onchange = () => { upComp = uc.value; renderLog(); };
  const ud = $1('#sxUpDays'); if (ud) ud.onchange = () => { upDays = +ud.value; renderLog(); };
  const ur = $1('#sxUpRefresh'); if (ur) ur.onclick = () => { ur.disabled = true; ur.textContent = 'Checking…'; ESFixtures.refresh(true).then(renderLog); };
  document.querySelectorAll('[data-scout]').forEach(b => b.onclick = () => { const [h, aw, date, comp] = b.dataset.scout.split('~'); openStart({ a: h, b: aw, gameDate: date, game: { date, comp } }, s => { if (s) { STATE.scouting.a = s.a.key; STATE.scouting.b = s.b.key; go(); } }); });
  const un = $1('#sxUnscouted'); if (un) un.onchange = () => { showUnscouted = un.checked; renderLog(); };
  const rowKey = (el, fn) => { el.onclick = fn; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; };
  document.querySelectorAll('[data-team]').forEach(r => rowKey(r, () => openTeamLog(r.dataset.team)));
  document.querySelectorAll('[data-session]').forEach(r => rowKey(r, () => openSession(r.dataset.session)));
}
/* Sessions that predate this feature are only a grouping of old viewings. The
   first time one is edited or merged it becomes a real, stored session, and the
   viewings it came from are tied to it. */
function viewingsOf(s, r) {
  const vs = ((r._workflow || {}).viewings || []);
  return s.legacy ? vs.filter(v => !v.removed && !v.sessionId && v.source === 'matchup' && v.event === s.event && (v.gameDate || v.date) === s.gameDate)
    : vs.filter(v => !v.removed && v.sessionId === s.id);
}
/* Rewrites the viewings behind a session on every player it covers. */
function retag(s, change) {
  return s.players.map(x => {
    const p = P(x.pid) || player(x.pid); if (!p) return null;
    const r = parseReport(recOf(p).report), mine = viewingsOf(s, r); if (!mine.length) return null;
    const ids = new Set(mine.map(v => v.id)), w = Object.assign({}, r._workflow);
    w.viewings = w.viewings.map(v => ids.has(v.id) ? Object.assign({}, v, change(v)) : v);
    return saveRec(p, { report: JSON.stringify(Object.assign({}, r, { _workflow: w })) });
  }).filter(Boolean);
}
function stored() { return readJSON(KEY, { sessions: [] }).sessions || []; }
async function adopt(s) {
  if (!s.legacy) return s;
  const real = Object.assign({}, s, { id: crypto.randomUUID(), by: s.by || me(), scoreA: '', scoreB: '', venue: '', note: '' });
  delete real.legacy; delete real.event;
  const writes = retag(s, () => ({ sessionId: real.id }));
  const list = stored(); list.push(real);
  await Promise.all(writes.concat([writeAll(list)]));
  return real;
}
async function saveEdit(s, next) {
  s = await adopt(s);
  const list = stored(), i = list.findIndex(x => x.id === s.id); if (i < 0) return null;
  const merged = Object.assign({}, list[i], next);
  list[i] = merged;
  const event = [merged.a.name, merged.b.name].filter(Boolean).join(' vs ');
  const single = (merged.watchedOn || []).length === 1 ? merged.watchedOn[0] : '';
  await Promise.all(retag(merged, v => Object.assign({ event, gameDate: merged.gameDate, competition: merged.competition.name || '', mode: merged.mode === 'Live' ? 'Live' : 'Video' }, single ? { date: single } : {})).concat([writeAll(list)]));
  return merged;
}
const RANK = { up: 3, down: 3, notes: 2, none: 1 };
async function merge(keep, other) {
  keep = await adopt(keep); other = await adopt(other);
  const list = stored(), K = list.find(x => x.id === keep.id), O = list.find(x => x.id === other.id); if (!K || !O) return null;
  const event = [K.a.name, K.b.name].filter(Boolean).join(' vs ');
  /* The second session's viewings move under the first; each keeps the day it was watched. */
  const writes = retag(O, () => ({ sessionId: K.id, event, gameDate: K.gameDate, competition: (K.competition && K.competition.name) || '' }));
  O.players.forEach(x => { const mine = K.players.find(y => y.id === x.id); if (!mine) K.players.push(x); else if ((RANK[x.status] || 0) > (RANK[mine.status] || 0)) mine.status = x.status; });
  K.watchedOn = [...new Set((K.watchedOn || []).concat(O.watchedOn || []))].sort();
  K.note = [K.note, O.note].filter(Boolean).join(' · ');
  if ((K.scoreA === '' || K.scoreA == null) && O.scoreA !== '' && O.scoreA != null) { K.scoreA = O.scoreA; K.scoreB = O.scoreB; }
  if (!(K.competition && K.competition.name) && O.competition && O.competition.name) K.competition = O.competition;
  await Promise.all(writes.concat([writeAll(list.filter(x => x.id !== O.id))]));
  return K;
}

function openEdit(id) {
  const s = everything().find(x => x.id === id); if (!s || !canEdit()) return;
  const known = [...competitionsKnown().values()];
  const box = modal('<h3>Edit session</h3><form id="sxEdit" class="sx-form">' +
    '<div class="sx-two"><label>Team A<select name="a">' + teamOptions(s.a.key) + '</select></label><label>Team B<select name="b">' + teamOptions(s.b.key) + '</select></label></div>' +
    '<label id="sxEditKnownWrap" hidden>Pick the game — fills date, score and competition<select name="known"></select></label>' +
    '<div class="sx-two"><label>Competition<input name="comp" type="text" list="sxCompList" value="' + escAttr((s.competition && s.competition.name) || '') + '" placeholder="Start typing…"><datalist id="sxCompList">' + known.map(c => '<option value="' + escAttr(c.name) + '">').join('') + '</datalist></label><label>Stage / round<input name="stage" type="text" value="' + escAttr(s.stage || '') + '"></label></div>' +
    '<div class="sx-two"><label>Game date<input name="gameDate" type="date" value="' + escAttr(s.gameDate || '') + '"></label><label>Date watched<input name="watched" type="date" value="' + escAttr((s.watchedOn || [])[0] || '') + '"' + ((s.watchedOn || []).length > 1 ? ' disabled title="Watched over several days: ' + escAttr(s.watchedOn.map(fmtDate).join(', ')) + '"' : '') + '></label></div>' +
    '<div class="sx-two"><label>Final score<span class="sx-score"><input name="scoreA" inputmode="numeric" maxlength="3" value="' + escAttr(s.scoreA == null ? '' : s.scoreA) + '"><i>–</i><input name="scoreB" inputmode="numeric" maxlength="3" value="' + escAttr(s.scoreB == null ? '' : s.scoreB) + '"></span></label><label>How did you watch?<select name="mode"><option' + (s.mode !== 'Live' ? ' selected' : '') + '>Video</option><option' + (s.mode === 'Live' ? ' selected' : '') + '>Live</option></select></label></div>' +
    '<div class="sx-two"><label>Venue<input name="venue" type="text" value="' + escAttr(s.venue || '') + '"></label><label>Session note<input name="note" type="text" value="' + escAttr(s.note || '') + '"></label></div>' +
    '<div class="sx-actions"><button type="button" class="btn ghost" id="sxEditCancel">Cancel</button><span style="flex:1"></span><button class="btn primary">Save changes</button></div></form>', true);
  const f = $1('#sxEdit', box), el = f.elements; let games = [];
  function paintGames() {
    games = el.a.value && el.b.value ? knownGames(el.a.value, el.b.value).filter(g => g.scoreA !== '' && g.scoreB !== '') : [];
    $1('#sxEditKnownWrap', box).hidden = !games.length;
    el.known.innerHTML = '<option value="">— choose —</option>' + games.map((g, i) => '<option value="' + i + '">' + fmtDate(g.date) + ' · ' + esc(g.comp.name) + (g.round ? ' · R' + esc(g.round) : '') + ' · ' + g.scoreA + '–' + g.scoreB + '</option>').join('');
  }
  el.a.onchange = el.b.onchange = paintGames; paintGames();
  el.known.onchange = () => { const g = games[+el.known.value]; if (!el.known.value || !g) return; el.gameDate.value = g.date; el.scoreA.value = g.scoreA; el.scoreB.value = g.scoreB; el.comp.value = g.comp.name; if (g.round) el.stage.value = (g.group ? 'Group ' + g.group + ' · ' : '') + 'Round ' + g.round; if (g.venue) el.venue.value = g.venue; };
  $1('#sxEditCancel', box).onclick = () => openSession(id);
  f.onsubmit = async e => {
    e.preventDefault();
    if (el.a.value && el.a.value === el.b.value) { toast('Pick two different teams.'); return; }
    const btn = f.querySelector('.btn.primary'); btn.disabled = true; btn.textContent = 'Saving…';
    const team = (sel, old) => sel.value ? { key: canonKey(sel.value), name: clubName(sel.value) } : old;
    const name = el.comp.value.trim(), match = known.find(c => c.name.toLowerCase() === name.toLowerCase());
    const next = { a: team(el.a, s.a), b: team(el.b, s.b), competition: match ? { id: match.id, name: match.name } : { id: '', name }, stage: el.stage.value.trim(),
      gameDate: el.gameDate.value || s.gameDate, scoreA: el.scoreA.value.trim(), scoreB: el.scoreB.value.trim(), mode: el.mode.value, venue: el.venue.value.trim(), note: el.note.value.trim() };
    if (!el.watched.disabled && el.watched.value) next.watchedOn = [el.watched.value];
    const saved = await saveEdit(s, next);
    toast(saved ? 'Session updated' : 'Could not update the session.');
    closeModal(); if (STATE.view === 'scoutlog') renderLog();
  };
}
function openMerge(id) {
  const s = everything().find(x => x.id === id); if (!s || !canEdit()) return;
  const same = x => x.id !== s.id && [x.a.key || x.a.name, x.b.key || x.b.name].sort().join('|') === [s.a.key || s.a.name, s.b.key || s.b.name].sort().join('|');
  const others = everything().filter(x => x.id !== s.id).sort((x, y) => same(y) - same(x));
  const box = modal('<h3>Merge sessions</h3><p class="sx-hint">For one game watched in two sittings. The players of both are combined into <b>' + esc(s.a.name + ' vs ' + s.b.name) + ' · ' + fmtDate(s.gameDate) + '</b>; each player keeps the day he was watched. The other session disappears.</p>' +
    (others.length ? '<form id="sxMerge" class="sx-form"><label>Merge with<select name="other">' + others.map(x => '<option value="' + escAttr(x.id) + '">' + fmtDate(x.gameDate) + ' · ' + esc(x.a.name + ' vs ' + x.b.name) + ' · ' + x.players.length + ' players' + (same(x) ? ' · same teams' : '') + '</option>').join('') + '</select></label><div class="sx-actions"><button type="button" class="btn ghost" id="sxMergeCancel">Cancel</button><span style="flex:1"></span><button class="btn primary">Merge</button></div></form>' : '<p class="sx-hint">There is no other session to merge with.</p>'));
  const f = $1('#sxMerge', box); if (!f) return;
  $1('#sxMergeCancel', box).onclick = () => openSession(id);
  f.onsubmit = async e => {
    e.preventDefault(); const other = everything().find(x => x.id === f.elements.other.value); if (!other) return;
    const btn = f.querySelector('.btn.primary'); btn.disabled = true; btn.textContent = 'Merging…';
    const done = await merge(s, other);
    toast(done ? 'Merged · ' + done.players.length + ' players in one session' : 'Could not merge.');
    closeModal(); if (STATE.view === 'scoutlog') renderLog();
  };
}
function openSession(id) {
  const s = everything().find(x => x.id === id); if (!s) return;
  const watched = (s.watchedOn || []).length ? 'watched ' + s.watchedOn.map(fmtDate).join(', ') : '';
  const score = s.scoreA !== '' && s.scoreA != null && s.scoreB !== '' && s.scoreB != null ? s.scoreA + '–' + s.scoreB : '';
  const box = modal('<h3>' + esc(s.a.name) + ' vs ' + esc(s.b.name) + (score ? ' · ' + esc(score) : '') + '</h3><p class="sx-hint">' + esc([fmtDate(s.gameDate), s.competition && s.competition.name, s.stage, s.mode, watched, s.venue, s.by].filter(Boolean).join(' · ')) + '</p>' +
    (s.note ? '<p>' + esc(s.note) + '</p>' : '') +
    (s.players.length ? '<div class="sx-reviewlist">' + s.players.map(x => '<button type="button" class="sx-reviewrow sx-click" data-open="' + escAttr(x.pid) + '"><span class="sx-rname"><b>' + esc(x.name) + '</b><small>' + esc(clubName(x.club)) + '</small></span>' + statusChip(x.status) + '</button>').join('') + '</div>' : '<p class="sx-hint">No players were reviewed in this session.</p>') +
    '<div class="sx-actions">' + (canEdit() ? '<button type="button" class="btn primary" id="sxEditBtn">Edit</button><button type="button" class="btn ghost" id="sxMergeBtn">Merge with…</button>' : '') + '<button type="button" class="btn ghost" data-teamlog="' + escAttr(s.a.key) + '"' + (s.a.key ? '' : ' hidden') + '>' + esc(s.a.name) + ' log</button><button type="button" class="btn ghost" data-teamlog="' + escAttr(s.b.key) + '"' + (s.b.key ? '' : ' hidden') + '>' + esc(s.b.name) + ' log</button><span style="flex:1"></span>' + (canEdit() ? '<button type="button" class="btn ghost" id="sxRemove">Delete</button>' : '') + '</div>', true);
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { closeModal(); openProfile(b.dataset.open); });
  box.querySelectorAll('[data-teamlog]').forEach(b => b.onclick = () => openTeamLog(b.dataset.teamlog));
  const ed = $1('#sxEditBtn', box); if (ed) ed.onclick = () => openEdit(id);
  const mg = $1('#sxMergeBtn', box); if (mg) mg.onclick = () => openMerge(id);
  const rm = $1('#sxRemove', box); if (rm) rm.onclick = async () => { if (!confirm('Delete this session? It is also removed from each player’s history. Notes stay.')) return; const real = await adopt(s); await remove(real.id); closeModal(); if (STATE.view === 'scoutlog') renderLog(); };
}

/* ── wiring into the app ───────────────────────────────── */
const renderBase = render;
render = function () {
  if (STATE.view === 'scoutlog') {
    renderLog();
    document.querySelectorAll('#tabs [data-view]').forEach(b => { const on = b.dataset.view === 'scoutlog'; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    return;
  }
  renderBase();
};
function addNav() {
  const tabs = document.getElementById('tabs'); if (!tabs || tabs.querySelector('[data-view=scoutlog]')) return;
  const b = document.createElement('button'); b.type = 'button'; b.dataset.view = 'scoutlog'; b.textContent = 'Scouting log';
  b.onclick = () => { STATE.view = 'scoutlog'; render(); };
  const after = tabs.querySelector('[data-view=scouting]'); if (after) after.after(b); else tabs.appendChild(b);
}
addNav();

/* Player profile → Reports: the scouting history, above the older viewing log. */
const profileBase = renderProfile;
renderProfile = function () {
  profileBase();
  try {
    const p = player(CURRENT), host = document.getElementById('es-panel-Reports'); if (!p || !host || host.querySelector('.sx-history')) return;
    const card = document.createElement('section'); card.className = 'panel es-panel sx-history';
    card.innerHTML = '<h3>Scouting history</h3>' + timelineHTML(p);
    host.prepend(card);
  } catch (e) { console.warn('Scouting history unavailable', e); }
};

/* Team page: a way into the Team Log. */
const teamBase = renderTeam;
renderTeam = function () {
  teamBase();
  try {
    const L = STATE.league, h = document.querySelector('#app h1'); if (!L || !h || typeof CURRENT_TEAM === 'undefined' || document.getElementById('sxTeamLogBtn')) return;
    const key = canonKey(L.meta.id + '|' + CURRENT_TEAM), t = teamLog(key);
    const b = document.createElement('button'); b.type = 'button'; b.id = 'sxTeamLogBtn'; b.className = 'btn ghost sm sx-teamlogbtn';
    b.textContent = 'Team log · ' + (t.games.length ? t.games.length + ' game' + (t.games.length === 1 ? '' : 's') + ' · familiarity ' + t.score : 'not watched yet');
    b.onclick = () => openTeamLog(key);
    h.after(b);
  } catch (e) { console.warn('Team log button unavailable', e); }
};

window.ESSessions = { STATUS, DWELL_MS, active, start, update, select, setStock, stockOf, markOf, review, finish, discard, remove, adopt, saveEdit, merge, openEdit, openMerge, all, everything,
  me, teamLog, teamLogs, coverage, compsFor, knownGames, timeline, openStart, openFinish, openTeamLog, openPlayerLog, openSession, fmtDate, fmtTime, clock, modal, closeModal, hash };
})();
