var GAS_SCRIPT="/* Prelims Arena v2: Google Sheet sync script.\n   Setup:\n   1) In a new Google Sheet: Extensions > Apps Script. Delete the sample code and paste this whole script.\n   2) Change the passphrase on the next line. Use the same passphrase in the app.\n   3) Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone > Deploy. Allow access.\n   4) Copy the Web app URL into the app: Scores tab > Google Sheet sync.\n   Your daily study log appears in the \"Study log\" tab.\n   You can type your own questions in the \"My questions\" tab. Answer column takes A, B, C or D. Leave the id column empty. */\nvar KEY = 'change-this-passphrase';\n\nvar T_RES = 'Quiz results', T_TEST = 'Test marks', T_MYQ = 'My questions', T_DATA = 'App data', T_LOG = 'Study log';\nvar H_RES = ['id','date','type','title','subject','questions','right','wrong','skipped','marks','max','percent','accuracy','minutes','scheduled','set','ts','record'];\nvar H_TEST = ['id','name','type','subject','date','marks','max','percent','right','wrong','rank','ts','deleted'];\nvar H_MYQ = ['id','subject','unit','question','option A','option B','option C','option D','answer','explanation','source','ts','deleted'];\nvar H_DATA = ['id','kind','ts','record'];\nvar H_LOG = ['id','date','day','hours','subjects','covered','reasons','shankar test','notes','ts','deleted'];\nvar LOG_ST = {full: 'Studied as planned', partial: 'Studied partly', none: 'Could not study'};\n\nfunction sheet_(name, h) {\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n  var s = ss.getSheetByName(name);\n  if (!s) { s = ss.insertSheet(name); s.appendRow(h); s.setFrozenRows(1); s.getRange(1, 1, 1, h.length).setFontWeight('bold'); }\n  return s;\n}\nfunction rows_(s, w) { var n = s.getLastRow(); return n > 1 ? s.getRange(2, 1, n - 1, w).getValues() : []; }\nfunction idx_(rows) { var m = {}; rows.forEach(function (r, i) { if (r[0] !== '') m[String(r[0])] = i; }); return m; }\nfunction out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }\nfunction d_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v); }\nfunction n_(v) { return v === '' || v == null ? null : Number(v); }\nfunction L_(i) { return ['A', 'B', 'C', 'D'][i] || ''; }\n\nfunction doPost(e) {\n  var lock = LockService.getScriptLock(); lock.waitLock(25000);\n  try {\n    var b = JSON.parse(e.postData.contents);\n    if (b.key !== KEY) return out_({error: 'wrong passphrase'});\n    var res = sheet_(T_RES, H_RES), tst = sheet_(T_TEST, H_TEST), myq = sheet_(T_MYQ, H_MYQ), dat = sheet_(T_DATA, H_DATA);\n    var resIdx = idx_(rows_(res, 1));\n    var tRows = rows_(tst, H_TEST.length), tIdx = idx_(tRows);\n    var qRows = rows_(myq, H_MYQ.length), qIdx = idx_(qRows);\n    var dRows = rows_(dat, H_DATA.length), dIdx = idx_(dRows);\n    var lg = sheet_(T_LOG, H_LOG), lRows = rows_(lg, H_LOG.length), lIdx = idx_(lRows);\n    var newRes = [];\n    (b.recs || []).forEach(function (r) {\n      var ts = Number(r.ts) || 0;\n      if (r.kind === 'att') {\n        if (r.id in resIdx) return;\n        resIdx[r.id] = -1;\n        var att = r.r + r.w;\n        newRes.push([r.id, r.date, r.type, r.title, r.subject, r.n, r.r, r.w, r.sk, r.pts, r.max,\n          r.max ? Math.round(r.pts / r.max * 1000) / 10 : '', att ? Math.round(r.r / att * 1000) / 10 : '',\n          Math.round((r.sec || 0) / 6) / 10, r.sched || '', r.setId || '', ts, JSON.stringify(r)]);\n      } else if (r.kind === 'test') {\n        var row = [r.id, r.name || '', r.type || '', r.subject || '', r.date || '', r.marks == null ? '' : r.marks, r.max == null ? '' : r.max,\n          (r.marks != null && r.max) ? Math.round(r.marks / r.max * 1000) / 10 : '', r.r == null ? '' : r.r, r.w == null ? '' : r.w, r.rank == null ? '' : r.rank, ts, r.del ? 'yes' : ''];\n        upsert_(tst, tRows, tIdx, row, 11);\n      } else if (r.kind === 'myq') {\n        var o = r.o || [];\n        var row2 = [r.id, r.sub || '', r.u || '', r.q || '', o[0] || '', o[1] || '', o[2] || '', o[3] || '', L_(r.a), r.e || '', r.src || '', ts, r.del ? 'yes' : ''];\n        upsert_(myq, qRows, qIdx, row2, 11);\n      } else if (r.kind === 'log') {\n        upsert_(lg, lRows, lIdx, [r.id, r.date || '', LOG_ST[r.status] || '', r.hours == null ? '' : r.hours, (r.subjects || []).join(', '), r.covered || '',\n          (r.reasons || []).join(', '), r.test === 'yes' ? 'taken' : (r.test === 'no' ? 'missed' : ''), r.note || '', ts, r.del ? 'yes' : ''], 9);\n      } else {\n        upsert_(dat, dRows, dIdx, [r.id, r.kind, ts, JSON.stringify(r)], 2);\n      }\n    });\n    if (newRes.length) res.getRange(res.getLastRow() + 1, 1, newRes.length, H_RES.length).setValues(newRes);\n    if (newRes.length) res.getRange(2, 1, res.getLastRow() - 1, H_RES.length).sort([{column: 2, ascending: true}, {column: 17, ascending: true}]);\n    return out_({ok: true});\n  } finally { lock.releaseLock(); }\n}\nfunction upsert_(s, rows, idx, row, tsCol) {\n  var id = String(row[0]);\n  if (id in idx) {\n    var i = idx[id];\n    if ((Number(row[tsCol]) || 0) >= (Number(rows[i][tsCol]) || 0)) { s.getRange(i + 2, 1, 1, row.length).setValues([row]); rows[i] = row; }\n  } else { s.appendRow(row); rows.push(row); idx[id] = rows.length - 1; }\n}\nfunction doGet(e) {\n  if ((e.parameter.key || '') !== KEY) return out_({error: 'wrong passphrase'});\n  var out = [];\n  rows_(sheet_(T_RES, H_RES), H_RES.length).forEach(function (r) {\n    try { var o = JSON.parse(r[17]); o.id = String(r[0]); o.ts = Number(r[16]) || o.ts; out.push(o); } catch (err) {}\n  });\n  rows_(sheet_(T_TEST, H_TEST), H_TEST.length).forEach(function (r) {\n    out.push({id: String(r[0]), kind: 'test', name: r[1], type: r[2], subject: r[3], date: d_(r[4]), marks: n_(r[5]), max: n_(r[6]), r: n_(r[8]), w: n_(r[9]), rank: n_(r[10]), ts: Number(r[11]) || 0, del: r[12] === 'yes', k: String(r[0]).replace(/^test_/, '')});\n  });\n  var q = sheet_(T_MYQ, H_MYQ), qRows = rows_(q, H_MYQ.length);\n  qRows.forEach(function (r, i) {\n    if (r[3] === '') return;\n    if (r[0] === '') { // typed by hand in the Sheet: give it an id\n      r[0] = 'myq_s' + Utilities.getUuid().slice(0, 8); r[11] = Date.now();\n      q.getRange(i + 2, 1).setValue(r[0]); q.getRange(i + 2, 12).setValue(r[11]);\n    }\n    var a = ['A', 'B', 'C', 'D'].indexOf(String(r[8]).trim().toUpperCase());\n    out.push({id: String(r[0]), kind: 'myq', sub: String(r[1] || 'Polity'), u: String(r[2] || 'My questions'), q: String(r[3]), o: [String(r[4]), String(r[5]), String(r[6]), String(r[7])], a: a < 0 ? 0 : a, e: String(r[9] || ''), src: String(r[10] || ''), ts: Number(r[11]) || 0, del: r[12] === 'yes', fromSheet: true});\n  });\n  var stBack = {}; Object.keys(LOG_ST).forEach(function (k) { stBack[LOG_ST[k]] = k; });\n  var split = function (v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); };\n  rows_(sheet_(T_LOG, H_LOG), H_LOG.length).forEach(function (r) {\n    if (r[0] === '') return;\n    out.push({id: String(r[0]), kind: 'log', date: d_(r[1]), status: stBack[r[2]] || 'partial', hours: n_(r[3]), subjects: split(r[4]), covered: String(r[5] || ''),\n      reasons: split(r[6]), test: r[7] === 'taken' ? 'yes' : (r[7] === 'missed' ? 'no' : null), note: String(r[8] || ''), ts: Number(r[9]) || 0, del: r[10] === 'yes'});\n  });\n  rows_(sheet_(T_DATA, H_DATA), H_DATA.length).forEach(function (r) {\n    try { var o = JSON.parse(r[3]); o.id = String(r[0]); o.ts = Number(r[2]) || 0; out.push(o); } catch (err) {}\n  });\n  return out_({recs: out});\n}\n";
/* Prelims Arena v2 — core: config, helpers, store */
"use strict";
var CFG={
  START:"2026-10-18", PRELIMS:"2027-05-23", IDEAL_END:"2027-05-16", GOAL:90, RIGHT:2, WRONG:0.66,
  SEC_PER_Q:72, PYQ_SHARE:0.3, PYQ_HOLD:[2024,2025,2026], CSAT_MK:[2.5,0.83], CSAT_PASS:33, STORE:"pa2-store", OLD:"prelims-arena-v3", OLD_SYNC:"prelims-arena-sync-v1",
  MOCK_WEIGHTS:{"Polity":15,"History":15,"Geography":12,"Economy":14,"Environment":14,"Science & Tech":12,"Current Affairs":18},
  REVIEW_DAYS:[1,3,7,21], CAM_FROM:"2026-10-30"
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
// Shankar Prestorming Batch II (Anna Nagar) 2026-27: topics per test, from the brochure.
// o = orientation class date, oc = orientation includes a current-affairs class, ca = current-affairs coverage, a = heading, t = topics
var SHK={
T1:{o:"2026-10-10",oc:1,ca:"Subject related",a:"World Physical & Human Geography",t:["Origin of Universe","Evolution of Earth","Earth's Structure","Volcanoes and Earthquakes","Continents and Ocean Basins","Earth Movements","Mountains, Plateaus, Plains and Lakes","Rocks, Soils and Minerals","Drainage System and Pattern","Various Landforms","Reliefs of Ocean Basins","Temperature and Salinity of Ocean","Ocean Deposits","Ocean tides and Currents","Coral Reefs","Marine Resources","Structure and Composition of Atmosphere","Insolation and Heat Budget of Atmosphere","Temperature and its Distribution","Atmospheric Pressure","Wind System","Humidity and Precipitation","Frontogenesis and cyclones","World Climatic Regions (location, distribution, climate, vegetation, wildlife, people and economic activities)"]},
T2:{o:"2026-10-18",oc:1,ca:"Subject related",a:"Indian Polity 1",t:["Historical Background","Preamble","Union & its Territory","Citizenship","Fundamental Rights","Directive Principles","Fundamental Duties","Justice Administration, Law Enforcement & Statutory Frameworks","Constitutional Amendment & Basic Structure Doctrine"]},
T3:{o:"2026-10-25",oc:0,ca:"",a:"Indian History - Modern India 1",t:["Arrival of Europeans","Early English Wars - Carnatic, Plassey, Buxar, Maratha and Mysore Wars","Early Structure of British Empire","Constitutional Developments (from 1772 to 1858)","Governor Generals (from Robert Clive to Lord Dalhousie) and their administration, reforms, etc.","Administration during Company period (civil services, judiciary, police, education policy, famine policy, press regulation, etc.)","Tribal and Peasant Uprisings till 1857","Revolt of 1857","Socio-Religious Reform Movements (entirely)"]},
T4:{o:"2026-11-01",oc:1,ca:"Jan to Mar 2026",a:"Current Affairs Test 1",t:[]},
T5:{o:"2026-11-15",oc:1,ca:"Subject related",a:"Economics 1",t:["National Income","Growth and Development","Public Finance","Money","Inflation","Banking (including RBI's policies)","External Sector","Financial Markets"]},
T6:{o:"2026-11-22",oc:1,ca:"Subject related",a:"Science & Technology I",t:["General Science and Basics from NCERT","Space Technology","Deep Space Missions","Astrophysics","Nuclear Science","Energy Technologies"]},
T7:{o:"2026-11-29",oc:1,ca:"Subject related",a:"Environment I",t:["Principles of Ecology","Ecosystem Functioning","Ecosystem Types - Terrestrial & Aquatic Ecosystem","Biodiversity Concepts","Indian Biodiversity conservation - In-situ & Ex-situ methods","Indian Biodiversity - Major Flora & Fauna, Institutions, Acts & Policies","Biodiversity - India & International organisation, Conventions & Protocol"]},
T8:{o:"2026-12-06",oc:1,ca:"Apr to Jun 2026",a:"Current Affairs Test 2",t:[]},
T9:{o:"2026-12-13",oc:1,ca:"Subject related",a:"Geography - Indian Geography",t:["Geological Structure","Physiography","Drainage","Climate","Natural Vegetation and Wildlife","Soils","Population","Resources","Industries","Transport","Trade and Other Economic Activities"]},
T10:{o:"2026-12-20",oc:1,ca:"Subject related",a:"Indian Polity II",t:["Union & State Executive","Union & State Legislatures","Supreme Court, High Court & Subordinate Courts","Union Territories"]},
T11:{o:"2026-12-27",oc:0,ca:"",a:"Indian History - Modern India II",t:["Pre-Congress Political Parties; Indian National Congress - early leaders and their contributions","Phase of Moderates and Extremists","Swadeshi Movement","Period of Revolutionary Movements","Arrival of Gandhi, his early successes in South Africa and his early experiments in India","Non-Cooperation Movement & Temple Entry Movements","Civil Disobedience Movements","Developments to Government of India Act 1935 (Simon Commission, Round Table Conference, Poona Pact)","1937 Election and Formation of Congress Ministries in Provinces","Transfer of Power issues (from 1940 to 1947)","Rise of Capitalism and Rise of Trade Union Movements","Rise of Communalism","Other Political Parties during National Movement","Famous Personalities and their Contributions","Constitutional Developments & British Administration after 1857","Tribal and Peasant Uprisings after 1857"]},
T12:{o:"2027-01-03",oc:1,ca:"Jul to Sep 2026",a:"Current Affairs Test 3",t:[]},
T13:{o:"2027-01-10",oc:1,ca:"Subject related",a:"Economics II",t:["Planning","Industry","Agriculture","Infrastructure","Service Sector","Schemes (Current Affairs)","Social Sector (special focus on Skill Development, Employment & Poverty)","Contemporary Economic issues in India and the World"]},
T14:{o:"2027-01-24",oc:1,ca:"Subject related",a:"Science & Technology II",t:["General Science","Electronics","Information Technology","Defence Technology","Biotechnology","Nano technology","Intellectual Property Rights"]},
T15:{o:"2027-01-31",oc:1,ca:"Subject related",a:"Environment II",t:["Pollution - Air, Water, Solid waste, Hazardous chemical & Heavy metals","Pollution - India control measures & International conventions","Climate Change - Concepts, causes, effects, mitigation strategies","India and International climate change negotiations","Environmental degradation - Impact on human health & Biodiversity","Sustainable development - India Legal framework & International institution"]},
T16:{o:"2027-02-07",oc:1,ca:"Oct to Dec 2026",a:"Current Affairs Test 4",t:[]},
T17:{o:"2027-02-14",oc:1,ca:"Subject related",a:"Indian Polity III",t:["Rural & Urban Local Bodies","Scheduled & Tribal Areas","Centre-State, Inter-State & Emergency Provisions","Special Provisions - Classes & States","Languages, Elections & Services of Union & States","Tribunals & Various Constitutional & Non-Constitutional Bodies","Rights Issues","Salient Features of the Constitution","Indian Political System","Public Policy - Core Political Governance Policies","Miscellaneous"]},
T18:{o:"2027-02-21",oc:0,ca:"",a:"Indian History III",t:["Pre History","Indus Valley Civilization","Vedic Period (early and later Vedic)","Mahajanapadas","Mauryan Period","Dark Age (300 BC to 300 AD)","Gupta Period","Post Gupta period till Harsha Vardhana","Ancient Indian religious and philosophies including Buddhism & Jainism, six philosophical schools","Early Medieval India (including Cholas)","Delhi Sultanate","Bhakthi and Sufi Movements","Regional Kingdoms of 14th and 15th Century (including Bahmani and Vijayanagar)","Mughals","Marathas","Later Mughals","Art and Culture (from Ancient Times to Modern History)","Places and Terms (related to Ancient and Medieval India)"]},
T19:{o:"2027-02-28",oc:1,ca:"Subject related",a:"Special focus areas - Social Justice, Reports, Agriculture & Map",t:["Agriculture - Geographic, Economic and Environment perspective","Map - India and World","Schemes, Acts, Policies, Reports, Rules and Regulations related to social justice and empowerment","Governance","International Reports","National and International Sports","Other Miscellaneous topics (including Historical Events)"]},
T20:{o:"2027-03-07",oc:1,ca:"Subject related + Jan 2027",a:"International Organisations",t:["United Nations (Organs, Agencies, Programmes and Funds)","Regional Organisations","Nuclear Organisations","Treaties and conventions","Ideological and Political organisations","Financial and Trade organisations","Cultural and Religious organisations","International Relations (Bilateral and Multilateral relations including Military Exercises)"]},
T21:{ca:"Complete syllabus",a:"Polity - complete syllabus",t:[]},T22:{ca:"Complete syllabus",a:"Geography - complete syllabus",t:[]},
T23:{ca:"Complete syllabus",a:"Economics - complete syllabus",t:[]},T24:{ca:"",a:"Budget & Economic Survey (online test)",t:[]},
T25:{ca:"Complete syllabus",a:"History - complete syllabus",t:[]},T26:{ca:"Complete syllabus",a:"Science & Technology - complete syllabus",t:[]},
T27:{ca:"Full test",a:"Current Affairs - full test",t:[]},T28:{ca:"Complete syllabus",a:"Environment - complete syllabus",t:[]},
MK1:{ca:"",a:"Mock Test I (online)",t:[]},MK2:{ca:"",a:"Mock Test II (online)",t:[]},
AM1:{ca:"",a:"All India Mock Test I",t:[]},AM2:{ca:"",a:"All India Mock Test II",t:[]},AM3:{ca:"",a:"All India Mock Test III",t:[]}
};
var SHK_NOTES=["General Studies tests: 2 to 4 pm, followed by a live test discussion at 4:30 pm.","CSAT tests: 2 to 4 pm; the recorded discussion is uploaded at 4:30 pm (live discussion for the complete-syllabus tests).","Tests run both offline and online. Related topics from NCERT books are covered in each test.","India Year Book is to be referred for relevant topics in every test; updated portions of IYB 2025 are covered in the mock tests.","Orientation classes are recorded and uploaded on their scheduled dates.","CSAT sectional test syllabus is shared on Shankar's Telegram channel, so it is not listed here."];
var SHK_ORIENT={};Object.keys(SHK).forEach(function(k){if(SHK[k].o)SHK_ORIENT[SHK[k].o]=k});
function shkTestNo(k){return /^T\d+$/.test(k)?"Test "+k.slice(1):""}
// card with a test's date, time, current-affairs coverage and topic list
function shkCard(t,open,lead){
  var d=SHK[t.k]||{},h='<details class="shk"'+(open?" open":"")+'><summary>'+(lead?'<span class="muted small">'+esc(lead)+'</span>':'')+'<b>'+esc(t.name)+'</b><span class="muted small">'+fdw(t.date)+', 2 to 4 pm</span></summary>';
  if(t.csat)h+='<p class="small">'+(t.type==="mock"?"Complete-syllabus CSAT test.":"CSAT sectional test.")+' The sectional syllabus is shared on Shankar\'s Telegram channel.</p>';
  if(d.a&&!t.csat)h+='<p class="small"><b>'+esc(d.a)+'</b>'+(d.ca?' · Current affairs: '+esc(d.ca):'')+'</p>';
  if(d.t&&d.t.length)h+='<ol class="shklist">'+d.t.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ol>';
  else if(!t.csat&&/^T2[1-8]$/.test(t.k))h+='<p class="muted small">Covers the whole subject; the brochure lists no separate topics.</p>';
  if(d.o)h+='<p class="muted small">Orientation'+(d.oc?' and current-affairs':'')+' class (recorded): '+fdw(d.o)+'.</p>';
  return h+'</details>';
}
function nextTests(ds,n,f){return TESTS.filter(function(t){return t.date>=ds&&(!f||f(t))}).slice(0,n||1)}
function shkSchedule(){
  var h='<h2>Shankar Prestorming schedule</h2><p class="muted small">Batch II, Anna Nagar, 2026-27. Tap a test to see its topics.</p><div class="shkall">'+TESTS.map(function(t){return shkCard(t,false,t.date<today()?"Done · ":"")}).join("")+'</div><h3>From the brochure</h3><ul class="small">'+SHK_NOTES.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul><div class="row"><button class="btn" data-m="x">Close</button></div>';
  modal(h);
}
var TYPE_LABEL={daily:"Daily",weekly:"Weekly",mock:"Mock",subject:"Subject test",ca:"Current affairs",cam:"Current affairs",capool:"Current affairs",sri:"Schemes & indices",spp:"Species & areas",fullmock:"Mock",revision:"Revision",bonus:"Daily",myq:"Mock",pyq:"UPSC paper",pyqsub:"PYQ practice",pyqmock:"PYQ mock",csatset:"CSAT practice",csatmock:"CSAT mock"};
// dashboard filter group of an attempt type
function typeGroup(t){return ({daily:"daily",bonus:"daily",ca:"ca",cam:"ca",capool:"ca",mock:"mock",fullmock:"mock",myq:"mock",subject:"subject",revision:"subject",weekly:"weekly",sri:"subject",spp:"subject",pyq:"pyq",pyqsub:"pyq",pyqmock:"pyq",csatset:"subject",csatmock:"mock"})[t]||"daily"}
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
function camDoneOn(ds){return attempts().some(function(a){return a.date===ds&&(a.type==="cam"||a.type==="ca"||(a.type==="capool"&&a.n>=25))&&!a.part})}
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
  var extra=attempts().some(function(a){return a.date===ds&&a.type!=="cam"&&!(a.type==="capool"&&a.n>=25)&&!(a.setId&&schIds[a.setId])});
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
      (q.pg&&String(q.qid).indexOf("CAM26-")===0?'<button class="link" data-note="'+esc(q.qid)+'">Read the note for this question (page '+q.pg+')</button> ':'')+(q.rp?'<button class="link" data-rp="'+esc(q.rp)+'">See how UPSC asked this topic</button> ':'')+'<button class="link" data-rep="'+esc(q.qid)+'">Report a problem with this question</button><div class="rpbox"></div></div>';
  }).join("");
  $("app").innerHTML='<div class="page"><div class="pagehead"><button class="btn ghost" id="rs-back">'+(fresh?"Done":"Back")+'</button><div><h1>'+esc(a.title)+'</h1><p class="muted">'+esc(TYPE_LABEL[a.type]||a.type)+', taken '+fdy(a.date)+(a.sched&&a.sched!==a.date?', scheduled for '+fdy(a.sched):'')+'</p></div></div>'+
    '<section class="panel scorecard"><div class="big"><b>'+a.pts+'</b><span>of '+a.max+' marks ('+pc+'%)'+(a.mk&&a.mk[0]===CFG.CSAT_MK[0]?(pc>=CFG.CSAT_PASS?' · <em class="pass">Qualifies (33% needed)</em>':' · <em class="fail">Below the 33% qualifying mark</em>'):'')+(a.nd?' · '+a.nd+' question'+(a.nd>1?"s":"")+' not scored':'')+'</span></div><dl class="stats"><div><dt>Right</dt><dd>'+a.r+'</dd></div><div><dt>Wrong</dt><dd>'+a.w+'</dd></div><div><dt>Not answered</dt><dd>'+a.sk+'</dd></div><div><dt>Accuracy</dt><dd>'+acc+'%</dd></div><div><dt>Time</dt><dd>'+fmtMin(a.sec||0)+'</dd></div><div><dt>Per question</dt><dd>'+(a.n?Math.round((a.sec||0)/a.n):0)+' s</dd></div></dl></section>'+retakeHtml(a)+
    '<div class="cols"><section class="panel"><h2>By unit</h2><div class="scroll"><table class="tbl"><thead><tr><th>Unit</th><th>Right</th><th>Wrong</th><th class="hide-sm">Skipped</th><th>Accuracy</th></tr></thead><tbody>'+unitRows+'</tbody></table></div></section>'+
    '<section class="panel"><h2>Confidence</h2>'+confTable(items)+elimHtml(items,qs)+'</section></div>'+nextPartHtml(a)+notesAfterTest(a,qs)+
    '<section class="panel"><div class="row between wrap"><h2>Answers and explanations</h2><button class="btn small" id="rs-listen">Listen to these</button><div class="seg small">'+filters.map(function(f){return '<button data-f="'+f[0]+'" aria-pressed="'+(RES.filter===f[0])+'">'+f[1]+'</button>'}).join("")+'</div></div>'+(cards||'<p class="muted">No questions match this filter.</p>')+'</section></div>';
  $("rs-back").onclick=function(){VIEW.screen="tabs";render()};
  $("rs-listen").onclick=function(){var l=list.filter(function(o){return o.q&&!o.q.x}).map(function(o){return {q:o.q,ch:o.x[3]}});if(!l.length){toast("Nothing to read out for this filter.");return}playList(l,"Review: "+a.title)};
  if($("rs-retake"))$("rs-retake").onclick=function(){retakeAttempt(a)};
  if($("rs-next"))$("rs-next").onclick=function(){startPart(a.setId,+$("rs-next").dataset.p)};
  qsa("[data-f]").forEach(function(b){b.onclick=function(){RES.filter=b.dataset.f;renderResult(fresh)}});
  qsa("[data-rp]").forEach(function(b){b.onclick=function(){showLinkedPyq(b)}});
  bindNotesAfterTest();
  qsa("[data-rep]").forEach(function(b){b.onclick=function(){reportDialog(byQid[b.dataset.rep])}});
}
/* take any finished test again: the same questions, as a new attempt; earlier attempts stay in the record */
function canRetake(a){return !!(a&&((a.setId&&SET[a.setId]&&SET[a.setId].ready)||(a.items&&a.items.length)))}
function retakeHtml(a){
  if(!canRetake(a))return "";
  return '<section class="panel row between wrap"><p>Take the same questions again. This score stays in your record.</p><button class="btn primary" id="rs-retake">Take this '+(a.part?"part":"test")+' again</button></section>';
}
function retakeAttempt(a){
  if(!canRetake(a))return;
  stopPlayer(true);
  if(a.setId&&SET[a.setId]&&SET[a.setId].ready){if(a.part)return startPart(a.setId,a.part);return startSet(a.setId,!!a.timed)}
  var csat=a.mk&&a.mk[0]===CFG.CSAT_MK[0];
  startCustom({type:a.type,title:a.title,subject:a.subject,qids:a.items.map(function(x){return x[0]}),timed:!!a.timed,mk:a.mk||null,limit:csat?Math.round(a.items.length*90):null});
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
  ({today:viewToday,practice:viewPractice,read:viewRead,dash:viewDash,scores:viewScores})[VIEW.tab]();
  updateSyncBadge();
  clearTimeout(render.ns);render.ns=setTimeout(function(){try{nudgeStatus()}catch(e){}},400);
}
window.addEventListener("hashchange",function(){if(/go=/.test(location.hash)&&M){handleGo();return}var h=location.hash.replace("#","");if(["today","practice","read","dash","scores"].indexOf(h)>=0&&h!==VIEW.tab){VIEW.tab=h;if(VIEW.screen==="tabs"){render();window.scrollTo(0,0)}}});

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
    if(o.arrange)qs=cbArrange(qs);
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
  var nt=(M&&M.notes&&M.notes[s.id])?'<div class="notesrow"><button class="btn small'+(n?"":" primary")+'" data-notes="'+s.id+'">Read the notes'+(n?'':' first')+'</button><span class="muted small">'+M.notes[s.id].pages+' pages, works offline</span>'+notesBadge(s.id)+'</div>':'';
  return '<li class="setrow"><div class="setmain"><div><span class="muted small">'+label+'</span><b>'+esc(s.title)+'</b>'+(n?'<span class="good small">Done'+(n>1?', taken '+n+' times':'')+(best!=null?', best '+best+' of '+(s.n*2):'')+'</span>':'')+'</div>'+act+'</div>'+nt+parts+'</li>';
}
function dayPanel(ds,td){
  var sch=schedFor(ds),t=TESTBYDATE[ds],done=setDoneMap();
  var h='<section class="panel"><h2>'+(ds===td?"Today's work":fdw(ds))+'</h2>';
  if(sch.length){var s0=sch[0];h+='<p class="muted">'+esc(s0.testName)+', '+esc(s0.dayLabel)+'. Shankar test on '+fdw(s0.testDate)+'.</p>';}
  if(t)h+='<p class="testday">'+esc(t.name)+' is on this day, 2 to 4 pm'+(t.csat?(t.type==="mock"?', with a live discussion at 4:30 pm.':'. The recorded discussion is uploaded at 4:30 pm.'):', with a live discussion at 4:30 pm.')+' Enter your marks afterwards in the Scores tab.</p>';
  if(t)h+=shkCard(t,true,"Topics for this test");
  var ot=SHK_ORIENT[ds];if(ot&&TESTBYKEY[ot])h+='<p class="small">Shankar orientation'+(SHK[ot].oc?' and current-affairs':'')+' class for '+esc(TESTBYKEY[ot].name)+' (recorded) is uploaded today.</p>';
  if(!t||t.csat){var nx=nextTests(t?addDays(ds,1):ds,1,function(x){return !x.csat})[0];if(nx)h+=shkCard(nx,false,"Next Shankar GS test")}
  var ds_=dayState(ds,done,td),show25=ds_.need25;
  if(!sch.length&&show25){var nt=TESTS.filter(function(x){return x.subject==="Current Affairs"&&x.date>=ds})[0];if(nt)h+='<p class="muted">Next Shankar current affairs test: '+esc(nt.name)+', '+fdw(nt.date)+'.</p>'}
  if(sch.length||show25){
    h+='<div class="row wrap tight"><span class="muted small">Timing</span><div class="seg small"><button data-timed="0" aria-pressed="'+!DB.meta.timed+'">Untimed</button><button data-timed="1" aria-pressed="'+!!DB.meta.timed+'">Timed, 1.2 min per question</button></div></div>';
    h+='<ul class="list">'+sch.map(function(s){return setRowHtml(s,done)}).join("")+(show25?camRow(ds,td):"")+'</ul>';
    if(ds!==td)h+='<p class="muted small">You can take any day\'s set early or late. It is logged on the day you take it.</p>';
  }else if(!t)h+='<p class="muted">No set is scheduled for this day. Pick another date, or use Practice for a subject test.</p>';
  var taken=attempts().filter(function(a){return a.date===ds});
  if(ds<td){var lr=logRec(ds);h+='<h3>Study log</h3>'+(lr?'<p class="small">'+logLine(lr)+'</p><button class="btn ghost small" data-log="'+ds+'">Edit log</button>':'<button class="btn small" data-log="'+ds+'">Add a log for this day</button>')}
  if(taken.length)h+='<h3>Taken on this day</h3><ul class="list">'+taken.map(function(a){return '<li><div><b>'+esc(a.title)+'</b><span class="muted small">'+esc(TYPE_LABEL[a.type]||"")+'</span></div><div class="row tight"><button class="btn ghost small" data-att="'+a.id+'">'+a.pts+' / '+a.max+'</button>'+(canRetake(a)?'<button class="btn small" data-retake="'+a.id+'">Take again</button>':'')+'</div></li>'}).join("")+'</ul>';
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
    '<div class="legend"><span><i class="lg done"></i>50 and 25 done</span><span><i class="lg part"></i>One of them done</span><span><i class="lg missed"></i>Missed</span><span><i class="lg paused"></i>Paused</span><span><i class="lg todo"></i>Upcoming</span><span><b class="star">★</b> Extra test</span><span><i class="cdot yes"></i>Checked in</span><span><b class="tmark">T</b> Shankar GS test</span><span><b class="tmark csat">C</b> Shankar CSAT test</span></div><div class="row"><button class="btn ghost small" id="shk-all">Full Shankar schedule with topics</button></div></section>';
}
function bindToday(){
  bindNudges();bindBatch2();
  qsa("[data-chk]").forEach(function(b){b.onclick=function(){put("chk_"+today(),{kind:"chk",date:today(),v:b.dataset.chk});render();if(b.dataset.chk==="yes")toast("Logged. Keep the streak going.")}});
  qsa("[data-start]").forEach(function(b){b.onclick=function(){startSet(b.dataset.start,!!DB.meta.timed)}});
  qsa("[data-notes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.notes)}});
  qsa("[data-part]").forEach(function(b){b.onclick=function(){var p=b.dataset.part.split("|");startPart(p[0],+p[1])}});
  bindLog();
  qsa("[data-camnotes]").forEach(function(b){b.onclick=function(){openCamNotes(b.dataset.camnotes,1,"tabs")}});
  if($("cam-rev"))$("cam-rev").onclick=startCamRevision;
  qsa("[data-budget]").forEach(function(b){b.onclick=function(){budgetPlan(+b.dataset.budget)}});
  qsa("[data-resume]").forEach(function(b){b.onclick=function(){resumeRun(b.dataset.resume)}});
  qsa("[data-discard]").forEach(function(b){b.onclick=function(){modal('<h2>Discard this paused test?</h2><p>Your answers so far will be lost.</p><div class="row"><button class="btn danger" data-m="y">Discard</button><button class="btn ghost" data-m="x">Keep it</button></div>',function(a){if(a==="y"){del(b.dataset.discard);render()}})}});
  qsa("[data-att]").forEach(function(b){b.onclick=function(){openAttempt(b.dataset.att)}});
  qsa("[data-retake]").forEach(function(b){b.onclick=function(){var a=DB.recs[b.dataset.retake];if(a)retakeAttempt(a)}});
  qsa("[data-timed]").forEach(function(b){b.onclick=function(){DB.meta.timed=b.dataset.timed==="1";saveStore();render()}});
  qsa(".cal [data-d]").forEach(function(b){b.onclick=function(){VIEW.sel=b.dataset.d;render()}});
  var mv=function(k){var y=VIEW.month[0],m=VIEW.month[1]+k;if(m<0){m=11;y--}if(m>11){m=0;y++}VIEW.month=[y,m];render()};
  $("cal-prev").onclick=function(){mv(-1)};$("cal-next").onclick=function(){mv(1)};
  $("cal-today").onclick=function(){VIEW.sel=null;VIEW.month=null;render()};
  if($("shk-all"))$("shk-all").onclick=shkSchedule;
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
  html+=cbPanel();
  html+='<section class="panel"><h2>Subject test</h2><div class="subjgrid">'+M.subjects.map(function(s){return '<button class="subj'+(s===subj?" on":"")+'" data-subj="'+esc(s)+'"'+(counts[s]?"":" disabled")+'><b>'+esc(s)+'</b><span>'+(counts[s]?counts[s]+' questions':'Questions coming later')+'</span></button>'}).join("")+'</div>'+
    '<details class="units"'+(nSel?" open":"")+'><summary>Limit to certain units (optional)'+(nSel?' <span class="tag">'+nSel+' chosen</span>':'')+'</summary><div class="chips">'+units.filter(function(u){return uc[u]}).map(function(u){return '<button class="chipbtn" data-unit="'+esc(u)+'" aria-pressed="'+!!chosen[u]+'">'+esc(u)+' <span>'+uc[u]+'</span></button>'}).join("")+'</div>'+(nSel?'<button class="link" id="u-clear">Clear units</button>':'')+'</details>'+
    '<div class="row"><button class="btn primary" id="st-go"'+(counts[subj]?"":" disabled")+'>Start a '+esc(subj)+' test</button><span class="muted small">You choose 50, 100, 150 or 200 questions next. Always timed.</span></div></section>';
  html+=sriPanel();
  html+=sppPanel();
  html+=pyqPanel();
  html+=listenPanel();
  var mb=mistakeBook(),due=mb.filter(function(m){return m.isDue}).length;
  var bySub={},meta=qMeta();mb.forEach(function(m){var s=(meta[m.qid]||["Other"])[0];bySub[s]=(bySub[s]||0)+1});
  html+='<div class="cols">';
  html+='<section class="panel"><h2>Full UPSC-style mock</h2><p class="muted">100 questions from every subject, weighted like recent papers. 2 hours, with negative marking.</p><button class="btn primary" id="fm-go">Start a full mock</button></section>';
  html+='<section class="panel"><h2>Mistake book</h2>'+(mb.length?'<p><b>'+due+'</b> question'+(due===1?"":"s")+' due for revision today, '+mb.length+' in the book.</p><p class="muted small">Every question you get wrong or skip comes back after 1, 3, 7 and 21 days until you answer it right twice in a row.</p><p class="muted small">'+Object.keys(bySub).map(function(s){return esc(s)+': '+bySub[s]}).join(", ")+'</p><div class="row wrap"><button class="btn primary" id="mb-go"'+(due?"":" disabled")+'>Revise '+Math.min(due,25)+' due question'+(due===1?"":"s")+'</button>'+(mb.length>due?'<button class="btn" id="mb-all">Revise early</button>'+'<button class="btn" data-quick="flash">Flashcards</button>':'')+'</div>':'<p class="muted">Questions you get wrong or skip will appear here for spaced revision.</p>')+'</section>';
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
  bindCb();
  qsa("#cam-panel [data-start]").forEach(function(b){b.onclick=function(){startSet(b.dataset.start,!!DB.meta.timed)}});
  qsa("#cam-panel [data-resume]").forEach(function(b){b.onclick=function(){resumeRun(b.dataset.resume)}});
  if($("mb-go"))$("mb-go").onclick=function(){startRevision(false)};
  if($("mb-all"))$("mb-all").onclick=function(){startRevision(true)};
  bindBatch2();
  $("myq-add").onclick=function(){myqDialog(null)};
  $("myq-mock").onclick=function(){var q=shuffle(myqSet().questions.map(function(x){return x.qid})).slice(0,100);startCustom({type:"myq",title:"Mock from my questions, "+fd(today()),subject:"Mixed",qids:q,timed:true})};
  qsa("[data-myedit]").forEach(function(b){b.onclick=function(){myqDialog(b.dataset.myedit)}});
  qsa("[data-mydel]").forEach(function(b){b.onclick=function(){modal('<h2>Delete this question?</h2><div class="row"><button class="btn danger" data-m="y">Delete</button><button class="btn ghost" data-m="x">Cancel</button></div>',function(a){if(a==="y"){del(b.dataset.mydel);render()}})}});
  qsa("[data-repdel]").forEach(function(b){b.onclick=function(){del(b.dataset.repdel);render()}});
}
/* Schemes, reports and indices: revision notes plus four question sets */
function sriPanel(){
  var ss=M.sets.filter(function(s){return s.type==="sri"&&s.ready});if(!ss.length)return "";
  var done=setDoneMap(),nt=M.notes&&M.notes.SRI;
  return '<section class="panel" id="sri-panel"><h2>Schemes, reports and indices</h2><p class="muted small">Revision notes on who each scheme is for and what UPSC asks about it, plus what every index measures, then four question sets. Read the notes first or test first.</p>'+
    (nt?'<div class="notesrow"><button class="btn small'+(notesDone("SRI")?"":" primary")+'" data-srinotes="SRI">Read the notes</button><span class="muted small">'+nt.pages+' pages, works offline</span>'+notesBadge("SRI")+'</div>':'')+
    '<ul class="list">'+ss.map(function(s){var d=done[s.id];return '<li><div><b>'+esc(s.title)+'</b><span class="muted small">'+s.n+' questions'+(d?', taken '+d+' time'+(d>1?"s":""):'')+'</span></div><button class="btn small'+(d?"":" primary")+'" data-cset="'+s.id+'">'+(d?"Retake":"Start")+'</button></li>'}).join("")+'</ul></section>';
}
/* Species and protected areas: revision notes plus four question sets */
function sppPanel(){
  var ss=M.sets.filter(function(s){return s.type==="spp"&&s.ready});if(!ss.length)return "";
  var done=setDoneMap(),nt=M.notes&&M.notes.SPP;
  return '<section class="panel" id="spp-panel"><h2>Species and protected areas</h2><p class="muted small">Revision notes on protected-area law, Ramsar sites, the flagship projects and species status, then four question sets. Read the notes first or test first.</p>'+
    (nt?'<div class="notesrow"><button class="btn small'+(notesDone("SPP")?"":" primary")+'" data-srinotes="SPP">Read the notes</button><span class="muted small">'+nt.pages+' pages, works offline</span>'+notesBadge("SPP")+'</div>':'')+
    '<ul class="list">'+ss.map(function(s){var d=done[s.id];return '<li><div><b>'+esc(s.title)+'</b><span class="muted small">'+s.n+' questions'+(d?', taken '+d+' time'+(d>1?"s":""):'')+'</span></div><button class="btn small'+(d?"":" primary")+'" data-cset="'+s.id+'">'+(d?"Retake":"Start")+'</button></li>'}).join("")+'</ul></section>';
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
  qsa("[data-srinotes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.srinotes)}});
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
  html+=dashGlance();
  var perf='<section class="panel"><div class="row between wrap"><h2>Performance</h2><div class="seg toggle" role="group" aria-label="Test type">'+DASH_TYPES.map(function(t){return '<button data-dt="'+t[0]+'" aria-pressed="'+(type===t[0])+'">'+t[1]+'</button>'}).join("")+'</div></div>';
  if(!rows.length){
    perf+='<p class="empty">'+({daily:"Take a daily set from the Today tab to start your record.",weekly:"Enter your Shankar weekly test marks in the Scores tab to see them here.",mock:"Take a full mock in Practice, or enter Shankar mock marks in Scores.",subject:"Take a subject test in Practice to see it here.",ca:"Take a current affairs set from the Today tab to see it here.",pyq:"Take a UPSC previous year paper in Practice to see it here.",all:"Your results will appear here after your first test."})[type]+'</p></section>';
  }else{
    var ps=rows.map(function(r){return r.p}),avg=ps.reduce(function(a,b){return a+b},0)/ps.length;
    var last=rows[rows.length-1];
    perf+='<dl class="kpis"><div><dt>Tests</dt><dd>'+rows.length+'</dd></div><div><dt>Average</dt><dd>'+r1(avg)+'%</dd></div><div><dt>Best</dt><dd>'+r1(Math.max.apply(null,ps))+'%</dd></div><div><dt>Latest</dt><dd>'+r1(last.p)+'%</dd><dd class="sub">'+esc(last.marks+" / "+last.max)+'</dd></div></dl>';
    perf+='<div class="chartwrap" id="perfchart"></div>';
    var atts=rows.filter(function(r){return r.kind==="att"}).map(function(r){return DB.recs[r.id]});
    var items=[];atts.forEach(function(a){items=items.concat(a.items||[])});
    if(items.length){
      var tps={};items.forEach(function(x){if(!x[6])return;var o=tps[x[1]]||(tps[x[1]]={s:0,n:0});o.s+=x[6];o.n++});
      var tpRows=Object.keys(tps).map(function(s){return '<tr><td>'+esc(s)+'</td><td>'+Math.round(tps[s].s/tps[s].n)+' s</td><td>'+tps[s].n+'</td></tr>'}).join("");
      perf+='<div class="cols"><div><h3>Confidence</h3>'+confTable(items)+'</div><div><h3>Time per question</h3>'+(tpRows?'<table class="tbl"><thead><tr><th>Subject</th><th>Average</th><th>Questions timed</th></tr></thead><tbody>'+tpRows+'</tbody></table><p class="muted small">The exam allows 72 seconds per question.</p>':'<p class="muted">Time per question is recorded for tests taken from now on.</p>')+'</div></div>';
    }
    var months={};rows.forEach(function(r){months[r.date.slice(0,7)]=1});
    var mk=Object.keys(months).sort().reverse();if(VIEW.dashMonth!=="all"&&!months[VIEW.dashMonth])VIEW.dashMonth="all";
    var shown=rows.filter(function(r){return VIEW.dashMonth==="all"||r.date.slice(0,7)===VIEW.dashMonth}).slice().reverse();
    perf+='<div class="row between wrap"><h3>All results</h3><label class="inline">Month <select id="dm">'+'<option value="all">All months</option>'+mk.map(function(m){return '<option value="'+m+'"'+(VIEW.dashMonth===m?" selected":"")+'>'+MONTHS[+m.slice(5)-1]+' '+m.slice(0,4)+'</option>'}).join("")+'</select></label></div>'+
      '<div class="scroll"><table class="tbl hist"><thead><tr><th>Date</th><th>Test</th><th>Type</th><th>Marks</th><th>%</th><th class="hide-sm">Right</th><th class="hide-sm">Wrong</th><th class="hide-sm">Skipped</th><th class="hide-sm">Time</th></tr></thead><tbody>'+
      shown.map(function(r){return '<tr'+(r.kind==="att"?' class="click" data-att="'+r.id+'" tabindex="0"':'')+'><td>'+fd(r.date)+'</td><td>'+esc(r.title)+'</td><td>'+esc(r.type)+'</td><td class="num">'+r.marks+' / '+r.max+'</td><td class="num">'+r1(r.p)+'</td><td class="num hide-sm">'+(r.r==null?"–":r.r)+'</td><td class="num hide-sm">'+(r.w==null?"–":r.w)+'</td><td class="num hide-sm">'+(r.sk==null?"–":r.sk)+'</td><td class="num hide-sm">'+(r.sec?fmtMin(r.sec):(r.rank?"Rank "+r.rank:"–"))+'</td></tr>'}).join("")+'</tbody></table></div><p class="muted small">Tap a row to see every question with your answer and the explanation.</p>';
    perf+='</section>';
  }
  var ps_=rows.map(function(r){return r.p}),pd_=paceData(),wk=weekData(weekStart(today()));
  html+=fold("perf","Performance",rows.length?rows.length+" tests · average "+r1(ps_.reduce(function(a,b){return a+b},0)/ps_.length)+"% · latest "+r1(ps_[ps_.length-1])+"%":"no results yet",unwrap(perf),true);
  html+=fold("pace","Pace to Prelims",pd_.done+" of "+pd_.total+" daily sets · "+(pd_.behind?pd_.behind+" behind":"on schedule"),unwrap(paceSection()),false);
  html+=fold("week","Week in review",wk.goal+" of 7 goal days this week · "+wk.q+" questions",unwrap(weekSection()),false);
  var sk=testMarks().filter(function(t){return t.marks!=null&&t.marks!==""});
  html+=fold("shankar","Shankar Prestorming tests",sk.length?sk.length+" test"+(sk.length>1?"s":"")+" entered":"no marks entered yet",unwrap(shankarSection()),false);
  var us=unitStats(VIEW.from||CFG.START,VIEW.to||today()),sa=Object.keys(us).map(function(x){return [x,accOf(us[x]),us[x].r+us[x].w]}).filter(function(x){return x[2]>=20}).sort(function(a,b){return b[1]-a[1]});
  html+=fold("subj","Subject-wise performance",sa.length?"strongest "+esc(sa[0][0])+" "+Math.round(sa[0][1])+"% · weakest "+esc(sa[sa.length-1][0])+" "+Math.round(sa[sa.length-1][1])+"%":"not enough data yet",unwrap(subjectSection()),false);
  html+=fold("coach","Attempt strategy coach","when to attempt Sure, 50-50 and Guess answers",unwrap(coachSection()),false);
  var lg=logs().filter(function(r){return r.date>=addDays(today(),-6)});
  html+=fold("log","Study log",lg.length+" of last 7 days logged · "+r1(lg.reduce(function(a,r){return a+(+r.hours||0)},0))+" h",unwrap(logSection()),false);
  v.innerHTML=html;
  if(rows.length&&$("perfchart")&&foldOpen("perf",true))drawPerf($("perfchart"),rows,type);
  qsa("[data-dt]").forEach(function(b){b.onclick=function(){VIEW.dashType=b.dataset.dt;render()}});
  if($("dm"))$("dm").onchange=function(){VIEW.dashMonth=this.value;render()};
  qsa("tr[data-att]").forEach(function(tr){tr.onclick=function(){openAttempt(tr.dataset.att)};tr.onkeydown=function(e){if(e.key==="Enter")openAttempt(tr.dataset.att)}});
  bindSubjects();
  bindLog();
  bindBatch2();bindFolds(true);
  if(foldOpen("shankar",false))drawShankar();
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
    return '<tr><td>'+esc(u)+'<span class="sub">'+(n?n+' attempted':'Not attempted')+'</span></td><td class="num hide-sm">'+n+'</td><td class="num">'+(n?Math.round(x.r/n*100)+"%":"–")+'</td><td>'+(n?'<span class="tag '+st+'">'+STATUS_LABEL[st]+'</span>':'')+'</td><td class="hide-sm">'+(tr?'<span class="trend '+tr+'">'+TREND_LABEL[tr]+'</span>':'')+'</td><td><div class="row tight nowrap"><button class="btn small ghost" data-sheet="'+esc(s)+'|'+esc(u)+'">Sheet</button>'+(avail?'<button class="btn small'+(st==="weak"?" primary":"")+'" data-retest="'+esc(s)+'|'+esc(u)+'">'+(n?"Retest":"Test")+'</button>':'')+'</div></td></tr>'};
  var groups={};all.forEach(function(u){var g=UNITGROUP[s+"|"+u]||"";(groups[g]=groups[g]||[]).push(u)});
  var body="";Object.keys(groups).forEach(function(g){if(g)body+='<tr class="grp"><td colspan="6">'+esc(g)+'</td></tr>';body+=groups[g].map(row).join("")});
  return '<div class="scroll"><table class="tbl units"><thead><tr><th>Unit</th><th class="hide-sm">Attempted</th><th>Accuracy</th><th>Status</th><th class="hide-sm">Trend</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function bindSubjects(){
  qsa("[data-sx]").forEach(function(b){b.onclick=function(){var s=b.dataset.sx;VIEW.subjOpen[s]=!VIEW.subjOpen[s];render()}});
  qsa("[data-retest]").forEach(function(b){b.onclick=function(){var p=b.dataset.retest.split("|");startSubjectTest(p[0],[p.slice(1).join("|")])}});
  qsa("[data-sheet]").forEach(function(b){b.onclick=function(){var p=b.dataset.sheet.split("|");openSheet(p[0],p.slice(1).join("|"))}});
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
  html+=remindCard(false);
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
  bindNudges();
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
    '<div class="row wrap tight"><button class="btn small" data-camnotes="'+s.id+'">Read notes</button>'+act+'</div></div></li>';
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
      (sets.length>=6?'<div class="row wrap"><button class="btn" id="cm-full">Full '+MONTHS[+sel.split("-")[1]-1]+' test (100 questions, timed)</button><span class="muted small">100 questions weighted by topic from the whole month.</span></div>':'');
  }else{
    var past=sel<"2026-11";
    body='<p class="muted">'+(past?'The '+monthLabel(sel)+' questions and notes are being prepared and will appear here.':monthLabel(sel)+' will be added after the month ends, once its magazine is out. The space is kept ready.')+'</p>';
  }
  return '<section class="panel" id="cam-panel"><h2>Current affairs by month</h2><p class="muted small">Each month has six sets of 25 questions, one for each area (polity, economy, international relations and defence, environment, science and tech, schemes and reports). Every set has a Read-the-notes booklet: one page for each question. Read first, or test first and read after. The daily 25 on the Today tab takes the next set in month order.</p>'+
    '<div class="chips mchips" role="group" aria-label="Month">'+chips+'</div>'+body+'</section>';
}
function bindCam(){
  qsa("[data-cm]").forEach(function(b){b.onclick=function(){VIEW.camMonth=b.dataset.cm;render()}});
  qsa("[data-camnotes]").forEach(function(b){b.onclick=function(){openCamNotes(b.dataset.camnotes,1,"tabs")}});
  if($("cm-full"))$("cm-full").onclick=function(){
    var k=VIEW.camMonth,rows=cbRows({months:[k]}),qids=[];
    if(rows.length)qids=cbPick(rows,100,"unseen");else camOfMonth(k).forEach(function(s){for(var i=0;i<s.n;i++)qids.push(s.id+"#"+i)});
    startCustom({type:rows.length?"capool":"cam",title:monthLabel(k)+" full test ("+Math.min(100,qids.length)+" questions)",subject:"Current Affairs",qids:rows.length?qids:pickPart(qids,100),timed:true,arrange:true});
  };
}
/* the daily 25 row, shown on the Today tab for each day from 31 Oct 2026 */
function camRow(ds,td){
  if(ds>td)return '<li><div><span class="muted small">Current affairs, 25 questions</span><b>The next set is chosen on the day</b></div></li>';
  var nx=nextCamSet(),dn=camDoneOn(ds),lab='<span class="muted small">Daily current affairs, 25 questions</span>';
  var notesBtn=nx?'<button class="btn small" data-camnotes="'+nx.id+'">Read notes</button>':'';
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
function openCamNotes(id,page,from){
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
      (m.length?'<button class="btn small" data-camnotes-pg="'+sid+'|'+m[0]+'">Open page '+m[0]+'</button>':'')+'<button class="btn small" data-camnotes-pg="'+sid+'|1">All pages</button></div></div>'}).join("")+'</section>';
}
function bindNotesAfterTest(){
  qsa("[data-camnotes-pg]").forEach(function(b){b.onclick=function(){var p=b.dataset.camnotesPg.split("|");openCamNotes(p[0],+p[1],"result")}});
  qsa("[data-note]").forEach(function(b){b.onclick=function(){var qid=b.dataset.note,q=(RES&&RES.qs||[]).filter(function(x){return x.qid===qid})[0];if(q)openCamNotes(qid.split("#")[0],q.pg||1,"result")}});
}

