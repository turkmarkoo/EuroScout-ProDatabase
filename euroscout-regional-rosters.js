/*
 * Parsers for the official regional player directories.
 *
 * These parsers intentionally return roster-only records. The normal merge
 * layer can reconcile them by source ID first, then by name + birth year. They
 * never replace historical statistics or user-owned fields.
 */
(function (root) {
  'use strict';

  const SOURCES = {
    lkl: { league: 'lkl', season: '2026/27', url: 'https://en.lkl.lt/zaidejai' },
    plk: { league: 'plk', season: '2026/27', url: 'https://plk.pl/zawodnicy' }
  };

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const slug = value => clean(value).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const yearFrom = value => { const m = clean(value).match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };
  const heightFrom = value => { const m = clean(value).match(/(\d{2,3})\s*cm/i); return m ? Number(m[1]) : null; };
  const sourceId = (league, name, href) => {
    const m = clean(href).match(/\/(?:zaidejai|zawodnicy)\/([^/?#]+)/i);
    return `${league}|${m ? m[1] : slug(name)}`;
  };

  function parseLkl(document) {
    return Array.from(document.querySelectorAll('table tbody tr')).map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const player = row.querySelector('a[href*="/zaidejai/"]');
      const team = row.querySelector('a[href*="/komandos/"]');
      if (!player || cells.length < 5) return null;
      const name = clean(player.textContent);
      const born = yearFrom(cells[1].textContent);
      return {
        id: sourceId('lkl', name, player.getAttribute('href')),
        sourceId: sourceId('lkl', name, player.getAttribute('href')),
        name, league: 'lkl', teamName: clean(team && team.textContent),
        born, height: heightFrom(cells[2].textContent), pos: clean(cells[4].textContent),
        country: clean(cells[1].textContent).replace(/(19|20)\d{2}.*$/s, '').trim(),
        profile: new URL(player.getAttribute('href'), SOURCES.lkl.url).href,
        source: SOURCES.lkl.url, rosterSeason: SOURCES.lkl.season,
        _rosterOnly: true, _strictIdentity: true
      };
    }).filter(Boolean);
  }

  function parsePlk(document) {
    const links = Array.from(document.querySelectorAll('a[href*="/zawodnicy/"]'));
    const seen = new Set();
    return links.map(link => {
      const name = clean(link.textContent);
      const href = link.getAttribute('href');
      const key = sourceId('plk', name, href);
      if (!name || seen.has(key)) return null;
      seen.add(key);
      const row = link.closest('tr') || link.parentElement;
      const text = clean(row && row.textContent);
      return {
        id: key, sourceId: key, name, league: 'plk', born: yearFrom(text),
        profile: new URL(href, SOURCES.plk.url).href, source: SOURCES.plk.url,
        rosterSeason: SOURCES.plk.season, _rosterOnly: true, _strictIdentity: true
      };
    }).filter(Boolean);
  }

  root.EuroScoutRegionalRosters = { SOURCES, parseLkl, parsePlk };
})(window);
