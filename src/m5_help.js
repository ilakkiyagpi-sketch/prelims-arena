
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
  if(k==="f")return loadFacts().then(function(T){var t=T.filter(function(x){return x.id===p[0]})[0];if(!t)return;VIEW.screen="facts";VIEW.ft={t:t,q:SRCH.q.trim(),hide:false};drawFacts();window.scrollTo(0,0)}).catch(function(){toast("Could not load the fact tables.")});
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
