# ⛺ WildCamp Ireland

A mobile-first web app for finding wild camping spots across the island of Ireland —
community-sourced from Reddit (r/WildCampingIreland, r/irishtourism) and Irish
outdoor blogs.

**Features**

- 🗺️ Map view (Leaflet + OpenStreetMap) and 📋 list view
- Filter by county, spot type (beach, lough, mountain, forest, coast, island, trail, river)
  and nearby facilities — based on **estimated walking time** from the camp spot
  (toilets, drinking water, pub, café, shop, shower, parking)
- ♥ Favourites, saved in the browser's localStorage
- 📸 Nearby photos pulled live from Wikimedia Commons, with a link to Google Maps photos
- 🧭 One-tap navigation to the spot (Google Maps / Apple Maps)
- ☘️ Leave-no-trace camping code shown on first visit

**Data**

`data/spots.js` contains ~60 hand-researched spots. Facility distances were computed
from OpenStreetMap via the Overpass API (nearest facility of each kind within 6 km,
walking time estimated as straight-line distance × 1.3 at 5 km/h). Regenerate with
the scripts in `tools/` if you add spots.

**Hosting on GitHub Pages**

1. Push this folder to a GitHub repository.
2. Repository → Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
3. Your app appears at `https://<username>.github.io/<repo>/`.

No build step, no dependencies to install — it's plain HTML/CSS/JS.

**Disclaimer**

Wild camping in Ireland generally happens on private or state land without a formal
right to camp. Spots listed here are places people have camped and written about —
not places where camping is officially permitted. Be discreet, ask when in doubt,
never light fires, and leave no trace.