/* boot */
function boot(){
  loadStore();
  var h=location.hash.replace("#","");if(["today","practice","read","dash","scores"].indexOf(h)>=0)VIEW.tab=h;
  fetch("data/manifest.json").then(function(r){return r.json()}).then(function(m){
    indexManifest(m);migrateOld();render();handleGo();
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

/* Current affairs question pools: test builder (rows are [qid, month, topic, core, kind]) */
var CB_FOCUS=[["all","All questions"],["News to static","News to static"],["Confusable","Confusable pairs"],["Map","Map"],["Publisher","Who publishes it"]];
var CB_SIZES=[10,20,25,50,100];
var CB_PICK=[["unseen","Unseen first"],["wrong","My wrong answers"],["any","Any"]];
var CB_TOPIC_FOR={"Polity":["Polity & Governance"],"Economy":["Economy"],"Environment":["Environment"],"Science & Tech":["Science & Tech"],"History":["Culture, Sports & Awards"],"Geography":["Places in News","Environment"]};
function cbIndex(){return M.capool||{topics:[],kinds:[],q:[]}}
function cbState(){return VIEW.cb||(VIEW.cb={months:{},topics:{},focus:"all",size:25,pick:"unseen"})}
function cbRows(f){var I=cbIndex(),m=null,t=null;
  if(f.months&&f.months.length){m={};f.months.forEach(function(x){m[x]=1})}
  if(f.topics&&f.topics.length){t={};f.topics.forEach(function(x){t[x]=1})}
  return I.q.filter(function(r){return (!m||m[r[1]])&&(!t||t[I.topics[r[2]]])&&(!f.focus||f.focus==="all"||I.kinds[r[4]]===f.focus)});
}
function cbMistakes(){var o={};mistakeBook().forEach(function(m){o[m.qid]=1});return o}
function cbAvailable(rows,pick){if(pick!=="wrong")return rows.length;var mb=cbMistakes();return rows.filter(function(r){return mb[r[0]]}).length}
/* choose questions: topic shares follow the pool, then rank by the chosen rule */
function cbPick(rows,size,pick){
  var h=qHistory(),mb=cbMistakes();
  if(pick==="wrong")rows=rows.filter(function(r){return mb[r[0]]});
  size=Math.min(size,rows.length);
  var rank=function(r){if(pick==="any"||pick==="wrong")return 0;return h[r[0]]?(mb[r[0]]?2:3):(r[3]?0:1)};
  var groups={};shuffle(rows.slice()).sort(function(a,b){return rank(a)-rank(b)}).forEach(function(r){(groups[r[2]]=groups[r[2]]||[]).push(r)});
  var keys=Object.keys(groups),out=[],rem=[];
  keys.forEach(function(k){var ex=size*groups[k].length/rows.length,n=Math.floor(ex);out=out.concat(groups[k].slice(0,n));groups[k]=groups[k].slice(n);rem.push([ex-n,k])});
  rem.sort(function(a,b){return b[0]-a[0]});
  for(var i=0;out.length<size&&i<rem.length*size+1;i++){var g=groups[rem[i%rem.length][1]];if(g.length)out.push(g.shift())}
  return out.map(function(r){return r[0]});
}
/* order questions so no answer position runs more than twice and one news item is not asked back to back */
function cbArrange(qs){
  var left=shuffle(qs.slice()),out=[];
  while(left.length){
    var n=out.length,l1=out[n-1],l2=out[n-2],best=-1,bs=1e9;
    for(var i=0;i<left.length;i++){var q=left[i],sc=0;
      if(l1&&l2&&l1.a===q.a&&l2.a===q.a)sc+=2;
      if(l1&&l1.it&&l1.it===q.it)sc+=3;
      if(l1&&l1.fmt&&l1.fmt===q.fmt&&l2&&l2.fmt===q.fmt)sc+=1;
      if(sc<bs){bs=sc;best=i;if(!sc)break}}
    out.push(left.splice(best,1)[0]);
  }
  // the last few can still clash, so swap each clash with a place where both questions fit
  var clash=function(l,i){if(i<0||i>=l.length)return false;var q=l[i];return (i>1&&l[i-1].a===q.a&&l[i-2].a===q.a)||(i>0&&q.it&&l[i-1].it===q.it)};
  var around=function(l,i){for(var k=i;k<=i+2;k++)if(clash(l,k))return true;return false};
  for(var pass=0;pass<8;pass++){var fixed=true;
    for(var i=0;i<out.length;i++){if(!clash(out,i))continue;fixed=false;
      for(var j=0;j<out.length;j++){if(j===i)continue;var t=out[i];out[i]=out[j];out[j]=t;if(!around(out,i)&&!around(out,j))break;t=out[i];out[i]=out[j];out[j]=t}}
    if(fixed)break}
  return out;
}
function cbNextTest(){var td=today();return TESTS.filter(function(t){return !t.csat&&t.date>=td&&t.type==="weekly"}).sort(function(a,b){return a.date<b.date?-1:1})[0]||null}
function cbGo(title,rows,size,pick){
  var qids=cbPick(rows,size,pick||"unseen");
  if(!qids.length){toast(pick==="wrong"?"You have no wrong answers in this selection yet.":"There are no questions for this choice yet.");return}
  startCustom({type:"capool",title:title+" ("+qids.length+" questions)",subject:"Current Affairs",qids:qids,timed:true,arrange:true});
}
function cbPanel(){
  var I=cbIndex();if(!I.q.length)return "";
  var c=cbState(),months={},topics={};I.q.forEach(function(r){months[r[1]]=(months[r[1]]||0)+1});
  var mk=Object.keys(months).sort(),sm=Object.keys(c.months).filter(function(k){return c.months[k]}),st=Object.keys(c.topics).filter(function(k){return c.topics[k]});
  cbRows({months:sm,focus:c.focus}).forEach(function(r){var t=I.topics[r[2]];topics[t]=(topics[t]||0)+1});
  var rows=cbRows({months:sm,topics:st,focus:c.focus}),av=cbAvailable(rows,c.pick);
  var chip=function(attr,v,on,lab,n){return '<button class="chipbtn" '+attr+'="'+esc(v)+'" aria-pressed="'+!!on+'">'+esc(lab)+(n!=null?' <span>'+n+'</span>':'')+'</button>'};
  var seg=function(attr,list,cur){return '<div class="chips" role="group">'+list.map(function(x){return chip(attr,x[0],x[0]===cur,x[1])}).join("")+'</div>'};
  var nt=cbNextTest(),ntHtml="";
  if(nt)ntHtml='<button class="btn" id="cb-next">News for '+esc(nt.name.split(":")[0])+'</button>';
  return '<section class="panel" id="cb-panel"><h2>Build a current affairs test</h2><p class="muted small">'+I.q.length+' questions from the whole of each month. Choose any months and topics, then a size for the time you have. Timed at 1.2 minutes per question. Unseen first gives you Core questions before Extra.</p>'+
    '<h3 class="small">Months</h3><div class="chips" role="group">'+chip("data-cbm","all",!sm.length,"All months",I.q.length)+mk.map(function(k){return chip("data-cbm",k,c.months[k],monthShort(k),months[k])}).join("")+'</div>'+
    '<h3 class="small">Topics</h3><div class="chips" role="group">'+chip("data-cbt","all",!st.length,"All topics")+I.topics.filter(function(t){return topics[t]}).map(function(t){return chip("data-cbt",t,c.topics[t],t,topics[t])}).join("")+'</div>'+
    '<h3 class="small">Question type</h3>'+seg("data-cbf",CB_FOCUS,c.focus)+
    '<h3 class="small">Which questions</h3>'+seg("data-cbp",CB_PICK,c.pick)+
    '<h3 class="small">Size</h3><div class="chips" role="group">'+CB_SIZES.map(function(n){return '<button class="chipbtn" data-cbs="'+n+'" aria-pressed="'+(n===c.size)+'"'+(av>=n?'':' disabled')+'>'+n+' <span>'+fmtMin(n*CFG.SEC_PER_Q)+'</span></button>'}).join("")+'</div>'+
    '<div class="row wrap"><button class="btn primary" id="cb-go"'+(av?'':' disabled')+'>Start '+Math.min(c.size,av)+' questions</button><span class="muted small">'+av+' available for this choice.</span></div>'+
    '<h3 class="small">Quick tests</h3><div class="row wrap">'+ntHtml+'<button class="btn" id="cb-mock">All-months mock (100)</button><button class="btn" id="cb-static">News to static (20)</button><button class="btn" id="cb-conf">Confusable pairs (10)</button><button class="btn" id="cb-map">Map round (10)</button><button class="btn" id="cb-pub">Who publishes it (10)</button></div></section>';
}
function bindCb(){
  if(!$("cb-panel"))return;
  var c=cbState(),tog=function(obj,v){if(v==="all"){Object.keys(obj).forEach(function(k){delete obj[k]})}else{obj[v]=!obj[v]}render()};
  qsa("[data-cbm]").forEach(function(b){b.onclick=function(){tog(c.months,b.dataset.cbm)}});
  qsa("[data-cbt]").forEach(function(b){b.onclick=function(){tog(c.topics,b.dataset.cbt)}});
  qsa("[data-cbf]").forEach(function(b){b.onclick=function(){c.focus=b.dataset.cbf;render()}});
  qsa("[data-cbp]").forEach(function(b){b.onclick=function(){c.pick=b.dataset.cbp;render()}});
  qsa("[data-cbs]").forEach(function(b){b.onclick=function(){c.size=+b.dataset.cbs;render()}});
  $("cb-go").onclick=function(){
    var sm=Object.keys(c.months).filter(function(k){return c.months[k]}),st=Object.keys(c.topics).filter(function(k){return c.topics[k]});
    var f=CB_FOCUS.filter(function(x){return x[0]===c.focus})[0][1];
    cbGo("Current affairs"+(sm.length===1?", "+monthLabel(sm[0]):"")+(st.length===1?": "+st[0]:"")+(c.focus!=="all"?", "+f:""),cbRows({months:sm,topics:st,focus:c.focus}),c.size,c.pick);
  };
  var nb=$("cb-next");if(nb)nb.onclick=function(){var t=cbNextTest(),tp=CB_TOPIC_FOR[t.subject]||[];cbGo("News for "+t.name.split(":")[0],cbRows({topics:tp}),25,"unseen")};
  $("cb-mock").onclick=function(){cbGo("Current affairs mock",cbRows({}),100,"unseen")};
  $("cb-static").onclick=function(){cbGo("News to static",cbRows({focus:"News to static"}),20,"unseen")};
  $("cb-conf").onclick=function(){cbGo("Confusable pairs",cbRows({focus:"Confusable"}),10,"unseen")};
  $("cb-map").onclick=function(){cbGo("Map round",cbRows({focus:"Map"}),10,"unseen")};
  $("cb-pub").onclick=function(){cbGo("Who publishes it",cbRows({focus:"Publisher"}),10,"unseen")};
}
function showLinkedPyq(b){
  var box=b.parentNode.querySelector(".rpbox");
  if(box.innerHTML){box.innerHTML="";return}
  loadQids([b.dataset.rp]).then(function(l){var q=l[0];if(!q){box.textContent="This question could not be loaded.";return}
    box.innerHTML='<div class="expl"><b>UPSC '+esc(String(q.y||""))+'</b><div class="qtext">'+esc(q.q)+'</div><ul class="ropts">'+q.o.map(function(t,k){return '<li class="'+(k===q.a?"right":"")+'"><span class="ob">'+"ABCD"[k]+'</span><span class="ot">'+esc(t)+'</span></li>'}).join("")+'</ul></div>'
  }).catch(function(){box.textContent="This question could not be loaded."});
}

/* ===== Daily nudges: today's goal, goal streak, comeback, catch-up planner, phone reminders ===== */
var GOAL_S=50,GOAL_C=25,PUSH_PUB="BHICrNnSrv5AcP9me2EP1yIQ1SQU3Zu_4NmwoEfN0jujSRfSo0pMZIqPg0y4-OCJTDvl6i8RKdRdXLj7XmA3Yqg";
var REMIND_TIMES=[["5:30 am","Morning plan: today's 50 + 25 and mistakes due"],["2:00 pm","Only if nothing is done yet"],["10:00 pm","Only if the day is not complete: the smallest next step"]];
function isCaType(t){return t==="cam"||t==="ca"||t==="capool"}
// questions answered per day: s = subject side (goal 50), c = current affairs (goal 25); CSAT 10 is extra
function dayCounts(){
  var m={};attempts().forEach(function(a){if(!a.date||a.type==="csat10")return;var o=m[a.date]||(m[a.date]={s:0,c:0});if(isCaType(a.type))o.c+=a.n||0;else o.s+=a.n||0});
  return m;
}
function goalOf(o){o=o||{s:0,c:0};var s=Math.min(GOAL_S,o.s),c=Math.min(GOAL_C,o.c);return {s:s,c:c,tot:s+c,done:s>=GOAL_S&&c>=GOAL_C,any:o.s+o.c>0}}
function goalStreaks(){
  var m=dayCounts(),td=today(),cur=0,best=0,run=0,d=CFG.START;
  while(d<=td){if(goalOf(m[d]).done){run++;if(run>best)best=run}else if(d!==td)run=0;d=addDays(d,1)}
  // current streak: ends today if today is done, else yesterday
  d=goalOf(m[td]).done?td:addDays(td,-1);
  while(d>=CFG.START&&goalOf(m[d]).done){cur++;d=addDays(d,-1)}
  return {cur:cur,best:best};
}
function ringSvg(frac,label,sub){
  var r=34,c=2*Math.PI*r,off=c*(1-Math.max(0,Math.min(1,frac)));
  return '<svg class="ring" viewBox="0 0 84 84" role="img" aria-label="'+esc(label+" "+sub)+'"><circle cx="42" cy="42" r="'+r+'" class="ring-bg"/><circle cx="42" cy="42" r="'+r+'" class="ring-fg'+(frac>=1?" full":"")+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 42 42)"/><text x="42" y="40" text-anchor="middle" class="ring-n">'+esc(label)+'</text><text x="42" y="56" text-anchor="middle" class="ring-s">'+esc(sub)+'</text></svg>';
}
function goalCard(td){
  var m=dayCounts(),g=goalOf(m[td]),st=goalStreaks(),y=addDays(td,-1),gy=goalOf(m[y]);
  var h='<section class="panel goal'+(g.done?" done":"")+'"><div class="goal-row">'+ringSvg(g.tot/(GOAL_S+GOAL_C),g.tot+"/"+(GOAL_S+GOAL_C),"today")+
    '<div class="goal-txt"><h2>'+(g.done?"Today's goal is complete":"Today's goal: 50 + 25")+'</h2>'+
    '<div class="goal-bars"><div><span class="small">Subject</span><div class="gbar"><i style="width:'+(g.s/GOAL_S*100)+'%"></i></div><span class="small num">'+g.s+' / '+GOAL_S+'</span></div>'+
    '<div><span class="small">Current affairs</span><div class="gbar"><i style="width:'+(g.c/GOAL_C*100)+'%"></i></div><span class="small num">'+g.c+' / '+GOAL_C+'</span></div></div>'+
    '<p class="small">Goal streak: <b>'+st.cur+' day'+(st.cur===1?"":"s")+'</b> · Best: <b>'+st.best+'</b>'+(g.done?"":(st.cur?' · finish today to make it '+(st.cur+1):''))+'</p></div></div>';
  // comeback: yesterday fell short and nothing is done yet today
  if(!g.any&&y>=CFG.START&&!gy.done){
    var bl=catchupBacklog();
    h+='<div class="comeback"><b>'+(gy.any?"Yesterday you did "+gy.tot+" of 75.":"Yesterday slipped by.")+' Today is a fresh start.</b><span class="small">'+
      (bl.parts?'Your catch-up plan below spreads the missed work over the coming days, so nothing piles up. ':'')+'Even one part of 10 questions keeps you moving.</span>'+
      '<button class="btn primary small" data-budget="10">Start with 10 minutes</button></div>';
  }
  return h+'</section>';
}
/* catch-up planner: unfinished 50-question sets from past days, spread over the coming days */
function catchupBacklog(){
  var td=today(),done=setDoneMap(),list=[],parts=0;
  Object.keys(BYDATE).filter(function(d){return d<td&&d>=CFG.START}).sort().forEach(function(d){
    BYDATE[d].forEach(function(s){
      if(!s.ready||s.pending||s.type==="ca"||s.n!==50||done[s.id])return;
      var sk=DB.recs["cuskip_"+s.id];if(sk&&!sk.del)return;
      var pd_=partsDone(s.id),left=[1,2,3,4,5].filter(function(k){return !pd_[k]});
      list.push({s:s,date:d,left:left});parts+=left.length;
    });
  });
  return {list:list,parts:parts};
}
function strongSubjects(){var st=unitStats(),o={};Object.keys(st).forEach(function(s){var t={r:0,w:0};Object.keys(st[s].units).forEach(function(u){t.r+=st[s].units[u].r;t.w+=st[s].units[u].w});if(t.r+t.w>=40&&t.r/(t.r+t.w)>=0.75)o[s]=Math.round(t.r/(t.r+t.w)*100)});return o}
function catchupCard(td){
  var bl=catchupBacklog();if(!bl.list.length)return "";
  var pace=DB.meta.cuPace||20,perDay=Math.max(1,Math.round(pace/10)),days=Math.ceil(bl.parts/perDay),fin=addDays(td,days-1),strong=strongSubjects();
  var plan=[],k=perDay;
  bl.list.forEach(function(b){b.left.forEach(function(p){if(k>0){plan.push({b:b,p:p});k--}})});
  var h='<section class="panel catchup"><div class="row between wrap"><h2>Catch-up plan</h2><span class="muted small">'+bl.list.length+' set'+(bl.list.length>1?"s":"")+' behind · '+bl.parts*10+' questions</span></div>'+
    '<p class="small">At <b>'+pace+' extra questions a day</b> you are back on schedule by <b>'+fdw(fin)+'</b>. Do these on top of today\'s 50 + 25.</p>'+
    '<div class="row wrap tight"><span class="muted small">Extra per day</span><div class="seg small">'+[10,20,30,50].map(function(p){return '<button data-pace="'+p+'" aria-pressed="'+(p===pace)+'">'+p+'</button>'}).join("")+'</div></div>'+
    '<h3>Today\'s catch-up</h3><ul class="list">'+plan.map(function(x){return '<li><div><b>'+esc(x.b.s.title)+'</b><span class="muted small">Part '+x.p+' of 5 · scheduled '+fdw(x.b.date)+'</span></div><button class="btn small primary" data-part="'+x.b.s.id+'|'+x.p+'">Start</button></li>'}).join("")+'</ul>';
  var opt=bl.list.filter(function(b){return strong[b.s.subject]});
  if(opt.length)h+='<details><summary class="small">Low-priority sets you could skip ('+opt.length+')</summary><p class="muted small">You are already above 75% in these subjects, so skipping frees time for weaker ones. Skipped sets stay in Practice and on the calendar.</p><ul class="list">'+
    opt.map(function(b){return '<li><div><b>'+esc(b.s.title)+'</b><span class="muted small">'+esc(b.s.subject)+' accuracy '+strong[b.s.subject]+'%</span></div><button class="btn ghost small" data-cuskip="'+b.s.id+'">Skip</button></li>'}).join("")+'</ul></details>';
  var sk=recs("cuskip");if(sk.length)h+='<p class="muted small">'+sk.length+' set'+(sk.length>1?"s":"")+' skipped. <button class="link" id="cu-unskip">Bring them back</button></p>';
  return h+'</section>';
}
function bindNudges(){
  qsa("[data-pace]").forEach(function(b){b.onclick=function(){DB.meta.cuPace=+b.dataset.pace;saveStore();render()}});
  qsa("[data-cuskip]").forEach(function(b){b.onclick=function(){put("cuskip_"+b.dataset.cuskip,{kind:"cuskip",set:b.dataset.cuskip});render();toast("Skipped. It stays available in Practice.")}});
  if($("cu-unskip"))$("cu-unskip").onclick=function(){recs("cuskip").forEach(function(r){del(r.id)});render()};
  qsa("[data-remind]").forEach(function(b){b.onclick=function(){remindAction(b.dataset.remind)}});
}
/* status the reminder sender reads from the Google Sheet (changes only when the day's picture changes) */
function nudgeStatus(){
  var td=today(),m=dayCounts(),g=goalOf(m[td]),st=goalStreaks(),set=todaysOpenSet(),bl=catchupBacklog(),nt=TESTS.filter(function(t){return t.date>=td})[0];
  var due=0;try{due=mistakeBook().filter(function(x){return x.isDue}).length}catch(e){}
  var cam=null;try{cam=nextCamSet()}catch(e){}
  var tm=addDays(td,1),ts_=schedFor(tm).filter(function(x){return x.ready&&!x.pending&&x.type!=="ca"})[0];
  var unr=function(x){return x&&M.notes&&M.notes[x.id]&&!notesDone(x.id)?(M.notes[x.id].title||x.title):""};
  var o={kind:"nudge",nt:unr(set),tnt:unr(ts_),c10:csat10Done(td),tset:ts_?ts_.title:"",date:td,s:g.s,c:g.c,done:g.done,streak:st.cur,best:st.best,due:due,set:set?set.title:"",setDate:set?set.date:"",ca:cam?cam.title:"",backlog:bl.parts,test:nt?nt.name:"",testDate:nt?nt.date:""};
  var key=JSON.stringify(o),old=DB.recs.nudge_status;
  if(!old||old.key!==key){o.key=key;put("nudge_status",o)}
}
/* phone reminders (web push). The sender is a scheduled job in the GitHub repository that reads the Sheet. */
function pushOk(){return "serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window}
function devId(){if(!DB.meta.dev){DB.meta.dev=Math.random().toString(36).slice(2,10);saveStore()}return DB.meta.dev}
function b64u(s){var p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function remindState(){
  if(!pushOk())return "unsupported";
  if(Notification.permission==="denied")return "denied";
  var r=DB.recs["push_"+devId()];
  return (Notification.permission==="granted"&&r&&!r.del&&r.on)?"on":"off";
}
function remindCard(compact){
  var s=remindState(),noSync=!syncCfg().url;
  if(compact&&(s==="on"||s==="unsupported"||DB.meta.remindHide))return "";
  if(compact)return '<section class="panel remind compact"><div class="row between wrap"><div><b>Turn on study reminders</b><span class="muted small block">5:30 am plan, 2 pm and 10 pm nudges on this phone'+(s==="denied"?' – notifications are blocked: allow them in the app settings':'')+(noSync?' – needs Google Sheet sync':'')+'</span></div><div class="row tight">'+(s==="denied"?'':'<button class="btn primary small" data-remind="on">Turn on</button>')+'<button class="btn ghost small" data-remind="hide">Not now</button></div></div></section>';
  var h='<section class="panel remind'+(compact?" compact":"")+'" id="remind-card"><h2>Study reminders on this phone</h2>';
  if(s==="unsupported")return h+'<p class="muted small">This browser cannot show reminders. Open the app from Chrome on your Android phone (installed on the home screen).</p></section>';
  h+='<ul class="plain small">'+REMIND_TIMES.map(function(t){return '<li><b>'+t[0]+'</b> – '+esc(t[1])+'</li>'}).join("")+'</ul>';
  if(s==="denied")h+='<p class="bad-t small">Notifications are blocked for this app. Long-press the app icon › App info › Notifications › Allow, then come back here.</p>';
  else if(s==="on")h+='<p class="good small">Reminders are on for this device.</p><div class="row wrap"><button class="btn small" data-remind="test">Show a sample</button><button class="btn ghost small" data-remind="off">Turn off</button></div>';
  else h+='<p class="muted small">Turn this on once on each device where you want reminders. Messages use your latest synced progress, so they stay quiet once the day is done.</p><div class="row wrap"><button class="btn primary small" data-remind="on">Turn on reminders</button>'+(compact?'<button class="btn ghost small" data-remind="hide">Not now</button>':'')+'</div>';
  if(noSync&&s!=="denied")h+='<p class="bad-t small">Reminders need Google Sheet sync (Scores tab), because the reminder service reads your progress from the Sheet.</p>';
  return h+'</section>';
}
function remindAction(a){
  if(a==="hide"){DB.meta.remindHide=true;saveStore();render();return}
  if(a==="test"){navigator.serviceWorker.ready.then(function(reg){reg.showNotification("Prelims Arena",{body:sampleBody(),icon:"icons/icon-192.png",badge:"icons/icon-192.png",tag:"pa-sample",data:{url:"./#today"}})});return}
  if(a==="off"){
    navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription()}).then(function(sub){if(sub)return sub.unsubscribe()}).catch(function(){}).then(function(){
      put("push_"+devId(),{kind:"push",on:false,dev:devId()});render();toast("Reminders turned off on this device.")});
    return;
  }
  Notification.requestPermission().then(function(p){
    if(p!=="granted"){render();toast("Notifications were not allowed.");return}
    return navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.getSubscription().then(function(old){return old||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(PUSH_PUB)})});
    }).then(function(sub){
      put("push_"+devId(),{kind:"push",on:true,dev:devId(),sub:JSON.parse(JSON.stringify(sub)),ua:(navigator.userAgent.match(/Android[^;)]*|iPhone|Windows|Mac OS X|Linux/)||[""])[0]});
      nudgeStatus();render();toast("Reminders are on. You will get the first one at the next reminder time.");
      remindAction("test");
    });
  }).catch(function(e){toast("Could not turn on reminders: "+((e&&e.message)||"unknown error"))});
}
function sampleBody(){var g=goalOf(dayCounts()[today()]);return g.done?"Today's 50 + 25 is done. Rest well – see you at 5:30 tomorrow.":(75-g.tot)+" questions left today ("+(GOAL_S-g.s)+" subject, "+(GOAL_C-g.c)+" current affairs). Tap to start a 10-minute part."}
/* notification taps open the app with #today&go=... */
function handleGo(){
  var m=/go=([a-z0-9]+)/.exec(location.hash);if(!m)return;
  history.replaceState(null,"",location.pathname+"#today");VIEW.tab="today";render();
  if(m[1]==="b10")setTimeout(function(){budgetPlan(10)},300);
  else if(m[1]==="b20")setTimeout(function(){budgetPlan(20)},300);
}

