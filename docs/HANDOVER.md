# Prelims Arena: handover

Everything needed to keep running, move or change this app from another account or tool.
**This repository is public, so this file holds no secret values.** It says where each secret lives.
Keep the secrets themselves in a password manager (see "Secrets checklist" at the end).

## 1. Links

| What | Where |
|---|---|
| Source code | https://github.com/ilakkiyagpi-sketch/prelims-arena (branch `main`) |
| Download as zip | https://github.com/ilakkiyagpi-sketch/prelims-arena/archive/refs/heads/main.zip |
| Clone | `git clone https://github.com/ilakkiyagpi-sketch/prelims-arena.git` |
| Live app (GitHub Pages) | https://ilakkiyagpi-sketch.github.io/prelims-arena/ |
| Build and check runs | https://github.com/ilakkiyagpi-sketch/prelims-arena/actions |
| Repository secrets | https://github.com/ilakkiyagpi-sketch/prelims-arena/settings/secrets/actions |
| Pages settings | https://github.com/ilakkiyagpi-sketch/prelims-arena/settings/pages |
| Google Sheet sync script | `sheet-script.gs.txt` in this repository (the same text is embedded in `app.js` for the in-app Copy button) |

The app is a static web app (no server of its own). On a phone, open the live link and use "Add to Home Screen"; it then works offline.

## 2. Accounts and services the app uses

| Service | Used for | Owned by |
|---|---|---|
| GitHub repository + GitHub Pages | Code and hosting of the app | GitHub account `ilakkiyagpi-sketch` |
| GitHub Actions | Question bank check on every push; study reminders three times a day | same |
| Google Sheet + Apps Script web app | Cloud copy of all results, sync between devices, "My questions" typed in the Sheet | the Google account that made the Sheet |
| Web Push (browser push service) | Study reminder notifications | VAPID key pair (section 3) |
| Google Fonts | Public Sans font | no account |

## 3. IDs, keys and passcodes

| Item | Value or where to find it |
|---|---|
| Sheet passphrase (`KEY`) | **Secret.** In Apps Script: the line `var KEY = '...';`. Also typed into the app on each device (Scores > Google Sheet sync), and stored as GitHub secret `SHEET_KEY`. All three must match. |
| Apps Script web app URL | **Secret-ish** (anyone with it plus the passphrase can read your data). In Apps Script: Deploy > Manage deployments > Web app URL (ends in `/exec`). Also in the app's sync settings and GitHub secret `SHEET_URL`. |
| Apps Script deployment settings | Execute as: Me. Who has access: Anyone. Update with Deploy > Manage deployments > Edit > Version: New version, so the URL never changes. |
| VAPID public key (push) | `BHICrNnSrv5AcP9me2EP1yIQ1SQU3Zu_4NmwoEfN0jujSRfSo0pMZIqPg0y4-OCJTDvl6i8RKdRdXLj7XmA3Yqg` (public; in `app.js` as `PUSH_PUB` and in `reminders/send.mjs`) |
| VAPID private key | **Secret.** Only in GitHub secret `VAPID_PRIVATE_KEY`. GitHub never shows a saved secret again, so keep your own copy. If it is lost, see "Replacing the push keys". |
| VAPID subject | `https://ilakkiyagpi-sketch.github.io/prelims-arena/` (in `reminders/send.mjs`) |
| GitHub Actions secrets | `SHEET_URL`, `SHEET_KEY`, `VAPID_PRIVATE_KEY` |
| Device id | Random per device, created by the app (`DB.meta.dev`); push records are `push_<device id>` |

## 4. Where data lives

**On each device** (browser storage of the site):
- IndexedDB database `prelims-arena`, version 1, object stores `recs` (one row per record, key = record id) and `kv` (`dirty` = ids waiting to upload, `meta` = settings and sync config).
- localStorage: `pa2-store` (older versions and the fallback when IndexedDB is unavailable), `pa2-store-before-idb` (one safety copy made when data moved to IndexedDB), `prelims-arena-v3` and `prelims-arena-sync-v1` (version 1, migrated once), `pa_notes_pos_<id>` (last page read in a PDF).
- Service worker caches: `pa-<version>` (app and question bank), `pa-notes` (PDF notes), `pa-fonts`.

**In the Google Sheet** (tabs are created by the script):

| Tab | Contents |
|---|---|
| Quiz results | One row per finished quiz; column `record` holds the full JSON |
| Test marks | Shankar IAS and other test marks |
| My questions | Your own questions; you can type new ones here (answer column A-D, leave id empty) |
| Study log | Daily study log |
| App data | Every other record (saved questions, notes, flashcards, settings for reminders and so on) as JSON |

**Record kinds** (field `kind`): `att` finished quiz, `run` paused quiz, `test` test marks, `myq` own question, `log` study log, `chk` check-in, `rep` reported question, `bm` saved question, `qn` note on a question, `pn` note on a PDF page, `fc` flashcard, `why` why-wrong tags, `reh` exam-day rehearsal, `mains` Mains answer, `syl` syllabus tracker, `bench` class benchmark, `push` reminder subscription, `nudge_status` data for reminders, `kd` key-date flag, `nread` notes pages read, `cuskip` skipped catch-up, `csat10` daily CSAT 10. A deleted record keeps `del: true`.

**Sync rule:** every change uploads; everything downloads; the newest `ts` (timestamp in ms) wins. Upload and download are POSTs with `{key, v: 2, recs, pull}`; the older GET with `?key=` still works.

**Backup without the Sheet:** Scores > Backup > Download backup (a JSON file with every record). Restore from file merges it back.

