/* Prelims Arena — November 2026 upgrade (more.js). Built from src/m*.js by tools/build_extra.py.
   Adds: why-wrong tags, confidently-wrong list, question-type analytics, stamina and time-of-day,
   cut-off readiness, class benchmark, beat-your-past-self, priority map, key dates, syllabus tracker,
   study timer, exam-day rehearsal, OMR step, format drills, map questions, search, saved questions,
   Ask Claude, margin notes, smart practice and Mains answer practice. Hooks are called from app.js. */
"use strict";

/* ---------- shared ---------- */
TYPE_LABEL.smart="Smart practice";TYPE_LABEL.fmt="Format drill";TYPE_LABEL.mapq="Map practice";
(function(){var tg=typeGroup;typeGroup=function(t){return (t==="smart"||t==="fmt"||t==="mapq")?"subject":tg(t)}})();
function sid_(qid){return String(qid).replace(/[^A-Za-z0-9_-]/g,"_")}
function live(id){var r=DB.recs[id];return r&&!r.del?r:null}
var QFMT=null;
function loadQfmt(){if(QFMT)return Promise.resolve(QFMT);return fetch("data/qfmt.json").then(function(r){return r.json()}).then(function(d){QFMT=d;return d}).catch(function(){QFMT={};return QFMT})}
loadQfmt();
var FMT_LABEL={D:"Direct (one fact)",M:"Two statements",N:"Three or more statements",H:"How many of the above",S:"Statement-I / Statement-II",P:"Pairs",O:"Order or chronology",R:"CSAT passage",Q:"CSAT maths and reasoning"};
var FMT_SHORT={D:"Direct",M:"2 statements",N:"3+ statements",H:"How many",S:"Statement I/II",P:"Pairs",O:"Order",R:"Passage",Q:"CSAT maths"};
function fmtOf(qid){var p=String(qid).split("#");if(p[0]==="myq")return "D";var s=QFMT&&QFMT[p[0]];return s?(s.charAt(+p[1])||"D"):null}
function isCsatAtt(a){return a.subject==="CSAT"||a.type==="csat10"||a.type==="csatmock"||a.type==="csatset"||(a.mk&&a.mk[0]===CFG.CSAT_MK[0])}
function gsItems(from){var out=[];attempts().forEach(function(a){if(isCsatAtt(a))return;if(from&&a.date<from)return;(a.items||[]).forEach(function(x){out.push({a:a,x:x})})});return out}
function bar(p,cls){return '<span class="xbar"><i class="'+(cls||"")+'" style="width:'+Math.max(0,Math.min(100,p)).toFixed(1)+'%"></i></span>'}
function accCls(a){return a==null?"":(a>=75?"good":(a<50?"bad":"warn"))}
function netPer(r,w){var n=r+w;return n?(2*r-0.66*w)/n:0}
var PENDING_X=null;
function takePendingX(o){var x=PENDING_X;PENDING_X=null;return x}

/* ---------- 1. why-wrong tags ---------- */
var WHY_W=[["know","Didn't know it"],["confuse","Mixed up two facts"],["misread","Misread the question"],["over","Overthought / changed it"],["slip","Silly slip"],["time","Rushed"],["guess","Pure guess"]];
var WHY_S=[["know","Didn't know it"],["unsure","Knew partly, played safe"],["time","No time left"]];
var WHY_TIP={know:"Knowledge gaps: read the one-page sheet and notes for the units below before the next test.",
  confuse:"Mix-ups: you half-know these. Flashcards and the fact tables (which put similar items side by side) fix them fastest.",
  misread:"Reading slips: underline words like only, all, not and never, and read the last line of the question before the options.",
  over:"Overthinking: when you change an answer without new evidence, you lose. Change only for a clear reason.",
  slip:"Silly slips: on the final pass, re-read each answered question once before you submit.",
  time:"Time pressure: practise timed parts of 10 at 72 seconds a question.",
  guess:"Pure guesses: check the Attempt strategy coach – below 25% accuracy, guesses cost marks.",
  unsure:"Playing safe: your 50-50 answers may be worth attempting. The Attempt strategy coach shows if they pay.",
  unknown:""};
function whyLabel(k){var all=WHY_W.concat(WHY_S);for(var i=0;i<all.length;i++)if(all[i][0]===k)return all[i][1];return k}
function whyRec(attId){return live("why_"+attId)}
function whyOf(attId,i){var r=whyRec(attId);return r&&r.m?r.m[i]||null:null}
function setWhy(attId,i,code){var r=whyRec(attId)||{kind:"why",att:attId,m:{}};r=Object.assign({},r,{m:Object.assign({},r.m||{})});if(r.m[i]===code)delete r.m[i];else r.m[i]=code;put("why_"+attId,r)}
function whyChips(a,x,i){
  if(x[4]!==0&&x[4]!==-1)return "";
  var list=x[4]===0?WHY_W:WHY_S,cur=whyOf(a.id,i);
  return '<div class="why" data-why="'+i+'"><span class="small muted">'+(x[4]===0?"Why did I get it wrong?":"Why did I skip it?")+'</span><div class="chips">'+list.map(function(w){return '<button class="chipbtn small" data-wv="'+w[0]+'" aria-pressed="'+(cur===w[0])+'">'+esc(w[1])+'</button>'}).join("")+'</div></div>';
}
function whyStats(from){
  var o={},units={},untagged=0,taggedN=0,lastUntagged=null;
  attempts().forEach(function(a){if(from&&a.date<from)return;var r=whyRec(a.id),m=r&&r.m||{};
    (a.items||[]).forEach(function(x,i){if(x[4]!==0)return;var k=m[i];if(!k){untagged++;lastUntagged=a.id;return}taggedN++;o[k]=(o[k]||0)+1;
      if(k==="know"||k==="confuse"){var u=x[1]+"|"+x[2];units[u]=(units[u]||0)+1}})});
  return {o:o,units:units,untagged:untagged,tagged:taggedN,last:lastUntagged};
}

/* ---------- 2. confidently wrong ---------- */
function sureWrong(){return mistakeBook().filter(function(m){return m.sure})}

/* ---------- 3. question types, stamina, time of day ---------- */
function fmtStats(from){
  var o={};gsItems(from).forEach(function(e){var x=e.x;if(x[4]===2)return;var f=fmtOf(x[0]);if(!f||f==="R"||f==="Q")return;var s=o[f]||(o[f]={r:0,w:0,sk:0});if(x[4]===1)s.r++;else if(x[4]===0)s.w++;else s.sk++});
  return o;
}
function staminaStats(){
  var q=[{r:0,w:0},{r:0,w:0},{r:0,w:0},{r:0,w:0}],n=0;
  attempts().forEach(function(a){if(!a.timed||(a.items||[]).length<50||isCsatAtt(a))return;n++;var L=a.items.length;
    a.items.forEach(function(x,i){if(x[4]!==1&&x[4]!==0)return;var k=Math.min(3,Math.floor(i/L*4));if(x[4]===1)q[k].r++;else q[k].w++})});
  return {q:q,tests:n};
}
var TOD=[["Early morning","4 to 8 am",4,8],["Morning","8 am to noon",8,12],["Afternoon","noon to 5 pm",12,17],["Evening","5 to 9 pm",17,21],["Night","9 pm to 4 am",21,28]];
function todStats(){
  var o=TOD.map(function(t){return {t:t,r:0,w:0}});
  attempts().forEach(function(a){if(!a.ts||isCsatAtt(a))return;var h=new Date(a.ts-(a.sec||0)*1000).getHours();if(h<4)h+=24;
    var b=o.filter(function(z){return h>=z.t[2]&&h<z.t[3]})[0];if(!b)return;(a.items||[]).forEach(function(x){if(x[4]===1)b.r++;else if(x[4]===0)b.w++})});
  return o;
}
function diagSection(){
  var range=VIEW.diagRange||30,from=range==="all"?null:addDays(today(),-(range-1));
  var h='<div class="row between wrap"><p class="muted small">GS tests only. Tag wrong answers on any result screen to fill this in.</p><div class="seg small" role="group" aria-label="Period">'+[[30,"30 days"],["all","All"]].map(function(x){return '<button data-dr="'+x[0]+'" aria-pressed="'+(String(range)===String(x[0]))+'">'+x[1]+'</button>'}).join("")+'</div></div>';
  // why
  var ws=whyStats(from),keys=Object.keys(ws.o).sort(function(a,b){return ws.o[b]-ws.o[a]}),mx=keys.length?ws.o[keys[0]]:1;
  h+='<h3>Reasons you tagged</h3>';
  if(keys.length){
    h+='<ul class="hbars">'+keys.map(function(k){return '<li><span>'+esc(whyLabel(k))+'</span><i style="width:'+Math.round(ws.o[k]/mx*100)+'%"></i><b>'+ws.o[k]+'</b></li>'}).join("")+'</ul>';
    h+='<p class="small"><b>Biggest leak: '+esc(whyLabel(keys[0]))+'</b> ('+Math.round(ws.o[keys[0]]/ws.tagged*100)+'% of tagged wrong answers). '+esc(WHY_TIP[keys[0]]||"")+'</p>';
    var uk=Object.keys(ws.units).sort(function(a,b){return ws.units[b]-ws.units[a]}).slice(0,5);
    if(uk.length)h+='<p class="small muted">Units where you most often did not know or mixed up facts:</p><ul class="list">'+uk.map(function(k){var p=k.split("|");return '<li><div><b>'+esc(p[1])+'</b><span class="muted small">'+esc(p[0])+' · '+ws.units[k]+' answers</span></div><div class="row tight"><button class="btn small ghost" data-sheet="'+esc(k)+'">Sheet</button><button class="btn small" data-retest="'+esc(k)+'">Retest</button></div></li>'}).join("")+'</ul>';
  }else h+='<p class="muted small">No tagged answers yet. On a result screen, each wrong answer has quick tags such as "Didn\'t know it" or "Misread the question". Ten tags are enough to see a pattern.</p>';
  if(ws.untagged)h+='<p class="small">'+ws.untagged+' wrong answer'+(ws.untagged>1?"s are":" is")+' not tagged yet. <button class="link" data-tagnow="'+esc(ws.last||"")+'">Tag the latest test</button></p>';
  // confidently wrong
  var sw=sureWrong();
  h+='<h3>Confidently wrong</h3>';
  if(sw.length){
    var meta=qMeta(),byU={};sw.forEach(function(m){var u=meta[m.qid];if(!u)return;var k=u[0]+"|"+u[1];byU[k]=(byU[k]||0)+1});
    var uk2=Object.keys(byU).sort(function(a,b){return byU[b]-byU[a]}).slice(0,4);
    h+='<p class="small"><b>'+sw.length+'</b> question'+(sw.length>1?"s":"")+' you marked <b>Sure</b> but got wrong. These are the most dangerous: in the exam you would attempt them without a second thought. They come back sooner in your revision (after 1, 2, 5 and 14 days).</p>'+
      (uk2.length?'<p class="small muted">Where they cluster: '+uk2.map(function(k){return esc(k.split("|")[1])+' ('+byU[k]+')'}).join(", ")+'</p>':'')+
      '<div class="row wrap"><button class="btn primary small" data-sure="quiz">Quiz me on these ('+Math.min(25,sw.length)+')</button><button class="btn small" data-sure="flash">Flashcards</button></div>';
  }else h+='<p class="muted small">None right now. When you mark an answer Sure and it turns out wrong, it lands here and comes back sooner.</p>';
  // question types
  var fs=fmtStats(from),fk=Object.keys(FMT_LABEL).filter(function(k){return fs[k]&&(fs[k].r+fs[k].w+fs[k].sk)>=5});
  h+='<h3>Accuracy by question type</h3>';
  if(fk.length){
    var weak=null;fk.forEach(function(k){var s=fs[k],n=s.r+s.w;if(n>=15&&(!weak||s.r/n<weak.a))weak={k:k,a:s.r/n}});
    h+='<div class="scroll"><table class="tbl"><thead><tr><th>Type</th><th>Answered</th><th>Accuracy</th><th class="hide-sm">Skipped</th><th>Marks per attempt</th></tr></thead><tbody>'+
      fk.map(function(k){var s=fs[k],n=s.r+s.w,a=n?s.r/n*100:null,np=netPer(s.r,s.w);return '<tr><td>'+esc(FMT_LABEL[k])+'</td><td class="num">'+n+'</td><td class="num"><span class="'+accCls(a)+'-t">'+(a==null?"–":Math.round(a)+"%")+'</span></td><td class="num hide-sm">'+s.sk+'</td><td class="num '+(np>=0?"pos":"neg")+'">'+(np>=0?"+":"")+np.toFixed(2)+'</td></tr>'}).join("")+'</tbody></table></div>';
    if(weak)h+='<p class="small">Weakest type: <b>'+esc(FMT_LABEL[weak.k])+'</b> at '+Math.round(weak.a*100)+'%. '+(weak.k==="H"?'In "how many" questions every statement must be judged, so one doubtful statement costs the whole question: judge each statement on its own and count only the ones you are sure of.':(weak.k==="S"?'In Statement I/II questions, first decide if each statement is true on its own, then whether II really explains I.':'A drill of this type is the quickest fix.'))+' <button class="link" data-fmtdrill="'+weak.k+'">Drill 25 of these</button></p>';
  }else h+='<p class="muted small">Answer a few tests and this shows how you do on direct, statement, "how many", pairs and Statement I/II questions.</p>';
  // stamina
  var st=staminaStats();
  h+='<h3>Stamina in long tests</h3>';
  if(st.tests){
    var acc=st.q.map(function(z){var n=z.r+z.w;return n?z.r/n*100:null});
    h+='<ul class="hbars s">'+["First quarter","Second quarter","Third quarter","Last quarter"].map(function(l,i){return '<li><span>'+l+'</span><i style="width:'+(acc[i]==null?0:acc[i])+'%"></i><b>'+(acc[i]==null?"–":Math.round(acc[i])+"%")+'</b></li>'}).join("")+'</ul>';
    if(acc[0]!=null&&acc[3]!=null)h+='<p class="small">'+(acc[0]-acc[3]>=8?'Your accuracy drops by '+Math.round(acc[0]-acc[3])+' points by the end of long tests. Take full 100-question mocks to build stamina, and keep a 10-second reset (breathe, stretch) every 25 questions.':(acc[3]-acc[0]>=8?'You get sharper as a test goes on. A 5-question warm-up before the exam may help you start strong.':'Your accuracy holds steady from start to finish.'))+' <span class="muted">('+st.tests+' timed test'+(st.tests>1?"s":"")+' of 50+ questions)</span></p>';
  }else h+='<p class="muted small">Take a timed test of 50 or more questions to see whether your accuracy falls off towards the end.</p>';
  // time of day
  var td_=todStats().filter(function(z){return z.r+z.w>=20});
  h+='<h3>Best time of day</h3>';
  if(td_.length>=2){
    var best=td_.slice().sort(function(a,b){return b.r/(b.r+b.w)-a.r/(a.r+a.w)})[0];
    h+='<ul class="hbars s">'+td_.map(function(z){var a=z.r/(z.r+z.w)*100;return '<li><span>'+z.t[0]+' <span class="muted">'+z.t[1]+'</span></span><i style="width:'+a+'%"></i><b>'+Math.round(a)+'%</b></li>'}).join("")+'</ul>'+
      '<p class="small">You score best in the <b>'+best.t[0].toLowerCase()+'</b>. Keep the hardest subject for that slot, and use weaker slots for flashcards, Listen mode and rapid fire.</p>';
  }else h+='<p class="muted small">Needs at least 20 answers in two different parts of the day.</p>';
  return h;
}
function bindDiag(){
  qsa("[data-dr]").forEach(function(b){b.onclick=function(){VIEW.diagRange=b.dataset.dr==="all"?"all":+b.dataset.dr;render()}});
  qsa("[data-tagnow]").forEach(function(b){b.onclick=function(){if(b.dataset.tagnow){RES_FILTER_NEXT="wrong";openAttempt(b.dataset.tagnow)}}});
  qsa("[data-sure]").forEach(function(b){b.onclick=function(){var q=sureWrong().slice(0,25).map(function(m){return m.qid});if(!q.length)return;
    if(b.dataset.sure==="flash")startFlashQids(q,"Confidently wrong");else startCustom({type:"revision",title:"Confidently wrong, "+fd(today()),subject:"Mixed",qids:q,timed:false})}});
  qsa("[data-fmtdrill]").forEach(function(b){b.onclick=function(){startFmtDrill(b.dataset.fmtdrill,25)}});
}
var RES_FILTER_NEXT=null;