/* ===== Batch 2: flashcards, CSAT 10, before-test pack, weekly review, pace, strategy coach, notes read-tracking ===== */
TYPE_LABEL.csat10="CSAT 10";
(function(){var tg=typeGroup;typeGroup=function(t){return t==="csat10"?"subject":tg(t)}})();
/* --- notes read-tracking (PDF notes): furthest page reached, synced as nread_<id> --- */
function notesPagesRead(id){var r=DB.recs["nread_"+id];return r&&!r.del?r.p||0:0}
function notesDone(id){var n=M&&M.notes&&M.notes[id];return !!n&&notesPagesRead(id)>=Math.max(1,n.pages-1)}
function markNotesPage(id,p){var n=M&&M.notes&&M.notes[id];if(!n)return;if(p>notesPagesRead(id)){put("nread_"+id,{kind:"nread",set:id,p:p,pages:n.pages})}}
function notesBadge(id){var n=M&&M.notes&&M.notes[id];if(!n)return "";var p=notesPagesRead(id);return p?(notesDone(id)?'<span class="good small">Notes read</span>':'<span class="muted small">Notes: page '+p+' of '+n.pages+'</span>'):''}

/* --- flashcards from the mistake book --- */
var FC=null;
function fcRec(qid){var r=DB.recs["fc_"+qid.replace(/[^A-Za-z0-9_-]/g,"_")];return r&&!r.del?r:null}
function fcPick(subject,max){
  var mb=mistakeBook(),meta=qMeta();
  if(subject)mb=mb.filter(function(m){return (meta[m.qid]||[])[0]===subject});
  var now=Date.now();
  mb.forEach(function(m){var f=fcRec(m.qid);m.fcLast=f?f.last:0;m.fcKnew=f?f.knew:0});
  // due first, then not flashed recently; skip cards marked known in the last 2 days
  mb=mb.filter(function(m){return !(m.fcKnew&&now-m.fcLast<2*86400000)});
  mb.sort(function(a,b){return (b.isDue-a.isDue)||(a.fcLast-b.fcLast)||(a.due-b.due)});
  return mb.slice(0,max||20).map(function(m){return m.qid});
}
function startFlash(subject){
  var qids=fcPick(subject,20);
  if(!qids.length){toast(subject?"No "+subject+" mistakes to flash right now.":"Your mistake book is empty, or all cards were known recently.");return}
  $("app").innerHTML='<div class="page"><p class="muted">Shuffling your cards…</p></div>';
  loadQids(qids).then(function(qs){
    qs=qs.filter(function(q){return !q.x});
    if(!qs.length){VIEW.screen="tabs";render();toast("Could not load the cards.");return}
    FC={qs:qs,i:0,flip:false,knew:[],missed:[],subject:subject||""};
    VIEW.screen="flash";document.body.classList.add("in-quiz");window.scrollTo(0,0);drawFlash();
  }).catch(function(){VIEW.screen="tabs";render();toast("Could not load the cards. Check your connection.")});
}
function drawFlash(){
  if(!FC)return;
  if(FC.i>=FC.qs.length)return flashDone();
  var q=FC.qs[FC.i],L="abcd";
  var h='<div class="fc"><header class="fc-bar"><button class="btn small" id="fc-exit">Close</button><span class="muted small">Card '+(FC.i+1)+' of '+FC.qs.length+'</span><span class="small"><span class="good">'+FC.knew.length+' ✓</span> · <span class="bad-t">'+FC.missed.length+' ✗</span></span></header>'+
    '<div class="fc-prog"><i style="width:'+(FC.i/FC.qs.length*100)+'%"></i></div>'+
    '<article class="fc-card'+(FC.flip?" flipped":"")+'" id="fc-card"><p class="muted small">'+esc((q.sub||"")+(q.u?" · "+q.u:""))+'</p>'+
    (q.p?'<details class="fc-pass"><summary class="small">Show the passage</summary>'+passageHtml(q,false)+'</details>':'')+
    '<div class="qtext">'+esc(q.q)+'</div><ol class="fc-opts">'+q.o.map(function(o,k){return '<li class="'+(FC.flip?(String(k)===String(q.a)?"right":"dim"):"")+'"><b>'+L[k]+'</b> '+esc(o)+'</li>'}).join("")+'</ol>';
  if(FC.flip)h+='<div class="fc-ans"><p><b>Answer: '+L[+q.a]+'</b></p>'+(q.e?'<div class="small">'+paras(q.e)+'</div>':'')+(q.h?'<p class="hook small"><b>Memory hook:</b> '+esc(q.h)+'</p>':'')+'</div>';
  h+='</article><div class="fc-actions">'+(FC.flip?'<button class="btn big" id="fc-no">✗ Didn\'t know</button><button class="btn big primary" id="fc-yes">✓ Knew it</button>':'<button class="btn big primary wide" id="fc-show">Show answer</button>')+'</div>'+
    '<p class="muted small center">Think of the answer first. Swipe right if you knew it, left if you did not.</p></div>';
  $("app").innerHTML=h;
  $("fc-exit").onclick=flashDone;
  if($("fc-show"))$("fc-show").onclick=function(){FC.flip=true;drawFlash()};
  if($("fc-yes"))$("fc-yes").onclick=function(){flashMark(true)};
  if($("fc-no"))$("fc-no").onclick=function(){flashMark(false)};
  var card=$("fc-card"),x0=null;
  card.addEventListener("click",function(e){if(!FC.flip&&!e.target.closest("details")){FC.flip=true;drawFlash()}});
  card.addEventListener("touchstart",function(e){x0=e.touches[0].clientX},{passive:true});
  card.addEventListener("touchend",function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)<70)return;if(!FC.flip){FC.flip=true;drawFlash();return}flashMark(dx>0)});
}
function flashMark(knew){
  var q=FC.qs[FC.i],id="fc_"+q.qid.replace(/[^A-Za-z0-9_-]/g,"_"),f=fcRec(q.qid)||{};
  put(id,{kind:"fc",qid:q.qid,last:Date.now(),knew:knew?1:0,seen:(f.seen||0)+1,right:(f.right||0)+(knew?1:0)});
  (knew?FC.knew:FC.missed).push(q.qid);FC.i++;FC.flip=false;drawFlash();
}
function flashDone(){
  if(!FC)return;var k=FC.knew.length,m=FC.missed.slice(),n=k+m.length;
  if(!n){FC=null;document.body.classList.remove("in-quiz");VIEW.screen="tabs";render();return}
  $("app").innerHTML='<div class="page fc-end"><h1>Flashcards done</h1><p class="lead">You knew <b>'+k+'</b> of '+n+'.</p>'+
    (m.length?'<p class="muted">Flashcards do not change your scores. To clear the ones you missed from the mistake book, answer them in a short quiz: two right answers in a row removes a question.</p><div class="row wrap"><button class="btn primary" id="fc-quiz">Quiz me on the '+m.length+' I missed</button><button class="btn" id="fc-more">More cards</button><button class="btn ghost" id="fc-close">Done</button></div>':
     '<div class="row wrap"><button class="btn primary" id="fc-more">More cards</button><button class="btn ghost" id="fc-close">Done</button></div>')+'</div>';
  var subj=FC.subject;FC=null;
  var back=function(){document.body.classList.remove("in-quiz");VIEW.screen="tabs";render()};
  $("fc-close").onclick=back;
  $("fc-more").onclick=function(){document.body.classList.remove("in-quiz");startFlash(subj)};
  if($("fc-quiz"))$("fc-quiz").onclick=function(){document.body.classList.remove("in-quiz");startCustom({type:"revision",title:"Flashcard misses, "+fd(today()),subject:"Mixed",qids:m,timed:false})};
}

