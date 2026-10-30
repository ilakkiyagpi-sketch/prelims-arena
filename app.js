var GAS_SCRIPT="/* Prelims Arena v2: Google Sheet sync script.\n   Setup:\n   1) In a new Google Sheet: Extensions > Apps Script. Delete the sample code and paste this whole script.\n   2) Change the passphrase on the next line. Use the same passphrase in the app.\n   3) Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone > Deploy. Allow access.\n   4) Copy the Web app URL into the app: Scores tab > Google Sheet sync.\n   Your daily study log appears in the \"Study log\" tab.\n   You can type your own questions in the \"My questions\" tab. Answer column takes A, B, C or D. Leave the id column empty. */\nvar KEY = 'change-this-passphrase';\n\nvar T_RES = 'Quiz results', T_TEST = 'Test marks', T_MYQ = 'My questions', T_DATA = 'App data', T_LOG = 'Study log';\nvar H_RES = ['id','date','type','title','subject','questions','right','wrong','skipped','marks','max','percent','accuracy','minutes','scheduled','set','ts','record'];\nvar H_TEST = ['id','name','type','subject','date','marks','max','percent','right','wrong','rank','ts','deleted'];\nvar H_MYQ = ['id','subject','unit','question','option A','option B','option C','option D','answer','explanation','source','ts','deleted'];\nvar H_DATA = ['id','kind','ts','record'];\nvar H_LOG = ['id','date','day','hours','subjects','covered','reasons','shankar test','notes','ts','deleted'];\nvar LOG_ST = {full: 'Studied as planned', partial: 'Studied partly', none: 'Could not study'};\n\nfunction sheet_(name, h) {\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n  var s = ss.getSheetByName(name);\n  if (!s) { s = ss.insertSheet(name); s.appendRow(h); s.setFrozenRows(1); s.getRange(1, 1, 1, h.length).setFontWeight('bold'); }\n  return s;\n}\nfunction rows_(s, w) { var n = s.getLastRow(); return n > 1 ? s.getRange(2, 1, n - 1, w).getValues() : []; }\nfunction idx_(rows) { var m = {}; rows.forEach(function (r, i) { if (r[0] !== '') m[String(r[0])] = i; }); return m; }\nfunction out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }\nfunction d_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v); }\nfunction n_(v) { return v === '' || v == null ? null : Number(v); }\nfunction L_(i) { return ['A', 'B', 'C', 'D'][i] || ''; }\n\nfunction doPost(e) {\n  var lock = LockService.getScriptLock(); lock.waitLock(25000);\n  try {\n    var b = JSON.parse(e.postData.contents);\n    if (b.key !== KEY) return out_({error: 'wrong passphrase'});\n    var res = sheet_(T_RES, H_RES), tst = sheet_(T_TEST, H_TEST), myq = sheet_(T_MYQ, H_MYQ), dat = sheet_(T_DATA, H_DATA);\n    var resIdx = idx_(rows_(res, 1));\n    var tRows = rows_(tst, H_TEST.length), tIdx = idx_(tRows);\n    var qRows = rows_(myq, H_MYQ.length), qIdx = idx_(qRows);\n    var dRows = rows_(dat, H_DATA.length), dIdx = idx_(dRows);\n    var lg = sheet_(T_LOG, H_LOG), lRows = rows_(lg, H_LOG.length), lIdx = idx_(lRows);\n    var newRes = [];\n    (b.recs || []).forEach(function (r) {\n      var ts = Number(r.ts) || 0;\n      if (r.kind === 'att') {\n        if (r.id in resIdx) return;\n        resIdx[r.id] = -1;\n        var att = r.r + r.w;\n        newRes.push([r.id, r.date, r.type, r.title, r.subject, r.n, r.r, r.w, r.sk, r.pts, r.max,\n          r.max ? Math.round(r.pts / r.max * 1000) / 10 : '', att ? Math.round(r.r / att * 1000) / 10 : '',\n          Math.round((r.sec || 0) / 6) / 10, r.sched || '', r.setId || '', ts, JSON.stringify(r)]);\n      } else if (r.kind === 'test') {\n        var row = [r.id, r.name || '', r.type || '', r.subject || '', r.date || '', r.marks == null ? '' : r.marks, r.max == null ? '' : r.max,\n          (r.marks != null && r.max) ? Math.round(r.marks / r.max * 1000) / 10 : '', r.r == null ? '' : r.r, r.w == null ? '' : r.w, r.rank == null ? '' : r.rank, ts, r.del ? 'yes' : ''];\n        upsert_(tst, tRows, tIdx, row, 11);\n      } else if (r.kind === 'myq') {\n        var o = r.o || [];\n        var row2 = [r.id, r.sub || '', r.u || '', r.q || '', o[0] || '', o[1] || '', o[2] || '', o[3] || '', L_(r.a), r.e || '', r.src || '', ts, r.del ? 'yes' : ''];\n        upsert_(myq, qRows, qIdx, row2, 11);\n      } else if (r.kind === 'log') {\n        upsert_(lg, lRows, lIdx, [r.id, r.date || '', LOG_ST[r.status] || '', r.hours == null ? '' : r.hours, (r.subjects || []).join(', '), r.covered || '',\n          (r.reasons || []).join(', '), r.test === 'yes' ? 'taken' : (r.test === 'no' ? 'missed' : ''), r.note || '', ts, r.del ? 'yes' : ''], 9);\n      } else {\n        upsert_(dat, dRows, dIdx, [r.id, r.kind, ts, JSON.stringify(r)], 2);\n      }\n    });\n    if (newRes.length) res.getRange(res.getLastRow() + 1, 1, newRes.length, H_RES.length).setValues(newRes);\n    if (newRes.length) res.getRange(2, 1, res.getLastRow() - 1, H_RES.length).sort([{column: 2, ascending: true}, {column: 17, ascending: true}]);\n    return out_({ok: true});\n  } finally { lock.releaseLock(); }\n}\nfunction upsert_(s, rows, idx, row, tsCol) {\n  var id = String(row[0]);\n  if (id in idx) {\n    var i = idx[id];\n    if ((Number(row[tsCol]) || 0) >= (Number(rows[i][tsCol]) || 0)) { s.getRange(i + 2, 1, 1, row.length).setValues([row]); rows[i] = row; }\n  } else { s.appendRow(row); rows.push(row); idx[id] = rows.length - 1; }\n}\nfunction doGet(e) {\n  if ((e.parameter.key || '') !== KEY) return out_({error: 'wrong passphrase'});\n  var out = [];\n  rows_(sheet_(T_RES, H_RES), H_RES.length).forEach(function (r) {\n    try { var o = JSON.parse(r[17]); o.id = String(r[0]); o.ts = Number(r[16]) || o.ts; out.push(o); } catch (err) {}\n  });\n  rows_(sheet_(T_TEST, H_TEST), H_TEST.length).forEach(function (r) {\n    out.push({id: String(r[0]), kind: 'test', name: r[1], type: r[2], subject: r[3], date: d_(r[4]), marks: n_(r[5]), max: n_(r[6]), r: n_(r[8]), w: n_(r[9]), rank: n_(r[10]), ts: Number(r[11]) || 0, del: r[12] === 'yes', k: String(r[0]).replace(/^test_/, '')});\n  });\n  var q = sheet_(T_MYQ, H_MYQ), qRows = rows_(q, H_MYQ.length);\n  qRows.forEach(function (r, i) {\n    if (r[3] === '') return;\n    if (r[0] === '') { // typed by hand in the Sheet: give it an id\n      r[0] = 'myq_s' + Utilities.getUuid().slice(0, 8); r[11] = Date.now();\n      q.getRange(i + 2, 1).setValue(r[0]); q.getRange(i + 2, 12).setValue(r[11]);\n    }\n    var a = ['A', 'B', 'C', 'D'].indexOf(String(r[8]).trim().toUpperCase());\n    out.push({id: String(r[0]), kind: 'myq', sub: String(r[1] || 'Polity'), u: String(r[2] || 'My questions'), q: String(r[3]), o: [String(r[4]), String(r[5]), String(r[6]), String(r[7])], a: a < 0 ? 0 : a, e: String(r[9] || ''), src: String(r[10] || ''), ts: Number(r[11]) || 0, del: r[12] === 'yes', fromSheet: true});\n  });\n  var stBack = {}; Object.keys(LOG_ST).forEach(function (k) { stBack[LOG_ST[k]] = k; });\n  var split = function (v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); };\n  rows_(sheet_(T_LOG, H_LOG), H_LOG.length).forEach(function (r) {\n    if (r[0] === '') return;\n    out.push({id: String(r[0]), kind: 'log', date: d_(r[1]), status: stBack[r[2]] || 'partial', hours: n_(r[3]), subjects: split(r[4]), covered: String(r[5] || ''),\n      reasons: split(r[6]), test: r[7] === 'taken' ? 'yes' : (r[7] === 'missed' ? 'no' : null), note: String(r[8] || ''), ts: Number(r[9]) || 0, del: r[10] === 'yes'});\n  });\n  rows_(sheet_(T_DATA, H_DATA), H_DATA.length).forEach(function (r) {\n    try { var o = JSON.parse(r[3]); o.id = String(r[0]); o.ts = Number(r[2]) || 0; out.push(o); } catch (err) {}\n  });\n  return out_({recs: out});\n}\n";
/* Prelims Arena v2 — core: config, helpers, store */
"use strict";
var CFG={
  START:"2026-10-18", PRELIMS:"2027-05-23", IDEAL_END:"2027-05-16", GOAL:90, RIGHT:2, WRONG:0.66,
  SEC_PER_Q:72, PYQ_SHARE:0.3, PYQ_HOLD:[2024,2025,2026], CSAT_MK:[2.5,0.83], CSAT_PASS:33, STORE:"pa2-store", OLD:"prelims-arena-v3", OLD_SYNC:"prelims-arena-sync-v1",
  MOCK_WEIGHTS:{"Polity":15,"History":15,"Geography":12,"Economy":14,"Environment":14,"Science & Tech":12,"Current Affairs":18},
  REVIEW_DAYS:[1,3,7,21], CAM_FROM:"2026-10-31"
};
// Shankar IAS Prestorming Batch II schedule: key, name, date, subject, type
var TESTS=[
["T1","Test 1: World Physical & Human Geography","2026-10-17","Geography"],["T2","Test 2: Indian Polity I","2026-10-24","Polity"],["T3","Test 3: Modern India I","2026-10-31","History"],
["T4","Test 4: Current Affairs 1 (Jan-Mar 2026)","2026-11-14","Current Affairs"],["T5","Test 5: Economics I","2026-11-21","Economy"],["T6","Test 6: Science & Tech I","2026-11-28","Science & Tech"],
["T7","Test 7: Environment I","2026-12-05","Environment"],["T8","Test 8: Current Affairs 2 (Apr-Jun 2026)","2026-12-12","Current Affairs"],["T9","Test 9: Indian Geography","2026-12-19","Geography"],
["T10","Test 10: Indian Polity II","2026-12-26","Polity"],["T11","Test 11: Modern India II","2027-01-02","History"],["T12","Test 12: Current Affairs 3 (Jul-Sep 2026)","2027-01-09","Current Affairs"],
["T13","Test 13: Economics II","2027-01-23","Economy"],["T14","Test 14: Science & Tech II","2027-01-30","Science & Tech"],["T15","Test 15: Environment II","2027-02-06","Environment"],
["T16","Test 16: Current Affairs 4 (Oct-Dec 2026)","2027-02-13","Current Affairs"],["T17","Test 17: Indian Polity III","2027-02-20","Polity"],["T18","Test 18: Indian History III","2027-02-27","History"],
["T19","Test 19: Special Focus","2027-03-06","Mixed"],["T20","Test 20: International Organisations","2027-03-13","Current Affairs"],["T21","Test 21: Polity Complete","2027-03-20","Polity"],
["T22","Test 22: Geography Complete","2027-03-27","Geography"],["T23","Test 23: Economics Complete","2027-04-03","Economy"],["T24","Test 24: Budget & Economic Survey","2027-04-06","Economy"],
["T25","Test 25: History Complete","2027-04-10","History"],["T26","Test 26: Science & Tech Complete","2027-04-17","Science & Tech"],["T27","Test 27: Current Affairs Full","2027-04-21","Current Affairs"],
["T28","Test 28: Environment Complete","2027-04-24","Environment"],["MK1","Mock Test I (online)","2027-04-27","Mixed"],["MK2","Mock Test II (online)","2027-04-29","Mixed"],
["AM1","All India Mock Test I","2027-05-02","Mixed"],["AM2","All India Mock Test II","2027-05-09","Mixed"],["AM3","All India Mock Test III","2027-05-16","Mixed"]
].map(function(t){return {k:t[0],name:t[1],date:t[2],subject:t[3],type:/^(MK|AM)/.test(t[0])?"mock":"weekly",kind:/^(MK|AM)/.test(t[0])?"GS mock":"GS weekly test"}});
// Shankar CSAT schedule (Sundays, 2 to 4 pm; recorded discussion at 4:30 pm; live discussion for complete-syllabus tests)
(function(){
  var R=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
  ["2026-10-25","2026-11-01","2026-11-15","2026-11-22","2026-11-29","2026-12-06","2026-12-13","2026-12-20","2026-12-27","2027-01-03","2027-01-10","2027-01-24","2027-01-31","2027-02-07","2027-02-14"].forEach(function(d,i){
    var full=i>=12;
    TESTS.push({k:"C"+(i+1),name:"CSAT "+(full?"Complete Syllabus":"Sectional")+" Test "+R[i],date:d,subject:"CSAT",type:full?"mock":"weekly",kind:full?"CSAT complete syllabus":"CSAT sectional",csat:true});
  });
  TESTS.sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:0)});
})();
var TYPE_LABEL={daily:"Daily",weekly:"Weekly",mock:"Mock",subject:"Subject test",ca:"Current affairs",cam:"Current affairs",fullmock:"Mock",revision:"Revision",bonus:"Daily",myq:"Mock",pyq:"UPSC paper",pyqsub:"PYQ practice",pyqmock:"PYQ mock",csatset:"CSAT practice",csatmock:"CSAT mock"};
// dashboard filter group of an attempt type
function typeGroup(t){return ({daily:"daily",bonus:"daily",ca:"ca",cam:"ca",mock:"mock",fullmock:"mock",myq:"mock",subject:"subject",revision:"subject",weekly:"weekly",pyq:"pyq",pyqsub:"pyq",pyqmock:"pyq",csatset:"subject",csatmock:"mock"})[t]||"daily"}
function isPyq(qid){return String(qid).indexOf("PYQ-")===0}
function pyqYear(qid){var m=/^PYQ-[A-Z]+-(\d{4})/.exec(qid);return m?+m[1]:null}

/* helpers */
function $(id){return document.getElementById(id)}
function qsa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function pad(n){return (n<10?"0":"")+n}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function pd(s){var p=String(s).slice(0,10).split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function dayNum(s){return Math.round((pd(s).getTime()-pd(s).getTimezoneOffset()*60000)/86400000)}
function addDays(s,n){var d=pd(s);d.setDate(d.getDate()+n);return ymd(d)}
function today(){return ymd(new Date())}
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
var WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fd(s){if(!s)return "";var d=pd(s);return d.getDate()+" "+MON[d.getMonth()]}
function fdy(s){if(!s)return "";var d=pd(s);return d.getDate()+" "+MON[d.getMonth()]+" "+d.getFullYear()}
function fdw(s){var d=pd(s);return WD[d.getDay()]+", "+d.getDate()+" "+MON[d.getMonth()]}
function fmtT(sec){sec=Math.max(0,Math.floor(sec));var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?h+":"+pad(m):m)+":"+pad(s)}
function fmtMin(sec){var m=Math.round(sec/60);return m<60?m+" min":Math.floor(m/60)+" h "+(m%60?m%60+" min":"")}
function pts(r,w,mk){mk=mk||[CFG.RIGHT,CFG.WRONG];return Math.round((r*mk[0]-w*mk[1])*100)/100}
function pct(a,b){return b?a/b*100:0}
function r1(x){return Math.round(x*10)/10}
function uid(p){return p+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-")}
function toast(msg,ms){var t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},ms||3200)}
function lsGet(k,def){try{var v=localStorage.getItem(k);return v==null?def:JSON.parse(v)}catch(e){return def}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}

/* ===== manifest ===== */
var M=null,SET={},BYDATE={},TESTBYDATE={},TESTBYKEY={},UNITLIST={},UNITGROUP={};
function indexManifest(m){
  M=m;SET={};BYDATE={};
  m.sets.forEach(function(s){SET[s.id]=s;if(s.date)(BYDATE[s.date]=BYDATE[s.date]||[]).push(s)});
  TESTS.forEach(function(t){TESTBYDATE[t.date]=t;TESTBYKEY[t.k]=t});
  m.subjects.forEach(function(s){
    var u=m.units[s]||[];UNITLIST[s]=[];
    u.forEach(function(x){if(typeof x==="string"){UNITLIST[s].push(x)}else{x.units.forEach(function(y){UNITLIST[s].push(y);UNITGROUP[s+"|"+y]=x.g})}});
  });
}
function scheduledFor(ds){return (BYDATE[ds]||[])}

/* ===== store ===== */
// records: att (finished quiz), test (Shankar or added test marks), run (paused quiz),
// chk (daily check-in), rep (reported question), myq (own question)
var DB={recs:{},dirty:{},meta:{}};
function loadStore(){var o=lsGet(CFG.STORE,null);if(o&&o.recs){DB=o;DB.dirty=DB.dirty||{};DB.meta=DB.meta||{}}}
var saveT=null;
function saveStore(now){clearTimeout(saveT);if(now){if(!lsSet(CFG.STORE,DB))toast("This device is out of storage space. Sync to your Google Sheet and clear old data.");return}saveT=setTimeout(function(){saveStore(true)},150)}
function put(id,rec,opts){
  rec.ts=(opts&&opts.keepTs&&rec.ts)?rec.ts:Date.now();
  DB.recs[id]=rec;DB.dirty[id]=1;saveStore();
  if(!(opts&&opts.noSync))syncSoon();
}
function del(id){var r=DB.recs[id];if(!r)return;var c=Object.assign({},r,{del:true});if(c.kind==="run"){c={kind:"run",key:r.key,del:true}}put(id,c)}
function recs(kind){var out=[];for(var id in DB.recs){var r=DB.recs[id];if(r.kind===kind&&!r.del)out.push(Object.assign({id:id},r))}return out}
function attempts(){return recs("att").sort(function(a,b){return a.ts-b.ts})}
function testMarks(){return recs("test")}

/* migrate data saved by version 1 on this device */
function migrateOld(){
  if(DB.meta.migrated)return;
  var o=lsGet(CFG.OLD,null);DB.meta.migrated=1;
  if(o){
    Object.keys(o).forEach(function(k){
      var d=o[k];if(!d)return;
      if(d.kind==="att"&&!DB.recs[k]){
        var s=SET[d.setId]||{};
        var items=(d.it||[]).map(function(x){var m=(M.labelmap[x[1]]||[String(x[1]).split("|")[0],String(x[1]).split("|")[1]]);return [x[0],m[0],m[1],null,x[2],0,0,0]});
        DB.recs[k]={kind:"att",ts:d.ts,date:d.date,type:s.type||"daily",setId:d.setId,title:d.title,subject:s.subject||d.subject,sched:s.date||null,n:d.n,r:d.r,w:d.w,sk:d.sk,pts:d.pts,max:d.n*CFG.RIGHT,sec:d.sec,timed:d.mode==="timed",items:items,v1:1};
        DB.dirty[k]=1;
      }else if(d.kind==="test"&&d.k&&!DB.recs["test_"+d.k]){
        var t=TESTBYKEY[d.k]||{};
        DB.recs["test_"+d.k]={kind:"test",ts:d.ts||Date.now(),k:d.k,name:t.name||d.k,type:t.type||"weekly",subject:t.subject||"",date:d.date||t.date,marks:d.marks,max:d.max||200,r:d.r,w:d.w,rank:d.rank};
        DB.dirty["test_"+d.k]=1;
      }
    });
  }
  var os=lsGet(CFG.OLD_SYNC,null);
  if(os&&os.url&&!DB.meta.syncUrl){DB.meta.syncUrl=os.url;DB.meta.syncKey=os.key||""}
  saveStore(true);
}

/* data loading and statistics */
var CACHE={};
function loadSet(id){
  if(CACHE[id])return Promise.resolve(CACHE[id]);
  if(id==="myq")return Promise.resolve(myqSet());
  return fetch("data/sets/"+encodeURIComponent(id)+".json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(d){
    d.questions.forEach(function(q,i){q.qid=id+"#"+i;if(q.pid&&d.passages)q.p=d.passages[q.pid]});CACHE[id]=d;return d;
  });
}
function myqSet(){
  var qs=recs("myq").filter(function(x){return x.q&&x.o&&x.o.length===4}).sort(function(a,b){return (a.created||a.ts)-(b.created||b.ts)}).map(function(x){
    return {qid:"myq#"+x.id,q:x.q,o:x.o,a:x.a,e:x.e||"",s:x.src||"My question",sub:x.sub||"Polity",u:x.u||"My questions",mine:1};
  });
  return {id:"myq",title:"My questions",questions:qs};
}
// load questions by qid list -> array of question objects (missing ones dropped)
function loadQids(qids){
  var ids={};qids.forEach(function(q){ids[q.split("#")[0]]=1});
  return Promise.all(Object.keys(ids).map(function(id){return loadSet(id).catch(function(){return null})})).then(function(){
    var my=myqSet(),mym={};my.questions.forEach(function(q){mym[q.qid]=q});
    return qids.map(function(qid){
      var sid=qid.split("#")[0];
      if(sid==="myq")return mym[qid]||null;
      var d=CACHE[sid];if(!d)return null;return d.questions[+qid.split("#")[1]]||null;
    }).filter(Boolean);
  });
}

