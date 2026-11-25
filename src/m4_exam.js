
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
function loadIndia(){if(INDIA)return Promise.resolve(INDIA);return fetch("data/india.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(d){INDIA=d;return d})}
function mproj(lat,lon){var p=INDIA.proj,m=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;return [p.ax*lon+p.bx,p.ay*m+p.by]}
function mapSvg(mp,reveal){
  if(!INDIA){loadIndia().then(function(){if(VIEW.screen==="quiz"&&QZ)renderQuiz();else if(VIEW.screen==="result"&&RES)renderResult(false);else if(VIEW.screen==="flash"&&FC)drawFlash()}).catch(function(){qsa(".mapbox .muted").forEach(function(el){el.textContent="The map could not be loaded. Connect to the internet once so it can be stored on this device."})});return '<div class="mapbox"><p class="muted small">Loading the map…</p></div>'}
  var pts=(mp.pts||[mp]).map(function(p){var xy=mproj(p.lat,p.lon);return {x:xy[0],y:xy[1],l:p.l||""}});
  var vb=INDIA.viewBox.split(" ").map(Number),VB=(vb[0]-14)+" "+(vb[1]-14)+" "+(vb[2]+28)+" "+(vb[3]+28);
  var s='<svg class="imap" viewBox="'+VB+'" role="img" aria-label="Map of India with a marked place">'+INDIA.states.map(function(st){return '<path d="'+st[1]+'"><title>'+esc(st[0])+'</title></path>'}).join("");
  pts.forEach(function(p,i){s+='<circle class="mring" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="11"/><circle class="mdot" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="5"/>'+(pts.length>1?'<text class="mlab" x="'+(p.x+9).toFixed(1)+'" y="'+(p.y-8).toFixed(1)+'">'+(p.l||(i+1))+'</text>':'')});
  return '<div class="mapbox">'+s+'</svg><span class="mapsrc">Map: svg-maps/india, CC BY 4.0</span></div>';
}
