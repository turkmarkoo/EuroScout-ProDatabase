(function () {
  'use strict';

  const CLUB_WATCH_KEY = 'euroscout:watched-clubs:v1';
  const watchSet = () => {
    try { return new Set(JSON.parse(localStorage.getItem(CLUB_WATCH_KEY) || '[]')); }
    catch (_) { return new Set(); }
  };
  const saveWatchSet = set => {
    try {
      localStorage.setItem(CLUB_WATCH_KEY, JSON.stringify([...set]));
      try { Sync.stampKey(CLUB_WATCH_KEY); Store.pushAppKey(CLUB_WATCH_KEY); } catch (_) {}
    }
    catch (_) { toast('Club watchlist could not be saved on this device.'); }
  };
  const numeric = value => Number.isFinite(Number(value)) && value !== '' && value != null ? Number(value) : null;
  const shortPosition = p => ({Guard:'G', Forward:'F', Big:'B'})[dbPositionGroup(p)] || '—';
  const photo = p => {
    const src = photoOf(p);
    return `<span class="rbv2Photo">${src ? `<img src="${escAttr(src)}" alt="" loading="lazy" onerror="this.remove()">` : esc(initials(p.name))}</span>`;
  };

  window.renderNextRosterV2 = function renderNextRosterV2(club) {
    if (!STATE._extraDone && !STATE._rosterHistoryLoading) {
      STATE._rosterHistoryLoading = true;
      loadExtraLeagues().catch(e => toast(e.message)).finally(() => { STATE._rosterHistoryLoading = false; });
    }
    if (STATE.rbv2Club !== club.key) { STATE.rbv2Club = club.key; STATE.rbv2Position = 'All'; }
    const assignment = next26Get();
    const previous = clubRoster2526(club);
    const current = uniqueRosterPeople(clubRoster2627(club, assignment).map(rosterHistory));
    const inPrevious = p => previous.some(x => sameRosterPerson(x,p));
    const inCurrent = p => current.some(x => sameRosterPerson(x,p));
    const arrived = current.filter(p => !inPrevious(p));
    const departed = previous.filter(p => !inCurrent(p));
    const age = current.map(p => numeric(p.age)).filter(v => v != null && v > 0);
    const height = current.map(p => numeric(p.height)).filter(v => v != null && v > 0);
    const avg = list => list.length ? (list.reduce((a,b) => a+b, 0) / list.length).toFixed(1) : '—';
    const watched = watchSet().has(club.key);
    const position = STATE.rbv2Position || 'All';
    const keep = p => position === 'All' || dbPositionGroup(p) === position;
    const country = club.country ? countryLabel(club.country) || club.country : '';
    const comps = [...new Set([...domCompsOf(club), ...nextCompsOf(club)].map(c => c.name))];
    const clubTeam = (club.teams || []).find(t => t.logo) || (club.teams || [])[0];
    const profileButton = clubTeam ? `<button class="btn ghost rbv2Action" id="rbv2ClubProfile" type="button">View club profile ↗</button>` : '';
    const metric = (value, label, icon) => `<div class="rbv2Metric"><span class="rbv2MetricIcon" aria-hidden="true">${icon}</span><span><strong>${value}</strong><small>${label}</small></span></div>`;
    const status = (p, onCurrent) => onCurrent
      ? (inPrevious(p) ? 'STAYS' : 'NEW')
      : (inCurrent(p) ? 'STAYS' : 'OUT');
    const lastTeam = (p, onCurrent) => {
      if (!onCurrent || inPrevious(p)) return club.name;
      const name = p.teamName || '';
      return normClub(name) === normClub(club.name) ? '—' : (name || '—');
    };
    const row = (p, onCurrent) => {
      const mark = status(p, onCurrent);
      const rating = statGradeOverall(p);
      const pid = escAttr(p.id);
      return `<div class="rbv2Player" data-pid="${pid}">
        ${photo(p)}
        <button type="button" class="rbv2Name" data-open="${pid}" title="Open ${escAttr(p.name)}">${esc(p.name)}</button>
        <span class="rbv2Cell" title="${escAttr(dbPositionGroup(p) || 'Unknown position')}">${shortPosition(p)}</span>
        <span class="rbv2Cell">${numeric(p.age) ?? '—'}</span>
        <span class="rbv2Cell">${numeric(p.height) ?? '—'}</span>
        <span class="rbv2Last" title="${escAttr(lastTeam(p, onCurrent))}">${esc(lastTeam(p, onCurrent))}</span>
        <span class="rbv2Status rbv2Status${mark}">${mark}</span>
        <span class="rbv2Rating">${rating == null ? '—' : Number(rating).toFixed(1)}</span>
        <button type="button" class="rbv2Icon${isWatched(p) ? ' active' : ''}" data-watch="${pid}" aria-label="${isWatched(p) ? 'Remove from' : 'Add to'} player watchlist" title="Player watchlist">${isWatched(p) ? '★' : '☆'}</button>
        <button type="button" class="rbv2Icon rbv2Open" data-open="${pid}" aria-label="Open ${escAttr(p.name)} profile">›</button>
      </div>`;
    };
    const panel = (year, subtitle, players, onCurrent) => `<section class="rbv2Panel ${onCurrent ? 'rbv2Current' : 'rbv2Previous'}">
      <div class="rbv2PanelHead"><div><h2>${year} <span>${players.length}</span></h2><p>${subtitle}</p></div></div>
      <div class="rbv2Columns" aria-hidden="true"><span>PLAYER</span><span>POS</span><span>AGE</span><span>HT</span><span>LAST TEAM</span><span>STATUS</span><span>RATING</span><span></span><span></span></div>
      <div class="rbv2Rows">${players.filter(keep).length ? players.filter(keep).map(p => row(p,onCurrent)).join('') : `<div class="rbv2Empty">${players.length ? 'No players at this position.' : 'No roster recorded yet.'}</div>`}</div>
      ${onCurrent ? `<button type="button" class="rbv2AddRow" id="rbv2AddBottom"><span>＋</span> Add a player to ${esc(club.name)}...</button>` : ''}
    </section>`;

    $('#app').innerHTML = `<div class="view rbv2Page">
      <nav class="rbv2Breadcrumb"><button type="button" id="rbv2Back">←&nbsp; Teams</button><span>›</span><span>${esc(club.name)}</span></nav>
      <div class="rbv2Identity"><div class="rbv2ClubLogo">${clubBadge(club,72)}</div><div class="rbv2ClubText"><h1>${esc(club.name)}</h1><p>${country ? `<span>${esc(country)}</span>` : ''}${comps.map(c => `<span>${esc(c)}</span>`).join('')}</p></div><div class="rbv2HeaderActions"><label>Season<select id="rbv2Season"><option value="2026/27" selected>2026/27</option><option value="2025/26">2025/26</option></select></label>${profileButton}<button class="btn ghost rbv2Action${watched ? ' rbv2ClubWatched' : ''}" id="rbv2ClubWatch" type="button" aria-pressed="${watched}">${watched ? '★ Watching club' : '☆ Add to watchlist'}</button></div></div>
      <div class="rbv2Toolbar"><div class="rbv2Metrics">${metric(previous.length,'Players','♙')}${metric(current.length,'Confirmed','✓')}${metric(arrived.length,'New','＋')}${metric(departed.length,'Departures','↗')}${metric(avg(age),'Average age','⌁')}${metric(avg(height)+' cm','Average height','↕')}</div><div class="rbv2Filters" role="group" aria-label="Filter by position">${['All','Guard','Forward','Big'].map(pos => `<button type="button" class="${position === pos ? 'selected' : ''}" data-position="${pos}" aria-pressed="${position === pos}">${pos === 'All' ? 'All' : pos + 's'}</button>`).join('')}</div><button type="button" class="btn rbv2AddTop" id="rbv2AddTop">＋ Add player</button></div>
      <main class="rbv2Compare">${panel('2025/26','Previous season roster',previous,false)}${panel('2026/27','Current roster',current,true)}</main>
    </div>`;

    $('#rbv2Back').onclick = () => { STATE.nextTeam = null; renderTeams(); };
    $('#rbv2Season').onchange = e => {
      if (e.target.value === '2025/26') { STATE.nextTeam = null; STATE.teamsMode = 'current'; STATE.curTeam = {club:club.key}; renderTeams(); }
    };
    if (clubTeam) $('#rbv2ClubProfile').onclick = () => openTeamIn(clubTeam.lg,clubTeam.code);
    $('#rbv2ClubWatch').onclick = () => {
      const set = watchSet(); if (set.has(club.key)) set.delete(club.key); else set.add(club.key);
      saveWatchSet(set); renderTeams();
    };
    $$('.rbv2Filters button').forEach(b => b.onclick = () => { STATE.rbv2Position = b.dataset.position; renderTeams(); });
    $$('.rbv2Player [data-open]').forEach(b => b.onclick = () => openProfile(b.dataset.open));
    $$('.rbv2Player [data-watch]').forEach(b => b.onclick = async () => { await toggleTag(b.dataset.watch,WATCH_TAG); renderTeams(); });
    $('#rbv2AddTop').onclick = () => openRosterPlayerSearch(club);
    $('#rbv2AddBottom').onclick = () => openRosterPlayerSearch(club);
  };

  window.renderNextRoster = window.renderNextRosterV2;

  function openRosterPlayerSearch(club) {
    const old = document.getElementById('rbv2SearchDialog'); if (old) old.remove();
    const dialog = document.createElement('dialog'); dialog.id = 'rbv2SearchDialog'; dialog.className = 'rbv2SearchDialog';
    dialog.innerHTML = `<div class="rbv2SearchHead"><div><h2>Add a player</h2><p>Search the database to add a player to ${esc(club.name)}.</p></div><button class="rbv2Close" type="button" aria-label="Close">×</button></div><input id="rbv2SearchInput" type="search" placeholder="Search players by name..." autocomplete="off" aria-label="Search players"><div class="rbv2SearchResults" id="rbv2SearchResults">Enter at least two letters.</div>`;
    document.body.appendChild(dialog);
    const close = () => dialog.close();
    dialog.querySelector('.rbv2Close').onclick = close;
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    const input = dialog.querySelector('#rbv2SearchInput'); input.focus();
    input.oninput = () => {
      const q = input.value.trim(); const results = dialog.querySelector('#rbv2SearchResults');
      if (q.length < 2) { results.textContent = 'Enter at least two letters.'; return; }
      const needle = searchFold(q);
      const existing = new Set(clubRoster2627(club).map(gid));
      const hits = assignPool().filter(p => !existing.has(gid(p)) && searchFold(p.name).includes(needle)).slice(0,30);
      results.innerHTML = hits.length ? hits.map(p => {
        const assigned = effective26(p); const other = assigned && !isStatus(assigned) ? clubByKey(assigned) : null;
        return `<div class="rbv2SearchHit">${photo(p)}<span><strong>${esc(p.name)}</strong><small>${esc(dbPositionGroup(p) || 'Position unknown')} · ${esc(other?.name || p.teamName || 'No current club')}</small></span><button type="button" class="btn ghost" data-add="${escAttr(p.id)}">${other ? 'Move here' : 'Add'}</button></div>`;
      }).join('') : '<div class="rbv2Empty">No matching players found.</div>';
      results.querySelectorAll('[data-add]').forEach(button => button.onclick = () => { set26(button.dataset.add,club.key); close(); renderTeams(); });
    };
  }
})();
