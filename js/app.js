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
  const CAMP_META = {
    tent: { emoji: '⛺', label: 'Tent' },
    van:  { emoji: '🚐', label: 'Campervan' },
    both: { emoji: '⛺🚐', label: 'Tent or van' },
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
    camp: 'all',
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

  const LocateControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const btn = L.DomUtil.create('button', 'locate-btn');
      btn.id = 'locateBtn';
      btn.title = 'Show my location';
      btn.setAttribute('aria-label', 'Show my location');
      btn.innerHTML = '<span class="material-symbols-rounded">my_location</span>';
      L.DomEvent.on(btn, 'click', (e) => { L.DomEvent.stop(e); locateMe(); });
      return btn;
    },
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = new Map(); // id -> marker

  // ---------- geolocation ----------
  let youMarker = null;
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('unsupported'));
      navigator.geolocation.getCurrentPosition(
        p => resolve(L.latLng(p.coords.latitude, p.coords.longitude)),
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }
  function showYouAreHere(latlng) {
    if (youMarker) youMarker.remove();
    youMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'you-marker',
        html: '<div class="you-dot"></div>',
        iconSize: [22, 22], iconAnchor: [11, 11],
      }),
      zIndexOffset: 1000,
      interactive: false,
    }).addTo(map);
  }
  function locateMe() {
    const btn = document.getElementById('locateBtn');
    if (btn) btn.classList.add('locating');
    getPosition().then(latlng => {
      showYouAreHere(latlng);
      map.flyTo(latlng, Math.max(map.getZoom(), 11), { duration: 0.8 });
    }).catch(() => {
      alert("Couldn't get your location. Check that location access is allowed for this site.");
    }).finally(() => {
      if (btn) btn.classList.remove('locating');
    });
  }
  map.addControl(new LocateControl());

  function tentIcon(spot) {
    const faved = faves.has(spot.id);
    const glyph = faved ? '❤️' : (spot.camp === 'van' ? '🚐' : '⛺');
    return L.divIcon({
      className: 'tent-marker' + (faved ? ' faved' : '') + (spot.camp === 'van' ? ' van' : ''),
      html: `<div class="pin"><span>${glyph}</span></div>`,
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
    if (state.camp === 'tent' && spot.camp === 'van') return false;
    if (state.camp === 'van' && spot.camp === 'tent') return false;
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
    // markers show everything matching the filters
    SPOTS.forEach(spot => {
      const m = markers.get(spot.id);
      const show = vis.includes(spot);
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) m.remove();
    });
    // the list is additionally scoped to the visible map area
    const bounds = map.getBounds();
    const listed = vis.filter(s => bounds.contains([s.lat, s.lng]));
    const cards = document.getElementById('cards');
    cards.innerHTML = listed.map(cardHtml).join('');
    document.getElementById('emptyState').hidden = listed.length > 0;
    document.getElementById('resultCount').textContent =
      `${listed.length} spot${listed.length === 1 ? '' : 's'} in view`;
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
              aria-label="Favourite ${spot.name}"><span class="material-symbols-rounded">favorite</span></button>
      <div class="card-head">
        <span class="card-emoji">${t.emoji}</span>
        <div class="card-titles">
          <h3>${spot.name}</h3>
          <div class="card-sub">Co. ${spot.county} · ${t.label}</div>
        </div>
      </div>
      <p class="card-desc">${spot.desc}</p>
      <div class="card-badges">
        <span class="badge camp">${CAMP_META[spot.camp].emoji} ${CAMP_META[spot.camp].label}</span>
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
              aria-label="Favourite"><span class="material-symbols-rounded">favorite</span></button>
      <h2>${t.emoji} ${spot.name}</h2>
      <div class="card-sub">Co. ${spot.county} · ${t.label} · ${CAMP_META[spot.camp].emoji} ${CAMP_META[spot.camp].label} · ${a.emoji} ${a.label}${hike}</div>
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
        ${spot.src.map(u => {
          try { return `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace('www.','')}</a>`; }
          catch { return `<span>${u}</span>`; }
        }).join(' · ')}
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
    if (e.key === 'Escape' && document.getElementById('lightbox').hidden) {
      closeSheet(); closeAbout();
      document.getElementById('suggestSheet').hidden = true;
      document.getElementById('suggestBackdrop').hidden = true;
    }
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
          '&prop=imageinfo&iiprop=url&iiurlwidth=1024';
        const res = await fetch(url);
        const data = await res.json();
        imgs = Object.values(data?.query?.pages || {})
          .map(p => p.imageinfo?.[0])
          .filter(ii => ii && /\.(jpe?g|png)(\?|$)/i.test(ii.thumburl || ''))
          .slice(0, 8);
        photoCache.set(spot.id, imgs);
      }
      if (!imgs.length) {
        strip.innerHTML = '<span class="fac-none">No photos mapped here yet — it really is off the beaten track. 🌿</span>';
        return;
      }
      strip.innerHTML = imgs.map((ii, i) =>
        `<img src="${ii.thumburl}" alt="Photo near ${spot.name}" loading="lazy" data-gallery="${i}">`
      ).join('');
      strip.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => openLightbox(spot, imgs, +img.dataset.gallery));
      });
    } catch {
      strip.innerHTML = '<span class="fac-none">Couldn\'t load photos (offline?).</span>';
    }
  }

  // ---------- fullscreen gallery ----------
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  let lbState = { imgs: [], idx: 0, name: '' };

  function lbShow() {
    const ii = lbState.imgs[lbState.idx];
    lbImg.src = ii.thumburl;
    lbImg.alt = `Photo near ${lbState.name}`;
    document.getElementById('lbCaption').textContent = lbState.name;
    document.getElementById('lbCount').textContent =
      `${lbState.idx + 1} / ${lbState.imgs.length}`;
  }
  function openLightbox(spot, imgs, idx) {
    lbState = { imgs, idx, name: spot.name };
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lbShow();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    lbImg.src = '';
  }
  function lbStep(d) {
    const n = lbState.imgs.length;
    lbState.idx = (lbState.idx + d + n) % n;
    lbShow();
  }
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', () => lbStep(-1));
  document.getElementById('lbNext').addEventListener('click', () => lbStep(1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lb-stage')) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'ArrowLeft') lbStep(-1);
    if (e.key === 'ArrowRight') lbStep(1);
    if (e.key === 'Escape') closeLightbox();
  });

  // ---------- about sheet ----------
  const aboutSheet = document.getElementById('aboutSheet');
  const aboutBackdrop = document.getElementById('aboutBackdrop');
  function openAbout() { aboutSheet.hidden = false; aboutBackdrop.hidden = false; }
  function closeAbout() { aboutSheet.hidden = true; aboutBackdrop.hidden = true; }
  document.getElementById('aboutBtn').addEventListener('click', openAbout);
  document.getElementById('aboutClose').addEventListener('click', closeAbout);
  aboutBackdrop.addEventListener('click', closeAbout);

  // ---------- suggest a spot ----------
  const suggestSheet = document.getElementById('suggestSheet');
  const suggestBackdrop = document.getElementById('suggestBackdrop');
  const pickToast = document.getElementById('pickToast');
  let picking = false;
  let pickedLatLng = null;
  let pickMarker = null;

  const COUNTIES = ['Antrim','Armagh','Carlow','Cavan','Clare','Cork','Derry','Donegal',
    'Down','Dublin','Fermanagh','Galway','Kerry','Kildare','Kilkenny','Laois','Leitrim',
    'Limerick','Longford','Louth','Mayo','Meath','Monaghan','Offaly','Roscommon','Sligo',
    'Tipperary','Tyrone','Waterford','Westmeath','Wexford','Wicklow'];
  const sgCounty = document.getElementById('sgCounty');
  COUNTIES.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = 'Co. ' + c;
    sgCounty.appendChild(o);
  });

  function openSuggest() {
    suggestSheet.hidden = false; suggestBackdrop.hidden = false;
  }
  function closeSuggest() {
    suggestSheet.hidden = true; suggestBackdrop.hidden = true;
  }
  document.getElementById('suggestBtn').addEventListener('click', openSuggest);
  suggestBackdrop.addEventListener('click', closeSuggest);

  document.getElementById('sgPickBtn').addEventListener('click', () => {
    picking = true;
    closeSuggest();
    setView('map');
    pickToast.hidden = false;
    document.getElementById('map').style.cursor = 'crosshair';
  });
  function endPicking() {
    picking = false;
    pickToast.hidden = true;
    document.getElementById('map').style.cursor = '';
  }
  document.getElementById('pickCancel').addEventListener('click', () => {
    endPicking(); openSuggest();
  });

  function setPin(latlng) {
    pickedLatLng = latlng;
    if (pickMarker) pickMarker.remove();
    pickMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'tent-marker picking',
        html: '<div class="pin"><span>📍</span></div>',
        iconSize: [34, 34], iconAnchor: [17, 32],
      }),
    }).addTo(map);
    document.getElementById('sgCoords').textContent =
      `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  }

  document.getElementById('sgLocateBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    document.getElementById('sgCoords').textContent = 'Finding your location…';
    getPosition().then(latlng => {
      setPin(latlng);
      showYouAreHere(latlng);
    }).catch(() => {
      document.getElementById('sgCoords').textContent =
        "Couldn't get your location — try 'Pick on map'.";
    }).finally(() => { btn.disabled = false; });
  });
  map.on('click', (e) => {
    if (!picking) return;
    setPin(e.latlng);
    endPicking();
    openSuggest();
  });

  document.getElementById('suggestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('sgName').value.trim();
    const county = sgCounty.value;
    const type = document.getElementById('sgType').value;
    const camp = document.getElementById('sgCamp').value;
    const desc = document.getElementById('sgDesc').value.trim();
    const lat = pickedLatLng ? pickedLatLng.lat.toFixed(5) : '';
    const lng = pickedLatLng ? pickedLatLng.lng.toFixed(5) : '';
    const mapLink = pickedLatLng
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
      : '(no pin dropped)';
    // Plain-text, listing-ready format — one field per line for easy copy-paste.
    const body = [
      'New wild camping spot for WildCamp Ireland',
      '===========================================',
      '',
      `Name:        ${name}`,
      `County:      ${county}`,
      `Type:        ${type}`,
      `Good for:    ${camp}`,
      `Latitude:    ${lat || '(not provided)'}`,
      `Longitude:   ${lng || '(not provided)'}`,
      `Map:         ${mapLink}`,
      '',
      'Description (access, parking, walk-in, water, nearest pub):',
      desc,
      '',
      '-- Sent from the WildCamp Ireland suggest-a-spot form --',
    ].join('\n');
    const url = 'mailto:mikedawsonmd@protonmail.com' +
      '?subject=' + encodeURIComponent(`WildCamp Ireland — new spot: ${name} (Co. ${county})`) +
      '&body=' + encodeURIComponent(body);
    window.location.href = url;
  });

  // ---------- filter wiring ----------
  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.type = chip.dataset.type;
      render();
    });
  });

  document.querySelectorAll('.camp-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.camp-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.camp = opt.dataset.camp;
      render();
    });
  });

  const countySelect = document.getElementById('countySelect');
  [...new Set(SPOTS.map(s => s.county))].sort().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = 'Co. ' + c;
    countySelect.appendChild(o);
  });
  countySelect.addEventListener('change', () => {
    state.county = countySelect.value;
    if (state.county === 'all') {
      map.flyTo([53.4, -7.9], 7, { duration: 0.8 });
    } else {
      const pts = SPOTS.filter(s => s.county === state.county).map(s => [s.lat, s.lng]);
      if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.25), { duration: 0.8, maxZoom: 11 });
    }
    render();
  });

  // keep the list in sync with the visible map area
  map.on('moveend', render);

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