/* per-question history from all finished attempts: qid -> [{ts,c}] (c: 1 right, 0 wrong, -1 skipped) */
function qHistory(){
  var h={};
  attempts().forEach(function(a){(a.items||[]).forEach(function(x){if(x[4]===2)return;(h[x[0]]=h[x[0]]||[]).push({ts:a.ts,c:x[4]})})});
  return h;
}
/* mistake book: questions answered wrong or skipped, until right twice in a row afterwards */
function mistakeBook(){
  var h=qHistory(),out=[];var now=Date.now();
  Object.keys(h).forEach(function(qid){
    var ev=h[qid];var lastBad=-1;
    ev.forEach(function(e,i){if(e.c!==1)lastBad=i});
    if(lastBad<0)return;
    var after=ev.slice(lastBad+1);
    var streak=0;after.forEach(function(e){streak=e.c===1?streak+1:0});
    if(streak>=2)return;
    var reviews=after.length;
    var lastTs=ev[ev.length-1].ts;
    var due=lastTs+CFG.REVIEW_DAYS[Math.min(reviews,CFG.REVIEW_DAYS.length-1)]*86400000;
    out.push({qid:qid,due:due,isDue:due<=now,reviews:reviews,lastBad:ev[lastBad].ts});
  });
  return out.sort(function(a,b){return a.due-b.due});
}
function qMeta(){ // qid -> [subject, unit] from attempts
  var m={};attempts().forEach(function(a){(a.items||[]).forEach(function(x){m[x[0]]=[x[1],x[2]]})});return m;
}

/* unit/subject accuracy (accuracy = right / attempted) within a date range */
function unitStats(from,to){
  var st={};
  attempts().forEach(function(a){
    if(from&&a.date<from)return;if(to&&a.date>to)return;
    (a.items||[]).forEach(function(x){
      var s=x[1],u=x[2];if(!s||x[4]===2)return;
      var su=st[s]||(st[s]={r:0,w:0,sk:0,units:{}});
      var o=su.units[u]||(su.units[u]={r:0,w:0,sk:0,ev:[]});
      if(x[4]===1){su.r++;o.r++}else if(x[4]===0){su.w++;o.w++}else{su.sk++;o.sk++}
      if(x[4]!==-1)o.ev.push([a.ts,x[4]]);
    });
  });
  return st;
}
function accOf(o){var n=o.r+o.w;return n?o.r/n*100:null}
function unitStatus(o){var n=o.r+o.w;if(n<10)return "nodata";var a=o.r/n*100;return a>=75?"strong":(a<50?"weak":"moderate")}
function unitTrend(o){ // accuracy last 30 days vs before
  var cut=Date.now()-30*86400000,A=[0,0],B=[0,0];
  o.ev.forEach(function(e){var t=e[0]>=cut?A:B;t[0]+=e[1];t[1]++});
  if(A[1]<5||B[1]<5)return null;
  var d=A[0]/A[1]*100-B[0]/B[1]*100;return Math.abs(d)<5?"steady":(d>0?"up":"down");
}

/* calendar day state */
// a set counts as done once taken whole, or once all 5 of its parts are done
function setDoneMap(){var m={},parts={};attempts().forEach(function(a){if(!a.setId)return;if(a.part){(parts[a.setId]=parts[a.setId]||{})[a.part]=1}else m[a.setId]=(m[a.setId]||0)+1});
  Object.keys(parts).forEach(function(id){if(Object.keys(parts[id]).length>=5&&!m[id])m[id]=1});return m}
function partsDone(id){var d={};attempts().forEach(function(a){if(a.setId===id&&a.part)d[a.part]=1});return d}
/* monthly current-affairs sets (CAM26-MM-NN) and the daily 25 */
// the Jan-Mar test-week sets are replaced by the monthly Jan-Mar sets once those are all in the app
function schedFor(ds){var cam=camSets().length>=18;return scheduledFor(ds).filter(function(s){return !(cam&&s.type==="ca"&&/^CA25-T4-/.test(s.id))})}
function camSets(){return M.sets.filter(function(s){return s.type==="cam"&&s.ready}).sort(function(a,b){return a.id<b.id?-1:1})}
function nextCamSet(){var done=setDoneMap();return camSets().filter(function(s){return !done[s.id]})[0]||null}
function camDoneOn(ds){return attempts().some(function(a){return a.date===ds&&(a.type==="cam"||a.type==="ca")&&!a.part})}
// the day has a 25-question current-affairs target from CAM_FROM on, or when a CA test-week set is scheduled
function dayState(ds,done,td){
  var sch=schedFor(ds).filter(function(s){return s.ready});
  var s50=sch.filter(function(s){return s.type!=="ca"}),sCA=sch.filter(function(s){return s.type==="ca"});
  var need25=sCA.length>0||(ds>=CFG.CAM_FROM&&ds<=CFG.PRELIMS);
  var flags=[];
  if(s50.length)flags.push(s50.every(function(s){return done[s.id]}));
  if(need25)flags.push((sCA.length&&sCA.every(function(s){return done[s.id]}))||camDoneOn(ds));
  var st="none";
  if(flags.length){
    var nd=flags.filter(Boolean).length;
    if(nd===flags.length)st="done";
    else if(nd>0)st="part";
    else{
      var paused=sch.some(function(s){return Object.keys(DB.recs).some(function(k){var r=DB.recs[k];return r.kind==="run"&&!r.del&&(k==="run_"+s.id||k.indexOf("run_"+s.id+"~")===0)})});
      st=paused?"paused":(ds<td?"missed":"todo");
    }
  }
  var schIds={};sch.forEach(function(s){schIds[s.id]=1});
  var extra=attempts().some(function(a){return a.date===ds&&a.type!=="cam"&&!(a.setId&&schIds[a.setId])});
  var chk=DB.recs["chk_"+ds];
  return {st:st,star:extra,chk:chk&&!chk.del?chk.v:null,test:TESTBYDATE[ds]||null,sch:sch,need25:need25,has50:s50.length>0,flags:flags};
}
function streak(){
  var n=0,d=today();
  var c=DB.recs["chk_"+d];if(!(c&&c.v==="yes"))d=addDays(d,-1);
  while(true){var r=DB.recs["chk_"+d];if(r&&!r.del&&r.v==="yes"){n++;d=addDays(d,-1)}else break}
  return n;
}

/* Google Sheet sync. All records go up; all records come down; newest timestamp wins. */
var SY={busy:false,msg:"",state:"off",timer:null};
function syncCfg(){return {url:DB.meta.syncUrl||"",key:DB.meta.syncKey||""}}
function pendingCount(){return Object.keys(DB.dirty).length}
function syncSoon(){clearTimeout(SY.timer);SY.timer=setTimeout(function(){sync()},1500)}
function setSyncMsg(state,msg){SY.state=state;SY.msg=msg;updateSyncBadge()}
function sync(){
  var c=syncCfg();
  if(!c.url){setSyncMsg("off","Not connected to a Google Sheet.");return Promise.resolve()}
  if(SY.busy)return Promise.resolve();
  if(navigator.onLine===false){setSyncMsg("offline","Offline. "+pendingCount()+" change(s) will upload when you are online.");return Promise.resolve()}
  SY.busy=true;setSyncMsg("busy","Syncing");
  var ids=Object.keys(DB.dirty),batches=[];
  for(var i=0;i<ids.length;i+=40)batches.push(ids.slice(i,i+40));
  var chain=Promise.resolve();
  batches.forEach(function(b){
    chain=chain.then(function(){
      var payload={key:c.key,v:2,recs:b.map(function(id){var r=DB.recs[id];return r?Object.assign({id:id},r):null}).filter(Boolean)};
      return fetch(c.url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    });
  });
  return chain.then(function(){
    return fetch(c.url+(c.url.indexOf("?")<0?"?":"&")+"key="+encodeURIComponent(c.key)+"&v=2&_="+Date.now());
  }).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(j){
    if(j.error)throw new Error(j.error==="wrong passphrase"?"the passphrase does not match the script":j.error);
    if(!j.recs)throw new Error("the Sheet script is an old version; copy the new script from this page");
    mergeRemote(j.recs);
    DB.meta.lastSync=Date.now();saveStore(true);
    var left=pendingCount();
    setSyncMsg(left?"pending":"ok",left?left+" change(s) still waiting to upload. They will retry.":"All changes saved to your Google Sheet.");
  }).catch(function(e){
    setSyncMsg("error","Could not sync: "+((e&&e.message)||"network error")+". Your data is safe on this device.");
  }).then(function(){SY.busy=false;if(typeof onDataChanged==="function")onDataChanged()});
}
function mergeRemote(list){
  list.forEach(function(r){
    if(!r||!r.id)return;
    var id=r.id;delete r.id;r.ts=+r.ts||0;
    var l=DB.recs[id];
    if(!DB.dirty[id]){DB.recs[id]=r}            // nothing local waiting: the Sheet is the source of truth (also picks up edits typed in the Sheet)
    else if(!l||r.ts>l.ts){DB.recs[id]=r;delete DB.dirty[id]}
    else if(r.ts===l.ts){delete DB.dirty[id]}   // our upload arrived
  });
}
window.addEventListener("online",function(){sync()});

/* quiz engine */
var QZ=null;
var CONF=["","Sure","50-50","Guess"];
function startQuiz(o){
  // o: {key,type,setId,title,subject,sched,qs,timed,limit,run}
  var n=o.qs.length,run=o.run;
  QZ={key:o.key,type:o.type,setId:o.setId||null,title:o.title,subject:o.subject||"Mixed",sched:o.sched||null,qs:o.qs,
    i:0,ans:new Array(n).fill(null),conf:new Array(n).fill(0),mark:new Array(n).fill(0),secs:new Array(n).fill(0),seen:new Array(n).fill(0),strike:new Array(n).fill(0),part:o.part||(run&&run.part)||null,
    timed:!!o.timed,limit:o.limit||Math.round(n*CFG.SEC_PER_Q),mk:o.mk||(run&&run.mk)||null,el:0,t0:Date.now(),qt0:Date.now(),nav:false,tick:null};
  if(run){["i","ans","conf","mark","secs","seen","strike"].forEach(function(k){if(run[k]&&(k==="i"||run[k].length===n))QZ[k]=Array.isArray(run[k])?run[k].slice():run[k]});QZ.el=run.el||0;QZ.limit=run.limit||QZ.limit;QZ.timed=!!run.timed}
  QZ.t0=Date.now()-QZ.el*1000;QZ.qt0=Date.now();
  if(typeof stopPlayer==="function"&&PL.list.length)stopPlayer();
  VIEW.screen="quiz";document.body.classList.add("in-quiz");
  clearInterval(QZ.tick);QZ.tick=setInterval(quizTick,1000);
  renderQuiz();window.scrollTo(0,0);
}
function elapsed(){return QZ?(Date.now()-QZ.t0)/1000:0}
function quizTick(){
  if(!QZ||QZ.hiddenAt)return;var el=$("qz-clock");if(!el)return;
  if(QZ.timed){var left=QZ.limit-elapsed();el.textContent=fmtT(left)+" left";el.classList.toggle("low",left<300);if(left<=0){toast("Time is up. Your test has been submitted.");submitQuiz()}}
  else el.textContent=fmtT(elapsed());
}
function noteTime(){if(!QZ)return;var now=Date.now();QZ.secs[QZ.i]+=Math.round((now-QZ.qt0)/1000);QZ.qt0=now}
function saveRun(sync){
  if(!QZ)return;
  var answered=QZ.ans.filter(function(a){return a!=null}).length;
  if(!answered&&QZ.i===0&&!QZ.mark.some(Boolean))return;
  put("run_"+QZ.key,{kind:"run",key:QZ.key,type:QZ.type,setId:QZ.setId,title:QZ.title,subject:QZ.subject,sched:QZ.sched,
    qids:QZ.qs.map(function(q){return q.qid}),i:QZ.i,ans:QZ.ans,conf:QZ.conf,mark:QZ.mark,secs:QZ.secs,seen:QZ.seen,strike:QZ.strike,part:QZ.part,
    el:Math.round(elapsed()),timed:QZ.timed,limit:QZ.limit,mk:QZ.mk,done:answered,n:QZ.qs.length},{noSync:!sync});
}
function goQ(i){if(!QZ||i<0||i>=QZ.qs.length)return;noteTime();QZ.i=i;QZ.nav=false;renderQuiz();saveRun(false);var c=$("qz-card");if(c&&c.scrollIntoView&&window.innerWidth<900)window.scrollTo(0,0)}
function choose(k){QZ.strike[QZ.i]&=~(1<<k);QZ.ans[QZ.i]=QZ.ans[QZ.i]===k?null:k;if(QZ.ans[QZ.i]==null)QZ.conf[QZ.i]=0;renderQuiz();saveRun(false)}
function toggleStrike(k){QZ.strike[QZ.i]^=(1<<k);if(QZ.ans[QZ.i]===k&&(QZ.strike[QZ.i]&(1<<k))){QZ.ans[QZ.i]=null;QZ.conf[QZ.i]=0}renderQuiz();saveRun(false)}
function setConf(c){QZ.conf[QZ.i]=QZ.conf[QZ.i]===c?0:c;renderQuiz();saveRun(false)}
function toggleMark(){QZ.mark[QZ.i]=QZ.mark[QZ.i]?0:1;renderQuiz();saveRun(false)}
function clearAns(){QZ.ans[QZ.i]=null;QZ.conf[QZ.i]=0;renderQuiz();saveRun(false)}
function pauseQuiz(){noteTime();saveRun(true);clearInterval(QZ.tick);QZ=null;document.body.classList.remove("in-quiz");VIEW.screen="tabs";render();toast("Test paused. Open it again to carry on where you stopped.")}

function bubbleClass(i){
  var c=[];if(i===QZ.i)c.push("cur");
  if(QZ.ans[i]!=null)c.push("ans");else if(QZ.seen[i])c.push("skip");
  if(QZ.mark[i])c.push("mark");return c.join(" ");
}
function renderQuiz(){
  var q=QZ.qs[QZ.i],n=QZ.qs.length;QZ.seen[QZ.i]=1;
  var answered=QZ.ans.filter(function(a){return a!=null}).length,marked=QZ.mark.filter(Boolean).length;
  var grid=QZ.qs.map(function(_,i){return '<button class="bub '+bubbleClass(i)+'" data-go="'+i+'" aria-label="Question '+(i+1)+'">'+(i+1)+'</button>'}).join("");
  var opts=q.o.map(function(t,k){var st=(QZ.strike[QZ.i]>>k)&1;return '<div class="optrow"><button class="opt'+(QZ.ans[QZ.i]===k?" sel":"")+(st?" struck":"")+'" data-k="'+k+'"><span class="ob">'+"ABCD"[k]+'</span><span class="ot">'+esc(t)+'</span></button><button class="strike" data-x="'+k+'" aria-pressed="'+!!st+'" aria-label="'+(st?"Bring back option ":"Cross out option ")+"ABCD"[k]+'" title="'+(st?"Bring back":"Cross out")+'">'+(st?"↺":"✕")+'</button></div>'}).join("");
  var last=QZ.i===n-1;
  $("app").innerHTML=
   '<div class="quiz">'+
    '<header class="qz-top"><button class="btn ghost" id="qz-pause">Pause</button><div class="qz-title"><b>'+esc(QZ.title)+'</b><span>'+answered+' of '+n+' answered'+(marked?', '+marked+' marked':'')+'</span></div><span class="qz-clock" id="qz-clock">'+(QZ.timed?fmtT(QZ.limit-elapsed())+" left":fmtT(elapsed()))+'</span><button class="btn ghost navbtn" id="qz-nav" aria-expanded="'+QZ.nav+'">Questions</button></header>'+
    '<div class="qz-body">'+
     '<aside class="qz-grid'+(QZ.nav?" open":"")+'" aria-label="Question navigator"><div class="gridhead"><span>Jump to a question</span><span class="key"><i class="k ans"></i>Answered <i class="k skip"></i>Skipped <i class="k mark"></i>Marked</span></div><div class="bubs">'+grid+'</div></aside>'+
     '<section class="qz-main">'+
      '<article class="qcard" id="qz-card"><div class="qmeta"><span>Question '+(QZ.i+1)+' of '+n+'</span>'+pyqChip(q)+'<span class="chip">'+esc(q.u)+'</span></div>'+
       passageHtml(q,true)+(q.x?'<p class="note">'+esc(dropNote(q))+'</p>':'')+'<div class="qtext">'+esc(q.q)+'</div><div class="opts">'+opts+'</div>'+
       '<div class="conf"><span>How sure are you?</span><div class="seg">'+[1,2,3].map(function(c){return '<button data-c="'+c+'" aria-pressed="'+(QZ.conf[QZ.i]===c)+'"'+(QZ.ans[QZ.i]==null?" disabled":"")+'>'+CONF[c]+'</button>'}).join("")+'</div></div>'+
      '</article>'+
      '<div class="qz-actions"><button class="btn" id="qz-prev"'+(QZ.i===0?" disabled":"")+'>Previous</button><button class="btn'+(QZ.mark[QZ.i]?" on":"")+'" id="qz-mark" aria-pressed="'+!!QZ.mark[QZ.i]+'">'+(QZ.mark[QZ.i]?"Marked for review":"Mark for review")+'</button><button class="btn" id="qz-clear"'+(QZ.ans[QZ.i]==null?" disabled":"")+'>Clear answer</button><button class="btn primary" id="qz-next">'+(last?"Review and submit":"Next")+'</button></div>'+
      '<div class="qz-foot"><button class="link" id="qz-report">Report a problem with this question</button><button class="btn" id="qz-submit">Submit test</button></div>'+
     '</section>'+
    '</div>'+
   '</div>';
  qsa(".opt").forEach(function(b){b.onclick=function(){choose(+b.dataset.k)}});
  qsa(".strike").forEach(function(b){b.onclick=function(){toggleStrike(+b.dataset.x)}});
  qsa(".conf button").forEach(function(b){b.onclick=function(){setConf(+b.dataset.c)}});
  qsa("[data-go]").forEach(function(b){b.onclick=function(){goQ(+b.dataset.go)}});
  $("qz-prev").onclick=function(){goQ(QZ.i-1)};
  $("qz-next").onclick=function(){if(last)confirmSubmit();else goQ(QZ.i+1)};
  $("qz-mark").onclick=toggleMark;$("qz-clear").onclick=clearAns;
  $("qz-pause").onclick=pauseQuiz;$("qz-submit").onclick=confirmSubmit;
  $("qz-nav").onclick=function(){QZ.nav=!QZ.nav;renderQuiz()};
  $("qz-report").onclick=function(){reportDialog(q)};
}
document.addEventListener("keydown",function(ev){
  if(VIEW.screen!=="quiz"||!QZ||ev.metaKey||ev.ctrlKey||ev.altKey||$("modal"))return;
  var tg=ev.target&&ev.target.tagName;if(tg==="INPUT"||tg==="TEXTAREA"||tg==="SELECT")return;
  var k=ev.key.toLowerCase(),m={a:0,b:1,c:2,d:3,"1":0,"2":1,"3":2,"4":3};
  if(m.hasOwnProperty(k)){choose(m[k]);ev.preventDefault()}
  else if(k==="arrowright"||k==="enter"){if(tg==="BUTTON"&&k==="enter")return;goQ(QZ.i+1);ev.preventDefault()}
  else if(k==="arrowleft")goQ(QZ.i-1);
  else if(k==="m")toggleMark();
});
window.addEventListener("pagehide",function(){if(QZ){noteTime();saveRun(false)}saveStore(true)});
document.addEventListener("visibilitychange",function(){
  if(!QZ)return;
  if(document.hidden){noteTime();if(DB.meta.autoPause!==false)QZ.hiddenAt=Date.now();saveRun(false);saveStore(true)}
  else if(QZ.hiddenAt){var gap=Date.now()-QZ.hiddenAt;QZ.hiddenAt=null;QZ.t0+=gap;QZ.qt0=Date.now();if(gap>20000)toast("The clock was paused while you were away ("+fmtMin(gap/1000)+").")}
});

