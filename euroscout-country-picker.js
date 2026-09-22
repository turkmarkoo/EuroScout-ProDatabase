/* Shared country editor for player, club, agency and tournament forms. */
(function () {
  'use strict';
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(input, options = {}) {
    if (!input || input.dataset.countryPickerReady) return;
    input.dataset.countryPickerReady = '1';
    const countries = [...new Set(options.countries || window.COUNTRY_LIST || [])].filter(Boolean).sort((a,b) => a.localeCompare(b));
    const flag = country => typeof window.flagEmoji === 'function' ? window.flagEmoji(country) || '' : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'es-country-picker';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.type = 'search';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.autocomplete = 'off';
    input.placeholder = options.placeholder || 'Search countries…';
    const list = document.createElement('div');
    list.className = 'es-country-options';
    list.id = (input.id || 'country') + '-options';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    input.setAttribute('aria-controls', list.id);
    wrapper.appendChild(list);
    let selected = countries.find(c => fold(c) === fold(input.value)) || '';
    if (selected) input.value = selected;
    let active = -1;
    function matches() { const q = fold(input.value.trim()); return countries.filter(c => !q || fold(c).includes(q)); }
    function paint() {
      const values = matches();
      list.innerHTML = values.map((c,i) => '<button type="button" role="option" class="es-country-option" data-index="'+i+'" aria-selected="'+(c===selected)+'"><span aria-hidden="true">'+escape(flag(c))+'</span><span>'+escape(c)+'</span></button>').join('') || '<div class="es-country-empty">No matching country</div>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      list.querySelectorAll('button').forEach(button => button.onmousedown = event => { event.preventDefault(); choose(values[Number(button.dataset.index)]); });
    }
    function close() { list.hidden = true; input.setAttribute('aria-expanded','false'); active = -1; }
    function choose(country) {
      if (!country) return;
      selected = country;
      input.value = country;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      close();
    }
    input.addEventListener('focus', paint);
    input.addEventListener('input', () => { selected = ''; active = -1; paint(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); if (list.hidden) paint();
        const buttons = [...list.querySelectorAll('button')];
        active = Math.max(0,Math.min(buttons.length-1,active+(event.key==='ArrowDown'?1:-1)));
        buttons.forEach((button,i) => button.classList.toggle('active',i===active));
        buttons[active]?.scrollIntoView({block:'nearest'});
      }
      if (event.key === 'Enter' && !list.hidden) { event.preventDefault(); choose(matches()[Math.max(0,active)]); }
    });
    input.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement && wrapper.contains(document.activeElement)) return;
      if (input.value.trim()) input.value = countries.find(c => fold(c)===fold(input.value.trim())) || selected;
      close();
    }, 100));
    document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
  }
  function mountAll(root = document) { root.querySelectorAll('[data-country-picker]').forEach(input => mount(input)); }
  window.EuroScoutCountryPicker = {mount, mountAll};
})();
