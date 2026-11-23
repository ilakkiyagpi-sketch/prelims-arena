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