function pyqChip(q){return q&&q.y?'<span class="tag pyq">UPSC '+q.y+(q.paper==="CSAT"?" CSAT":"")+'</span>':''}
function dropNote(q){return q.x===2?"This question needs a figure from the original paper that is not reproduced here, so it is not scored.":"UPSC dropped this question from evaluation, so it is not scored."}
function paras(t){return String(t||"").split(/\n\s*\n/).map(function(p){var L=p.split("\n");if(L.every(function(l){return l.indexOf(" | ")>=0}))return '<div class="ptab"><table>'+L.map(function(l,i){var c=i?"td":"th";return "<tr>"+l.split(" | ").map(function(x){return "<"+c+">"+esc(x.trim())+"</"+c+">"}).join("")+"</tr>"}).join("")+'</table></div>';return '<p>'+esc(p)+'</p>'}).join("")}
function passageHtml(q,quiz){
  if(!q||!q.p)return "";
  if(quiz)return '<div class="passage" tabindex="0" aria-label="Passage"><div class="plabel">Passage</div>'+paras(q.p)+'</div>';
  return '<details class="passage-d"><summary>Show the passage</summary><div class="passage">'+paras(q.p)+'</div></details>';
}
function confirmSubmit(){
  noteTime();
  var n=QZ.qs.length,un=QZ.ans.filter(function(a){return a==null}).length,mk=QZ.mark.filter(Boolean).length;
  var firstUn=QZ.ans.indexOf(null),firstMk=QZ.mark.indexOf(1);
  modal('<h2>Submit this test?</h2><p>You answered '+(n-un)+' of '+n+' questions.'+(un?' '+un+' unanswered question'+(un>1?"s":"")+' will score zero.':'')+(mk?' '+mk+' question'+(mk>1?"s are":" is")+' marked for review.':'')+'</p>'+
    '<div class="row wrap">'+(firstMk>=0?'<button class="btn" data-m="mk">Go to marked</button>':'')+(firstUn>=0?'<button class="btn" data-m="un">Go to unanswered</button>':'')+'<button class="btn primary" data-m="sub">Submit test</button><button class="btn ghost" data-m="x">Keep working</button></div>',
    function(act){if(act==="sub")submitQuiz();else if(act==="mk")goQ(firstMk);else if(act==="un")goQ(firstUn)});
}
function submitQuiz(){
  if(!QZ)return;noteTime();clearInterval(QZ.tick);
  var r=0,w=0,sk=0,nd=0,items=[],mk=QZ.mk||[CFG.RIGHT,CFG.WRONG];
  QZ.qs.forEach(function(q,i){var a=QZ.ans[i],c=q.x?2:(a==null?-1:(a===q.a?1:0));if(c===1)r++;else if(c===0)w++;else if(c===2)nd++;else sk++;
    items.push([q.qid,q.sub,q.u,a==null?-1:a,c,QZ.conf[i],QZ.secs[i],QZ.mark[i],QZ.strike[i]||0])});
  var id=uid("att"),n=QZ.qs.length;
  var rec={kind:"att",type:QZ.type,setId:QZ.setId,title:QZ.title,subject:QZ.subject,sched:QZ.sched,date:today(),n:n,r:r,w:w,sk:sk,pts:pts(r,w,mk),max:Math.round((n-nd)*mk[0]*100)/100,sec:Math.round(elapsed()),timed:QZ.timed,items:items};
  if(QZ.mk)rec.mk=QZ.mk;if(nd)rec.nd=nd;if(QZ.part)rec.part=QZ.part;
  put(id,rec);
  if(DB.recs["run_"+QZ.key])del("run_"+QZ.key);
  saveStore(true);
  var qs=QZ.qs;QZ=null;document.body.classList.remove("in-quiz");
  showResult(Object.assign({id:id},rec),qs,true);
}

/* result + review */
function confStats(items){
  var o={1:{n:0,r:0,w:0},2:{n:0,r:0,w:0},3:{n:0,r:0,w:0},0:{n:0,r:0,w:0}};
  items.forEach(function(x){if(x[4]===-1||x[4]===2)return;var c=o[x[5]||0];c.n++;if(x[4]===1)c.r++;else c.w++});
  return o;
}
function confTable(items){
  var o=confStats(items);
  var rows=[1,2,3,0].filter(function(c){return o[c].n}).map(function(c){var s=o[c];return '<tr><td>'+(c?CONF[c]:"Not tagged")+'</td><td>'+s.n+'</td><td>'+Math.round(s.r/s.n*100)+'%</td><td class="'+(pts(s.r,s.w)>=0?"pos":"neg")+'">'+(pts(s.r,s.w)>0?"+":"")+pts(s.r,s.w)+'</td></tr>'}).join("");
  if(!rows)return '<p class="muted">Tag answers as Sure, 50-50 or Guess while you answer to see how your guesses pay off.</p>';
  var adv="";var g=o[2],h=o[3];
  if(g.n>=5)adv+=pts(g.r,g.w)>=0?" Your 50-50 answers are gaining marks: keep attempting them.":" Your 50-50 answers are losing marks: be more selective.";
  if(h.n>=5)adv+=pts(h.r,h.w)>=0?" Even your guesses are net positive.":" Pure guesses are costing you marks: skip them.";
  return '<table class="tbl"><thead><tr><th>Confidence</th><th>Answered</th><th>Right</th><th>Net marks</th></tr></thead><tbody>'+rows+'</tbody></table>'+(adv?'<p class="muted">'+adv.trim()+'</p>':'');
}
function showResult(att,qs,fresh){
  VIEW.screen="result";RES={att:att,qs:qs,filter:"all"};renderResult(fresh);window.scrollTo(0,0);
}
var RES=null;
function renderResult(fresh){
  var a=RES.att,qs=RES.qs,items=a.items||[];
  var acc=(a.r+a.w)?Math.round(a.r/(a.r+a.w)*100):0,pc=Math.round(pct(a.pts,a.max));
  var unitAgg={};items.forEach(function(x){if(x[4]===2)return;var o=unitAgg[x[2]]||(unitAgg[x[2]]={r:0,w:0,sk:0});if(x[4]===1)o.r++;else if(x[4]===0)o.w++;else o.sk++});
  var unitRows=Object.keys(unitAgg).map(function(u){var o=unitAgg[u],n=o.r+o.w;return '<tr><td>'+esc(u)+'</td><td>'+o.r+'</td><td>'+o.w+'</td><td class="hide-sm">'+o.sk+'</td><td>'+(n?Math.round(o.r/n*100)+"%":"–")+'</td></tr>'}).join("");
  var filters=[["all","All"],["wrong","Wrong"],["skip","Skipped"],["mark","Marked"],["unsure","50-50 and guesses"]];
  var byQid={};qs.forEach(function(q){byQid[q.qid]=q});
  var list=items.map(function(x,i){return {x:x,i:i,q:byQid[x[0]]}}).filter(function(o){
    var f=RES.filter,x=o.x;return f==="all"||(f==="wrong"&&x[4]===0)||(f==="skip"&&x[4]===-1)||(f==="mark"&&x[7])||(f==="unsure"&&(x[5]===2||x[5]===3));
  });
  var cards=list.map(function(o){
    var x=o.x,q=o.q;if(!q)return '<div class="rcard"><p class="muted">Question '+(o.i+1)+' is no longer available.</p></div>';
    var ch=x[3];
    var sm=x[8]||0;
    var opts=q.o.map(function(t,k){var cl=k===q.a?"right":(k===ch&&x[4]!==2?"wrong":"");var cr=(sm>>k)&1;return '<li class="'+cl+(cr?" crossed":"")+'"><span class="ob">'+"ABCD"[k]+'</span><span class="ot">'+esc(t)+(k===q.a?'<em>Correct answer'+(k===ch?', your answer':'')+(cr?', but you crossed it out':'')+'</em>':(k===ch?'<em>Your answer</em>':(cr?'<em class="xo">Crossed out</em>':'')))+'</span></li>'}).join("");
    var verdict=x[4]===1?'<span class="tag good">Right</span>':(x[4]===0?'<span class="tag bad">Wrong</span>':(x[4]===2?'<span class="tag">Not scored</span>':'<span class="tag">Not answered</span>'));
    if(ch==null&&!a.v1)verdict=x[4]===1?verdict:verdict;
    return '<div class="rcard"><div class="qmeta"><span>Question '+(o.i+1)+'</span>'+pyqChip(q)+verdict+(x[5]?'<span class="tag">'+CONF[x[5]]+'</span>':'')+(x[7]?'<span class="tag warn">Marked</span>':'')+(((x[8]||0)>>q.a)&1?'<span class="tag bad">Crossed out the right answer</span>':'')+'<span class="chip">'+esc(q.u)+'</span>'+(x[6]?'<span class="muted small">'+x[6]+' s</span>':'')+'</div>'+
      passageHtml(q,false)+(q.x?'<p class="note">'+esc(dropNote(q))+'</p>':'')+'<div class="qtext">'+esc(q.q)+'</div><ul class="ropts">'+opts+'</ul>'+(a.v1&&ch==null&&x[4]!==-1?'<p class="muted small">Your chosen option was not recorded for tests taken in the earlier version.</p>':'')+
      '<div class="expl"><b>Explanation.</b> '+esc(q.e||"No explanation available.")+(q.h?'<div class="hook">Memory hook: '+esc(q.h)+'</div>':'')+'<div class="muted small">Source: '+esc(q.s||"–")+'</div></div>'+
      (q.pg&&String(q.qid).indexOf("CAM26-")===0?'<button class="link" data-note="'+esc(q.qid)+'">Read the note for this question (page '+q.pg+')</button> ':'')+'<button class="link" data-rep="'+esc(q.qid)+'">Report a problem with this question</button></div>';
  }).join("");
  $("app").innerHTML='<div class="page"><div class="pagehead"><button class="btn ghost" id="rs-back">'+(fresh?"Done":"Back")+'</button><div><h1>'+esc(a.title)+'</h1><p class="muted">'+esc(TYPE_LABEL[a.type]||a.type)+', taken '+fdy(a.date)+(a.sched&&a.sched!==a.date?', scheduled for '+fdy(a.sched):'')+'</p></div></div>'+
    '<section class="panel scorecard"><div class="big"><b>'+a.pts+'</b><span>of '+a.max+' marks ('+pc+'%)'+(a.mk&&a.mk[0]===CFG.CSAT_MK[0]?(pc>=CFG.CSAT_PASS?' · <em class="pass">Qualifies (33% needed)</em>':' · <em class="fail">Below the 33% qualifying mark</em>'):'')+(a.nd?' · '+a.nd+' question'+(a.nd>1?"s":"")+' not scored':'')+'</span></div><dl class="stats"><div><dt>Right</dt><dd>'+a.r+'</dd></div><div><dt>Wrong</dt><dd>'+a.w+'</dd></div><div><dt>Not answered</dt><dd>'+a.sk+'</dd></div><div><dt>Accuracy</dt><dd>'+acc+'%</dd></div><div><dt>Time</dt><dd>'+fmtMin(a.sec||0)+'</dd></div><div><dt>Per question</dt><dd>'+(a.n?Math.round((a.sec||0)/a.n):0)+' s</dd></div></dl></section>'+
    '<div class="cols"><section class="panel"><h2>By unit</h2><div class="scroll"><table class="tbl"><thead><tr><th>Unit</th><th>Right</th><th>Wrong</th><th class="hide-sm">Skipped</th><th>Accuracy</th></tr></thead><tbody>'+unitRows+'</tbody></table></div></section>'+
    '<section class="panel"><h2>Confidence</h2>'+confTable(items)+elimHtml(items,qs)+'</section></div>'+nextPartHtml(a)+notesAfterTest(a,qs)+
    '<section class="panel"><div class="row between wrap"><h2>Answers and explanations</h2><button class="btn small" id="rs-listen">Listen to these</button><div class="seg small">'+filters.map(function(f){return '<button data-f="'+f[0]+'" aria-pressed="'+(RES.filter===f[0])+'">'+f[1]+'</button>'}).join("")+'</div></div>'+(cards||'<p class="muted">No questions match this filter.</p>')+'</section></div>';
  $("rs-back").onclick=function(){VIEW.screen="tabs";render()};
  $("rs-listen").onclick=function(){var l=list.filter(function(o){return o.q&&!o.q.x}).map(function(o){return {q:o.q,ch:o.x[3]}});if(!l.length){toast("Nothing to read out for this filter.");return}playList(l,"Review: "+a.title)};
  if($("rs-next"))$("rs-next").onclick=function(){startPart(a.setId,+$("rs-next").dataset.p)};
  qsa("[data-f]").forEach(function(b){b.onclick=function(){RES.filter=b.dataset.f;renderResult(fresh)}});
  bindNotesAfterTest();
  qsa("[data-rep]").forEach(function(b){b.onclick=function(){reportDialog(byQid[b.dataset.rep])}});
}
function openAttempt(id){
  var a=DB.recs[id];if(!a)return;a=Object.assign({id:id},a);
  $("app").innerHTML='<div class="page"><p class="muted">Loading the test…</p></div>';
  loadQids((a.items||[]).map(function(x){return x[0]})).then(function(qs){showResult(a,qs,false)});
}

/* report a question */
function reportDialog(q){
  if(!q)return;
  modal('<h2>Report this question</h2><p class="muted">'+esc(q.q.slice(0,160))+(q.q.length>160?"…":"")+'</p><label class="fld">What is wrong?<select id="rp-why"><option>The answer key looks wrong</option><option>The question is unclear</option><option>The explanation is wrong</option><option>Something else</option></select></label><label class="fld">Details (optional)<textarea id="rp-note" rows="3" placeholder="For example: the correct answer should be C because…"></textarea></label><div class="row"><button class="btn primary" data-m="ok">Send report</button><button class="btn ghost" data-m="x">Cancel</button></div>',
  function(act){if(act!=="ok")return;put("rep_"+slug(q.qid),{kind:"rep",qid:q.qid,why:$("rp-why").value,note:$("rp-note").value,q:q.q.slice(0,300),date:today()});toast("Report saved. It will be fixed in a later update.")},true);
}

/* simple modal: html with buttons [data-m]; cb(action) */
function modal(html,cb,keepForRead){
  closeModal();
  var m=document.createElement("div");m.id="modal";m.className="modal";m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");
  m.innerHTML='<div class="mbox">'+html+'</div>';document.body.appendChild(m);
  var f=m.querySelector("button,select,input,textarea");if(f)f.focus();
  qsa("[data-m]",m).forEach(function(b){b.onclick=function(){var act=b.dataset.m;if(cb)cb(act,m);if(document.getElementById("modal")===m)closeModal()}});
  m.addEventListener("click",function(e){if(e.target===m)closeModal()});
  m.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal()});
}
function closeModal(){var m=$("modal");if(m)m.remove()}

/* elimination (crossed-out options) summary */
function elimStats(items,qs){
  var byQ={};(qs||[]).forEach(function(q){byQ[q.qid]=q});
  var o={opts:0,good:0,badQ:0,qn:0};
  items.forEach(function(x){var m=x[8]||0;if(!m||x[4]===2)return;var q=byQ[x[0]];o.qn++;
    for(var k=0;k<4;k++)if((m>>k)&1){o.opts++;if(q&&q.a===k)o.badQ++;else o.good++}});
  return o;
}
function elimHtml(items,qs){
  var e=elimStats(items,qs);if(!e.opts)return '<h3>Elimination</h3><p class="muted small">Cross out options you rule out (the ✕ beside each option) to practise the elimination method. Your record will show here.</p>';
  return '<h3>Elimination</h3><p>You crossed out '+e.opts+' option'+(e.opts>1?"s":"")+' in '+e.qn+' question'+(e.qn>1?"s":"")+'. <b>'+Math.round(e.good/e.opts*100)+'%</b> were rightly ruled out'+(e.badQ?'; in '+e.badQ+' question'+(e.badQ>1?"s":"")+' you crossed out the correct answer.':'.')+'</p>';
}
function nextPartHtml(a){
  if(!a.part||!a.setId||!SET[a.setId])return "";
  var done=partsDone(a.setId),nxt=null;for(var k=1;k<=5;k++)if(!done[k]){nxt=k;break}
  if(!nxt)return '<section class="panel"><p><b>All 5 parts done.</b> This set now counts as complete for '+fdy(SET[a.setId].date)+'.</p></section>';
  return '<section class="panel row between wrap"><p>'+Object.keys(done).length+' of 5 parts of this set done.</p><button class="btn primary" id="rs-next" data-p="'+nxt+'">Start part '+nxt+' (10 questions)</button></section>';
}

/* app shell, router, starting tests */
var VIEW={tab:"today",screen:"tabs",sel:null,month:null,dashType:"all",dashMonth:"all",subjOpen:{},from:null,to:null,practiceSubj:null,practiceUnits:{}};
var TABS=[["today","Today"],["practice","Practice"],["dash","Dashboard"],["scores","Scores"]];
var ICON={
  today:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="2"/></svg>',
  practice:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="7" r="2.6"/><circle cx="7" cy="17" r="2.6"/><circle cx="17" cy="17" r="2.6" class="fill"/></svg>',
  dash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16"/><path d="M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5"/></svg>',
  scores:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/></svg>'
};
function onDataChanged(){if(VIEW.screen==="tabs"){var ae=document.activeElement;if(ae&&(ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.tagName==="SELECT")&&$("view")&&$("view").contains(ae)){updateSyncBadge();return}render()}else updateSyncBadge()}
function updateSyncBadge(){
  var b=$("syncbadge");if(!b)return;
  var c=syncCfg(),st=SY.state;if(!c.url)st="off";
  var label={off:"Not syncing",ok:"Synced",busy:"Syncing",offline:"Offline",pending:"Waiting to sync",error:"Sync problem"}[st]||"Synced";
  b.className="syncbadge "+st;b.textContent=label;b.title=SY.msg||"";
  var m=$("sy-msg");if(m)m.textContent=SY.msg||(c.url?"":"Not connected yet.");
}
function render(){
  if(VIEW.screen!=="tabs")return;
  document.body.classList.remove("in-quiz");
  var nav=TABS.map(function(t){return '<a href="#'+t[0]+'" class="tab'+(VIEW.tab===t[0]?" on":"")+'" data-tab="'+t[0]+'" aria-current="'+(VIEW.tab===t[0]?"page":"false")+'">'+ICON[t[0]]+'<span>'+t[1]+'</span></a>'}).join("");
  $("app").innerHTML='<div class="shell"><header class="topbar"><div class="brand"><span class="mark" aria-hidden="true"></span><span>Prelims Arena</span></div><button class="syncbadge" id="syncbadge"></button></header>'+
    '<nav class="tabs" aria-label="Sections">'+nav+'</nav><main id="view" class="page"></main></div>';
  $("syncbadge").onclick=function(){VIEW.tab="scores";location.hash="scores";render();setTimeout(function(){var s=$("sync-card");if(s)s.scrollIntoView({behavior:"smooth"})},50)};
  ({today:viewToday,practice:viewPractice,dash:viewDash,scores:viewScores})[VIEW.tab]();
  updateSyncBadge();
}
window.addEventListener("hashchange",function(){var h=location.hash.replace("#","");if(["today","practice","dash","scores"].indexOf(h)>=0&&h!==VIEW.tab){VIEW.tab=h;if(VIEW.screen==="tabs"){render();window.scrollTo(0,0)}}});

