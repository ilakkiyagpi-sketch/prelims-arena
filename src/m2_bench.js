
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
