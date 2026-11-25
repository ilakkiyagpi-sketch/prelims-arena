# Prelims Arena

Personal UPSC Prelims 2027 practice app: daily sets on the Shankar IAS Prestorming timetable, current affairs sets, subject tests, full mocks, a mistake book and progress tracking.

- Open the site and add it to your home screen. It works offline after the first visit.
- Results sync to your own Google Sheet (Scores tab > Google Sheet sync). The Sheet script is in `sheet-script.gs.txt`.
- Question keys are drafts and unverified; use "Report a problem with this question" for anything that looks wrong.

## Releasing changes

- Edit `src/m*.js` (not `more.js`), then run `python3 tools/build_extra.py --assemble`. It checks the question bank, rebuilds the search index and `more.js`, and bumps the offline cache version. The version covers every stored file, so a corrected answer key reaches installed phones.
- `python3 tools/check_data.py` checks every question. Questions in a published set are locked by position: add new questions only at the end, and mark a bad question with `x` instead of deleting it. Otherwise saved history, notes and the mistake book point at the wrong questions. If you only fixed a typo in a question's wording, run it with `--relock SET-ID`.
- After changing `sheet-script.gs.txt`, paste it into Apps Script and redeploy: Deploy > Manage deployments > Edit > Version: New version. The URL stays the same.