/* ===== starting tests ===== */
function startSet(id,timed){
  var s=SET[id];if(!s||!s.ready)return;
  var run=DB.recs["run_"+id];if(run&&run.del)run=null;
  $("app").innerHTML='<div class="page"><p class="muted">Loading '+esc(s.title)+'…</p></div>';
  loadSet(id).then(function(d){
    startQuiz({key:id,type:s.type,setId:id,title:s.title,subject:s.subject,sched:s.date,qs:d.questions,timed:run?run.timed:timed,run:run,mk:s.paper==="CSAT"?CFG.CSAT_MK:null,limit:s.limit||null});
  }).catch(function(){VIEW.screen="tabs";render();toast("Could not load this set. Check your connection and try again.")});
}
function resumeRun(runId){
  var run=DB.recs[runId];if(!run||run.del)return;
  if(run.setId&&SET[run.setId]&&!run.part&&["subject","fullmock","revision","myq","pyqsub","pyqmock","csatmock"].indexOf(run.type)<0)return startSet(run.setId);
  $("app").innerHTML='<div class="page"><p class="muted">Loading your paused test…</p></div>';
  loadQids(run.qids).then(function(qs){
    if(qs.length!==run.qids.length){toast("Some questions in this paused test are no longer available, so it restarts with the rest.");run=Object.assign({},run,{ans:null,conf:null,mark:null,secs:null,seen:null,i:0})}
    startQuiz({key:run.key,type:run.type,setId:run.setId,title:run.title,subject:run.subject,sched:run.sched,qs:qs,timed:run.timed,limit:run.limit,run:run,mk:run.mk||null});
  });
}
function startPart(id,k){
  var s=SET[id];if(!s||!s.ready)return;
  var key=id+"~p"+k,run=DB.recs["run_"+key];if(run&&!run.del)return resumeRun("run_"+key);
  $("app").innerHTML='<div class="page"><p class="muted">Loading part '+k+'…</p></div>';
  loadSet(id).then(function(d){
    var qs=d.questions.slice((k-1)*10,k*10);
    startQuiz({key:key,type:s.type,setId:id,part:k,title:s.title+" (part "+k+" of 5)",subject:s.subject,sched:s.date,qs:qs,timed:!!DB.meta.timed});
  }).catch(function(){VIEW.screen="tabs";render();toast("Could not load this set. Check your connection and try again.")});
}
function pausedRuns(){return recs("run").sort(function(a,b){return b.ts-a.ts})}
function startCustom(o){
  // o: {type,title,subject,qids,timed}
  $("app").innerHTML='<div class="page"><p class="muted">Preparing your test…</p></div>';
  loadQids(o.qids).then(function(qs){
    if(!qs.length){VIEW.screen="tabs";render();toast("No questions available for this selection.");return}
    startQuiz({key:uid("q"),type:o.type,setId:null,title:o.title,subject:o.subject,qs:qs,timed:o.timed,limit:o.limit||Math.round(qs.length*CFG.SEC_PER_Q),mk:o.mk||null});
  }).catch(function(){VIEW.screen="tabs";render();toast("Could not load the questions. Check your connection and try again.")});
}
function poolFor(subject,units){
  var uset=null;if(units&&units.length){uset={};units.forEach(function(u){uset[u]=1})}
  var bank=(M.bank[subject]||[]).filter(function(x){return !uset||uset[x[1]]}).map(function(x){return x[0]});
  myqSet().questions.forEach(function(q){if(q.sub===subject&&(!uset||uset[q.u]))bank.push(q.qid)});
  return bank;
}
function pickQids(pool,size){
  var py=[],own=[];pool.forEach(function(q){(isPyq(q)?py:own).push(q)});
  if(!py.length||!own.length)return pickPart(pool,size);
  var np=Math.min(py.length,Math.round(size*CFG.PYQ_SHARE)),no=Math.min(own.length,size-np);
  np=Math.min(py.length,size-no);
  return shuffle(pickPart(py,np).concat(pickPart(own,no)));
}
function pickPart(pool,size){
  var h=qHistory(),mb={};mistakeBook().forEach(function(m){mb[m.qid]=m});
  var inPool={};pool.forEach(function(q){inPool[q]=1});
  var mist=mistakeBook().filter(function(m){return inPool[m.qid]}).map(function(m){return m.qid});
  var out=mist.slice(0,Math.round(size*0.2)),used={};out.forEach(function(q){used[q]=1});
  var unseen=shuffle(pool.filter(function(q){return !h[q]&&!used[q]}));
  var seen=shuffle(pool.filter(function(q){return h[q]&&!used[q]}));
  out=out.concat(unseen.slice(0,size-out.length));
  if(out.length<size)out=out.concat(seen.slice(0,size-out.length));
  return shuffle(out);
}
function sizeDialog(title,poolSize,sizes,cb){
  var opts=sizes.map(function(n){var ok=poolSize>=n;return '<button class="sizebtn" data-m="'+n+'"'+(ok?"":" disabled")+'><b>'+n+' questions</b><span>'+fmtMin(n*CFG.SEC_PER_Q)+' timed</span></button>'}).join("");
  modal('<h2>'+esc(title)+'</h2><p class="muted">'+poolSize+' questions available. The test is timed at 1.2 minutes per question, as in the exam. Questions you have not seen come first, with some of your past mistakes mixed in'+(title.indexOf("PYQ")<0?', and about 30% are real UPSC questions from 2016–2023':'')+'.</p><div class="sizes">'+opts+'</div><div class="row"><button class="btn ghost" data-m="x">Cancel</button></div>',
    function(act){if(act!=="x")cb(+act)});
}
function startSubjectTest(subject,units){
  var pool=poolFor(subject,units);
  if(!pool.length){toast("There are no questions for this choice yet.");return}
  var label=subject+(units&&units.length?(units.length===1?": "+units[0]:": "+units.length+" units"):"");
  sizeDialog(label,pool.length,units&&units.length===1?[25,50,100]:[50,100,150,200],function(n){
    startCustom({type:"subject",title:label+" test ("+n+" questions)",subject:subject,qids:pickQids(pool,Math.min(n,pool.length)),timed:true,mk:subject==="CSAT"?CFG.CSAT_MK:null,limit:subject==="CSAT"?Math.round(n*90):null});
  });
}
function startFullMock(){
  var q=[];
  Object.keys(CFG.MOCK_WEIGHTS).forEach(function(s){q=q.concat(pickQids(poolFor(s),CFG.MOCK_WEIGHTS[s]))});
  modal('<h2>Full UPSC-style mock</h2><p>100 questions across all subjects, weighted like recent Prelims papers. About 30 of them are real UPSC questions from 2016–2023. You have 2 hours. Marking: +2 for right, minus 0.66 for wrong.</p><div class="row"><button class="btn primary" data-m="go">Start the mock</button><button class="btn ghost" data-m="x">Cancel</button></div>',
    function(a){if(a==="go")startCustom({type:"fullmock",title:"Full mock, "+fd(today()),subject:"Mixed",qids:shuffle(q),timed:true})});
}
/* UPSC previous year papers */
function pyqSets(paper){return M.sets.filter(function(s){return s.type==="pyq"&&s.paper===paper}).sort(function(a,b){return b.year-a.year})}
function pyqPool(subject){return poolFor(subject).filter(isPyq)}
function bestOf(setId){var b=null;attempts().forEach(function(a){if(a.setId===setId&&(b==null||a.pts>b.pts))b=a});return b}
function startPyqPaper(id){
  var s=SET[id];if(!s)return;var run=DB.recs["run_"+id];if(run&&!run.del)return startSet(id,true);
  var csat=s.paper==="CSAT",best=bestOf(id);
  modal('<h2>'+esc(s.title)+'</h2><p>'+s.n+' questions, 2 hours, '+(csat?'+2.5 for right, minus 0.83 for wrong. CSAT is qualifying: you need 33% (66.67 of 200).':'+2 for right, minus 0.66 for wrong.')+' Explanations are shown at the end, as in your other tests.</p>'+
    (s.held?'<p class="note">You chose to keep this paper aside for a full exam-day simulation closer to Prelims. Its questions never appear in your other tests.</p>':'')+
    (best?'<p class="muted small">Your best so far: '+best.pts+' of '+best.max+' on '+fdy(best.date)+'.</p>':'')+
    '<div class="row"><button class="btn primary" data-m="go">Start the paper</button><button class="btn ghost" data-m="x">Cancel</button></div>',
    function(a){if(a==="go")startSet(id,true)});
}
function startPyqSubject(subject){
  var pool=pyqPool(subject);if(!pool.length){toast("No previous year questions for this subject yet.");return}
  sizeDialog("PYQ: "+subject,pool.length,[25,50,100],function(n){
    startCustom({type:"pyqsub",title:"PYQ "+subject+" ("+n+" questions)",subject:subject,qids:pickPart(pool,Math.min(n,pool.length)),timed:true});
  });
}
function startPyqMock(){
  var q=[],used={};
  Object.keys(CFG.MOCK_WEIGHTS).forEach(function(s){pickPart(pyqPool(s),CFG.MOCK_WEIGHTS[s]).forEach(function(x){q.push(x);used[x]=1})});
  if(q.length<100){var rest=[];Object.keys(CFG.MOCK_WEIGHTS).forEach(function(s){pyqPool(s).forEach(function(x){if(!used[x])rest.push(x)})});q=q.concat(pickPart(rest,100-q.length))}
  modal('<h2>PYQ mock</h2><p>100 real UPSC questions from 2016–2023, mixed across subjects. 2 hours, +2 for right, minus 0.66 for wrong. The 2024–2026 papers are kept aside.</p><div class="row"><button class="btn primary" data-m="go">Start the mock</button><button class="btn ghost" data-m="x">Cancel</button></div>',
    function(a){if(a==="go")startCustom({type:"pyqmock",title:"PYQ mock, "+fd(today()),subject:"Mixed",qids:shuffle(q),timed:true})});
}
function startCsatMock(){
  var pool=poolFor("CSAT");if(pool.length<80){toast("Not enough CSAT questions yet.");return}
  modal('<h2>CSAT mock</h2><p>80 questions, 2 hours, as in Paper II: comprehension, reasoning, numeracy and data. About 30% are real UPSC CSAT questions from 2016–2023. +2.5 for right, minus 0.83 for wrong; 33% qualifies.</p><div class="row"><button class="btn primary" data-m="go">Start the mock</button><button class="btn ghost" data-m="x">Cancel</button></div>',
    function(a){if(a==="go")startCustom({type:"csatmock",title:"CSAT mock, "+fd(today()),subject:"CSAT",qids:pickQids(pool,80),timed:true,limit:7200,mk:CFG.CSAT_MK})});
}
function startRevision(all){
  var mb=mistakeBook(),list=(all?mb:mb.filter(function(m){return m.isDue})).slice(0,25);
  if(!list.length){toast("Nothing to revise right now.");return}
  startCustom({type:"revision",title:"Mistake revision, "+fd(today()),subject:"Mixed",qids:list.map(function(m){return m.qid}),timed:false});
}

