
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
