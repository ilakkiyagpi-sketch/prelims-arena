#!/usr/bin/env python3
"""Builds map practice: data/mapq.json (places for tap-the-map) and four 25-question sets MAP-01..MAP-04,
and adds them to data/manifest.json (sets list and the Geography bank). Run from the repo root."""
import json, math, random, os, sys
sys.path.insert(0, "tools")
from map_places import PLACES

R = random.Random(2027)
P = [dict(name=n, type=t, state=s, lat=la, lon=lo, note=no) for (n, t, s, la, lo, no) in PLACES]
def far(a, b, d): return math.hypot(a["lat"] - b["lat"], a["lon"] - b["lon"]) >= d
json.dump({"places": [{k: p[k] for k in ("name", "type", "state", "lat", "lon", "note")} for p in P]},
          open("data/mapq.json", "w"), ensure_ascii=False, separators=(",", ":"))
order = P[:]; R.shuffle(order)
A, B = order[:50], order[50:100]
def kindA(p):
    same = [q for q in P if q is not p and q["type"] == p["type"] and far(p, q, 3)]
    other = [q for q in P if q is not p and far(p, q, 3)]
    pool = same if len(same) >= 3 else other
    ds = R.sample(pool, 3); opts = [p] + ds; R.shuffle(opts)
    return {"q": "Which of the following is marked on the map?", "o": [o["name"] for o in opts], "a": opts.index(p),
            "e": p["name"] + " (" + p["state"] + ") is the marked place. " + p["note"] + " The others: " + "; ".join(o["name"] + " is in " + o["state"] for o in ds) + ".",
            "map": {"lat": p["lat"], "lon": p["lon"]}}
def kindB(p):
    pts = [p]
    cands = [q for q in P if q is not p]; R.shuffle(cands)
    for q in cands:
        if len(pts) == 4: break
        if all(far(q, x, 2.5) for x in pts): pts.append(q)
    R.shuffle(pts)
    lab = {id(x): str(i + 1) for i, x in enumerate(pts)}
    return {"q": "Four places are marked 1 to 4 on the map. Which number marks " + p["name"] + "?", "o": ["1", "2", "3", "4"], "a": pts.index(p),
            "e": p["name"] + " (" + p["state"] + ") is number " + lab[id(p)] + ". " + p["note"] + " The others: " + "; ".join(lab[id(x)] + " is " + x["name"] for x in pts if x is not p) + ".",
            "map": {"pts": [{"lat": x["lat"], "lon": x["lon"], "l": lab[id(x)]} for x in pts]}}
qs = [kindA(p) for p in A] + [kindB(p) for p in B]
for q in qs:
    q.update({"s": "Prelims Arena map practice", "sub": "Geography", "u": "Maps: India & World"})
titles = ["Map set 1: name the marked place", "Map set 2: name the marked place", "Map set 3: find the number", "Map set 4: find the number"]
man = json.load(open("data/manifest.json"))
man["sets"] = [s for s in man["sets"] if s.get("type") != "mapq"]
man["bank"]["Geography"] = [x for x in man["bank"]["Geography"] if not x[0].startswith("MAP-")]
for k in range(4):
    sid = "MAP-0" + str(k + 1); part = qs[k * 25:(k + 1) * 25]
    json.dump({"id": sid, "title": titles[k], "type": "mapq", "questions": part}, open("data/sets/" + sid + ".json", "w"), ensure_ascii=False, separators=(",", ":"))
    man["sets"].append({"id": sid, "type": "mapq", "title": titles[k], "subject": "Geography", "subjects": ["Geography"], "n": len(part), "ready": True})
    man["bank"]["Geography"] += [[sid + "#" + str(i), "Maps: India & World"] for i in range(len(part))]
json.dump(man, open("data/manifest.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("places", len(P), "questions", len(qs))
