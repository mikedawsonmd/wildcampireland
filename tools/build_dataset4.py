import json, os, time, urllib.parse, urllib.request
from build_dataset import COORDS, classify, hav_km
from spots_base import SPOTS

R = 6000
SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.private.coffee/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter"]

def spot_query(lat, lng):
    a = lambda tag: (f'node(around:{R},{lat},{lng}){tag};'
                     f'way(around:{R},{lat},{lng}){tag};')
    return ("[out:json][timeout:25];("
            + a("[amenity=toilets]") + a("[amenity=drinking_water]")
            + a("[amenity=pub]") + a('[amenity~"^(cafe|restaurant|fast_food)$"]')
            + a('[shop~"^(supermarket|convenience|general)$"]')
            + a("[amenity=shower]") + a("[amenity=parking]")
            + ");out center tags;")

# resume support
done = {}
if os.path.exists("facilities_cache.json"):
    done = json.load(open("facilities_cache.json"))

srv = 0
for i, s in enumerate(SPOTS):
    name = s["name"]
    if name in done:
        continue
    lat, lng = COORDS[name]
    els = None
    for attempt in range(6):
        server = SERVERS[srv % len(SERVERS)]
        try:
            data = urllib.parse.urlencode({"data": spot_query(lat, lng)}).encode()
            req = urllib.request.Request(server, data=data,
                                         headers={"User-Agent": "WildCampIreland-builder/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                els = json.load(r).get("elements", [])
            break
        except Exception as e:
            print(f"  {name}: {server.split('/')[2]} -> {e}; rotating")
            srv += 1
            time.sleep(10)
    if els is None:
        print(f"{i+1:2d} {name}: FAILED, will retry on next run")
        continue
    fac = {}
    for el in els:
        elat = el.get("lat") or el.get("center", {}).get("lat")
        elng = el.get("lon") or el.get("center", {}).get("lon")
        if elat is None: continue
        cat = classify(el.get("tags", {}))
        if not cat: continue
        d = hav_km(lat, lng, elat, elng)
        if cat not in fac or d < fac[cat]["km"]:
            fac[cat] = {"km": round(d, 2),
                        "min": max(int(round(d * 1.3 / 5.0 * 60)), 1),
                        "name": el.get("tags", {}).get("name", "")}
    done[name] = fac
    json.dump(done, open("facilities_cache.json", "w"))
    print(f'{i+1:2d}/{len(SPOTS)} {name:42s} ' + (",".join(f"{k}:{v['min']}m" for k, v in sorted(fac.items())) or "none"))
    time.sleep(6)

if len(done) == len(SPOTS):
    out = []
    for i, s in enumerate(SPOTS):
        lat, lng = COORDS[s["name"]]
        out.append({
            "id": i + 1, "name": s["name"], "county": s["county"], "type": s["type"],
            "access": s["access"], "lat": lat, "lng": lng, "desc": s["desc"],
            "hikeKm": s["hike_km"], "src": s["src"], "facilities": done[s["name"]],
        })
    json.dump(out, open("spots.json", "w"), ensure_ascii=False, indent=1)
    print("COMPLETE: wrote spots.json", len(out))
else:
    print(f"INCOMPLETE: {len(done)}/{len(SPOTS)} cached; re-run to resume")