/* --- CSAT 10 a day: 3 comprehension (one passage), 4 numeracy/DI, 3 reasoning; unseen first; same set on every device --- */
function csat10Done(ds){return attempts().some(function(a){return a.type==="csat10"&&a.date===ds})}
function csat10Qids(ds){
  var r=DB.recs["csat10_"+ds];if(r&&!r.del&&r.qids)return r.qids;
  var seen={};attempts().forEach(function(a){(a.items||[]).forEach(function(x){seen[x[0]]=1})});
  Object.keys(DB.recs).forEach(function(k){if(k.indexOf("csat10_")===0&&DB.recs[k].qids)DB.recs[k].qids.forEach(function(q){seen[q]=1})});
  var bank=(M.bank.CSAT||[]).filter(function(x){return !seen[x[0]]});
  if(bank.length<30)bank=(M.bank.CSAT||[]).slice();
  var seed=dayNum(ds);function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
  function take(units,n){var pool=bank.filter(function(x){return units.indexOf(x[1])>=0});var out=[];while(out.length<n&&pool.length){out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0][0])}return out}
  // comprehension: pick one passage and take up to 3 of its questions (consecutive qids in the same paper)
  var comp=bank.filter(function(x){return x[1]==="Comprehension"}),cq=[];
  if(comp.length){var start=comp[Math.floor(rnd()*comp.length)][0],sid=start.split("#")[0],k=+start.split("#")[1];
    comp.forEach(function(x){var p=x[0].split("#");if(p[0]===sid&&Math.abs(+p[1]-k)<=2&&cq.length<3)cq.push(x[0])})}
  var q=cq.concat(take(["Basic Numeracy","Data Interpretation"],4),take(["Logical Reasoning","Analytical Ability"],10-cq.length-4));
  put("csat10_"+ds,{kind:"csat10",date:ds,qids:q});
  return q;
}
function startCsat10(){var ds=today();startCustom({type:"csat10",title:"CSAT 10, "+fd(ds),subject:"CSAT",qids:csat10Qids(ds),timed:true,limit:10*90,mk:CFG.CSAT_MK,arrange:true})}