## 5. Source code map

| Path | What it is |
|---|---|
| `index.html` | Page shell; loads the files below with a `?v=<version>` cache tag |
| `app.js` | Main app: schedule (`CFG`, `TESTS`), storage, sync, quiz engine, screens, Listen mode, reminders opt-in. Edit directly. |
| `src/m1_*.js` ... `src/m7_*.js` | Newer features (diagnosis, benchmarks, plan, exam rehearsal and OMR, search and notes, Mains, views). **Edit these, not `more.js`.** |
| `more.js` | Built from `src/m*.js` by the build step; do not edit by hand |
| `app.css` | All styles (light and dark) |
| `sw.js` | Service worker: offline cache list (`PRECACHE`, `NOTES`) and `VERSION`; push notifications |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icons |
| `notes/` | PDF notes, PDF.js (`pdf.min.js`, `pdf.worker.min.js`) and the viewer (`viewer.js`) |
| `data/manifest.json` | Index of every question set, subjects, units, notes, schedule dates |
| `data/sets/<ID>.json` | Question sets (336 listed, 327 files; the rest open later) |
| `data/notes/`, `data/facts.json`, `data/india.json`, `data/mapq.json`, `data/mains.json`, `data/qfmt.json`, `data/search.json` | Current affairs notes, fact tables, India map, map questions, Mains questions, question types, offline search index |
| `tools/build_extra.py` | Build: rebuilds `qfmt.json` and `search.json`; with `--assemble` also checks data, builds `more.js` and bumps the cache version |
| `tools/check_data.py`, `tools/qlock.json` | Question bank check and the question position lock |
| `tools/build_maps.py`, `tools/map_places.py`, `tools/mains_src.py` | Generators for map and Mains data |
| `sheet-script.gs.txt` | Google Apps Script for the Sheet |
| `reminders/send.mjs`, `reminders/package.json` | Reminder sender (Node 20, `web-push` 3.6.7) |
| `.github/workflows/reminders.yml` | Reminders at 23:20, 08:05 and 16:05 UTC (about 5:30 am, 2 pm and 10 pm IST after GitHub's usual delay); can also be run by hand |
| `.github/workflows/check.yml` | Question bank check on every push and pull request |

**Question format** (`data/sets/<ID>.json`): `{id, title, type, questions: [...], passages?: {pid: text}}`. Each question: `q` text, `o` four options, `a` answer index 0-3 (`null` only when `x` is set), `e` explanation, `s` source, `sub` subject, `u` unit, optional `h` memory hook, `pid` passage id, `y` and `paper` for UPSC papers, `x` not scored (1 dropped by UPSC, 2 needs a figure).

**Set ids:** `T<n>-<k>` daily subject sets (Shankar timetable), `CA25-...`, `CAM26-...`, `CAP26-<month>-<topic>` current affairs, `MD-..` mocks, `PYQ-GS-<year>` / `PYQ-CSAT-<year>` UPSC papers, `CSAT-P..` CSAT practice, `SRI-..` schemes and indices, `SPP-..` species and protected areas, `MAP-..` map questions.

## 6. How to change and release

Needs Python 3 and (for checks) Node 20. No other installs for the app itself.

1. Edit `app.js`, `app.css`, `src/m*.js` or files in `data/`.
2. Run `python3 tools/build_extra.py --assemble`. It stops if a question is broken or a published question moved.
3. Commit everything it changed (including `more.js`, `sw.js`, `index.html`, `tools/qlock.json`) and push to `main` (or merge a pull request). GitHub Pages publishes in about a minute; phones show "update available".

Rules that protect saved history:
- Never reorder or delete questions in a published set. Add new ones at the end; mark a bad one with `x`.
- Fixing an answer, options or explanation is always fine. Rewording a question: run `python3 tools/check_data.py --relock <SET-ID>`.
- Never rename a set id that has been used.

Try it locally: `python3 -m http.server 8000` in the repository folder, then open http://localhost:8000/.

## 7. Moving to another account

**GitHub (code, hosting, reminders):**
1. Transfer the repository (Settings > General > Transfer) or fork it, or push a clone to a new repository.
2. In the new repository: Settings > Pages > Deploy from branch `main`, folder `/ (root)`.
3. Add the three Actions secrets (`SHEET_URL`, `SHEET_KEY`, `VAPID_PRIVATE_KEY`).
4. If the site address changes, update the VAPID subject in `reminders/send.mjs`. Each device's data is stored per site address, so on each device first sync to the Sheet (or download a backup) on the old address, then open the new address and connect the same Sheet.

**Google (Sheet):** share or copy the Sheet to the other Google account. A copied Sheet gets a copy of the script but needs a new deployment (Deploy > New deployment, as in the script's header), which gives a new web app URL. Put that URL in the app on every device and in GitHub secret `SHEET_URL`.

**Replacing the push keys** (if the private key is lost or leaked): run `npx web-push generate-vapid-keys`, put the public key in `PUSH_PUB` in `app.js` and in `reminders/send.mjs`, put the private key in secret `VAPID_PRIVATE_KEY`, release, then on each phone turn reminders off and on again.

**Changing the passphrase:** change `var KEY` in Apps Script and redeploy (new version), then update it in the app on every device and in secret `SHEET_KEY`.

## 8. Secrets checklist (keep these in a password manager, not in this repository)

- [ ] Sheet passphrase (`KEY`)
- [ ] Apps Script web app URL
- [ ] Google Sheet link, and the Google account that owns it
- [ ] VAPID private key
- [ ] GitHub account `ilakkiyagpi-sketch` login and recovery codes
