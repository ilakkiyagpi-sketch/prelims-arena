#!/usr/bin/env python3
"""Checks the question bank before a release. Exit code 1 if anything is wrong.

  python3 tools/check_data.py                 check everything
  python3 tools/check_data.py --relock T3-01  accept a deliberate rewrite of a question's wording in set T3-01

What it checks
  - every question has 4 distinct, non-empty options and a question text
  - the answer is 0-3, or the question is marked as not scored (x: 1 dropped by UPSC, x: 2 needs a figure)
  - every passage a question points to exists
  - every set the manifest lists as ready has a file, and every file is in the manifest

Question positions are locked
  The app remembers questions as "set#position" (mistake book, saved questions, notes, flashcards,
  synced history). If a question is removed, reordered or inserted in the middle of a published set,
  all of that silently points at different questions. tools/qlock.json stores a short fingerprint of
  each question's wording by position. New questions may only be added at the end of a set.
  Fixing an answer, an explanation or options never trips the lock; only the question wording does.
  If you corrected a typo in the wording of the same question, rerun with --relock SET-ID.
"""
import glob
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCK = os.path.join(ROOT, "tools", "qlock.json")


def fp(q):
    stem = re.sub(r"\s+", " ", str(q.get("q", ""))).strip().lower()
    return hashlib.sha1(stem.encode("utf-8")).hexdigest()[:10]


def main(argv):
    os.chdir(ROOT)
    relock = set()
    for i, a in enumerate(argv):
        if a == "--relock" and i + 1 < len(argv):
            relock.add(argv[i + 1])
    errs = []
    lock = json.load(open(LOCK)) if os.path.exists(LOCK) else {}
    newlock = dict(lock)
    man = json.load(open("data/manifest.json"))
    listed = {s["id"]: s for s in man["sets"]}
    files = {os.path.basename(f)[:-5]: f for f in glob.glob("data/sets/*.json")}
    for sid, s in listed.items():
        if s.get("ready", True) is not False and sid not in files:
            errs.append(f"{sid}: listed as ready in the manifest but data/sets/{sid}.json is missing")
    for sid in files:
        if sid not in listed:
            errs.append(f"{sid}: file exists but the manifest does not list it")
    for sid, f in sorted(files.items()):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except ValueError as e:
            errs.append(f"{sid}: not valid JSON ({e})")
            continue
        qs = d.get("questions") or []
        passages = d.get("passages") or {}
        for i, q in enumerate(qs):
            at = f"{sid}#{i} (question {i + 1})"
            o = q.get("o")
            if not str(q.get("q", "")).strip():
                errs.append(f"{at}: empty question text")
            if not isinstance(o, list) or len(o) != 4:
                errs.append(f"{at}: needs exactly 4 options")
            else:
                if any(not str(x).strip() for x in o):
                    errs.append(f"{at}: an option is empty")
                if len(set(str(x).strip() for x in o)) != 4:
                    errs.append(f"{at}: two options are the same")
            a = q.get("a")
            if q.get("x"):
                pass  # not scored
            elif not isinstance(a, int) or isinstance(a, bool) or not 0 <= a <= 3:
                errs.append(f"{at}: answer must be 0-3 (A-D), or mark the question with x")
            if q.get("pid") and q["pid"] not in passages:
                errs.append(f"{at}: passage '{q['pid']}' is missing")
        cur = [fp(q) for q in qs]
        old = lock.get(sid)
        if old is None or sid in relock:
            newlock[sid] = cur
            continue
        if len(cur) < len(old):
            errs.append(f"{sid}: has {len(cur)} questions but {len(old)} were published. Removing questions shifts the "
                        f"saved history of every later question; mark a bad question with x instead")
        for i in range(min(len(cur), len(old))):
            if cur[i] != old[i]:
                moved = f", it was published at position {old.index(cur[i]) + 1}" if cur[i] in old else ""
                errs.append(f"{sid}#{i}: the wording of question {i + 1} changed{moved}. Add new questions at the end only. "
                            f"If you just fixed a typo in the same question, rerun with --relock {sid}")
                break
        if len(cur) >= len(old):
            newlock[sid] = old + cur[len(old):]
    for e in errs:
        print("ERROR", e)
    if errs:
        print(f"{len(errs)} problem(s) found; tools/qlock.json not updated.")
        return 1
    if newlock != lock:
        json.dump(newlock, open(LOCK, "w"), separators=(",", ":"), sort_keys=True)
        print("tools/qlock.json updated")
    print(f"Question bank OK: {len(files)} sets, {sum(len(v) for v in newlock.values())} questions locked.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