/* --- before the Shankar test: notes, mistakes and linked current affairs for the coming test --- */
var CA_LINK={"Polity":["Polity & Governance"],"Economy":["Economy","Schemes, Reports & Indices","Financial & Trade Organisations"],"Environment":["Environment"],"Science & Tech":["Science & Tech","Defence & Security"],
  "Geography":["Places in News","Environment"],"History":["Culture, Sports & Awards"],"Current Affairs":["International Affairs","International Relations","Regional Organisations","United Nations"],"Mixed":["Polity & Governance","Economy"]};
function nextGsTest(td){return TESTS.filter(function(t){return !t.csat&&t.date>=td})[0]}
function testPack(td){
  var t=nextGsTest(td);if(!t)return "";var dl=dayNum(t.date)-dayNum(td);if(dl>2)return "";
  var sets=(M.sets||[]).filter(function(s){return s.testDate===t.date&&s.type==="daily"});
  var meta=qMeta(),mb=mistakeBook().filter(function(m){return (meta[m.qid]||[])[0]===t.subject||t.subject==="Mixed"});
  var noted=sets.filter(function(s){return M.notes&&M.notes[s.id]}),unread=noted.filter(function(s){return !notesDone(s.id)});
  var h='<section class="panel pack"><div class="row between wrap"><h2>'+(dl===0?"Shankar test today":dl===1?"Shankar test tomorrow":"Shankar test in 2 days")+'</h2><span class="muted small">'+fdw(t.date)+(dl===0?", 2 pm":"")+'</span></div><p><b>'+esc(t.name)+'</b></p><ol class="steps">';
  if(noted.length)h+='<li><b>Read the notes</b> <span class="muted small">'+(noted.length-unread.length)+' of '+noted.length+' read</span><div class="row wrap tight">'+noted.map(function(s){return '<button class="btn small'+(notesDone(s.id)?"":" primary")+'" data-notes="'+s.id+'">'+esc(s.dayLabel?s.dayLabel.replace(/ of \d+/,""):s.title)+(notesDone(s.id)?" ✓":"")+'</button>'}).join("")+'</div></li>';
  h+='<li><b>Revise your '+esc(t.subject)+' mistakes</b> <span class="muted small">'+mb.length+' in the book</span><div class="row wrap tight">'+(mb.length?'<button class="btn small primary" data-pack="mist">Quiz ('+Math.min(25,mb.length)+')</button><button class="btn small" data-pack="flash">Flashcards</button>':'<span class="muted small">None – well done.</span>')+'</div></li>';
  if(CA_LINK[t.subject])h+='<li><b>Linked current affairs</b> <span class="muted small">'+esc(CA_LINK[t.subject].join(", "))+'</span><div class="row wrap tight"><button class="btn small" data-pack="ca">20 questions</button></div></li>';
  h+='<li><b>Warm up</b> <span class="muted small">a timed 25 from this test\'s sets</span><div class="row wrap tight"><button class="btn small" data-pack="warm">Start</button></div></li></ol></section>';
  return h;
}
function packAction(a){
  var td=today(),t=nextGsTest(td);if(!t)return;
  var meta=qMeta();
  if(a==="mist"){var mb=mistakeBook().filter(function(m){return (meta[m.qid]||[])[0]===t.subject||t.subject==="Mixed"}).slice(0,25);startCustom({type:"revision",title:t.subject+" mistakes before "+t.name,subject:t.subject,qids:mb.map(function(m){return m.qid}),timed:false});return}
  if(a==="flash"){startFlash(t.subject==="Mixed"?"":t.subject);return}
  if(a==="ca"){var u=CA_LINK[t.subject]||[],pool=(M.bank["Current Affairs"]||[]).filter(function(x){return u.indexOf(x[1])>=0}).map(function(x){return x[0]});
    pool.sort(function(){return Math.random()-0.5});startCustom({type:"subject",title:"Current affairs for "+t.name,subject:"Current Affairs",qids:pool.slice(0,20),timed:true});return}
  if(a==="warm"){var ids=(M.sets||[]).filter(function(s){return s.testDate===t.date&&s.type==="daily"}).map(function(s){return s.id}),q=[];
    (M.bank[t.subject]||[]).forEach(function(x){if(ids.indexOf(x[0].split("#")[0])>=0)q.push(x[0])});q.sort(function(){return Math.random()-0.5});
    if(!q.length){toast("No sets for this test yet.");return}
    startCustom({type:"subject",title:"Warm-up for "+t.name,subject:t.subject,qids:q.slice(0,25),timed:true})}
}

