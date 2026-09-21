/* One game in player history, even when notes and sessions were updated repeatedly. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ESScoutingHistory = api;
})(globalThis, function() {
  'use strict';
  const rank = { up: 3, down: 3, notes: 2, none: 1 };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const day = value => String(value || '').slice(0, 10);
  function gameKey(event, date) {
    const teams = String(event || '').split(/\s+vs\s+/i).map(norm).sort();
    return teams.some(Boolean) ? day(date) + '|' + teams.join('|') : '';
  }
  function build(viewings = [], sessions = [], playerIds = []) {
    const ids = new Set(playerIds.map(String)), groups = new Map(), bySession = new Map();
    function add(item) {
      const key = gameKey(item.event, item.gameDate) ||
        (item.sessionId ? 'session:' + item.sessionId : 'viewing:' + item.id);
      let group = groups.get(key);
      if (!group) {
        group = { key, date: day(item.gameDate), title: item.event || 'Viewing',
          status: '', at: '', competition: '', mode: '', authors: new Set(),
          watched: new Set(), notes: new Set() };
        groups.set(key, group);
      }
      if (item.at >= group.at) {
        group.at = item.at;
        if (item.competition) group.competition = item.competition;
        if (item.mode) group.mode = item.mode;
      }
      if ((rank[item.status] || 0) > (rank[group.status] || 0) ||
          ((rank[item.status] || 0) === (rank[group.status] || 0) && item.at >= group.at))
        group.status = item.status;
      if (item.author) group.authors.add(item.author);
      for (const date of item.watched || []) if (date) group.watched.add(day(date));
      if (String(item.notes || '').trim()) group.notes.add(String(item.notes).trim());
      if (item.sessionId) bySession.set(item.sessionId, group);
    }
    for (const s of sessions) {
      const players = (s.players || []).filter(x => ids.has(String(x.id)) || ids.has(String(x.pid)));
      if (!players.length) continue;
      const event = [s.a?.name, s.b?.name].filter(Boolean).join(' vs ') || s.event || '';
      add({ id: s.id, sessionId: s.id, event, gameDate: s.gameDate,
        at: s.endedAt || s.startedAt || '', competition: s.competition?.name || '',
        mode: s.mode || '', author: s.by || '', watched: s.watchedOn || [],
        status: players.reduce((best, x) => (rank[x.status] || 0) > (rank[best] || 0) ? x.status : best, '') });
    }
    for (const v of viewings.filter(x => !x.removed)) {
      const linked = v.sessionId && sessions.find(s => s.id === v.sessionId);
      const event = linked ? [linked.a?.name, linked.b?.name].filter(Boolean).join(' vs ') || v.event : v.event;
      const gameDate = linked?.gameDate || v.gameDate || v.date;
      // A saved session can be present even when an older viewing has no game date.
      const existing = v.sessionId && bySession.get(v.sessionId);
      add({ id: v.id, sessionId: v.sessionId, event: existing?.title || event,
        gameDate: existing?.date || gameDate, at: v.updatedAt || v.date || '',
        competition: v.competition || linked?.competition?.name || '',
        mode: v.mode || linked?.mode || '', author: v.author || '',
        watched: [v.date], status: v.status || (v.source === 'matchup' ? 'notes' : ''), notes: v.notes });
    }
    return [...groups.values()].map(g => ({
      date: g.date, title: g.title, status: g.status, at: g.at,
      watched: [...g.watched].sort(), text: [...g.notes].join('\n'),
      competition: g.competition, mode: g.mode, authors: [...g.authors]
    })).sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
  }
  return { build, gameKey };
});
