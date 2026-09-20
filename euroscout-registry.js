/* Shared registry and safe roster-merge primitives.  This module is side-effect free. */
(function (root) {
  'use strict';

  const PUBLIC_FIELDS = [
    'name', 'aliases', 'dob', 'born', 'country', 'pos', 'role', 'height',
    'weight', 'img', 'profile', 'teamName', 'league', 'rosterSeason', 'jersey'
  ];
  const INTERNAL_FIELDS = new Set([
    'notes', 'rating', 'ratings', 'watchlist', 'estimatedLevel', 'level',
    'status', 'manual', 'manualLevel', 'overrides', 'gameLog', 'arch', 'pct', 'z'
  ]);

  const clean = value => String(value == null ? '' : value).trim();
  const fold = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const identityKey = record => {
    const ids = [record.playerId, record.sourceId, record.id, ...(record.ids || [])]
      .map(clean).filter(Boolean);
    return ids.find(id => /\|/.test(id) || /^[a-z]+[-:]/i.test(id)) || ids[0] || '';
  };
  const birthKey = record => clean(record.dob) || (record.born ? String(record.born) : '');
  const personKey = record => `${fold(record.name)}|${birthKey(record)}`;

  function buildRegistry({ competitions = [], clubs = [], players = [] } = {}) {
    const registry = {
      competitions: new Map(), clubs: new Map(), players: new Map(), aliases: new Map()
    };
    competitions.forEach(c => registry.competitions.set(c.id, { ...c }));
    clubs.forEach(c => {
      const copy = { ...c, aliases: [...new Set([...(c.aliases || []), c.name].filter(Boolean))] };
      registry.clubs.set(c.id, copy);
      copy.aliases.forEach(alias => registry.aliases.set(fold(alias), c.id));
    });
    players.forEach(p => {
      const key = identityKey(p) || personKey(p);
      if (key) registry.players.set(key, { ...p, playerId: p.playerId || key });
    });
    return registry;
  }

  function resolveClub(registry, incoming) {
    const id = clean(incoming.clubId || incoming.teamId);
    if (id && registry.clubs.has(id)) return { clubId: id, method: 'id' };
    const name = clean(incoming.clubName || incoming.teamName || incoming.team);
    const aliasId = registry.aliases.get(fold(name));
    if (aliasId) return { clubId: aliasId, method: 'alias' };
    return { clubId: null, method: name ? 'unmatched' : 'missing' };
  }

  function resolvePlayer(registry, incoming) {
    const id = identityKey(incoming);
    if (id && registry.players.has(id)) return { playerId: registry.players.get(id).playerId || id, method: 'id' };
    const key = personKey(incoming);
    const samePerson = [...registry.players.values()].filter(p => personKey(p) === key);
    if (samePerson.length === 1) return { playerId: samePerson[0].playerId, method: 'name_birth' };
    if (samePerson.length > 1) return { playerId: null, method: 'ambiguous' };
    return { playerId: null, method: 'new' };
  }

  function publicPatch(existing, incoming, clubId, competitionId) {
    const patch = {};
    PUBLIC_FIELDS.forEach(field => {
      if (incoming[field] !== undefined && incoming[field] !== null && clean(incoming[field]) !== '') patch[field] = incoming[field];
    });
    if (clubId) patch.clubId = clubId;
    if (competitionId) patch.competitionId = competitionId;
    return patch;
  }

  function validateRoster(roster) {
    const invalid = [];
    const seen = new Set();
    (roster || []).forEach((incoming, index) => {
      const id = identityKey(incoming);
      if (incoming && incoming._strictIdentity && !id) invalid.push({ index, reason: 'missing_stable_source_id', incoming });
      if (!clean(incoming && incoming.name)) invalid.push({ index, reason: 'missing_player_name', incoming });
      if (id && seen.has(id)) invalid.push({ index, reason: 'duplicate_stable_source_id', id, incoming });
      if (id) seen.add(id);
    });
    return invalid;
  }

  function previewRosterImport(registry, roster, { competitionId = null } = {}) {
    const result = { created: [], matched: [], ambiguous: [], unmatchedClubs: [], changes: [], invalid: validateRoster(roster) };
    roster.forEach(incoming => {
      const club = resolveClub(registry, incoming);
      if (club.method === 'unmatched') result.unmatchedClubs.push(incoming.teamName || incoming.team);
      const player = resolvePlayer(registry, incoming);
      if (player.method === 'ambiguous') {
        result.ambiguous.push({ incoming, reason: 'name_birth_matches_multiple_players' });
        return;
      }
      if (player.method === 'new') {
        result.created.push({ incoming, clubId: club.clubId, competitionId });
        return;
      }
      const existing = [...registry.players.values()].find(p => p.playerId === player.playerId);
      const patch = publicPatch(existing, incoming, club.clubId, competitionId);
      const changed = Object.keys(patch).some(k => JSON.stringify(existing[k] ?? null) !== JSON.stringify(patch[k]));
      result.matched.push({ playerId: player.playerId, method: player.method, patch });
      if (changed) result.changes.push({ playerId: player.playerId, patch });
    });
    result.unmatchedClubs = [...new Set(result.unmatchedClubs.filter(Boolean))];
    return result;
  }

  function applyRosterImport(registry, roster, options = {}) {
    const preview = previewRosterImport(registry, roster, options);
    if (preview.invalid.length || preview.ambiguous.length || preview.unmatchedClubs.length) return { applied: false, preview };
    const created = preview.created.map(({ incoming, clubId, competitionId }) => ({
      ...incoming, playerId: identityKey(incoming) || personKey(incoming), clubId, competitionId,
      _rosterOnly: true, _strictIdentity: true
    }));
    const updated = preview.changes.map(change => {
      const existing = [...registry.players.values()].find(p => p.playerId === change.playerId);
      return { ...existing, ...change.patch };
    });
    return { applied: true, preview, created, updated, internalFieldsPreserved: [...INTERNAL_FIELDS] };
  }

  root.EuroScoutRegistry = { PUBLIC_FIELDS, buildRegistry, resolveClub, resolvePlayer, validateRoster, previewRosterImport, applyRosterImport };
})(window);