/* --- quick revision card on Today: flashcards + CSAT 10 --- */
function quickCard(td){
  var due=0;try{due=mistakeBook().filter(function(m){return m.isDue}).length}catch(e){}
  var cd=csat10Done(td);
  return '<section class="panel quick"><h2>Quick revision</h2><ul class="list">'+
    '<li><div><b>Flashcards from mistakes</b><span class="muted small">'+(due?due+' due · one hand, about 5 minutes':'Swipe through past mistakes')+'</span></div><button class="btn small primary" data-quick="flash">Open</button></li>'+
    '<li><div><b>CSAT 10</b><span class="muted small">'+(cd?'Done today ✓':'3 comprehension, 4 numeracy, 3 reasoning · 15 minutes')+'</span></div><button class="btn small'+(cd?"":" primary")+'" data-quick="csat">'+(cd?"Again":"Start")+'</button></li></ul></section>';
}

/* --- week in review (Monday to Sunday) --- */
function weekStart(ds){var d=new Date(ds+"T00:00:00"),wd=(d.getDay()+6)%7;return addDays(ds,-wd)}
function weekData(ws){
  var we=addDays(ws,6),m=dayCounts(),days=[],goal=0,q=0,studied=0;
  for(var i=0;i<7;i++){var d=addDays(ws,i),g=goalOf(m[d]),o=m[d]||{s:0,c:0};days.push({d:d,g:g});if(g.done)goal++;if(g.any)studied++;q+=o.s+o.c}
  var logs=recs("log").filter(function(r){return r.date>=ws&&r.date<=we}),hours=0,reasons={};
  logs.forEach(function(r){hours+=+r.hours||0;(r.reasons||[]).forEach(function(x){reasons[x]=(reasons[x]||0)+1})});
  var cur=unitStats(ws,we),prev=unitStats(addDays(ws,-7),addDays(ws,-1)),subs=[],weak=[];
  Object.keys(cur).forEach(function(s){var a=accOf(cur[s]);if(a==null)return;var p=prev[s]?accOf(prev[s]):null;subs.push({s:s,a:a,p:p,n:cur[s].r+cur[s].w});
    Object.keys(cur[s].units).forEach(function(u){var o=cur[s].units[u],n=o.r+o.w;if(n>=8)weak.push({s:s,u:u,a:o.r/n*100,n:n})})});
  subs.sort(function(a,b){return b.n-a.n});weak.sort(function(a,b){return a.a-b.a});
  var tests=recs("test").filter(function(r){return r.date>=ws&&r.date<=we&&r.marks!=null&&r.marks!==""});
  var nt=TESTS.filter(function(t){return t.date>we&&t.date<=addDays(we,7)});
  return {ws:ws,we:we,days:days,goal:goal,studied:studied,q:q,hours:hours,logs:logs.length,reasons:reasons,subs:subs,weak:weak.slice(0,3),tests:tests,next:nt};
}
function weekSection(){
  var td=today(),thisWs=weekStart(td),ws=VIEW.weekWs||((new Date(td+"T00:00:00").getDay()===0)?thisWs:addDays(thisWs,-7));
  if(ws<weekStart(CFG.START))ws=weekStart(CFG.START);
  var w=weekData(ws),bl=catchupBacklog();
  var h='<section class="panel" id="week-review"><div class="row between wrap"><h2>Week in review</h2><div class="row tight"><button class="btn small ghost" data-wk="-7" aria-label="Previous week">‹</button><span class="small">'+fd(w.ws)+' – '+fd(w.we)+'</span><button class="btn small ghost" data-wk="7" aria-label="Next week"'+(addDays(ws,7)>thisWs?" disabled":"")+'>›</button></div></div>';
  h+='<div class="weekdots">'+w.days.map(function(x){var c=x.d>td?"fut":(x.g.done?"done":(x.g.any?"part":"miss"));return '<span class="wd '+c+'" title="'+esc(fdw(x.d)+": "+x.g.tot+"/75")+'"><b>'+["M","T","W","T","F","S","S"][(new Date(x.d+"T00:00:00").getDay()+6)%7]+'</b><i>'+(x.d>td?"":x.g.tot)+'</i></span>'}).join("")+'</div>';
  h+='<dl class="kpis"><div><dt>Goal days</dt><dd>'+w.goal+' / 7</dd></div><div><dt>Days studied</dt><dd>'+w.studied+'</dd></div><div><dt>Questions</dt><dd>'+w.q+'</dd></div><div><dt>Hours logged</dt><dd>'+(w.logs?r1(w.hours):"–")+'</dd></div></dl>';
  if(w.subs.length)h+='<h3>Accuracy this week</h3><table class="tbl"><thead><tr><th>Subject</th><th>Questions</th><th>Accuracy</th><th>vs last week</th></tr></thead><tbody>'+w.subs.map(function(x){var d=x.p==null?null:x.a-x.p;return '<tr><td>'+esc(x.s)+'</td><td>'+x.n+'</td><td>'+Math.round(x.a)+'%</td><td class="'+(d==null?"":(d>=0?"pos":"neg"))+'">'+(d==null?"–":(d>=0?"+":"")+Math.round(d)+" pts")+'</td></tr>'}).join("")+'</tbody></table>';
  if(w.weak.length)h+='<h3>Weakest units this week</h3><ul class="plain small">'+w.weak.map(function(x){return '<li><b>'+esc(x.u)+'</b> ('+esc(x.s)+') – '+Math.round(x.a)+'% on '+x.n+' questions</li>'}).join("")+'</ul>';
  var rs=Object.keys(w.reasons).sort(function(a,b){return w.reasons[b]-w.reasons[a]});
  if(rs.length)h+='<p class="small"><b>What got in the way:</b> '+rs.slice(0,3).map(function(r){return esc(r)+" ("+w.reasons[r]+")"}).join(", ")+'</p>';
  if(w.tests.length)h+='<p class="small"><b>Shankar tests:</b> '+w.tests.map(function(t){return esc(t.name)+" – "+t.marks+" / "+(t.max||200)}).join("; ")+'</p>';
  var focus=[];
  if(w.next.length)focus.push("Prepare for "+w.next.map(function(t){return t.name+" ("+fdw(t.date)+")"}).join(" and ")+".");
  if(w.weak.length)focus.push("Retest "+w.weak.slice(0,2).map(function(x){return x.u}).join(" and ")+".");
  if(bl.parts)focus.push("Catch up "+bl.parts*10+" questions from missed sets.");
  if(w.goal<5&&w.ws<thisWs)focus.push("Aim for at least 5 goal days; a 10-minute part on hard days keeps the chain going.");
  if(focus.length)h+='<div class="focus"><b>Focus for next week</b><ul class="plain small">'+focus.map(function(f){return '<li>'+esc(f)+'</li>'}).join("")+'</ul></div>';
  return h+'</section>';
}
function weekCard(td){
  var wd=new Date(td+"T00:00:00").getDay();if(wd!==0&&wd!==1)return "";
  var w=weekData(wd===0?weekStart(td):addDays(weekStart(td),-7));
  return '<section class="panel weekcard"><div class="row between wrap"><div><h2>'+(wd===0?"Your week so far":"Last week in review")+'</h2><p class="small">'+w.goal+' goal day'+(w.goal===1?"":"s")+' · '+w.q+' questions'+(w.weak[0]?' · weakest: '+esc(w.weak[0].u):'')+'</p></div><button class="btn small primary" data-gowk="1">Open review</button></div></section>';
}

/* --- pace to Prelims --- */
function paceData(){
  var td=today(),done=setDoneMap(),all=(M.sets||[]).filter(function(s){return s.type==="daily"&&s.n===50}),due=all.filter(function(s){return s.date<=td});
  var nDone=all.filter(function(s){return done[s.id]}).length;
  // rate: daily-set questions answered in the last 14 days
  var from=addDays(td,-13),qs=0;attempts().forEach(function(a){if(a.date>=from&&(a.type==="daily"||a.type==="bonus"))qs+=a.n||0});
  var rate=qs/50/14,left=all.length-nDone,last=all.reduce(function(m,s){return s.date>m?s.date:m},td);
  var proj=rate>0?addDays(td,Math.ceil(left/rate)):null,daysLeft=dayNum(CFG.PRELIMS)-dayNum(td);
  return {total:all.length,done:nDone,due:due.length,behind:Math.max(0,due.length-nDone),rate:rate,left:left,last:last,proj:proj,daysLeft:daysLeft,
    testsLeft:TESTS.filter(function(t){return t.date>=td}).length};
}
function paceSection(){
  var p=paceData(),pct=p.total?p.done/p.total*100:0,exp=p.total?p.due/p.total*100:0;
  var verdict=p.behind===0?'<span class="good">On schedule</span>':(p.behind<=3?'<span class="warn-t">'+p.behind+' set'+(p.behind>1?"s":"")+' behind</span>':'<span class="bad-t">'+p.behind+' sets behind</span>');
  var h='<section class="panel"><h2>Pace to Prelims</h2><dl class="kpis"><div><dt>Days left</dt><dd>'+p.daysLeft+'</dd></div><div><dt>Daily sets done</dt><dd>'+p.done+' / '+p.total+'</dd></div><div><dt>Status</dt><dd class="small">'+verdict+'</dd></div><div><dt>Shankar tests left (GS + CSAT)</dt><dd>'+p.testsLeft+'</dd></div></dl>'+
    '<div class="pacebar" aria-label="Syllabus progress"><i style="width:'+pct.toFixed(1)+'%"></i><b style="left:'+exp.toFixed(1)+'%" title="Where the schedule is today"></b></div><p class="muted small">Bar: sets done. Marker: where the schedule is today.</p>';
  if(p.rate>0){var ok=p.proj<=p.last;h+='<p class="small">At your last-14-day pace ('+r1(p.rate*7)+' sets a week) you finish the sets on <b>'+fdw(p.proj)+'</b>, '+(ok?'in time for the schedule ('+fd(p.last)+') and the revision months before Prelims.':'after the scheduled end ('+fd(p.last)+'). Raising the catch-up pace on the Today tab closes this gap.')+'</p>'}
  else h+='<p class="small">No daily sets in the last 14 days yet, so there is no pace to project.</p>';
  return h+'</section>';
}

/* --- attempt-strategy coach (GS marking: +2 right, −0.66 wrong; break-even accuracy about 25%) --- */
function coachSection(){
  var it=[],strike={n:0,r:0};attempts().forEach(function(a){if(a.mk||a.subject==="CSAT"||a.type==="csat10")return;(a.items||[]).forEach(function(x){it.push(x);if(x[8]&&x[4]!==-1&&x[4]!==2){strike.n++;if(x[4]===1)strike.r++}})});
  var o=confStats(it),tagged=o[1].n+o[2].n+o[3].n;
  var h='<section class="panel"><h2>Attempt strategy coach</h2>';
  if(tagged<30)return h+'<p class="muted">Tag at least 30 answers as Sure, 50-50 or Guess (GS tests) and the coach will tell you which kinds of questions to attempt. So far: '+tagged+'.</p></section>';
  function ev(c){var s=o[c];return s.n?(2*s.r-0.66*s.w)/s.n:0}
  function acc(c){var s=o[c];return s.n?s.r/s.n*100:0}
  var rows=[[1,"Sure"],[2,"50-50"],[3,"Guess"]].filter(function(r){return o[r[0]].n}).map(function(r){var c=r[0];return '<tr><td>'+r[1]+'</td><td>'+o[c].n+'</td><td>'+Math.round(acc(c))+'%</td><td class="'+(ev(c)>=0?"pos":"neg")+'">'+(ev(c)>=0?"+":"")+ev(c).toFixed(2)+'</td></tr>'}).join("");
  h+='<table class="tbl"><thead><tr><th>Your tag</th><th>Answers</th><th>Accuracy</th><th>Marks per attempt</th></tr></thead><tbody>'+rows+'</tbody></table>';
  var tips=[];
  if(o[1].n>=10){if(acc(1)<85)tips.push("Your Sure answers are right only "+Math.round(acc(1))+"% of the time. Before marking, re-read every statement for words like only, all, always and never: most of these misses are reading slips, not knowledge gaps.");else tips.push("Your Sure answers are reliable ("+Math.round(acc(1))+"%). Attempt all of them in the exam.")}
  if(o[2].n>=10){if(acc(2)>=40)tips.push("Keep attempting 50-50 questions: at "+Math.round(acc(2))+"% each one is worth about "+ev(2).toFixed(2)+" marks on average. Skipping them would cost you.");else if(acc(2)>=25)tips.push("Your 50-50 answers are just above break-even ("+Math.round(acc(2))+"%). Attempt them only after you have eliminated two options.");else tips.push("Your 50-50 answers lose marks ("+Math.round(acc(2))+"%). Skip them unless you can eliminate two options with certainty.")}
  if(o[3].n>=10){if(acc(3)<25)tips.push("Pure guesses are right only "+Math.round(acc(3))+"% of the time, below the 25% break-even. Leave them blank in the exam.");else tips.push("Your guesses beat the 25% break-even ("+Math.round(acc(3))+"%), which usually means your elimination is better than you think. Attempt a guess when you can strike out at least one option.")}
  if(strike.n>=15)tips.push("When you cross out options, you get "+Math.round(strike.r/strike.n*100)+"% right"+(strike.r/strike.n>=0.5?", so elimination is working: use it on every doubtful question.":". Check the options you strike: the right answer may be getting crossed out."));
  h+='<ul class="plain small coach">'+tips.map(function(t){return '<li>'+esc(t)+'</li>'}).join("")+'</ul><p class="muted small">Break-even: with +2 for right and −0.66 for wrong, an attempt pays off when you are right more than about 25% of the time.</p>';
  return h+'</section>';
}
function bindBatch2(){
  qsa("[data-quick]").forEach(function(b){b.onclick=function(){if(b.dataset.quick==="flash")startFlash("");else startCsat10()}});
  qsa("[data-pack]").forEach(function(b){b.onclick=function(){packAction(b.dataset.pack)}});
  qsa("[data-wk]").forEach(function(b){b.onclick=function(){var td=today(),cur=VIEW.weekWs||((new Date(td+"T00:00:00").getDay()===0)?weekStart(td):addDays(weekStart(td),-7));VIEW.weekWs=addDays(cur,+b.dataset.wk);render();var e=$("fold-week");if(e)e.scrollIntoView()}});
  qsa("[data-gowk]").forEach(function(b){b.onclick=function(){DB.meta.fold=DB.meta.fold||{};DB.meta.fold.week=true;saveStore();VIEW.tab="dash";location.hash="dash";render();setTimeout(function(){var e=$("fold-week");if(e)e.scrollIntoView({behavior:"smooth"})},60)}});
  qsa("[data-flashsub]").forEach(function(b){b.onclick=function(){startFlash(b.dataset.flashsub)}});
}

/* ===== Simple layout: status first, details folded (Today and Dashboard) ===== */
function foldOpen(id,def){var f=DB.meta.fold||{};return id in f?!!f[id]:!!def}
function fold(id,title,sum,body,def,cls){
  return '<details class="fold'+(cls?" "+cls:"")+'" data-fold="'+id+'" id="fold-'+id+'"'+(foldOpen(id,def)?" open":"")+'><summary><span class="fold-t">'+title+'</span><span class="fold-s">'+sum+'</span></summary><div class="fold-b">'+body+'</div></details>';
}
// take a "<section class=panel>…<h2>Title</h2>…</section>" block and keep only its inside, without the heading
function unwrap(h){
  if(!h)return "";
  h=h.replace(/^\s*<section[^>]*>/,"").replace(/<\/section>\s*$/,"");
  return h.replace(/<h2>[^<]*<\/h2>/,"");
}
function bindFolds(rerender){
  qsa("details[data-fold]").forEach(function(d){d.addEventListener("toggle",function(){DB.meta.fold=DB.meta.fold||{};if(DB.meta.fold[d.dataset.fold]===d.open)return;DB.meta.fold[d.dataset.fold]=d.open;saveStore();if(rerender&&d.open)render()})});
  qsa("[data-gofold]").forEach(function(b){b.onclick=function(){var id=b.dataset.gofold;DB.meta.fold=DB.meta.fold||{};DB.meta.fold[id]=true;saveStore();render();setTimeout(function(){var e=$("fold-"+id);if(e)e.scrollIntoView({behavior:"smooth",block:"start"})},60)}});
}
function chip(txt,cls,go){return go?'<button class="chip '+(cls||"")+'" data-gofold="'+go+'">'+txt+'</button>':'<span class="chip '+(cls||"")+'">'+txt+'</span>'}
function stIcon(s){return '<span class="sti '+s+'" aria-hidden="true">'+({done:"✓",part:"◐",todo:"",opt:"+"}[s]||"")+'</span>'}

