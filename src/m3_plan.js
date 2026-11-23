
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
