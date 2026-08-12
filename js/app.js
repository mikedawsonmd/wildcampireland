/* WildCamp Ireland — app */
(function () {
  'use strict';

  const SPOTS = window.SPOTS || [];

  const TYPE_META = {
    beach:    { emoji: '🏖️', label: 'Beach' },
    lake:     { emoji: '🌊', label: 'Lough' },
    mountain: { emoji: '⛰️', label: 'Mountain' },
    forest:   { emoji: '🌲', label: 'Forest & glen' },
    coast:    { emoji: '🌅', label: 'Coast' },
    island:   { emoji: '🏝️', label: 'Island' },
    trail:    { emoji: '🥾', label: 'Hiking trail' },
    river:    { emoji: '💧', label: 'River & falls' },
  };
  const ACCESS_META = {
    hike:  { emoji: '🥾', label: 'Hike-in' },
    walk:  { emoji: '🚶', label: 'Short walk' },
    drive: { emoji: '🚐', label: 'Drive-up' },
  };
  const FAC_META = {
    toilets: { emoji: '🚻', label: 'Toilets' },
    water:   { emoji: '🚰', label: 'Drinking water' },
    pub:     { emoji: '🍺', label: 'Pub' },
    food:    { emoji: '🍳', label: 'Café / food' },
    shop:    { emoji: '🛒', label: 'Shop' },
    shower:  { emoji: '🚿', label: 'Shower' },
    parking: { emoji: '🅿️', label: 'Parking' },
  };

  // ---------- state ----------
  const state = {
    type: 'all',
    county: 'all',
    facs: new Set(),
    maxWalk: 45,
    favesOnly: false,
    view: 'map',
  };

  const FAVE_KEY = 'wildcamp-ireland-faves';
  let faves = new Set(JSON.parse(localStorage.getItem(FAVE_KEY) || '[]'));
  const saveFaves = () => localStorage.setItem(FAVE_KEY, JSON.stringify([...faves]));

  // ---------- map ----------
  const map = L.map('map', { zoomControl: false }).setView([53.4, -7.9], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = new Map(); // id -> marker

  function tentIcon(spot) {
    const faved = faves.has(spot.id) ? ' faved' : '';
    return L.divIcon({
      className: 'tent-marker' + faved,
      html: `<div class="pin"><span>⛺</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30],
    });
  }

  function popupHtml(spot) {
    const t = TYPE_META[spot.type];
    return `<div class="popup-name">${t.emoji} ${spot.name}</div>
      <div class="popup-sub">Co. ${spot.county} · ${t.label}</div>
      <button class="popup-link" data-open="${spot.id}">See details →</button>`;
  }

  SPOTS.forEach(spot => {
    const m = L.marker([spot.lat, spot.lng], { icon: tentIcon(spot) })
      .bindPopup(popupHtml(spot));
    m.on('popupopen', (e) => {
      e.popup.getElement().querySelector('[data-open]')
        .addEventListener('click', () => openSheet(spot));
    });
    markers.set(spot.id, m);
  });

  // ---------- filtering ----------
  function spotMatches(spot) {
    if (state.type !== 'all' && spot.type !== state.type) return false;
    if (state.county !== 'all' && spot.county !== state.county) return false;
    if (state.favesOnly && !faves.has(spot.id)) return false;
    for (const f of state.facs) {
      const fac = spot.facilities[f];
      if (!fac || fac.min > state.maxWalk) return false;
    }
    return true;
  }

  function visibleSpots() { return SPOTS.filter(spotMatches); }

  function render() {
    const vis = visibleSpots();
    // markers
    SPOTS.forEach(spot => {
      const m = markers.get(spot.id);
      const show = vis.includes(spot);
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) m.remove();
    });
    // cards
    const cards = document.getElementById('cards');
    cards.innerHTML = vis.map(cardHtml).join('');
    document.getElementById('emptyState').hidden = vis.length > 0;
    document.getElementById('resultCount').textContent =
      `${vis.length} spot${vis.length === 1 ? '' : 's'}`;
    // faves count
    document.getElementById('favesCount').textContent = faves.size;
    document.getElementById('favesToggle').classList.toggle('has-faves', faves.size > 0);
    // card handlers
    cards.querySelectorAll('.card').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.fave-btn')) return;
        openSheet(SPOTS.find(s => s.id === +el.dataset.id));
      });
    });
    cards.querySelectorAll('.fave-btn').forEach(el => {
      el.addEventListener('click', () => toggleFave(+el.dataset.fave));
    });
  }

  function cardHtml(spot) {
    const t = TYPE_META[spot.type];
    const a = ACCESS_META[spot.access];
    const faved = faves.has(spot.id);
    const hike = spot.access !== 'drive' && spot.hikeKm > 0
      ? ` · ${spot.hikeKm} km walk-in` : '';
    const facBadges = Object.entries(spot.facilities)
      .sort((x, y) => x[1].min - y[1].min).slice(0, 4)
      .map(([k, v]) => `<span class="badge fac">${FAC_META[k].emoji} ${v.min} min</span>`)
      .join('');
    return `<article class="card" data-id="${spot.id}">
      <button class="fave-btn${faved ? ' faved' : ''}" data-fave="${spot.id}"
              aria-label="Favourite ${spot.name}">♥</button>
      <div class="card-head">
        <span class="card-emoji">${t.emoji}</span>
        <div class="card-titles">
          <h3>${spot.name}</h3>
          <div class="card-sub">Co. ${spot.county} · ${t.label}</div>
        </div>
      </div>
      <p class="card-desc">${spot.desc}</p>
      <div class="card-badges">
        <span class="badge access">${a.emoji} ${a.label}${hike}</span>
        ${facBadges}
      </div>
    </article>`;
  }

  // ---------- favourites ----------
  function toggleFave(id) {
    if (faves.has(id)) faves.delete(id); else faves.add(id);
    saveFaves();
    const m = markers.get(id);
    m.setIcon(tentIcon(SPOTS.find(s => s.id === id)));
    render();
    const sheetBtn = document.querySelector('.sheet-fave');
    if (sheetBtn && +sheetBtn.dataset.fave === id) {
      sheetBtn.classList.toggle('faved', faves.has(id));
    }
  }

  // ---------- detail sheet ----------
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('sheetBackdrop');

  function openSheet(spot) {
    const t = TYPE_META[spot.type];
    const a = ACCESS_META[spot.access];
    const faved = faves.has(spot.id);
    const facs = Object.entries(spot.facilities).sort((x, y) => x[1].min - y[1].min);
    const facHtml = facs.length
      ? `<div class="fac-grid">` + facs.map(([k, v]) => `
          <div class="fac-item">
            <span class="fi-emoji">${FAC_META[k].emoji}</span>
            <div>${FAC_META[k].label} · <span class="fi-min">~${v.min} min walk</span>
              ${v.name ? `<span class="fi-name">${v.name}</span>` : ''}
            </div>
          </div>`).join('') + `</div>
         <p class="photo-note">Walking times estimated from OpenStreetMap — check locally.</p>`
      : `<p class="fac-none">Nothing mapped within a 6 km walk — this one's properly wild. Bring everything. 🎒</p>`;
    const hike = spot.access !== 'drive' && spot.hikeKm > 0
      ? ` · about ${spot.hikeKm} km on foot to reach` : '';
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=driving`;
    const amaps = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}`;
    const gphotos = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + spot.county + ' Ireland')}`;

    document.getElementById('sheetBody').innerHTML = `
      <button class="sheet-fave${faved ? ' faved' : ''}" data-fave="${spot.id}"
              aria-label="Favourite">♥</button>
      <h2>${t.emoji} ${spot.name}</h2>
      <div class="card-sub">Co. ${spot.county} · ${t.label} · ${a.emoji} ${a.label}${hike}</div>
      <p class="sheet-desc">${spot.desc}</p>
      <div class="sheet-section">
        <h3>📸 Around the spot</h3>
        <div class="photo-strip" id="photoStrip"><span class="fac-none">Looking for photos…</span></div>
        <p class="photo-note">Photos from Wikimedia Commons near these coordinates.
           More on <a href="${gphotos}" target="_blank" rel="noopener">Google Maps →</a></p>
      </div>
      <div class="sheet-section">
        <h3>🚻 Facilities within walking distance</h3>
        ${facHtml}
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="${gmaps}" target="_blank" rel="noopener">🧭 Navigate</a>
        <a class="btn btn-secondary" href="${amaps}" target="_blank" rel="noopener"> Apple Maps</a>
      </div>
      <div class="src-links">Sourced from:
        ${spot.src.map(u => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace('www.','')}</a>`).join(' · ')}
      </div>`;

    sheet.hidden = false; backdrop.hidden = false;
    document.querySelector('.sheet-fave').addEventListener('click', () => toggleFave(spot.id));
    loadPhotos(spot);
    sheet.scrollTop = 0;
  }

  function closeSheet() { sheet.hidden = true; backdrop.hidden = true; }
  backdrop.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet.querySelector('.sheet-handle')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); closeAbout(); }
  });

  // ---------- photos (Wikimedia Commons geosearch) ----------
  const photoCache = new Map();
  async function loadPhotos(spot) {
    const strip = document.getElementById('photoStrip');
    try {
      let imgs = photoCache.get(spot.id);
      if (!imgs) {
        const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
          '&generator=geosearch&ggscoord=' + spot.lat + '%7C' + spot.lng +
          '&ggsradius=3000&ggslimit=12&ggsnamespace=6' +
          '&prop=imageinfo&iiprop=url&iiurlwidth=480';
        const res = await fetch(url);
        const data = await res.json();
        imgs = Object.values(data?.query?.pages || {})
          .map(p => p.imageinfo?.[0])
          .filter(ii => ii && /\.(jpe?g|png)$/i.test(ii.thumburl || ''))
          .slice(0, 8);
        photoCache.set(spot.id, imgs);
      }
      if (!imgs.length) {
        strip.innerHTML = '<span class="fac-none">No photos mapped here yet — it really is off the beaten track. 🌿</span>';
        return;
      }
      strip.innerHTML = imgs.map(ii =>
        `<a href="${ii.descriptionurl}" target="_blank" rel="noopener"><img src="${ii.thumburl}" alt="Photo near ${spot.name}" loading="lazy"></a>`
      ).join('');
    } catch {
      strip.innerHTML = '<span class="fac-none">Couldn\'t load photos (offline?).</span>';
    }
  }

  // ---------- about sheet ----------
  const aboutSheet = document.getElementById('aboutSheet');
  const aboutBackdrop = document.getElementById('aboutBackdrop');
  function openAbout() { aboutSheet.hidden = false; aboutBackdrop.hidden = false; }
  function closeAbout() { aboutSheet.hidden = true; aboutBackdrop.hidden = true; }
  document.getElementById('aboutBtn').addEventListener('click', openAbout);
  document.getElementById('aboutClose').addEventListener('click', closeAbout);
  aboutBackdrop.addEventListener('click', closeAbout);

  // ---------- filter wiring ----------
  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.type = chip.dataset.type;
      render();
    });
  });

  const countySelect = document.getElementById('countySelect');
  [...new Set(SPOTS.map(s => s.county))].sort().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = 'Co. ' + c;
    countySelect.appendChild(o);
  });
  countySelect.addEventListener('change', () => { state.county = countySelect.value; render(); });

  const facPanel = document.getElementById('facilitiesPanel');
  document.getElementById('facilitiesBtn').addEventListener('click', () => {
    facPanel.hidden = !facPanel.hidden;
  });
  document.querySelectorAll('#facChecks input').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.facs.add(cb.value); else state.facs.delete(cb.value);
      updateFacCount(); render();
    });
  });
  const walkRange = document.getElementById('walkRange');
  walkRange.addEventListener('input', () => {
    state.maxWalk = +walkRange.value;
    document.getElementById('walkLabel').textContent = walkRange.value + ' min';
    render();
  });
  document.getElementById('clearFac').addEventListener('click', () => {
    state.facs.clear();
    document.querySelectorAll('#facChecks input').forEach(cb => cb.checked = false);
    updateFacCount(); render();
  });
  function updateFacCount() {
    const el = document.getElementById('facFilterCount');
    el.hidden = state.facs.size === 0;
    el.textContent = state.facs.size;
  }

  document.getElementById('favesToggle').addEventListener('click', (e) => {
    state.favesOnly = !state.favesOnly;
    e.currentTarget.classList.toggle('active', state.favesOnly);
    e.currentTarget.setAttribute('aria-pressed', state.favesOnly);
    render();
  });

  // ---------- view switch ----------
  const viewMap = document.getElementById('viewMap');
  const viewList = document.getElementById('viewList');
  function setView(v) {
    state.view = v;
    document.body.classList.toggle('view-list', v === 'list');
    viewMap.classList.toggle('active', v === 'map');
    viewList.classList.toggle('active', v === 'list');
    if (v === 'map') setTimeout(() => map.invalidateSize(), 60);
  }
  viewMap.addEventListener('click', () => setView('map'));
  viewList.addEventListener('click', () => setView('list'));

  // first visit: show the camping code
  if (!localStorage.getItem('wildcamp-ireland-seen')) {
    localStorage.setItem('wildcamp-ireland-seen', '1');
    setTimeout(openAbout, 600);
  }

  render();
})();