/* ---------- Today ---------- */
function todayHero(td){
  var m=dayCounts(),g=goalOf(m[td]),st=goalStreaks(),y=addDays(td,-1),gy=goalOf(m[y]),left=GOAL_S+GOAL_C-g.tot;
  var due=0;try{due=mistakeBook().filter(function(x){return x.isDue}).length}catch(e){}
  var nt=nextGsTest(td),dl=nt?dayNum(nt.date)-dayNum(td):null,bl=catchupBacklog();
  var msg=g.done?"Today's 50 + 25 is complete. Well done.":(g.any?left+" questions to go: "+(GOAL_S-g.s)+" subject and "+(GOAL_C-g.c)+" current affairs.":
    (y>=CFG.START&&!gy.done?(gy.any?"Yesterday: "+gy.tot+" of 75. ":"Yesterday slipped by. ")+"Fresh start today – even one 10-minute part keeps you moving.":"Start with today's plan below."));
  var chips=[chip("🔥 Streak "+st.cur+(st.best?" · best "+st.best:""),st.cur?"good":""),
    due?chip(due+" mistakes due","warn","plan"):chip("No mistakes due","good"),
    bl.parts?chip(bl.list.length+" set"+(bl.list.length>1?"s":"")+" behind","warn","catchup"):chip("On schedule","good"),
    nt?chip((dl===0?"Shankar test today":dl===1?"Test tomorrow":"Test in "+dl+" days")+": "+esc(nt.subject),dl<=2?"bad":"", dl<=2?"pack":"days"):""];
  return '<section class="panel hero'+(g.done?" done":"")+'"><div class="goal-row">'+ringSvg(g.tot/(GOAL_S+GOAL_C),g.tot+"/75","today")+
    '<div class="goal-txt"><div class="goal-bars"><div><span class="small">Subject</span><div class="gbar"><i style="width:'+(g.s/GOAL_S*100)+'%"></i></div><span class="small num">'+g.s+' / '+GOAL_S+'</span></div>'+
    '<div><span class="small">Current affairs</span><div class="gbar"><i style="width:'+(g.c/GOAL_C*100)+'%"></i></div><span class="small num">'+g.c+' / '+GOAL_C+'</span></div></div>'+
    '<p class="hero-msg">'+esc(msg)+'</p></div></div><div class="chips">'+chips.join("")+'</div></section>';
}
function todayPlan(td){
  var done=setDoneMap(),rows=[],set=todaysOpenSet(),schToday=schedFor(td).filter(function(s){return s.ready&&s.type!=="ca"&&s.n===50});
  // 1. notes + subject set
  if(set){
    var pdn=partsDone(set.id),np=Object.keys(pdn).length,nxt=[1,2,3,4,5].filter(function(k){return !pdn[k]})[0];
    var hasN=M.notes&&M.notes[set.id];
    if(hasN&&!notesDone(set.id))rows.push([notesPagesRead(set.id)?"part":"todo","Read the notes",esc(M.notes[set.id].title)+' · '+(notesPagesRead(set.id)?'page '+notesPagesRead(set.id)+' of ':'')+M.notes[set.id].pages+' pages','<button class="btn small primary" data-notes="'+set.id+'">Read</button>']);
    var late=set.date<td?' · from '+fdw(set.date):'';
    rows.push([np?"part":"todo","Subject: 50 questions",esc(set.title)+late+(np?' · '+np+' of 5 parts done':''),
      (np?'<button class="btn small primary" data-part="'+set.id+'|'+nxt+'">Part '+nxt+'</button>':'<button class="btn small primary" data-start="'+set.id+'">Start</button>')]);
  }else if(schToday.length)rows.push(["done","Subject: 50 questions","Today's set is done",""]);
  else rows.push(["done","Subject: 50 questions","No set due – revision or a subject test from Practice is a good use of time",""]);
  // 2. current affairs 25
  var cd=camDoneOn(td),nx=nextCamSet();
  rows.push([cd?"done":"todo","Current affairs: 25 questions",cd?"Done for today":(nx?esc(monthLabel(nx.month))+': '+esc(nx.category):"Revision set: past mistakes and news you have not seen lately"),
    cd?'':(nx?'<button class="btn small primary" data-start="'+nx.id+'">Start</button>':'<button class="btn small primary" id="cam-rev">Start</button>')]);
  // 3. catch-up
  var bl=catchupBacklog();
  if(bl.parts){var b0=bl.list[0],pace=DB.meta.cuPace||20;rows.push(["todo","Catch-up: "+pace+" extra questions",esc(b0.s.title)+' · part '+b0.left[0]+' of 5 · '+bl.parts*10+' questions behind','<button class="btn small" data-part="'+b0.s.id+'|'+b0.left[0]+'">Start</button>'])}
  // 4. mistakes
  var due=0;try{due=mistakeBook().filter(function(x){return x.isDue}).length}catch(e){}
  if(due)rows.push(["todo","Revise "+due+" due mistake"+(due>1?"s":""),"Quiz to clear them, or flashcards for a quick look",'<div class="row tight"><button class="btn small" data-quick="flash">Cards</button><button class="btn small" id="plan-rev">Quiz</button></div>']);
  // 5. CSAT 10 (optional)
  var c10=csat10Done(td);
  rows.push([c10?"done":"opt","CSAT 10 <span class=\"muted small\">optional</span>",c10?"Done today":"3 comprehension, 4 numeracy, 3 reasoning · 15 min",c10?'':'<button class="btn small" data-quick="csat">Start</button>']);
  // 6. log
  var lr=logRec(td);
  rows.push([lr?"done":"todo","Log your day",lr?logLine(lr):"Hours, what you covered, what got in the way",'<button class="btn small'+(lr?" ghost":"")+'" data-log="'+td+'">'+(lr?"Edit":"Add")+'</button>']);
  var nDone=rows.filter(function(r){return r[0]==="done"}).length;
  return '<section class="panel plan" id="fold-plan"><div class="row between"><h2>Today\'s plan</h2><span class="muted small">'+nDone+' of '+rows.length+' done</span></div><ul class="plan-list">'+
    rows.map(function(r){return '<li class="pl-'+r[0]+'">'+stIcon(r[0])+'<div class="pl-t"><b>'+r[1]+'</b><span class="small muted">'+r[2]+'</span></div>'+r[3]+'</li>'}).join("")+'</ul>'+
    '<div class="row wrap tight short"><span class="muted small">Short on time?</span>'+[10,20,40].map(function(m){return '<button class="btn small ghost" data-budget="'+m+'">'+m+' min</button>'}).join("")+'</div></section>';
}
function viewToday(){
  var td=today(),v=$("view");
  var dates=Object.keys(BYDATE).sort();
  var sel=VIEW.sel||(BYDATE[td]?td:(dates.filter(function(d){return d>td})[0]||td));
  if(VIEW.month==null){var d=pd(sel);VIEW.month=[d.getFullYear(),d.getMonth()]}
  var html='<div class="pagehead"><div><h1>'+fdw(td)+'</h1><p class="muted">'+daysLeftLine(td)+'</p></div></div>';
  html+=todayHero(td);
  var runs=pausedRuns();
  if(runs.length)html+='<section class="panel"><h2>Paused tests</h2><ul class="list">'+runs.map(function(r){return '<li><div><b>'+esc(r.title)+'</b><span class="muted">'+r.done+' of '+r.n+' answered'+(r.timed?', '+fmtMin(Math.max(0,r.limit-r.el))+' left':'')+'</span></div><div class="row"><button class="btn primary small" data-resume="'+esc(r.id)+'">Resume</button><button class="btn ghost small" data-discard="'+esc(r.id)+'">Discard</button></div></li>'}).join("")+'</ul></section>';
  html+=todayPlan(td);
  var nt=nextGsTest(td),dl=nt?dayNum(nt.date)-dayNum(td):99,pack=testPack(td);
  if(pack)html+=fold("pack",(dl===0?"Shankar test today":dl===1?"Shankar test tomorrow":"Shankar test in 2 days"),esc(nt.name),unwrap(pack).replace(/^<div class="row between wrap">[\s\S]*?<\/div>/,""),dl<=1,"alert");
  html+=weekCard(td)+remindCard(true);
  // details, folded with a one-line status
  var month=0,missed=0,done=setDoneMap();Object.keys(BYDATE).forEach(function(d){if(d.slice(0,7)!==td.slice(0,7)||d>td)return;var s=dayState(d,done,td).st;if(s==="done")month++;else if(s==="missed")missed++});
  html+=fold("days","Calendar and sets",month+" full day"+(month===1?"":"s")+" this month"+(missed?" · "+missed+" missed":""),'<div class="cols wide-left">'+dayPanel(sel,td)+calendarPanel(sel,td)+'</div>',false,"plain");
  var bl=catchupBacklog();
  if(bl.list.length){var pace=DB.meta.cuPace||20,fin=addDays(td,Math.ceil(bl.parts/Math.max(1,Math.round(pace/10)))-1);html+=fold("catchup","Catch-up plan",bl.list.length+" set"+(bl.list.length>1?"s":"")+" behind · back on track by "+fd(fin),unwrap(catchupCard(td)).replace(/^<div class="row between wrap">[\s\S]*?<\/div>/,""),false)}
  var c=DB.recs["chk_"+td],lr=logRec(td);
  html+=fold("checkin","Check-in and study log",(c&&!c.del?"Checked in ("+(c.v==="yes"?"Yes":"No")+")":"Not checked in")+" · "+(lr?"log added":"no log yet")+" · study streak "+streak(),checkinCard(td)+logCard(td,"Today's study log"),false,"plain");
  var t=TESTS.filter(function(x){return x.date>=td})[0];
  html+=fold("days-info","Shankar test days",t?"Next: "+esc(t.name)+", "+fdw(t.date):"All tests are over",'<ul class="plain small"><li>General Studies tests run 2 to 4 pm, with a live discussion at 4:30 pm.</li><li>CSAT tests run 2 to 4 pm; the recorded discussion is uploaded at 4:30 pm.</li><li>Tests are offline and online. Your admission ID is the user name and password for the test portal.</li><li>Refer to the India Year Book for every test; mock tests cover IYB 2025.</li></ul><ul class="list">'+TESTS.filter(function(x){return x.date>=td}).slice(0,8).map(function(x){return '<li><div><b>'+esc(x.name)+'</b><span class="muted small">'+fdw(x.date)+'</span></div></li>'}).join("")+'</ul>',false);
  var bonus=M.sets.filter(function(s){return s.type==="bonus"&&s.ready});
  if(bonus.length)html+=fold("extra","Extra practice",bonus.length+" set"+(bonus.length>1?"s":""),'<ul class="list">'+bonus.map(function(s){return '<li><div><b>'+esc(s.title)+'</b><span class="muted">'+s.n+' questions</span></div><button class="btn small" data-start="'+s.id+'">Start</button></li>'}).join("")+'</ul>',false);
  v.innerHTML=html;
  bindToday();bindFolds(false);
  if($("plan-rev"))$("plan-rev").onclick=function(){startRevision(false)};
}

/* ---------- Dashboard ---------- */
function dashGlance(){
  var td=today(),p=paceData(),it=[],last30=0,max30=0,prev=0,pmax=0;
  attempts().forEach(function(a){var dd=dayNum(td)-dayNum(a.date);if(dd<30){last30+=a.pts||0;max30+=a.max||0}else if(dd<60){prev+=a.pts||0;pmax+=a.max||0}});
  var sc=max30?last30/max30*100:null,psc=pmax?prev/pmax*100:null;
  var st=unitStats(),R=0,W=0,weak=null;Object.keys(st).forEach(function(s){R+=st[s].r;W+=st[s].w;Object.keys(st[s].units).forEach(function(u){var o=st[s].units[u],n=o.r+o.w;if(n>=10){var a=o.r/n;if(!weak||a<weak.a)weak={u:u,s:s,a:a}}})});
  var acc=R+W?R/(R+W)*100:null,w=weekData(weekStart(td));
  var gs=testMarks().filter(function(t){return t.marks!=null&&t.marks!==""&&t.subject!=="CSAT"&&!(TESTBYKEY[t.k]||{}).csat}).sort(function(a,b){return a.date<b.date?-1:1}),lg=gs[gs.length-1];
  function tile(lab,val,sub,cls,go){return '<button class="tile '+(cls||"")+'" data-gofold="'+go+'"><span class="t-l">'+lab+'</span><span class="t-v">'+val+'</span><span class="t-s">'+sub+'</span></button>'}
  var col=function(v,g,b){return v==null?"":(v>=g?"good":(v<b?"bad":"warn"))};
  return '<div class="tiles">'+
    tile("Prelims",p.daysLeft+" days","24 May 2027","","pace")+
    tile("Syllabus",p.done+" / "+p.total,p.behind?p.behind+" sets behind":"on schedule",p.behind>3?"bad":(p.behind?"warn":"good"),"pace")+
    tile("Score, last 30 days",sc==null?"–":Math.round(sc)+"%",psc==null||sc==null?"all tests":((sc>=psc?"▲ ":"▼ ")+Math.abs(Math.round(sc-psc))+" pts vs before"),col(sc,60,40),"perf")+
    tile("Accuracy",acc==null?"–":Math.round(acc)+"%","right of attempted",col(acc,75,50),"subj")+
    tile("This week",w.goal+" / 7","goal days so far",w.goal>=5?"good":(w.goal>=3?"warn":"bad"),"week")+
    tile("Latest Shankar GS",lg?Math.round(lg.marks/(lg.max||200)*100)+"%":"–",lg?esc(lg.name||""):"enter marks in Scores",lg?col(lg.marks/(lg.max||200)*100,60,40):"","shankar")+
    (function(){var due=0;try{due=mistakeBook().filter(function(x){return x.isDue}).length}catch(e){}return tile("Mistakes due",due,"for revision today",due>40?"bad":(due?"warn":"good"),"coach")})()+
    tile("Weakest unit",weak?Math.round(weak.a*100)+"%":"–",weak?esc(weak.u):"not enough data yet",weak?"bad":"","subj")+
    '</div>';
}

