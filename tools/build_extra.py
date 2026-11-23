#!/usr/bin/env python3
"""Builds the extra data files used by the November 2026 upgrade (more.js):

  data/qfmt.json    question type of every question, one letter per question, per set
  data/search.json  compact offline search index: questions, CA notes pages, fact tables, PDF notes pages

Question type letters
  D  direct question (one fact)           M  two statements
  N  three or more statements             H  "how many of the above"
  S  Statement-I / Statement-II           P  pairs / correctly matched
  O  order / chronology / sequence        R  CSAT passage (reading)
  Q  CSAT numeracy, reasoning or data

Run from the repository root:  python3 tools/build_extra.py
"""
import glob
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def qtype(q, sid):
    t = q.get("q", "")
    tl = t.lower()
    if q.get("sub") == "CSAT" or sid.startswith("PYQ-CSAT") or sid.startswith("CSAT"):
        return "R" if q.get("pid") or q.get("p") else "Q"
    if "how many" in tl:
        return "H"
    if re.search(r"statement[- ]?(i|1)\b", tl) and re.search(r"statement[- ]?(ii|2)\b", tl):
        return "S"
    if re.search(r"\bpairs?\b", tl) or "correctly matched" in tl or "correctly paired" in tl:
        return "P"
    if "chronolog" in tl or "correct order" in tl or "correct sequence" in tl or "arrange" in tl:
        return "O"
    n = len(re.findall(r"(?m)^\s*(?:\d+|[IVX]+)\.\s", t))
    if n >= 3:
        return "N"
    if n == 2:
        return "M"
    return "D"


def squash(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def main():
    man = json.load(open("data/manifest.json"))
    fmt, rows = {}, []
    for f in sorted(glob.glob("data/sets/*.json")):
        d = json.load(open(f))
        sid = d.get("id") or os.path.basename(f)[:-5]
        codes = []
        for i, q in enumerate(d["questions"]):
            codes.append(qtype(q, sid))
            if q.get("x"):
                continue
            ans = ""
            try:
                ans = q["o"][int(q["a"])]
            except Exception:
                pass
            rows.append(["q", sid + "#" + str(i), q.get("sub", ""), q.get("u", ""), squash(q.get("q"), 230), squash(ans, 90)])
        fmt[sid] = "".join(codes)
    # current-affairs notes booklets
    for f in sorted(glob.glob("data/notes/*.json")):
        d = json.load(open(f))
        for p in d.get("pages", []):
            rows.append(["c", d["id"] + "#" + str(p["n"]), d.get("title", ""), p.get("t", ""), squash(p.get("headline"), 140), squash(p.get("what", "") + " " + " ".join(p.get("key", [])), 260)])
    # fact tables
    facts = json.load(open("data/facts.json"))["tables"]
    for t in facts:
        for i, r in enumerate(t["rows"]):
            rows.append(["f", t["id"] + "#" + str(i), t["title"], t.get("subject", ""), squash(r[0], 120), squash(" · ".join(str(x) for x in r[1:]), 200)])
    # PDF study notes, page by page
    for nid, info in sorted((man.get("notes") or {}).items()):
        path = info["file"]
        if not os.path.exists(path):
            continue
        try:
            txt = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, timeout=60).stdout
        except Exception:
            continue
        for k, page in enumerate(txt.split("\f")):
            page = squash(page, 900)
            if len(page) < 40:
                continue
            rows.append(["p", nid + "#" + str(k + 1), info["title"], "", "Page " + str(k + 1), page])
    json.dump(fmt, open("data/qfmt.json", "w"), separators=(",", ":"))
    json.dump({"v": 1, "rows": rows}, open("data/search.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print("qfmt sets", len(fmt), "search rows", len(rows),
          "sizes", os.path.getsize("data/qfmt.json"), os.path.getsize("data/search.json"))


if __name__ == "__main__":
    main()


def assemble():
    """Concatenate src/m*.js into more.js, then bump the cache version in index.html and sw.js."""
    import hashlib
    parts = sorted(glob.glob("src/m*.js"))
    js = "\n".join(open(p).read() for p in parts)
    open("more.js", "w").write(js)
    h = hashlib.sha1()
    for f in ["app.js", "app.css", "more.js", "notes/viewer.js", "data/manifest.json", "data/qfmt.json"]:
        h.update(open(f, "rb").read())
    v = h.hexdigest()[:10]
    idx = open("index.html").read()
    idx = re.sub(r"\?v=[0-9a-f]+", "?v=" + v, idx)
    if "more.js" not in idx:
        idx = idx.replace('<script src="notes/viewer.js', '<script src="more.js?v=' + v + '"></script>\n<script src="notes/viewer.js')
    open("index.html", "w").write(idx)
    sw = open("sw.js").read()
    sw = re.sub(r'var VERSION="[0-9a-f]+"', 'var VERSION="' + v + '"', sw)
    for extra in ["more.js", "data/qfmt.json", "data/india.json", "data/mapq.json", "data/mains.json"]:
        if os.path.exists(extra) and '"' + extra + '"' not in sw:
            sw = sw.replace('"app.css", ', '"app.css", "' + extra + '", ', 1)
    # every question set in the manifest is stored for offline use
    man = json.load(open("data/manifest.json"))
    for s in man["sets"]:
        f = "data/sets/" + s["id"] + ".json"
        if os.path.exists(f) and '"' + f + '"' not in sw:
            sw = sw.replace('"data/facts.json", ', '"data/facts.json", "' + f + '", ', 1)
    open("sw.js", "w").write(sw)
    print("assembled", len(parts), "parts; version", v)


if __name__ == "__main__" and "--assemble" in __import__("sys").argv:
    assemble()
