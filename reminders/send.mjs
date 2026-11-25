// Prelims Arena study reminders.
// Runs on a schedule (see .github/workflows/reminders.yml). Reads progress from the Google Sheet,
// decides whether a reminder is needed, and sends it to every phone that turned reminders on.
// The repository is public, so this script must never print personal data: only counts go to the log.
import webpush from "web-push";

const { SHEET_URL, SHEET_KEY, VAPID_PRIVATE_KEY, SLOT } = process.env;
const VAPID_PUBLIC_KEY = "BHICrNnSrv5AcP9me2EP1yIQ1SQU3Zu_4NmwoEfN0jujSRfSo0pMZIqPg0y4-OCJTDvl6i8RKdRdXLj7XmA3Yqg";
const GOAL_S = 50, GOAL_C = 25;

if (!SHEET_URL || !SHEET_KEY || !VAPID_PRIVATE_KEY) {
  console.log("Missing secrets: add SHEET_URL, SHEET_KEY and VAPID_PRIVATE_KEY in Settings > Secrets and variables > Actions.");
  process.exit(1);
}
webpush.setVapidDetails("https://ilakkiyagpi-sketch.github.io/prelims-arena/", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const ist = process.env.TEST_DATE ? new Date(process.env.TEST_DATE + "T06:00:00Z") : new Date(Date.now() + 5.5 * 3600e3); // TEST_DATE only for local testing
const ymd = (d) => d.toISOString().slice(0, 10);
const today = ymd(ist), yesterday = ymd(new Date(ist.getTime() - 864e5)), tomorrow = ymd(new Date(ist.getTime() + 864e5));
const hour = ist.getUTCHours();
const slot = SLOT && SLOT !== "auto" ? SLOT
  : hour >= 4 && hour < 9 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 20 ? "night" : null;
if (!slot) { console.log("Outside the reminder windows; nothing to do."); process.exit(0); }

// read everything with a POST so the passphrase is not in a URL; an older Sheet script ignores "pull", so fall back to the plain download
const readJson = (r) => r.json().catch(() => ({}));
let j = await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key: SHEET_KEY, v: 2, pull: true, recs: [] }), redirect: "follow" })
  .then(readJson).catch(() => ({}));
if (!j.recs && !j.error) j = await fetch(`${SHEET_URL}${SHEET_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(SHEET_KEY)}&v=2&_=${Date.now()}`, { redirect: "follow" }).then(readJson).catch(() => ({}));
if (j.error || !j.recs) { console.log("Could not read the Sheet (check SHEET_URL and SHEET_KEY)."); process.exit(1); }

const recs = j.recs;
const subs = [], seen = new Set();
for (const r of recs) {
  if (r.kind === "push" && r.on && !r.del && r.sub && r.sub.endpoint && !seen.has(r.sub.endpoint)) { seen.add(r.sub.endpoint); subs.push(r); }
}
if (!subs.length) { console.log("No device has reminders turned on."); process.exit(0); }

// questions answered today, from the synced results
let s = 0, c = 0;
const isCa = (t) => t === "cam" || t === "ca" || t === "capool";
for (const r of recs) {
  if (r.kind !== "att" || r.del || r.date !== today) continue;
  if (isCa(r.type)) c += r.n || 0; else s += r.n || 0;
}
const st = recs.find((r) => r.id === "nudge_status") || {};
if (st.date === today) { s = Math.max(s, st.s || 0); c = Math.max(c, st.c || 0); }
s = Math.min(GOAL_S, s); c = Math.min(GOAL_C, c);
const left = GOAL_S + GOAL_C - s - c, done = left <= 0, nothing = s + c === 0;
const isToday = st.date === today, isYest = st.date === yesterday;
// streak still alive: counted today, or yesterday's goal was met
const streak = isToday ? st.streak || 0 : (isYest && st.done ? st.streak || 0 : 0);
// what to do today: status written today, or yesterday's look-ahead to today
const plan = isToday ? { set: st.set, notes: st.nt, ca: st.ca, due: st.due, backlog: st.backlog }
  : isYest ? { set: st.tset, notes: st.tnt, ca: st.ca, due: st.due, backlog: st.done ? st.backlog : (st.backlog || 0) + (st.set && st.setDate === yesterday ? 5 : 0) } : {};