/* ===== Notes tab: everything to read, by subject (study notes, unit sheets, fact tables, CA booklets) + rapid fire ===== */
TABS.splice(2,0,["read","Notes"]);
ICON.read='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.5-1 5-1 8 1 3-2 5.5-2 8-1v13c-2.5-1-5-1-8 1-3-2-5.5-2-8-1z"/><path d="M12 6.5v13"/></svg>';
var FACTS=null;
function loadFacts(){if(FACTS)return Promise.resolve(FACTS);return fetch("data/facts.json").then(function(r){return r.json()}).then(function(d){FACTS=d.tables;return FACTS})}
var READ_SUBJ=["Polity","History","Geography","Economy","Environment","Science & Tech","Current Affairs"];
// which study-note PDFs belong to which subject (set notes follow their set; topic notes are listed here)
var NOTE_SUBJ={SRI:["Economy","Current Affairs"],SPP:["Environment"],GSCH:["Economy","Current Affairs","Polity"]};
var NOTE_SETS={SRI:"sri",SPP:"spp",GSCH:"sri"};
var CA_CAT_FOR={"Polity":/Polity/i,"Economy":/Economy|Schemes/i,"Environment":/Environment/i,"Science & Tech":/Science/i,"History":/Culture/i,"Geography":/Environment|International/i};
function noteSubjects(id){if(NOTE_SUBJ[id])return NOTE_SUBJ[id];var s=(M.sets||[]).filter(function(x){return x.id===id})[0];return s?(s.subjects||[s.subject]):[]}
function studyNotes(subj){return Object.keys(M.notes||{}).filter(function(id){return noteSubjects(id).indexOf(subj)>=0}).map(function(id){return {id:id,n:M.notes[id]}})}
function camRead(id){var s=(M.sets||[]).filter(function(x){return x.id===id})[0];return {p:notesRead(id),n:s&&s.n||25}}
function continueList(){
  var out=[];
  Object.keys(M.notes||{}).forEach(function(id){var p=notesPagesRead(id),n=M.notes[id].pages;if(p>0&&p<n-1)out.push({kind:"pdf",id:id,title:M.notes[id].title,p:p,n:n})});
  camSets().forEach(function(s){var r=camRead(s.id);if(r.p>0&&r.p<r.n)out.push({kind:"cam",id:s.id,title:s.title,p:r.p,n:r.n})});
  return out.slice(0,4);
}
function readRow(title,sub,btns,state){return '<li class="rd-'+(state||"todo")+'"><div><b>'+title+'</b><span class="muted small">'+sub+'</span></div><div class="row tight">'+btns+'</div></li>'}
function viewRead(){
  var v=$("view"),subj=VIEW.readSub||((todaysOpenSet()||{}).subject)||"Polity";if(READ_SUBJ.indexOf(subj)<0)subj="Polity";VIEW.readSub=subj;
  var html='<div class="pagehead"><div><h1>Notes</h1><p class="muted">Everything to read, by subject. Each note links to its test, so you can read and then check yourself.</p></div></div>';
  var cl=continueList();
  if(cl.length)html+='<section class="panel"><h2>Continue reading</h2><ul class="list">'+cl.map(function(x){return readRow(esc(x.title),'Page '+x.p+' of '+x.n,'<button class="btn small primary" data-'+(x.kind==="pdf"?"notes":"camread")+'="'+x.id+'">Continue</button>',"part")}).join("")+'</ul></section>';
  html+='<section class="panel quicktools"><div class="row wrap"><button class="btn" data-rf="all">⚡ Rapid fire</button><button class="btn" data-quick="flash">Flashcards from mistakes</button></div><p class="muted small">Rapid fire: quick one-line facts from the fact tables, about 8 seconds each.</p></section>';
  html+='<div class="subjchips" role="tablist">'+READ_SUBJ.map(function(s){return '<button role="tab" class="chip'+(s===subj?" on":"")+'" data-rsub="'+esc(s)+'" aria-selected="'+(s===subj)+'">'+esc(s)+'</button>'}).join("")+'</div>';
  // 1. study notes
  var sn=studyNotes(subj),done=setDoneMap();
  var snBody=sn.length?'<ul class="list">'+sn.map(function(x){var p=notesPagesRead(x.id),rd=notesDone(x.id),ts=NOTE_SETS[x.id];
      var test=ts?'<button class="btn small" data-rtest="'+ts+'">Test</button>':((M.sets||[]).some(function(s){return s.id===x.id})?'<button class="btn small" data-start="'+x.id+'">'+(done[x.id]?"Retake":"Test")+'</button>':'');
      return readRow(esc(x.n.title),x.n.pages+' pages'+(rd?' · read ✓':(p?' · page '+p+' of '+x.n.pages:'')),'<button class="btn small'+(rd?"":" primary")+'" data-notes="'+x.id+'">'+(rd?"Read again":(p?"Continue":"Read"))+'</button>'+test,rd?"done":(p?"part":"todo"))}).join("")+'</ul>':
    '<p class="muted small">No study notes for '+esc(subj)+' yet. Notes for each day\'s set are added in 6-day batches.</p>';
  var snRead=sn.filter(function(x){return notesDone(x.id)}).length;
  html+=fold("rd-notes","Study notes",sn.length?snRead+" of "+sn.length+" read":"none yet",snBody,true);
  // 2. one-page unit sheets
  if(subj!=="Current Affairs"){
    var st=unitStats()[subj]||{units:{}},units=(UNITLIST[subj]||[]).slice();Object.keys(st.units).forEach(function(u){if(units.indexOf(u)<0)units.push(u)});
    var weakN=0;
    var ub='<p class="muted small">One page per unit: your mistakes, what UPSC asked, memory hooks and key facts from the question bank. Weak units first.</p><ul class="list">'+
      units.map(function(u){var x=st.units[u]||{r:0,w:0},n=x.r+x.w,s_=n?unitStatus(x):"nodata";if(s_==="weak")weakN++;return {u:u,n:n,a:n?x.r/n:1.1,s:s_}}).sort(function(a,b){return a.a-b.a}).map(function(o){
        return readRow(esc(o.u),o.n?Math.round(o.a*100)+'% on '+o.n+' questions · <span class="tag '+o.s+'">'+STATUS_LABEL[o.s]+'</span>':'Not attempted yet','<button class="btn small'+(o.s==="weak"?" primary":"")+'" data-sheet="'+esc(subj)+'|'+esc(o.u)+'">Sheet</button>',o.s==="strong"?"done":"todo")}).join("")+'</ul>';
    html+=fold("rd-sheets","One-page unit sheets",units.length+" units"+(weakN?" · "+weakN+" weak":""),ub,false);
  }
  // 3. fact tables
  var ft=(FACTS||[]).filter(function(t){return t.subject===subj||(t.subjects||[]).indexOf(subj)>=0});
  if(!FACTS)loadFacts().then(function(){if(VIEW.tab==="read"&&VIEW.screen==="tabs")render()}).catch(function(){});
  if(ft.length)html+=fold("rd-facts","Fact tables",ft.length+" table"+(ft.length>1?"s":"")+" · "+ft.reduce(function(a,t){return a+t.rows.length},0)+" facts",
    '<ul class="list">'+ft.map(function(t){return readRow(esc(t.title),t.rows.length+' rows','<button class="btn small primary" data-facts="'+t.id+'">Open</button><button class="btn small" data-rf="'+t.id+'">Rapid fire</button>')}).join("")+'</ul>',false);
  // 4. current affairs booklets (all months for CA; linked categories for other subjects)
  var cams=camSets().filter(function(s){return subj==="Current Affairs"||(CA_CAT_FOR[subj]&&CA_CAT_FOR[subj].test(s.category||""))});
  if(cams.length){
    var byM={};cams.forEach(function(s){(byM[s.month]=byM[s.month]||[]).push(s)});
    var readN=cams.filter(function(s){var r=camRead(s.id);return r.p>=r.n}).length;
    var cb=Object.keys(byM).sort().map(function(mk){return '<h3>'+esc(monthLabel(mk))+'</h3><ul class="list">'+byM[mk].map(function(s){var r=camRead(s.id),dn=r.p>=r.n;
      return readRow(esc(s.category),(dn?'read ✓':(r.p?'page '+r.p+' of '+r.n:r.n+' pages'))+(done[s.id]?' · test taken':''),'<button class="btn small'+(dn?"":" primary")+'" data-camread="'+s.id+'">'+(dn?"Again":(r.p?"Continue":"Read"))+'</button><button class="btn small" data-start="'+s.id+'">Test</button>',dn?"done":(r.p?"part":"todo"))}).join("")+'</ul>'}).join("");
    html+=fold("rd-ca",subj==="Current Affairs"?"Monthly current affairs notes":"Current affairs linked to "+esc(subj),readN+" of "+cams.length+" booklets read",cb,subj==="Current Affairs");
  }
  v.innerHTML=html;
  bindRead();bindFolds(false);bindBatch2();
}
function bindRead(){
  qsa("[data-rsub]").forEach(function(b){b.onclick=function(){VIEW.readSub=b.dataset.rsub;render()}});
  qsa("[data-notes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.notes)}});
  qsa("[data-camread]").forEach(function(b){b.onclick=function(){openCamNotes(b.dataset.camread,Math.max(1,notesRead(b.dataset.camread)),"tabs")}});
  qsa("[data-start]").forEach(function(b){b.onclick=function(){startSet(b.dataset.start,!!DB.meta.timed)}});
  qsa("[data-rtest]").forEach(function(b){b.onclick=function(){var done=setDoneMap(),ss=(M.sets||[]).filter(function(s){return s.type===b.dataset.rtest&&s.ready}),s=ss.filter(function(x){return !done[x.id]})[0]||ss[0];if(s)startSet(s.id,!!DB.meta.timed)}});
  qsa("[data-sheet]").forEach(function(b){b.onclick=function(){var p=b.dataset.sheet.split("|");openSheet(p[0],p.slice(1).join("|"))}});
  qsa("[data-facts]").forEach(function(b){b.onclick=function(){openFacts(b.dataset.facts)}});
  qsa("[data-rf]").forEach(function(b){b.onclick=function(){startRapid(b.dataset.rf)}});
}
function backToTabs(){document.body.classList.remove("in-quiz");VIEW.screen="tabs";render();window.scrollTo(0,0)}

/* --- fact table screen: search, hide answers to self-test --- */
function openFacts(id){loadFacts().then(function(T){var t=T.filter(function(x){return x.id===id})[0];if(!t)return;VIEW.screen="facts";VIEW.ft={t:t,q:"",hide:false};drawFacts();window.scrollTo(0,0)})}
function drawFacts(){
  var o=VIEW.ft,t=o.t,q=o.q.toLowerCase(),rows=t.rows.filter(function(r){return !q||r.join(" ").toLowerCase().indexOf(q)>=0});
  $("app").innerHTML='<div class="page ftpage"><div class="row between wrap"><button class="btn small" id="ft-back">‹ Notes</button><div class="row tight"><button class="btn small" id="ft-hide" aria-pressed="'+o.hide+'">'+(o.hide?"Show answers":"Hide answers")+'</button><button class="btn small primary" data-rf="'+t.id+'">⚡ Rapid fire</button></div></div>'+
    '<h1>'+esc(t.title)+'</h1><p class="muted small">'+esc(t.subject)+' · '+t.rows.length+' facts'+(t.note?' · '+esc(t.note):'')+(o.hide?' · tap a blurred cell to reveal it':'')+'</p>'+
    '<input type="search" id="ft-q" class="ftsearch" placeholder="Search this table" value="'+esc(o.q)+'">'+
    '<div class="scroll"><table class="tbl facts"><thead><tr>'+t.cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join("")+'</tr></thead><tbody>'+
    rows.map(function(r){return '<tr>'+r.map(function(c,k){return '<td'+(o.hide&&k>0?' class="hid" tabindex="0"':'')+'>'+(k===0?'<b>'+esc(c)+'</b>':esc(c))+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table></div>'+
    (rows.length?'':'<p class="muted">Nothing matches.</p>')+'<p class="muted small">If a row looks wrong, tell me and it will be corrected.</p></div>';
  $("ft-back").onclick=backToTabs;
  $("ft-hide").onclick=function(){o.hide=!o.hide;drawFacts()};
  $("ft-q").oninput=function(){o.q=this.value;var pos=this.selectionStart;drawFacts();var e=$("ft-q");e.focus();e.setSelectionRange(pos,pos)};
  qsa("td.hid").forEach(function(td){td.onclick=function(){td.classList.remove("hid")}});
  qsa("[data-rf]").forEach(function(b){b.onclick=function(){startRapid(b.dataset.rf)}});
}

/* --- rapid fire: one-line prompts from the fact tables, 8 seconds each, self-marked --- */
var RF=null;
function rapidCards(src,T){
  var cards=[];
  T.forEach(function(t){if(src!=="all"&&src!==t.id&&src!=="s:"+t.subject)return;
    t.rows.forEach(function(r,i){(t.rf||[[0,1]]).forEach(function(p){cards.push({q:r[p[0]],ask:t.cols[p[1]],a:r[p[1]],t:t.title,key:t.id+"-"+i+"-"+p.join("")})})})});
  var seen=DB.meta.rfSeen||{};
  cards.forEach(function(c){c.w=(seen[c.key]||0)+Math.random()});
  cards.sort(function(a,b){return a.w-b.w});
  return cards.slice(0,20);
}
function startRapid(src){
  loadFacts().then(function(T){
    var cards=rapidCards(src,T);if(!cards.length){toast("No facts for this yet.");return}
    RF={src:src,cards:cards,i:0,shown:false,ok:0,miss:[],t0:0,timer:null};
    VIEW.screen="rapid";document.body.classList.add("in-quiz");drawRapid();
  });
}
function drawRapid(){
  clearTimeout(RF.timer);
  if(RF.i>=RF.cards.length)return rapidEnd();
  var c=RF.cards[RF.i];
  $("app").innerHTML='<div class="fc rf"><header class="fc-bar"><button class="btn small" id="rf-x">Close</button><span class="muted small">'+(RF.i+1)+' / '+RF.cards.length+'</span><span class="small good">'+RF.ok+' ✓</span></header>'+
    '<div class="rf-time"><i id="rf-bar"></i></div><article class="fc-card rf-card" id="rf-card"><p class="muted small">'+esc(c.t)+'</p><h2 class="rf-q">'+esc(c.q)+'</h2><p class="rf-ask">'+esc(c.ask)+'?</p>'+
    (RF.shown?'<p class="rf-a">'+esc(c.a)+'</p>':'<p class="muted small">Say it in your head – the answer shows in 8 seconds, or tap.</p>')+'</article>'+
    '<div class="fc-actions">'+(RF.shown?'<button class="btn big" id="rf-no">✗ Missed</button><button class="btn big primary" id="rf-yes">✓ Got it</button>':'<button class="btn big primary wide" id="rf-show">Show</button>')+'</div></div>';
  $("rf-x").onclick=rapidEnd;
  if(!RF.shown){
    var bar=$("rf-bar");requestAnimationFrame(function(){bar.style.transition="width 8s linear";bar.style.width="100%"});
    RF.timer=setTimeout(function(){RF.shown=true;drawRapid()},8000);
    $("rf-show").onclick=function(){RF.shown=true;drawRapid()};$("rf-card").onclick=function(){RF.shown=true;drawRapid()};
  }else{$("rf-yes").onclick=function(){rapidMark(true)};$("rf-no").onclick=function(){rapidMark(false)}}
}
function rapidMark(ok){var c=RF.cards[RF.i],s=DB.meta.rfSeen=DB.meta.rfSeen||{};s[c.key]=(s[c.key]||0)+(ok?2:0.5);if(ok)RF.ok++;else RF.miss.push(c);RF.i++;RF.shown=false;saveStore();drawRapid()}
function rapidEnd(){
  clearTimeout(RF&&RF.timer);if(!RF)return backToTabs();
  var n=RF.i,ok=RF.ok,miss=RF.miss,src=RF.src;RF=null;
  if(!n)return backToTabs();
  var best=DB.meta.rfBest=DB.meta.rfBest||{};var pct=Math.round(ok/n*100),nb=!best[src]||pct>best[src];if(nb){best[src]=pct;saveStore()}
  $("app").innerHTML='<div class="page fc-end"><h1>Rapid fire</h1><p class="lead">'+ok+' of '+n+' ('+pct+'%)'+(nb?' – your best for this set':'')+'</p>'+
    (miss.length?'<h3>Look at these again</h3><ul class="plain small">'+miss.map(function(c){return '<li><b>'+esc(c.q)+'</b> – '+esc(c.ask)+': '+esc(c.a)+'</li>'}).join("")+'</ul>':'<p>No misses.</p>')+
    '<div class="row wrap"><button class="btn primary" id="rf-again">Another round</button><button class="btn ghost" id="rf-done">Done</button></div></div>';
  $("rf-again").onclick=function(){startRapid(src)};$("rf-done").onclick=backToTabs;
}

/* --- one-page unit sheet: your mistakes, UPSC asked, memory hooks, key facts --- */
function keyLine(e){
  var ss=String(e||"").replace(/\s+/g," ").split(/(?<=[.!?])\s+(?=[A-Z])/);
  for(var i=0;i<ss.length;i++){var s=ss[i].trim();if(s.length<35||s.length>230)continue;if(/^(Statement|Both|All|Option|Only|None|Neither|Hence|So |Therefore|Thus|This|That|It |These|Pair|The answer|Answer|Correct|Incorrect|\(|[0-9]\.|[a-d]\))/i.test(s))continue;if(/statement|option|the pair|is correct|is incorrect|is wrong/i.test(s))continue;return s}
  return "";
}
function openSheet(subj,unit){
  var pool=(M.bank[subj]||[]).filter(function(x){return x[1]===unit}).map(function(x){return x[0]});
  if(!pool.length){toast("No questions in this unit yet.");return}
  var wrong={};attempts().forEach(function(a){(a.items||[]).forEach(function(x){if(x[2]===unit&&x[4]!==1)wrong[x[0]]=(wrong[x[0]]||0)+1;if(x[2]===unit&&x[4]===1&&wrong[x[0]])wrong[x[0]]-=0.5})});
  var pick=pool.filter(function(q){return wrong[q]>0}).slice(0,12).concat(pool.filter(function(q){return isPyq(q)&&!(wrong[q]>0)}).slice(0,15),pool.filter(function(q){return !isPyq(q)&&!(wrong[q]>0)}).slice(0,60));
  $("app").innerHTML='<div class="page"><p class="muted">Putting the sheet together…</p></div>';VIEW.screen="sheet";
  loadQids(pick).then(function(qs){
    qs=qs.filter(function(q){return !q.x});var L="abcd",mist=[],pyq=[],hooks=[],facts=[],seen={};
    qs.forEach(function(q){
      var ans=q.o&&q.o[+q.a],line=keyLine(q.e);
      var item={q:q,ans:ans,line:line};
      if(wrong[q.qid]>0)mist.push(item);else if(isPyq(q.qid))pyq.push(item);
      if(q.h&&!seen[q.h]){seen[q.h]=1;hooks.push(q.h)}
      if(!(wrong[q.qid]>0)&&!isPyq(q.qid)&&line&&!seen[line]){seen[line]=1;facts.push(line)}
    });
    var st=(unitStats()[subj]||{units:{}}).units[unit]||{r:0,w:0},n=st.r+st.w;
    // direct questions show "question → answer"; statement-type questions show the fact behind them instead
    var direct=function(x){var qt=String(x.q.q||"");return !/\n|Consider|statement|following|correct|pairs|Statement/i.test(qt)&&qt.length<=170&&x.ans&&x.ans.length<=70&&!/^(Both|Neither|None|All|Only|1|2|3|4)\b/i.test(x.ans)};
    var keyLines=function(e){var out=[],t=String(e||"");for(var k=0;k<2;k++){var l=keyLine(t);if(!l)break;out.push(l);t=t.replace(l,"")}return out.join(" ")};
    var qa=function(x){if(direct(x))return '<li><span class="small">'+esc(x.q.q)+'</span><br><b>→ '+esc(x.ans)+'</b>'+(x.line?'<span class="muted small block">'+esc(x.line)+'</span>':'')+'</li>';
      var kl=keyLines(x.q.e);return kl?'<li>'+esc(kl)+'</li>':''};
    var h='<div class="page sheet"><div class="row between wrap noprint"><button class="btn small" id="sh-back">‹ Back</button><div class="row tight"><button class="btn small" id="sh-print">Print / PDF</button><button class="btn small primary" data-retest="'+esc(subj)+'|'+esc(unit)+'">Test this unit</button></div></div>'+
      '<h1>'+esc(unit)+'</h1><p class="muted small">'+esc(subj)+' · '+(n?Math.round(st.r/n*100)+'% on '+n+' questions':'not attempted yet')+' · built from the app\'s question bank</p>';
    if(mist.length)h+='<h2>From your mistakes</h2><ol class="sheetlist">'+mist.map(qa).filter(Boolean).slice(0,8).join("")+'</ol>';
    if(pyq.length)h+='<h2>What UPSC asked</h2><ol class="sheetlist">'+pyq.map(function(x){var y=pyqYear(x.q.qid),l=qa(x);return l?l.replace("<li>","<li><span class=\"tag\">"+(y||"PYQ")+"</span> "):""}).filter(Boolean).slice(0,6).join("")+'</ol>';
    if(hooks.length)h+='<h2>Memory hooks</h2><ul class="plain small sheethooks">'+hooks.slice(0,8).map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul>';
    if(facts.length)h+='<h2>Key facts</h2><ul class="plain sheetfacts">'+facts.slice(0,14).map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul>';
    var sn=studyNotes(subj);
    if(sn.length)h+='<p class="noprint small"><b>Full notes for '+esc(subj)+':</b> '+sn.map(function(x){return '<button class="link" data-notes="'+x.id+'">'+esc(x.n.title)+'</button>'}).join(" · ")+'</p>';
    $("app").innerHTML=h+'</div>';window.scrollTo(0,0);
    $("sh-back").onclick=backToTabs;$("sh-print").onclick=function(){window.print()};
    qsa("[data-retest]").forEach(function(b){b.onclick=function(){var p=b.dataset.retest.split("|");VIEW.screen="tabs";startSubjectTest(p[0],[p.slice(1).join("|")])}});
    qsa("[data-notes]").forEach(function(b){b.onclick=function(){openNotes(b.dataset.notes)}});
  }).catch(function(){backToTabs();toast("Could not load this unit. Check your connection.")});
}