/* flashcards from any list of questions (saved questions, confidently wrong) */
function startFlashQids(qids,title){
  $("app").innerHTML='<div class="page"><p class="muted">Shuffling your cards…</p></div>';
  loadQids(qids.slice(0,20)).then(function(qs){qs=qs.filter(function(q){return !q.x});
    if(!qs.length){VIEW.screen="tabs";render();toast("Nothing to show.");return}
    FC={qs:qs,i:0,flip:false,knew:[],missed:[],subject:""};VIEW.screen="flash";document.body.classList.add("in-quiz");window.scrollTo(0,0);drawFlash();
  });
}


/* ---------- 4. cut-off readiness ---------- */
// Official UPSC Prelims cut-offs, GS Paper I out of 200 (CSAT is qualifying at 33%).
var CUTOFFS={General:{2020:92.51,2021:87.54,2022:88.22,2023:75.41,2024:87.98,2025:92.66},EWS:{2023:68.02,2024:85.92,2025:89.34},OBC:{2023:74.75,2024:87.28,2025:92.00},SC:{2023:59.25,2024:79.03,2025:84.00},ST:{2023:47.82,2024:74.23,2025:82.66}};
function cutCat(){return DB.meta.cutCat||"General"}
function cutInfo(){
  var c=CUTOFFS[cutCat()]||CUTOFFS.General,ys=Object.keys(c).sort(),last3=ys.slice(-3).map(function(y){return c[y]});
  var hi=Math.max.apply(null,last3),lo=Math.min.apply(null,last3);
  return {c:c,ys:ys,hi:hi,lo:lo,latest:c[ys[ys.length-1]],latestY:ys[ys.length-1],safe:Math.ceil(hi+10)};
}
// GS results that look like the real paper: full mocks, UPSC papers, PYQ mocks, rehearsals and Shankar GS tests, scaled to 200
function gsScores(){
  var out=[];
  attempts().forEach(function(a){if(isCsatAtt(a)||!a.max)return;var full=a.type==="fullmock"||a.type==="pyqmock"||(a.type==="pyq"&&a.subject!=="CSAT")||(a.n>=90&&(a.type==="subject"&&a.subject==="Mixed"));
    if(!full)return;if(a.x&&a.x.reh&&!rehDone(a.x.reh))return;out.push({date:a.date,ts:a.ts,v:a.pts/a.max*200,title:a.title,src:"app"})});
  testMarks().forEach(function(t){var d=TESTBYKEY[t.k]||{};if(t.marks==null||t.marks===""||d.csat||t.subject==="CSAT")return;out.push({date:t.date,ts:t.ts||0,v:+t.marks/(+t.max||200)*200,title:t.name,src:"shankar"})});
  return out.sort(function(a,b){return a.date===b.date?a.ts-b.ts:(a.date<b.date?-1:1)});
}
function csatScores(){
  var out=[];
  attempts().forEach(function(a){if(!(a.type==="csatmock"||(a.type==="pyq"&&a.subject==="CSAT")))return;if(a.x&&a.x.reh&&!rehDone(a.x.reh))return;out.push({date:a.date,v:a.pts/a.max*100,title:a.title})});
  testMarks().forEach(function(t){var d=TESTBYKEY[t.k]||{};if(t.marks==null||t.marks===""||!(d.csat||t.subject==="CSAT"))return;out.push({date:t.date,v:+t.marks/(+t.max||200)*100,title:t.name})});
  return out.sort(function(a,b){return a.date<b.date?-1:1});
}
function readiness(){
  var g=gsScores(),last=g.slice(-5),prev=g.slice(-10,-5),avg=function(l){return l.length?l.reduce(function(s,x){return s+x.v},0)/l.length:null};
  var ci=cutInfo(),p=avg(last),pp=avg(prev),zone=null;
  if(p!=null)zone=p>=ci.safe?"safe":(p>=ci.hi?"above":(p>=ci.lo?"zone":"below"));
  var cs=csatScores().slice(-3),csAvg=cs.length?cs.reduce(function(s,x){return s+x.v},0)/cs.length:null;
  return {g:g,n:last.length,p:p,pp:prev.length?pp:null,zone:zone,ci:ci,cs:cs,csAvg:csAvg};
}
var ZONE={safe:["good","Safe margin"],above:["good","Above recent cut-offs"],zone:["warn","In the cut-off zone"],below:["bad","Below recent cut-offs"]};
function readinessSection(){
  var R=readiness(),ci=R.ci;
  var h='<div class="row between wrap"><p class="muted small">Projected GS Paper I score from your last '+(R.n||5)+' full-length GS results (app mocks, UPSC papers and Shankar GS tests), against the official cut-offs. Category: <b>'+esc(cutCat())+'</b> <button class="link" data-gocut="1">change</button></p></div>';
  if(R.p==null)return h+'<p class="empty">Take a full mock or a UPSC paper, or enter a Shankar GS test mark, to see where you stand.</p>';
  var z=ZONE[R.zone],W=200;
  h+='<div class="ready"><div class="ready-big '+z[0]+'"><b>'+Math.round(R.p)+'</b><span>of 200 projected</span><em>'+z[1]+'</em></div><div class="ready-txt">'+
    '<p class="small">Recent '+esc(cutCat())+' cut-offs: '+ci.ys.slice(-3).map(function(y){return y+': <b>'+ci.c[y]+'</b>'}).join(" · ")+'. A score of <b>'+ci.safe+'+</b> clears every recent year with a 10-mark margin.</p>'+
    (R.pp!=null?'<p class="small">'+(R.p>=R.pp?"▲ Up ":"▼ Down ")+Math.abs(Math.round(R.p-R.pp))+' marks on your 5 results before these.</p>':'')+
    (R.p<ci.safe?'<p class="small"><b>'+Math.ceil(ci.safe-R.p)+' more marks</b> = about '+Math.ceil((ci.safe-R.p)/2.66)+' more right answers instead of wrong ones, or '+Math.ceil((ci.safe-R.p)/2)+' more right answers from skipped questions.</p>':'<p class="small">Keep this level steady across different papers.</p>')+'</div></div>';
  h+='<div class="meter" aria-hidden="true"><span class="mz" style="left:'+(ci.lo/W*100)+'%;width:'+((ci.hi-ci.lo)/W*100)+'%"></span><span class="ms" style="left:'+(ci.safe/W*100)+'%"></span><span class="mp '+z[0]+'" style="left:'+(Math.min(W,R.p)/W*100)+'%"></span></div><div class="meter-l small muted"><span>0</span><span>Cut-off zone '+ci.lo+'–'+ci.hi+'</span><span>200</span></div>';
  h+='<div class="chartwrap" id="readychart"></div>';
  if(R.cs.length)h+='<p class="small"><b>CSAT:</b> last '+R.cs.length+' result'+(R.cs.length>1?"s":"")+' average '+Math.round(R.csAvg)+'% – '+(R.csAvg>=40?'<span class="good">safely above the 33% qualifying mark</span>':(R.csAvg>=33?'<span class="warn-t">just above 33%: keep up the daily CSAT 10</span>':'<span class="bad-t">below 33%: CSAT needs daily practice now</span>'))+'.</p>';
  else h+='<p class="small muted">Take a CSAT mock or enter a Shankar CSAT mark to check the 33% qualifying paper too.</p>';
  h+=benchSummary();
  return h;
}
function drawReady(){
  var el=$("readychart");if(!el)return;var R=readiness(),g=R.g.slice(-30),ci=R.ci;if(g.length<2){el.innerHTML="";return}
  var W=Math.max(300,el.clientWidth||600),H=200,pl=34,pr=10,pt=10,pb=24,ymax=Math.max(140,Math.ceil(Math.max.apply(null,g.map(function(x){return x.v}))/20)*20+10);
  var X=function(i){return pl+(g.length===1?0:i/(g.length-1))*(W-pl-pr)},Y=function(v){return pt+(1-Math.max(0,v)/ymax)*(H-pt-pb)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="GS scores against the cut-off">';
  s+='<rect class="cutband" x="'+pl+'" width="'+(W-pl-pr)+'" y="'+Y(ci.hi)+'" height="'+(Y(ci.lo)-Y(ci.hi))+'"/>';
  [0,40,80,120].forEach(function(v){if(v>ymax)return;s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text class="axis" x="'+(pl-5)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+v+'</text>'});
  s+='<line class="goal" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(ci.safe)+'" y2="'+Y(ci.safe)+'"/><text class="goaltxt" x="'+(W-pr)+'" y="'+(Y(ci.safe)-4)+'" text-anchor="end">Safe '+ci.safe+'</text>';
  s+='<polyline class="ln app" points="'+g.map(function(x,i){return X(i).toFixed(1)+","+Y(x.v).toFixed(1)}).join(" ")+'"/>';
  g.forEach(function(x,i){s+='<circle class="pt '+(x.src==="shankar"?"shankar":"app")+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(x.v).toFixed(1)+'" r="4"><title>'+esc(fdy(x.date)+": "+x.title+" – "+Math.round(x.v)+" of 200")+'</title></circle>'});
  el.innerHTML=s+'</svg><div class="legend"><span><i class="lg app"></i>App tests</span><span><i class="lg shankar"></i>Shankar</span><span><i class="lg band"></i>Cut-off zone (last 3 years)</span><span><i class="lg goal"></i>Safe score</span></div>';
}

/* ---------- 5. Shankar class benchmark (class average and topper, entered by hand) ---------- */
function benchRec(k){return live("bench_"+k)}
function benchRows(){
  return testMarks().filter(function(t){return t.marks!=null&&t.marks!==""}).map(function(t){var b=benchRec(t.k)||{};return {t:t,k:t.k,me:+t.marks,max:+t.max||200,avg:b.avg,top:b.top}}).sort(function(a,b){return a.t.date<b.t.date?-1:1});
}
function benchSummary(){
  var R=benchRows().filter(function(r){return r.avg!=null||r.top!=null});if(!R.length)return '<p class="small muted">Add the class average and topper\'s marks for your Shankar tests (Scores tab) to see how far you are from the top.</p>';
  var gt=R.filter(function(r){return r.top!=null}).slice(-5),ga=R.filter(function(r){return r.avg!=null});
  var gap=gt.length?gt.reduce(function(s,r){return s+(r.top-r.me)},0)/gt.length:null,beat=ga.filter(function(r){return r.me>=r.avg}).length;
  return '<h3>Against your class</h3><p class="small">'+(ga.length?'You beat the class average in <b>'+beat+' of '+ga.length+'</b> tests. ':'')+(gap!=null?'Average gap to the topper over the last '+gt.length+': <b>'+r1(gap)+' marks</b>.':'')+'</p>'+
    '<div class="scroll"><table class="tbl"><thead><tr><th>Test</th><th>You</th><th>Class avg</th><th>Topper</th><th>Gap to top</th></tr></thead><tbody>'+R.slice().reverse().slice(0,8).map(function(r){return '<tr><td>'+esc(r.t.name)+'</td><td class="num">'+r.me+'</td><td class="num">'+(r.avg==null?"–":r.avg)+'</td><td class="num">'+(r.top==null?"–":r.top)+'</td><td class="num">'+(r.top==null?"–":r1(r.top-r.me))+'</td></tr>'}).join("")+'</tbody></table></div>';
}
function benchPanel(){
  var R=benchRows().filter(function(r){return TESTBYKEY[r.k]});
  var h='<section class="panel" id="bench-panel"><h2>Class benchmark</h2><p class="muted small">After each Shankar test, type the class average and the topper\'s marks from the discussion or the results sheet. The Dashboard then shows your gap to the top.</p>';
  if(!R.length)return h+'<p class="muted small">Enter your own marks above first.</p></section>';
  return h+'<div class="scroll"><table class="tbl benchtbl"><thead><tr><th>Test</th><th>You</th><th>Class average</th><th>Topper</th></tr></thead><tbody>'+R.slice().reverse().map(function(r){return '<tr><td><b>'+esc(r.t.name)+'</b><span class="muted small">'+fdw(r.t.date)+'</span></td><td class="num">'+r.me+'</td><td><input type="number" inputmode="decimal" step="any" data-bk="'+r.k+'" data-bf="avg" value="'+(r.avg==null?"":r.avg)+'" aria-label="Class average"></td><td><input type="number" inputmode="decimal" step="any" data-bk="'+r.k+'" data-bf="top" value="'+(r.top==null?"":r.top)+'" aria-label="Topper"></td></tr>'}).join("")+'</tbody></table></div></section>';
}
function bindBench(){
  var tm={};
  qsa("[data-bk]").forEach(function(inp){inp.addEventListener("input",function(){var k=inp.dataset.bk,f=inp.dataset.bf;clearTimeout(tm[k+f]);tm[k+f]=setTimeout(function(){
    var r=Object.assign({kind:"bench",k:k},benchRec(k)||{});r[f]=inp.value===""?null:Number(inp.value);put("bench_"+k,r)},600)})});
}
function cutPanel(){
  return '<section class="panel" id="cut-panel"><h2>Cut-off category</h2><p class="muted small">Used by the readiness meter on the Dashboard. Cut-offs are the official UPSC figures for GS Paper I, out of 200.</p><div class="seg">'+Object.keys(CUTOFFS).map(function(c){return '<button data-cut="'+c+'" aria-pressed="'+(cutCat()===c)+'">'+c+'</button>'}).join("")+'</div>'+
    '<div class="scroll"><table class="tbl"><thead><tr><th>Year</th>'+Object.keys(CUTOFFS).map(function(c){return '<th>'+c+'</th>'}).join("")+'</tr></thead><tbody>'+["2025","2024","2023","2022","2021","2020"].map(function(y){return '<tr><td>'+y+'</td>'+Object.keys(CUTOFFS).map(function(c){return '<td class="num">'+(CUTOFFS[c][y]||"–")+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table></div></section>';
}

/* ---------- 6. beat your past self ---------- */
function ghostOf(a){
  var cum=[],t=0;(a.items||[]).forEach(function(x){t+=x[6]||0;cum.push(t)});
  return {att:a.id,pts:a.pts,max:a.max,r:a.r,w:a.w,sec:a.sec,cum:cum,date:a.date};
}
(function(){var orig=retakeAttempt;retakeAttempt=function(a){if(a&&a.items&&a.items.length&&!(a.x&&a.x.reh))PENDING_X={ghost:ghostOf(a)};orig(a);setTimeout(function(){PENDING_X=null},4000)}})();
function ghostHead(){
  var g=QZ.x&&QZ.x.ghost;if(!g||!g.cum.length)return "";
  var i=Math.min(QZ.i,g.cum.length-1),then=i>0?g.cum[i-1]:0,now=elapsed(),d=now-then;
  return '<span class="ghost" title="Your earlier attempt reached this question at '+fmtT(then)+'">vs '+fd(g.date)+': '+(Math.abs(d)<5?"level":(d<0?fmtT(-d)+" ahead":fmtT(d)+" behind"))+'</span>';
}
function ghostResult(a){
  var g=a.x&&a.x.ghost;if(!g)return "";var prev=DB.recs[g.att],flipUp=0,flipDown=0;
  if(prev&&prev.items){var m={};prev.items.forEach(function(x){m[x[0]]=x[4]});(a.items||[]).forEach(function(x){if(m[x[0]]===0||m[x[0]]===-1){if(x[4]===1)flipUp++}else if(m[x[0]]===1&&x[4]!==1)flipDown++})}
  var d=r1(a.pts-g.pts),dt=(a.sec||0)-(g.sec||0);
  return '<section class="panel ghostres"><h2>'+(d>0?"You beat your past self":(d===0?"Same score as last time":"Not this time"))+'</h2><dl class="kpis"><div><dt>Then ('+fd(g.date)+')</dt><dd>'+g.pts+'</dd><dd class="sub">'+fmtMin(g.sec||0)+'</dd></div><div><dt>Now</dt><dd>'+a.pts+'</dd><dd class="sub">'+fmtMin(a.sec||0)+'</dd></div><div><dt>Change</dt><dd class="'+(d>=0?"pos":"neg")+'">'+(d>0?"+":"")+d+'</dd><dd class="sub">'+(dt<=0?fmtMin(-dt)+" faster":fmtMin(dt)+" slower")+'</dd></div><div><dt>Fixed / slipped</dt><dd>'+flipUp+' / '+flipDown+'</dd><dd class="sub">wrong→right / right→wrong</dd></div></dl>'+
    (flipDown?'<p class="small">'+flipDown+' answer'+(flipDown>1?"s":"")+' you had right last time went wrong today – use the Wrong filter below and tag why.</p>':'')+'</section>';
}
function beatCandidates(){
  var seen={},out=[],cut=addDays(today(),-7);
  attempts().slice().reverse().forEach(function(a){var key=a.setId?a.setId+(a.part?"~"+a.part:""):a.title;if(seen[key])return;seen[key]=1;
    if(a.date>cut||!a.items||a.items.length<20||a.type==="csat10"||(a.x&&a.x.reh)||!canRetake(a))return;var p=a.max?a.pts/a.max*100:0;if(p<70)out.push({a:a,p:p})});
  return out.sort(function(x,y){return x.p-y.p}).slice(0,5);
}
function beatPanel(){
  var c=beatCandidates();if(!c.length)return "";
  return '<section class="panel" id="beat-panel"><h2>Beat your past self</h2><p class="muted small">Tests from more than a week ago where you scored under 70%. Take the same questions again: a pace marker shows if you are ahead of or behind your earlier time, and the result compares both attempts.</p><ul class="list">'+
    c.map(function(o){return '<li><div><b>'+esc(o.a.title)+'</b><span class="muted small">'+fdy(o.a.date)+' · '+o.a.pts+' / '+o.a.max+' ('+Math.round(o.p)+'%)</span></div><button class="btn small primary" data-beat="'+o.a.id+'">Race it</button></li>'}).join("")+'</ul></section>';
}


/* ---------- 7. priority map: UPSC weight (GS PYQs 2016–2023) against your accuracy ---------- */
function priorityData(){
  var cnt={},tot=0;
  Object.keys(M.bank).forEach(function(s){if(s==="CSAT")return;(M.bank[s]||[]).forEach(function(x){if(String(x[0]).indexOf("PYQ-GS-")!==0)return;var k=s+"|"+x[1];cnt[k]=(cnt[k]||0)+1;tot++})});
  var st=unitStats(),rows=[];
  Object.keys(cnt).forEach(function(k){var p=k.split("|"),s=p[0],u=p.slice(1).join("|"),o=(st[s]&&st[s].units[u])||{r:0,w:0},n=o.r+o.w,acc=n>=8?o.r/n*100:null;
    rows.push({k:k,s:s,u:u,py:cnt[k],w:cnt[k]/tot*100,n:n,acc:acc,pr:(cnt[k]/tot)*(1-(acc==null?0.5:acc/100))})});
  rows.sort(function(a,b){return b.pr-a.pr});
  var ws=rows.map(function(r){return r.py}).sort(function(a,b){return a-b}),med=ws.length?ws[Math.floor(ws.length*0.6)]:1;
  return {rows:rows,tot:tot,med:Math.max(4,med)};
}
var SUBJ_CLS={"Polity":"c1","History":"c2","Geography":"c3","Economy":"c4","Environment":"c5","Science & Tech":"c6","Current Affairs":"c7"};
function prioritySection(){
  var P=priorityData();if(!P.rows.length)return '<p class="muted">No PYQ data.</p>';
  var first=P.rows.filter(function(r){return r.py>=P.med&&(r.acc==null||r.acc<65)}).slice(0,10);
  var untested=P.rows.filter(function(r){return r.acc==null&&r.py>=P.med}).length;
  var h='<p class="muted small">Each dot is a unit. Up = how often UPSC asked it in 2016–2023 ('+P.tot+' GS questions). Right = your accuracy (8+ answers needed; grey dots are not tested enough yet). Study the top-left corner first.</p><div class="chartwrap" id="prichart"></div>';
  h+='<h3>Study first</h3><p class="small muted">High UPSC weight and your accuracy below 65% (or not tested yet).'+(untested?' '+untested+' heavy unit'+(untested>1?"s are":" is")+' not tested enough yet.':'')+'</p><ul class="list">'+first.map(function(r){
    return '<li><div><b>'+esc(r.u)+'</b><span class="muted small">'+esc(r.s)+' · UPSC asked '+r.py+' · '+(r.acc==null?'not tested enough':'your accuracy '+Math.round(r.acc)+'%')+'</span></div><div class="row tight nowrap"><button class="btn small ghost" data-sheet="'+esc(r.k)+'">Sheet</button><button class="btn small primary" data-retest="'+esc(r.k)+'">Test</button></div></li>'}).join("")+'</ul>'+
    '<div class="row wrap"><button class="btn" data-prtest="1">Priority test: 25 from these units</button></div>';
  return h;
}
function drawPriority(){
  var el=$("prichart");if(!el)return;var P=priorityData(),rows=P.rows;
  var W=Math.max(300,el.clientWidth||600),H=W<520?300:340,pl=36,pr=12,pt=14,pb=30,ymax=Math.max.apply(null,rows.map(function(r){return r.py}))+2;
  var X=function(a){return pl+(a/100)*(W-pl-pr)},Y=function(v){return pt+(1-v/ymax)*(H-pt-pb)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="Units by UPSC weight and your accuracy">';
  s+='<rect class="q-first" x="'+pl+'" y="'+pt+'" width="'+(X(65)-pl)+'" height="'+(Y(P.med)-pt)+'"/>';
  s+='<line class="grid" x1="'+X(65)+'" x2="'+X(65)+'" y1="'+pt+'" y2="'+(H-pb)+'"/><line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(P.med)+'" y2="'+Y(P.med)+'"/>';
  [0,25,50,75,100].forEach(function(a){s+='<text class="axis" x="'+X(a)+'" y="'+(H-12)+'" text-anchor="middle">'+a+'%</text>'});
  s+='<text class="axis" x="'+(W-pr)+'" y="'+(H-1)+'" text-anchor="end">your accuracy →</text><text class="axis" x="'+(pl-6)+'" y="'+(pt+8)+'" text-anchor="end">'+ymax+'</text><text class="axis" x="'+(pl-6)+'" y="'+(H-pb)+'" text-anchor="end">0</text>';
  s+='<text class="qlab" x="'+(pl+26)+'" y="'+(pt+14)+'">Study first</text><text class="qlab" x="'+(W-pr-6)+'" y="'+(pt+14)+'" text-anchor="end">Keep sharp</text><text class="qlab" x="'+(pl+26)+'" y="'+(H-pb-6)+'">Fix when time allows</text><text class="qlab" x="'+(W-pr-6)+'" y="'+(H-pb-6)+'" text-anchor="end">Fine as is</text>';
  rows.forEach(function(r){var a=r.acc==null?2:r.acc;s+='<circle class="pdot '+(r.acc==null?"untested":SUBJ_CLS[r.s]||"")+'" cx="'+X(a).toFixed(1)+'" cy="'+Y(r.py).toFixed(1)+'" r="5" data-k="'+esc(r.k)+'" tabindex="0"><title>'+esc(r.u+" ("+r.s+"): UPSC asked "+r.py+(r.acc==null?", not tested enough":", your accuracy "+Math.round(r.acc)+"%"))+'</title></circle>'});
  el.innerHTML=s+'</svg><div class="legend">'+Object.keys(SUBJ_CLS).filter(function(k){return rows.some(function(r){return r.s===k})}).map(function(k){return '<span><i class="lg pdot '+SUBJ_CLS[k]+'"></i>'+esc(k)+'</span>'}).join("")+'<span><i class="lg pdot untested"></i>Not tested enough</span></div><p class="muted small" id="pri-pick">Tap a dot to see the unit.</p>';
  qsa("circle.pdot",el).forEach(function(c){c.onclick=function(){var r=rows.filter(function(x){return x.k===c.dataset.k})[0];if(!r)return;$("pri-pick").innerHTML='<b>'+esc(r.u)+'</b> ('+esc(r.s)+'): UPSC asked '+r.py+' · '+(r.acc==null?'not tested enough':'your accuracy '+Math.round(r.acc)+'%')+' <button class="link" data-retest2="'+esc(r.k)+'">Test it</button>';
    qsa("[data-retest2]").forEach(function(b){b.onclick=function(){var p=b.dataset.retest2.split("|");startSubjectTest(p[0],[p.slice(1).join("|")])}})}});
}
function startPriorityTest(){
  var P=priorityData(),top=P.rows.filter(function(r){return r.py>=P.med&&(r.acc==null||r.acc<65)}).slice(0,8),pool=[];
  if(!top.length)top=P.rows.slice(0,8);
  top.forEach(function(r){pool=pool.concat(poolFor(r.s,[r.u]))});
  if(!pool.length){toast("No questions for these units yet.");return}
  startCustom({type:"subject",title:"Priority test, "+fd(today()),subject:"Mixed",qids:pickQids(pool,Math.min(25,pool.length)),timed:true});
}

/* ---------- 8. key dates (UPSC calendar 2027) ---------- */
var KEY_DATES=[
  {d:"2027-01-13",t:"CSE 2027 notification: applications open",tip:"Apply on upsconline.gov.in. Keep a photo, signature, ID proof and the fee ready."},
  {d:"2027-02-02",t:"Last date to apply for CSE 2027",tip:"Do not leave it for the last day: the site slows down. Download the PDF of your submitted form."},
  {d:"2027-05-23",t:"Prelims: GS Paper I in the morning, CSAT in the afternoon",tip:"Check the admit card for the exact times and centre."},
  {d:"2027-08-20",t:"Mains begins (five days)",tip:""}];
function appliedRec(){return live("kd_applied")}
function keyDateCard(td){
  var applied=appliedRec(),out=[];
  KEY_DATES.forEach(function(k){var dl=dayNum(k.d)-dayNum(td);
    if(k.d==="2027-01-13"&&(dl>30||dl<0))return;
    if(k.d==="2027-02-02"&&(applied||dl<0||dl>27))return;
    if(k.d==="2027-05-23"&&(dl>14||dl<0))return;
    if(k.d==="2027-08-20")return;
    out.push({k:k,dl:dl})});
  if(!out.length)return "";
  return '<section class="panel keydate">'+out.map(function(o){return '<div class="row between wrap"><div><b>'+esc(o.k.t)+'</b><span class="muted small block">'+fdw(o.k.d)+' '+o.k.d.slice(0,4)+' · '+(o.dl===0?"today":(o.dl===1?"tomorrow":"in "+o.dl+" days"))+'. '+esc(o.k.tip)+'</span></div>'+
    (o.k.d==="2027-02-02"||o.k.d==="2027-01-13"?'<button class="btn small" data-applied="1">I have applied</button>':'')+'</div>'}).join("")+'</section>';
}

/* ---------- 9. syllabus tracker: read once, revised 1, 2, 3 ---------- */
var SYL_LV=["Not started","Read","Revised 1","Revised 2","Revised 3+"];
var SYL_SUBJ=["Polity","History","Geography","Economy","Environment","Science & Tech"];
function sylRec(s){return live("syl_"+slug(s))||{kind:"syl",s:s,u:{}}}
function sylLevel(s,u){return (sylRec(s).u||{})[u]||0}
function sylSet(s,u,lv){var r=sylRec(s);r=Object.assign({},r,{u:Object.assign({},r.u||{})});if(lv)r.u[u]=lv;else delete r.u[u];put("syl_"+slug(s),r)}
function sylStats(s){var us=UNITLIST[s]||[],sum=0,read=0,rev=0;us.forEach(function(u){var l=sylLevel(s,u);sum+=l;if(l>=1)read++;if(l>=2)rev++});return {n:us.length,sum:sum,read:read,rev:rev,pct:us.length?sum/(us.length*4)*100:0}}
function sylSection(){
  var all={n:0,read:0,rev:0};SYL_SUBJ.forEach(function(s){var t=sylStats(s);all.n+=t.n;all.read+=t.read;all.rev+=t.rev});
  var h='<p class="muted small">Tap a unit\'s button each time you finish a round: read it once, then revise it up to three times. UPSC toppers usually revise each unit at least twice before Prelims.</p>'+
    '<dl class="kpis"><div><dt>Units read</dt><dd>'+all.read+' / '+all.n+'</dd></div><div><dt>Revised at least once</dt><dd>'+all.rev+'</dd></div><div><dt>Days to Prelims</dt><dd>'+(dayNum(CFG.PRELIMS)-dayNum(today()))+'</dd></div><div><dt>Units to revise per week</dt><dd>'+Math.max(0,Math.ceil((all.n*2-all.rev-all.read)/Math.max(1,(dayNum(CFG.PRELIMS)-dayNum(today()))/7)))+'</dd><dd class="sub">for two rounds each</dd></div></dl><ul class="subjects">';
  SYL_SUBJ.forEach(function(s){var t=sylStats(s),open=!!(VIEW.sylOpen||{})[s],st=unitStats()[s]||{units:{}};
    h+='<li class="subjrow'+(open?" open":"")+'"><button class="subjhead" data-sylx="'+esc(s)+'" aria-expanded="'+open+'"><span class="sname">'+esc(s)+'</span><span class="bar" aria-hidden="true"><i style="width:'+t.pct+'%" class="moderate"></i></span><span class="sacc">'+t.read+'/'+t.n+'</span><span class="smeta">'+t.rev+' revised</span></button>';
    if(open)h+='<div class="subjbody"><ul class="syl">'+(UNITLIST[s]||[]).map(function(u){var l=sylLevel(s,u),o=st.units[u],n=o?o.r+o.w:0;return '<li><span>'+esc(u)+(n?' <span class="muted small">'+Math.round(o.r/n*100)+'%</span>':'')+'</span><button class="sylbtn lv'+l+'" data-syl="'+esc(s)+'|'+esc(u)+'" title="Tap for the next round">'+SYL_LV[l]+'</button></li>'}).join("")+'</ul></div>';
    h+='</li>'});
  return h+'</ul>';
}
function bindSyl(){
  qsa("[data-sylx]").forEach(function(b){b.onclick=function(){VIEW.sylOpen=VIEW.sylOpen||{};var s=b.dataset.sylx;VIEW.sylOpen[s]=!VIEW.sylOpen[s];render()}});
  qsa("[data-syl]").forEach(function(b){b.onclick=function(){var p=b.dataset.syl.split("|"),s=p[0],u=p.slice(1).join("|"),l=(sylLevel(s,u)+1)%5;sylSet(s,u,l);b.className="sylbtn lv"+l;b.textContent=SYL_LV[l]}});
}

/* ---------- 10. study timer (adds to today's study log) ---------- */
function tmr(){return DB.meta.tmr||null}
function tmrSec(){var t=tmr();return t?Math.max(0,(Date.now()-t.t0)/1000):0}
function timerCard(td){
  var t=tmr(),lr=logRec(td);
  if(!t)return '<section class="panel timer"><div class="row between wrap"><div><b>Study timer</b><span class="muted small block">Start it when you sit down to read. When you stop, the time goes into today\'s study log.'+(lr&&lr.hours?' Logged today: '+lr.hours+' h.':'')+'</span></div><button class="btn small primary" data-tmr="start">Start</button></div></section>';
  return '<section class="panel timer on"><div class="row between wrap"><div><b>Studying'+(t.s?': '+esc(t.s):'')+'</b><span class="tmr-clock" id="tmr-clock">'+fmtT(tmrSec())+'</span></div><div class="row tight"><button class="btn small primary" data-tmr="stop">Stop and log</button><button class="btn small ghost" data-tmr="cancel">Discard</button></div></div></section>';
}
function timerAction(a){
  var td=today();
  if(a==="start"){
    modal('<h2>Start the study timer</h2><p class="muted small">What are you studying? (optional)</p><div class="chips" id="tm-sub">'+M.subjects.map(function(s){return '<button class="chipbtn" data-v="'+esc(s)+'" aria-pressed="false">'+esc(s)+'</button>'}).join("")+'</div><div class="row"><button class="btn primary" id="tm-go">Start</button><button class="btn ghost" data-m="x">Cancel</button></div>');
    var pick=null;qsa("#tm-sub .chipbtn").forEach(function(b){b.onclick=function(){qsa("#tm-sub .chipbtn").forEach(function(x){x.setAttribute("aria-pressed",x===b&&pick!==b.dataset.v)});pick=pick===b.dataset.v?null:b.dataset.v}});
    $("tm-go").onclick=function(){DB.meta.tmr={t0:Date.now(),s:pick};saveStore(true);closeModal();render();toast("Timer started. It keeps running if you close the app.")};
    return;
  }
  if(a==="cancel"){modal('<h2>Discard this timer?</h2><div class="row"><button class="btn danger" data-m="y">Discard</button><button class="btn ghost" data-m="x">Keep it</button></div>',function(x){if(x==="y"){DB.meta.tmr=null;saveStore(true);render()}});return}
  if(a==="stop"){
    var t=tmr();if(!t)return;var hrs=Math.round(tmrSec()/3600*4)/4,lr=logRec(td);
    modal('<h2>Add '+fmtMin(tmrSec())+' to today\'s log?</h2><p class="muted small">Rounded to the nearest quarter hour: <b>'+hrs+' h</b>.'+(lr&&lr.hours?' Today\'s log already has '+lr.hours+' h; this is added on top.':'')+'</p>'+
      (lr?'':'<div class="fld"><span>How did the day go so far?</span><div class="seg wide" id="tm-st">'+LOG_STATUS.map(function(s){return '<button type="button" data-st="'+s[0]+'" aria-pressed="'+(s[0]==="partial")+'">'+s[1]+'</button>'}).join("")+'</div></div>')+
      '<div class="row"><button class="btn primary" id="tm-save">Add to log</button><button class="btn ghost" id="tm-no">Stop without logging</button></div>');
    var st="partial";qsa("#tm-st button").forEach(function(b){b.onclick=function(){st=b.dataset.st;qsa("#tm-st button").forEach(function(x){x.setAttribute("aria-pressed",x===b)})}});
    $("tm-save").onclick=function(){var r=Object.assign({kind:"log",date:td,status:st,hours:null,subjects:[],covered:"",reasons:[],note:"",test:null},lr||{});
      r.hours=Math.round(((+r.hours||0)+hrs)*100)/100;if(t.s&&(r.subjects||[]).indexOf(t.s)<0)r.subjects=(r.subjects||[]).concat([t.s]);
      put("log_"+td,r);DB.meta.tmr=null;saveStore(true);closeModal();render();toast("Added "+hrs+" h to today's log.")};
    $("tm-no").onclick=function(){DB.meta.tmr=null;saveStore(true);closeModal();render()};
  }
}
setInterval(function(){var c=$("tmr-clock");if(c&&tmr())c.textContent=fmtT(tmrSec())},1000);


/* ---------- 11. exam-day rehearsal: Paper I at 9:30, Paper II at 2:30, results locked until both are done ---------- */
function rehRec(id){return live(id)}
function rehDone(id){var r=rehRec(id);return !!(r&&r.gs&&r.cs)}
function rehList(){return recs("reh").sort(function(a,b){return b.ts-a.ts})}
function rehOpen(){return rehList().filter(function(r){return r.gs&&!r.cs})[0]||null}
function rehSources(){
  var out=[];[2026,2025,2024].forEach(function(y){var g=SET["PYQ-GS-"+y],c=SET["PYQ-CSAT-"+y];if(g&&c&&!bestOf(g.id)&&!bestOf(c.id))out.push({k:"y"+y,label:"UPSC "+y+" papers (kept aside, untouched)",y:y})});
  out.push({k:"fresh",label:"Fresh mock from the question bank (100 GS + 80 CSAT)"});
  return out;
}
function rehPanel(){
  var open=rehOpen(),src=rehSources(),past=rehList().filter(function(r){return r.cs});
  var h='<section class="panel" id="reh-panel"><h2>Exam-day rehearsal</h2><p class="muted small">Sit both papers on one day, as on 23 May: Paper I (GS) at 9:30 am and Paper II (CSAT) at 2:30 pm, 2 hours each. Scores and answers stay locked until both papers are done, so the lunch break feels like the real one. Try it once a month from February, and every Sunday in May.</p>';
  if(open){var a=DB.recs[open.gs];h+='<div class="note"><b>Paper I is done'+(a?' ('+fdw(a.date)+')':'')+'.</b> Paper II is waiting. Results open after it.</div><div class="row wrap"><button class="btn primary" data-reh="cs">Start Paper II (CSAT)</button><button class="btn ghost" data-reh="abandon">Cancel this rehearsal</button></div>'}
  else{
    h+='<div class="fld"><span>Papers</span><div class="chips" id="reh-src">'+src.map(function(s,i){return '<button class="chipbtn" data-rs="'+s.k+'" aria-pressed="'+((VIEW.rehSrc||src[0].k)===s.k)+'">'+esc(s.label)+'</button>'}).join("")+'</div></div>'+
      '<label class="check"><input type="checkbox" id="reh-omr"'+(DB.meta.omr!==false?" checked":"")+'> Transfer answers to an OMR sheet in the last 10 minutes</label><p class="muted small">In the exam you mark the question booklet first, then fill the OMR sheet. Practising this catches bubbling slips and the last-minute rush.</p>'+
      '<div class="row wrap"><button class="btn primary" data-reh="gs">Start Paper I (GS)</button></div>';
  }
  if(past.length)h+='<h3>Past rehearsals</h3><ul class="list">'+past.slice(0,6).map(function(r){var g=DB.recs[r.gs],c=DB.recs[r.cs];if(!g||!c)return "";var gp=g.pts/g.max*200,cp=c.pts/c.max*100;
    return '<li><div><b>'+esc(r.label||"Rehearsal")+'</b><span class="muted small">'+fdy(g.date)+' · GS '+r1(g.pts)+' / '+g.max+' · CSAT '+Math.round(cp)+'% '+(cp>=33?"(qualifies)":"(below 33%)")+'</span></div><div class="row tight"><button class="btn small ghost" data-att="'+r.gs+'">Paper I</button><button class="btn small ghost" data-att="'+r.cs+'">Paper II</button></div></li>'}).join("")+'</ul>';
  return h+'</section>';
}
function rehStart(which){
  if(which==="abandon"){var o=rehOpen();if(o)modal('<h2>Cancel this rehearsal?</h2><p class="muted small">Paper I stays in your record, unlocked.</p><div class="row"><button class="btn danger" data-m="y">Cancel rehearsal</button><button class="btn ghost" data-m="x">Keep it</button></div>',function(a){if(a==="y"){put(o.id,Object.assign({},o,{cs:"cancelled"}));render()}});return}
  var omr=$("reh-omr")?$("reh-omr").checked:DB.meta.omr!==false;DB.meta.omr=omr;saveStore();
  var h=new Date().getHours(),fit=which==="gs"?(h>=8&&h<=11):(h>=13&&h<=16);
  var go=function(){
    if(which==="gs"){
      var srcK=VIEW.rehSrc||rehSources()[0].k,id=uid("reh"),src=rehSources().filter(function(s){return s.k===srcK})[0]||rehSources()[0];
      var rec={kind:"reh",src:src.k,label:src.y?"UPSC "+src.y+" papers":"Fresh mock",date:today(),gs:null,cs:null,omr:omr};put(id,rec);
      var x={reh:id,paper:"gs",omr:omr};
      if(src.y){var s=SET["PYQ-GS-"+src.y],q=[];for(var i=0;i<s.n;i++)q.push(s.id+"#"+i);startCustom({type:"pyq",setId:s.id,title:"Rehearsal Paper I: UPSC "+src.y+" GS",subject:"Mixed",qids:q,timed:true,limit:7200,x:x})}
      else{var qq=[];Object.keys(CFG.MOCK_WEIGHTS).forEach(function(s2){qq=qq.concat(pickQids(poolFor(s2),CFG.MOCK_WEIGHTS[s2]))});startCustom({type:"fullmock",title:"Rehearsal Paper I: GS mock",subject:"Mixed",qids:shuffle(qq),timed:true,limit:7200,x:x})}
    }else{
      var o=rehOpen();if(!o)return;var x2={reh:o.id,paper:"cs",omr:o.omr};
      if(/^y/.test(o.src)){var y=+o.src.slice(1),c=SET["PYQ-CSAT-"+y],q2=[];for(var j=0;j<c.n;j++)q2.push(c.id+"#"+j);startCustom({type:"pyq",setId:c.id,title:"Rehearsal Paper II: UPSC "+y+" CSAT",subject:"CSAT",qids:q2,timed:true,limit:7200,mk:CFG.CSAT_MK,x:x2})}
      else startCustom({type:"csatmock",title:"Rehearsal Paper II: CSAT mock",subject:"CSAT",qids:pickQids(poolFor("CSAT"),80),timed:true,limit:7200,mk:CFG.CSAT_MK,x:x2});
    }
  };
  if(fit)return go();
  modal('<h2>'+(which==="gs"?"Paper I is at 9:30 am":"Paper II is at 2:30 pm")+'</h2><p>Sitting it at the real time trains your body clock for exam day. You can still start now.</p><div class="row"><button class="btn primary" data-m="go">Start now</button><button class="btn ghost" data-m="x">Later</button></div>',function(a){if(a==="go")go()});
}
function qzAfterSubmit(id,rec){
  var x=rec.x;if(!x||!x.reh)return;var r=rehRec(x.reh);if(!r)return;
  var u=Object.assign({},r);u[x.paper]=id;put(x.reh,u);
}
// results of a rehearsal paper stay hidden until both papers are done
function resultGate(att,qs,fresh){
  var x=att.x;if(!x||!x.reh)return false;var r=rehRec(x.reh);if(!r||r.cs==="cancelled")return false;
  if(r.gs&&r.cs&&r.cs!=="cancelled"){if(fresh&&x.paper==="cs"){rehSummary(r,qs);return true}return false}
  VIEW.screen="result";stopPlayer(true);
  $("app").innerHTML='<div class="page"><section class="panel center lockres"><h1>Paper I submitted</h1><p>Your answers are saved. Scores and explanations open after Paper II, just like the wait on exam day.</p><p class="muted small">Have lunch, rest for a while, and do not look up answers. Paper II (CSAT) is at 2:30 pm.</p><div class="row wrap" style="justify-content:center"><button class="btn primary" id="lk-cs">Start Paper II now</button><button class="btn" id="lk-back">Back to the app</button></div></section></div>';
  $("lk-cs").onclick=function(){VIEW.screen="tabs";rehStart("cs")};$("lk-back").onclick=function(){VIEW.screen="tabs";render()};
  return true;
}
function rehSummary(r,csQs){
  var g=DB.recs[r.gs],c=DB.recs[r.cs];VIEW.screen="result";
  var gp=g.pts/g.max*200,cp=c.pts/c.max*100,ci=cutInfo(),pass=cp>=33,clear=gp>=ci.latest;
  $("app").innerHTML='<div class="page"><div class="pagehead"><div><h1>Rehearsal result</h1><p class="muted">'+esc(r.label||"")+' · '+fdy(g.date)+'</p></div></div>'+
    '<section class="panel scorecard"><div class="big"><b>'+r1(gp)+'</b><span>of 200 in GS Paper I · '+esc(cutCat())+' cut-off '+ci.latestY+': '+ci.latest+'</span></div>'+
    '<p class="'+(pass&&clear?"good":"bad-t")+'"><b>'+(pass?(clear?"You would have cleared Prelims "+ci.latestY+".":"CSAT qualifies, but GS is "+r1(ci.latest-gp)+" marks short of the "+ci.latestY+" cut-off."):"CSAT is below 33% ("+Math.round(cp)+"%), so GS would not be evaluated.")+'</b></p>'+
    '<dl class="stats"><div><dt>GS right / wrong</dt><dd>'+g.r+' / '+g.w+'</dd></div><div><dt>GS skipped</dt><dd>'+g.sk+'</dd></div><div><dt>CSAT</dt><dd>'+Math.round(cp)+'%</dd></div><div><dt>CSAT marks</dt><dd>'+r1(c.pts)+' / '+c.max+'</dd></div></dl></section>'+
    '<div class="row wrap"><button class="btn primary" data-att="'+r.gs+'">Review Paper I</button><button class="btn" data-att="'+r.cs+'">Review Paper II</button><button class="btn ghost" id="rh-done">Done</button></div></div>';
  qsa("[data-att]").forEach(function(b){b.onclick=function(){openAttempt(b.dataset.att)}});$("rh-done").onclick=function(){VIEW.screen="tabs";render()};
}
(function(){var orig=dashRows;dashRows=function(type){return orig(type).filter(function(r){if(r.kind!=="att")return true;var a=DB.recs[r.id];return !(a&&a.x&&a.x.reh&&!rehDone(a.x.reh)&&(rehRec(a.x.reh)||{}).cs!=="cancelled")})}})();

/* ---------- 12. OMR transfer in the last 10 minutes ---------- */
function enterOmr(){if(!QZ||!QZ.x||!QZ.x.omr)return;noteTime();QZ.x.omrPhase=1;QZ.x.view="omr";if(!QZ.x.omrAns)QZ.x.omrAns=new Array(QZ.qs.length).fill(null);saveRun(false);renderQuiz();window.scrollTo(0,0)}
setInterval(function(){if(QZ&&QZ.x&&QZ.x.omr&&!QZ.x.omrPhase&&QZ.timed&&!QZ.hiddenAt&&QZ.limit-elapsed()<=600){toast("10 minutes left: fill the OMR sheet now.",5000);enterOmr()}},1000);
function qzPreSubmit(){
  if(!QZ||!QZ.x||!QZ.x.omr)return true;
  if(!QZ.x.omrPhase){if(QZ.timed&&QZ.limit-elapsed()<=0)return true;enterOmr();return false}
  QZ.x.booklet=QZ.ans.slice();QZ.ans=QZ.x.omrAns.slice();QZ.x.view=null;return true;
}
function renderOmr(){
  var n=QZ.qs.length,A=QZ.x.omrAns,B=QZ.ans,done=A.filter(function(v){return v!=null}).length;
  var groups=[];for(var i=0;i<n;i+=10)groups.push(i);
  $("app").innerHTML='<div class="quiz omr"><header class="qz-top"><button class="btn ghost" id="om-qp">Question paper</button><div class="qz-title"><b>OMR answer sheet</b><span>'+done+' of '+n+' bubbled</span></div><span class="qz-clock" id="qz-clock">'+fmtT(QZ.limit-elapsed())+' left</span><button class="btn primary" id="om-sub">Submit</button></header>'+
    '<div class="page"><p class="muted small">Copy your answers from the question booklet (shown in grey beside each row) onto the sheet. Only what you bubble here is marked, as in the exam.</p><div class="omrgrid">'+
    groups.map(function(g0){return '<div class="omrblk">'+[0,1,2,3,4,5,6,7,8,9].map(function(k){var i=g0+k;if(i>=n)return "";return '<div class="omrrow"><span class="on">'+(i+1)+'</span>'+[0,1,2,3].map(function(c){return '<button class="bub2'+(A[i]===c?" on":"")+'" data-om="'+i+'|'+c+'" aria-label="Question '+(i+1)+' option '+"ABCD"[c]+'">'+"abcd"[c]+'</button>'}).join("")+'<span class="bk">'+(B[i]==null?"–":"ABCD"[B[i]])+'</span></div>'}).join("")+'</div>'}).join("")+'</div></div></div>';
  qsa("[data-om]").forEach(function(b){b.onclick=function(){var p=b.dataset.om.split("|"),i=+p[0],c=+p[1];A[i]=A[i]===c?null:c;qsa('[data-om^="'+i+'|"]').forEach(function(x){x.classList.toggle("on",+x.dataset.om.split("|")[1]===A[i])});var t=document.querySelector(".omr .qz-title span");if(t)t.textContent=A.filter(function(v){return v!=null}).length+" of "+n+" bubbled";saveRun(false)}});
  $("om-qp").onclick=function(){QZ.x.view="qp";renderQuiz()};
  $("om-sub").onclick=function(){var left=A.filter(function(v){return v==null}).length;modal('<h2>Submit your OMR sheet?</h2><p>'+(n-left)+' of '+n+' bubbled. Only bubbled answers are marked.</p><div class="row"><button class="btn primary" data-m="y">Submit</button><button class="btn ghost" data-m="x">Keep working</button></div>',function(a){if(a==="y")submitQuiz()})};
}
function omrResult(a){
  var x=a.x;if(!x||!x.booklet)return "";var B=x.booklet,items=a.items||[],slips=[],missed=0,extra=0;
  items.forEach(function(it,i){var b=B[i],o=it[3]===-1?null:it[3];if(b!=null&&o==null)missed++;else if(b==null&&o!=null)extra++;else if(b!=null&&o!==b)slips.push(i+1)});
  var ok=items.length-slips.length-missed-extra;
  return '<section class="panel"><h2>OMR transfer</h2><p>'+(slips.length||missed?'<b>'+ok+' of '+items.length+'</b> rows match your booklet.':'<b>All answers transferred correctly.</b>')+(slips.length?' <span class="bad-t">'+slips.length+' bubbling slip'+(slips.length>1?"s":"")+' (question '+slips.slice(0,10).join(", ")+')</span>.':'')+(missed?' '+missed+' booklet answer'+(missed>1?"s were":" was")+' not bubbled in time.':'')+'</p><p class="muted small">Tip: bubble in blocks of 10 as you go in the last 20 minutes, and check the question number at the start of every block.</p></section>';
}
function qzExtraHead(){
  var h="";if(QZ.x&&QZ.x.ghost)h+=ghostHead();
  if(QZ.x&&QZ.x.omrPhase)h+='<button class="btn small primary" id="qz-omr">OMR sheet</button>';
  else if(QZ.x&&QZ.x.omr&&QZ.timed)h+='<span class="muted small hide-sm">OMR at 10 min left</span>';
  return h;
}

/* ---------- 13. format drill ---------- */
var DRILL_FMTS=["H","S","P","O","N","M","D"];
function fmtPool(f){
  var out=[];if(!QFMT)return out;
  Object.keys(M.bank).forEach(function(s){if(s==="CSAT")return;(M.bank[s]||[]).forEach(function(x){if(fmtOf(x[0])===f)out.push(x[0])})});
  return out;
}
function startFmtDrill(f,n){
  loadQfmt().then(function(){var pool=fmtPool(f);if(!pool.length){toast("No questions of this type yet.");return}
    startCustom({type:"fmt",title:FMT_SHORT[f]+" drill ("+Math.min(n,pool.length)+" questions)",subject:"Mixed",qids:pickPart(pool,Math.min(n,pool.length)),timed:true})});
}
function fmtPanel(){
  if(!QFMT){loadQfmt().then(function(){if(VIEW.tab==="practice"&&VIEW.screen==="tabs")render()});return ""}
  var fs=fmtStats(),cur=VIEW.fmt||"H",sz=VIEW.fmtN||25;
  return '<section class="panel" id="fmt-panel"><h2>Question-type drill</h2><p class="muted small">UPSC now asks many "how many of the above", Statement-I/II and pairs questions, where one doubtful statement costs the whole question. Drill one type at a time from the whole bank (UPSC questions from 2016–2023 included).</p>'+
    '<div class="chips">'+DRILL_FMTS.map(function(f){var s=fs[f],n=s?s.r+s.w:0,a=n?Math.round(s.r/n*100)+"%":"";return '<button class="chipbtn" data-fd="'+f+'" aria-pressed="'+(cur===f)+'">'+esc(FMT_SHORT[f])+(a?' <span>'+a+'</span>':' <span>'+fmtPool(f).length+'</span>')+'</button>'}).join("")+'</div>'+
    '<p class="small">'+esc(FMT_LABEL[cur])+': '+fmtPool(cur).length+' questions in the bank.'+(fs[cur]&&(fs[cur].r+fs[cur].w)?' Your accuracy: '+Math.round(fs[cur].r/(fs[cur].r+fs[cur].w)*100)+'%.':'')+'</p>'+
    '<div class="row wrap"><div class="seg small">'+[10,25,50].map(function(n){return '<button data-fn="'+n+'" aria-pressed="'+(sz===n)+'">'+n+'</button>'}).join("")+'</div><button class="btn primary" id="fd-go">Start '+sz+' '+esc(FMT_SHORT[cur])+' questions</button></div></section>';
}

/* ---------- 14. map questions ---------- */
var INDIA=null;
function loadIndia(){if(INDIA)return Promise.resolve(INDIA);return fetch("data/india.json").then(function(r){return r.json()}).then(function(d){INDIA=d;return d})}
function mproj(lat,lon){var p=INDIA.proj,m=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;return [p.ax*lon+p.bx,p.ay*m+p.by]}
function mapSvg(mp,reveal){
  if(!INDIA){loadIndia().then(function(){if(VIEW.screen==="quiz"&&QZ)renderQuiz();else if(VIEW.screen==="result"&&RES)renderResult(false);else if(VIEW.screen==="flash"&&FC)drawFlash()});return '<div class="mapbox"><p class="muted small">Loading the map…</p></div>'}
  var pts=(mp.pts||[mp]).map(function(p){var xy=mproj(p.lat,p.lon);return {x:xy[0],y:xy[1],l:p.l||""}});
  var vb=INDIA.viewBox.split(" ").map(Number),VB=(vb[0]-14)+" "+(vb[1]-14)+" "+(vb[2]+28)+" "+(vb[3]+28);
  var s='<svg class="imap" viewBox="'+VB+'" role="img" aria-label="Map of India with a marked place">'+INDIA.states.map(function(st){return '<path d="'+st[1]+'"><title>'+esc(st[0])+'</title></path>'}).join("");
  pts.forEach(function(p,i){s+='<circle class="mring" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="11"/><circle class="mdot" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="5"/>'+(pts.length>1?'<text class="mlab" x="'+(p.x+9).toFixed(1)+'" y="'+(p.y-8).toFixed(1)+'">'+(p.l||(i+1))+'</text>':'')});
  return '<div class="mapbox">'+s+'</svg><span class="mapsrc">Map: svg-maps/india, CC BY 4.0</span></div>';
}


/* ---------- 15. saved questions (bookmarks) ---------- */
function bmId(qid){return "bm_"+sid_(qid)}
function isBm(qid){return !!live(bmId(qid))}
function toggleBm(qid){if(isBm(qid)){del(bmId(qid));toast("Removed from saved questions.")}else{put(bmId(qid),{kind:"bm",qid:qid});toast("Saved for revision.")}}
function bmList(){return recs("bm").sort(function(a,b){return b.ts-a.ts}).map(function(r){return r.qid})}
function bmBtn(qid,cls){var on=isBm(qid);return '<button class="'+(cls||"link")+' bm'+(on?" on":"")+'" data-bm="'+esc(qid)+'" aria-pressed="'+on+'" title="Save for revision">'+(on?"★ Saved":"☆ Save")+'</button>'}

/* ---------- 16. my notes on questions and on notes pages ---------- */
function qnId(qid){return "qn_"+sid_(qid)}
function qNote(qid){var r=live(qnId(qid));return r&&r.t?r.t:""}
function qNoteHtml(qid){var t=qNote(qid);return t?'<div class="mynote"><b>My note</b> '+esc(t)+'</div>':""}
function noteDialog(title,cur,save){
  modal('<h2>'+esc(title)+'</h2><label class="fld">Your note<textarea id="mn-t" rows="5" placeholder="A memory trick, the fact you mixed up, where to read more…">'+esc(cur||"")+'</textarea></label><p class="muted small">Saved to your Google Sheet and shown wherever this comes up again: reviews, flashcards, unit sheets and search.</p><div class="row"><button class="btn primary" id="mn-save">Save note</button>'+(cur?'<button class="btn ghost" id="mn-del">Delete</button>':'')+'<button class="btn ghost" data-m="x">Cancel</button></div>');
  $("mn-save").onclick=function(){save($("mn-t").value.trim());closeModal()};
  if($("mn-del"))$("mn-del").onclick=function(){save("");closeModal()};
}
function editQNote(qid,q,after){noteDialog("My note on this question",qNote(qid),function(t){if(t)put(qnId(qid),{kind:"qn",qid:qid,t:t,q:String(q&&q.q||"").slice(0,160),sub:q&&q.sub||"",u:q&&q.u||""});else if(live(qnId(qid)))del(qnId(qid));if(after)after()})}
function pnId(id,p){return "pn_"+sid_(id)+"_"+p}
function pageNote(id,p){var r=live(pnId(id,p));return r&&r.t?r.t:""}
function pageNoteHtml(id,p){var t=pageNote(id,p);return '<div class="pnote">'+(t?'<div class="mynote"><b>My note</b> '+esc(t)+'</div>':'')+'<button class="link" data-pnote="'+esc(id)+'|'+p+'">'+(t?"Edit my note":"Add my note to this page")+'</button></div>'}
function bindPageNote(redraw){qsa("[data-pnote]").forEach(function(b){b.onclick=function(){var p=b.dataset.pnote.split("|"),id=p[0],pg=+p[1],title=(SET[id]&&SET[id].title)||(M.notes&&M.notes[id]&&M.notes[id].title)||id;
  noteDialog("My note: "+title+", page "+pg,pageNote(id,pg),function(t){if(t)put(pnId(id,pg),{kind:"pn",nid:id,p:pg,t:t,title:title});else if(live(pnId(id,pg)))del(pnId(id,pg));if(redraw)redraw()})}})}
window.pdfPageNote=function(id,p){var title=(M.notes&&M.notes[id]&&M.notes[id].title)||id;noteDialog("My note: "+title+", page "+p,pageNote(id,p),function(t){if(t)put(pnId(id,p),{kind:"pn",nid:id,p:p,t:t,title:title,pdf:1});else if(live(pnId(id,p)))del(pnId(id,p));toast(t?"Note saved.":"Note deleted.")})};
function sheetNotes(subj,unit){
  var L=recs("qn").filter(function(r){return r.sub===subj&&r.u===unit});if(!L.length)return "";
  return '<h2>My notes</h2><ul class="plain sheetfacts">'+L.map(function(r){return '<li>'+esc(r.t)+(r.q?' <span class="muted small">(on: '+esc(r.q.slice(0,80))+'…)</span>':'')+'</li>'}).join("")+'</ul>';
}
function myNotesList(){
  var L=recs("qn").map(function(r){return {k:"q",t:r.t,sub:r.q,qid:r.qid,ts:r.ts,where:(r.sub||"")+(r.u?" · "+r.u:"")}}).concat(recs("pn").map(function(r){return {k:"p",t:r.t,sub:r.title+", page "+r.p,nid:r.nid,p:r.p,pdf:r.pdf,ts:r.ts}}));
  return L.sort(function(a,b){return b.ts-a.ts});
}

/* ---------- 17. Ask Claude about a question ---------- */
function askPrompt(q,ch){
  var L="ABCD",o=(q.o||[]).map(function(t,k){return "("+L[k]+") "+t}).join("\n");
  return "I am preparing for UPSC Civil Services Prelims 2027. Help me understand this question.\n\n"+(q.p?"Passage:\n"+q.p+"\n\n":"")+"Question:\n"+q.q+"\n\nOptions:\n"+o+"\n\nAnswer key: ("+L[q.a]+")"+(ch!=null&&ch>=0?"\nMy answer: ("+L[ch]+")":"")+(q.e?"\n\nExplanation given:\n"+q.e:"")+
    "\n\nPlease: 1) explain why the key is right"+(ch!=null&&ch>=0&&ch!==q.a?" and why my answer is wrong":"")+", statement by statement; 2) give the underlying concept in simple words; 3) list 5 related facts UPSC could ask next; 4) give one memory trick. If you think the answer key is wrong, say so and why.";
}
function askClaude(q,ch){var t=askPrompt(q,ch);copyText(t,"Question copied. Paste it into Claude if it does not appear.");setTimeout(function(){window.open("https://claude.ai/new?q="+encodeURIComponent(t.slice(0,6000)),"_blank","noopener")},250)}

/* ---------- 18. search everything ---------- */
var SIDX=null;
function loadSearch(){if(SIDX)return Promise.resolve(SIDX);return fetch("data/search.json").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){SIDX=d.rows.map(function(r){return {r:r,lc:(r[4]+" "+r[5]+" "+r[3]+" "+r[2]).toLowerCase()}});return SIDX})}
var SRCH={q:"",f:"all"};
function openSearch(q){
  stopPlayer(true);VIEW.screen="search";if(q!=null)SRCH.q=q;document.body.classList.add("in-quiz");window.scrollTo(0,0);
  $("app").innerHTML='<div class="page srch"><div class="row between"><button class="btn small" id="sr-back">‹ Back</button><span class="muted small" id="sr-n"></span></div><input type="search" id="sr-q" class="ftsearch big" placeholder="Search questions, notes, fact tables, your notes…" value="'+esc(SRCH.q)+'" autocomplete="off">'+
    '<div class="chips" id="sr-f">'+[["all","Everything"],["q","Questions"],["n","Notes"],["f","Fact tables"],["m","My notes and saved"]].map(function(f){return '<button class="chipbtn" data-sf="'+f[0]+'" aria-pressed="'+(SRCH.f===f[0])+'">'+f[1]+'</button>'}).join("")+'</div><div id="sr-res"><p class="muted">Loading the search index (about 1 MB, once)…</p></div></div>';
  $("sr-back").onclick=function(){backToTabs()};
  var inp=$("sr-q"),t=null;inp.focus();
  inp.oninput=function(){clearTimeout(t);t=setTimeout(function(){SRCH.q=inp.value;drawSearch()},180)};
  qsa("[data-sf]").forEach(function(b){b.onclick=function(){SRCH.f=b.dataset.sf;qsa("[data-sf]").forEach(function(x){x.setAttribute("aria-pressed",x===b)});drawSearch()}});
  loadSearch().then(drawSearch).catch(function(){$("sr-res").innerHTML='<p class="muted">The search index could not be loaded. Connect to the internet once so it can be stored on this device.</p>'});
}
function hl(t,terms){var s=esc(t);terms.forEach(function(w){if(w.length<2)return;s=s.replace(new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>")});return s}
function drawSearch(){
  var box=$("sr-res");if(!box||!SIDX)return;var q=SRCH.q.trim().toLowerCase(),terms=q.split(/\s+/).filter(Boolean);
  if(!terms.length){box.innerHTML='<p class="muted small">Type a word or two: a scheme, a river, an Article number, a person. Results come from all '+SIDX.length.toLocaleString()+' questions, the current-affairs and study notes, the fact tables, and your own notes.</p>';$("sr-n").textContent="";return}
  var mine=[];
  if(SRCH.f==="all"||SRCH.f==="m"){
    myNotesList().forEach(function(n){var lc=(n.t+" "+n.sub).toLowerCase();if(terms.every(function(w){return lc.indexOf(w)>=0}))mine.push(n)});
    if(SRCH.f==="m"){bmList().forEach(function(qid){var e=SIDX.filter(function(x){return x.r[1]===qid})[0];if(e&&terms.every(function(w){return e.lc.indexOf(w)>=0}))mine.push({k:"bm",qid:qid,t:e.r[4],sub:e.r[2]+" · "+e.r[3]})})}
  }
  var res=[];
  if(SRCH.f!=="m")for(var i=0;i<SIDX.length&&res.length<80;i++){var e=SIDX[i],k=e.r[0];
    if(SRCH.f==="q"&&k!=="q")continue;if(SRCH.f==="n"&&k!=="c"&&k!=="p")continue;if(SRCH.f==="f"&&k!=="f")continue;
    if(terms.every(function(w){return e.lc.indexOf(w)>=0}))res.push(e.r)}
  var order={f:0,c:1,p:2,q:3};res.sort(function(a,b){return order[a[0]]-order[b[0]]});
  $("sr-n").textContent=(res.length>=80?"80+":res.length+mine.length)+" found";
  var KL={q:"Question",c:"CA notes",p:"Study notes",f:"Fact table"};
  box.innerHTML=(mine.length?'<h3>Your notes and saved questions</h3><ul class="list srl">'+mine.slice(0,20).map(function(n){return '<li class="click" data-mine="'+esc(n.k)+'|'+esc(n.qid||n.nid||"")+'|'+(n.p||"")+'|'+(n.pdf?1:"")+'"><div><span class="tag">'+(n.k==="bm"?"Saved":"My note")+'</span> <b>'+hl(n.t,terms)+'</b><span class="muted small block">'+esc(n.sub||n.where||"")+'</span></div></li>'}).join("")+'</ul>':'')+
    (res.length?'<ul class="list srl">'+res.map(function(r){return '<li class="click" data-hit="'+esc(r[0])+'|'+esc(r[1])+'"><div><span class="tag">'+KL[r[0]]+'</span> <span class="muted small">'+esc(r[0]==="q"?r[2]+" · "+r[3]:r[2]+(r[3]?" · "+r[3]:""))+'</span><b class="block">'+hl(r[4],terms)+'</b><span class="small muted block">'+hl(r[0]==="q"?"Answer: "+r[5]:r[5].slice(0,220),terms)+'</span></div></li>'}).join("")+'</ul>':(mine.length?'':'<p class="muted">Nothing found. Try fewer or different words.</p>'));
  qsa("[data-hit]").forEach(function(li){li.onclick=function(){var p=li.dataset.hit.split("|"),k=p[0],id=p.slice(1).join("|");openHit(k,id)}});
  qsa("[data-mine]").forEach(function(li){li.onclick=function(){var p=li.dataset.mine.split("|");if(p[0]==="q"||p[0]==="bm")openHit("q",p[1]);else if(p[3])openHit("p",p[1]+"#"+p[2]);else openHit("c",p[1]+"#"+p[2])}});
}
function openHit(k,id){
  var p=id.split("#");document.body.classList.remove("in-quiz");
  if(k==="q")return showQuestion(id);
  if(k==="c")return openCamNotes(p[0],+p[1],"tabs");
  if(k==="f")return loadFacts().then(function(T){var t=T.filter(function(x){return x.id===p[0]})[0];if(!t)return;VIEW.screen="facts";VIEW.ft={t:t,q:SRCH.q.trim(),hide:false};drawFacts();window.scrollTo(0,0)});
  if(k==="p"){try{localStorage.setItem("pa_notes_pos_"+p[0],p[1])}catch(e){}return openNotes(p[0])}
}
function showQuestion(qid){
  loadQids([qid]).then(function(l){var q=l[0];if(!q){toast("This question could not be loaded.");return}
    modal('<div class="qmeta">'+pyqChip(q)+'<span class="chip">'+esc(q.sub)+' · '+esc(q.u)+'</span></div>'+passageHtml(q,false)+(q.map?mapSvg(q.map,true):"")+'<div class="qtext">'+esc(q.q)+'</div><ul class="ropts">'+q.o.map(function(t,k){return '<li class="'+(k===q.a?"right":"")+'"><span class="ob">'+"ABCD"[k]+'</span><span class="ot">'+esc(t)+'</span></li>'}).join("")+'</ul><div class="expl"><b>Explanation.</b> '+esc(q.e||"")+(q.h?'<div class="hook">Memory hook: '+esc(q.h)+'</div>':'')+qNoteHtml(qid)+'</div>'+
      '<div class="row wrap">'+bmBtn(qid,"btn small")+'<button class="btn small" id="sq-note">My note</button><button class="btn small" id="sq-ask">Ask Claude</button><button class="btn small" id="sq-unit">Test this unit</button><button class="btn ghost small" data-m="x">Close</button></div>');
    qsa("#modal [data-bm]").forEach(function(b){b.onclick=function(){toggleBm(qid);closeModal();showQuestion(qid)}});
    $("sq-note").onclick=function(){closeModal();editQNote(qid,q,function(){showQuestion(qid)})};
    $("sq-ask").onclick=function(){askClaude(q,null)};
    $("sq-unit").onclick=function(){closeModal();VIEW.screen="tabs";startSubjectTest(q.sub,[q.u])};
  });
}

/* ---------- 19. smart practice (adapts to you) ---------- */
function smartLevel(){
  var sm=attempts().filter(function(a){return a.type==="smart"}).slice(-3);if(!sm.length)return 2;
  var r=0,w=0;sm.forEach(function(a){r+=a.r;w+=a.w});var acc=r+w?r/(r+w):0.6;
  var lv=sm[sm.length-1].x&&sm[sm.length-1].x.lv||2;
  if(acc>=0.72)lv=Math.min(3,lv+1);else if(acc<0.5)lv=Math.max(1,lv-1);return lv;
}
var SMART_FMTS={1:"DM",2:"DMNHS",3:"NHSPO"};
function buildSmart(n){
  var lv=smartLevel(),used={},out=[],h=qHistory();
  var add=function(list,k){var c=0;for(var i=0;i<list.length&&c<k&&out.length<n;i++){var q=list[i];if(used[q])continue;used[q]=1;out.push(q);c++}return c};
  var okF=function(q){var f=fmtOf(q);return !f||SMART_FMTS[lv].indexOf(f)>=0};
  // 20%: due mistakes, confidently wrong first
  add(mistakeBook().filter(function(m){return m.isDue}).map(function(m){return m.qid}),Math.round(n*0.2));
  // 35%: priority units, at the right difficulty
  var P=priorityData(),top=P.rows.filter(function(r){return r.acc==null||r.acc<70}).slice(0,10),pp=[];
  top.forEach(function(r){pp=pp.concat(poolFor(r.s,[r.u]))});
  add(shuffle(pp.filter(function(q){return okF(q)&&!h[q]})).concat(shuffle(pp.filter(okF))),Math.round(n*0.35));
  // 20%: your weakest question type
  var fs=fmtStats(),wk=null;Object.keys(fs).forEach(function(f){var s=fs[f],m=s.r+s.w;if(m>=15&&(!wk||s.r/m<wk.a))wk={f:f,a:s.r/m}});
  add(shuffle(fmtPool(wk?wk.f:(lv===1?"M":"H")).filter(function(q){return !h[q]})),Math.round(n*0.2));
  // rest: units you have not practised for two weeks, unseen questions first
  var st=unitStats(addDays(today(),-14),today()),stale=[];
  Object.keys(M.bank).forEach(function(s){if(s==="CSAT")return;(M.bank[s]||[]).forEach(function(x){if(!(st[s]&&st[s].units[x[1]])&&!h[x[0]]&&okF(x[0]))stale.push(x[0])})});
  add(shuffle(stale),n-out.length);
  if(out.length<n){var all=[];Object.keys(M.bank).forEach(function(s){if(s!=="CSAT")(M.bank[s]||[]).forEach(function(x){all.push(x[0])})});add(shuffle(all),n-out.length)}
  return {qids:shuffle(out),lv:lv,wk:wk};
}
function startSmart(n){loadQfmt().then(function(){var b=buildSmart(n);startCustom({type:"smart",title:"Smart practice ("+b.qids.length+"), "+fd(today()),subject:"Mixed",qids:b.qids,timed:true,x:{lv:b.lv}})})}
var LV_TXT={1:"Building up: more direct and two-statement questions",2:"Mixed: a normal UPSC spread",3:"Stretch: mostly 3+ statements, how many, pairs and Statement I/II"};
function smartPanel(){
  var lv=smartLevel(),sm=attempts().filter(function(a){return a.type==="smart"}),last=sm[sm.length-1];
  return '<section class="panel smart" id="smart-panel"><div class="row between wrap"><h2>Smart practice</h2><span class="tag">Level '+lv+' of 3</span></div><p class="small">One mixed test built for you: your due mistakes (confidently-wrong ones first), units UPSC asks most where you are weakest, your weakest question type, and units you have not touched for two weeks. It gets harder when you score above 72% and easier below 50%.</p><p class="muted small">Now: '+esc(LV_TXT[lv])+'.'+(last?' Last smart test: '+last.pts+' / '+last.max+' on '+fd(last.date)+'.':'')+'</p><div class="row wrap"><button class="btn primary" data-smart="25">25 questions (30 min)</button><button class="btn" data-smart="50">50 questions (1 hour)</button></div></section>';
}

/* ---------- 20. tap-the-map drill and map practice sets ---------- */
var MAPQ=null;
function loadMapq(){if(MAPQ)return Promise.resolve(MAPQ);return fetch("data/mapq.json").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){MAPQ=d;return d})}
function mapPanel(){
  var ms=M.sets.filter(function(s){return s.type==="mapq"&&s.ready});
  var done=setDoneMap(),best=(DB.meta.tapBest||{});
  if(!ms.length)return "";
  return '<section class="panel" id="map-panel"><h2>Map practice</h2><p class="muted small">UPSC asks places in the news, rivers, lakes, passes, national parks, Ramsar sites and ports. Two ways to practise: name the marked place (scored like any test, and mistakes come back in revision), or tap the map where a place is.</p>'+
    '<ul class="list">'+ms.map(function(s){var d=done[s.id];return '<li><div><b>'+esc(s.title)+'</b><span class="muted small">'+s.n+' questions'+(d?', taken '+d+' time'+(d>1?"s":""):'')+'</span></div><button class="btn small'+(d?"":" primary")+'" data-cset="'+s.id+'">'+(d?"Retake":"Start")+'</button></li>'}).join("")+'</ul>'+
    '<div class="row wrap"><button class="btn" data-tap="all">Tap the map: 15 places</button>'+(best.all!=null?'<span class="muted small">Best: '+best.all+' of 15</span>':'')+'</div></section>';
}
var TAP=null;
function startTap(){
  Promise.all([loadIndia(),loadMapq()]).then(function(){
    var pl=shuffle(MAPQ.places.slice()).slice(0,15);TAP={pl:pl,i:0,score:0,res:[],shown:false};VIEW.screen="tap";document.body.classList.add("in-quiz");drawTap();
  }).catch(function(){toast("Could not load the map data. Check your connection once.")});
}
function hav(a,b,c,d){var R=6371,r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 2*R*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))}
function drawTap(){
  if(TAP.i>=TAP.pl.length)return tapEnd();
  var p=TAP.pl[TAP.i],r=TAP.res[TAP.i];
  var vb=INDIA.viewBox.split(" ").map(Number);var s='<svg class="imap tap" id="tap-svg" viewBox="'+(vb[0]-14)+" "+(vb[1]-14)+" "+(vb[2]+28)+" "+(vb[3]+28)+'">'+INDIA.states.map(function(st){return '<path d="'+st[1]+'"/>'}).join("");
  if(r){var a=mproj(p.lat,p.lon),b=r.xy;s+='<line class="tapline" x1="'+b[0]+'" y1="'+b[1]+'" x2="'+a[0]+'" y2="'+a[1]+'"/><circle class="tapyou" cx="'+b[0]+'" cy="'+b[1]+'" r="6"/><circle class="mring" cx="'+a[0]+'" cy="'+a[1]+'" r="11"/><circle class="mdot" cx="'+a[0]+'" cy="'+a[1]+'" r="5"/>'}
  s+='</svg>';
  $("app").innerHTML='<div class="fc"><header class="fc-bar"><button class="btn small" id="tp-x">Close</button><span class="muted small">'+(TAP.i+1)+' / '+TAP.pl.length+'</span><span class="small good">'+TAP.score+' ✓</span></header>'+
    '<h2 class="tap-q">Tap: <b>'+esc(p.name)+'</b></h2><p class="muted small center">'+esc(p.type)+(p.hint?' · '+esc(p.hint):'')+'</p><div class="mapbox">'+s+'<span class="mapsrc">Map: svg-maps/india, CC BY 4.0</span></div>'+
    (r?'<p class="center '+(r.ok?"good":"bad-t")+'"><b>'+(r.ok?"Got it":"Not quite")+'</b> – '+Math.round(r.km)+' km away. '+esc(p.state||"")+'</p>'+(p.note?'<p class="small center">'+esc(p.note)+'</p>':'')+'<div class="fc-actions"><button class="btn big primary wide" id="tp-next">Next</button></div>':'<p class="muted small center">Within 150 km counts as right.</p>')+'</div>';
  $("tp-x").onclick=tapEnd;
  if(r)$("tp-next").onclick=function(){TAP.i++;drawTap()};
  else{var svg=$("tap-svg");svg.addEventListener("click",function(e){var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var m=pt.matrixTransform(svg.getScreenCTM().inverse());
    // back from map units to latitude and longitude
    var pr=INDIA.proj,lon=(m.x-pr.bx)/pr.ax,mm=(m.y-pr.by)/pr.ay,lat=(2*Math.atan(Math.exp(mm*Math.PI/180))-Math.PI/2)*180/Math.PI;
    var km=hav(lat,lon,p.lat,p.lon),ok=km<=150;if(ok)TAP.score++;TAP.res[TAP.i]={xy:[m.x,m.y],km:km,ok:ok};drawTap()})}
}
function tapEnd(){
  if(!TAP)return backToTabs();var n=TAP.res.filter(Boolean).length,sc=TAP.score,miss=TAP.pl.filter(function(p,i){return TAP.res[i]&&!TAP.res[i].ok});TAP=null;
  if(!n)return backToTabs();var b=DB.meta.tapBest=DB.meta.tapBest||{};if(n===15&&(b.all==null||sc>b.all)){b.all=sc;saveStore()}
  $("app").innerHTML='<div class="page fc-end"><h1>Tap the map</h1><p class="lead">'+sc+' of '+n+'</p>'+(miss.length?'<h3>Look at these again</h3><ul class="plain small">'+miss.map(function(p){return '<li><b>'+esc(p.name)+'</b> – '+esc(p.state||"")+(p.note?': '+esc(p.note):'')+'</li>'}).join("")+'</ul>':'')+'<div class="row wrap"><button class="btn primary" id="tp-again">Another round</button><button class="btn ghost" id="tp-done">Done</button></div></div>';
  $("tp-again").onclick=startTap;$("tp-done").onclick=backToTabs;
}


/* ---------- 21. Mains answer practice (for after Prelims) ---------- */
var MAINS=null;
function loadMains(){if(MAINS)return Promise.resolve(MAINS);return fetch("data/mains.json").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){MAINS=d;return d})}
var MAINS_CHECK=[["intro","Opened with a direct intro (definition, data or context)"],["demand","Answered every part the question asks (directive word followed)"],["body","Body in clear points or sub-headings"],["eg","Used examples, data, reports, cases or Articles"],["dim","Covered more than one dimension (social, economic, political…)"],["diag","Added a diagram, flowchart or map where it helps"],["end","Ended with a balanced conclusion or way forward"],["limit","Stayed within the word and time limit"]];
function mainsRecs(){return recs("mains").sort(function(a,b){return b.ts-a.ts})}
function mainsPanel(){
  var n=mainsRecs().length,days=dayNum("2027-08-20")-dayNum(today());
  return '<section class="panel" id="mains-panel"><div class="row between wrap"><h2>Mains answer practice</h2><span class="tag">For after Prelims</span></div><p class="muted small">Mains begins on 20 August 2027 ('+days+' days away), about 90 days after Prelims. Prelims comes first; this is here for the weeks after 23 May, or for one answer on a Sunday if you want to keep writing. Timed answers with a word count, a self-check and points to cover.</p><div class="row wrap"><button class="btn" data-mains="open">Open Mains practice</button>'+(n?'<span class="muted small">'+n+' answer'+(n>1?"s":"")+' written</span>':'')+'</div></section>';
}
var MV=null;
function openMains(){
  stopPlayer(true);$("app").innerHTML='<div class="page"><p class="muted">Loading…</p></div>';
  loadMains().then(function(d){VIEW.screen="mains";document.body.classList.add("in-quiz");MV={paper:MV&&MV.paper||d.papers[0].id};drawMainsList()}).catch(function(){backToTabs();toast("Could not load the Mains questions. Check your connection once.")});
}
function drawMainsList(){
  var d=MAINS,done={};mainsRecs().forEach(function(r){done[r.qid]=(done[r.qid]||0)+1});
  var p=d.papers.filter(function(x){return x.id===MV.paper})[0];
  $("app").innerHTML='<div class="page"><div class="row between wrap"><button class="btn small" id="mn-back">‹ Back</button><h1 style="margin:0">Mains practice</h1></div>'+
    '<div class="chips">'+d.papers.map(function(x){return '<button class="chipbtn" data-mp="'+x.id+'" aria-pressed="'+(x.id===MV.paper)+'">'+esc(x.title)+'</button>'}).join("")+'</div><p class="muted small">'+esc(p.about||"")+'</p>'+
    '<ul class="list">'+p.q.map(function(q){return '<li><div><b>'+esc(q.q)+'</b><span class="muted small">'+q.m+' marks · '+q.w+' words · '+q.min+' min'+(done[q.id]?' · written '+done[q.id]+' time'+(done[q.id]>1?"s":""):'')+'</span></div><button class="btn small'+(done[q.id]?"":" primary")+'" data-mq="'+q.id+'">Write</button></li>'}).join("")+'</ul>'+
    (mainsRecs().length?'<h2>My answers</h2><ul class="list">'+mainsRecs().slice(0,20).map(function(r){return '<li><div><b>'+esc(r.q.slice(0,110))+(r.q.length>110?"…":"")+'</b><span class="muted small">'+fdy(r.date)+' · '+r.words+' words in '+fmtMin(r.sec)+' · self-check '+r.score+'/'+MAINS_CHECK.length+'</span></div><button class="btn small ghost" data-mr="'+r.id+'">Open</button></li>'}).join("")+'</ul>':'')+'</div>';
  $("mn-back").onclick=backToTabs;
  qsa("[data-mp]").forEach(function(b){b.onclick=function(){MV.paper=b.dataset.mp;drawMainsList()}});
  qsa("[data-mq]").forEach(function(b){b.onclick=function(){mainsWrite(b.dataset.mq)}});
  qsa("[data-mr]").forEach(function(b){b.onclick=function(){mainsView(b.dataset.mr)}});
}
function mainsFind(id){var out=null;MAINS.papers.forEach(function(p){p.q.forEach(function(q){if(q.id===id)out={p:p,q:q}})});return out}
function mainsWrite(id){
  var f=mainsFind(id);if(!f)return;var q=f.q,t0=Date.now(),draft=(DB.meta.mainsDraft||{})[id]||"";
  $("app").innerHTML='<div class="page mainsw"><div class="row between wrap"><button class="btn small" id="mw-back">‹ Questions</button><span class="qz-clock" id="mw-clock">'+fmtT(q.min*60)+' left</span></div>'+
    '<p class="muted small">'+esc(f.p.title)+' · '+q.m+' marks · about '+q.w+' words · '+q.min+' minutes</p><h2>'+esc(q.q)+'</h2>'+(q.dw?'<p class="small"><b>Directive:</b> '+esc(q.dw)+'</p>':'')+
    '<textarea id="mw-t" rows="16" placeholder="Write your answer here, or write on paper and type only your outline. Tip: intro (2 lines) – body in points – conclusion or way forward.">'+esc(draft)+'</textarea><div class="row between wrap"><span class="small" id="mw-wc">0 words</span><span class="muted small">Drafts are kept on this device until you submit.</span></div>'+
    '<div class="row wrap"><button class="btn primary" id="mw-done">Done: check my answer</button></div></div>';
  var ta=$("mw-t"),wc=function(){var n=(ta.value.trim().match(/\S+/g)||[]).length;$("mw-wc").textContent=n+" words"+(n>q.w*1.15?" – over the limit":"");return n};wc();
  ta.oninput=function(){wc();var dd=DB.meta.mainsDraft=DB.meta.mainsDraft||{};dd[id]=ta.value;saveStore()};
  clearInterval(MV.tick);MV.tick=setInterval(function(){var el=$("mw-clock");if(!el){clearInterval(MV.tick);return}var left=q.min*60-(Date.now()-t0)/1000;el.textContent=(left<0?"+"+fmtT(-left)+" over":fmtT(left)+" left");el.classList.toggle("low",left<60)},1000);
  $("mw-back").onclick=function(){clearInterval(MV.tick);drawMainsList()};
  $("mw-done").onclick=function(){clearInterval(MV.tick);mainsCheck(f,ta.value,Math.round((Date.now()-t0)/1000),wc())};
}
function mainsCheck(f,text,sec,words){
  var q=f.q;
  $("app").innerHTML='<div class="page mainsw"><h1>Check your answer</h1><p class="small"><b>'+esc(q.q)+'</b></p><p class="muted small">'+words+' words in '+fmtMin(sec)+' (target '+q.w+' words, '+q.min+' min).</p>'+
    '<h2>Points a good answer covers</h2><ul class="plain">'+(q.pts||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul>'+
    '<h2>Self-check</h2><p class="muted small">Tick only what your answer really does.</p><div class="mchk">'+MAINS_CHECK.map(function(c){return '<label class="check"><input type="checkbox" data-mc="'+c[0]+'"'+(c[0]==="limit"&&words<=q.w*1.15&&sec<=q.min*60*1.1?" checked":"")+'> '+esc(c[1])+'</label>'}).join("")+'</div>'+
    '<div class="row wrap"><button class="btn primary" id="mc-save">Save</button><button class="btn" id="mc-ask">Ask Claude to evaluate</button><button class="btn ghost" id="mc-x">Discard</button></div></div>';
  var save=function(){var ch={};qsa("[data-mc]").forEach(function(c){if(c.checked)ch[c.dataset.mc]=1});var id=uid("mains");
    put(id,{kind:"mains",qid:q.id,q:q.q,paper:f.p.id,text:text,words:words,sec:sec,checks:ch,score:Object.keys(ch).length,date:today()});
    var dd=DB.meta.mainsDraft||{};delete dd[q.id];saveStore();return id};
  $("mc-save").onclick=function(){save();toast("Answer saved to your Sheet.");drawMainsList()};
  $("mc-ask").onclick=function(){askMains(q,text,words)};
  $("mc-x").onclick=function(){drawMainsList()};
}
function askMains(q,text,words){
  var t="I am preparing for UPSC Civil Services Mains. Evaluate my answer strictly, as a UPSC examiner would.\n\nQuestion ("+q.m+" marks, about "+q.w+" words):\n"+q.q+"\n\nMy answer ("+words+" words):\n"+text+"\n\nPlease give: 1) a mark out of "+q.m+"; 2) what the question demanded and whether I met it; 3) missing points, data, examples or dimensions; 4) structure and language; 5) a model outline in points; 6) the two changes that would add the most marks.";
  copyText(t,"Answer copied. Paste it into Claude if it does not appear.");setTimeout(function(){window.open("https://claude.ai/new?q="+encodeURIComponent(t.slice(0,6000)),"_blank","noopener")},250);
}
function mainsView(id){
  var r=live(id);if(!r)return;
  $("app").innerHTML='<div class="page mainsw"><button class="btn small" id="mv-back">‹ Back</button><h2>'+esc(r.q)+'</h2><p class="muted small">'+fdy(r.date)+' · '+r.words+' words in '+fmtMin(r.sec)+' · self-check '+r.score+'/'+MAINS_CHECK.length+'</p><div class="mtext">'+paras(r.text)+'</div><ul class="plain small">'+MAINS_CHECK.map(function(c){return '<li>'+(r.checks&&r.checks[c[0]]?"✓ ":"✗ ")+esc(c[1])+'</li>'}).join("")+'</ul><div class="row wrap"><button class="btn" id="mv-ask">Ask Claude to evaluate</button><button class="btn ghost" id="mv-del">Delete</button></div></div>';
  $("mv-back").onclick=drawMainsList;
  $("mv-ask").onclick=function(){var f=mainsFind(r.qid);askMains(f?f.q:{q:r.q,m:10,w:150},r.text,r.words)};
  $("mv-del").onclick=function(){del(id);drawMainsList()};
}


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