// UPSC CSE 2027 key dates (official calendar): application window, Prelims
const applied = recs.some((r) => r.kind === "kd" && r.done && !r.del);
const days = (d) => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
let kd = "";
const dOpen = days("2027-01-13"), dLast = days("2027-02-02"), dPre = days("2027-05-23");
if (dOpen === 0) kd = "UPSC CSE 2027 notification is out today – applications open on upsconline.gov.in.";
else if (!applied && dLast >= 0 && dOpen < 0 && (dLast <= 3 || dLast % 5 === 0)) kd = dLast === 0 ? "Today is the LAST DAY to apply for CSE 2027." : `CSE 2027 application closes in ${dLast} day${dLast > 1 ? "s" : ""} (2 Feb). Tap "I have applied" in the app once done.`;
else if (dPre > 0 && dPre <= 14) kd = `${dPre} day${dPre > 1 ? "s" : ""} to Prelims.`;
let msg = null;
if (slot === "morning") {
  const parts = [];
  if (kd) parts.push(kd);
  if (plan.set) parts.push(`Subject: ${plan.set}.`);
  if (plan.notes) parts.push(`Read the notes first (${plan.notes}).`);
  if (plan.ca) parts.push(`Current affairs: ${plan.ca}.`);
  if (plan.due) parts.push(`${plan.due} mistake${plan.due > 1 ? "s" : ""} due for revision.`);
  if (plan.backlog) parts.push(`Catch-up: ${plan.backlog * 10} questions behind – today's catch-up part is ready.`);
  if (st.testDate === today) parts.push(`Shankar test today, 2 pm: ${st.test}.`);
  else if (st.testDate === tomorrow) parts.push(`Shankar test tomorrow: ${st.test}. Revise its notes and mistakes today.`);
  const head = streak ? `Day ${streak + 1} of your streak. ` : (isYest && !st.done ? "Yesterday fell short – fresh start today. " : "");
  msg = { title: "Good morning – today's 50 + 25", body: head + (parts.join(" ") || "Open the app for today's sets."), tag: "pa-morning" };
} else if (slot === "afternoon") {
  if (nothing) msg = { title: "Nothing done yet today", body: "One part of 10 questions takes about 10 minutes. Start one now and the day is moving.", tag: "pa-afternoon", actions: [{ action: "b10", title: "Start 10 minutes" }] };
} else if (slot === "night") {
  if (!done) {
    const body = nothing
      ? `Today is still open. 10 questions before bed keeps you on track${streak ? ` and protects your ${streak}-day streak` : ""}.`
      : `${left} question${left > 1 ? "s" : ""} left today (${GOAL_S - s} subject, ${GOAL_C - c} current affairs). Smallest next step: one 10-minute part.`;
    msg = { title: nothing ? "Last call for today" : `${s + c} of 75 done – almost there`, body, tag: "pa-night", actions: [{ action: "b10", title: "Start 10 minutes" }] };
  }
}
if (!msg) { console.log(`${slot}: no reminder needed.`); process.exit(0); }
msg.url = "./#today";
if (process.env.DRY) { console.log(JSON.stringify(msg)); process.exit(0); }

let sent = 0, gone = [];
for (const r of subs) {
  try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 3 * 3600, urgency: "high" }); sent++; }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) gone.push(r); else console.log(`Send failed with status ${e.statusCode || "unknown"}.`); }
}
// switch off subscriptions the phone has dropped, so they are not tried again
if (gone.length) {
  const body = { key: SHEET_KEY, v: 2, recs: gone.map((r) => ({ id: r.id, kind: "push", on: false, dev: r.dev, ts: Date.now() })) };
  await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" }).catch(() => {});
}
console.log(`${slot}: sent to ${sent} device(s); ${gone.length} expired.`);
