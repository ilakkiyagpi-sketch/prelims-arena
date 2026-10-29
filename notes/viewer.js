/* Prelims Arena notes reader: shows a notes PDF page by page on canvas.
   No download, print or text-selection controls are offered. Files are kept for offline use by the service worker. */
(function(){
  var LIB="notes/pdf.min.js",WORKER="notes/pdf.worker.min.js",libP=null;
  function loadLib(){
    if(window.pdfjsLib)return Promise.resolve();
    if(libP)return libP;
    libP=new Promise(function(ok,bad){var s=document.createElement("script");s.src=LIB;s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;ok()};s.onerror=function(){libP=null;bad(new Error("lib"))};document.head.appendChild(s)});
    return libP;
  }
  var cur=null;
  function posKey(id){return "pa_notes_pos_"+id}
  function close(){
    if(cur){try{cur.io&&cur.io.disconnect();cur.doc&&cur.doc.destroy()}catch(e){}window.removeEventListener("resize",cur.onResize);document.removeEventListener("contextmenu",block,true);}
    cur=null;document.body.classList.remove("in-notes");VIEW.screen="tabs";render();
  }
  function block(e){if(cur)e.preventDefault()}
  window.openNotes=function(id){
    var info=M&&M.notes&&M.notes[id];if(!info)return;
    VIEW.screen="notes";document.body.classList.add("in-notes");window.scrollTo(0,0);
    $("app").innerHTML='<div class="nv"><header class="nv-bar"><button class="btn small" id="nv-back">Back</button><div class="nv-title"><b>'+esc(info.title)+'</b><span id="nv-pg" class="muted small">Opening…</span></div><div class="nv-zoom"><button class="btn small" id="nv-minus" aria-label="Smaller">A−</button><button class="btn small" id="nv-plus" aria-label="Larger">A+</button></div></header><div id="nv-body" class="nv-body"><p class="muted nv-msg">Opening the notes…</p></div></div>';
    $("nv-back").onclick=close;
    document.addEventListener("contextmenu",block,true);
    var st={id:id,info:info,zoom:1,pages:[],io:null,doc:null,rendering:{}};cur=st;
    var body=$("nv-body");
    Promise.all([loadLib(),fetch(info.file).then(function(r){if(!r.ok)throw new Error("file");return r.arrayBuffer()})]).then(function(a){
      return window.pdfjsLib.getDocument({data:a[1]}).promise;
    }).then(function(doc){
      if(cur!==st){doc.destroy();return}
      st.doc=doc;return doc.getPage(1).then(function(p1){
        var vp=p1.getViewport({scale:1});st.ratio=vp.height/vp.width;
        body.innerHTML="";
        for(var i=1;i<=doc.numPages;i++){var w=document.createElement("div");w.className="nv-page";w.dataset.n=i;var c=document.createElement("canvas");w.appendChild(c);body.appendChild(w);st.pages.push(w)}
        layout();
        st.io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)draw(+e.target.dataset.n)})},{root:body,rootMargin:"120% 0px"});
        st.pages.forEach(function(w){st.io.observe(w)});
        body.addEventListener("scroll",onScroll,{passive:true});
        var pos=0;try{pos=+localStorage.getItem(posKey(id))||0}catch(e){}
        if(pos>1&&pos<=doc.numPages){st.pages[pos-1].scrollIntoView();toastMaybe(pos)}
        onScroll();
      });
    }).catch(function(){
      if(cur!==st)return;
      body.innerHTML='<p class="nv-msg">These notes are not stored on this phone yet. Open them once while online and they will then work offline.</p>';
    });
    function toastMaybe(p){toast("Continuing from page "+p)}
    function width(){return Math.min(body.clientWidth-8,900)*st.zoom}
    function layout(){
      var w=Math.round(width());
      st.pages.forEach(function(el){el.style.width=w+"px";el.style.height=Math.round(w*st.ratio)+"px";el.dataset.drawn=""});
      st.pages.forEach(function(el){var c=el.firstChild;c.width=0;c.height=0});
      st.rendering={};
      var vis=visible();vis.forEach(draw);
    }
    function visible(){
      var r=body.getBoundingClientRect(),out=[];
      st.pages.forEach(function(el,i){var b=el.getBoundingClientRect();if(b.bottom>r.top-r.height&&b.top<r.bottom+r.height)out.push(i+1)});return out;
    }
    function draw(n){
      var el=st.pages[n-1],w=Math.round(width());
      if(!el||el.dataset.drawn==String(w)||st.rendering[n])return;
      st.rendering[n]=true;
      st.doc.getPage(n).then(function(pg){
        var dpr=Math.min(window.devicePixelRatio||1,3),base=pg.getViewport({scale:1}),vp=pg.getViewport({scale:w/base.width*dpr});
        var c=el.firstChild;c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);c.style.width=w+"px";
        return pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise.then(function(){el.dataset.drawn=String(w)});
      }).catch(function(){}).then(function(){delete st.rendering[n]});
    }
    var t=null;
    function onScroll(){
      var r=body.getBoundingClientRect(),mid=r.top+r.height*0.35,p=1;
      for(var i=0;i<st.pages.length;i++){var b=st.pages[i].getBoundingClientRect();if(b.top<=mid)p=i+1;else break}
      $("nv-pg").textContent="Page "+p+" of "+st.pages.length;
      clearTimeout(t);t=setTimeout(function(){try{localStorage.setItem(posKey(id),String(p))}catch(e){}},400);
    }
    function setZoom(z){var keep=0;var r=body.getBoundingClientRect();for(var i=0;i<st.pages.length;i++){if(st.pages[i].getBoundingClientRect().top<=r.top+r.height*0.35)keep=i}
      st.zoom=z;layout();if(st.pages[keep])st.pages[keep].scrollIntoView()}
    $("nv-minus").onclick=function(){if(st.pages.length)setZoom(Math.max(0.8,+(st.zoom-0.2).toFixed(2)))};
    $("nv-plus").onclick=function(){if(st.pages.length)setZoom(Math.min(2,+(st.zoom+0.2).toFixed(2)))};
    var rt=null;st.onResize=function(){clearTimeout(rt);rt=setTimeout(function(){if(st.pages.length)layout()},200)};
    window.addEventListener("resize",st.onResize);
  };
})();