/* Today tab: check-in, paused tests, the selected day's sets, calendar */
function viewToday(){
  var td=today(),v=$("view");
  var dates=Object.keys(BYDATE).sort();
  var sel=VIEW.sel||(BYDATE[td]?td:(dates.filter(function(d){return d>td})[0]||td));
  if(VIEW.month==null){var d=pd(sel);VIEW.month=[d.getFullYear(),d.getMonth()]}
  var html='<div class="pagehead"><div><h1>'+fdw(td)+'</h1><p class="muted">'+daysLeftLine(td)+'</p></div></div>';
  html+=checkinCard(td);
  html+=logCard(td,"Today's study log");
  html+='<section class="panel budget"><div><h2>Got a few minutes?</h2><p class="muted small">Tap the time you have. The app picks the most useful thing to do with it.</p></div><div class="row wrap">'+[10,20,40].map(function(m){return '<button class="btn" data-budget="'+m+'">'+m+' minutes</button>'}).join("")+'</div></section>';
  var runs=pausedRuns();
  if(runs.length)html+='<section class="panel"><h2>Paused tests</h2><ul class="list">'+runs.map(function(r){return '<li><div><b>'+esc(r.title)+'</b><span class="muted">'+r.done+' of '+r.n+' answered'+(r.timed?', '+fmtMin(Math.max(0,r.limit-r.el))+' left':'')+'</span></div><div class="row"><button class="btn primary small" data-resume="'+esc(r.id)+'">Resume</button><button class="btn ghost small" data-discard="'+esc(r.id)+'">Discard</button></div></li>'}).join("")+'</ul></section>';
  html+='<div class="cols wide-left">'+dayPanel(sel,td)+calendarPanel(sel,td)+'</div>';
  var t=TESTS.filter(function(x){return x.date>=td})[0];
  html+='<section class="panel"><details><summary><h2>Shankar test days</h2><span class="muted">'+(t?'Next: '+esc(t.name)+', '+fdw(t.date)+', 2 to 4 pm':'All tests are over')+'</span></summary>'+
    '<ul class="plain"><li>General Studies tests run 2 to 4 pm, with a live discussion at 4:30 pm.</li><li>CSAT tests run 2 to 4 pm; the recorded discussion is uploaded at 4:30 pm.</li><li>Tests are offline and online. Your admission ID is the user name and password for the test portal.</li><li>Refer to the India Year Book for every test; mock tests cover IYB 2025.</li><li>Test 24 (Budget and Economic Survey) and Mock Tests I and II are online.</li><li>The CSAT sectional syllabus is shared on the Telegram channel.</li></ul></details></section>';
  var bonus=M.sets.filter(function(s){return s.type==="bonus"&&s.ready});
  if(bonus.length)html+='<section class="panel"><h2>Extra practice</h2><ul class="list">'+bonus.map(function(s){return '<li><div><b>'+esc(s.title)+'</b><span class="muted">'+s.n+' questions</span></div><button class="btn small" data-start="'+s.id+'">Start</button></li>'}).join("")+'</ul></section>';
  v.innerHTML=html;
  bindToday();
}
function daysLeftLine(td){var n=dayNum(CFG.PRELIMS)-dayNum(td);return n>0?n+" days to Prelims (24 May 2027)":"Prelims day has passed"}
function checkinCard(td){
  var c=DB.recs["chk_"+td];var s=streak();
  if(c&&!c.del)return '<section class="panel checkin done"><div><h2>Daily check-in</h2><p>You answered <b>'+(c.v==="yes"?"Yes":"No")+'</b> today. '+(s?'Study streak: <b>'+s+' day'+(s>1?"s":"")+'</b>.':'A new streak starts with your next Yes.')+'</p></div></section>';
  return '<section class="panel checkin"><div><h2>Did you complete today\'s study and test?</h2><p class="muted">Answer once a day. It builds your streak'+(s?' (now '+s+' day'+(s>1?"s":"")+')':'')+' and cannot be changed later.</p></div><div class="row"><button class="btn primary" data-chk="yes">Yes</button><button class="btn" data-chk="no">Not today</button></div></section>';
}
function setRowHtml(s,done){
  var run=DB.recs["run_"+s.id];run=run&&!run.del?run:null;var n=done[s.id]||0;
  var best=null;attempts().forEach(function(a){if(a.setId===s.id&&!a.part&&(best==null||a.pts>best))best=a.pts});
  var label=s.type==="ca"?"Current affairs, 25 questions":(s.type==="mock"?"Mock drill, 50 questions":"Daily set, 50 questions");
  var act;
  if(s.pending)act='<span class="muted small">'+esc(s.pending)+'</span>';
  else if(!s.ready)act='<span class="muted small">Being prepared</span>';
  else if(run)act='<button class="btn primary small" data-resume="run_'+s.id+'">Resume ('+run.done+'/'+run.n+')</button>';
  else act='<button class="btn '+(n?"":"primary ")+'small" data-start="'+s.id+'">'+(n?"Take again":"Start")+'</button>';
  var parts="";
  if(s.ready&&!s.pending&&s.n===50){
    var pd_=partsDone(s.id),nd=Object.keys(pd_).length;
    parts='<div class="parts"><span class="muted small">Or in 5 parts of 10'+(nd&&nd<5?', '+nd+' done':'')+':</span>'+[1,2,3,4,5].map(function(k){var r=DB.recs["run_"+s.id+"~p"+k],pa=r&&!r.del;return '<button class="pchip'+(pd_[k]?" done":(pa?" paused":""))+'" data-part="'+s.id+'|'+k+'" aria-label="Part '+k+(pd_[k]?', done':(pa?', paused':''))+'">'+(pd_[k]?"✓ ":"")+k+'</button>'}).join("")+'</div>';
  }
  return '<li class="setrow"><div class="setmain"><div><span class="muted small">'+label+'</span><b>'+esc(s.title)+'</b>'+(n?'<span class="good small">Done'+(best!=null?', best '+best+' of '+(s.n*2):'')+'</span>':'')+'</div>'+act+'</div>'+parts+'</li>';
}
function dayPanel(ds,td){
  var sch=schedFor(ds),t=TESTBYDATE[ds],done=setDoneMap();
  var h='<section class="panel"><h2>'+(ds===td?"Today's work":fdw(ds))+'</h2>';
  if(sch.length){var s0=sch[0];h+='<p class="muted">'+esc(s0.testName)+', '+esc(s0.dayLabel)+'. Shankar test on '+fdw(s0.testDate)+'.</p>';}
  if(t)h+='<p class="testday">'+esc(t.name)+' is on this day, 2 to 4 pm'+(t.csat?(t.type==="mock"?', with a live discussion at 4:30 pm.':'. The recorded discussion is uploaded at 4:30 pm.'):', with a live discussion at 4:30 pm.')+' Enter your marks afterwards in the Scores tab.</p>';
  var ds_=dayState(ds,done,td),show25=ds_.need25;
  if(!sch.length&&show25){var nt=TESTS.filter(function(x){return x.subject==="Current Affairs"&&x.date>=ds})[0];if(nt)h+='<p class="muted">Next Shankar current affairs test: '+esc(nt.name)+', '+fdw(nt.date)+'.</p>'}
  if(sch.length||show25){
    h+='<div class="row wrap tight"><span class="muted small">Timing</span><div class="seg small"><button data-timed="0" aria-pressed="'+!DB.meta.timed+'">Untimed</button><button data-timed="1" aria-pressed="'+!!DB.meta.timed+'">Timed, 1.2 min per question</button></div></div>';
    h+='<ul class="list">'+sch.map(function(s){return setRowHtml(s,done)}).join("")+(show25?camRow(ds,td):"")+'</ul>';
    if(ds!==td)h+='<p class="muted small">You can take any day\'s set early or late. It is logged on the day you take it.</p>';
  }else if(!t)h+='<p class="muted">No set is scheduled for this day. Pick another date, or use Practice for a subject test.</p>';
  var taken=attempts().filter(function(a){return a.date===ds});
  if(ds<td){var lr=logRec(ds);h+='<h3>Study log</h3>'+(lr?'<p class="small">'+logLine(lr)+'</p><button class="btn ghost small" data-log="'+ds+'">Edit log</button>':'<button class="btn small" data-log="'+ds+'">Add a log for this day</button>')}
  if(taken.length)h+='<h3>Taken on this day</h3><ul class="list">'+taken.map(function(a){return '<li><div><b>'+esc(a.title)+'</b><span class="muted small">'+esc(TYPE_LABEL[a.type]||"")+'</span></div><button class="btn ghost small" data-att="'+a.id+'">'+a.pts+' / '+a.max+'</button></li>'}).join("")+'</ul>';
  return h+'</section>';
}
function calendarPanel(sel,td){
  var y=VIEW.month[0],m=VIEW.month[1],first=new Date(y,m,1),n=new Date(y,m+1,0).getDate(),off=(first.getDay()+6)%7,done=setDoneMap();
  var g='<div class="cal" role="grid">'+["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(function(d){return '<div class="dow">'+d+'</div>'}).join("");
  for(var i=0;i<off;i++)g+='<div></div>';
  for(var d=1;d<=n;d++){
    var ds=y+"-"+pad(m+1)+"-"+pad(d),s=dayState(ds,done,td);
    var cls="day "+s.st+(ds===td?" today":"")+(ds===sel?" sel":"")+(s.test?" tday":"");
    var lab=fdw(ds)+({done:", all of the day's sets done",part:", one of the day's sets done",missed:", the day's sets missed",paused:", paused",todo:", sets scheduled"}[s.st]||"")+(s.star?", extra test taken":"")+(s.test?", "+s.test.name:"")+(s.chk?", check-in "+s.chk:"");
    g+='<button class="'+cls+'" data-d="'+ds+'" aria-label="'+esc(lab)+'"><span class="n">'+d+'</span>'+(s.star?'<span class="star" aria-hidden="true">★</span>':'')+(s.chk?'<span class="cdot '+s.chk+'" aria-hidden="true"></span>':'')+(s.test?'<span class="tmark'+(s.test.csat?" csat":"")+'" aria-hidden="true">'+(s.test.csat?"C":"T")+'</span>':'')+'</button>';
  }
  g+='</div>';
  var minM=[2026,9],maxM=[2027,4],cur=y*12+m;
  return '<section class="panel"><div class="row between"><h2>'+MONTHS[m]+' '+y+'</h2><div class="row tight"><button class="btn ghost small" id="cal-prev" aria-label="Previous month"'+(cur<=minM[0]*12+minM[1]?" disabled":"")+'>‹</button><button class="btn ghost small" id="cal-today">Today</button><button class="btn ghost small" id="cal-next" aria-label="Next month"'+(cur>=maxM[0]*12+maxM[1]?" disabled":"")+'>›</button></div></div>'+g+
    '<div class="legend"><span><i class="lg done"></i>50 and 25 done</span><span><i class="lg part"></i>One of them done</span><span><i class="lg missed"></i>Missed</span><span><i class="lg paused"></i>Paused</span><span><i class="lg todo"></i>Upcoming</span><span><b class="star">★</b> Extra test</span><span><i class="cdot yes"></i>Checked in</span><span><b class="tmark">T</b> Shankar GS test</span><span><b class="tmark csat">C</b> Shankar CSAT test</span></div></section>';
}
function bindToday(){
  qsa("[data-chk]").forEach(function(b){b.onclick=function(){put("chk_"+today(),{kind:"chk",date:today(),v:b.dataset.chk});render();if(b.dataset.chk==="yes")toast("Logged. Keep the streak going.")}});
  qsa("[data-start]").forEach(function(b){b.onclick=function(){startSet(b.dataset.start,!!DB.meta.timed)}});
  qsa("[data-part]").forEach(function(b){b.onclick=function(){var p=b.dataset.part.split("|");startPart(p[0],+p[1])}});
  bindLog();
  qsa("[data-notes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.notes,1,"tabs")}});
  if($("cam-rev"))$("cam-rev").onclick=startCamRevision;
  qsa("[data-budget]").forEach(function(b){b.onclick=function(){budgetPlan(+b.dataset.budget)}});
  qsa("[data-resume]").forEach(function(b){b.onclick=function(){resumeRun(b.dataset.resume)}});
  qsa("[data-discard]").forEach(function(b){b.onclick=function(){modal('<h2>Discard this paused test?</h2><p>Your answers so far will be lost.</p><div class="row"><button class="btn danger" data-m="y">Discard</button><button class="btn ghost" data-m="x">Keep it</button></div>',function(a){if(a==="y"){del(b.dataset.discard);render()}})}});
  qsa("[data-att]").forEach(function(b){b.onclick=function(){openAttempt(b.dataset.att)}});
  qsa("[data-timed]").forEach(function(b){b.onclick=function(){DB.meta.timed=b.dataset.timed==="1";saveStore();render()}});
  qsa(".cal [data-d]").forEach(function(b){b.onclick=function(){VIEW.sel=b.dataset.d;render()}});
  var mv=function(k){var y=VIEW.month[0],m=VIEW.month[1]+k;if(m<0){m=11;y--}if(m>11){m=0;y++}VIEW.month=[y,m];render()};
  $("cal-prev").onclick=function(){mv(-1)};$("cal-next").onclick=function(){mv(1)};
  $("cal-today").onclick=function(){VIEW.sel=null;VIEW.month=null;render()};
}

/* "I have N minutes": pick the most useful short session */
function todaysOpenSet(){
  var td=today(),done=setDoneMap();
  var cands=scheduledFor(td).filter(function(s){return s.ready&&!s.pending&&s.n===50&&!done[s.id]});
  if(!cands.length){ // nearest earlier day with an unfinished set
    var ds=Object.keys(BYDATE).filter(function(d){return d<td}).sort().reverse();
    for(var i=0;i<ds.length&&i<14;i++){var c=BYDATE[ds[i]].filter(function(s){return s.ready&&!s.pending&&s.n===50&&!done[s.id]});if(c.length){cands=c;break}}
  }
  return cands[0]||null;
}
function weakestUnit(){
  var st=unitStats(),best=null;
  Object.keys(st).forEach(function(s){if(s==="CSAT")return;Object.keys(st[s].units).forEach(function(u){var o=st[s].units[u],n=o.r+o.w;if(n<5)return;var a=o.r/n;if(!best||a<best.a)best={s:s,u:u,a:a,n:n}})});
  return best;
}
function budgetPlan(min){
  var n={10:8,20:16,40:33}[min],nParts={10:1,20:2,40:3}[min];
  var due=mistakeBook().filter(function(m){return m.isDue});
  var set=todaysOpenSet(),plan=null;
  if(due.length>=n||(due.length>=5&&!set)){
    plan={what:"Revise "+Math.min(due.length,n)+" questions from your mistake book that are due today.",why:"Revising mistakes on time is the fastest way to stop losing the same marks again.",go:function(){startCustom({type:"revision",title:"Mistake revision, "+fd(today()),subject:"Mixed",qids:due.slice(0,n).map(function(m){return m.qid}),timed:false})}};
  }else if(set){
    var pd_=partsDone(set.id),left=[1,2,3,4,5].filter(function(k){return !pd_[k]}),take=left.slice(0,nParts);
    plan={what:(take.length>1?"Parts "+take.join(", "):"Part "+take[0])+" of "+set.title+(take.length>1?" (10 questions each).":" (10 questions)."),why:(set.date===today()?"This keeps today's set on track.":"This catches up the set scheduled for "+fdw(set.date)+".")+(take.length>1?" When a part ends, the result screen takes you straight to the next one.":"")+(due.length?" You also have "+due.length+" mistake"+(due.length>1?"s":"")+" due; the next short gap is a good time for them.":""),go:function(){startPart(set.id,take[0])}};
  }else{
    var w=weakestUnit();
    if(w){var pool=poolFor(w.s,[w.u]);plan={what:Math.min(n,pool.length)+" questions on "+w.u+" ("+w.s+").",why:"It is your weakest unit so far, at "+Math.round(w.a*100)+"% accuracy.",go:function(){startCustom({type:"subject",title:w.s+": "+w.u+" ("+Math.min(n,pool.length)+" questions)",subject:w.s,qids:pickQids(pool,Math.min(n,pool.length)),timed:true})}}}
    else plan={what:n+" questions from today's subject.",why:"Once you have more results, this will target your weakest unit.",go:function(){var s=(scheduledFor(today())[0]||{}).subject;if(!s||!M.bank[s])s="Polity";startCustom({type:"subject",title:s+" quick test ("+n+" questions)",subject:s,qids:pickQids(poolFor(s),n),timed:true})}};
  }
  modal('<h2>'+min+' minutes</h2><p><b>'+esc(plan.what)+'</b></p><p class="muted">'+esc(plan.why)+'</p><div class="row"><button class="btn primary" data-m="go">Start</button><button class="btn ghost" data-m="x">Not now</button></div>',function(a){if(a==="go")plan.go()});
}

/* Practice tab: subject tests, full mock, mistake book, my questions, reports */
function viewPractice(){
  var v=$("view"),subj=VIEW.practiceSubj||"Polity";
  var units=UNITLIST[subj]||[],chosen=VIEW.practiceUnits[subj]||{};
  var counts={};M.subjects.forEach(function(s){counts[s]=poolFor(s).length});
  var uc={};poolFor(subj).forEach(function(q){var u=q.indexOf("myq#")===0?null:null});
  (M.bank[subj]||[]).forEach(function(x){uc[x[1]]=(uc[x[1]]||0)+1});
  myqSet().questions.forEach(function(q){if(q.sub===subj)uc[q.u]=(uc[q.u]||0)+1});
  var nSel=Object.keys(chosen).filter(function(k){return chosen[k]}).length;
  var html='<div class="pagehead"><div><h1>Practice</h1><p class="muted">Test yourself on any subject, any time. Every test is logged with the date you take it.</p></div></div>';
  html+=camPanel();
  html+='<section class="panel"><h2>Subject test</h2><div class="subjgrid">'+M.subjects.map(function(s){return '<button class="subj'+(s===subj?" on":"")+'" data-subj="'+esc(s)+'"'+(counts[s]?"":" disabled")+'><b>'+esc(s)+'</b><span>'+(counts[s]?counts[s]+' questions':'Questions coming later')+'</span></button>'}).join("")+'</div>'+
    '<details class="units"'+(nSel?" open":"")+'><summary>Limit to certain units (optional)'+(nSel?' <span class="tag">'+nSel+' chosen</span>':'')+'</summary><div class="chips">'+units.filter(function(u){return uc[u]}).map(function(u){return '<button class="chipbtn" data-unit="'+esc(u)+'" aria-pressed="'+!!chosen[u]+'">'+esc(u)+' <span>'+uc[u]+'</span></button>'}).join("")+'</div>'+(nSel?'<button class="link" id="u-clear">Clear units</button>':'')+'</details>'+
    '<div class="row"><button class="btn primary" id="st-go"'+(counts[subj]?"":" disabled")+'>Start a '+esc(subj)+' test</button><span class="muted small">You choose 50, 100, 150 or 200 questions next. Always timed.</span></div></section>';
  html+=pyqPanel();
  html+=listenPanel();
  var mb=mistakeBook(),due=mb.filter(function(m){return m.isDue}).length;
  var bySub={},meta=qMeta();mb.forEach(function(m){var s=(meta[m.qid]||["Other"])[0];bySub[s]=(bySub[s]||0)+1});
  html+='<div class="cols">';
  html+='<section class="panel"><h2>Full UPSC-style mock</h2><p class="muted">100 questions from every subject, weighted like recent papers. 2 hours, with negative marking.</p><button class="btn primary" id="fm-go">Start a full mock</button></section>';
  html+='<section class="panel"><h2>Mistake book</h2>'+(mb.length?'<p><b>'+due+'</b> question'+(due===1?"":"s")+' due for revision today, '+mb.length+' in the book.</p><p class="muted small">Every question you get wrong or skip comes back after 1, 3, 7 and 21 days until you answer it right twice in a row.</p><p class="muted small">'+Object.keys(bySub).map(function(s){return esc(s)+': '+bySub[s]}).join(", ")+'</p><div class="row wrap"><button class="btn primary" id="mb-go"'+(due?"":" disabled")+'>Revise '+Math.min(due,25)+' due question'+(due===1?"":"s")+'</button>'+(mb.length>due?'<button class="btn" id="mb-all">Revise early</button>':'')+'</div>':'<p class="muted">Questions you get wrong or skip will appear here for spaced revision.</p>')+'</section>';
  html+='</div>';
  var my=recs("myq").sort(function(a,b){return (b.created||b.ts)-(a.created||a.ts)});
  html+='<section class="panel" id="myq-panel"><div class="row between wrap"><h2>My questions</h2><div class="row wrap"><button class="btn" id="myq-add">Add a question</button><button class="btn primary" id="myq-mock"'+(my.length>=10?"":" disabled")+'>Mock from my questions</button></div></div>'+
    '<p class="muted small">Add questions from your test booklets or notes. They join the subject tests and full mocks, and sync to all your devices through your Google Sheet. You can also type them straight into the "My questions" tab of the Sheet.'+(my.length<10?' Add at least 10 to build a mock from them.':'')+'</p>'+
    (my.length?'<details><summary>'+my.length+' question'+(my.length>1?"s":"")+'</summary><ul class="list">'+my.map(function(q){return '<li><div><b>'+esc(q.q.slice(0,120))+(q.q.length>120?"…":"")+'</b><span class="muted small">'+esc(q.sub)+', '+esc(q.u||"")+'</span></div><div class="row tight"><button class="btn ghost small" data-myedit="'+q.id+'">Edit</button><button class="btn ghost small" data-mydel="'+q.id+'">Delete</button></div></li>'}).join("")+'</ul></details>':'')+'</section>';
  var reps=recs("rep").sort(function(a,b){return b.ts-a.ts});
  if(reps.length)html+='<section class="panel"><h2>Reported questions</h2><p class="muted small">These will be checked and corrected in a later update.</p><ul class="list">'+reps.map(function(r){return '<li><div><b>'+esc(r.why)+'</b><span class="muted small">'+esc(r.q)+(r.note?' Note: '+esc(r.note):'')+'</span></div><button class="btn ghost small" data-repdel="'+r.id+'">Remove</button></li>'}).join("")+'</ul></section>';
  v.innerHTML=html;
  qsa("[data-subj]").forEach(function(b){b.onclick=function(){VIEW.practiceSubj=b.dataset.subj;render()}});
  qsa("[data-unit]").forEach(function(b){b.onclick=function(){var c=VIEW.practiceUnits[subj]=VIEW.practiceUnits[subj]||{};c[b.dataset.unit]=!c[b.dataset.unit];render()}});
  if($("u-clear"))$("u-clear").onclick=function(){VIEW.practiceUnits[subj]={};render()};
  $("st-go").onclick=function(){startSubjectTest(subj,Object.keys(chosen).filter(function(k){return chosen[k]}))};
  $("fm-go").onclick=startFullMock;
  bindPyq();
  bindListen();
  bindCam();
  qsa("#cam-panel [data-start]").forEach(function(b){b.onclick=function(){startSet(b.dataset.start,!!DB.meta.timed)}});
  qsa("#cam-panel [data-resume]").forEach(function(b){b.onclick=function(){resumeRun(b.dataset.resume)}});
  if($("mb-go"))$("mb-go").onclick=function(){startRevision(false)};
  if($("mb-all"))$("mb-all").onclick=function(){startRevision(true)};
  $("myq-add").onclick=function(){myqDialog(null)};
  $("myq-mock").onclick=function(){var q=shuffle(myqSet().questions.map(function(x){return x.qid})).slice(0,100);startCustom({type:"myq",title:"Mock from my questions, "+fd(today()),subject:"Mixed",qids:q,timed:true})};
  qsa("[data-myedit]").forEach(function(b){b.onclick=function(){myqDialog(b.dataset.myedit)}});
  qsa("[data-mydel]").forEach(function(b){b.onclick=function(){modal('<h2>Delete this question?</h2><div class="row"><button class="btn danger" data-m="y">Delete</button><button class="btn ghost" data-m="x">Cancel</button></div>',function(a){if(a==="y"){del(b.dataset.mydel);render()}})}});
  qsa("[data-repdel]").forEach(function(b){b.onclick=function(){del(b.dataset.repdel);render()}});
}
function pyqPanel(){
  var paper=VIEW.pyqPaper||"GS",sets=pyqSets(paper);if(!M.sets.some(function(s){return s.type==="pyq"}))return "";
  var runs={};pausedRuns().forEach(function(r){runs[r.key]=1});
  var cards=sets.map(function(s){var b=bestOf(s.id),st=runs[s.id]?'Paused':(b?'Best '+b.pts+' / '+b.max:'Not taken');
    return '<button class="subj yr'+(s.held?" held":"")+'" data-pyq="'+s.id+'"><b>'+s.year+'</b><span>'+esc(st)+'</span>'+(s.held?'<span class="hold">Kept for simulation</span>':'')+'</button>'}).join("");
  var subs=M.subjects.filter(function(s){return s!=="CSAT"&&pyqPool(s).length});
  var h='<section class="panel" id="pyq-panel"><div class="row between wrap"><h2>UPSC previous year papers</h2><div class="seg small" role="group" aria-label="Paper">'+
    [["GS","GS Paper I"],["CSAT","CSAT (Paper II)"]].map(function(p){return '<button data-pp="'+p[0]+'" aria-pressed="'+(paper===p[0])+'">'+p[1]+'</button>'}).join("")+'</div></div>'+
    '<p class="muted small">Real Prelims papers from 2016 to 2026 with the official answers. Take a whole year as it was set, or practise by subject. '+(paper==="GS"?'30% of every subject test and full mock now comes from the 2016–2023 papers.':'CSAT is qualifying: 33% (66.67 of 200) is the target.')+' The 2024, 2025 and 2026 papers are kept out of all other tests so you can sit them fresh as full simulations.</p>'+
    '<div class="subjgrid yrs">'+cards+'</div>';
  if(paper==="GS")h+='<div class="row wrap pyq-more"><label class="inline">PYQ by subject <select id="pyq-subj">'+subs.map(function(s){return '<option>'+esc(s)+'</option>'}).join("")+'</select></label><button class="btn" id="pyq-subj-go">Start</button><button class="btn primary" id="pyq-mock">PYQ mock (100 mixed)</button></div>';
  else{
    var cs=M.sets.filter(function(s){return s.type==="csatset"}),done=setDoneMap();
    h+='<h3>CSAT practice sets</h3><p class="muted small">New questions in the UPSC pattern, 25 per set. Untimed, so you can work things out.</p><ul class="list">'+cs.map(function(s){return '<li><div><b>'+esc(s.title)+'</b><span class="muted small">'+s.n+' questions'+(done[s.id]?', taken '+done[s.id]+' time'+(done[s.id]>1?"s":""):'')+'</span></div><button class="btn small'+(done[s.id]?"":" primary")+'" data-cset="'+s.id+'">'+(runs[s.id]?"Resume":(done[s.id]?"Retake":"Start"))+'</button></li>'}).join("")+'</ul>'+
      '<div class="row wrap pyq-more"><button class="btn primary" id="csat-mock">CSAT mock (80 questions, 2 hours)</button><span class="muted small">Mixes these sets with 2016–2023 CSAT questions.</span></div>';
  }
  return h+'</section>';
}
function bindPyq(){
  qsa("[data-pp]").forEach(function(b){b.onclick=function(){VIEW.pyqPaper=b.dataset.pp;render()}});
  qsa("[data-pyq]").forEach(function(b){b.onclick=function(){startPyqPaper(b.dataset.pyq)}});
  qsa("[data-cset]").forEach(function(b){b.onclick=function(){startSet(b.dataset.cset,false)}});
  if($("pyq-subj-go"))$("pyq-subj-go").onclick=function(){startPyqSubject($("pyq-subj").value)};
  if($("pyq-mock"))$("pyq-mock").onclick=startPyqMock;
  if($("csat-mock"))$("csat-mock").onclick=startCsatMock;
}
function myqDialog(id){
  var q=id?DB.recs[id]:{sub:VIEW.practiceSubj||"Polity",u:"",q:"",o:["","","",""],a:null,e:"",src:""};
  var subjOpts=M.subjects.map(function(s){return '<option'+(s===q.sub?" selected":"")+'>'+esc(s)+'</option>'}).join("");
  modal('<h2>'+(id?"Edit question":"Add a question")+'</h2>'+
    '<div class="formgrid"><label class="fld">Subject<select id="mq-sub">'+subjOpts+'</select></label><label class="fld">Unit<input id="mq-u" list="mq-units" value="'+esc(q.u)+'" placeholder="For example: Fundamental Rights"><datalist id="mq-units"></datalist></label></div>'+
    '<label class="fld">Question<textarea id="mq-q" rows="4" placeholder="Type the question. Put each statement on its own line.">'+esc(q.q)+'</textarea></label>'+
    [0,1,2,3].map(function(k){return '<label class="fld opt-in"><span><input type="radio" name="mq-a" value="'+k+'"'+(q.a===k?" checked":"")+' aria-label="Option '+"ABCD"[k]+' is correct"> Option '+"ABCD"[k]+'</span><input id="mq-o'+k+'" value="'+esc(q.o[k])+'"></label>'}).join("")+
    '<p class="muted small">Select the circle next to the correct option.</p>'+
    '<label class="fld">Explanation (optional)<textarea id="mq-e" rows="3">'+esc(q.e)+'</textarea></label><label class="fld">Source (optional)<input id="mq-s" value="'+esc(q.src||"")+'" placeholder="For example: Shankar Test 2, Q14"></label>'+
    '<p class="err" id="mq-err" hidden></p><div class="row"><button class="btn primary" id="mq-save">Save question</button><button class="btn ghost" data-m="x">Cancel</button></div>');
  var fillUnits=function(){$("mq-units").innerHTML=(UNITLIST[$("mq-sub").value]||[]).map(function(u){return '<option value="'+esc(u)+'">'}).join("")};
  fillUnits();$("mq-sub").onchange=fillUnits;
  $("mq-save").onclick=function(){
    var o=[0,1,2,3].map(function(k){return $("mq-o"+k).value.trim()});
    var a=qsa('input[name="mq-a"]').filter(function(x){return x.checked})[0];
    var text=$("mq-q").value.trim(),err=$("mq-err");
    if(!text||o.some(function(x){return !x})){err.textContent="Fill in the question and all four options.";err.hidden=false;return}
    if(!a){err.textContent="Choose the correct option.";err.hidden=false;return}
    var rid=id||uid("myq");
    put(rid,{kind:"myq",sub:$("mq-sub").value,u:$("mq-u").value.trim()||"My questions",q:text,o:o,a:+a.value,e:$("mq-e").value.trim(),src:$("mq-s").value.trim(),created:(q.created||Date.now())});
    closeModal();render();toast(id?"Question updated.":"Question added.");
  };
}

/* Dashboard */
var DASH_TYPES=[["daily","Daily"],["weekly","Weekly"],["mock","Mock"],["subject","Subject tests"],["ca","Current affairs"],["pyq","UPSC PYQ"],["all","All"]];
function dashRows(type){
  var rows=[];
  attempts().forEach(function(a){var g=typeGroup(a.type);if(type==="all"||g===type)rows.push({kind:"att",id:a.id,date:a.date,title:a.title,type:TYPE_LABEL[a.type]||a.type,subject:a.subject,marks:a.pts,max:a.max,p:pct(a.pts,a.max),r:a.r,w:a.w,sk:a.sk,sec:a.sec,ts:a.ts,src:"app"})});
  if(type==="weekly"||type==="mock"||type==="all"){
    testMarks().forEach(function(t){if(t.marks==null||t.marks==="")return;if(type!=="all"&&t.type!==type)return;
      rows.push({kind:"test",id:t.id,date:t.date,title:t.name,type:(t.type==="mock"?"Mock":"Weekly")+" (Shankar)",subject:t.subject,marks:+t.marks,max:+t.max||200,p:pct(+t.marks,+t.max||200),r:t.r,w:t.w,sk:null,sec:null,ts:t.ts,rank:t.rank,src:"shankar"})});
  }
  return rows.sort(function(a,b){return a.date===b.date?a.ts-b.ts:(a.date<b.date?-1:1)});
}
function viewDash(){
  var v=$("view"),type=VIEW.dashType,rows=dashRows(type);
  var html='<div class="pagehead"><div><h1>Dashboard</h1><p class="muted">Goal: 90% in Prelims on 24 May 2027.</p></div></div>';
  html+='<section class="panel"><div class="row between wrap"><h2>Performance</h2><div class="seg toggle" role="group" aria-label="Test type">'+DASH_TYPES.map(function(t){return '<button data-dt="'+t[0]+'" aria-pressed="'+(type===t[0])+'">'+t[1]+'</button>'}).join("")+'</div></div>';
  if(!rows.length){
    html+='<p class="empty">'+({daily:"Take a daily set from the Today tab to start your record.",weekly:"Enter your Shankar weekly test marks in the Scores tab to see them here.",mock:"Take a full mock in Practice, or enter Shankar mock marks in Scores.",subject:"Take a subject test in Practice to see it here.",ca:"Take a current affairs set from the Today tab to see it here.",pyq:"Take a UPSC previous year paper in Practice to see it here.",all:"Your results will appear here after your first test."})[type]+'</p></section>';
  }else{
    var ps=rows.map(function(r){return r.p}),avg=ps.reduce(function(a,b){return a+b},0)/ps.length;
    var last=rows[rows.length-1];
    html+='<dl class="kpis"><div><dt>Tests</dt><dd>'+rows.length+'</dd></div><div><dt>Average</dt><dd>'+r1(avg)+'%</dd></div><div><dt>Best</dt><dd>'+r1(Math.max.apply(null,ps))+'%</dd></div><div><dt>Latest</dt><dd>'+r1(last.p)+'%</dd><dd class="sub">'+esc(last.marks+" / "+last.max)+'</dd></div></dl>';
    html+='<div class="chartwrap" id="perfchart"></div>';
    var atts=rows.filter(function(r){return r.kind==="att"}).map(function(r){return DB.recs[r.id]});
    var items=[];atts.forEach(function(a){items=items.concat(a.items||[])});
    if(items.length){
      var tps={};items.forEach(function(x){if(!x[6])return;var o=tps[x[1]]||(tps[x[1]]={s:0,n:0});o.s+=x[6];o.n++});
      var tpRows=Object.keys(tps).map(function(s){return '<tr><td>'+esc(s)+'</td><td>'+Math.round(tps[s].s/tps[s].n)+' s</td><td>'+tps[s].n+'</td></tr>'}).join("");
      html+='<div class="cols"><div><h3>Confidence</h3>'+confTable(items)+'</div><div><h3>Time per question</h3>'+(tpRows?'<table class="tbl"><thead><tr><th>Subject</th><th>Average</th><th>Questions timed</th></tr></thead><tbody>'+tpRows+'</tbody></table><p class="muted small">The exam allows 72 seconds per question.</p>':'<p class="muted">Time per question is recorded for tests taken from now on.</p>')+'</div></div>';
    }
    var months={};rows.forEach(function(r){months[r.date.slice(0,7)]=1});
    var mk=Object.keys(months).sort().reverse();if(VIEW.dashMonth!=="all"&&!months[VIEW.dashMonth])VIEW.dashMonth="all";
    var shown=rows.filter(function(r){return VIEW.dashMonth==="all"||r.date.slice(0,7)===VIEW.dashMonth}).slice().reverse();
    html+='<div class="row between wrap"><h3>All results</h3><label class="inline">Month <select id="dm">'+'<option value="all">All months</option>'+mk.map(function(m){return '<option value="'+m+'"'+(VIEW.dashMonth===m?" selected":"")+'>'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</option>'}).join("")+'</select></label></div>'+
      '<div class="scroll"><table class="tbl hist"><thead><tr><th>Date</th><th>Test</th><th>Type</th><th>Marks</th><th>%</th><th class="hide-sm">Right</th><th class="hide-sm">Wrong</th><th class="hide-sm">Skipped</th><th class="hide-sm">Time</th></tr></thead><tbody>'+
      shown.map(function(r){return '<tr'+(r.kind==="att"?' class="click" data-att="'+r.id+'" tabindex="0"':'')+'><td>'+fd(r.date)+'</td><td>'+esc(r.title)+'</td><td>'+esc(r.type)+'</td><td class="num">'+r.marks+' / '+r.max+'</td><td class="num">'+r1(r.p)+'</td><td class="num hide-sm">'+(r.r==null?"–":r.r)+'</td><td class="num hide-sm">'+(r.w==null?"–":r.w)+'</td><td class="num hide-sm">'+(r.sk==null?"–":r.sk)+'</td><td class="num hide-sm">'+(r.sec?fmtMin(r.sec):(r.rank?"Rank "+r.rank:"–"))+'</td></tr>'}).join("")+'</tbody></table></div><p class="muted small">Tap a row to see every question with your answer and the explanation.</p>';
    html+='</section>';
  }
  html+=shankarSection();
  html+=subjectSection();
  html+=logSection();
  v.innerHTML=html;
  if(rows.length)drawPerf($("perfchart"),rows,type);
  qsa("[data-dt]").forEach(function(b){b.onclick=function(){VIEW.dashType=b.dataset.dt;render()}});
  if($("dm"))$("dm").onchange=function(){VIEW.dashMonth=this.value;render()};
  qsa("tr[data-att]").forEach(function(tr){tr.onclick=function(){openAttempt(tr.dataset.att)};tr.onkeydown=function(e){if(e.key==="Enter")openAttempt(tr.dataset.att)}});
  bindSubjects();
  bindLog();
  drawShankar();
}

/* performance line chart (SVG) */
function drawPerf(el,rows,type){
  var W=Math.max(300,el.clientWidth||640),H=W<520?230:270,pl=38,pr=14,pt=16,pb=28;
  var d0=dayNum(CFG.START),d1=Math.max(dayNum(today()),dayNum(rows[rows.length-1].date))+3;
  if(type==="all"||type==="mock")d1=Math.max(d1,dayNum(CFG.PRELIMS));
  var X=function(ds){return pl+(dayNum(ds)-d0)/(d1-d0)*(W-pl-pr)},Y=function(p){return pt+(1-Math.max(0,Math.min(100,p))/100)*(H-pt-pb)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="Scores over time">';
  [0,25,50,75,100].forEach(function(p){s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(p)+'" y2="'+Y(p)+'"/><text class="axis" x="'+(pl-6)+'" y="'+(Y(p)+4)+'" text-anchor="end">'+p+'</text>'});
  for(var m=0;m<9;m++){var y=2026+Math.floor((9+m)/12),mm=(9+m)%12,ds=y+"-"+pad(mm+1)+"-01";if(dayNum(ds)<d0||dayNum(ds)>d1)continue;s+='<text class="axis" x="'+X(ds)+'" y="'+(H-8)+'" text-anchor="middle">'+MON[mm]+'</text>'}
  s+='<line class="goal" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(CFG.GOAL)+'" y2="'+Y(CFG.GOAL)+'"/><text class="goaltxt" x="'+(W-pr)+'" y="'+(Y(CFG.GOAL)-5)+'" text-anchor="end">Goal 90%</text>';
  if(type==="all"){ // ideal path from first result to goal
    var b=Math.min(65,Math.max(20,rows[0].p)),pts2=[];
    for(var d=d0;d<=dayNum(CFG.IDEAL_END);d+=4){var t=(d-d0)/(dayNum(CFG.IDEAL_END)-d0);pts2.push([pl+(d-d0)/(d1-d0)*(W-pl-pr),Y(b+(CFG.GOAL-b)*(1-Math.pow(1-t,1.7)))])}
    s+='<polyline class="ideal" points="'+pts2.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" ")+'"/>';
  }
  var groups=[["app",rows.filter(function(r){return r.src==="app"})],["shankar",rows.filter(function(r){return r.src==="shankar"})]];
  var placed=[];
  groups.forEach(function(g){
    var rs=g[1];if(!rs.length)return;
    if(rs.length>1)s+='<polyline class="ln '+g[0]+'" points="'+rs.map(function(r){return X(r.date).toFixed(1)+","+Y(r.p).toFixed(1)}).join(" ")+'"/>';
    rs.forEach(function(r,i){s+='<circle class="pt '+g[0]+'" cx="'+X(r.date).toFixed(1)+'" cy="'+Y(r.p).toFixed(1)+'" r="'+(rs.length>40?3:4.5)+'" data-i="'+rows.indexOf(r)+'" tabindex="0"><title>'+esc(fdy(r.date)+": "+r.title+", "+r.marks+" / "+r.max+" ("+r1(r.p)+"%)")+'</title></circle>';
      var lx=X(r.date),ly=Y(r.p)-9;if(rs.length<=14&&!placed.some(function(q){return Math.abs(q[0]-lx)<26&&Math.abs(q[1]-ly)<13})){placed.push([lx,ly]);s+='<text class="ptlabel" x="'+X(r.date).toFixed(1)+'" y="'+(Y(r.p)-9).toFixed(1)+'" text-anchor="middle">'+r.marks+'</text>'}});
  });
  s+='</svg>';
  var leg='<div class="legend">'+(groups[0][1].length?'<span><i class="lg app"></i>Tests in this app</span>':'')+(groups[1][1].length?'<span><i class="lg shankar"></i>Shankar tests</span>':'')+(type==="all"?'<span><i class="lg ideal"></i>Ideal path to 90%</span>':'')+'<span><i class="lg goal"></i>Goal</span></div>';
  el.innerHTML=s+leg+'<div class="tip" id="perftip" hidden></div>';
  var tip=$("perftip");
  qsa("circle.pt",el).forEach(function(c){var show=function(){var r=rows[+c.dataset.i];tip.innerHTML='<b>'+esc(r.title)+'</b><br>'+fdy(r.date)+'<br>'+r.marks+' of '+r.max+' marks ('+r1(r.p)+'%)'+(r.r!=null?'<br>Right '+r.r+', wrong '+r.w+(r.sk!=null?', skipped '+r.sk:''):'');tip.hidden=false;var bx=c.getBoundingClientRect(),eb=el.getBoundingClientRect();tip.style.left=Math.min(eb.width-190,Math.max(0,bx.left-eb.left-90))+"px";tip.style.top=Math.max(0,bx.top-eb.top-86)+"px"};c.onmouseenter=show;c.onfocus=show;c.onclick=show;c.onmouseleave=function(){tip.hidden=true}});
}

/* subject-wise performance (always shown) */
function subjectSection(){
  var from=VIEW.from||CFG.START,to=VIEW.to||today();
  var st=unitStats(from,to);
  var h='<section class="panel"><div class="row between wrap"><div><h2>Subject-wise performance</h2><p class="muted small">From every test type: daily, mock, subject and revision tests. Accuracy is right answers out of attempted questions. Strong is 75% or more, weak is below 50%, and a unit needs 10 attempted questions to be rated.</p></div>'+
    '<div class="row wrap tight"><label class="inline">From <input type="date" id="df" value="'+from+'" min="2026-10-01" max="'+today()+'"></label><label class="inline">To <input type="date" id="dto" value="'+to+'" min="2026-10-01" max="'+today()+'"></label></div></div><ul class="subjects">';
  M.subjects.forEach(function(s){
    var o=st[s]||{r:0,w:0,sk:0,units:{}},acc=accOf(o),n=o.r+o.w,open=!!VIEW.subjOpen[s];
    var weak=0,strong=0;Object.keys(o.units).forEach(function(u){var x=unitStatus(o.units[u]);if(x==="weak")weak++;if(x==="strong")strong++});
    var shank=testMarks().filter(function(t){return t.subject===s&&t.marks!=null&&t.marks!==""}).sort(function(a,b){return a.date<b.date?-1:1});
    h+='<li class="subjrow'+(open?" open":"")+'"><button class="subjhead" data-sx="'+esc(s)+'" aria-expanded="'+open+'"><span class="sname">'+esc(s)+'</span><span class="bar" aria-hidden="true"><i style="width:'+(acc==null?0:acc)+'%" class="'+(acc==null?"":(acc>=75?"strong":(acc<50?"weak":"moderate")))+'"></i></span><span class="sacc">'+(acc==null?"No data":Math.round(acc)+"%")+'</span><span class="smeta">'+(n?n+" attempted":"")+(weak?", "+weak+" weak":"")+(strong?", "+strong+" strong":"")+'</span></button>';
    if(open)h+='<div class="subjbody">'+unitTable(s,o)+(shank.length?'<h3>Shankar '+esc(s)+' tests</h3><div class="scroll"><table class="tbl"><thead><tr><th>Test</th><th>Date</th><th>Marks</th><th>%</th></tr></thead><tbody>'+shank.map(function(t){return '<tr><td>'+esc(t.name)+'</td><td>'+fd(t.date)+'</td><td class="num">'+t.marks+' / '+(t.max||200)+'</td><td class="num">'+r1(pct(t.marks,t.max||200))+'</td></tr>'}).join("")+'</tbody></table></div>':'')+'</div>';
    h+='</li>';
  });
  return h+'</ul></section>';
}
var STATUS_LABEL={strong:"Strong",moderate:"Moderate",weak:"Weak",nodata:"Not enough data"};
var TREND_LABEL={up:"Improving",down:"Declining",steady:"Steady"};
function unitTable(s,o){
  var list=UNITLIST[s]||[],extra=Object.keys(o.units).filter(function(u){return list.indexOf(u)<0});
  var all=list.concat(extra);
  var row=function(u){var x=o.units[u]||{r:0,w:0,sk:0,ev:[]},n=x.r+x.w,st=n?unitStatus(x):"nodata",tr=unitTrend(x);var avail=poolFor(s,[u]).length;
    return '<tr><td>'+esc(u)+'<span class="sub">'+(n?n+' attempted':'Not attempted')+'</span></td><td class="num hide-sm">'+n+'</td><td class="num">'+(n?Math.round(x.r/n*100)+"%":"–")+'</td><td>'+(n?'<span class="tag '+st+'">'+STATUS_LABEL[st]+'</span>':'')+'</td><td class="hide-sm">'+(tr?'<span class="trend '+tr+'">'+TREND_LABEL[tr]+'</span>':'')+'</td><td>'+(avail?'<button class="btn small'+(st==="weak"?" primary":"")+'" data-retest="'+esc(s)+'|'+esc(u)+'">'+(n?"Retest":"Test")+'</button>':'')+'</td></tr>'};
  var groups={};all.forEach(function(u){var g=UNITGROUP[s+"|"+u]||"";(groups[g]=groups[g]||[]).push(u)});
  var body="";Object.keys(groups).forEach(function(g){if(g)body+='<tr class="grp"><td colspan="6">'+esc(g)+'</td></tr>';body+=groups[g].map(row).join("")});
  return '<div class="scroll"><table class="tbl units"><thead><tr><th>Unit</th><th class="hide-sm">Attempted</th><th>Accuracy</th><th>Status</th><th class="hide-sm">Trend</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function bindSubjects(){
  qsa("[data-sx]").forEach(function(b){b.onclick=function(){var s=b.dataset.sx;VIEW.subjOpen[s]=!VIEW.subjOpen[s];render()}});
  qsa("[data-retest]").forEach(function(b){b.onclick=function(){var p=b.dataset.retest.split("|");startSubjectTest(p[0],[p.slice(1).join("|")])}});
  var f=$("df"),t=$("dto");if(f)f.onchange=function(){VIEW.from=this.value||null;render()};if(t)t.onchange=function(){VIEW.to=this.value||null;render()};
}

/* Scores tab: Shankar marks, added results, sync settings, backup */
function viewScores(){
  var v=$("view"),td=today();
  var html='<div class="pagehead"><div><h1>Scores</h1><p class="muted">Enter your Shankar test marks after each test. They feed the Weekly and Mock views of the dashboard and each subject\'s progress. CSAT is out of 200 and qualifying at 33%.</p></div></div>';
  html+='<section class="panel"><h2>Shankar Prestorming tests (GS and CSAT)</h2><div class="scroll"><table class="tbl entry"><thead><tr><th>Test</th><th>Marks</th><th>Out of</th><th>Right</th><th>Wrong</th><th>Rank</th><th>%</th></tr></thead><tbody>'+
    TESTS.filter(function(t,i){var nxt=TESTS.findIndex(function(x){return x.date>=td});return VIEW.allTests||nxt<0||i<=nxt+1||DB.recs["test_"+t.k]}).map(function(t){var e=DB.recs["test_"+t.k]||{};var p=(e.marks!=null&&e.marks!=="")?pct(e.marks,e.max||200):null;
      return '<tr class="'+(t.date<=td?"past":"")+'"><td><b>'+esc(t.name)+'</b><span class="muted small">'+fdw(t.date)+', '+esc(t.kind)+(t.subject&&t.subject!=="Mixed"&&!t.csat?", "+esc(t.subject):"")+'</span></td>'+
      ["marks","max","r","w","rank"].map(function(f){var val=f==="max"?(e.max==null?200:e.max):e[f];return '<td><input type="number" inputmode="decimal" step="any" data-k="'+t.k+'" data-f="'+f+'" value="'+(val==null?"":esc(val))+'" aria-label="'+esc(t.name)+' '+f+'"></td>'}).join("")+
      '<td class="num" id="pc-'+t.k+'">'+(p==null?"–":r1(p)+(t.csat?(p>=33?' <span class="good small">qualifies</span>':' <span class="bad-t small">below 33%</span>'):''))+'</td></tr>'}).join("")+'</tbody></table></div><button class="link" id="t-all">'+(VIEW.allTests?"Show only past and next tests":"Show all "+TESTS.length+" tests")+'</button></section>';
  var extra=testMarks().filter(function(t){return !TESTBYKEY[t.k]}).sort(function(a,b){return a.date<b.date?1:-1});
  html+='<section class="panel"><div class="row between wrap"><h2>Other test results</h2><button class="btn" id="xt-add">Add a test result</button></div><p class="muted small">For CSAT tests, other mocks or any test outside the timetable.</p>'+
    (extra.length?'<ul class="list">'+extra.map(function(t){return '<li><div><b>'+esc(t.name)+'</b><span class="muted small">'+fdy(t.date)+', '+(t.type==="mock"?"mock":"weekly")+', '+esc(t.subject||"")+(t.rank?', rank '+t.rank:'')+'</span></div><div class="row tight"><span class="num">'+t.marks+' / '+t.max+'</span><button class="btn ghost small" data-xedit="'+t.id+'">Edit</button><button class="btn ghost small" data-xdel="'+t.id+'">Delete</button></div></li>'}).join("")+'</ul>':'')+'</section>';
  var c=syncCfg();
  html+='<section class="panel" id="sync-card"><h2>Google Sheet sync</h2><p class="muted small">Saves every result, mark, check-in and your own questions to your Google Sheet when you are online, and brings them to your other devices. Work done offline waits on the device and uploads later.</p>'+
    '<div class="formgrid"><label class="fld">Web app URL<input id="sy-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="'+esc(c.url)+'"></label><label class="fld">Passphrase<input id="sy-key" type="text" autocomplete="off" value="'+esc(c.key)+'"></label></div>'+
    '<div class="row wrap"><button class="btn primary" id="sy-save">Save and sync</button><button class="btn" id="sy-now"'+(c.url?"":" disabled")+'>Sync now</button><span class="muted small" id="sy-msg"></span></div>'+
    '<p class="muted small">'+(DB.meta.lastSync?'Last synced '+new Date(DB.meta.lastSync).toLocaleString()+'. ':'')+pendingCount()+' change(s) waiting to upload.</p>'+
    '<details><summary>Set up the Sheet (once, about 5 minutes)</summary><ol class="steps"><li>Create a new Google Sheet. Open Extensions, then Apps Script.</li><li>Delete the sample code. Tap Copy the script below and paste it in.</li><li>Change the passphrase on the line that starts with var KEY, then save.</li><li>Tap Deploy, New deployment. Choose Web app. Set Execute as: Me, and Who has access: Anyone. Tap Deploy and allow access.</li><li>Copy the Web app URL into the box above, type the same passphrase, and tap Save and sync.</li></ol><p class="muted small">Use the same URL and passphrase on every device. If you change the script later, choose Deploy, Manage deployments, Edit, New version, so the URL stays the same.</p><button class="btn" id="sy-copy">Copy the script</button></details></section>';
  html+='<section class="panel"><h2>Test settings</h2>'+
    '<label class="check"><input type="checkbox" id="st-ap"'+(DB.meta.autoPause!==false?" checked":"")+'> Pause the clock when I leave the app during a test</label><p class="muted small">If your baby wakes or a call comes in, the timer stops while the app is in the background and starts again when you return.</p>'+
    '<label class="inline">Listen mode: thinking time before the answer <select id="st-think">'+[0,4,8,12].map(function(v){var cur=DB.meta.ttsThink==null?4:DB.meta.ttsThink;return '<option value="'+v+'"'+(v===cur?" selected":"")+'>'+(v?v+" seconds":"None")+'</option>'}).join("")+'</select></label></section>';
  html+='<section class="panel"><h2>Backup</h2><p class="muted small">Download everything on this device as a file, or restore from one. Restoring merges with what is already here.</p><div class="row wrap"><button class="btn" id="bk-exp">Download backup</button><label class="btn">Restore from file<input type="file" id="bk-imp" accept="application/json,.json" hidden></label></div></section>';
  html+='<p class="muted small center">Prelims Arena, question bank '+esc(M.version)+'. '+(navigator.serviceWorker&&navigator.serviceWorker.controller?"Available offline on this device.":"")+'</p>';
  v.innerHTML=html;
  var timers={};
  qsa("table.entry input").forEach(function(inp){inp.addEventListener("input",function(){
    var k=inp.dataset.k,f=inp.dataset.f,t=TESTBYKEY[k],id="test_"+k;
    var e=Object.assign({kind:"test",k:k,name:t.name,type:t.type,subject:t.subject,date:t.date,max:200},DB.recs[id]||{});
    e[f]=inp.value===""?null:Number(inp.value);
    var p=(e.marks!=null)?pct(e.marks,e.max||200):null;$("pc-"+k).innerHTML=p==null?"–":r1(p)+(t.csat?(p>=33?' <span class="good small">qualifies</span>':' <span class="bad-t small">below 33%</span>'):'');
    clearTimeout(timers[k]);timers[k]=setTimeout(function(){put(id,e)},700);
  })});
  $("xt-add").onclick=function(){xtestDialog(null)};
  $("t-all").onclick=function(){VIEW.allTests=!VIEW.allTests;render()};
  qsa("[data-xedit]").forEach(function(b){b.onclick=function(){xtestDialog(b.dataset.xedit)}});
  qsa("[data-xdel]").forEach(function(b){b.onclick=function(){modal('<h2>Delete this result?</h2><div class="row"><button class="btn danger" data-m="y">Delete</button><button class="btn ghost" data-m="x">Cancel</button></div>',function(a){if(a==="y"){del(b.dataset.xdel);render()}})}});
  var saveCfg=function(){DB.meta.syncUrl=$("sy-url").value.trim();DB.meta.syncKey=$("sy-key").value;saveStore(true)};
  $("sy-save").onclick=function(){saveCfg();if(!DB.meta.syncUrl){toast("Paste the Web app URL first.");return}Object.keys(DB.recs).forEach(function(id){DB.dirty[id]=1});saveStore(true);sync()};
  $("sy-now").onclick=function(){saveCfg();sync()};
  $("sy-copy").onclick=function(){copyText(GAS_SCRIPT,"Script copied. Paste it into Apps Script.")};
  $("bk-exp").onclick=exportBackup;
  $("st-ap").onchange=function(){DB.meta.autoPause=this.checked;saveStore(true)};
  $("st-think").onchange=function(){DB.meta.ttsThink=+this.value;saveStore(true)};
  $("bk-imp").onchange=function(){var f=this.files[0];if(f)importBackup(f)};
  updateSyncBadge();
}
function xtestDialog(id){
  var t=id?DB.recs[id]:{name:"",type:"weekly",subject:"CSAT",date:today(),marks:null,max:200,r:null,w:null,rank:null};
  modal('<h2>'+(id?"Edit test result":"Add a test result")+'</h2><label class="fld">Test name<input id="xt-name" value="'+esc(t.name)+'" placeholder="For example: CSAT Sectional Test 1"></label>'+
    '<div class="formgrid"><label class="fld">Date<input type="date" id="xt-date" value="'+esc(t.date)+'"></label><label class="fld">Type<select id="xt-type"><option value="weekly"'+(t.type==="weekly"?" selected":"")+'>Weekly</option><option value="mock"'+(t.type==="mock"?" selected":"")+'>Mock</option></select></label>'+
    '<label class="fld">Subject<select id="xt-sub">'+M.subjects.concat(["Mixed"]).map(function(s){return '<option'+(s===t.subject?" selected":"")+'>'+esc(s)+'</option>'}).join("")+'</select></label>'+
    '<label class="fld">Marks<input type="number" step="any" id="xt-marks" value="'+(t.marks==null?"":t.marks)+'"></label><label class="fld">Out of<input type="number" step="any" id="xt-max" value="'+(t.max==null?200:t.max)+'"></label>'+
    '<label class="fld">Right<input type="number" id="xt-r" value="'+(t.r==null?"":t.r)+'"></label><label class="fld">Wrong<input type="number" id="xt-w" value="'+(t.w==null?"":t.w)+'"></label><label class="fld">Rank<input type="number" id="xt-rank" value="'+(t.rank==null?"":t.rank)+'"></label></div>'+
    '<p class="err" id="xt-err" hidden></p><div class="row"><button class="btn primary" id="xt-save">Save result</button><button class="btn ghost" data-m="x">Cancel</button></div>');
  $("xt-save").onclick=function(){
    var num=function(i){var x=$(i).value;return x===""?null:Number(x)};
    if(!$("xt-name").value.trim()||num("xt-marks")==null||!$("xt-date").value){var e=$("xt-err");e.textContent="Enter a test name, the date and your marks.";e.hidden=false;return}
    var rid=id||("test_X"+Date.now().toString(36));
    put(rid,{kind:"test",k:rid.replace(/^test_/,""),name:$("xt-name").value.trim(),date:$("xt-date").value,type:$("xt-type").value,subject:$("xt-sub").value,marks:num("xt-marks"),max:num("xt-max")||200,r:num("xt-r"),w:num("xt-w"),rank:num("xt-rank")});
    closeModal();render();toast("Result saved.");
  };
}
function copyText(t,msg){
  var ok=function(){toast(msg)};
  var fb=function(){var ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");ok()}catch(e){toast("Copy did not work on this device. Open the Sheet script file instead.")}ta.remove()};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb();
}
function exportBackup(){
  var data={app:"prelims-arena",v:2,exported:new Date().toISOString(),recs:DB.recs};
  var blob=new Blob([JSON.stringify(data)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="prelims-arena-backup-"+today()+".json";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
function importBackup(file){
  var rd=new FileReader();
  rd.onload=function(){
    try{var d=JSON.parse(rd.result);if(!d.recs)throw 0;var n=0;
      Object.keys(d.recs).forEach(function(id){var r=d.recs[id],l=DB.recs[id];if(!l||(r.ts||0)>(l.ts||0)){DB.recs[id]=r;DB.dirty[id]=1;n++}});
      saveStore(true);syncSoon();render();toast("Restored "+n+" item(s) from the backup.");
    }catch(e){toast("That file is not a Prelims Arena backup.")}
  };
  rd.readAsText(file);
}

/* Listen mode: the phone reads questions, the answer, the explanation and the memory hook aloud */
var PL={list:[],i:0,on:false,title:"",wake:null,timer:null,token:0};
var RATES=[0.8,1,1.15,1.3,1.5];
function ttsOk(){return "speechSynthesis" in window&&"SpeechSynthesisUtterance" in window}
function pickVoice(){
  var v=window.speechSynthesis.getVoices()||[];
  return v.filter(function(x){return /en[-_]IN/i.test(x.lang)})[0]||v.filter(function(x){return /en[-_]GB/i.test(x.lang)})[0]||v.filter(function(x){return /^en/i.test(x.lang)})[0]||null;
}
function chunks(t){
  return String(t||"").replace(/\s*\n+\s*/g,". ").replace(/\.\s*\./g,".").split(/(?<=[.?!;:])\s+/).reduce(function(acc,p){
    p=p.trim();if(!p)return acc;
    while(p.length>200){var cut=p.lastIndexOf(",",200);if(cut<60)cut=p.lastIndexOf(" ",200);acc.push(p.slice(0,cut+1));p=p.slice(cut+1).trim()}
    acc.push(p);return acc;
  },[]);
}
function readable(s){return String(s).replace(/Statement-I\b/g,"Statement one").replace(/Statement-II\b/g,"Statement two").replace(/\bvs\.?\b/g,"versus").replace(/ \| /g,", ")}
function playList(list,title){
  if(!ttsOk()){toast("This device cannot read text aloud.");return}
  stopPlayer(true);
  PL.list=list;PL.i=0;PL.title=title;PL.on=true;
  try{if(navigator.wakeLock)navigator.wakeLock.request("screen").then(function(w){PL.wake=w}).catch(function(){})}catch(e){}
  drawPlayer();speakCur();
}
function speakCur(){
  var tok=++PL.token;window.speechSynthesis.cancel();clearTimeout(PL.timer);
  var it=PL.list[PL.i];if(!it){stopPlayer();toast("Finished reading "+PL.list.length+" question"+(PL.list.length>1?"s":"")+".");return}
  var q=it.q,L="ABCD";
  var pre=["Question "+(PL.i+1)+" of "+PL.list.length+"."].concat(q.p?["Passage."].concat(chunks(readable(q.p))):[]).concat(chunks(readable(q.q))).concat(["Options."]).concat(q.o.map(function(o,k){return L[k]+". "+readable(o)}));
  var post=["The answer is "+L[q.a]+". "+readable(q.o[q.a])+"."];
  if(it.ch!=null&&it.ch>=0)post.push(it.ch===q.a?"You got this right.":"You chose "+L[it.ch]+".");
  post=post.concat(chunks(readable(q.e||"")));
  if(q.h)post=post.concat(["Memory hook."]).concat(chunks(readable(q.h)));
  var think=(DB.meta.ttsThink==null?4:DB.meta.ttsThink)*1000;
  var say=function(arr,done){var j=0;var nx=function(){if(tok!==PL.token)return;if(j>=arr.length){done();return}
      var u=new SpeechSynthesisUtterance(arr[j++]);u.rate=DB.meta.ttsRate||1;var v=pickVoice();if(v){u.voice=v;u.lang=v.lang}else u.lang="en-IN";
      u.onend=nx;u.onerror=function(e){if(e.error==="interrupted"||e.error==="canceled")return;nx()};window.speechSynthesis.speak(u)};nx()};
  drawPlayer();
  say(pre,function(){PL.timer=setTimeout(function(){if(tok!==PL.token)return;say(post,function(){PL.timer=setTimeout(function(){if(tok!==PL.token)return;PL.i++;speakCur()},1200)})},think)});
}
function pausePlayer(){PL.on=false;PL.token++;clearTimeout(PL.timer);window.speechSynthesis.cancel();drawPlayer()}
function resumePlayer(){PL.on=true;speakCur()}
function stopPlayer(silent){PL.token++;clearTimeout(PL.timer);if(ttsOk())window.speechSynthesis.cancel();PL.on=false;if(PL.wake){try{PL.wake.release()}catch(e){}PL.wake=null}var b=$("player");if(b)b.remove();if(!silent)PL.list=[]}
function drawPlayer(){
  var b=$("player");if(!PL.list.length){if(b)b.remove();return}
  if(!b){b=document.createElement("div");b.id="player";b.className="player";b.setAttribute("role","region");b.setAttribute("aria-label","Listen mode");document.body.appendChild(b)}
  var it=PL.list[PL.i],rate=DB.meta.ttsRate||1;
  b.innerHTML='<div class="pl-info"><b>'+esc(PL.title)+'</b><span>Question '+Math.min(PL.i+1,PL.list.length)+' of '+PL.list.length+(it?': '+esc(it.q.q.slice(0,70))+(it.q.q.length>70?"…":""):'')+'</span></div>'+
    '<div class="pl-ctl"><button class="btn ghost small" id="pl-prev" aria-label="Previous question"'+(PL.i===0?" disabled":"")+'>‹</button><button class="btn primary small" id="pl-play">'+(PL.on?"Pause":"Play")+'</button><button class="btn ghost small" id="pl-next" aria-label="Next question">›</button><button class="btn ghost small" id="pl-rate" aria-label="Reading speed">'+rate+'×</button><button class="btn ghost small" id="pl-close" aria-label="Stop listening">✕</button></div>';
  $("pl-play").onclick=function(){PL.on?pausePlayer():resumePlayer()};
  $("pl-prev").onclick=function(){if(PL.i>0){PL.i--;PL.on=true;speakCur()}};
  $("pl-next").onclick=function(){PL.i++;PL.on=true;speakCur()};
  $("pl-rate").onclick=function(){var i=RATES.indexOf(rate);DB.meta.ttsRate=RATES[(i+1)%RATES.length];saveStore();if(PL.on)speakCur();else drawPlayer()};
  $("pl-close").onclick=function(){stopPlayer()};
}
function listenPanel(){
  var mb=mistakeBook(),set=todaysOpenSet()||scheduledFor(today()).filter(function(s){return s.ready})[0];
  var subs=M.subjects.filter(function(s){return s!=="CSAT"&&poolFor(s).length});
  if(!ttsOk())return '<section class="panel"><h2>Listen and revise</h2><p class="muted">This device or browser cannot read text aloud.</p></section>';
  return '<section class="panel"><h2>Listen and revise</h2><p class="muted small">Your phone reads each question and its options, pauses '+(DB.meta.ttsThink==null?4:DB.meta.ttsThink)+' seconds for you to think, then reads the answer, the explanation and the memory hook. Good for walks and cooking. The screen stays on while it reads; some phones stop reading when the screen locks.</p>'+
    '<div class="row wrap"><button class="btn" id="ls-mist"'+(mb.length?"":" disabled")+'>My mistakes ('+Math.min(mb.length,30)+')</button>'+(set?'<button class="btn" id="ls-set">'+esc(set.title)+'</button>':'')+
    '<label class="inline">Subject <select id="ls-subj">'+subs.map(function(s){return '<option>'+esc(s)+'</option>'}).join("")+'</select></label><button class="btn" id="ls-subj-go">Listen to 20</button></div></section>';
}
function bindListen(){
  var go=function(qids,title){loadQids(qids).then(function(qs){qs=qs.filter(function(q){return !q.x});if(!qs.length){toast("Nothing to read out.");return}playList(qs.map(function(q){return {q:q}}),title)})};
  if($("ls-mist"))$("ls-mist").onclick=function(){var mb=mistakeBook().slice(0,30);go(mb.map(function(m){return m.qid}),"My mistakes")};
  if($("ls-set"))$("ls-set").onclick=function(){var s=todaysOpenSet()||scheduledFor(today()).filter(function(x){return x.ready})[0];loadSet(s.id).then(function(d){playList(d.questions.filter(function(q){return !q.x}).map(function(q){return {q:q}}),s.title)})};
  if($("ls-subj-go"))$("ls-subj-go").onclick=function(){var s=$("ls-subj").value;go(shuffle(poolFor(s)).slice(0,20),s+": 20 questions")};
}

/* Daily study log: how the day went, hours, what was covered, and why study or a test was missed */
var LOG_STATUS=[["full","Studied as planned"],["partial","Studied partly"],["none","Could not study"]];
var LOG_REASONS=["Child care","Baby unwell","My health","Police duty / work","Household work","Family event","Travel","Tired / low energy","Distracted / phone","Other"];
function logRec(ds){var r=DB.recs["log_"+ds];return r&&!r.del?r:null}
function logs(){return recs("log").sort(function(a,b){return a.date<b.date?1:-1})}
function logLine(r){
  var st=(LOG_STATUS.filter(function(x){return x[0]===r.status})[0]||["",""])[1];
  return esc(st)+(r.hours!=null&&r.hours!==""?", "+r.hours+" h":"")+((r.subjects||[]).length?", "+esc(r.subjects.join(", ")):"")+((r.reasons||[]).length?". Reason: "+esc(r.reasons.join(", ")):"");
}
function logCard(ds,heading){
  var r=logRec(ds),t=TESTBYDATE[ds];
  if(!r)return '<section class="panel logcard"><div><h2>'+esc(heading)+'</h2><p class="muted small">Note how the day went: hours, what you covered, and what got in the way. Over weeks this shows your real pattern.</p></div><button class="btn" data-log="'+ds+'">'+(ds===today()?"Add today's log":"Add a log for this day")+'</button></section>';
  return '<section class="panel logcard done"><div><h2>'+esc(heading)+'</h2><p>'+logLine(r)+'</p>'+(r.covered?'<p class="muted small">Covered: '+esc(r.covered)+'</p>':'')+(t&&r.test?'<p class="muted small">'+esc(t.name)+': '+(r.test==="yes"?"taken":"missed")+'</p>':'')+(r.note?'<p class="muted small">'+esc(r.note)+'</p>':'')+'</div><button class="btn ghost small" data-log="'+ds+'">Edit</button></section>';
}
function logDialog(ds){
  var r=logRec(ds)||{status:null,hours:null,subjects:[],covered:"",reasons:[],note:"",test:null};
  var t=TESTBYDATE[ds],sch=scheduledFor(ds).filter(function(s){return s.ready});
  var chips=function(name,list,sel){return '<div class="chips" data-group="'+name+'">'+list.map(function(x){return '<button type="button" class="chipbtn" data-v="'+esc(x)+'" aria-pressed="'+(sel.indexOf(x)>=0)+'">'+esc(x)+'</button>'}).join("")+'</div>'};
  modal('<h2>Study log, '+fdw(ds)+'</h2>'+
    '<div class="fld"><span>How did the day go?</span><div class="seg wide" id="lg-st">'+LOG_STATUS.map(function(s){return '<button type="button" data-st="'+s[0]+'" aria-pressed="'+(r.status===s[0])+'">'+s[1]+'</button>'}).join("")+'</div></div>'+
    '<div class="formgrid"><label class="fld">Hours studied<input id="lg-h" type="number" inputmode="decimal" step="0.5" min="0" max="16" value="'+(r.hours==null?"":r.hours)+'"></label></div>'+
    '<div class="fld"><span>Subjects</span>'+chips("sub",M.subjects,r.subjects||[])+'</div>'+
    '<label class="fld">What I covered<textarea id="lg-cov" rows="2" placeholder="For example: Laxmikanth Ch 7 to 9, NCERT Class 11 Geography Ch 2">'+esc(r.covered||"")+'</textarea></label>'+
    (t?'<div class="fld"><span>'+esc(t.name)+'</span><div class="seg" id="lg-test"><button type="button" data-t="yes" aria-pressed="'+(r.test==="yes")+'">Took it</button><button type="button" data-t="no" aria-pressed="'+(r.test==="no")+'">Missed it</button></div></div>':'')+
    '<div class="fld" id="lg-rs-wrap"><span>What got in the way? (choose any)</span>'+chips("rs",LOG_REASONS,r.reasons||[])+'</div>'+
    '<label class="fld">Notes, or plan for tomorrow<textarea id="lg-note" rows="2">'+esc(r.note||"")+'</textarea></label>'+
    (sch.length?'<p class="muted small">Scheduled set: '+esc(sch.map(function(s){return s.title}).join(", "))+(setDoneMap()[sch[0].id]?' (done)':' (not done yet)')+'</p>':'')+
    '<p class="err" id="lg-err" hidden></p><div class="row wrap"><button class="btn primary" id="lg-save">Save log</button>'+(logRec(ds)?'<button class="btn ghost" id="lg-del">Delete</button>':'')+'<button class="btn ghost" data-m="x">Cancel</button></div>');
  var st=r.status,tst=r.test;
  qsa("#lg-st button").forEach(function(b){b.onclick=function(){st=b.dataset.st;qsa("#lg-st button").forEach(function(x){x.setAttribute("aria-pressed",x===b)})}});
  qsa("#lg-test button").forEach(function(b){b.onclick=function(){tst=b.dataset.t;qsa("#lg-test button").forEach(function(x){x.setAttribute("aria-pressed",x===b)})}});
  qsa("#modal .chips .chipbtn").forEach(function(b){b.onclick=function(){b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")!=="true")}});
  var picked=function(g){return qsa('#modal .chips[data-group="'+g+'"] .chipbtn').filter(function(b){return b.getAttribute("aria-pressed")==="true"}).map(function(b){return b.dataset.v})};
  $("lg-save").onclick=function(){
    if(!st){var e=$("lg-err");e.textContent="Choose how the day went.";e.hidden=false;return}
    var h=$("lg-h").value;
    put("log_"+ds,{kind:"log",date:ds,status:st,hours:h===""?null:Number(h),subjects:picked("sub"),covered:$("lg-cov").value.trim(),reasons:picked("rs"),test:tst||null,note:$("lg-note").value.trim()});
    closeModal();render();toast("Log saved.");
  };
  if($("lg-del"))$("lg-del").onclick=function(){del("log_"+ds);closeModal();render()};
}
/* dashboard section */
function logSection(){
  var range=VIEW.logRange||30,from=range==="all"?"0000":addDays(today(),-(range-1));
  var L=logs().filter(function(r){return r.date>=from});
  var h='<section class="panel" id="log-sec"><div class="row between wrap"><h2>Study log</h2><div class="seg small" role="group" aria-label="Period">'+[[7,"7 days"],[30,"30 days"],["all","All"]].map(function(x){return '<button data-lr="'+x[0]+'" aria-pressed="'+(String(range)===String(x[0]))+'">'+x[1]+'</button>'}).join("")+'</div></div>';
  if(!L.length)return h+'<p class="empty">Add a daily log from the Today tab to see your study pattern here.</p></section>';
  var days=range==="all"?L.length:range,hrs=0,cnt={full:0,partial:0,none:0},rs={},sub={};
  L.forEach(function(r){hrs+=+r.hours||0;cnt[r.status]=(cnt[r.status]||0)+1;(r.reasons||[]).forEach(function(x){rs[x]=(rs[x]||0)+1});(r.subjects||[]).forEach(function(s){sub[s]=(sub[s]||0)+(+r.hours||0)/Math.max(1,(r.subjects||[]).length)})});
  var tests=L.filter(function(r){return r.test==="no"}).length;
  h+='<dl class="kpis"><div><dt>Days logged</dt><dd>'+L.length+(range!=="all"?'<small> of '+range+'</small>':'')+'</dd></div><div><dt>Hours studied</dt><dd>'+r1(hrs)+'</dd><dd class="sub">'+r1(hrs/Math.max(1,L.length))+' h per logged day</dd></div><div><dt>Full days</dt><dd>'+cnt.full+'</dd><dd class="sub">'+cnt.partial+' partly, '+cnt.none+' could not</dd></div><div><dt>Shankar tests missed</dt><dd>'+tests+'</dd></div></dl>';
  var rk=Object.keys(rs).sort(function(a,b){return rs[b]-rs[a]}),mx=rk.length?rs[rk[0]]:1;
  var sk=Object.keys(sub).sort(function(a,b){return sub[b]-sub[a]}),ms=sk.length?sub[sk[0]]:1;
  h+='<div class="cols"><div><h3>What got in the way</h3>'+(rk.length?'<ul class="hbars">'+rk.map(function(k){return '<li><span>'+esc(k)+'</span><i style="width:'+Math.round(rs[k]/mx*100)+'%"></i><b>'+rs[k]+'</b></li>'}).join("")+'</ul>':'<p class="muted small">No reasons logged in this period.</p>')+'</div>'+
    '<div><h3>Hours by subject</h3>'+(sk.length?'<ul class="hbars s">'+sk.map(function(k){return '<li><span>'+esc(k)+'</span><i style="width:'+Math.round(sub[k]/ms*100)+'%"></i><b>'+r1(sub[k])+' h</b></li>'}).join("")+'</ul><p class="muted small">Hours are split evenly across the subjects ticked that day.</p>':'<p class="muted small">Tick subjects in your log to see this.</p>')+'</div></div>';
  h+='<details><summary>All entries in this period ('+L.length+')</summary><div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Day</th><th>Hours</th><th class="hide-sm">Subjects</th><th>Reason</th><th class="hide-sm">Notes</th></tr></thead><tbody>'+
    L.map(function(r){var st=(LOG_STATUS.filter(function(x){return x[0]===r.status})[0]||["",""])[1];return '<tr class="click" data-log="'+r.date+'" tabindex="0"><td>'+fd(r.date)+'</td><td><span class="tag '+({full:"good",partial:"warn",none:"bad"})[r.status]+'">'+esc(st)+'</span></td><td class="num">'+(r.hours==null?"–":r.hours)+'</td><td class="hide-sm">'+esc((r.subjects||[]).join(", "))+'</td><td>'+esc((r.reasons||[]).join(", "))+'</td><td class="hide-sm">'+esc(r.note||r.covered||"")+'</td></tr>'}).join("")+'</tbody></table></div><p class="muted small">Tap a row to edit it.</p></details>';
  return h+'</section>';
}
function bindLog(){
  qsa("[data-log]").forEach(function(b){b.onclick=function(){logDialog(b.dataset.log)}});
  qsa("[data-lr]").forEach(function(b){b.onclick=function(){VIEW.logRange=b.dataset.lr==="all"?"all":+b.dataset.lr;render()}});
}

/* Shankar Prestorming results (GS and CSAT together) for the dashboard */
function shankarSection(){
  var T=testMarks().filter(function(t){return t.marks!=null&&t.marks!==""}).map(function(t){var d=TESTBYKEY[t.k]||{};return Object.assign({},t,{csat:d.csat||t.subject==="CSAT",kind:d.kind||((t.subject==="CSAT"?"CSAT ":"")+(t.type==="mock"?"mock":"weekly")),p:pct(+t.marks,+t.max||200)})}).sort(function(a,b){return a.date<b.date?-1:1});
  var h='<section class="panel" id="shankar-sec"><h2>Shankar Prestorming tests</h2>';
  if(!T.length)return h+'<p class="empty">Enter your Shankar GS and CSAT marks in the Scores tab to see them here.</p></section>';
  var gs=T.filter(function(t){return !t.csat}),cs=T.filter(function(t){return t.csat});
  var avg=function(a){return a.length?r1(a.reduce(function(s,t){return s+t.p},0)/a.length)+"%":"–"};
  h+='<dl class="kpis"><div><dt>GS tests entered</dt><dd>'+gs.length+'</dd><dd class="sub">Average '+avg(gs)+'</dd></div><div><dt>CSAT tests entered</dt><dd>'+cs.length+'</dd><dd class="sub">Average '+avg(cs)+'</dd></div><div><dt>Latest GS</dt><dd>'+(gs.length?r1(gs[gs.length-1].p)+"%":"–")+'</dd></div><div><dt>Latest CSAT</dt><dd>'+(cs.length?r1(cs[cs.length-1].p)+"%":"–")+'</dd>'+(cs.length?'<dd class="sub">'+(cs[cs.length-1].p>=33?"Qualifies":"Below 33%")+'</dd>':'')+'</div></dl>';
  h+='<div class="chartwrap" id="shankarchart"></div>';
  h+='<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Test</th><th>Paper</th><th>Marks</th><th>%</th><th class="hide-sm">Right</th><th class="hide-sm">Wrong</th><th class="hide-sm">Rank</th></tr></thead><tbody>'+
    T.slice().reverse().map(function(t){return '<tr><td>'+fd(t.date)+'</td><td>'+esc(t.name)+'</td><td>'+(t.csat?"CSAT":"GS")+'</td><td class="num">'+t.marks+' / '+(t.max||200)+'</td><td class="num">'+r1(t.p)+(t.csat?(t.p>=33?' <span class="good small">qualifies</span>':' <span class="bad-t small">below 33%</span>'):'')+'</td><td class="num hide-sm">'+(t.r==null?"–":t.r)+'</td><td class="num hide-sm">'+(t.w==null?"–":t.w)+'</td><td class="num hide-sm">'+(t.rank==null?"–":t.rank)+'</td></tr>'}).join("")+'</tbody></table></div></section>';
  VIEW._shankar=T;
  return h;
}
function drawShankar(){
  var el=$("shankarchart"),T=VIEW._shankar;if(!el||!T||!T.length)return;
  var rows=T.map(function(t){return {date:t.date,p:t.p,marks:t.marks,max:t.max||200,title:t.name,src:t.csat?"csat":"gs",r:t.r,w:t.w}});
  var W=Math.max(300,el.clientWidth||640),H=W<520?210:240,pl=38,pr=14,pt=14,pb=26;
  var d0=dayNum(CFG.START)-8,d1=dayNum(CFG.PRELIMS);
  var X=function(ds){return pl+(dayNum(ds)-d0)/(d1-d0)*(W-pl-pr)},Y=function(p){return pt+(1-Math.max(0,Math.min(100,p))/100)*(H-pt-pb)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="Shankar test scores over time">';
  [0,25,50,75,100].forEach(function(p){s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(p)+'" y2="'+Y(p)+'"/><text class="axis" x="'+(pl-6)+'" y="'+(Y(p)+4)+'" text-anchor="end">'+p+'</text>'});
  for(var m=0;m<8;m++){var y=2026+Math.floor((9+m)/12),mm=(9+m)%12,ds=y+"-"+pad(mm+1)+"-01";if(dayNum(ds)<d0)continue;s+='<text class="axis" x="'+X(ds)+'" y="'+(H-7)+'" text-anchor="middle">'+MON[mm]+'</text>'}
  s+='<line class="qual" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(33)+'" y2="'+Y(33)+'"/><text class="qualtxt" x="'+(W-pr)+'" y="'+(Y(33)-5)+'" text-anchor="end">CSAT qualifying 33%</text>';
  ["gs","csat"].forEach(function(g){var rs=rows.filter(function(r){return r.src===g});if(!rs.length)return;
    if(rs.length>1)s+='<polyline class="ln '+(g==="gs"?"shankar":"csat")+'" points="'+rs.map(function(r){return X(r.date).toFixed(1)+","+Y(r.p).toFixed(1)}).join(" ")+'"/>';
    rs.forEach(function(r){s+='<circle class="pt '+(g==="gs"?"shankar":"csat")+'" cx="'+X(r.date).toFixed(1)+'" cy="'+Y(r.p).toFixed(1)+'" r="4.5" tabindex="0"><title>'+esc(fdy(r.date)+": "+r.title+", "+r.marks+" / "+r.max+" ("+r1(r.p)+"%)")+'</title></circle>'})});
  el.innerHTML=s+'</svg><div class="legend"><span><i class="lg shankar"></i>GS tests</span><span><i class="lg csat"></i>CSAT tests</span></div>';
}

/* Monthly current affairs: month cards, the daily 25, and the Read-the-notes viewer */
var NOTES={},NV=null;
var CAM_MONTHS=(function(){var o=[];for(var y=2026,m=0;y<2027||m<=3;){o.push(y+"-"+pad(m+1));m++;if(m>11){m=0;y++}if(y===2027&&m>3)break}return o})();
function monthLabel(k){var p=k.split("-");return MONTHS[+p[1]-1]+" "+p[0]}
function monthShort(k){var p=k.split("-");return MON[+p[1]-1]+" "+p[0].slice(2)}
function camOfMonth(k){return camSets().filter(function(s){return s.month===k})}
function loadNotes(id){
  if(NOTES[id])return Promise.resolve(NOTES[id]);
  return fetch("data/notes/"+encodeURIComponent(id)+".json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(d){NOTES[id]=d;return d});
}
function notesRead(id){return ((DB.meta.nr||{})[id])||0}
function bestScore(id){var b=null;attempts().forEach(function(a){if(a.setId===id&&!a.part&&(b==null||a.pts>b.pts))b=a});return b}

/* one row for a monthly set: notes button and test button */
function camSetRow(s,showMonth){
  var run=DB.recs["run_"+s.id];run=run&&!run.del?run:null;
  var b=bestScore(s.id),nr=notesRead(s.id);
  var act=run?'<button class="btn primary small" data-resume="run_'+s.id+'">Resume ('+run.done+'/'+run.n+')</button>':'<button class="btn '+(b?"":"primary ")+'small" data-start="'+s.id+'">'+(b?"Take again":"Start test")+'</button>';
  return '<li class="setrow"><div class="setmain"><div><span class="muted small">'+(showMonth?monthLabel(s.month)+', ':'')+esc(s.dayLabel||"")+' · 25 questions</span><b>'+esc(s.category)+'</b>'+
    '<span class="small '+(b?"good":"muted")+'">'+(b?'Best '+b.pts+' of '+(s.n*2)+'. ':'')+'Notes: '+(nr?nr+' of 25 pages read':'not read yet')+'</span></div>'+
    '<div class="row wrap tight"><button class="btn small" data-notes="'+s.id+'">Read notes</button>'+act+'</div></div></li>';
}
/* Practice tab: current affairs by month */
function camPanel(){
  var sel=VIEW.camMonth;
  if(!sel){var ready=CAM_MONTHS.filter(function(k){return camOfMonth(k).length});var open=ready.filter(function(k){var d=setDoneMap();return camOfMonth(k).some(function(s){return !d[s.id]})});sel=open[0]||ready[ready.length-1]||CAM_MONTHS[0]}
  var done=setDoneMap();
  var chips=CAM_MONTHS.map(function(k){var n=camOfMonth(k).length,d=camOfMonth(k).filter(function(s){return done[s.id]}).length;
    return '<button class="chipbtn" data-cm="'+k+'" aria-pressed="'+(k===sel)+'"'+(n?'':' style="opacity:.7"')+'>'+monthShort(k)+'<span>'+(n?d+'/'+n:'soon')+'</span></button>'}).join("");
  var sets=camOfMonth(sel),body;
  if(sets.length){
    body='<ul class="list">'+sets.map(function(s){return camSetRow(s,false)}).join("")+'</ul>'+
      (sets.length>=6?'<div class="row wrap"><button class="btn" id="cm-full">Full '+MONTHS[+sel.split("-")[1]-1]+' test (100 questions, timed)</button><span class="muted small">100 questions drawn from all six sets.</span></div>':'');
  }else{
    var past=sel<"2026-11";
    body='<p class="muted">'+(past?'The '+monthLabel(sel)+' questions and notes are being prepared and will appear here.':monthLabel(sel)+' will be added after the month ends, once its magazine is out. The space is kept ready.')+'</p>';
  }
  return '<section class="panel" id="cam-panel"><h2>Current affairs by month</h2><p class="muted small">Each month has six sets of 25 questions, one for each area (polity, economy, international relations and defence, environment, science and tech, schemes and reports). Every set has a Read-the-notes booklet: one page for each question. Read first, or test first and read after. The daily 25 on the Today tab takes the next set in month order.</p>'+
    '<div class="chips mchips" role="group" aria-label="Month">'+chips+'</div>'+body+'</section>';
}
function bindCam(){
  qsa("[data-cm]").forEach(function(b){b.onclick=function(){VIEW.camMonth=b.dataset.cm;render()}});
  qsa("[data-notes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.notes,1,"tabs")}});
  if($("cm-full"))$("cm-full").onclick=function(){
    var k=VIEW.camMonth,qids=[];camOfMonth(k).forEach(function(s){for(var i=0;i<s.n;i++)qids.push(s.id+"#"+i)});
    startCustom({type:"cam",title:monthLabel(k)+" full test (100 questions)",subject:"Current Affairs",qids:pickPart(qids,100),timed:true});
  };
}
/* the daily 25 row, shown on the Today tab for each day from 31 Oct 2026 */
function camRow(ds,td){
  if(ds>td)return '<li><div><span class="muted small">Current affairs, 25 questions</span><b>The next set is chosen on the day</b></div></li>';
  var nx=nextCamSet(),dn=camDoneOn(ds),lab='<span class="muted small">Daily current affairs, 25 questions</span>';
  var notesBtn=nx?'<button class="btn small" data-notes="'+nx.id+'">Read notes</button>':'';
  var act;
  if(nx){var run=DB.recs["run_"+nx.id];run=run&&!run.del?run:null;
    act=run?'<button class="btn primary small" data-resume="run_'+nx.id+'">Resume ('+run.done+'/'+run.n+')</button>':'<button class="btn '+(dn?"":"primary ")+'small" data-start="'+nx.id+'">'+(dn?"Do the next set":"Start")+'</button>';
    return '<li class="setrow"><div class="setmain"><div>'+lab+'<b>'+esc(monthLabel(nx.month))+': '+esc(nx.category)+'</b>'+(dn?'<span class="good small">'+(ds===td?"Done for today":"Done on this day")+'</span>':'<span class="muted small">Next unused set in month order</span>')+'</div><div class="row wrap tight">'+notesBtn+act+'</div></div></li>';
  }
  return '<li class="setrow"><div class="setmain"><div>'+lab+'<b>Current affairs revision</b>'+(dn?'<span class="good small">Done for today</span>':'<span class="muted small">All new sets are done. This mixes your past mistakes with news you have not seen lately.</span>')+'</div><div class="row wrap tight"><button class="btn '+(dn?"":"primary ")+'small" id="cam-rev">'+(dn?"Another revision set":"Start")+'</button></div></div></li>';
}
function startCamRevision(){
  var pool=poolFor("Current Affairs");if(pool.length<25){toast("Not enough current affairs questions yet.");return}
  startCustom({type:"cam",title:"Current affairs revision, "+fd(today()),subject:"Current Affairs",qids:pickPart(pool,25),timed:!!DB.meta.timed});
}

/* ===== Read-the-notes viewer ===== */
function openNotes(id,page,from){
  stopPlayer(true);
  $("app").innerHTML='<div class="page"><p class="muted">Loading the notes…</p></div>';
  loadNotes(id).then(function(d){
    VIEW.screen="notes";
    NV={id:id,d:d,i:Math.max(0,Math.min(d.pages.length-1,(page||1)-1)),from:from||"tabs",tok:0,auto:false};
    renderNotes();window.scrollTo(0,0);
  }).catch(function(){VIEW.screen=from==="result"?"result":"tabs";if(from==="result")renderResult(false);else render();toast("Could not load the notes. Check your connection and try again.")});
}
function noteSpeechList(p){
  var out=[p.headline+".",p.when?"When: "+p.when+".":""].concat(chunks(readable(p.what)));
  out.push("Key points.");(p.key||[]).forEach(function(k){out=out.concat(chunks(readable(k)))});
  if(p.static){out.push("Static link.");out=out.concat(chunks(readable(p.static)))}
  if(p.angle){out.push("Prelims angle.");out=out.concat(chunks(readable(p.angle)))}
  if(p.remember){out.push("Remember.");out=out.concat(chunks(readable(p.remember)))}
  return out.filter(Boolean);
}
function noteStop(){if(!NV)return;NV.tok++;NV.auto=false;if(ttsOk())window.speechSynthesis.cancel()}
function noteSpeak(){
  if(!ttsOk()){toast("This device cannot read text aloud.");return}
  var tok=++NV.tok;window.speechSynthesis.cancel();NV.auto=true;
  var list=noteSpeechList(NV.d.pages[NV.i]),j=0;
  var nx=function(){
    if(!NV||tok!==NV.tok)return;
    if(j>=list.length){setTimeout(function(){if(!NV||tok!==NV.tok)return;if(NV.i<NV.d.pages.length-1){NV.i++;renderNotes();noteSpeak()}else{NV.auto=false;renderNotes()}},900);return}
    var u=new SpeechSynthesisUtterance(list[j++]);u.rate=DB.meta.ttsRate||1;var v=pickVoice();if(v){u.voice=v;u.lang=v.lang}else u.lang="en-IN";
    u.onend=nx;u.onerror=function(e){if(e.error==="interrupted"||e.error==="canceled")return;nx()};window.speechSynthesis.speak(u);
  };
  renderNotes();nx();
}
function noteGo(i){
  if(!NV||i<0||i>=NV.d.pages.length)return;
  var was=NV.auto;noteStop();NV.i=i;renderNotes();window.scrollTo(0,0);if(was)noteSpeak();
}
function renderNotes(){
  var d=NV.d,p=d.pages[NV.i],n=d.pages.length,s=SET[NV.id]||{};
  var nr=DB.meta.nr=DB.meta.nr||{};if((nr[NV.id]||0)<NV.i+1){nr[NV.id]=NV.i+1;saveStore()}
  var idx=(d.index||[]).map(function(g){return '<button class="chipbtn" data-pg="'+g.pages[0]+'" aria-pressed="'+(g.pages.indexOf(p.n)>=0)+'">'+esc(g.t)+'<span>'+g.pages.length+'</span></button>'}).join("");
  var dots='<div class="npbar" aria-hidden="true"><i style="width:'+Math.round((NV.i+1)/n*100)+'%"></i></div>';
  var key=(p.key||[]).map(function(k){return '<li>'+esc(k)+'</li>'}).join("");
  var last=NV.i===n-1;
  $("app").innerHTML='<div class="page notes"><div class="pagehead"><button class="btn ghost" id="nt-back">Back</button><div><h1>'+esc(d.title||s.title||"Notes")+'</h1><p class="muted">Read the notes · page '+p.n+' of '+n+'</p></div></div>'+
    '<div class="chips" role="group" aria-label="Topics in this set">'+idx+'</div>'+dots+
    '<section class="panel notecard" id="nt-card" aria-live="polite"><div class="row between wrap"><span class="chip">'+esc(p.t)+'</span><span class="muted small">'+esc(p.when||"")+'</span></div>'+
    '<h2 class="nh">'+esc(p.headline)+'</h2><p>'+esc(p.what)+'</p>'+(key?'<h3>Key points</h3><ul class="nkey">'+key+'</ul>':'')+
    (p.static?'<h3>Static link</h3><p>'+esc(p.static)+'</p>':'')+(p.angle?'<h3>Prelims angle</h3><p>'+esc(p.angle)+'</p>':'')+
    (p.remember?'<div class="nrem"><b>Remember</b> '+esc(p.remember)+'</div>':'')+'</section>'+
    '<div class="notenav"><button class="btn" id="nt-prev"'+(NV.i===0?" disabled":"")+'>Previous</button><button class="btn" id="nt-listen">'+(NV.auto?"Stop reading":"Listen")+'</button>'+
    (last?'<button class="btn primary" id="nt-test">Test this set</button>':'<button class="btn primary" id="nt-next">Next</button>')+'</div>'+
    '<p class="muted small center">Swipe left or right, or use the buttons. Pages open where you left off.</p></div>';
  $("nt-back").onclick=function(){noteStop();if(NV.from==="result"){VIEW.screen="result";renderResult(false);window.scrollTo(0,0)}else{VIEW.screen="tabs";render()}};
  if($("nt-prev"))$("nt-prev").onclick=function(){noteGo(NV.i-1)};
  if($("nt-next"))$("nt-next").onclick=function(){noteGo(NV.i+1)};
  if($("nt-test"))$("nt-test").onclick=function(){noteStop();VIEW.screen="tabs";startSet(NV.id,!!DB.meta.timed)};
  $("nt-listen").onclick=function(){if(NV.auto){noteStop();renderNotes()}else noteSpeak()};
  qsa("[data-pg]").forEach(function(b){b.onclick=function(){noteGo(+b.dataset.pg-1)}});
  var c=$("nt-card"),x0=null,y0=null;
  c.addEventListener("touchstart",function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  c.addEventListener("touchend",function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)noteGo(NV.i+(dx<0?1:-1))},{passive:true});
}
document.addEventListener("keydown",function(e){
  if(VIEW.screen!=="notes"||!NV)return;
  if(e.key==="ArrowRight")noteGo(NV.i+1);else if(e.key==="ArrowLeft")noteGo(NV.i-1);
});
/* result screen: pages to re-read for the questions that were missed */
function notesAfterTest(a,qs){
  var byQ={};qs.forEach(function(q){byQ[q.qid]=q});
  var miss={},sets={};
  (a.items||[]).forEach(function(x){var q=byQ[x[0]];if(!q||!q.pg||String(x[0]).indexOf("CAM26-")!==0)return;var sid=x[0].split("#")[0];sets[sid]=1;if(x[4]!==1&&x[4]!==2)(miss[sid]=miss[sid]||[]).push(q.pg)});
  var ids=Object.keys(sets);if(!ids.length)return "";
  return '<section class="panel"><h2>Read the notes</h2>'+ids.map(function(sid){
    var st=SET[sid]||{},m=(miss[sid]||[]).sort(function(x,y){return x-y});
    return '<div class="row between wrap" style="margin:8px 0"><div><b>'+esc(st.title||sid)+'</b><br><span class="muted small">'+(m.length?m.length+' to re-read: pages '+m.join(", "):'No missed questions in this set.')+'</span></div><div class="row wrap tight">'+
      (m.length?'<button class="btn small" data-notes-pg="'+sid+'|'+m[0]+'">Open page '+m[0]+'</button>':'')+'<button class="btn small" data-notes-pg="'+sid+'|1">All pages</button></div></div>'}).join("")+'</section>';
}
function bindNotesAfterTest(){
  qsa("[data-notes-pg]").forEach(function(b){b.onclick=function(){var p=b.dataset.notesPg.split("|");openNotes(p[0],+p[1],"result")}});
  qsa("[data-note]").forEach(function(b){b.onclick=function(){var qid=b.dataset.note,q=(RES&&RES.qs||[]).filter(function(x){return x.qid===qid})[0];if(q)openNotes(qid.split("#")[0],q.pg||1,"result")}});
}

/* boot */
function boot(){
  loadStore();
  var h=location.hash.replace("#","");if(["today","practice","dash","scores"].indexOf(h)>=0)VIEW.tab=h;
  fetch("data/manifest.json").then(function(r){return r.json()}).then(function(m){
    indexManifest(m);migrateOld();render();
    if(syncCfg().url)setTimeout(sync,800);
  }).catch(function(){
    $("app").innerHTML='<div class="page"><h1>Prelims Arena</h1><p>The question bank could not be loaded. Connect to the internet once so this device can store it for offline use.</p></div>';
  });
  if("serviceWorker" in navigator&&location.protocol!=="file:"){
    navigator.serviceWorker.register("sw.js").then(function(reg){
      reg.addEventListener("updatefound",function(){var w=reg.installing;if(!w)return;w.addEventListener("statechange",function(){
        if(w.state==="installed"&&navigator.serviceWorker.controller)showUpdate(w);
      })});
      if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);
    }).catch(function(){});
    var reloading=false;navigator.serviceWorker.addEventListener("controllerchange",function(){if(reloading)return;reloading=true;location.reload()});
  }
  setInterval(function(){if(syncCfg().url&&pendingCount()&&navigator.onLine!==false&&!QZ)sync()},120000);
}
function showUpdate(worker){
  var b=$("updbar");if(b)return;b=document.createElement("div");b.id="updbar";b.className="updbar";
  b.innerHTML='<span>New questions or improvements are ready.</span><button class="btn small primary">Reload</button>';
  b.querySelector("button").onclick=function(){if(QZ){noteTime();saveRun(true)}saveStore(true);if(worker)worker.postMessage("skip");else location.reload()};
  document.body.appendChild(b);
}
boot();

