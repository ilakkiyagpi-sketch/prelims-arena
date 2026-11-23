
/* ---------- placing it all in the app ---------- */
var SEARCH_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function topbarExtra(){
  var sb=$("syncbadge");if(!sb||$("srchbtn"))return;
  var b=document.createElement("button");b.id="srchbtn";b.className="btn ghost small srchbtn";b.setAttribute("aria-label","Search everything");b.innerHTML=SEARCH_ICON+'<span class="hide-sm">Search</span>';
  b.onclick=function(){openSearch()};var wrap=document.createElement("div");wrap.className="row tight";sb.parentNode.insertBefore(wrap,sb);wrap.appendChild(b);wrap.appendChild(sb);
}
/* Today */
function rehTodayCard(){
  var o=rehOpen();if(!o)return "";var g=DB.recs[o.gs];
  return '<section class="panel keydate"><div class="row between wrap"><div><b>Rehearsal: Paper II is waiting</b><span class="muted small block">Paper I done '+(g?fdw(g.date):'')+'. Results open after CSAT. Real time: 2:30 pm.</span></div><button class="btn small primary" data-reh="cs">Start Paper II</button></div></section>';
}
function todayExtra(td){return keyDateCard(td)+rehTodayCard()}
function timerChip(){var t=tmr();return t?'<button class="chip good" data-tmr="stop" title="Stop the study timer and add the time to today\'s log">⏱ <span id="tmr-clock">'+fmtT(tmrSec())+'</span> · Stop</button>':'<button class="chip" data-tmr="start" title="Time your study; it goes into today\'s log">⏱ Study timer</button>'}
function bindTodayExtra(){
  qsa("[data-applied]").forEach(function(b){b.onclick=function(){put("kd_applied",{kind:"kd",done:true,date:today()});render();toast("Noted. The deadline reminder stops now.")}});
  qsa("[data-reh]").forEach(function(b){b.onclick=function(){rehStart(b.dataset.reh)}});
  var hc=document.querySelector(".hero .chips");if(hc&&!hc.querySelector("[data-tmr]"))hc.insertAdjacentHTML("beforeend",timerChip());
  qsa("[data-tmr]").forEach(function(b){b.onclick=function(){timerAction(b.dataset.tmr)}});
}
/* Practice */
function savedPanel(){
  var L=bmList();
  return '<section class="panel" id="saved-panel"><h2>Saved questions</h2>'+(L.length?'<p class="small"><b>'+L.length+'</b> question'+(L.length>1?"s":"")+' saved with ☆ during tests and reviews: good questions, traps, facts worth keeping.</p><div class="row wrap"><button class="btn primary small" data-sv="quiz">Quiz ('+Math.min(25,L.length)+')</button><button class="btn small" data-sv="flash">Flashcards</button><button class="btn small" data-sv="listen">Listen</button><button class="btn small ghost" data-sv="list">See them</button></div>':'<p class="muted small">Tap ☆ Save on any question during a test or in the review to keep it here – right answers you want to remember, not only mistakes.</p>')+'</section>';
}
function practiceTop(){return smartPanel()}
function practiceExtra(){
  var o=rehOpen(),bm=bmList().length,bc=beatCandidates().length,mp=M.sets.filter(function(s){return s.type==="mapq"&&s.ready}).length,fs=fmtStats(),wk=null;
  Object.keys(fs).forEach(function(f){var x=fs[f],n=x.r+x.w;if(n>=15&&(!wk||x.r/n<wk.a))wk={f:f,a:x.r/n}});
  var f=function(id,title,sum,html,def){return html?fold(id,title,sum,unwrap(html),def):""};
  return f("p-reh","Exam-day rehearsal",o?"Paper II is waiting":"both papers on one day, results locked till the end",rehPanel(),!!o)+
    f("p-fmt","Question-type drill",wk?"weakest: "+FMT_SHORT[wk.f]+" "+Math.round(wk.a*100)+"%":"how many, Statement I/II, pairs and more",fmtPanel(),false)+
    f("p-map","Map practice",mp?mp+" sets · tap-the-map drill":"",mapPanel(),false)+
    f("p-saved","Saved questions",bm?bm+" saved":"none saved yet",savedPanel(),false)+
    f("p-beat","Beat your past self",bc?bc+" tests to race":"",beatPanel(),false)+
    f("p-mains","Mains answer practice","for after Prelims",mainsPanel(),false);
}
function bindPracticeExtra(){
  bindFolds(false);
  qsa("[data-smart]").forEach(function(b){b.onclick=function(){startSmart(+b.dataset.smart)}});
  qsa("[data-rs]").forEach(function(b){b.onclick=function(){VIEW.rehSrc=b.dataset.rs;qsa("[data-rs]").forEach(function(x){x.setAttribute("aria-pressed",x===b)})}});
  qsa("[data-reh]").forEach(function(b){b.onclick=function(){rehStart(b.dataset.reh)}});
  qsa("#reh-panel [data-att]").forEach(function(b){b.onclick=function(){openAttempt(b.dataset.att)}});
  qsa("[data-fd]").forEach(function(b){b.onclick=function(){VIEW.fmt=b.dataset.fd;render()}});
  qsa("[data-fn]").forEach(function(b){b.onclick=function(){VIEW.fmtN=+b.dataset.fn;render()}});
  if($("fd-go"))$("fd-go").onclick=function(){startFmtDrill(VIEW.fmt||"H",VIEW.fmtN||25)};
  qsa("[data-tap]").forEach(function(b){b.onclick=startTap});
  qsa("[data-beat]").forEach(function(b){b.onclick=function(){var a=DB.recs[b.dataset.beat];if(a)retakeAttempt(Object.assign({id:b.dataset.beat},a))}});
  qsa("[data-mains]").forEach(function(b){b.onclick=openMains});
  qsa("[data-sv]").forEach(function(b){b.onclick=function(){var L=bmList(),a=b.dataset.sv;if(!L.length)return;
    if(a==="quiz")startCustom({type:"revision",title:"Saved questions, "+fd(today()),subject:"Mixed",qids:shuffle(L.slice()).slice(0,25),timed:false});
    else if(a==="flash")startFlashQids(shuffle(L.slice()),"Saved questions");
    else if(a==="listen")loadQids(L.slice(0,30)).then(function(qs){qs=qs.filter(function(q){return !q.x&&!q.map});if(qs.length)playList(qs.map(function(q){return {q:q}}),"Saved questions")});
    else {SRCH.f="m";openSearch("")}}});
}
/* Dashboard */
function dashExtra(){
  var R=readiness(),P=null;try{P=priorityData()}catch(e){}
  var first=P?P.rows.filter(function(r){return r.py>=P.med&&(r.acc==null||r.acc<65)}):[];
  var ws=whyStats(addDays(today(),-29)),wk=Object.keys(ws.o).sort(function(a,b){return ws.o[b]-ws.o[a]})[0],sw=sureWrong().length;
  var syl=0,syn=0;SYL_SUBJ.forEach(function(s){var t=sylStats(s);syl+=t.read;syn+=t.n});
  return fold("ready","Cut-off readiness",R.p==null?"no full-length GS results yet":Math.round(R.p)+" of 200 projected · "+ZONE[R.zone][1].toLowerCase(),readinessSection(),false)+
    fold("prio","Priority map",first.length?first.length+" heavy units to study first"+(first[0]?" · top: "+esc(first[0].u):""):"what to study next",P?prioritySection():"",false)+
    fold("diag","Why I lose marks",(wk?"biggest leak: "+esc(whyLabel(wk).toLowerCase()):"tag wrong answers to see the pattern")+(sw?" · "+sw+" confidently wrong":""),diagSection(),false)+
    fold("syl","Syllabus tracker",syl+" of "+syn+" units read",sylSection(),false);
}
function bindDashExtra(){
  bindDiag();bindSyl();
  qsa("[data-prtest]").forEach(function(b){b.onclick=startPriorityTest});
  qsa("[data-gocut]").forEach(function(b){b.onclick=function(){VIEW.tab="scores";location.hash="scores";render();setTimeout(function(){var e=$("cut-panel");if(e)e.scrollIntoView({behavior:"smooth"})},60)}});
  if(foldOpen("ready",false))drawReady();
  if(foldOpen("prio",false))drawPriority();
}
function glanceExtra(){
  var R=readiness();
  return '<button class="tile '+(R.zone?ZONE[R.zone][0]:"")+'" data-gofold="ready"><span class="t-l">Cut-off readiness</span><span class="t-v">'+(R.p==null?"–":Math.round(R.p)+" / 200")+'</span><span class="t-s">'+(R.zone?ZONE[R.zone][1]:"take a full mock")+'</span></button>'+(function(){var P=priorityData(),f=P.rows.filter(function(r){return r.py>=P.med&&(r.acc==null||r.acc<65)})[0];return '<button class="tile'+(f?" warn":"")+'" data-gofold="prio"><span class="t-l">Study first</span><span class="t-v t-small">'+(f?esc(f.u):"–")+'</span><span class="t-s">'+(f?esc(f.s)+" · UPSC asked "+f.py:"all heavy units above 65%")+'</span></button>'})();
}
/* Scores */
function scoresExtra(){return benchPanel()+cutPanel()}
function bindScoresExtra(){bindBench();qsa("[data-cut]").forEach(function(b){b.onclick=function(){DB.meta.cutCat=b.dataset.cut;saveStore(true);render();toast("Cut-off category: "+b.dataset.cut)}})}
/* Notes tab */
function readExtra(subj){
  var mn=myNotesList(),bm=bmList().length;
  return '<section class="panel srchcard"><button class="srchfake" id="rd-search">'+SEARCH_ICON+'<span>Search questions, notes, fact tables and your notes</span></button></section>'+
    (mn.length||bm?fold("rd-mine","My notes and saved questions",mn.length+" note"+(mn.length===1?"":"s")+" · "+bm+" saved",'<ul class="list">'+mn.slice(0,30).map(function(n){return '<li class="click" data-mynote="'+esc(n.k)+'|'+esc(n.qid||n.nid||"")+'|'+(n.p||"")+'|'+(n.pdf?1:"")+'"><div><b>'+esc(n.t)+'</b><span class="muted small block">'+esc(n.k==="q"?"Question: "+(n.sub||"").slice(0,90):n.sub)+'</span></div></li>'}).join("")+'</ul>'+(bm?'<button class="btn small" id="rd-saved">Saved questions ('+bm+')</button>':''),false):"");
}
function bindReadExtra(){
  if($("rd-search"))$("rd-search").onclick=function(){openSearch()};
  if($("rd-saved"))$("rd-saved").onclick=function(){SRCH.f="m";openSearch("")};
  qsa("[data-mynote]").forEach(function(li){li.onclick=function(){var p=li.dataset.mynote.split("|");if(p[0]==="q")showQuestion(p[1]);else if(p[3])openHit("p",p[1]+"#"+p[2]);else openHit("c",p[1]+"#"+p[2])}});
}
/* quiz and result screens */
function qzExtraMeta(q){return '<button class="bmq'+(isBm(q.qid)?" on":"")+'" data-bmq="'+esc(q.qid)+'" aria-pressed="'+isBm(q.qid)+'" title="Save for revision">'+(isBm(q.qid)?"★":"☆")+'</button>'}
function qzExtraBind(q){
  qsa("[data-bmq]").forEach(function(b){b.onclick=function(){toggleBm(b.dataset.bmq);renderQuiz()}});
  if($("qz-omr"))$("qz-omr").onclick=function(){QZ.x.view="omr";renderQuiz()};
}
function rcardExtra(a,x,q,i){
  if(!q)return "";
  return whyChips(a,x,i)+qNoteHtml(q.qid)+'<div class="row wrap tight rtools">'+bmBtn(q.qid)+'<button class="link" data-qnote="'+esc(q.qid)+'">'+(qNote(q.qid)?"Edit my note":"Add a note")+'</button><button class="link" data-ask="'+esc(q.qid)+'|'+(x[3]==null?"":x[3])+'">Ask Claude</button></div>';
}
function resultExtra(a,qs){return ghostResult(a)+omrResult(a)}
function bindResultExtra(a,byQid,fresh){
  qsa("[data-why]").forEach(function(w){var i=+w.dataset.why;qsa("[data-wv]",w).forEach(function(b){b.onclick=function(){setWhy(a.id,i,b.dataset.wv);var cur=whyOf(a.id,i);qsa("[data-wv]",w).forEach(function(x){x.setAttribute("aria-pressed",x.dataset.wv===cur)})}})});
  qsa("[data-bm]").forEach(function(b){b.onclick=function(){toggleBm(b.dataset.bm);var on=isBm(b.dataset.bm);b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);b.textContent=on?"★ Saved":"☆ Save"}});
  qsa("[data-qnote]").forEach(function(b){b.onclick=function(){var q=byQid[b.dataset.qnote];editQNote(b.dataset.qnote,q,function(){var y=window.scrollY;renderResult(fresh);window.scrollTo(0,y)})}});
  qsa("[data-ask]").forEach(function(b){b.onclick=function(){var p=b.dataset.ask.split("|"),q=byQid[p[0]];if(q)askClaude(q,p[1]===""?null:+p[1])}});
}
